<div align="center">

# A E T H E R 
### Z E R O - T R U S T // M E S H // N O D E

[![Vibe Coded](https://img.shields.io/badge/Vibe-Coded-ff00ff.svg)](https://github.com/saurav-z/aether)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Storage](https://img.shields.io/badge/Storage-Hybrid%20(RAM%2FDB)-blue.svg)](https://www.mongodb.com/)
[![Protocol](https://img.shields.io/badge/Protocol-Blind%20Relay-red.svg)](https://github.com/saurav-z/aether)

**The Sovereign Communication Terminal.**  
*No Logs. No Masters. No Trace.*

[Launch Demo](https://aether-mesh.vercel.app) · [Report Bug](https://github.com/saurav-z/aether/issues)

</div>

---

## 📡 TRANSMISSION SPECS

Aether is not just a chat app; it is a **digital safehouse**. It assumes the network is compromised, the server is hostile, and your device is being watched.

*   **Encryption**: AES-256-GCM + ECDH (P-256) Curve.
*   **Protocol**: Rolling Hash Rendezvous (Anti-Traffic Analysis).
*   **Payload Cap**: **16MB** per transmission (Encrypted Shard Limit).
*   **Storage**: Volatile RAM (Default) or Mongo "Dead Drop".

---

## 🛡️ THE ARCHITECTURE

### 1. The Blind Relay (Server)
The server is a "dumb pipe". It sees only encrypted binary blobs. It does not know who you are, who you are talking to, or what you are saying. It stores messages in **RAM** by default. If the server is seized or rebooted, all undelivered messages are incinerated instantly.

### 2. The Dead Drop (Persistence)
Messages are temporary.
*   **Default TTL**: 24 Hours.
*   **Delivery Rule**: Once *any* device downloads a message, the server deletes it.
*   **Sync**: Identity sync clones your vault, but new messages are delivered to the *first* active device only. This preserves Forward Secrecy.

### 3. The 16MB Hard Limit
To maintain mesh integrity and browser performance during heavy encryption rounds, file transfers are strictly capped at **16MB**.
*   Images are stripped of EXIF/GPS metadata *client-side* before encryption.
*   Files larger than 16MB are rejected at the source.

---

## ⚠️ OPERATIONAL RISKS

*   **Loss of Key**: Your Master Password *is* your key. There is no "Forgot Password". Lose it, and your identity is lost forever.
*   **Battery Drain**: Aether keeps a live WebSocket tunnel open and performs continuous crypto-operations. It consumes significantly more power than standard apps.
*   **Single Device**: Messages are deleted upon delivery. If you have Aether open on a Laptop and a Phone, only *one* will receive the message.

---

## 💾 DEPLOYMENT PROTOCOL

### Option A: Docker (Recommended)
Deploy your own sovereign node in seconds.

1.  **Clone**
    ```bash
    git clone https://github.com/saurav-z/aether.git
    cd aether
    ```

2.  **Configure Environment** (Optional)
    ```bash
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
    # Edit .env files if needed (default values work for local dev)
    ```

3.  **Ignition**
    ```bash
    docker-compose up -d --build
    ```

4.  **Access**
    - Frontend: `http://localhost:5173`
    - Backend: `http://localhost:3000`
    - MongoDB: `localhost:27017`

### Option B: Manual (Dev)
Hack the Gibson.

1.  **Install Backend Deps**
    ```bash
    cd backend && npm install && cd ..
    ```

2.  **Install Frontend Deps**
    ```bash
    cd frontend && npm install && cd ..
    ```

3.  **Configure Environment**
    ```bash
    cp backend/.env.example backend/.env
    cp frontend/.env.example frontend/.env
    ```

4.  **Start Backend** (Terminal 1)
    ```bash
    cd backend && node server.js
    ```

5.  **Start Frontend** (Terminal 2)
    ```bash
    cd frontend && npm run dev
    ```

6.  **Access**
    - Frontend: `http://localhost:5173`
    - Backend API: `http://localhost:3000`

---

<div align="center">
  <p>Built with 💀 and ☕ by <a href="https://github.com/saurav-z">saurav-z</a></p>
</div>