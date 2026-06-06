/**
 * crypto.js
 * Web Crypto API implementation for E2EE (End-to-End Encryption)
 */

const RSA_ALGO = {
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
};

const RSA_IMPORT_ALGO = {
    name: 'RSA-OAEP',
    hash: 'SHA-256',
};

const AES_ALGO = {
    name: 'AES-GCM',
    length: 256,
};

// ---------------------------------------------------------
// IndexedDB Helper for Storing Private Keys securely
// ---------------------------------------------------------
const DB_NAME = 'ChatX_KeyStore';
const STORE_NAME = 'keys';

const getDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const storePrivateKey = async (hikeId, privateKey) => {
    if (!hikeId || typeof hikeId !== 'string') return;
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(privateKey, hikeId);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const getPrivateKey = async (hikeId) => {
    if (!hikeId || typeof hikeId !== 'string') return null;
    const db = await getDB();
    const cleanId = hikeId.startsWith('@') ? hikeId.slice(1) : hikeId;
    const withAt = `@${cleanId}`;

    const tryGet = (id) => {
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => resolve(null);
        });
    };

    let key = await tryGet(cleanId);
    if (!key) {
        key = await tryGet(cleanId.toLowerCase());
    }
    if (!key) {
        key = await tryGet(withAt);
    }
    if (!key) {
        key = await tryGet(withAt.toLowerCase());
    }
    if (!key) {
        key = await tryGet(hikeId);
    }
    if (!key) {
        key = await tryGet(hikeId.toLowerCase());
    }
    return key;
};

// ---------------------------------------------------------
// Key Generation & Conversion
// ---------------------------------------------------------

/**
 * Generates an RSA key pair.
 * The public key is exported to base64 to send to the server.
 * The private key stays in the browser (stored in IndexedDB).
 */
export const generateE2EEKeys = async () => {
    const keyPair = await window.crypto.subtle.generateKey(RSA_ALGO, true, ['encrypt', 'decrypt']);

    // Export public key to base64 (SPKI format)
    const exportedPubKey = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = arrayBufferToBase64(exportedPubKey);

    return {
        publicKeyBase64,
        privateKey: keyPair.privateKey,
    };
};

export const importPublicKey = async (base64Key) => {
    const binaryDer = base64ToArrayBuffer(base64Key);
    return await window.crypto.subtle.importKey('spki', binaryDer, RSA_IMPORT_ALGO, true, ['encrypt']);
};

export const verifyKeyPair = async (publicKeyBase64, privateKey) => {
    try {
        if (!publicKeyBase64 || !privateKey) return false;
        const pubKey = await importPublicKey(publicKeyBase64);
        const encoder = new TextEncoder();
        const data = encoder.encode("key-verification-probe");

        const encrypted = await window.crypto.subtle.encrypt(
            { name: "RSA-OAEP" },
            pubKey,
            data
        );

        const decrypted = await window.crypto.subtle.decrypt(
            { name: "RSA-OAEP" },
            privateKey,
            encrypted
        );

        const decoded = new TextDecoder().decode(decrypted);
        return decoded === "key-verification-probe";
    } catch {
        console.warn("Key pair mismatch verification failed");
        return false;
    }
};

// ---------------------------------------------------------
// Encryption / Decryption routines
// ---------------------------------------------------------

/**
 * Encrypts a plaintext message for a receiver using a hybrid RSA+AES scheme.
 */
export const encryptMessage = async (
    text,
    receiverPublicKeyBase64,
    senderPublicKeyBase64
) => {
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
        iv: arrayBufferToBase64(iv.buffer), // Fix: pass iv.buffer (ArrayBuffer)
        encryptedAesKeyReceiver: arrayBufferToBase64(encryptedAesKeyReceiverBuffer),
        encryptedAesKeySender: arrayBufferToBase64(encryptedAesKeySenderBuffer),
    };
};

/**
 * Decrypts a received message using the user's private RSA key.
 */
export const decryptMessage = async (
    encryptedAesKeyBase64,
    ciphertextBase64,
    ivBase64,
    privateKey
) => {
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

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToArrayBuffer(base64) {
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
    return bytes.buffer;
}

/**
 * Encrypts the Private Key using the user's password so it can be backed up on the server.
 */
export const encryptPrivateKeyWithPassword = async (
    privateKey,
    password
) => {
    // 1. Export the private key to PKCS#8 format (der array buffer)
    const exported = await window.crypto.subtle.exportKey('pkcs8', privateKey);

    // 2. Generate a key from password using SHA-256
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordBytes);
    const aesKey = await window.crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    // 3. Encrypt the exported private key buffer
    const iv = new Uint8Array(12);
    window.crypto.getRandomValues(iv);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        exported
    );

    // 4. Return unified base64 payload: IV + Ciphertext
    const ivBase64 = arrayBufferToBase64(iv.buffer);
    const ciphertextBase64 = arrayBufferToBase64(encrypted);
    return `${ivBase64}:${ciphertextBase64}`;
};

/**
 * Decrypts the backed-up Private Key using the user's password.
 */
export const decryptPrivateKeyWithPassword = async (
    encryptedPayload,
    password
) => {
    const [ivBase64, ciphertextBase64] = encryptedPayload.split(':');
    const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
    const ciphertext = base64ToArrayBuffer(ciphertextBase64);

    // 1. Generate key from password using SHA-256
    const encoder = new TextEncoder();
    const passwordBytes = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', passwordBytes);
    const aesKey = await window.crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
    );

    // 2. Decrypt the PKCS#8 buffer
    const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        ciphertext
    );

    // 3. Re-import the Private Key
    return await window.crypto.subtle.importKey(
        'pkcs8',
        decrypted,
        {
            name: 'RSA-OAEP',
            hash: 'SHA-256',
        },
        true,
        ['decrypt']
    );
};

/**
 * Encrypts a message for a group using a single AES key and wraps it for all members.
 */
export const encryptGroupMessage = async (
    text,
    membersPublicKeys,
    senderPublicKeyBase64
) => {
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

    // 4. Import sender public key and encrypt for sender
    const senderPubKey = await importPublicKey(senderPublicKeyBase64);
    const encryptedAesKeySenderBuffer = await window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        senderPubKey,
        exportedAesKey
    );

    // 5. Encrypt for all other group members
    const groupAesKeys = [];
    for (const member of membersPublicKeys) {
        try {
            if (!member.publicKey) continue;
            const memberPubKey = await importPublicKey(member.publicKey);
            const encryptedBuf = await window.crypto.subtle.encrypt(
                { name: 'RSA-OAEP' },
                memberPubKey,
                exportedAesKey
            );
            groupAesKeys.push({
                userId: member.userId,
                encryptedAesKey: arrayBufferToBase64(encryptedBuf),
            });
        } catch (err) {
            console.error(`Failed to encrypt key for group member ${member.userId}:`, err);
        }
    }

    return {
        ciphertext: arrayBufferToBase64(encryptedContentBuffer),
        iv: arrayBufferToBase64(iv.buffer),
        encryptedAesKeySender: arrayBufferToBase64(encryptedAesKeySenderBuffer),
        groupAesKeys,
    };
};
