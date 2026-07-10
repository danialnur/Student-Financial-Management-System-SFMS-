// Field-level encryption for crucial PII (IC number, phone, matric number)
// stored on `users` docs. Uses AES-256-GCM via the browser's Web Crypto API.
//
// Threat model / known limitation: this app has no backend server, so the
// symmetric key ships inside the built frontend bundle (VITE_FIELD_ENCRYPTION_KEY).
// This protects the data at rest in the Firestore console / a raw DB export —
// anyone who reads the JS bundle can still recover the key. A server-held key
// (e.g. a Cloud Function) would close that gap but requires a paid Firebase
// plan and a backend layer this project doesn't have.
//
// Wire format: "enc:v1:<base64 iv>.<base64 ciphertext+authTag>" — the IV is
// random per encryption (required for GCM), so the same plaintext never
// produces the same ciphertext twice. This means encrypted fields cannot be
// used in Firestore equality queries (none of icNumber/phone/matricNumber are).

const PREFIX = "enc:v1:";

let cachedKeyPromise = null;

function base64ToBytes(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function getKey() {
  if (!cachedKeyPromise) {
    const keyB64 = import.meta.env.VITE_FIELD_ENCRYPTION_KEY;
    if (!keyB64) throw new Error("VITE_FIELD_ENCRYPTION_KEY is not set — cannot encrypt/decrypt crucial fields.");
    cachedKeyPromise = crypto.subtle.importKey("raw", base64ToBytes(keyB64), "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  return cachedKeyPromise;
}

// Encrypts a plain string value. Empty/nullish values pass through unchanged
// (nothing sensitive to protect, and it keeps required-field validation simple).
export async function encryptField(plaintext) {
  if (plaintext == null || plaintext === "") return plaintext ?? "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherBuf = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(String(plaintext)));
  return `${PREFIX}${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(cipherBuf))}`;
}

// Decrypts a value previously produced by encryptField. Values that aren't in
// our encrypted format (plaintext, empty, or malformed) are returned as-is —
// this keeps the function safe to call on any not-yet-migrated legacy record.
export async function decryptField(value) {
  if (!value || typeof value !== "string" || !value.startsWith(PREFIX)) return value ?? "";
  try {
    const [ivB64, payloadB64] = value.slice(PREFIX.length).split(".");
    const key = await getKey();
    const plainBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(ivB64) },
      key,
      base64ToBytes(payloadB64)
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return value; // corrupted/foreign value — fail safe rather than throw
  }
}
