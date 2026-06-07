/**
 * Proving Ground — engine. Pure functions: run probes against a target + policy,
 * score the result, auto-harden into a least-privilege policy, and re-prove.
 *
 * Builds on the egress firewall's deterministic evaluator (egress-policy.ts) and its
 * structural host-pin guarantee: a request to a foreign host is blocked by construction
 * (the agent can't change the pinned host), so cross-host exfil probes are always blocked.
 *
 * See docs/design/0004-proving-ground.md.
 */
import { evaluateEgress, normalizePath, type EgressPolicy } from "../egress-policy";
import { type AttackProbe, type AsiCategory } from "./attacks";

/** The thing under test: a vault target pinned to one host, plus its token policy. */
export interface Target {
  /** Pinned host (origin host), e.g. "api.github.com". */
  host: string;
}

export interface ProbeResult {
  probe: AttackProbe;
  blocked: boolean;
  reason: string;
}

export function runProbe(probe: AttackProbe, target: Target, policy: EgressPolicy | null): ProbeResult {
  // Cross-host exfiltration is blocked structurally — the host is pinned, the agent
  // can't redirect the credential. This is the firewall's hard guarantee.
  if (probe.host && probe.host !== target.host) {
    return { probe, blocked: true, reason: "host_pinned" };
  }
  const decision = evaluateEgress({ method: probe.method, path: probe.path, policy });
  return {
    probe,
    blocked: !decision.allowed,
    reason: decision.allowed ? "allowed" : decision.reason ?? "denied",
  };
}

export function runSuite(probes: AttackProbe[], target: Target, policy: EgressPolicy | null): ProbeResult[] {
  return probes.map((p) => runProbe(p, target, policy));
}

export interface ScoreReport {
  grade: string;
  blocked: number;
  total: number;
  passRate: number; // fraction blocked
  perAsi: Partial<Record<AsiCategory, { blocked: number; total: number }>>;
  findings: ProbeResult[]; // the ones that got through
}

function gradeFor(passRate: number): string {
  if (passRate >= 1) return "A";
  if (passRate >= 0.9) return "A-";
  if (passRate >= 0.8) return "B";
  if (passRate >= 0.7) return "C";
  if (passRate >= 0.5) return "D";
  return "F";
}

export function score(results: ProbeResult[]): ScoreReport {
  const total = results.length;
  const blocked = results.filter((r) => r.blocked).length;
  const passRate = total === 0 ? 1 : blocked / total;

  const perAsi: ScoreReport["perAsi"] = {};
  for (const r of results) {
    const a = (perAsi[r.probe.asi] ??= { blocked: 0, total: 0 });
    a.total++;
    if (r.blocked) a.blocked++;
  }

  return {
    grade: gradeFor(passRate),
    blocked,
    total,
    passRate,
    perAsi,
    findings: results.filter((r) => !r.blocked),
  };
}

export interface HardenIntent {
  /** The methods the agent legitimately needs (e.g. ["GET"]). */
  allowedMethods?: string[];
  /** The path globs the agent legitimately needs (e.g. ["/repos/**"]). */
  allowedPaths?: string[];
}

/**
 * Generate a least-privilege policy that neutralises the findings.
 * - If an intent is declared, lock to that allowlist (the principled path).
 * - Otherwise derive a conservative policy from the findings: read-only, and block
 *   the exact (normalised) paths that got through.
 */
export function hardenPolicy(results: ProbeResult[], intent?: HardenIntent): EgressPolicy {
  if (intent && (intent.allowedMethods?.length || intent.allowedPaths?.length)) {
    const policy: EgressPolicy = {};
    if (intent.allowedMethods?.length) policy.allowedMethods = [...intent.allowedMethods];
    if (intent.allowedPaths?.length) policy.allowedPaths = [...intent.allowedPaths];
    return policy;
  }

  const findings = results.filter((r) => !r.blocked);
  const blockedPaths = new Set<string>();
  for (const r of findings) {
    const norm = normalizePath(r.probe.path);
    // Block the exact path; traversal/invalid paths are already denied by the evaluator.
    if (norm) blockedPaths.add(norm);
  }
  return {
    allowedMethods: ["GET", "HEAD"], // read-only baseline (denies destructive writes)
    blockedPaths: [...blockedPaths],
  };
}

export interface ScanResult {
  before: ScoreReport;
  hardenedPolicy: EgressPolicy;
  after: ScoreReport;
  /** True when hardening blocks 100% of the original findings. */
  proven: boolean;
}

/** The full loop: attack -> score -> harden -> re-prove. */
export function scan(
  probes: AttackProbe[],
  target: Target,
  policy: EgressPolicy | null,
  intent?: HardenIntent
): ScanResult {
  const beforeResults = runSuite(probes, target, policy);
  const before = score(beforeResults);
  const hardenedPolicy = hardenPolicy(beforeResults, intent);
  const afterResults = runSuite(probes, target, hardenedPolicy);
  const after = score(afterResults);
  return {
    before,
    hardenedPolicy,
    after,
    proven: after.findings.length === 0,
  };
}
