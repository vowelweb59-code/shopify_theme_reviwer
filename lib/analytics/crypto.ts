import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for GA4 OAuth tokens at rest. GCM authenticates as well as
// encrypts, so a tampered or wrong-key ciphertext fails loudly instead of
// decrypting to garbage. Stored format: "v1.<iv>.<authTag>.<ciphertext>",
// each part base64url; the version prefix leaves room for key rotation.
const VERSION = "v1";
const IV_BYTES = 12; // GCM's standard nonce size
const TAG_BYTES = 16; // GCM's full-length tag; a shorter one is rejected, not accepted as a weaker check

export function getEncryptionKey(raw = process.env.ANALYTICS_TOKEN_ENCRYPTION_KEY): Buffer {
  if (!raw) throw new Error("ANALYTICS_TOKEN_ENCRYPTION_KEY is not set — see .env.example for GA4 analytics setup.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ANALYTICS_TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function encryptSecret(plaintext: string, key: Buffer = getEncryptionKey()): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [VERSION, iv, cipher.getAuthTag(), ciphertext].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptSecret(payload: string, key: Buffer = getEncryptionKey()): string {
  const [version, iv, tag, ciphertext] = payload.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) throw new Error("Unrecognized encrypted token format.");
  const authTag = Buffer.from(tag, "base64url");
  if (authTag.length !== TAG_BYTES) throw new Error("Unrecognized encrypted token format.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
}
