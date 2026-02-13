import { openDB } from 'idb';

const DB_NAME = 'aether_db';
const STORE_NAME = 'secure_store';

const initDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    },
  });
};

export const SecureStorage = {
  async set(key: string, value: any) {
    const db = await initDB();
    return db.put(STORE_NAME, value, key);
  },

  async get(key: string) {
    const db = await initDB();
    return db.get(STORE_NAME, key);
  },

  async delete(key: string) {
    const db = await initDB();
    return db.delete(STORE_NAME, key);
  },

  async clear() {
    const db = await initDB();
    return db.clear(STORE_NAME);
  },

  // Device key storage and sync
  async setDeviceKey(deviceKey: string) {
    return this.set('device_key', deviceKey);
  },
  async getDeviceKey() {
    return this.get('device_key');
  },
  async exportDeviceKey() {
    const key = await this.getDeviceKey();
    // Export as QR or encrypted blob
    return key;
  },
  async importDeviceKey(key: string) {
    return this.setDeviceKey(key);
  }
};