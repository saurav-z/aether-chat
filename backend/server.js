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
 * AETHER BLIND RELAY
 *
 * Modes:
 *   RAM (Default) — volatile memory, max privacy, auto-GC
 *   DB  (MongoDB)  — durable storage with TTL index auto-expiry
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const MAX_SHARD_SIZE = 16 * 1024 * 1024;

const STORAGE_MODE = process.env.STORAGE_MODE || 'RAM';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aether_blind_relay';
const MESSAGE_TTL = parseInt(process.env.MESSAGE_TTL || '86400', 10);

console.log(`[AETHER] Starting in ${STORAGE_MODE} mode.`);
console.log(`[AETHER] Message TTL: ${MESSAGE_TTL}s (${(MESSAGE_TTL / 3600).toFixed(1)}h)`);

// --- RAM Adapter ---

const memoryStore = new Map();

const RamAdapter = {
  init: async () => {
    setInterval(() => {
      const now = Date.now();
      const limit = MESSAGE_TTL * 1000;
      let deleted = 0;
      for (const [id, shard] of memoryStore.entries()) {
        if (now - shard.created > limit) {
          memoryStore.delete(id);
          deleted++;
        }
      }
      if (deleted > 0) console.log(`[RAM-GC] Incinerated ${deleted} expired shards.`);
    }, 60_000);
    console.log('[AETHER] RAM Vault Initialized.');
  },

  save: async (topicId, shardId, data) => {
    memoryStore.set(shardId, { topicId, data, created: Date.now() });
  },

  get: async (topicId) => {
    const results = [];
    for (const [id, shard] of memoryStore.entries()) {
      if (shard.topicId === topicId) results.push({ id, data: shard.data });
    }
    return results;
  },

  delete: async (_topicId, shardId) => {
    memoryStore.delete(shardId);
  },
};

// --- DB Adapter (MongoDB) ---

let ShardModel;

const DbAdapter = {
  init: async () => {
    try {
      await mongoose.connect(MONGO_URI);

      const ShardSchema = new mongoose.Schema({
        topicId: { type: String, required: true, index: true },
        shardId: { type: String, required: true, unique: true },
        data: { type: String, required: true },
        isChunk: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      });

      // Note: if you previously ran with a different TTL, drop the index first:
      //   db.shards.dropIndex("createdAt_1")
      ShardSchema.index({ createdAt: 1 }, { expireAfterSeconds: MESSAGE_TTL });

      ShardModel = mongoose.model('Shard', ShardSchema);
      console.log('[AETHER] Connected to MongoDB Encrypted Store.');
    } catch (err) {
      console.error('[AETHER] FATAL: MongoDB Connection Failed', err);
      process.exit(1);
    }
  },

  save: async (topicId, shardId, data, isChunk = false) => {
    await ShardModel.create({ topicId, shardId, data, isChunk });
  },

  get: async (topicId) => {
    const shards = await ShardModel.find({ topicId }).select('shardId data -_id').lean();
    return shards.map(s => ({ id: s.shardId, data: s.data }));
  },

  delete: async (_topicId, shardId) => {
    await ShardModel.deleteOne({ shardId });
  },
};

const Store = STORAGE_MODE === 'DB' ? DbAdapter : RamAdapter;

// --- Server ---

const app = express();
const httpServer = createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGIN }));

const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket'],
  maxHttpBufferSize: MAX_SHARD_SIZE,
});

if (process.env.REDIS_URL) {
  const pubClient = createClient({ url: process.env.REDIS_URL });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[AETHER] Redis adapter enabled.');
    })
    .catch((err) => {
      console.error('[AETHER] Redis connection failed:', err);
    });
}

// --- Helpers ---

function isValidTopicId(topicId) {
  return typeof topicId === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(topicId);
}

const RATE_LIMIT_WINDOW = 10_000;
const MAX_SHARDS_PER_WINDOW = 120;  // enough for a full chunk burst
const MAX_SHARDS_PER_SOCKET = 500;
const MAX_SHARDS_PER_IP = 2000;

const ipShardCounts = new Map();

// --- Signaling ---

io.on('connection', (socket) => {
  const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  let depositTimestamps = [];
  let socketShardCount = 0;

  socket._deliveredShards = new Set();

  if (!ipShardCounts.has(ip)) ipShardCounts.set(ip, 0);

  socket.on('join_rendezvous', async (topicId) => {
    if (!isValidTopicId(topicId)) return;
    socket.join(topicId);

    try {
      const pending = await Store.get(topicId);
      if (pending && pending.length > 0) {
        const envelope = pending.map(s => {
          socket._deliveredShards.add(s.id);
          return { id: s.id, data: s.data, topicId };
        });
        socket.emit('swarm_shards', envelope);
      }
    } catch (e) {
      console.error('[AETHER] Inbox error:', e);
    }
  });

  socket.on('leave_rendezvous', (topicId) => {
    if (!isValidTopicId(topicId)) return;
    socket.leave(topicId);
  });

  socket.on('deposit_shard', async ({ topicId, shard, isChunk }) => {
    if (!isValidTopicId(topicId)) return;
    if (!shard || typeof shard !== 'string') return;
    if (shard.length > MAX_SHARD_SIZE) return;

    const now = Date.now();
    depositTimestamps = depositTimestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW);
    if (depositTimestamps.length >= MAX_SHARDS_PER_WINDOW) return;
    if (socketShardCount >= MAX_SHARDS_PER_SOCKET) return;
    if ((ipShardCounts.get(ip) || 0) >= MAX_SHARDS_PER_IP) return;

    depositTimestamps.push(now);
    socketShardCount++;
    ipShardCounts.set(ip, (ipShardCounts.get(ip) || 0) + 1);

    const shardId = crypto.randomUUID();

    try {
      await Store.save(topicId, shardId, shard, !!isChunk);

      // Track the shard ID on every recipient socket so they can ACK it
      const roomSockets = await io.in(topicId).fetchSockets();
      for (const roomSocket of roomSockets) {
        if (roomSocket.id !== socket.id) {
          roomSocket._deliveredShards = roomSocket._deliveredShards || new Set();
          roomSocket._deliveredShards.add(shardId);
        }
      }

      socket.to(topicId).emit('swarm_shards', [
        { id: shardId, data: shard, isChunk: !!isChunk, topicId },
      ]);
    } catch (e) {
      console.error('[AETHER] Deposit error:', e);
    }
  });

  socket.on('ack_shard', async ({ topicId, shardId }) => {
    if (!isValidTopicId(topicId)) return;
    if (typeof shardId !== 'string') return;
    if (!socket._deliveredShards || !socket._deliveredShards.has(shardId)) return;

    try {
      await Store.delete(topicId, shardId);
      socket._deliveredShards.delete(shardId);
    } catch (e) {
      console.error('[AETHER] ACK error:', e);
    }
  });

  socket.on('disconnect', () => {
    const current = ipShardCounts.get(ip) || 0;
    const updated = Math.max(0, current - socketShardCount);
    if (updated === 0) {
      ipShardCounts.delete(ip);
    } else {
      ipShardCounts.set(ip, updated);
    }
  });
});

// --- REST ---

app.get('/count/:topicId', async (req, res) => {
  const { topicId } = req.params;
  if (!isValidTopicId(topicId)) return res.status(400).json({ error: 'invalid_topic' });

  try {
    const shards = await Store.get(topicId);
    res.json({ count: shards.length });
  } catch (e) {
    console.error('[AETHER] Count error:', e);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/status', (_req, res) =>
  res.json({ status: 'online', storage_mode: STORAGE_MODE, ttl_seconds: MESSAGE_TTL }),
);

const distPath = join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(join(distPath, 'index.html')));
}

// --- Start ---

Store.init().then(() => {
  const server = httpServer.listen(PORT, () => {
    console.log(`[AETHER] Relay active on port ${PORT}`);
  });

  const shutdown = (signal) => {
    console.log(`[AETHER] ${signal} — shutting down`);
    server.close(() => {
      mongoose.disconnect().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
});