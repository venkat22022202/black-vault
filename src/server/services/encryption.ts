import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey(userId: string, keyId: string): Buffer {
  const masterKey = process.env.VAULT_MASTER_KEY;
  if (!masterKey) {
    throw new Error("VAULT_MASTER_KEY is not set");
  }
  return Buffer.from(
    createHmac("sha256", masterKey)
      .update(`${userId}:${keyId}`)
      .digest("hex")
      .slice(0, 64),
    "hex"
  );
}

export function encryptApiKey(
  apiKey: string,
  userId: string,
  keyId: string
): { encrypted: Buffer; iv: Buffer } {
  const derivedKey = deriveKey(userId, keyId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return { encrypted, iv };
}

export function decryptApiKey(
  encrypted: Buffer,
  iv: Buffer,
  userId: string,
  keyId: string
): string {
  const derivedKey = deriveKey(userId, keyId);
  const authTag = encrypted.subarray(encrypted.length - AUTH_TAG_LENGTH);
  const encryptedData = encrypted.subarray(0, encrypted.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  return decipher.update(encryptedData, undefined, "utf8") + decipher.final("utf8");
}
