import { describe, it, expect, beforeAll } from "vitest";
import { encryptApiKey, decryptApiKey } from "../encryption";

beforeAll(() => {
  process.env.VAULT_MASTER_KEY =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
});

const USER = "user-1";
const KEY_ID = "key-1";
const PLAINTEXT = "sk-proj-super-secret-api-key-value";

describe("encryption", () => {
  it("round-trips an API key", () => {
    const { encrypted, iv } = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    const out = decryptApiKey(encrypted, iv, USER, KEY_ID);
    expect(out).toBe(PLAINTEXT);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    const b = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    expect(a.encrypted.equals(b.encrypted)).toBe(false);
    expect(a.iv.equals(b.iv)).toBe(false);
  });

  it("fails to decrypt with a different user (per-user derived key)", () => {
    const { encrypted, iv } = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    expect(() => decryptApiKey(encrypted, iv, "other-user", KEY_ID)).toThrow();
  });

  it("fails to decrypt with a different key id", () => {
    const { encrypted, iv } = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    expect(() => decryptApiKey(encrypted, iv, USER, "other-key")).toThrow();
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const { encrypted, iv } = encryptApiKey(PLAINTEXT, USER, KEY_ID);
    const tampered = Buffer.from(encrypted);
    tampered[0] ^= 0xff; // flip a bit
    expect(() => decryptApiKey(tampered, iv, USER, KEY_ID)).toThrow();
  });

  it("throws when the master key is missing", () => {
    const saved = process.env.VAULT_MASTER_KEY;
    delete process.env.VAULT_MASTER_KEY;
    try {
      expect(() => encryptApiKey(PLAINTEXT, USER, KEY_ID)).toThrow();
    } finally {
      process.env.VAULT_MASTER_KEY = saved;
    }
  });
});
