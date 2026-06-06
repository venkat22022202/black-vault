/**
 * Egress target — parsing + host-pinned URL construction + credential injection.
 *
 * An "HTTP target" is a brokered credential: a vault key whose `metadata` holds
 * where the secret may be used and how to attach it. The two security-critical,
 * structural guarantees live here:
 *
 *  1. The destination **host is pinned** to the target's configured origin — the
 *     agent supplies only a path, never the host, so it can't redirect the
 *     credential to attacker.com (and SSRF is contained).
 *  2. The agent never sees the secret; it is injected here, server-side.
 *
 * Pure and I/O-free → unit-testable. See docs/design/0003-egress-firewall.md.
 */
import { normalizePath, type EgressPolicy } from "./egress-policy";

export type AuthScheme = "bearer" | "header" | "query";

export interface HttpTargetAuth {
  scheme: AuthScheme;
  /** Header or query-param name (required for "header"/"query"). */
  name?: string;
}

export interface HttpTarget {
  /** Pinned origin (+ optional base path), e.g. https://api.github.com */
  baseUrl: string;
  auth: HttpTargetAuth;
  policy: EgressPolicy | null;
}

/**
 * Parse + validate an HTTP target from a vault key's `metadata` jsonb.
 * Returns null if the metadata doesn't describe a usable HTTP target.
 *
 * Expected shape:
 *   { baseUrl, auth?: { scheme, name? }, policy?: { ... } }
 */
export function parseHttpTarget(metadata: unknown): HttpTarget | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;

  if (typeof m.baseUrl !== "string") return null;
  let base: URL;
  try {
    base = new URL(m.baseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;

  const rawAuth = (m.auth && typeof m.auth === "object" ? m.auth : {}) as Record<string, unknown>;
  const scheme = (typeof rawAuth.scheme === "string" ? rawAuth.scheme : "bearer") as AuthScheme;
  if (scheme !== "bearer" && scheme !== "header" && scheme !== "query") return null;

  const auth: HttpTargetAuth = { scheme };
  if (typeof rawAuth.name === "string") auth.name = rawAuth.name;
  // header/query injection needs a field name.
  if ((scheme === "header" || scheme === "query") && !auth.name) return null;

  const policy = (m.policy && typeof m.policy === "object" ? (m.policy as EgressPolicy) : null);

  return { baseUrl: m.baseUrl.replace(/\/+$/, ""), auth, policy };
}

/**
 * Build the upstream URL, with the host pinned to the target's origin.
 * Returns null if the path is unsafe or would escape the pinned origin.
 */
export function buildUpstreamUrl(target: HttpTarget, path: string, search = ""): URL | null {
  const norm = normalizePath(path);
  if (norm === null) return null;

  let url: URL;
  try {
    url = new URL(target.baseUrl + norm + (search ?? ""));
  } catch {
    return null;
  }

  // Hard host pin: the constructed URL must stay on the target's origin.
  const base = new URL(target.baseUrl);
  if (url.origin !== base.origin) return null;

  return url;
}

/**
 * Inject the secret into the outgoing request per the target's auth scheme.
 * Mutates `headers` and/or `url` in place; returns the (possibly mutated) URL.
 */
export function applyTargetAuth(
  target: HttpTarget,
  url: URL,
  headers: Headers,
  secret: string
): URL {
  switch (target.auth.scheme) {
    case "bearer":
      headers.set("authorization", `Bearer ${secret}`);
      break;
    case "header":
      headers.set(target.auth.name as string, secret);
      break;
    case "query":
      url.searchParams.set(target.auth.name as string, secret);
      break;
  }
  return url;
}
