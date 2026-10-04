#!/usr/bin/env node
/**
 * Seed a demo user, one vaulted (fake) OpenAI key and a set of agent tokens
 * with different guardrails. Uses the app's real encryption + token hashing
 * modules, so the gateway decrypts exactly what this writes.
 *
 * Prints {label: bvt_token} JSON on stdout. Requires DATABASE_URL,
 * VAULT_MASTER_KEY and MOCK_REAL_KEY.
 */
import pg from "pg";
import { randomUUID } from "node:crypto";
import { encryptApiKey } from "../../src/server/services/encryption.ts";
import { generateProxyToken } from "../../src/server/services/proxy-token.ts";

const { DATABASE_URL, MOCK_REAL_KEY } = process.env;
if (!DATABASE_URL || !MOCK_REAL_KEY || !process.env.VAULT_MASTER_KEY) {
  console.error("DATABASE_URL, VAULT_MASTER_KEY and MOCK_REAL_KEY are required");
  process.exit(1);
}

const db = new pg.Client({ connectionString: DATABASE_URL });
await db.connect();

const userId = randomUUID();
await db.query(
  `insert into users (id, clerk_id, username, display_name) values ($1, $2, $3, 'Demo')`,
  [userId, `demo_${userId}`, `demo-${userId.slice(0, 8)}`]
);

const keyId = randomUUID();
const { encrypted, iv } = encryptApiKey(MOCK_REAL_KEY, userId, keyId);
await db.query(
  `insert into vault_keys (id, user_id, provider, label, encrypted_key, iv, key_prefix)
   values ($1, $2, 'openai', 'Demo OpenAI key', $3, $4, $5)`,
  [keyId, userId, encrypted, iv, MOCK_REAL_KEY.slice(0, 7) + "..."]
);

const agents = {
  main: {},
  restricted: { allowed_models: ["gpt-4o-mini"] },
  rpm: { rate_limit_rpm: 5 },
  budget: { max_budget: "0.0002" },
  burst: { max_budget: "0.0002" },
  stream: {},
  kill: {},
};

const tokens = {};
for (const [label, limits] of Object.entries(agents)) {
  const { token, hash, prefix } = generateProxyToken();
  await db.query(
    `insert into proxy_sessions (user_id, vault_key_id, token_hash, token_prefix, label,
       rate_limit_rpm, max_budget, allowed_models)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [userId, keyId, hash, prefix, `agent-${label}`, limits.rate_limit_rpm ?? null, limits.max_budget ?? null, limits.allowed_models ?? null]
  );
  tokens[label] = token;
}

await db.end();
console.log(JSON.stringify({ userId, tokens }));
