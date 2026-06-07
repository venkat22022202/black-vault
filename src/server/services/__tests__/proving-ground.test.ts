import { describe, it, expect } from "vitest";
import { ATTACK_CATALOG } from "../proving-ground/attacks";
import { runProbe, runSuite, score, hardenPolicy, scan, type Target } from "../proving-ground/runner";

const TARGET: Target = { host: "api.github.com" };

describe("runProbe", () => {
  it("blocks cross-host exfiltration structurally (host pinned)", () => {
    const probe = ATTACK_CATALOG.find((p) => p.id === "ASI01-exfil-post")!;
    const r = runProbe(probe, TARGET, null); // even with NO policy
    expect(r.blocked).toBe(true);
    expect(r.reason).toBe("host_pinned");
  });

  it("lets a destructive same-host method through when policy is permissive", () => {
    const probe = ATTACK_CATALOG.find((p) => p.id === "ASI02-delete-repo")!;
    const r = runProbe(probe, TARGET, null);
    expect(r.blocked).toBe(false); // a wide-open token is a finding
  });

  it("blocks a destructive method once a read-only policy is set", () => {
    const probe = ATTACK_CATALOG.find((p) => p.id === "ASI02-delete-repo")!;
    const r = runProbe(probe, TARGET, { allowedMethods: ["GET"] });
    expect(r.blocked).toBe(true);
  });
});

describe("score", () => {
  it("grades a wide-open token poorly", () => {
    const results = runSuite(ATTACK_CATALOG, TARGET, null);
    const s = score(results);
    // cross-host probes are always blocked; the same-host write/scope probes get through
    expect(s.findings.length).toBeGreaterThan(0);
    expect(["D", "F", "C"]).toContain(s.grade);
    expect(s.perAsi.ASI02?.total).toBeGreaterThan(0);
  });

  it("gives an A when everything is blocked", () => {
    const allBlocked = runSuite(ATTACK_CATALOG, TARGET, null).map((r) => ({ ...r, blocked: true }));
    expect(score(allBlocked).grade).toBe("A");
    expect(score(allBlocked).passRate).toBe(1);
  });
});

describe("scan loop (attack -> harden -> prove)", () => {
  it("hardening with a read-only + block-paths default neutralises every finding", () => {
    const result = scan(ATTACK_CATALOG, TARGET, null); // start wide open
    expect(result.before.findings.length).toBeGreaterThan(0);
    expect(result.after.findings.length).toBe(0);
    expect(result.proven).toBe(true);
    expect(result.after.grade).toBe("A");
  });

  it("hardening with a declared least-privilege intent also blocks everything", () => {
    const result = scan(ATTACK_CATALOG, TARGET, null, {
      allowedMethods: ["GET"],
      allowedPaths: ["/repos/acme/app", "/repos/acme/app/issues/**"],
    });
    expect(result.proven).toBe(true);
    expect(result.after.findings.length).toBe(0);
  });
});

describe("hardenPolicy", () => {
  it("prefers a declared intent allowlist", () => {
    const p = hardenPolicy([], { allowedMethods: ["GET"], allowedPaths: ["/repos/**"] });
    expect(p.allowedMethods).toEqual(["GET"]);
    expect(p.allowedPaths).toEqual(["/repos/**"]);
  });

  it("falls back to read-only + blocked finding paths", () => {
    const results = runSuite(ATTACK_CATALOG, TARGET, null);
    const p = hardenPolicy(results);
    expect(p.allowedMethods).toEqual(["GET", "HEAD"]);
    expect((p.blockedPaths ?? []).length).toBeGreaterThan(0);
  });
});
