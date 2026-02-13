import { db } from "@/server/db";
import { proxySessions, vaultKeys } from "@/server/db/schema";
import { eq, and } from "drizzle-orm";
import { hashProxyToken } from "./proxy-token";
import { cached, invalidateCache } from "./redis";

const SESSION_CACHE_TTL = 60; // seconds

/** Convert bytea value (Buffer or Neon hex string) to hex string */
function toHex(value: Buffer | string): string {
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (typeof value === "string") {
    // Neon returns bytea as hex string like \x1a2b3c...
    return value.startsWith("\\x") ? value.slice(2) : value;
  }
  return Buffer.from(value as ArrayBuffer).toString("hex");
}

interface ProxySession {
  id: string;
  userId: string;
  vaultKeyId: string;
  tokenHash: string;
  isActive: boolean;
  expiresAt: Date | null;
}

export interface VaultKey {
  id: string;
  userId: string;
  provider: string;
  encryptedKey: Buffer;
  iv: Buffer;
  isActive: boolean;
}

// Cached version stores hex strings instead of Buffers
// (Buffers lose their type through JSON serialization in Redis)
interface CachedVaultKey {
  id: string;
  userId: string;
  provider: string;
  encryptedKeyHex: string;
  ivHex: string;
  isActive: boolean;
}

interface CachedSessionData {
  session: ProxySession;
  vaultKey: CachedVaultKey;
}

export interface AuthResult {
  session: ProxySession;
  vaultKey: VaultKey;
  userId: string;
}

export async function authenticateProxyRequest(
  request: Request
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer bvt_")) {
    throw new ProxyAuthError(401, "Missing or invalid proxy token");
  }

  const token = authHeader.slice(7); // "Bearer ".length
  const tokenHash = hashProxyToken(token);

  // Look up session (cached for 60s)
  // Buffers are stored as hex strings in cache to survive JSON round-trip
  const cachedData = await cached<CachedSessionData | null>(
    `proxy:session:${tokenHash}`,
    SESSION_CACHE_TTL,
    async () => {
      const rows = await db
        .select({
          sessionId: proxySessions.id,
          sessionUserId: proxySessions.userId,
          sessionVaultKeyId: proxySessions.vaultKeyId,
          sessionTokenHash: proxySessions.tokenHash,
          sessionIsActive: proxySessions.isActive,
          sessionExpiresAt: proxySessions.expiresAt,
          keyId: vaultKeys.id,
          keyUserId: vaultKeys.userId,
          keyProvider: vaultKeys.provider,
          keyEncrypted: vaultKeys.encryptedKey,
          keyIv: vaultKeys.iv,
          keyIsActive: vaultKeys.isActive,
        })
        .from(proxySessions)
        .innerJoin(vaultKeys, eq(proxySessions.vaultKeyId, vaultKeys.id))
        .where(eq(proxySessions.tokenHash, tokenHash))
        .limit(1);

      if (!rows[0]) return null;

      const r = rows[0];
      return {
        session: {
          id: r.sessionId,
          userId: r.sessionUserId,
          vaultKeyId: r.sessionVaultKeyId,
          tokenHash: r.sessionTokenHash,
          isActive: r.sessionIsActive,
          expiresAt: r.sessionExpiresAt,
        },
        vaultKey: {
          id: r.keyId,
          userId: r.keyUserId,
          provider: r.keyProvider,
          encryptedKeyHex: toHex(r.keyEncrypted),
          ivHex: toHex(r.keyIv),
          isActive: r.keyIsActive,
        },
      };
    }
  );

  if (!cachedData) {
    throw new ProxyAuthError(401, "Invalid proxy token");
  }

  const { session } = cachedData;
  // Re-hydrate Buffers from hex strings (safe across JSON/Redis round-trips)
  const vaultKey: VaultKey = {
    id: cachedData.vaultKey.id,
    userId: cachedData.vaultKey.userId,
    provider: cachedData.vaultKey.provider,
    encryptedKey: Buffer.from(cachedData.vaultKey.encryptedKeyHex, "hex"),
    iv: Buffer.from(cachedData.vaultKey.ivHex, "hex"),
    isActive: cachedData.vaultKey.isActive,
  };

  if (!session.isActive) {
    throw new ProxyAuthError(403, "Proxy session has been revoked");
  }

  if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
    throw new ProxyAuthError(403, "Proxy token has expired");
  }

  if (!vaultKey.isActive) {
    throw new ProxyAuthError(403, "Underlying API key has been disabled");
  }

  // Fire-and-forget: update lastUsedAt + deviceInfo
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null;
  const ua = request.headers.get("user-agent") ?? null;

  db.update(proxySessions)
    .set({
      lastUsedAt: new Date(),
      deviceInfo: { ip, userAgent: ua },
      updatedAt: new Date(),
    })
    .where(eq(proxySessions.id, session.id))
    .then(() => {})
    .catch(() => {});

  return { session, vaultKey, userId: session.userId };
}

export async function invalidateProxySession(tokenHash: string) {
  await invalidateCache(`proxy:session:${tokenHash}`);
}

export async function invalidateProxySessionsForKey(keyId: string) {
  const sessions = await db
    .select({ tokenHash: proxySessions.tokenHash })
    .from(proxySessions)
    .where(
      and(
        eq(proxySessions.vaultKeyId, keyId),
        eq(proxySessions.isActive, true)
      )
    );

  await Promise.all(
    sessions.map((s) => invalidateCache(`proxy:session:${s.tokenHash}`))
  );
}

export class ProxyAuthError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ProxyAuthError";
  }
}
