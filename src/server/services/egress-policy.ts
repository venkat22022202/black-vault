/**
 * Egress policy engine — the deterministic heart of the agent credential firewall.
 *
 * Given an agent's intended request (method + path) and the policy attached to
 * its `bvt_` token, decide allow/deny. Pure and I/O-free so it is exhaustively
 * unit-testable; the route layer handles auth, credential injection, and audit.
 *
 * The two HARD guarantees live outside this file (in the route): the agent never
 * receives the secret value, and the destination host is pinned by the target
 * config (never chosen by the agent). This module enforces the *third* layer —
 * what the legit credential is allowed to do — via method/path allowlists.
 *
 * See docs/design/0003-egress-firewall.md.
 */

export interface EgressPolicy {
  /** Allowed HTTP methods (case-insensitive). Empty/undefined ⇒ any method. */
  allowedMethods?: string[];
  /** Allowed path globs (`*` = one segment, `**` = any). Empty/undefined ⇒ any path. */
  allowedPaths?: string[];
  /** Path globs that are always denied (highest precedence). */
  blockedPaths?: string[];
}

export interface EgressDecision {
  allowed: boolean;
  /** Machine-readable reason for a denial (also used for audit + violation counts). */
  reason?:
    | "method_not_allowed"
    | "path_blocked"
    | "path_not_allowed"
    | "invalid_path";
  message?: string;
}

/**
 * Normalise a request path for matching:
 * - strip query/fragment
 * - ensure a single leading slash
 * - reject path traversal (`..`) which could escape an allowlisted prefix
 *
 * Returns null if the path is unsafe/invalid.
 */
export function normalizePath(rawPath: string): string | null {
  if (typeof rawPath !== "string") return null;
  // Drop query string and fragment.
  let p = rawPath.split("#")[0].split("?")[0];
  if (!p.startsWith("/")) p = "/" + p;
  // Collapse duplicate slashes.
  p = p.replace(/\/{2,}/g, "/");
  // Reject any traversal segment — defence in depth against allowlist escape.
  const segments = p.split("/");
  if (segments.some((s) => s === "..")) return null;
  return p;
}

/**
 * Convert a glob to a RegExp.
 * - `**` matches any characters including `/`
 * - `*`  matches any characters except `/` (a single path segment)
 * All other regex metacharacters are escaped.
 */
export function globToRegExp(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*"; // `**`
        i++;
      } else {
        out += "[^/]*"; // `*`
      }
    } else if ("\\^$.|?+()[]{}".includes(c)) {
      out += "\\" + c;
    } else {
      out += c;
    }
  }
  return new RegExp(`^${out}$`);
}

export function pathMatchesAny(path: string, globs: string[]): boolean {
  return globs.some((g) => globToRegExp(g).test(path));
}

/**
 * Evaluate an egress request against a token's policy.
 *
 * Precedence: invalid path → blocked → method allowlist → path allowlist → allow.
 * A missing/empty policy allows any method/path (the host is still pinned by the
 * target config); you opt into tighter rules.
 */
export function evaluateEgress(input: {
  method: string;
  path: string;
  policy?: EgressPolicy | null;
}): EgressDecision {
  const policy = input.policy ?? {};

  const path = normalizePath(input.path);
  if (path === null) {
    return { allowed: false, reason: "invalid_path", message: "Path is invalid or contains traversal" };
  }

  const method = (input.method || "GET").toUpperCase();

  if (policy.blockedPaths && policy.blockedPaths.length > 0 && pathMatchesAny(path, policy.blockedPaths)) {
    return { allowed: false, reason: "path_blocked", message: `Path ${path} is blocked by policy` };
  }

  if (policy.allowedMethods && policy.allowedMethods.length > 0) {
    const allowed = policy.allowedMethods.some((m) => m.toUpperCase() === method);
    if (!allowed) {
      return {
        allowed: false,
        reason: "method_not_allowed",
        message: `Method ${method} not allowed (allowed: ${policy.allowedMethods.join(", ")})`,
      };
    }
  }

  if (policy.allowedPaths && policy.allowedPaths.length > 0) {
    if (!pathMatchesAny(path, policy.allowedPaths)) {
      return {
        allowed: false,
        reason: "path_not_allowed",
        message: `Path ${path} not in allowlist`,
      };
    }
  }

  return { allowed: true };
}
