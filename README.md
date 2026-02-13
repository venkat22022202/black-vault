# BlackVault

**Proxy gateway for AI API keys. Agents never see the real key. Kill access instantly.**

BlackVault is an open-source API key management platform with a built-in proxy gateway. Instead of giving AI agents your real OpenAI/Anthropic/Google API key, you generate proxy tokens (`bvt_...`). Agents send requests to BlackVault, which injects the real key server-side and forwards to the provider. Kill a token = instant 401 — no key rotation needed.

## Why

When you share an API key with an AI agent, you can't revoke just that agent's access without rotating the key and breaking every other agent that uses it. BlackVault fixes this with a proxy layer:

```
Agent → BlackVault (bvt_ token) → OpenAI/Anthropic/Google (real key)
         ↑                         ↑
    You control this          Agent never sees this
```

## Features

- **Encrypted Vault** — AES-256-GCM with per-user derived keys (HKDF). Zero-knowledge at rest.
- **Proxy Gateway** — Forward requests to OpenAI, Anthropic, Google AI with full SSE streaming support.
- **Instant Kill Switch** — Revoke a session, a key, or everything. Propagates in under 60 seconds via Redis cache invalidation.
- **Per-Session Cost Tracking** — Token counts and cost estimates per proxy session, per request.
- **Activity Audit Trail** — Every action logged: key created, session killed, proxy request, etc.
- **Agent Registry** — Discover and review AI agents. Community trust scores.
- **Workflow Blueprints** — Create, fork, and share agent workflow configurations.

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/venkat22022202/black-vault.git
cd black-vault
npm install
```

### 2. Set up environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | [Clerk](https://clerk.com) |
| `CLERK_SECRET_KEY` | [Clerk](https://clerk.com) |
| `DATABASE_URL` | [Neon](https://neon.tech) |
| `UPSTASH_REDIS_REST_URL` | [Upstash](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | [Upstash](https://upstash.com) |
| `VAULT_MASTER_KEY` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Your deployment URL |

### 3. Push database schema

```bash
npx drizzle-kit push
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Proxy Gateway Usage

### 1. Store an API key in the vault

Add your OpenAI/Anthropic/Google API key through the Vault UI. It's encrypted with AES-256-GCM before storage.

### 2. Generate a proxy token

Click "Proxy Token" on a vault key. Give it a label (e.g., "MacBook Pro", "CI Pipeline"). The token (`bvt_...`) is shown **once** — copy it.

### 3. Use the proxy token

Replace the provider's base URL with your BlackVault proxy endpoint:

**OpenAI:**
```bash
curl https://your-blackvault.vercel.app/api/proxy/openai/v1/chat/completions \
  -H "Authorization: Bearer bvt_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}]}'
```

**Anthropic:**
```bash
curl https://your-blackvault.vercel.app/api/proxy/anthropic/v1/messages \
  -H "Authorization: Bearer bvt_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-5-20250929", "max_tokens": 1024, "messages": [{"role": "user", "content": "hello"}]}'
```

**Google AI:**
```bash
curl https://your-blackvault.vercel.app/api/proxy/google/v1beta/models/gemini-2.0-flash:generateContent \
  -H "Authorization: Bearer bvt_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "hello"}]}]}'
```

SSE streaming works out of the box — just set `"stream": true` as usual.

### 4. Kill access

Kill a single session or all sessions from the Vault UI. The agent gets 401 immediately.

## Architecture

```
src/
├── app/
│   ├── api/proxy/[provider]/[...path]/   # Proxy gateway route
│   ├── (dashboard)/                       # Dashboard pages
│   ├── terms/ & privacy/                  # Legal pages
│   └── page.tsx                           # Landing page
├── server/
│   ├── db/schema.ts                       # Drizzle schema (Postgres)
│   ├── routers/                           # tRPC routers
│   │   ├── vault.ts                       # Key CRUD
│   │   ├── proxy.ts                       # Token generation, sessions
│   │   ├── killswitch.ts                  # Emergency revocation
│   │   └── cost.ts                        # Real-time cost queries
│   └── services/
│       ├── encryption.ts                  # AES-256-GCM encrypt/decrypt
│       ├── proxy-auth.ts                  # Token → session lookup (Redis cached)
│       ├── proxy-providers.ts             # OpenAI/Anthropic/Google configs
│       ├── proxy-pricing.ts              # Token cost estimation
│       ├── proxy-token.ts                 # Token generation + SHA-256 hashing
│       └── redis.ts                       # Upstash Redis cache
└── lib/
    ├── constants.ts                       # Provider configs, activity types
    └── utils.ts                           # Shared utilities
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 + React 19 + TypeScript |
| API | tRPC 11 |
| Database | Neon Postgres + Drizzle ORM |
| Cache | Upstash Redis |
| Auth | Clerk |
| Styling | Tailwind CSS v4 |
| Encryption | AES-256-GCM (Node.js crypto) |

## Security

- API keys are encrypted at rest with AES-256-GCM using per-user derived keys
- Proxy tokens are SHA-256 hashed before storage — plaintext never persisted
- Session lookups are Redis-cached (60s TTL) for fast revocation
- Proxy endpoint rate-limited at 200 requests/minute per user
- CORS allows `*` on proxy (tokens are the auth boundary)
- All secrets are environment variables — never in code

## Deploy

### Vercel (recommended)

1. Fork this repo
2. Import in [Vercel](https://vercel.com)
3. Add environment variables from `.env.example`
4. Deploy

### Self-hosted

```bash
npm run build
npm start
```

## License

[MIT](LICENSE)

## Contributing

Issues and PRs welcome. For major changes, open an issue first to discuss.
