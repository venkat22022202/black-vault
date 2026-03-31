# Contributing to BlackVault

Thanks for your interest in contributing! BlackVault is open source and we welcome contributions of all kinds -- from fixing typos to adding new provider support to building entire integrations.

## Quick Start

```bash
git clone https://github.com/venkat22022202/black-vault.git
cd black-vault
npm install
cp .env.example .env.local
# Fill in your env vars (see README for details)
npx drizzle-kit push
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and you're ready to go.

## Ways to Contribute

### Good First Issues

Check out issues labeled [`good first issue`](https://github.com/venkat22022202/black-vault/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) -- these are scoped, well-documented tasks perfect for your first contribution:

- **Add new proxy providers** -- Groq, Mistral, Together AI (OpenAI-compatible, ~30 lines each)
- **Add CSV export** for activity logs
- **UI improvements** -- dark/light theme, responsive fixes

### Larger Contributions

Check [`help wanted`](https://github.com/venkat22022202/black-vault/issues?q=is%3Aissue+is%3Aopen+label%3A%22help+wanted%22) for bigger features:

- **MCP Server** -- Model Context Protocol server for AI coding agents
- **OpenClaw Skill** -- Integration with the OpenClaw AI assistant
- **Webhook notifications** -- Alerts for budget/rate limit events
- **Usage analytics dashboard** -- Time-series charts for cost and usage

### Bug Reports

Found a bug? [Open an issue](https://github.com/venkat22022202/black-vault/issues/new) with:
- What you expected to happen
- What actually happened
- Steps to reproduce

### Feature Requests

Have an idea? Open an issue and describe the use case. We're especially interested in:
- New AI provider support
- Agent framework integrations (LangChain, CrewAI, AutoGen, etc.)
- Security enhancements
- Developer experience improvements

## Development

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 + React 19 + TypeScript |
| API | tRPC 11 |
| Database | Neon Postgres + Drizzle ORM |
| Cache & Rate Limiting | Upstash Redis |
| Auth | Clerk |
| Styling | Tailwind CSS v4 |
| Encryption | AES-256-GCM (Node.js crypto) |

### Project Structure

```
src/
├── app/                           # Next.js pages and API routes
│   ├── api/proxy/[provider]/      # Proxy gateway (the core)
│   └── (dashboard)/               # Dashboard pages
├── server/
│   ├── db/schema.ts               # Drizzle schema (all tables)
│   ├── routers/                   # tRPC routers (business logic)
│   │   ├── vault.ts               # Key CRUD + encryption
│   │   ├── proxy.ts               # Token generation, sessions, rate limits
│   │   ├── killswitch.ts          # Emergency revocation
│   │   └── cost.ts                # Cost queries
│   └── services/                  # Core services
│       ├── encryption.ts          # AES-256-GCM encrypt/decrypt
│       ├── proxy-auth.ts          # Token auth + access control enforcement
│       ├── proxy-providers.ts     # Provider configs (add new providers here)
│       ├── proxy-pricing.ts       # Model pricing table
│       ├── ratelimit.ts           # Global + per-session rate limiting
│       └── redis.ts               # Cache helper
└── lib/
    ├── constants.ts               # Provider list, activity types
    └── utils.ts                   # Shared utilities
```

### Adding a New Provider (Most Common Contribution)

This is the easiest way to contribute. Most AI providers are OpenAI-compatible, so adding one takes ~30 lines:

**Step 1:** `src/server/services/proxy-providers.ts` -- Add provider config:

```typescript
const yourProvider: ProviderConfig = {
  baseUrl: "https://api.yourprovider.com",
  buildHeaders(realKey) {
    return { Authorization: `Bearer ${realKey}` };
  },
  extractModel(body) {
    return (body?.model as string) ?? null;
  },
  // Reuse OpenAI parsing for compatible providers:
  parseStreamChunk: openai.parseStreamChunk,
  extractUsage: openai.extractUsage,
  isStreamDone: openai.isStreamDone,
  stripHeaders: ["authorization"],
};

// Add to PROXY_PROVIDERS map:
export const PROXY_PROVIDERS: Record<string, ProviderConfig> = {
  // ... existing providers
  yourprovider: yourProvider,
};
```

**Step 2:** `src/server/services/proxy-pricing.ts` -- Add model pricing (per 1M tokens):

```typescript
"your-model-name": [inputPrice, outputPrice],
```

**Step 3:** `src/app/(dashboard)/vault/page.tsx` -- Add provider to `isProxySupported` and `MODELS_BY_PROVIDER`.

**Step 4:** Test with curl, open a PR.

### Database Changes

If your change requires schema changes:

1. Edit `src/server/db/schema.ts`
2. Run `npx drizzle-kit push` to apply
3. Document the new columns in your PR

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build` to verify no TypeScript errors
4. Open a PR with a clear description of what you changed and why
5. We'll review within 48 hours

### PR Title Format

- `feat: add Groq as proxy provider`
- `fix: handle streaming error in Anthropic provider`
- `docs: add OpenClaw integration guide`

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Prefer `const` over `let`
- Use existing patterns in the codebase as reference
- Don't add comments unless the logic isn't self-evident

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
