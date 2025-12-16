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

interface ChunkPacket {
  type: 'CHUNK';
  msgId: string;
  i: number; // Index
  n: number; // Total Chunks
  d: string; // Data (Chunk)
}

export class MeshNetwork {
  private socket: any;
  private sharedSecret: string;
  private onMessage: (msg: any) => void;
  private onStatus: (status: string) => void;
  private topicInterval: any;
  private activeTopics: Set<string> = new Set();
  
  // Reassembly Buffer
  private pendingChunks: Map<string, { count: number, total: number, parts: string[] }> = new Map();
  private processedIds: Set<string> = new Set(); // Dedup

  constructor(sharedSecret: string, onMessage: (msg: any) => void, onStatus: (s: string) => void) {
    this.sharedSecret = sharedSecret;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
    
    const connectionOpts = { 
      transports: ['websocket'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      path: '/socket.io'
    };

    const envUrl = import.meta.env.VITE_BACKEND_URL;

    if (envUrl) {
        console.log(`[MESH] Connecting to Remote Signal: ${envUrl}`);
        this.socket = io(envUrl, connectionOpts as any);
    } else if (import.meta.env.DEV) {
        console.log(`[MESH] Connecting to Dev Signal: localhost:3000`);
        this.socket = io('http://localhost:3000', connectionOpts as any);
    } else {
        console.log(`[MESH] Connecting to Self-Hosted Signal`);
        this.socket = io(connectionOpts as any);
    }
    
    this.init();
  }

  private async init() {
    this.socket.on('connect', () => {
      this.onStatus('SECURE_RELAY_CONNECTED');
      this.refreshTopics(); // Immediate join
    });

    this.socket.on('disconnect', () => {
      this.onStatus('SIGNAL_LOST_RECONNECTING');
    });

    this.socket.on('connect_error', () => {
        this.onStatus('CONNECTION_ERROR');
    });

    this.socket.on('swarm_shards', async (envelope: { id: string, data: string }[]) => {
      // Logic: Receive -> Process -> ACK
      for (const item of envelope) {
        await this.processIncomingData(item.data);
        // CRITICAL: Send ACK to server to confirm delivery so it can be wiped from RAM
        this.socket.emit('ack_shard', { topicId: await getRendezvousTopic(this.sharedSecret, 0), shardId: item.id });
      }
    });

    // Refresh topics every 15s
    this.topicInterval = setInterval(() => this.refreshTopics(), 15000);
  }

  private async refreshTopics() {
    const tCurrent = await getRendezvousTopic(this.sharedSecret, 0);
    const tNext = await getRendezvousTopic(this.sharedSecret, 60); 
    
    if (!this.activeTopics.has(tCurrent)) {
        this.socket.emit('join_rendezvous', tCurrent);
        this.activeTopics.add(tCurrent);
    }
    if (!this.activeTopics.has(tNext)) {
        this.socket.emit('join_rendezvous', tNext);
        this.activeTopics.add(tNext);
    }
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

  public async broadcast(payload: any) {
    const encryptedFull = await encryptPayload(this.sharedSecret, JSON.stringify(payload));
    const topic = await getRendezvousTopic(this.sharedSecret, 0);

    if (encryptedFull.length < CHUNK_SIZE) {
      this.socket.emit('deposit_shard', { topicId: topic, shard: encryptedFull });
      this.onStatus('SENT_SECURE');
      return;
    }

    const msgId = crypto.randomUUID();
    const totalChunks = Math.ceil(encryptedFull.length / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = encryptedFull.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const packet: ChunkPacket = { type: 'CHUNK', msgId, i, n: totalChunks, d: chunk };
      this.socket.emit('deposit_shard', { topicId: topic, shard: JSON.stringify(packet) });
    }
    this.onStatus('SENT_SECURE_CHUNKS');
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
    this.socket.disconnect();
  }
}