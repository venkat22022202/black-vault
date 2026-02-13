import { randomBytes, createHash } from "crypto";

const TOKEN_PREFIX = "bvt_";

export function generateProxyToken(): {
  token: string;
  hash: string;
  prefix: string;
} {
  const raw = randomBytes(32).toString("hex");
  const token = `${TOKEN_PREFIX}${raw}`;
  const hash = hashProxyToken(token);
  const prefix = `${TOKEN_PREFIX}${raw.slice(0, 8)}...`;
  return { token, hash, prefix };
}

export function hashProxyToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
