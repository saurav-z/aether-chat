import { io } from 'socket.io-client';
import { getRendezvousTopic, encryptPayload, decryptPayload } from './cryptoUtils';

/**
 * AETHER MESH ENGINE (ANTI-TRACING MODE)
 * Features:
 * - Rolling Rendezvous Topics
 * - Delivery Confirmation (ACK)
 * - Blind Relay Support
 */

const CHUNK_SIZE = 16 * 1024; // 16KB Safe Limit

/**
 * SHARED SOCKET MANAGER
 * Manages a single WebSocket connection for all MeshNetwork instances
 */
class SocketManager {
  private static instance: SocketManager;
  private socket: any;
  private topics: Set<string> = new Set();
  private handlers: Map<string, (data: string) => void> = new Map();
  private statusCallbacks: Set<(status: string) => void> = new Set();
  private topicRefreshInterval: any;

  private constructor() {
    const connectionOpts = { 
      transports: ['websocket'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      path: '/socket.io'
    };

    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) {
      this.socket = io(envUrl, connectionOpts as any);
    } else if (import.meta.env.DEV) {
      this.socket = io('http://localhost:3000', connectionOpts as any);
    } else {
      this.socket = io(connectionOpts as any);
    }

    this.init();
  }

  public static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  private init() {
    this.socket.on('connect', () => {
      this.statusCallbacks.forEach(cb => cb('SECURE_RELAY_CONNECTED'));
    });

    this.socket.on('disconnect', () => {
      this.statusCallbacks.forEach(cb => cb('SIGNAL_LOST_RECONNECTING'));
    });

    this.socket.on('connect_error', () => {
      this.statusCallbacks.forEach(cb => cb('CONNECTION_ERROR'));
    });

    this.socket.on('swarm_shards', async (envelope: { id: string, data: string, topicId: string }[]) => {
      for (const item of envelope) {
        const handler = this.handlers.get(item.topicId);
        if (handler) handler(item.data);
        this.socket.emit('ack_shard', { topicId: item.topicId, shardId: item.id });
      }
    });
  }

  public register(topic: string, handler: (data: string) => void, onStatus: (s: string) => void) {
    this.handlers.set(topic, handler);
    this.statusCallbacks.add(onStatus);
    if (!this.topics.has(topic)) {
      this.socket.emit('join_rendezvous', topic);
      this.topics.add(topic);
    }
    if (this.socket.connected) onStatus('SECURE_RELAY_CONNECTED');
  }

  public unregister(topic: string, onStatus: (s: string) => void) {
    this.handlers.delete(topic);
    this.statusCallbacks.delete(onStatus);
    // Note: We don't necessarily leave the topic if other instances might need it, 
    // but for simplicity in Aether's 1-to-1 rendezvous, we leave it.
    this.socket.emit('leave_rendezvous', topic);
    this.topics.delete(topic);
  }

  public emit(event: string, data: any) {
    this.socket.emit(event, data);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      SocketManager.instance = undefined as any;
    }
  }
}

interface ChunkPacket {
  type: 'CHUNK';
  msgId: string;
  i: number; // Index
  n: number; // Total Chunks
  d: string; // Data (Chunk)
}

export class MeshNetwork {
  private socketManager: SocketManager;
  private sharedSecret: string;
  private onMessage: (msg: any) => void;
  private onStatus: (status: string) => void;
  private topicInterval: any;
  private currentTopic: string = '';

  // Reassembly Buffer
  private pendingChunks: Map<string, { count: number, total: number, parts: string[] }> = new Map();
  private processedIds: Set<string> = new Set(); // Dedup
  private activeBroadcasts: Set<string> = new Set(); // For cancellation

  constructor(sharedSecret: string, onMessage: (msg: any) => void, onStatus: (s: string) => void) {
    this.sharedSecret = sharedSecret;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    this.socketManager = SocketManager.getInstance();
    
    this.init();
  }

  private async init() {
    this.currentTopic = await getRendezvousTopic(this.sharedSecret, 0);
    this.socketManager.register(
      this.currentTopic,
      (data) => this.processIncomingData(data),
      this.onStatus
    );

    // Topic Rotation logic
    this.topicInterval = setInterval(async () => {
      const nextTopic = await getRendezvousTopic(this.sharedSecret, 0);
      if (nextTopic !== this.currentTopic) {
        this.socketManager.unregister(this.currentTopic, this.onStatus);
        this.currentTopic = nextTopic;
        this.socketManager.register(this.currentTopic, (data) => this.processIncomingData(data), this.onStatus);
      }
    }, 15000);
  }

  private async processIncomingData(rawData: string) {
    try {
      const hash = await this.fastHash(rawData);
      if (this.processedIds.has(hash)) return;
      this.processedIds.add(hash);
      
      if (this.processedIds.size > 2000) this.processedIds.clear();

      let isChunk = false;
      try {
        const packet = JSON.parse(rawData);
        if (packet.type === 'CHUNK' && packet.msgId) {
          isChunk = true;
          this.handleChunk(packet);
        }
      } catch (e) { /* Not JSON or not Chunk */ }

      if (!isChunk) {
        const decrypted = await decryptPayload(this.sharedSecret, rawData);
        this.onMessage(JSON.parse(decrypted));
      }
    } catch (err) {
      // Decrypt failed
    }
  }

  private async handleChunk(packet: ChunkPacket) {
    const { msgId, i, n, d } = packet;
    
    if (!this.pendingChunks.has(msgId)) {
      this.pendingChunks.set(msgId, { count: 0, total: n, parts: new Array(n) });
    }
    
    const buffer = this.pendingChunks.get(msgId)!;
    if (!buffer.parts[i]) {
      buffer.parts[i] = d;
      buffer.count++;
    }

    if (buffer.count === buffer.total) {
      const fullEncrypted = buffer.parts.join('');
      this.pendingChunks.delete(msgId);
      
      try {
        const decrypted = await decryptPayload(this.sharedSecret, fullEncrypted);
        this.onMessage(JSON.parse(decrypted));
      } catch (e) {
        console.error("Reassembly Decrypt Fail", e);
      }
    }
  }

  public async broadcast(payload: any, onProgress?: (p: number) => void, msgIdOverride?: string): Promise<string> {
    const msgId = msgIdOverride || crypto.randomUUID();
    // Wrap payload with the ID if not already there
    if (!payload.id) payload.id = msgId;

    const encryptedFull = await encryptPayload(this.sharedSecret, JSON.stringify(payload));
    const topic = this.currentTopic;

    if (encryptedFull.length < CHUNK_SIZE) {
      this.socketManager.emit('deposit_shard', { topicId: topic, shard: encryptedFull });
      this.onStatus('SENT_SECURE');
      if (onProgress) onProgress(100);
      return msgId;
    }

    this.activeBroadcasts.add(msgId);
    const totalChunks = Math.ceil(encryptedFull.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      // Cancellation check
      if (!this.activeBroadcasts.has(msgId)) {
        this.onStatus('TRANSFER_CANCELLED');
        throw new Error('TRANSFER_CANCELLED');
      }

      const chunk = encryptedFull.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const packet: ChunkPacket = { type: 'CHUNK', msgId, i, n: totalChunks, d: chunk };
      this.socketManager.emit('deposit_shard', { topicId: topic, shard: JSON.stringify(packet) });

      if (onProgress) onProgress(Math.round(((i + 1) / totalChunks) * 100));

      // Async yield every 20 chunks to keep UI snappy
      if (i % 20 === 0) {
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this.activeBroadcasts.delete(msgId);
    this.onStatus('SENT_SECURE_CHUNKS');
    return msgId;
  }

  public cancelBroadcast(msgId: string) {
    this.activeBroadcasts.delete(msgId);
  }

  private async fastHash(str: string): Promise<string> {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  public destroy() {
    clearInterval(this.topicInterval);
    this.socketManager.unregister(this.currentTopic, this.onStatus);
  }
}