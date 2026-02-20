# AETHER // SECURITY PROTOCOLS

This document details the security and privacy mechanisms for metadata-related features like notifications and message status receipts.

## 1. Zero-Knowledge Notifications

Aether implements a privacy-preserving background notification system that works without a persistent connection and without exposing message content.

### 1.1 Privacy-Safe Polling
- **Mechanism**: The Service Worker (`sw.js`) performs periodic REST polls to the relay server.
- **Anonymity**: Instead of using a user ID or session token, the SW polls specific **Rendezvous Topic IDs**.
- **Topic Derivation**: Topic IDs are derived from the `SharedSecret` using a time-based HMAC. The server sees a random 64-character string and cannot correlate it to a specific user or conversation.
- **Payload Privacy**: The polling endpoint (`/count/:topicId`) returns only the **count** of waiting encrypted shards. It never returns message content, sender info, or timestamps.

### 1.2 System-Level Notifications
- **Content**: When a notification is shown by the OS (Android/iOS/PC), the text is hardcoded to a generic string: `"New Secure Signal"`.
- **Isolation**: The message content remains encrypted in the relay's memory (or DB) and is only decrypted locally within the Aether app after the user opens it. No plaintext ever touches the OS notification tray.

## 2. Seen/Unseen Status Receipts

Status indicators (double checkmarks) are handled with the same level of security as the messages themselves.

### 2.1 E2EE Signal Exchange
- **Encrypted Payloads**: "Seen" receipts are sent as standard encrypted messages over the same mesh network.
- **Payload Structure**: The payload contains a signal type (`type: 'seen'`) and the `id` of the message being acknowledged.
- **Server Blindness**: To the relay server, a "seen" receipt looks exactly like a normal chat message or a file chunk. The server cannot distinguish between a chat message, a delete signal, or a seen receipt.

### 2.2 Metadata Protection
- **No Side-Channels**: Receipts are sent over the **Rolling Topic** which rotates every 60 seconds. This prevents long-term traffic analysis of receipt patterns.
- **Automatic Cleanup**: Once a seen receipt is processed by the sender's device, the message status is updated in the local encrypted Vault, and the receipt signal is discarded.

## 3. Management Signals (Delete/Clear/Disconnect)

All administrative actions (deleting a message, clearing a chat, or severing a connection) utilize the same E2EE signaling path.

- **Sync Deletion**: When you delete a message, an encrypted `delete` signal is broadcast. The recipient's device receives this, verifies the signature, and removes the message from its own local vault.
- **Mutual Clearance**: `clear_chat` and `disconnect` signals ensure that privacy actions are synchronized. If you sever a connection, the recipient's device is instructed to wipe the keys and history for that contact immediately, preventing orphaned data.

---

**Summary**: Aether treats metadata (status, arrival) with the same cryptographic rigor as message content. The server remains a "dumb pipe" that only sees encrypted blobs and rotating topic IDs.
