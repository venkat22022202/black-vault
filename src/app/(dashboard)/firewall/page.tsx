"use client";

import { motion } from "framer-motion";
import {
  ShieldCheck,
  Plus,
  Globe,
  Trash2,
  KeyRound,
  Copy,
  Check,
  Loader2,
  Lock,
  Ban,
  CheckCircle2,
  Terminal,
  X,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://your-blackvault.vercel.app";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const;

function copy(text: string, label = "Copied") {
  navigator.clipboard.writeText(text);
  toast.success(label);
}

// ============================================
// CREATE TARGET MODAL
// ============================================
function CreateTargetModal({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.github.com");
  const [secret, setSecret] = useState("");
  const [scheme, setScheme] = useState<"bearer" | "header" | "query">("bearer");
  const [authName, setAuthName] = useState("");
  const [methods, setMethods] = useState<string[]>(["GET"]);
  const [allowedPaths, setAllowedPaths] = useState("/repos/**, /user");
  const [blockedPaths, setBlockedPaths] = useState("");
  const utils = trpc.useUtils();

  const create = trpc.egress.createTarget.useMutation({
    onSuccess: () => {
      utils.egress.listTargets.invalidate();
      toast.success("Egress target created — the agent never sees this secret.");
      onClose();
    },
    onError: (e) => toast.error(e.message || "Failed to create target"),
  });

  const toggleMethod = (m: string) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const parseList = (s: string) =>
    s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

  const submit = () => {
    if (!label.trim() || !baseUrl.trim() || !secret.trim()) {
      toast.error("Name, base URL and secret are required");
      return;
    }
    if ((scheme === "header" || scheme === "query") && !authName.trim()) {
      toast.error(`A field name is required for the ${scheme} scheme`);
      return;
    }
    create.mutate({
      label: label.trim(),
      baseUrl: baseUrl.trim(),
      secret: secret.trim(),
      authScheme: scheme,
      authName: authName.trim() || undefined,
      allowedMethods: methods.length ? (methods as ("GET")[]) : undefined,
      allowedPaths: allowedPaths.trim() ? parseList(allowedPaths) : undefined,
      blockedPaths: blockedPaths.trim() ? parseList(blockedPaths) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary mb-1 flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-neon-green" />
          New Egress Target
        </h2>
        <p className="text-xs text-text-muted mb-6">
          Store a real credential. Agents reach it through a scoped token — they never see the secret.
        </p>

        <div className="space-y-4">
          <Field label="Name">
            <input className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="GitHub (read-only)" />
          </Field>

          <Field label="Base URL (host is pinned — the agent can never change it)">
            <input className={cn(inputCls, "font-mono")} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.github.com" />
          </Field>

          <Field label="Secret (encrypted at rest, injected server-side)">
            <input type="password" className={cn(inputCls, "font-mono")} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="ghp_..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Inject as">
              <select className={inputCls} value={scheme} onChange={(e) => setScheme(e.target.value as typeof scheme)}>
                <option value="bearer">Authorization: Bearer</option>
                <option value="header">Custom header</option>
                <option value="query">Query param</option>
              </select>
            </Field>
            {scheme !== "bearer" && (
              <Field label={scheme === "header" ? "Header name" : "Param name"}>
                <input className={cn(inputCls, "font-mono")} value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder={scheme === "header" ? "X-API-Key" : "key"} />
              </Field>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs text-text-muted">Allowed methods</label>
              <button
                onClick={() => { setMethods(["GET"]); }}
                className="text-[10px] font-mono text-neon-green hover:underline"
              >
                read-only preset
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => toggleMethod(m)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-mono border transition-all",
                    methods.includes(m)
                      ? "bg-neon-green/10 border-neon-green/40 text-neon-green"
                      : "border-void-300 text-text-muted hover:text-text-secondary"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Field label="Allowed paths (comma/newline, glob * and **)">
            <input className={cn(inputCls, "font-mono")} value={allowedPaths} onChange={(e) => setAllowedPaths(e.target.value)} placeholder="/repos/**, /user" />
          </Field>

          <Field label="Blocked paths (optional, always denied)">
            <input className={cn(inputCls, "font-mono")} value={blockedPaths} onChange={(e) => setBlockedPaths(e.target.value)} placeholder="/**/admin/**" />
          </Field>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 rounded-lg border border-void-300 py-2.5 text-sm text-text-secondary hover:bg-void-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={create.isPending}
            className="press flex-1 rounded-lg bg-neon-green py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Create target
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// MINT TOKEN MODAL (shows bvt_ once + curl)
// ============================================
function MintTokenModal({
  target,
  onClose,
}: {
  target: { id: string; label: string; baseUrl: string };
  onClose: () => void;
}) {
  const [token, setToken] = useState<string | null>(null);
  const mint = trpc.proxy.generateToken.useMutation({
    onSuccess: (res) => setToken(res.token),
    onError: (e) => toast.error(e.message || "Failed to mint token"),
  });

  const samplePath = (() => {
    try {
      const u = new URL(target.baseUrl);
      return u.host.includes("github") ? "/user" : "/";
    } catch {
      return "/";
    }
  })();

  const allowCurl = token
    ? `curl ${APP_URL}/api/egress${samplePath} \\\n  -H "Authorization: Bearer ${token}"`
    : "";
  const blockCurl = token
    ? `curl -X DELETE ${APP_URL}/api/egress${samplePath} \\\n  -H "Authorization: Bearer ${token}"   # 403 blocked`
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-text-muted hover:text-text-primary">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-text-primary mb-1 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-neon-cyan" />
          Token for {target.label}
        </h2>

        {!token ? (
          <>
            <p className="text-xs text-text-muted mb-6">
              Mint a scoped <span className="font-mono text-neon-cyan">bvt_</span> token. Hand this to the agent
              instead of the real secret.
            </p>
            <button
              onClick={() => mint.mutate({ vaultKeyId: target.id, label: `${target.label} token` })}
              disabled={mint.isPending}
              className="w-full rounded-lg bg-neon-cyan py-2.5 text-sm font-semibold text-black hover:bg-neon-cyan/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mint.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Mint token
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-neon-amber/30 bg-neon-amber/5 p-3 text-xs text-neon-amber">
              Copy it now — it is shown only once.
            </div>
            <CodeBlock label="Token" code={token} />
            <CodeBlock label="Allowed (the agent's real work)" code={allowCurl} tone="green" />
            <CodeBlock label="Blocked (prompt-injected misuse)" code={blockCurl} tone="red" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ============================================
// SMALL PRIMITIVES
// ============================================
const inputCls =
  "w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function CodeBlock({ label, code, tone = "default" }: { label: string; code: string; tone?: "default" | "green" | "red" }) {
  const [copied, setCopied] = useState(false);
  const border = tone === "green" ? "border-neon-green/30" : tone === "red" ? "border-neon-red/30" : "border-void-300";
  return (
    <div>
      <div className="text-xs text-text-muted mb-1">{label}</div>
      <div className={cn("relative rounded-lg border bg-void-100 p-3", border)}>
        <pre className="text-xs font-mono text-text-secondary whitespace-pre-wrap break-all pr-8">{code}</pre>
        <button
          onClick={() => { copy(code); setCopied(true); }}
          className="absolute top-2 right-2 text-text-muted hover:text-neon-green"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

// ============================================
// TARGET CARD
// ============================================
function TargetCard({
  target,
  onMint,
}: {
  target: {
    id: string;
    label: string;
    baseUrl: string;
    authScheme: string;
    policy: { allowedMethods?: string[]; allowedPaths?: string[]; blockedPaths?: string[] } | null;
    keyPrefix: string;
  };
  onMint: () => void;
}) {
  const utils = trpc.useUtils();
  const del = trpc.egress.deleteTarget.useMutation({
    onSuccess: () => {
      utils.egress.listTargets.invalidate();
      toast.success("Target deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const methods = target.policy?.allowedMethods ?? ["ANY"];
  const paths = target.policy?.allowedPaths ?? ["any path"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 350, damping: 28 }}
      className="rounded-xl border border-void-300 bg-void-50 p-5 glass-hover"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Globe className="w-4 h-4 text-neon-green" />
          </div>
          <div>
            <div className="text-sm font-semibold text-text-primary">{target.label}</div>
            <div className="text-xs font-mono text-text-muted">{target.baseUrl}</div>
          </div>
        </div>
        <button onClick={() => del.mutate({ id: target.id })} className="text-text-muted hover:text-neon-red p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {methods.map((m) => (
          <span key={m} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-void-200 border border-void-300 text-text-secondary">
            {m}
          </span>
        ))}
        {paths.map((p) => (
          <span key={p} className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-void-200 border border-void-300 text-text-muted">
            {p}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Lock className="w-3 h-3 text-text-muted" />
        <span className="text-[10px] font-mono text-text-muted">secret {target.keyPrefix} · encrypted</span>
        <button
          onClick={onMint}
          className="press ml-auto rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-xs font-semibold text-neon-cyan hover:bg-neon-cyan/20 flex items-center gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Mint token
        </button>
      </div>
    </motion.div>
  );
}

// ============================================
// AUDIT FEED
// ============================================
function AuditFeed() {
  const { data: logs } = trpc.egress.getLogs.useQuery(undefined, { refetchInterval: 4000 });

  return (
    <div className="rounded-xl border border-void-300 bg-void-50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-void-300">
        <Terminal className="w-4 h-4 text-neon-green" />
        <span className="text-sm font-semibold text-text-primary">Live audit feed</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse-glow" />
          live
        </span>
      </div>
      <div className="divide-y divide-void-300 max-h-[420px] overflow-y-auto">
        {!logs?.length && (
          <div className="px-4 py-10 text-center text-xs text-text-muted">
            No egress calls yet. Mint a token and make a request — allowed and blocked attempts show here.
          </div>
        )}
        {logs?.map((l) => (
          <div key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-xs font-mono">
            {l.blocked ? (
              <Ban className="w-3.5 h-3.5 text-neon-red shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-neon-green shrink-0" />
            )}
            <span className={cn("w-14 shrink-0", l.blocked ? "text-neon-red" : "text-text-secondary")}>{l.method}</span>
            <span className="text-text-muted truncate flex-1">{l.provider}{l.endpoint}</span>
            <span className={cn("shrink-0", l.blocked ? "text-neon-red" : "text-text-muted")}>{l.statusCode}</span>
            <span className="text-text-muted shrink-0 hidden sm:inline">{new Date(l.createdAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// PAGE
// ============================================
export default function FirewallPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [mintTarget, setMintTarget] = useState<{ id: string; label: string; baseUrl: string } | null>(null);
  const { data: targets, isLoading } = trpc.egress.listTargets.useQuery();
  const { data: logs } = trpc.egress.getLogs.useQuery(undefined, { refetchInterval: 4000 });

  const allowed = logs?.filter((l) => !l.blocked).length ?? 0;
  const blocked = logs?.filter((l) => l.blocked).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-neon-green" />
            Egress Firewall
          </h1>
          <p className="text-sm text-text-secondary mt-1 max-w-2xl">
            Give an AI agent a real credential it can never steal and cannot misuse. The secret stays in the vault,
            the host is pinned, and every call is policy-checked and audited.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="press rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          New target
        </button>
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Guarantee icon={Lock} title="Can't be stolen" body="Injected server-side. The agent references it by name and never sees the value." />
        <Guarantee icon={Globe} title="Can't be redirected" body="The destination host is pinned by config — not chosen by the agent." />
        <Guarantee icon={Ban} title="Can't be misused" body="Method + path allowlist. A prompt-injected DELETE is denied and logged." />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Targets" value={targets?.length ?? 0} tone="default" />
        <Stat label="Allowed (recent)" value={allowed} tone="green" />
        <Stat label="Blocked (recent)" value={blocked} tone="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Targets */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-text-primary">Targets</div>
          {isLoading && <div className="text-xs text-text-muted">Loading…</div>}
          {!isLoading && !targets?.length && (
            <div className="rounded-xl border border-dashed border-void-300 p-8 text-center">
              <Zap className="w-6 h-6 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-secondary">No targets yet.</p>
              <p className="text-xs text-text-muted mt-1">
                Add one (e.g. GitHub, read-only) and mint a token to run the demo.
              </p>
            </div>
          )}
          {targets?.map((t) => (
            <TargetCard key={t.id} target={t} onMint={() => setMintTarget(t)} />
          ))}
        </div>

        {/* Audit */}
        <AuditFeed />
      </div>

      {showCreate && <CreateTargetModal onClose={() => setShowCreate(false)} />}
      {mintTarget && <MintTokenModal target={mintTarget} onClose={() => setMintTarget(null)} />}
    </div>
  );
}

function Guarantee({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-void-300 bg-void-50 p-4">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-neon-green" />
        <span className="text-sm font-semibold text-text-primary">{title}</span>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{body}</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "default" | "green" | "red" }) {
  const color = tone === "green" ? "text-neon-green" : tone === "red" ? "text-neon-red" : "text-text-primary";
  return (
    <div className="rounded-xl border border-void-300 bg-void-50 p-4">
      <div className={cn("text-2xl font-bold font-mono", color)}>{value}</div>
      <div className="text-xs text-text-muted mt-0.5">{label}</div>
    </div>
  );
}
