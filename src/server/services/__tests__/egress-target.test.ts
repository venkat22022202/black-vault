import { describe, it, expect } from "vitest";
import { parseHttpTarget, buildUpstreamUrl, applyTargetAuth, type HttpTarget } from "../egress-target";

describe("parseHttpTarget", () => {
  it("parses a bearer target and strips trailing slashes", () => {
    const t = parseHttpTarget({ baseUrl: "https://api.github.com/" });
    expect(t).toEqual({ baseUrl: "https://api.github.com", auth: { scheme: "bearer" }, policy: null });
  });

  it("parses a header-scheme target with a name", () => {
    const t = parseHttpTarget({ baseUrl: "https://api.x.com", auth: { scheme: "header", name: "X-API-Key" } });
    expect(t?.auth).toEqual({ scheme: "header", name: "X-API-Key" });
  });

  it("includes the policy when present", () => {
    const t = parseHttpTarget({
      baseUrl: "https://api.github.com",
      policy: { allowedMethods: ["GET"], allowedPaths: ["/repos/**"] },
    });
    expect(t?.policy).toEqual({ allowedMethods: ["GET"], allowedPaths: ["/repos/**"] });
  });

  it("rejects header/query schemes without a name", () => {
    expect(parseHttpTarget({ baseUrl: "https://x.com", auth: { scheme: "header" } })).toBeNull();
    expect(parseHttpTarget({ baseUrl: "https://x.com", auth: { scheme: "query" } })).toBeNull();
  });

  it("rejects non-http(s) and missing baseUrl", () => {
    expect(parseHttpTarget({ baseUrl: "ftp://x.com" })).toBeNull();
    expect(parseHttpTarget({ baseUrl: "file:///etc/passwd" })).toBeNull();
    expect(parseHttpTarget({})).toBeNull();
    expect(parseHttpTarget(null)).toBeNull();
  });
});

describe("buildUpstreamUrl (host pinning)", () => {
  const target: HttpTarget = { baseUrl: "https://api.github.com", auth: { scheme: "bearer" }, policy: null };

  it("builds a normal upstream URL and preserves query", () => {
    const url = buildUpstreamUrl(target, "/repos/me/app", "?per_page=5");
    expect(url?.toString()).toBe("https://api.github.com/repos/me/app?per_page=5");
  });

  it("preserves a base path on the target", () => {
    const t: HttpTarget = { baseUrl: "https://api.example.com/v1", auth: { scheme: "bearer" }, policy: null };
    expect(buildUpstreamUrl(t, "/users")?.toString()).toBe("https://api.example.com/v1/users");
  });

  it("cannot be redirected to another host via a protocol-relative path", () => {
    // `//evil.com/x` collapses to `/evil.com/x` — stays on the pinned origin.
    const url = buildUpstreamUrl(target, "//evil.com/x");
    expect(url?.host).toBe("api.github.com");
  });

  it("rejects path traversal", () => {
    expect(buildUpstreamUrl(target, "/repos/../../secrets")).toBeNull();
  });
});

describe("applyTargetAuth (server-side credential injection)", () => {
  it("injects a bearer token as an Authorization header", () => {
    const headers = new Headers();
    const url = new URL("https://api.github.com/user");
    applyTargetAuth({ baseUrl: "https://api.github.com", auth: { scheme: "bearer" }, policy: null }, url, headers, "ghp_secret");
    expect(headers.get("authorization")).toBe("Bearer ghp_secret");
  });

  it("injects a custom header", () => {
    const headers = new Headers();
    const url = new URL("https://api.x.com/v1");
    applyTargetAuth({ baseUrl: "https://api.x.com", auth: { scheme: "header", name: "X-API-Key" }, policy: null }, url, headers, "sk_live");
    expect(headers.get("x-api-key")).toBe("sk_live");
  });

  it("injects a query-param credential", () => {
    const headers = new Headers();
    const url = new URL("https://api.x.com/data");
    applyTargetAuth({ baseUrl: "https://api.x.com", auth: { scheme: "query", name: "key" }, policy: null }, url, headers, "abc123");
    expect(url.searchParams.get("key")).toBe("abc123");
  });
});
