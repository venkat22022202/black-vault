"use client";

import Link from "next/link";
import {
  Lock,
  ShieldCheck,
  Zap,
  Ban,
  ArrowRight,
  Star,
  Plug,
  Gauge,
  Copy,
  Check,
} from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import SmoothScroll from "@/components/smooth-scroll";

// Hero headline split into reveal beats (1-3 words depending on length).
const HERO_L1: { w: string; d: number }[] = [
  { w: "Arm", d: 0.05 }, { w: "your", d: 0.05 }, { w: "AI", d: 0.05 }, { w: "agents.", d: 0.28 },
];
const HERO_L2: { w: string; d: number }[] = [
  { w: "Never", d: 0.5 }, { w: "hand", d: 0.5 },
  { w: "over", d: 0.7 }, { w: "the", d: 0.7 }, { w: "keys.", d: 0.92 },
];

const GITHUB_REPO = "https://github.com/venkat22022202/black-vault";

const MCP_CONFIG = `{
  "mcpServers": {
    "blackvault": {
      "url": "https://black-vault-murex.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer bvt_your_token" }
    }
  }
}`;

const FIREWALL_CURL = `# allowed by policy -> 200, real key injected server-side
curl https://black-vault-murex.vercel.app/api/egress/user \\
  -H "Authorization: Bearer bvt_your_token"

# prompt-injected misuse -> 403 blocked + audited
curl -X DELETE https://black-vault-murex.vercel.app/api/egress/repos/you/app \\
  -H "Authorization: Bearer bvt_your_token"`;

const SECRET_KEY = "sk-live-51H8aZ7pQxR3mN9kV";
const BVT_TOKEN = "bvt_3f9a2c8e4d";

// ============================================
// COPYABLE CODE
// ============================================
function CopyableCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative rounded-xl border border-void-300 bg-void-50">
      <pre className="p-4 pr-10 text-xs font-mono text-text-secondary whitespace-pre-wrap break-all overflow-x-auto leading-relaxed">
        {code}
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute top-3 right-3 text-text-muted hover:text-neon-green transition-colors"
        aria-label="Copy"
      >
        {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ============================================
// HERO TERMINAL (typing log; visible frame even if JS is slow)
// ============================================
const terminalLines: { s: "cmd" | "ok" | "block"; text: string }[] = [
  { s: "cmd", text: "agent -> blackvault -> api.github.com" },
  { s: "ok", text: "GET  /repos/octocat/app    200   key injected (agent never sees it)" },
  { s: "ok", text: "GET  /user                 200   allowed by policy" },
  { s: "block", text: "POST attacker.com          BLOCKED  host not pinned" },
  { s: "block", text: "DELETE /repos/octocat      403   method not allowed" },
  { s: "ok", text: "GET  /repos/octocat/issues 200   allowed by policy" },
];

function HeroTerminal() {
  const [visible, setVisible] = useState(0);
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      // type up to all lines, hold ~3 ticks, then restart — setState only in callback
      n = n + 1 > terminalLines.length + 3 ? 0 : n + 1;
      setVisible(Math.min(n, terminalLines.length));
    }, 550);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="rounded-xl border border-void-300 bg-void-50/90 backdrop-blur overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-void-300 bg-void-100">
          <div className="w-3 h-3 rounded-full bg-neon-red/70" />
          <div className="w-3 h-3 rounded-full bg-neon-amber/70" />
          <div className="w-3 h-3 rounded-full bg-neon-green/70" />
          <span className="ml-2 text-xs text-text-muted font-mono">blackvault — egress firewall</span>
        </div>
        <div className="p-4 font-mono text-[11px] sm:text-[13px] leading-relaxed min-h-[210px]">
          {terminalLines.slice(0, visible).map((line, i) => (
            <div key={i} className="flex items-center gap-2 whitespace-nowrap animate-fade-in">
              {line.s === "cmd" ? (
                <span className="text-text-muted">$ {line.text}</span>
              ) : (
                <>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", line.s === "ok" ? "bg-neon-green" : "bg-neon-red")} />
                  <span className={line.s === "ok" ? "text-text-secondary" : "text-neon-red"}>{line.text}</span>
                </>
              )}
            </div>
          ))}
          <span className="inline-block w-2 h-4 bg-neon-green ml-1 align-middle animate-terminal-blink" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// MARQUEE
// ============================================
const MARQUEE = [
  "OpenAI", "Anthropic", "Google", "Nebius", "Claude Desktop", "Cursor",
  "Cline", "LangChain", "CrewAI", "AutoGen", "GitHub", "Stripe",
];

function Group() {
  return (
    <div className="flex shrink-0">
      {MARQUEE.map((t, i) => (
        <span key={i} className="font-mono text-sm text-text-muted px-7 flex items-center gap-7">
          {t}
          <span className="text-neon-green/30">/</span>
        </span>
      ))}
    </div>
  );
}

function Marquee() {
  return (
    <div className="overflow-hidden border-y border-void-300 py-6 mask-fade-x">
      <div className="flex w-max animate-marquee">
        <Group />
        <Group />
      </div>
    </div>
  );
}

// ============================================
// FEATURES
// ============================================
const features = [
  { icon: ShieldCheck, title: "Egress Firewall", desc: "Give an agent your GitHub / Stripe / DB key through a scoped token. Host pinned, methods and paths allowlisted, secret injected server-side." },
  { icon: Plug, title: "MCP Server", desc: "A drop-in MCP server for Claude Desktop, Cursor and Claude Code. The config holds a bvt_ token, never a provider key." },
  { icon: Lock, title: "Encrypted Vault", desc: "AES-256-GCM with per-key derived keys. Decrypted only in-flight, never returned to the agent." },
  { icon: Zap, title: "Universal Gateway", desc: "One OpenAI-compatible endpoint for every provider. Auto-routes by model, translates tool calls and images." },
  { icon: Ban, title: "Instant Kill Switch", desc: "Revoke a token, a key, or everything. The next call fails immediately." },
  { icon: Gauge, title: "Budget & Rate Caps", desc: "Per-token spend caps and RPM/RPD limits, enforced atomically — a burst can't blow past the cap." },
];

// ============================================
// PAGE
// ============================================
export default function LandingPage() {
  const keySecRef = useRef<HTMLElement>(null);
  const keyRef = useRef<HTMLSpanElement>(null);
  const hSecRef = useRef<HTMLElement>(null);
  const l1Ref = useRef<HTMLDivElement>(null);
  const l2Ref = useRef<HTMLDivElement>(null);

  // Drive the key-sweep and horizontal lines from real scroll position (rAF).
  // Reliable with Lenis, and content is visible by default so it can't black out.
  useEffect(() => {
    const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    let raf = 0;
    const loop = () => {
      const vh = window.innerHeight;

      const ks = keySecRef.current;
      const k = keyRef.current;
      if (ks && k) {
        const r = ks.getBoundingClientRect();
        const p = clamp((vh - r.top) / (vh * 0.9));
        k.style.setProperty("--sweep", `${(p * 100).toFixed(1)}%`);
      }

      const hs = hSecRef.current;
      const l1 = l1Ref.current;
      const l2 = l2Ref.current;
      if (hs && l1 && l2) {
        const r = hs.getBoundingClientRect();
        const total = r.height - vh;
        const p = total > 0 ? clamp(-r.top / total) : 0;
        const o1 = Math.max(0, l1.scrollWidth - window.innerWidth);
        const o2 = Math.max(0, l2.scrollWidth - window.innerWidth);
        l1.style.transform = `translateX(${(-p * o1).toFixed(1)}px)`;
        l2.style.transform = `translateX(${(-(1 - p) * o2).toFixed(1)}px)`;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen bg-void-0 overflow-x-clip">
      <SmoothScroll />

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-mono text-xl font-bold tracking-tight text-neon-green">
            BLACKVAULT
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-void-400 px-3 py-2 text-sm text-text-secondary hover:text-neon-green hover:border-neon-green/40 transition-colors"
            >
              <Star className="w-4 h-4" />
              <span className="hidden sm:inline">Star</span>
            </a>
            <Link href="/sign-in" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO — fully visible (no JS-gated opacity) */}
      <section className="relative pt-32 pb-20 px-6 grain">
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div
          className="absolute -inset-40 animate-aurora opacity-60"
          style={{
            background:
              "radial-gradient(40% 40% at 30% 35%, rgba(0,255,136,0.10), transparent 70%), radial-gradient(40% 40% at 70% 60%, rgba(6,182,212,0.07), transparent 70%)",
          }}
        />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <span
            className="hero-rise inline-flex items-center gap-2 rounded-full border border-neon-green/30 bg-neon-green/5 px-4 py-1.5 text-xs font-mono text-neon-green"
            style={{ animationDelay: "0s" }}
          >
            open source · MIT · credential firewall for AI agents
          </span>

          <h1 className="mt-8 font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]">
            <span className="block">
              {HERO_L1.map((it, i) => (
                <Fragment key={`l1-${i}`}>
                  <span className="word" style={{ animationDelay: `${it.d}s` }}>{it.w}</span>
                  {i < HERO_L1.length - 1 ? " " : null}
                </Fragment>
              ))}
            </span>
            <span className="block">
              {HERO_L2.map((it, i) => (
                <Fragment key={`l2-${i}`}>
                  <span className="word text-gradient-green" style={{ animationDelay: `${it.d}s` }}>{it.w}</span>
                  {i < HERO_L2.length - 1 ? " " : null}
                </Fragment>
              ))}
            </span>
          </h1>

          <p
            className="hero-rise mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
            style={{ animationDelay: "1.25s" }}
          >
            Vault the secret. Hand the agent a scoped <span className="font-mono text-neon-green">bvt_</span> token. Cap
            it, audit it, kill it in one click — and even prompt-injected, it cannot steal the key or misuse it.
          </p>

          <div className="hero-rise mt-10 flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: "1.45s" }}>
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-lg bg-neon-green px-8 py-3.5 text-base font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_30px_rgba(0,255,136,0.4)]"
            >
              Start free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-void-400 px-8 py-3.5 text-base font-medium text-text-secondary hover:text-text-primary hover:border-void-500 transition-all"
            >
              <Star className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>

          <div className="hero-rise mt-16" style={{ animationDelay: "1.65s" }}>
            <HeroTerminal />
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <Marquee />

      {/* CENTERPIECE 1 — Key -> Token: the key recolors red->green (vaulted) on scroll */}
      <section
        ref={keySecRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden grain px-6 py-28 text-center border-t border-void-300"
      >
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div
          className="absolute -inset-40 animate-aurora opacity-50"
          style={{
            background:
              "radial-gradient(40% 40% at 50% 42%, rgba(0,255,136,0.10), transparent 70%), radial-gradient(40% 40% at 50% 62%, rgba(239,68,68,0.05), transparent 70%)",
          }}
        />
        <div className="relative z-10 w-full">
          <div className="font-mono text-xs text-neon-green mb-12">{"// the key your agent never sees"}</div>

          <span
            ref={keyRef}
            style={{ ["--sweep" as string]: "0%" }}
            className="key-sweep block w-max max-w-full mx-auto font-mono font-bold tracking-tight whitespace-nowrap text-[7vw] md:text-[4.6vw]"
          >
            {SECRET_KEY}
          </span>

          <div className="mt-14 flex flex-col items-center gap-4">
            <span className="font-mono text-xs text-text-muted tracking-[0.3em]">VAULTED · ENCRYPTED · SCOPED ↓</span>
            <div className="font-mono text-2xl md:text-4xl font-bold text-neon-green px-6 py-3 rounded-xl border border-neon-green/30 bg-neon-green/5 shadow-[0_0_30px_rgba(0,255,136,0.15)]">
              {BVT_TOKEN}
            </div>
            <p className="text-text-secondary max-w-md mt-3 leading-relaxed">
              The agent gets this token — never your key. Cap it, audit it, and revoke it in one click.
            </p>
          </div>
        </div>
      </section>

      {/* CENTERPIECE 2 — two counter-scrolling kinetic lines (pinned, fills the screen) */}
      <section ref={hSecRef} className="relative h-[150vh] border-t border-void-300">
        <div className="sticky top-0 h-screen flex flex-col justify-center gap-4 md:gap-8 overflow-hidden grain">
          <div className="absolute inset-0 bg-grid opacity-25" />
          <div
            className="absolute -inset-40 animate-aurora opacity-40"
            style={{ background: "radial-gradient(45% 45% at 50% 50%, rgba(0,255,136,0.08), transparent 70%)" }}
          />
          <div ref={l1Ref} className="hscroll-line whitespace-nowrap w-max relative z-10">
            <span className="font-display font-bold tracking-tight leading-none text-[12vw] text-text-primary">
              ONE KEY, VAULTED.&nbsp;&nbsp;<span className="text-gradient-green">A SCOPED TOKEN PER AGENT.</span>&nbsp;&nbsp;
            </span>
          </div>
          <div ref={l2Ref} className="hscroll-line whitespace-nowrap w-max relative z-10">
            <span className="font-display font-bold tracking-tight leading-none text-[12vw] text-neon-green">
              KILL IT IN ONE CLICK.&nbsp;&nbsp;ZERO BLAST RADIUS.&nbsp;&nbsp;
            </span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-24 px-6 border-t border-void-300">
        <div className="max-w-7xl mx-auto">
          <div className="mb-14 reveal">
            <div className="font-mono text-xs text-neon-green mb-3">{"// what ships"}</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight max-w-2xl">
              The guardrails agents were missing.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-void-300 border border-void-300 rounded-xl overflow-hidden">
            {features.map((f, i) => (
              <div key={f.title} className="group relative bg-void-50 p-7 hover:bg-void-100 transition-colors reveal">
                <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-neon-green/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex items-center justify-between mb-5">
                  <span className="font-mono text-xs text-text-muted">0{i + 1}</span>
                  <f.icon className="w-4 h-4 text-text-muted group-hover:text-neon-green transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DROP-IN SETUP */}
      <section id="connect" className="py-24 px-6 border-t border-void-300">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 reveal">
            <div className="font-mono text-xs text-neon-green mb-3">{"// drop-in setup"}</div>
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Connect in <span className="text-gradient-green">30 seconds</span>.
            </h2>
            <p className="mt-4 text-text-secondary max-w-2xl mx-auto">
              Mint a <span className="font-mono text-neon-green">bvt_</span> token, then plug it into any MCP client — or
              broker any API key over HTTP. Your config holds the token, never your real key.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reveal">
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-text-primary">
                <Plug className="w-4 h-4 text-neon-cyan" />
                Connect via MCP
              </div>
              <CopyableCode code={MCP_CONFIG} />
              <p className="mt-3 text-xs text-text-muted">
                Drop into <span className="font-mono">claude_desktop_config.json</span> or
                <span className="font-mono"> mcp.json</span>. Governed by your budget caps, model limits and kill switch.
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-text-primary">
                <ShieldCheck className="w-4 h-4 text-neon-green" />
                Broker any API key
              </div>
              <CopyableCode code={FIREWALL_CURL} />
              <p className="mt-3 text-xs text-text-muted">
                Injected server-side toward a pinned host. A prompt-injected delete or exfil attempt is blocked and
                audited — the agent never sees the key.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-6 border-t border-void-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 reveal">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Three steps. <span className="text-gradient-green">Zero blast radius.</span>
            </h2>
          </div>
          <div className="space-y-12">
            {[
              { step: "01", title: "Vault the secret", desc: "Add an API key or credential. Encrypted with AES-256-GCM using a per-key derived key — and never returned to the agent." },
              { step: "02", title: "Mint a scoped token", desc: "Generate a bvt_ token per agent with a policy: allowed hosts, methods and paths, a budget cap, and rate limits." },
              { step: "03", title: "Ship it safely", desc: "The agent works through the token — it cannot see, steal, or misuse the secret. Every call is audited; one click kills it." },
            ].map((item) => (
              <div key={item.step} className="flex gap-6 items-start reveal">
                <div className="shrink-0 w-14 h-14 rounded-xl border border-void-400 bg-void-100 flex items-center justify-center">
                  <span className="font-mono text-lg font-bold text-neon-green">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-text-primary mb-1">{item.title}</h3>
                  <p className="text-text-secondary leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-void-300">
        <div className="max-w-4xl mx-auto text-center reveal">
          <div className="relative rounded-2xl border border-void-300 bg-void-50 p-12 md:p-16 overflow-hidden grain">
            <div className="absolute inset-0 bg-radial-fade opacity-60" />
            <div
              className="absolute -inset-40 animate-aurora opacity-40"
              style={{ background: "radial-gradient(40% 40% at 50% 50%, rgba(0,255,136,0.10), transparent 70%)" }}
            />
            <div className="relative z-10">
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Give your agents real power, safely.
              </h2>
              <p className="text-lg text-text-secondary mb-8 max-w-lg mx-auto">
                Free during beta. Open source. Self-hostable. Set up in two minutes.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/sign-up"
                  className="group inline-flex items-center gap-2 rounded-lg bg-neon-green px-8 py-4 text-lg font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.4)]"
                >
                  Start free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href={GITHUB_REPO}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-void-400 px-8 py-4 text-lg font-medium text-text-secondary hover:text-text-primary transition-all"
                >
                  <Star className="w-5 h-5" />
                  Star on GitHub
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-void-300 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-sm text-text-muted">
            <span className="text-neon-green">BLACKVAULT</span> — built for the agent era.
          </div>
          <div className="flex items-center gap-6 text-sm text-text-muted">
            <a href={GITHUB_REPO} target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">
              GitHub
            </a>
            <Link href="/terms" className="hover:text-text-primary transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-text-primary transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
