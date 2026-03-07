import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-adapter';

/**
 * AETHER BLIND RELAY v4.1 (Migration & Metadata Update)
 * 
 * Modes:
 * 1. RAM (Default): Stores shards in volatile memory. Max privacy.
 * 2. DB (MongoDB): Stores shards on disk with auto-expiration.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*"; 
const MAX_SHARD_SIZE = 16 * 1024 * 1024; // 16MB Cap

// STORAGE SETTINGS
const STORAGE_MODE = process.env.STORAGE_MODE || 'RAM'; // 'RAM' or 'DB'
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aether_blind_relay';

// Default TTL: 24 Hours (86400 seconds). 
// Data is incinerated if not delivered within this window.
const MESSAGE_TTL = parseInt(process.env.MESSAGE_TTL || '86400'); 

console.log(`[AETHER] Starting in ${STORAGE_MODE} mode.`);
console.log(`[AETHER] Message TTL: ${MESSAGE_TTL} seconds (${(MESSAGE_TTL/3600).toFixed(1)} hours)`);

// --- STORAGE ADAPTERS ---

// 1. MEMORY ADAPTER (RAM)
const memoryStore = new Map(); // Map<shardId, { topicId, data, created }>

const RamAdapter = {
  init: async () => {
    // Garbage Collector Loop for RAM Mode
    setInterval(() => {
      const now = Date.now();
      let deleted = 0;
      for (const [id, shard] of memoryStore.entries()) {
        if (now - shard.created > (MESSAGE_TTL * 1000)) {
          memoryStore.delete(id);
          deleted++;
        }
      }
      if (deleted > 0) console.log(`[RAM-GC] Incinerated ${deleted} expired shards.`);
    }, 60000); // Check every minute
    console.log('[AETHER] RAM Vault Initialized.');
  },
  save: async (topicId, shardId, data) => {
    memoryStore.set(shardId, { topicId, data, created: Date.now() });
  },
  get: async (topicId) => {
    const results = [];
    for (const [id, shard] of memoryStore.entries()) {
      if (shard.topicId === topicId) {
        results.push({ id, data: shard.data });
      }
    }
    return results;
  },
  delete: async (topicId, shardId) => {
    memoryStore.delete(shardId);
  }
};

// 2. DATABASE ADAPTER (MongoDB)
let ShardModel;

const DbAdapter = {
  init: async () => {
    try {
      await mongoose.connect(MONGO_URI);
      
      const ShardSchema = new mongoose.Schema({
        topicId: { type: String, required: true, index: true },
        shardId: { type: String, required: true, unique: true },
        data: { type: String, required: true },
        createdAt: { type: Date, default: Date.now }
      });

      // Dynamic TTL Index
      // Note: If you previously ran this with a different TTL, you must drop the index in Mongo manually:
      // db.shards.dropIndex("createdAt_1")
      ShardSchema.index({ createdAt: 1 }, { expireAfterSeconds: MESSAGE_TTL });
      
      ShardModel = mongoose.model('Shard', ShardSchema);
      console.log('[AETHER] Connected to MongoDB Encrypted Store.');
    } catch (err) {
      console.error('[AETHER] FATAL: MongoDB Connection Failed', err);
      process.exit(1);
    }
  },
  save: async (topicId, shardId, data) => {
    await ShardModel.create({ topicId, shardId, data });
  },
  get: async (topicId) => {
    const shards = await ShardModel.find({ topicId }).select('shardId data -_id').lean();
    return shards.map(s => ({ id: s.shardId, data: s.data }));
  },
  delete: async (topicId, shardId) => {
    await ShardModel.deleteOne({ topicId, shardId });
  }
};

// Select Active Adapter
const Store = STORAGE_MODE === 'DB' ? DbAdapter : RamAdapter;

// --- SERVER SETUP ---
const app = express();
const httpServer = createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

const io = new Server(httpServer, {
  cors: { 
    origin: ALLOWED_ORIGIN, 
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket'],
  maxHttpBufferSize: MAX_SHARD_SIZE
});

// Redis Pub-Sub Adapter for socket.io
if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();
  Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
    io.adapter(createAdapter(pubClient, subClient));
    console.log('[AETHER] Redis adapter enabled for socket.io');
  }).catch((err) => {
    console.error('[AETHER] Redis connection failed:', err);
  });
}

// --- SIGNALING LOGIC ---
io.on('connection', (socket) => {
  
  // --- Rate Limiting and Quotas ---
  const RATE_LIMIT_WINDOW = 10000; // 10 seconds
  const MAX_SHARDS_PER_WINDOW = 10; // max 10 deposits per window
  const MAX_SHARDS_PER_SOCKET = 100; // max 100 shards per socket
  const MAX_SHARDS_PER_IP = 500; // max 500 shards per IP
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
  let depositTimestamps = [];
  let socketShardCount = 0;
  socket._deliveredShards = new Set();
  // Global IP quota tracking (in-memory, resets on restart)
  if (!global._ipShardCounts) global._ipShardCounts = {};
  if (!global._ipShardCounts[ip]) global._ipShardCounts[ip] = 0;

  // --- TopicId Validation ---
  function isValidTopicId(topicId) {
    return typeof topicId === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(topicId);
  }

  // 1. Join & Retrieve (Inbox Check)
  socket.on('join_rendezvous', async (topicId) => {
    if (!isValidTopicId(topicId)) return;
    socket.join(topicId);
    try {
      const pending = await Store.get(topicId);
      if (pending.length > 0) {
        socket.emit('swarm_shards', pending);
        // Track delivered shard IDs for this socket
        pending.forEach(s => socket._deliveredShards.add(s.id));
      }
    } catch (e) {
      console.error("Inbox Error:", e);
    }
  });

  // 2. Deposit (Sender writes to Dead Drop)
  socket.on('deposit_shard', async ({ topicId, shard, isChunk }) => {
    if (!isValidTopicId(topicId) || !shard || shard.length > MAX_SHARD_SIZE) return;
    // Rate limiting
    const now = Date.now();
    depositTimestamps = depositTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    if (depositTimestamps.length >= MAX_SHARDS_PER_WINDOW) return;
    if (socketShardCount >= MAX_SHARDS_PER_SOCKET) return;
    if (global._ipShardCounts[ip] >= MAX_SHARDS_PER_IP) return;
    depositTimestamps.push(now);
    socketShardCount++;
    global._ipShardCounts[ip]++;
    const shardId = crypto.randomUUID();
    try {
      // 1. Persistence (RAM or DB)
      await Store.save(topicId, shardId, shard);
      // 2. Realtime Relay
      socket.to(topicId).emit('swarm_shards', [{ id: shardId, data: shard, isChunk }]);
    } catch (e) {
      console.error("Deposit Error:", e);
    }
  });

  // 3. Acknowledge & Incinerate (Receiver confirms delivery)
  socket.on('ack_shard', async ({ topicId, shardId }) => {
    if (!isValidTopicId(topicId)) return;
    // Only allow ack if this socket received the shard
    if (!socket._deliveredShards.has(shardId)) return;
    try {
      await Store.delete(topicId, shardId);
      socket._deliveredShards.delete(shardId);
    } catch (e) {
      console.error("Ack Error:", e);
    }
  });
});

app.get('/count/:topicId', async (req, res) => {
  const { topicId } = req.params;
  if (typeof topicId !== 'string' || !/^[a-zA-Z0-9_-]{6,64}$/.test(topicId)) {
    return res.status(400).json({ error: 'invalid topic' });
  }
  try {
    const shards = await Store.get(topicId);
    res.json({ count: shards.length });
  } catch (e) {
    res.status(500).json({ error: 'server error' });
  }
});

app.get('/status', (req, res) => res.json({
  status: 'online',
  storage_mode: STORAGE_MODE,
  ttl_seconds: MESSAGE_TTL
}));

// --- HOSTING ---
const distPath = join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
}

// Start
Store.init().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`[AETHER] Relay active on port ${PORT}`);
  });
});