"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock,
  ShieldCheck,
  Activity,
  Zap,
  Ban,
  ArrowRight,
  Terminal,
  Sparkles,
  Star,
  Plug,
  Gauge,
  Globe,
} from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";

const GITHUB_REPO = "https://github.com/venkat22022202/black-vault";

// ============================================
// ANIMATED TERMINAL — the firewall in action
// ============================================
const terminalLines = [
  { text: "$ agent → blackvault → api.github.com", color: "text-text-secondary", delay: 0 },
  { text: "  ● GET  /repos/octocat/app      200   injected ghp_•••• (key never seen by agent)", color: "text-neon-green", delay: 800 },
  { text: "  ● GET  /user                   200   allowed by policy", color: "text-neon-green", delay: 1600 },
  { text: "  ✖ POST https://attacker.com    BLOCKED  host not pinned — exfil attempt", color: "text-neon-red", delay: 2400 },
  { text: "  ✖ DELETE /repos/octocat/app    403   method not allowed (read-only token)", color: "text-neon-red", delay: 3200 },
  { text: "  ● GET  /repos/octocat/issues   200   allowed by policy", color: "text-neon-green", delay: 4000 },
];

function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = terminalLines.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay + 500)
    );
    const restartTimer = setTimeout(() => setVisibleLines(0), 6500);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(restartTimer);
    };
  }, [visibleLines === 0]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="rounded-xl border border-void-300 bg-void-50 overflow-hidden shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-void-300 bg-void-100">
          <div className="w-3 h-3 rounded-full bg-neon-red/80" />
          <div className="w-3 h-3 rounded-full bg-neon-amber/80" />
          <div className="w-3 h-3 rounded-full bg-neon-green/80" />
          <span className="ml-2 text-xs text-text-muted font-mono">blackvault — egress firewall</span>
        </div>
        <div className="p-4 font-mono text-[11px] sm:text-sm leading-relaxed min-h-[200px] overflow-x-auto">
          {terminalLines.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`${line.color} whitespace-nowrap`}
            >
              {line.text}
            </motion.div>
          ))}
          <span className="inline-block w-2 h-4 bg-neon-green ml-1 animate-terminal-blink" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEATURES — the real, shipped product
// ============================================
const features = [
  {
    icon: ShieldCheck,
    title: "Egress Firewall",
    description:
      "Give an agent your GitHub / Stripe / DB key through a scoped token. The host is pinned, methods and paths are allowlisted, and the secret is injected server-side — it can't be stolen or misused, even under prompt injection.",
    color: "text-neon-green",
  },
  {
    icon: Plug,
    title: "MCP Server",
    description:
      "A drop-in MCP server for Claude Desktop, Cursor, and Claude Code. Agents get governed, vaulted AI access — the config holds a bvt_ token, never a provider key.",
    color: "text-neon-cyan",
  },
  {
    icon: Lock,
    title: "Encrypted Vault",
    description:
      "AES-256-GCM with per-key derived keys. The secret is decrypted only in-flight and never returned to the agent. Proxy tokens are SHA-256 hashed before storage.",
    color: "text-neon-green",
  },
  {
    icon: Zap,
    title: "Universal Gateway",
    description:
      "One OpenAI-compatible endpoint for every provider. Auto-routes by model and translates tool calls and images across OpenAI, Anthropic, and Google.",
    color: "text-neon-purple",
  },
  {
    icon: Ban,
    title: "Instant Kill Switch",
    description:
      "Revoke a token, a key, or everything. Revocation invalidates the session cache, so a killed token fails on its very next call.",
    color: "text-neon-red",
  },
  {
    icon: Gauge,
    title: "Budget & Rate Caps",
    description:
      "Per-token spend caps and RPM/RPD limits, enforced atomically in real time — a burst of concurrent calls can't blow past the cap.",
    color: "text-neon-amber",
  },
];

// ============================================
// PAGE
// ============================================
export default function LandingPage() {
  const { data: publicStats } = trpc.stats.getPublicStats.useQuery();
  return (
    <div className="min-h-screen bg-void-0 overflow-hidden">
      {/* ====== NAV ====== */}
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

      {/* ====== HERO ====== */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-neon-green/5 blur-[120px]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-neon-green/30 bg-neon-green/5 px-4 py-1.5 text-xs font-medium text-neon-green">
              <Sparkles className="w-3 h-3 text-neon-green" />
              Open source · MIT · the credential firewall for AI agents
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 font-display text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            Arm your AI agents.
            <br />
            <span className="text-gradient-green">Never hand over the keys.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            Vault the secret. Hand the agent a scoped <span className="font-mono text-neon-green">bvt_</span> token.
            Cap it, audit it, and kill it in one click — and even if it&apos;s prompt-injected, it can&apos;t steal the
            key or misuse it.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 rounded-lg bg-neon-green px-8 py-3.5 text-base font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_30px_rgba(0,255,136,0.4)] animate-pulse-glow"
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
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="mt-16"
          >
            <AnimatedTerminal />
          </motion.div>
        </div>
      </section>

      {/* ====== STATS BAR ====== */}
      <section className="border-y border-void-300 bg-void-50/50">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { label: "Keys secured", value: (publicStats?.keys ?? 0).toLocaleString() },
            { label: "Providers", value: "OpenAI · Anthropic · Google · Nebius" },
            { label: "License", value: "MIT" },
            { label: "Hosting", value: "Self-host or deploy" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-base md:text-xl font-mono font-bold text-text-primary">{stat.value}</div>
              <div className="mt-1 text-sm text-text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ====== FEATURES ====== */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              The guardrails agents were missing.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative rounded-xl border border-void-300 bg-void-50 p-6 hover:border-void-400 transition-all duration-300"
              >
                <feature.icon className={`w-8 h-8 ${feature.color} mb-4`} />
                <h3 className="text-lg font-semibold text-text-primary mb-2">{feature.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="py-24 px-6 border-t border-void-300">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight">
              Three steps. <span className="text-gradient-green">Zero blast radius.</span>
            </h2>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Vault the secret",
                description:
                  "Add an API key or credential. It's encrypted with AES-256-GCM using a per-key derived key — and never returned to the agent.",
                icon: Lock,
              },
              {
                step: "02",
                title: "Mint a scoped token",
                description:
                  "Generate a bvt_ token per agent with a policy: allowed hosts, methods and paths, a budget cap, and rate limits.",
                icon: Globe,
              },
              {
                step: "03",
                title: "Ship it safely",
                description:
                  "The agent works through the token — it can't see, steal, or misuse the secret. Every call is audited, and one click kills it.",
                icon: ShieldCheck,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-xl border border-void-400 bg-void-100 flex items-center justify-center">
                  <span className="font-mono text-lg font-bold text-neon-green">{item.step}</span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-text-primary mb-1">{item.title}</h3>
                  <p className="text-text-secondary leading-relaxed">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ====== CTA ====== */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="relative rounded-2xl border border-void-300 bg-void-50 p-12 md:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-radial-fade opacity-50" />
            <div className="relative z-10">
              <Terminal className="w-12 h-12 text-neon-green mx-auto mb-6" />
              <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Give your agents real power, safely.
              </h2>
              <p className="text-lg text-text-secondary mb-8 max-w-lg mx-auto">
                Free during beta. Open source. Self-hostable. Set up in 2 minutes.
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

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-void-300 py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="font-mono text-sm text-text-muted">
            <span className="text-neon-green">BLACKVAULT</span> — Built for the agent era.
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
