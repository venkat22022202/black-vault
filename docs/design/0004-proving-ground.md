# Design 0004 — Proving Ground (attack → harden → prove)

| | |
|---|---|
| **Status** | In progress · core engine implemented |
| **Headline** | Don't trust your agent security — prove it. Scan, auto-harden, re-prove, score. |
| **Related** | [`docs/PLAN.md`](../PLAN.md) · builds on [`0003-egress-firewall.md`](./0003-egress-firewall.md) |

## 1. Why this (and why it's different)

The 2026 landscape is crowded on **both** sides:
- **Defense:** MCP gateways (Lasso, IBM ContextForge, Obot, Pangea, Enkrypt), agent secrets
  (Infisical, 1Password, Aembit), Microsoft's Agent Governance Toolkit.
- **Offense:** red-team frameworks (garak, PyRIT, DeepTeam, SuperClaw, General Analysis).

They never meet. Red-teamers *find* holes; firewalls *block* things; **nobody closes the
loop** — find a hole, auto-generate the policy that blocks it, and re-prove it's blocked.
Meanwhile the [OWASP Top 10 for Agentic Applications (ASI01–ASI10:2026)](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)
plus EU AI Act / Colorado regulation make "assess + harden + demonstrate" mandatory.

**Thesis (contrarian, honest):** you cannot stop prompt injection — it's undecidable.
So don't. Make it *not matter* — structurally contain the agent so even a fully hijacked
agent can't steal the key or reach an unauthorized host — and **prove it by attacking
yourself.**

## 2. The loop

```
npx blackvault scan  ──>  ATTACK            run OWASP-ASI-mapped probes at the target
                          (find what leaks)  (config: vault target + bvt_ token policy)
                            │
                            ▼
                          AUTO-HARDEN        convert findings -> a BlackVault egress policy
                          (generate policy)   (host pin + method/path allowlist + blocks)
                            │
                            ▼
                          PROVE              re-run the exact probes against the hardened
                          (re-attack)         config; report N/N now blocked
                            │
                            ▼
                          SCORE              A–F grade per ASI + a "Hardened by BlackVault"
                                              README badge
```

## 3. Growth + contributor flywheel

- **Viral dev pattern:** `npx blackvault scan` → a **letter grade + badge** (Lighthouse /
  securityheaders.com / ssllabs). People screenshot the grade and badge their repos.
- **Plugin architecture:** contributors add **attacks** (an `AttackProbe`, mapped to an ASI
  category) and **defense** mitigations. Attack PRs are catnip for security researchers.
- **Compliance-shaped** (OWASP ASI + EU AI Act) → big orgs care, which is what pulls in
  serious contributors.
- **Fuses two repos:** Gauntlet (red-team) becomes the attack engine; BlackVault (firewall)
  becomes the auto-generated defense.

## 4. Architecture

- **`proving-ground/attacks.ts`** — the attack catalog: pure data, each probe mapped to an
  ASI category and expressed as an egress-evaluable request (method/path/host). Plugin point.
- **`proving-ground/runner.ts`** — pure engine:
  - `runSuite(probes, target, policy)` → per-probe blocked/allowed (cross-host blocked by the
    structural host-pin; same-host evaluated via the `egress-policy` evaluator).
  - `score(results)` → A–F grade + per-ASI breakdown.
  - `hardenPolicy(results, intent?)` → least-privilege `EgressPolicy` that neutralises every
    finding (use the declared intent allowlist, else a conservative read-only + block-paths).
- Later: a tRPC `provingGround.scan` + a `/proving-ground` dashboard page + an `npx`
  CLI + a public badge endpoint (`/api/badge/<token>` → SVG grade).

Everything in the core is **pure and unit-tested**, including a test that asserts the loop:
after `hardenPolicy`, re-running the suite blocks 100% of findings.

## 5. Scope (v0) and honesty

- **v0 covers the egress-evaluable ASI subset** — ASI01 (goal hijack → exfil/cross-host),
  ASI02 (tool misuse → destructive methods), ASI03 (privilege/identity abuse → out-of-scope
  paths, traversal). Categories like memory poisoning (ASI06) or inter-agent (ASI07) need
  live/runtime probing and arrive via the plugin system later.
- **Honest claims:** tests *known* attack classes, not all possible attacks; "proof" is
  empirical (we ran them, they're blocked), not formal verification; the structural guarantee
  is strongest for credential/secret-value exfiltration and host-pinned egress. The README
  will say exactly this.

## 6. Build path

1. Core engine + tests (attacks, runner, score, harden, prove). ✅ this increment
2. tRPC `provingGround.scan` over a vault target + a `/proving-ground` UI (run → grade → apply).
3. `npx blackvault scan` CLI + a shareable SVG badge endpoint.
4. Live-probe runner (drive a real agent/MCP) + more ASI plugins.
