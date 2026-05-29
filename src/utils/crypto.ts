/**
 * crypto.ts
 * Web Crypto API implementation for E2EE (End-to-End Encryption)
 */

const RSA_ALGO: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

const RSA_IMPORT_ALGO: RsaHashedImportParams = {
  name: 'RSA-OAEP',
  hash: 'SHA-256',
};

const AES_ALGO: AesKeyGenParams = {
  name: 'AES-GCM',
  length: 256,
};

// ---------------------------------------------------------
// IndexedDB Helper for Storing Private Keys securely
// ---------------------------------------------------------
const DB_NAME = 'ChatX_KeyStore';
const STORE_NAME = 'keys';

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const storePrivateKey = async (hikeId: string, privateKey: CryptoKey): Promise<void> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(privateKey, hikeId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getPrivateKey = async (hikeId: string): Promise<CryptoKey | null> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(hikeId);
    request.onsuccess = () => resolve((request.result as CryptoKey) || null);
    request.onerror = () => reject(request.error);
  });
};

// ---------------------------------------------------------
// Key Generation & Conversion
// ---------------------------------------------------------

/**
 * Generates an RSA key pair.
 * The public key is exported to base64 to send to the server.
 * The private key stays in the browser (stored in IndexedDB).
 */
export const generateE2EEKeys = async (): Promise<{ publicKeyBase64: string; privateKey: CryptoKey }> => {
  const keyPair = await window.crypto.subtle.generateKey(RSA_ALGO, true, ['encrypt', 'decrypt']);

  // Export public key to base64 (SPKI format)
  const exportedPubKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = arrayBufferToBase64(exportedPubKey);

  return {
    publicKeyBase64,
    privateKey: keyPair.privateKey,
  };
};

export const importPublicKey = async (base64Key: string): Promise<CryptoKey> => {
  const binaryDer = base64ToArrayBuffer(base64Key);
  return await window.crypto.subtle.importKey('spki', binaryDer, RSA_IMPORT_ALGO, true, ['encrypt']);
};

// ---------------------------------------------------------
// Encryption / Decryption routines
// ---------------------------------------------------------

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encryptedAesKeySender: string;
  encryptedAesKeyReceiver: string;
}

/**
 * Encrypts a plaintext message for a receiver using a hybrid RSA+AES scheme.
 */
export const encryptMessage = async (
  text: string,
  receiverPublicKeyBase64: string,
  senderPublicKeyBase64: string
): Promise<EncryptedPayload> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // 1. Generate an ephemeral AES-GCM key for this specific message
  const aesKey = await window.crypto.subtle.generateKey(AES_ALGO, true, ['encrypt', 'decrypt']);

  // 2. Encrypt the message with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    data
  );

  // 3. Export the AES key so we can wrap (encrypt) it with RSA
  const exportedAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // 4. Import both RSA public keys
  const receiverPubKey = await importPublicKey(receiverPublicKeyBase64);
  const senderPubKey = await importPublicKey(senderPublicKeyBase64);

  // 5. Wrap (encrypt) the AES key with both RSA public keys
  // — receiver can decrypt with their private key
  // — sender can also re-read their own message (for history sync)
  const encryptedAesKeyReceiverBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    receiverPubKey,
    exportedAesKey
  );

  const encryptedAesKeySenderBuffer = await window.crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    senderPubKey,
    exportedAesKey
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedContentBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer), // Fix: pass iv.buffer (ArrayBuffer), not iv (Uint8Array)
    encryptedAesKeyReceiver: arrayBufferToBase64(encryptedAesKeyReceiverBuffer),
    encryptedAesKeySender: arrayBufferToBase64(encryptedAesKeySenderBuffer),
  };
};

/**
 * Decrypts a received message using the user's private RSA key.
 */
export const decryptMessage = async (
  encryptedAesKeyBase64: string,
  ciphertextBase64: string,
  ivBase64: string,
  privateKey: CryptoKey
): Promise<string> => {
  // 1. Decrypt the AES key using our RSA private key
  const encryptedAesKeyBuffer = base64ToArrayBuffer(encryptedAesKeyBase64);
  const rawAesKey = await window.crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    encryptedAesKeyBuffer
  );

  // 2. Re-import the raw AES key
  const aesKey = await window.crypto.subtle.importKey(
    'raw',
    rawAesKey,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );

  // 3. Decrypt the message
  const ivBuffer = base64ToArrayBuffer(ivBase64);
  const ciphertextBuffer = base64ToArrayBuffer(ciphertextBase64);

  const decryptedContentBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
    aesKey,
    ciphertextBuffer
  );

  return new TextDecoder().decode(decryptedContentBuffer);
};

// ---------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  // Sanitize: strip whitespace and any non-base64 characters
  const cleaned = base64.replace(/\s/g, '');
  // Validate base64 before decoding
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(cleaned)) {
    throw new Error(`Invalid base64 string: "${cleaned.substring(0, 20)}..."`);
  }
  const binaryString = atob(cleaned);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}
