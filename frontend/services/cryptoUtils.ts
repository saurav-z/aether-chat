import * as OTPAuth from 'otpauth';

/**
 * AETHER CRYPTO ENGINE V6 (SESSION MANAGEMENT)
 * Includes: ECDH, AES-256-GCM, PBKDF2, TOTP, ROLLING TOPICS, SECURE STORAGE, GROUP LOGIC, SESSION PERSISTENCE
 */

// --- TYPES ---

export interface EncryptedVault {
  iv: string;
  data: string;
  salt: string;
}

export interface Wallet {
  seedPhrase: string;
  masterKey: CryptoKey; 
  publicKey: CryptoKey; 
  privateKey: CryptoKey; 
  storageKey: CryptoKey;
  publicKeyRaw: string;
  totpSecret: string;
}

export interface Message {
  id: string;
  text: string;
  file?: { name: string, type: string, size: number, data: string };
  timestamp: number;
  sender: 'me' | 'them' | string; // 'string' used for Group Member Aliases
  senderAlias?: string;
  replyTo?: string; // ID of message being replied to
  expiresAt?: number; // Timestamp when this message should vanish
  type?: 'text' | 'image' | 'system' | 'delete' | 'invite'; 
}

export interface Contact {
  id: string;
  alias: string;
  emoji: string;
  sharedSecret: string; // ECDH Derived for Direct, Random AES for Groups
  messages: Message[];
  unread: number;
  isGroup?: boolean;
  vanishTime?: number; // Default TTL for new messages (ms)
  autoDeleteInterval?: number; // Local cleanup frequency
  myGroupAlias?: string; // My alias in this specific group
}

// --- UTILS ---
const enc = new TextEncoder();
const dec = new TextDecoder();
const buf2hex = (buffer: ArrayBufferLike) => [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
const hex2buf = (hex: string) => {
    if (!hex) return new ArrayBuffer(0);
    const match = hex.match(/.{1,2}/g);
    if (!match) return new ArrayBuffer(0);
    return new Uint8Array(match.map(byte => parseInt(byte, 16))).buffer;
};

// --- 2FA (TOTP) ---

export const generateTOTP = () => {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
};

export const getTOTPUri = (secret: string, label: string) => {
  const totp = new OTPAuth.TOTP({
    issuer: 'AETHER MESH',
    label: label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
  return totp.toString();
};

export const verifyTOTP = (secret: string, token: string) => {
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret)
  });
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
};

// --- HASHING ---
export const hashString = async (str: string): Promise<string> => {
  const buf = enc.encode(str);
  const hash = await window.crypto.subtle.digest("SHA-256", buf);
  return buf2hex(hash);
};

// --- WALLET & ENCRYPTION ---

export const generateWallet = async (seedPhrase?: string): Promise<Wallet> => {
  const phrase = seedPhrase || Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16)).join(' '); 

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(phrase), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  
  const masterKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode("AETHER_SALT"), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  );

  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true, ["deriveKey", "deriveBits"]
  );
  
  const storageKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, ["encrypt", "decrypt"]
  );

  const pubRaw = await window.crypto.subtle.exportKey("raw", keyPair.publicKey);

  return {
    seedPhrase: phrase,
    masterKey,
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    storageKey,
    publicKeyRaw: buf2hex(pubRaw),
    totpSecret: generateTOTP()
  };
};

export const lockWallet = async (wallet: Wallet, password: string): Promise<EncryptedVault> => {
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );

  const encryptionKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-512" }, 
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt"]
  );

  const pubJWK = await window.crypto.subtle.exportKey("jwk", wallet.publicKey);
  const privJWK = await window.crypto.subtle.exportKey("jwk", wallet.privateKey);
  const storageJWK = await window.crypto.subtle.exportKey("jwk", wallet.storageKey);

  const payload = JSON.stringify({
    seedPhrase: wallet.seedPhrase,
    totpSecret: wallet.totpSecret,
    pubJWK,
    privJWK,
    storageJWK
  });

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, encryptionKey, enc.encode(payload)
  );

  return {
    iv: buf2hex(iv.buffer),
    data: buf2hex(ciphertext),
    salt: buf2hex(salt.buffer)
  };
};

export const unlockWallet = async (vault: EncryptedVault, password: string): Promise<Wallet> => {
  const salt = hex2buf(vault.salt);
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );

  const decryptionKey = await window.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: new Uint8Array(salt), iterations: 200000, hash: "SHA-512" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false, ["decrypt"]
  );

  try {
    const plaintext = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(hex2buf(vault.iv)) }, decryptionKey, new Uint8Array(hex2buf(vault.data))
    );
    const data = JSON.parse(dec.decode(plaintext));
    
    // Re-import keys
    const publicKey = await window.crypto.subtle.importKey(
      "jwk", data.pubJWK, { name: "ECDH", namedCurve: "P-256" }, true, []
    );
    const privateKey = await window.crypto.subtle.importKey(
      "jwk", data.privJWK, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
    );
    
    let storageKey: CryptoKey;
    if (data.storageJWK) {
      storageKey = await window.crypto.subtle.importKey(
        "jwk", data.storageJWK, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
      );
    } else {
      // Fallback for older vaults
      storageKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
      );
    }

    const phraseKeyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(data.seedPhrase), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    const masterKey = await window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("AETHER_SALT"), iterations: 100000, hash: "SHA-256" },
        phraseKeyMaterial,
        { name: "AES-GCM", length: 256 },
        true, ["encrypt", "decrypt"]
    );
    
    const pubRaw = await window.crypto.subtle.exportKey("raw", publicKey);

    return {
      seedPhrase: data.seedPhrase,
      masterKey,
      publicKey,
      privateKey,
      storageKey,
      publicKeyRaw: buf2hex(pubRaw),
      totpSecret: data.totpSecret
    };
  } catch (e) {
    console.error(e);
    throw new Error("Invalid Password");
  }
};

// --- SESSION STORAGE ENCRYPTION (TEMPORARY UNLOCK) ---

export const encryptSession = async (wallet: Wallet): Promise<string> => {
    // 1. Export keys to JWK
    const pubJWK = await window.crypto.subtle.exportKey("jwk", wallet.publicKey);
    const privJWK = await window.crypto.subtle.exportKey("jwk", wallet.privateKey);
    const storageJWK = await window.crypto.subtle.exportKey("jwk", wallet.storageKey);

    const sessionData = JSON.stringify({
        seedPhrase: wallet.seedPhrase,
        totpSecret: wallet.totpSecret,
        pubJWK,
        privJWK,
        storageJWK
    });

    // 2. Generate a random session key (stored in memory/sessionStorage only)
    const sessionKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
    const sessionKeyRaw = await window.crypto.subtle.exportKey("jwk", sessionKey);

    // 3. Encrypt the data
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, sessionKey, enc.encode(sessionData)
    );

    // 4. Return formatted string: KEY_JWK_STRING | IV_HEX | CIPHERTEXT_HEX
    return JSON.stringify({
        k: sessionKeyRaw,
        iv: buf2hex(iv.buffer),
        d: buf2hex(ciphertext)
    });
};

export const decryptSession = async (sessionStr: string): Promise<Wallet | null> => {
    try {
        const payload = JSON.parse(sessionStr);
        if(!payload.k || !payload.iv || !payload.d) return null;

        const sessionKey = await window.crypto.subtle.importKey(
            "jwk", payload.k, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
        );

        const plaintext = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(hex2buf(payload.iv)) }, sessionKey, new Uint8Array(hex2buf(payload.d))
        );
        
        const data = JSON.parse(dec.decode(plaintext));
        
        // Reconstruct Wallet
        const publicKey = await window.crypto.subtle.importKey(
            "jwk", data.pubJWK, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        const privateKey = await window.crypto.subtle.importKey(
            "jwk", data.privJWK, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
        );
        const storageKey = await window.crypto.subtle.importKey(
            "jwk", data.storageJWK, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]
        );
        
        // Derive master key again (reproducible from seed)
        const phraseKeyMaterial = await window.crypto.subtle.importKey(
            "raw", enc.encode(data.seedPhrase), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        const masterKey = await window.crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: enc.encode("AETHER_SALT"), iterations: 100000, hash: "SHA-256" },
            phraseKeyMaterial,
            { name: "AES-GCM", length: 256 },
            true, ["encrypt", "decrypt"]
        );
        
        const pubRaw = await window.crypto.subtle.exportKey("raw", publicKey);

        return {
            seedPhrase: data.seedPhrase,
            masterKey,
            publicKey,
            privateKey,
            storageKey,
            publicKeyRaw: buf2hex(pubRaw),
            totpSecret: data.totpSecret
        };
    } catch (e) {
        console.error("Session Restore Failed", e);
        return null;
    }
};

// --- STORAGE ENCRYPTION UTILS ---

export const encryptStorage = async (key: CryptoKey, data: any) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = enc.encode(JSON.stringify(data));
    const ciphertext = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv }, key, encoded
    );
    return JSON.stringify({ iv: buf2hex(iv.buffer), data: buf2hex(ciphertext) });
}

export const decryptStorage = async (key: CryptoKey, jsonStr: string) => {
    try {
        const parsed = JSON.parse(jsonStr);
        if (!parsed.iv || !parsed.data) return null; // RETURN NULL ON ERROR
        const plaintext = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: new Uint8Array(hex2buf(parsed.iv)) }, key, new Uint8Array(hex2buf(parsed.data))
        );
        return JSON.parse(dec.decode(plaintext));
    } catch (e) {
        console.error("Storage Decryption Failed", e);
        return null; // RETURN NULL ON ERROR
    }
}

// --- GROUP UTILS ---

export const generateGroupKey = async (): Promise<string> => {
    const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const exported = await window.crypto.subtle.exportKey("raw", key);
    return buf2hex(exported);
};

// --- ECDH & MESH UTILS ---

export const computeSharedSecret = async (myPrivateKey: CryptoKey, theirPublicKeyHex: string): Promise<string> => {
  const theirKeyBuffer = hex2buf(theirPublicKeyHex);
  const theirKey = await window.crypto.subtle.importKey(
    "raw", new Uint8Array(theirKeyBuffer), { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const secretBits = await window.crypto.subtle.deriveBits(
    { name: "ECDH", public: theirKey },
    myPrivateKey, 
    256
  );
  return buf2hex(secretBits);
};

export const getRendezvousTopic = async (sharedSecretHex: string, offsetSeconds = 0): Promise<string> => {
  const secretKey = await window.crypto.subtle.importKey(
    "raw", new Uint8Array(hex2buf(sharedSecretHex)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const timeBlock = Math.floor((Date.now() / 1000 + offsetSeconds) / 60);
  const data = enc.encode(timeBlock.toString());
  const signature = await window.crypto.subtle.sign("HMAC", secretKey, data);
  return buf2hex(signature).substring(0, 32); 
};

export const encryptPayload = async (sharedSecretHex: string, data: string) => {
  const key = await window.crypto.subtle.importKey(
    "raw", new Uint8Array(hex2buf(sharedSecretHex)), { name: "AES-GCM" }, false, ["encrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, key, enc.encode(data)
  );
  return JSON.stringify({ iv: buf2hex(iv.buffer), data: buf2hex(ciphertext) });
};

export const decryptPayload = async (sharedSecretHex: string, jsonStr: string) => {
  const { iv, data } = JSON.parse(jsonStr);
  const key = await window.crypto.subtle.importKey(
    "raw", new Uint8Array(hex2buf(sharedSecretHex)), { name: "AES-GCM" }, false, ["decrypt"]
  );
  const plaintext = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(hex2buf(iv)) }, key, new Uint8Array(hex2buf(data))
  );
  return dec.decode(plaintext);
};