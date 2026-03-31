<p align="center">
  <img src="https://img.shields.io/github/stars/venkat22022202/black-vault?style=social" alt="GitHub stars" />
  <img src="https://img.shields.io/github/forks/venkat22022202/black-vault?style=social" alt="GitHub forks" />
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
  <img src="https://img.shields.io/github/issues/venkat22022202/black-vault" alt="GitHub issues" />
  <img src="https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Next.js_16-000000?logo=next.js&logoColor=white" alt="Next.js" />
</p>

<h1 align="center">BlackVault</h1>

<p align="center">
  <strong>The open-source API key firewall for AI agents.</strong><br/>
  Agents never see the real key. Kill access instantly. Per-token rate limits, budgets, and model restrictions.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#-universal-ai-gateway">Universal Gateway</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#proxy-gateway-usage">Proxy Usage</a> &bull;
  <a href="#access-controls">Access Controls</a> &bull;
  <a href="#deploy">Deploy</a> &bull;
  <a href="https://github.com/venkat22022202/black-vault/issues">Issues</a> &bull;
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## The Problem

When you share an API key with an AI agent (OpenClaw, Moltbook bots, LangChain, CrewAI, or any agent framework), you can't revoke **just that agent's** access without rotating the key and breaking **every other agent** that uses it.

BlackVault fixes this with a proxy layer:

```
Agent → BlackVault (bvt_ token) → OpenAI / Anthropic / Google / Nebius (real key)
         ↑                         ↑
    You control this          Agent never sees this
```

**One key, many proxy tokens. Kill a token = instant 401. No rotation needed.**

## Universal AI Gateway

**One endpoint. One token. Every AI provider.** BlackVault includes an OpenAI-compatible gateway at `/api/v1/chat/completions` that auto-routes to the correct provider based on the model name and translates request/response formats automatically.

```bash
# Use Claude through BlackVault (auto-translates OpenAI format → Anthropic)
curl https://your-blackvault.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer bvt_your_token" \
  -H "Content-Type: application/json" \
  -d '{"model": "claude-sonnet-4-5-20250929", "messages": [{"role": "user", "content": "hello"}], "max_tokens": 1024}'

# Use GPT through the same endpoint and token
curl https://your-blackvault.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer bvt_your_token" \
  -H "Content-Type: application/json" \
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "hello"}]}'

# Use Gemini through the same endpoint and token
curl https://your-blackvault.vercel.app/api/v1/chat/completions \
  -H "Authorization: Bearer bvt_your_token" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemini-2.0-flash", "messages": [{"role": "user", "content": "hello"}]}'
```

### Works with ANY OpenAI-compatible tool

**OpenClaw:**
```bash
OPENAI_BASE_URL=https://your-blackvault.vercel.app/api/v1
OPENAI_API_KEY=bvt_your_token
```

**LangChain (Python):**
```python
from langchain_openai import ChatOpenAI
llm = ChatOpenAI(
    base_url="https://your-blackvault.vercel.app/api/v1",
    api_key="bvt_your_token",
    model="claude-sonnet-4-5-20250929"  # or gpt-4o, gemini-2.0-flash, etc.
)
```

**OpenAI SDK (Python):**
```python
import openai
client = openai.OpenAI(
    base_url="https://your-blackvault.vercel.app/api/v1",
    api_key="bvt_your_token"
)
response = client.chat.completions.create(
    model="claude-sonnet-4-5-20250929",  # any model, any provider
    messages=[{"role": "user", "content": "hello"}]
)
```

**OpenAI SDK (Node.js):**
```typescript
import OpenAI from "openai";
const client = new OpenAI({
  baseURL: "https://your-blackvault.vercel.app/api/v1",
  apiKey: "bvt_your_token",
});
const response = await client.chat.completions.create({
  model: "gemini-2.0-flash", // routes to Google automatically
  messages: [{ role: "user", content: "hello" }],
});
```

**Cursor / Continue / Cline:**
Set the base URL to `https://your-blackvault.vercel.app/api/v1` and API key to `bvt_your_token` in your IDE settings.

### How it works

| Model prefix | Routes to | Format translation |
|---|---|---|
| `gpt-*`, `o1*`, `o3*` | OpenAI | None (native) |
| `claude-*` | Anthropic | OpenAI ↔ Anthropic Messages API |
| `gemini-*` | Google AI | OpenAI ↔ Gemini API |
| `deepseek-ai/*`, `meta-llama/*` | Nebius | None (OpenAI-compatible) |

The gateway looks up the user's vault key for the target provider automatically. One `bvt_` token can access ALL providers the user has keys for.

## Features

### Core

- **Universal AI Gateway** — One OpenAI-compatible endpoint for ALL providers. Auto-routes by model name, translates formats. Works with OpenClaw, LangChain, CrewAI, Cursor, and any OpenAI-compatible tool.
- **Encrypted Vault** — AES-256-GCM with per-user derived keys. Zero-knowledge at rest.
- **Proxy Gateway** — Forward requests to OpenAI, Anthropic, Google AI, Nebius AI with full SSE streaming.
- **Instant Kill Switch** — Revoke a session, a key, or everything. Propagates in <60s via Redis cache invalidation.

### Per-Session Access Controls

- **Rate Limiting (RPM/RPD)** — Configurable requests-per-minute and requests-per-day per proxy token. Redis sliding window.
- **Budget Caps** — Set a max $ spend per token. Agent gets `402` when exhausted. Visual progress bars in UI.
- **Model Restrictions** — Lock a token to specific models (e.g., only `gpt-4o-mini`, not `gpt-4o`). Agent gets `403` on violation.
- **IP Allowlisting** — Restrict which IPs can use a proxy token. Enforced at auth time.
- **Rate Limit Headers** — Every proxy response includes `X-RateLimit-*` and `X-BlackVault-*` headers.

### Platform

- **Per-Session Cost Tracking** — Token counts and cost estimates per session, per request.
- **Activity Audit Trail** — Every action logged: key created, session killed, proxy request, budget exceeded.
- **Agent Registry** — Discover and review AI agents. Community trust scores.
- **Workflow Blueprints** — Create, fork, and share agent workflow configurations.

## Use Cases

| Scenario | How BlackVault helps |
|----------|---------------------|
| **OpenClaw / AI assistant** | Set `OPENAI_BASE_URL` to BlackVault. One token accesses all providers. $5 budget cap so it can't burn $500 overnight. |
| **Moltbook agents** | Each bot gets its own proxy token with RPM limits. Kill a rogue agent instantly without affecting others. |
| **LangChain / CrewAI / AutoGen** | One API key in the vault, separate proxy tokens per agent with model restrictions (only gpt-4o-mini for the cheap agent, gpt-4o for the important one). |
| **Team API key sharing** | Share proxy tokens instead of the real key. Audit who used what. Revoke individuals without rotating. |
| **CI/CD pipelines** | Short-lived proxy tokens (1h expiry) for CI jobs. Auto-expire, no cleanup needed. |

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

Click **Proxy Token** on a vault key. Configure optional access controls (rate limits, budget, model restrictions, IP allowlist). The token (`bvt_...`) is shown **once** -- copy it.

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

SSE streaming works out of the box -- just set `"stream": true` as usual.

### 4. Kill access

Kill a single session or all sessions from the Vault UI. The agent gets 401 immediately.

## Access Controls

When generating a proxy token, expand **Access Controls & Rate Limits** to configure per-token restrictions:

| Control | What it does | Error code | Example |
|---------|-------------|------------|---------|
| **RPM** | Max requests per minute | `429` | 30 RPM for a chatbot |
| **RPD** | Max requests per day | `429` | 500 RPD for a batch agent |
| **Budget Cap** | Max $ spend for this token | `402` | $5.00 for a demo agent |
| **Model Restriction** | Whitelist specific models | `403` | Only `gpt-4o-mini` |
| **IP Allowlist** | Restrict to specific IPs | `403` | Only your server IP |

Every proxy response includes headers for agent-side observability:

```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 194
X-BlackVault-Session: <session-id>
X-BlackVault-Cost: 0.003200
X-BlackVault-Budget-Limit: 5.0000
X-BlackVault-Budget-Remaining: 4.9968
X-Session-RateLimit-RPM-Limit: 30
X-Session-RateLimit-RPM-Remaining: 28
X-BlackVault-Allowed-Models: gpt-4o-mini,gpt-3.5-turbo
```

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── v1/chat/completions/          # Universal AI Gateway (OpenAI-compatible)
│   │   ├── v1/models/                     # Available models endpoint
│   │   └── proxy/[provider]/[...path]/   # Direct proxy gateway
│   ├── (dashboard)/                       # Dashboard pages
│   └── page.tsx                           # Landing page
├── server/
│   ├── db/schema.ts                       # Drizzle schema (Postgres)
│   ├── routers/                           # tRPC routers
│   │   ├── vault.ts                       # Key CRUD + encryption
│   │   ├── proxy.ts                       # Token generation, sessions, rate limits
│   │   ├── killswitch.ts                  # Emergency revocation
│   │   └── cost.ts                        # Real-time cost queries
│   └── services/
│       ├── encryption.ts                  # AES-256-GCM encrypt/decrypt
│       ├── proxy-auth.ts                  # Token auth + IP/budget enforcement
│       ├── model-router.ts               # Model → provider auto-routing
│       ├── format-translator.ts           # OpenAI ↔ Anthropic/Google translation
│       ├── proxy-providers.ts             # Provider configs
│       ├── proxy-pricing.ts              # Token cost estimation
│       ├── ratelimit.ts                   # Global + per-session rate limiting
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
| Cache & Rate Limiting | Upstash Redis |
| Auth | Clerk |
| Styling | Tailwind CSS v4 + Framer Motion |
| Encryption | AES-256-GCM (Node.js crypto) |
| Charts | Recharts |

## Security

- API keys encrypted at rest with AES-256-GCM using per-user derived keys (HMAC-SHA256)
- Proxy tokens SHA-256 hashed before storage -- plaintext never persisted
- Session lookups Redis-cached (60s TTL) for fast revocation
- **Three-tier rate limiting:** global (200 RPM/user) + per-session RPM + per-session RPD via Redis sliding window
- **Budget enforcement:** session-level spend caps block at 402 when exhausted
- **Model restrictions:** per-session model allowlists prevent unauthorized model usage
- **IP allowlisting:** per-session IP restrictions enforced at auth time
- CORS allows `*` on proxy (tokens are the auth boundary, not origin)
- All secrets are environment variables -- never in code

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

## Roadmap

- [x] **Universal AI Gateway** -- OpenAI-compatible endpoint, auto-routes to any provider
- [x] **Per-Session Rate Limiting** -- Configurable RPM/RPD per proxy token
- [x] **Budget Caps & Model Restrictions** -- Per-token spend limits and model whitelists
- [ ] **MCP Server** -- Model Context Protocol server for AI coding agents (Claude Code, Cursor, etc.)
- [ ] **OpenClaw Skill** -- Official skill for the OpenClaw AI assistant
- [ ] **Groq, Mistral, Together AI** -- More provider support
- [ ] **Webhook alerts** -- Notify when budget thresholds hit or rate limits trigger
- [ ] **Token scoping** -- Per-token endpoint restrictions
- [ ] **Usage analytics dashboard** -- Graphs of cost, latency, and token usage over time
- [ ] **Team workspaces** -- Shared vaults with role-based access

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Good first issues:** Check the [`good first issue`](https://github.com/venkat22022202/black-vault/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) label.

## Contributors

<a href="https://github.com/venkat22022202/black-vault/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=venkat22022202/black-vault" />
</a>

## Star History

If BlackVault is useful to you, consider giving it a star. It helps others discover the project.

[![Star History Chart](https://api.star-history.com/svg?repos=venkat22022202/black-vault&type=Date)](https://star-history.com/#venkat22022202/black-vault&Date)

## License

[MIT](LICENSE)
