# AETHER // TECHNICAL SPECIFICATION

> **Warning**: This document describes the security architecture implemented in the Aether protocol.

## 1. Security Model

Aether operates on a **Zero-Trust** model. The application assumes the transport layer (WebSocket) and the Relay Server are compromised by default.

### 1.1 The "Blind Relay" Concept
The server (`server.js`) is designed as a "dumb pipe".
- **No Database**: It does not connect to SQL, Mongo, or Redis.
- **Volatile RAM**: Messages ("shards") are stored in a JavaScript `Map` in memory.
- **Garbage Collection**: An aggressive GC interval wipes data every 10 minutes.
- **Ignorance**: The server sees only encrypted binary strings. It has no access to the `SharedSecret`.

## 2. Cryptographic Primitives

We utilize the **Web Crypto API** (SubtleCrypto) native to modern browsers for maximum performance and security. We do not rely on user-space JavaScript crypto libraries where possible.

### 2.1 Key Derivation
- **Master Key**: Derived from user password using `PBKDF2` (SHA-512, 200,000 iterations).
- **Session Key**: Ephemeral keys generated per browser session.
- **Storage Key**: `AES-256-GCM` key used to encrypt the IndexedDB at rest.

### 2.2 Identity & Handshake
- **Algorithm**: Elliptic Curve Diffie-Hellman (ECDH).
- **Curve**: NIST P-256.
- **Process**:
    1.  Alice generates ephemeral keypair `(a, A)`.
    2.  Bob generates ephemeral keypair `(b, B)`.
    3.  They exchange public keys `A` and `B` via QR Code (Offline/Out-of-band).
    4.  Both derive `SharedSecret` using ECDH.

### 2.3 Transport Encryption
- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode).
- **IV**: Random 12-byte IV generated for *every* message.
- **Authentication**: GCM provides built-in integrity checking (AEAD). Tampered messages fail decryption.

## 3. Network Topology (The Mesh)

Aether uses a **Rolling Topic** mechanism to prevent metadata analysis of who is talking to whom.

### 3.1 Rolling Rendezvous
Socket.io rooms are not static (e.g., `room_id_123`). Instead, the room ID is a time-based hash derived from the Shared Secret.

$$Topic_t = HMAC(SharedSecret, \lfloor \frac{Time}{60} \rfloor)$$

- **Window**: 60 seconds.
- **Effect**: The "channel" ID changes every minute. An observer seeing traffic at `T` cannot correlate it to traffic at `T+10min` without the secret key.
- **Overlap**: Clients subscribe to `T` and `T+1` simultaneously to ensure delivery during window boundaries.

## 4. Local Storage (The Vault)

Data at rest in the browser (`IndexedDB`) is fully encrypted.
- **Structure**: We store a single encrypted blob containing the user's contacts and message history.
- **Key wrapping**: The encryption key for the database is wrapped by the user's Master Password.
- **Anti-Forensics**: Locking the vault (or closing the tab) unloads the keys from memory. Without the password, the `IndexedDB` data is random noise.

---

*Documentation maintained by [saurav-z](https://github.com/saurav-z)*
