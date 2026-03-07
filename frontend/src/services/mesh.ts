import { io } from 'socket.io-client';
import { getRendezvousTopic, encryptPayload, decryptPayload } from './cryptoUtils';

const CHUNK_SIZE = 14 * 1024;
const TOPIC_WINDOW_OFFSETS = [-2, -1, 0, 1, 2]; // minutes
const TOPIC_REFRESH_MS = 15_000;
const STALE_TOPIC_GRACE_CYCLES = 2;

interface ChunkPacket {
  type: 'CHUNK';
  msgId: string;
  i: number;
  n: number;
  d: string;
}

interface PendingBuffer {
  count: number;
  total: number;
  parts: (string | undefined)[];
  receivedIndices: Set<number>;
}

class SocketManager {
  private static instance: SocketManager | null = null;

  private socket: ReturnType<typeof io>;
  private topicHandlers: Map<string, { fn: (data: string) => void; refs: number }> = new Map();
  private statusCallbacks: Set<(status: string) => void> = new Set();

  private constructor() {
    const opts = {
      transports: ['websocket'],
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      path: '/socket.io',
    };

    const envUrl = (import.meta as any).env?.VITE_BACKEND_URL;
    if (envUrl) {
      this.socket = io(envUrl, opts as any);
    } else if ((import.meta as any).env?.DEV) {
      this.socket = io('http://localhost:3000', opts as any);
    } else {
      this.socket = io(opts as any);
    }

    this.attachSocketEvents();
  }

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private attachSocketEvents() {
    this.socket.on('connect', () => {
      for (const topic of this.topicHandlers.keys()) {
        this.socket.emit('join_rendezvous', topic);
      }
      this.broadcastStatus('SECURE_RELAY_CONNECTED');
    });

    this.socket.on('disconnect', () => {
      this.broadcastStatus('SIGNAL_LOST_RECONNECTING');
    });

    this.socket.on('connect_error', () => {
      this.broadcastStatus('CONNECTION_ERROR');
    });

    this.socket.on(
      'swarm_shards',
      (envelope: { id: string; data: string; topicId: string }[]) => {
        for (const item of envelope) {
          const entry = this.topicHandlers.get(item.topicId);
          if (entry) entry.fn(item.data);
          this.socket.emit('ack_shard', { topicId: item.topicId, shardId: item.id });
        }
      },
    );
  }

  private broadcastStatus(status: string) {
    this.statusCallbacks.forEach((cb) => cb(status));
  }

  register(topic: string, handler: (data: string) => void, onStatus: (s: string) => void) {
    this.statusCallbacks.add(onStatus);

    const existing = this.topicHandlers.get(topic);
    if (existing) {
      existing.fn = handler;
      existing.refs += 1;
    } else {
      this.topicHandlers.set(topic, { fn: handler, refs: 1 });
      this.socket.emit('join_rendezvous', topic);
    }

    if (this.socket.connected) onStatus('SECURE_RELAY_CONNECTED');
  }

  unregister(topic: string, onStatus: (s: string) => void) {
    this.statusCallbacks.delete(onStatus);

    const existing = this.topicHandlers.get(topic);
    if (!existing) return;

    existing.refs -= 1;
    if (existing.refs <= 0) {
      this.topicHandlers.delete(topic);
      this.socket.emit('leave_rendezvous', topic);
    }
  }

  emit(event: string, data: unknown) {
    this.socket.emit(event, data);
  }

  destroy() {
    this.socket.disconnect();
    SocketManager.instance = null;
  }
}

export class MeshNetwork {
  readonly sharedSecret: string;

  private socketManager: SocketManager;
  private onMessage: (msg: unknown) => void;
  private onStatus: (status: string) => void;

  private topicInterval: ReturnType<typeof setInterval> | null = null;
  private activeTopics: Map<string, number> = new Map();
  private currentTopic = '';

  private pendingChunks: Map<string, PendingBuffer> = new Map();
  private seenMessages: Set<string> = new Set();
  private activeBroadcasts: Set<string> = new Set();

  constructor(
    sharedSecret: string,
    onMessage: (msg: unknown) => void,
    onStatus: (s: string) => void,
  ) {
    this.sharedSecret = sharedSecret;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socketManager = SocketManager.getInstance();
    this.init();
  }

  private async init() {
    await this.refreshTopics();
    this.topicInterval = setInterval(() => this.refreshTopics(), TOPIC_REFRESH_MS);
  }

  private async refreshTopics() {
    const topics = await Promise.all(
      TOPIC_WINDOW_OFFSETS.map((offset) =>
        getRendezvousTopic(this.sharedSecret, offset * 60),
      ),
    );
    const freshTopics = new Set(topics);
    this.currentTopic = topics[2];

    for (const t of freshTopics) {
      if (!this.activeTopics.has(t)) {
        this.socketManager.register(t, (data) => this.processIncomingData(data), this.onStatus);
      }
      this.activeTopics.set(t, 0);
    }

    for (const [t, staleCycles] of this.activeTopics) {
      if (freshTopics.has(t)) continue;

      const nextStaleness = staleCycles + 1;
      const safeToRemove =
        nextStaleness >= STALE_TOPIC_GRACE_CYCLES &&
        this.pendingChunks.size === 0 &&
        this.activeBroadcasts.size === 0;

      if (safeToRemove) {
        this.socketManager.unregister(t, this.onStatus);
        this.activeTopics.delete(t);
      } else {
        this.activeTopics.set(t, nextStaleness);
      }
    }
  }

  private async processIncomingData(rawData: string) {
    try {
      let parsed: unknown = null;
      try { parsed = JSON.parse(rawData); } catch { /* not JSON */ }

      if (
        parsed &&
        typeof parsed === 'object' &&
        (parsed as ChunkPacket).type === 'CHUNK' &&
        typeof (parsed as ChunkPacket).msgId === 'string'
      ) {
        await this.handleChunk(parsed as ChunkPacket);
        return;
      }

      const fingerprint = this.makeFingerprint(rawData);
      if (this.seenMessages.has(fingerprint)) return;
      this.seenMessages.add(fingerprint);

      if (this.seenMessages.size > 2000 && this.pendingChunks.size === 0) {
        this.seenMessages.clear();
      }

      const decrypted = await decryptPayload(this.sharedSecret, rawData);
      this.onMessage(JSON.parse(decrypted));
    } catch {
    // Not for us or corrupted — discard silently
    }
  }

  private async handleChunk(packet: ChunkPacket) {
    const { msgId, i, n, d } = packet;

    if (!this.pendingChunks.has(msgId)) {
      this.pendingChunks.set(msgId, {
        count: 0,
        total: n,
        parts: new Array(n).fill(undefined),
        receivedIndices: new Set(),
      });
    }

    const buffer = this.pendingChunks.get(msgId)!;

    if (buffer.receivedIndices.has(i)) return;

    buffer.parts[i] = d;
    buffer.receivedIndices.add(i);
    buffer.count += 1;

    if (buffer.count === buffer.total) {
      this.pendingChunks.delete(msgId);
      const fullEncrypted = (buffer.parts as string[]).join('');
      try {
        const decrypted = await decryptPayload(this.sharedSecret, fullEncrypted);
        this.onMessage(JSON.parse(decrypted));
      } catch (e) {
        console.error('[MESH] Reassembly failed', e);
      }
    }
  }

  async broadcast(
    payload: Record<string, unknown>,
    onProgress?: (p: number) => void,
    msgIdOverride?: string,
  ): Promise<string> {
    const msgId = msgIdOverride ?? (crypto.randomUUID() as string);
    if (!payload.id) payload.id = msgId;

    const encryptedFull = await encryptPayload(this.sharedSecret, JSON.stringify(payload));
    const topic = this.currentTopic;

    if (encryptedFull.length <= CHUNK_SIZE) {
      this.socketManager.emit('deposit_shard', { topicId: topic, shard: encryptedFull, isChunk: false });
      if (onProgress) onProgress(100);
      return msgId;
    }

    this.activeBroadcasts.add(msgId);
    const totalChunks = Math.ceil(encryptedFull.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      if (!this.activeBroadcasts.has(msgId)) {
        this.onStatus('TRANSFER_CANCELLED');
        throw new Error('TRANSFER_CANCELLED');
      }

      const slice = encryptedFull.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const packet: ChunkPacket = { type: 'CHUNK', msgId, i, n: totalChunks, d: slice };

      this.socketManager.emit('deposit_shard', {
        topicId: topic,
        shard: JSON.stringify(packet),
        isChunk: true,
      });

      if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));
      // Yield every chunk to keep the socket buffer healthy and avoid dropping
      await new Promise<void>((r) => setTimeout(r, 8));
    }

    this.activeBroadcasts.delete(msgId);
    return msgId;
  }

  cancelBroadcast(msgId: string) {
    this.activeBroadcasts.delete(msgId);
  }

  destroy() {
    if (this.topicInterval !== null) {
      clearInterval(this.topicInterval);
      this.topicInterval = null;
    }
    for (const [t] of this.activeTopics) {
      this.socketManager.unregister(t, this.onStatus);
    }
    this.activeTopics.clear();
    this.pendingChunks.clear();
    this.activeBroadcasts.clear();
  }

  // Length + edge slice fingerprint for relay-dedup of regular messages.
  // AES-GCM ciphertexts are always unique (random IV per encrypt), so this
  // only needs to catch the relay re-delivering the exact same shard bytes.
  private makeFingerprint(s: string): string {
    const len = s.length;
    if (len < 64) return `${len}:${s}`;
    return `${len}:${s.substring(0, 32)}:${s.substring(len - 32)}`;
  }
}