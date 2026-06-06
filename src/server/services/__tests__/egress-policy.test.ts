import { describe, it, expect } from "vitest";
import {
  evaluateEgress,
  normalizePath,
  globToRegExp,
  pathMatchesAny,
} from "../egress-policy";

describe("normalizePath", () => {
  it("adds a leading slash and strips query/fragment", () => {
    expect(normalizePath("repos/me?x=1#frag")).toBe("/repos/me");
  });
  it("collapses duplicate slashes", () => {
    expect(normalizePath("//repos///me")).toBe("/repos/me");
  });
  it("rejects path traversal (allowlist escape)", () => {
    expect(normalizePath("/repos/../../etc/passwd")).toBeNull();
  });
});

describe("globToRegExp", () => {
  it("`*` matches a single segment only", () => {
    expect(globToRegExp("/repos/*").test("/repos/foo")).toBe(true);
    expect(globToRegExp("/repos/*").test("/repos/foo/bar")).toBe(false);
  });
  it("`**` matches across segments", () => {
    expect(globToRegExp("/repos/**").test("/repos/foo/bar")).toBe(true);
  });
  it("escapes regex metacharacters", () => {
    expect(globToRegExp("/a.b").test("/a.b")).toBe(true);
    expect(globToRegExp("/a.b").test("/axb")).toBe(false);
  });
});

describe("pathMatchesAny", () => {
  it("matches when any glob matches", () => {
    expect(pathMatchesAny("/user", ["/repos/**", "/user"])).toBe(true);
    expect(pathMatchesAny("/admin", ["/repos/**", "/user"])).toBe(false);
  });
});

describe("evaluateEgress", () => {
  it("allows anything when no policy is set (host still pinned elsewhere)", () => {
    expect(evaluateEgress({ method: "DELETE", path: "/anything", policy: null }).allowed).toBe(true);
  });

  it("denies a method outside the allowlist (read-only token can't DELETE)", () => {
    const d = evaluateEgress({
      method: "DELETE",
      path: "/repos/me/x",
      policy: { allowedMethods: ["GET"] },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("method_not_allowed");
  });

  it("allows a method inside the allowlist (case-insensitive)", () => {
    expect(
      evaluateEgress({ method: "get", path: "/x", policy: { allowedMethods: ["GET", "POST"] } }).allowed
    ).toBe(true);
  });

  it("denies a path outside the allowlist", () => {
    const d = evaluateEgress({
      method: "GET",
      path: "/secrets",
      policy: { allowedPaths: ["/repos/**", "/user"] },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("path_not_allowed");
  });

  it("allows a path inside the allowlist", () => {
    expect(
      evaluateEgress({ method: "GET", path: "/repos/me/app", policy: { allowedPaths: ["/repos/**"] } })
        .allowed
    ).toBe(true);
  });

  it("blockedPaths take precedence over an allow", () => {
    const d = evaluateEgress({
      method: "GET",
      path: "/repos/me/admin/keys",
      policy: { allowedPaths: ["/repos/**"], blockedPaths: ["/**/admin/**"] },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("path_blocked");
  });

  it("rejects traversal attempts before any allow rule", () => {
    const d = evaluateEgress({
      method: "GET",
      path: "/repos/../../etc/passwd",
      policy: { allowedPaths: ["/**"] },
    });
    expect(d.allowed).toBe(false);
    expect(d.reason).toBe("invalid_path");
  });

  it("simulates the demo: read-only GitHub token blocks the injected DELETE, allows the read", () => {
    const policy = { allowedMethods: ["GET"], allowedPaths: ["/repos/**", "/user"] };
    expect(evaluateEgress({ method: "GET", path: "/repos/me/app", policy }).allowed).toBe(true);
    expect(evaluateEgress({ method: "DELETE", path: "/repos/me/app", policy }).allowed).toBe(false);
  });
});
