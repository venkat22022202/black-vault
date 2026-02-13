# Contributing to BlackVault

Thanks for your interest in contributing! BlackVault is open source and we welcome contributions of all kinds.

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

## Ways to Contribute

### Good First Issues

Check out issues labeled [`good first issue`](https://github.com/venkat22022202/black-vault/labels/good%20first%20issue) — these are scoped, well-documented tasks perfect for your first contribution.

Current beginner-friendly tasks:
- Add new provider support (Groq, Mistral, Cohere, Together AI)
- Add dark/light theme toggle
- Add CSV export for activity logs

### Feature Requests

Have an idea? [Open an issue](https://github.com/venkat22022202/black-vault/issues/new) and describe what you'd like to see.

### Bug Reports

Found a bug? Open an issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce

## Development

### Tech Stack

- **Framework:** Next.js 16 + React 19 + TypeScript
- **API:** tRPC 11
- **Database:** Neon Postgres + Drizzle ORM
- **Cache:** Upstash Redis
- **Auth:** Clerk
- **Styling:** Tailwind CSS v4

### Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── api/proxy/          # Proxy gateway route handler
│   └── (dashboard)/        # Dashboard pages
├── server/
│   ├── db/schema.ts        # Drizzle schema
│   ├── routers/            # tRPC routers
│   └── services/           # Business logic
└── lib/                    # Shared utilities
```

### Adding a New Provider

This is the most common contribution. To add a new AI provider:

1. **`src/server/services/proxy-providers.ts`** — Add provider config (base URL, auth headers, model extraction, usage parsing)
2. **`src/server/services/proxy-pricing.ts`** — Add model pricing
3. **`src/lib/constants.ts`** — Add provider to the list

Use the existing OpenAI config as a template — most providers use a compatible format.

## Pull Request Process

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build` to verify no errors
4. Open a PR with a clear description of what you changed and why

## Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- Prefer `const` over `let`
- Use existing patterns in the codebase as reference

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
