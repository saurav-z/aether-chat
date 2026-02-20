# AETHER // TECHNICAL SPECIFICATION


> **Warning**: This document describes the security architecture implemented in the Aether protocol. The backend is stateless, privacy-first, and only relays encrypted payloads. No tracking, logging, or analytics are performed.

## 1. Security Model

Aether operates on a **Zero-Trust** model. The application assumes the transport layer (WebSocket) and the Relay Server are compromised by default.


### 1.1 The "Blind Relay" Concept
The server (`server.js`) is designed as a "dumb pipe".
- **No User Data Storage**: It does not store or log any user data, private keys, or decrypted messages.
- **Volatile RAM**: Messages ("shards") are stored in a JavaScript `Map` in memory, or can be relayed via Redis pub-sub for multi-instance scaling (no message storage in Redis).
- **Garbage Collection**: An aggressive GC interval wipes data every 10 minutes.
- **Ignorance**: The server sees only encrypted binary strings. It has no access to the `SharedSecret`.
- **Rate Limiting & Quotas**: Strict per-socket and per-IP quotas prevent resource exhaustion.
- **Secure Ack**: Only the socket that received a shard can acknowledge/delete it.
- **TopicId Validation**: Topic IDs are strictly validated to prevent abuse.


## 2. Cryptographic Primitives & E2EE

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

    3.  They exchange public keys `A` and `B` via QR Code (Offline/Out-of-band or via relay, never private keys).
    4.  Both derive `SharedSecret` using ECDH. Each message uses a unique symmetric key, and forward secrecy is enforced.


### 2.3 Transport Encryption
- **Algorithm**: `AES-256-GCM` (Galois/Counter Mode).
- **IV**: Random 12-byte IV generated for *every* message.
- **Authentication**: GCM provides built-in integrity checking (AEAD). Tampered messages fail decryption.
- **End-to-End**: All encryption and decryption happens on the client. The backend never sees plaintext or keys.

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
- **Structure**: We store a single encrypted blob containing the user's contacts, message history, and file metadata.
- **File Transfer**: Files are encrypted client-side and uploaded in chunks. The server only relays or stores encrypted blobs, never plaintext. Chunking allows large files to be sent even on free hosts with RAM/disk limits. Chunks are deleted after delivery or TTL expiry.
- **Key wrapping**: The encryption key for the database and files is wrapped by both the user's Master Password and a device-stored key. Both are required to unlock the vault.
- **Session Expiry**: Users can set password/session expiry (e.g., 5 min, 1 hour, 1 day, 1 week). After expiry/inactivity, the vault is locked and keys are wiped from memory.
- **Device Key Sync/Move**: Device key can be securely transferred to another device via QR code or encrypted transfer. Without both password and device key, data is unrecoverable.
- **Anti-Forensics**: Locking the vault (or closing the tab) unloads the keys from memory. Without both password and device key, the `IndexedDB` data and files are random noise.

---

*For detailed information on the security of notifications and seen receipts, see [SECURITY_PROTOCOLS.md](SECURITY_PROTOCOLS.md).*

*Documentation maintained by [saurav-z](https://github.com/saurav-z)*
