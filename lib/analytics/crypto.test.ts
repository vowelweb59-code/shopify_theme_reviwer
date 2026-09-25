import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, getEncryptionKey } from "./crypto";

const key = randomBytes(32);

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a token", () => {
    const token = "1//0gAbCdEf-refresh-token_value";
    expect(decryptSecret(encryptSecret(token, key), key)).toBe(token);
  });

  it("never stores the plaintext and uses a fresh IV each time", () => {
    const a = encryptSecret("same-token", key);
    const b = encryptSecret("same-token", key);
    expect(a).not.toContain("same-token");
    expect(a).not.toBe(b);
  });

  it("rejects a tampered ciphertext", () => {
    const [v, iv, tag, ct] = encryptSecret("token", key).split(".");
    const flipped = Buffer.from(ct, "base64url");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64url")].join("."), key)).toThrow();
  });

  it("rejects a truncated auth tag instead of checking fewer bytes", () => {
    const [v, iv, tag, ct] = encryptSecret("token", key).split(".");
    const short = Buffer.from(tag, "base64url").subarray(0, 4).toString("base64url");
    expect(() => decryptSecret([v, iv, short, ct].join("."), key)).toThrow(/format/);
  });

  it("rejects the wrong key", () => {
    expect(() => decryptSecret(encryptSecret("token", key), randomBytes(32))).toThrow();
  });

  it("rejects an unknown format", () => {
    expect(() => decryptSecret("plain-text-token", key)).toThrow(/format/);
  });
});

describe("getEncryptionKey", () => {
  it("requires the env var", () => {
    expect(() => getEncryptionKey("")).toThrow(/not set/);
  });

  it("requires exactly 32 bytes", () => {
    expect(() => getEncryptionKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
    expect(getEncryptionKey(key.toString("base64")).equals(key)).toBe(true);
  });
});
