# Security Policy

BlackVault is a security product — it sits in the request path between AI agents
and provider API keys. We take vulnerabilities seriously and appreciate
responsible disclosure.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of:

- GitHub's [private vulnerability reporting](https://github.com/venkat22022202/black-vault/security/advisories/new)
  (Security → Advisories → Report a vulnerability)
- Email: **shreyasv107@gmail.com** with subject `BLACKVAULT SECURITY`

Please include:

- A description of the issue and its impact
- Steps to reproduce (a proof of concept if possible)
- Affected version / commit
- Any suggested remediation

We aim to acknowledge reports within **72 hours** and to provide a remediation
timeline after triage.

## Scope

In scope:

- The vault encryption layer (`src/server/services/encryption.ts`)
- Proxy token authentication and session enforcement (`src/server/services/proxy-auth.ts`, `proxy-token.ts`)
- Budget, rate-limit, model-restriction and IP-allowlist enforcement
- The proxy gateway and universal gateway routes (`src/app/api/proxy/...`, `src/app/api/v1/...`)
- Anything that could expose a stored provider API key in plaintext

Out of scope:

- Vulnerabilities in third-party dependencies (report those upstream; we will
  bump affected versions)
- Findings that require a compromised `VAULT_MASTER_KEY` or database (these are
  trust boundaries, not vulnerabilities)
- Self-hosted misconfiguration (e.g. missing env vars, exposed admin routes)

## Security model (summary)

- **Provider API keys** are encrypted at rest with AES-256-GCM using a per-key
  derived key (`HMAC-SHA256(VAULT_MASTER_KEY, userId:keyId)`). The master key is
  never stored in the database.
- **Proxy tokens** (`bvt_…`) are SHA-256 hashed before storage; the plaintext is
  shown once and never persisted.
- **Revocation** invalidates the Redis session cache immediately, so a killed
  token fails on its next request.
- **Budget caps** are enforced against a real-time, atomic Redis counter so
  concurrent requests cannot collectively overshoot the cap.

See [`docs/design/0001-core-hardening.md`](docs/design/0001-core-hardening.md)
for the detailed threat-model notes behind these guarantees.

## Supported versions

This project is pre-1.0. Security fixes are applied to `main` and the latest
release tag only.
