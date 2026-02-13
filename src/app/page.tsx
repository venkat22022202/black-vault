"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Lock,
  DollarSign,
  Activity,
  Shield,
  Zap,
  Eye,
  Bot,
  GitFork,
  ArrowRight,
  Terminal,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";

// ============================================
// ANIMATED TERMINAL
// ============================================
const terminalLines = [
  { text: "$ blackvault watch", color: "text-text-secondary", delay: 0 },
  {
    text: '  ● claude-3.5  │ research-agent  │ 1,247 tok │ $0.003  │ "analyzing paper..."',
    color: "text-neon-green",
    delay: 800,
  },
  {
    text: '  ● gpt-4o      │ code-review     │   892 tok │ $0.002  │ "reviewing PR #47..."',
    color: "text-neon-purple",
    delay: 1600,
  },
  {
    text: '  ● gemini-2     │ summarize-docs  │ 2,100 tok │ $0.001  │ "condensing report..."',
    color: "text-neon-cyan",
    delay: 2400,
  },
  {
    text: "  ⚠ gpt-4o      │ code-review     │ BUDGET 82% │ $67.89/$100",
    color: "text-neon-amber",
    delay: 3200,
  },
  {
    text: '  ● claude-3.5  │ writing-agent   │   430 tok │ $0.001  │ "drafting email..."',
    color: "text-neon-green",
    delay: 4000,
  },
];

function AnimatedTerminal() {
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    const timers = terminalLines.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay + 500)
    );
    // Loop the animation
    const resetTimer = setTimeout(() => setVisibleLines(0), 6000);
    const restartTimer = setTimeout(() => {
      setVisibleLines(0);
      // Re-trigger
    }, 6500);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(resetTimer);
      clearTimeout(restartTimer);
    };
  }, [visibleLines === 0]);

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      <div className="rounded-xl border border-void-300 bg-void-50 overflow-hidden shadow-2xl">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-void-300 bg-void-100">
          <div className="w-3 h-3 rounded-full bg-neon-red/80" />
          <div className="w-3 h-3 rounded-full bg-neon-amber/80" />
          <div className="w-3 h-3 rounded-full bg-neon-green/80" />
          <span className="ml-2 text-xs text-text-muted font-mono">
            blackvault — agent monitor
          </span>
        </div>
        {/* Terminal body */}
        <div className="p-4 font-mono text-sm leading-relaxed min-h-[220px]">
          {terminalLines.slice(0, visibleLines).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={`${line.color} whitespace-nowrap overflow-hidden`}
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
// ANIMATED COUNTER
// ============================================
function AnimatedCounter({ target, prefix = "$" }: { target: number; prefix?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(current);
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [target]);

  return (
    <span className="font-mono">
      {prefix}
      {count.toFixed(2)}
    </span>
  );
}

// ============================================
// FEATURES
// ============================================
const features = [
  {
    icon: Lock,
    title: "Encrypted Vault",
    description:
      "AES-256-GCM encrypted storage for all your API keys. Per-user derived keys. Zero-knowledge architecture.",
    color: "text-neon-green",
    glow: "group-hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]",
  },
  {
    icon: DollarSign,
    title: "Cost Tracking",
    description:
      "Real-time spend across OpenAI, Anthropic, Google, and every provider. Budget alerts before you blow through limits.",
    color: "text-neon-purple",
    glow: "group-hover:shadow-[0_0_30px_rgba(139,92,246,0.15)]",
  },
  {
    icon: Activity,
    title: "Live Activity",
    description:
      "Watch every API call, every token, every dollar in real-time. Know exactly what your agents are doing.",
    color: "text-neon-cyan",
    glow: "group-hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]",
  },
  {
    icon: Shield,
    title: "Kill Switch",
    description:
      "Instantly revoke any agent's access. Set permission scopes. Rate limit per agent. Sleep easy.",
    color: "text-neon-red",
    glow: "group-hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
  },
  {
    icon: Bot,
    title: "Agent Registry",
    description:
      "Discover, rate, and review AI agents. Trust scores based on community audits. Know before you install.",
    color: "text-neon-amber",
    glow: "group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]",
  },
  {
    icon: GitFork,
    title: "Workflow Blueprints",
    description:
      "Share and fork agent workflows. One-click deploy community setups. Stop rebuilding from scratch.",
    color: "text-neon-green",
    glow: "group-hover:shadow-[0_0_30px_rgba(0,255,136,0.15)]",
  },
];

// ============================================
// STAT PILLS
// ============================================
const stats = [
  { label: "API Keys Secured", value: "12,847" },
  { label: "Cost Saved", value: "$284K" },
  { label: "Agents Tracked", value: "3,291" },
  { label: "Rogue Agents Killed", value: "847" },
];

// ============================================
// PAGE
// ============================================
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-void-0 overflow-hidden">
      {/* ====== NAV ====== */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-mono text-xl font-bold tracking-tight text-neon-green">
            BLACKVAULT
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
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
        {/* Background effects */}
        <div className="absolute inset-0 bg-grid opacity-50" />
        <div className="absolute inset-0 bg-radial-fade" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-neon-green/5 blur-[120px]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-void-400 bg-void-100 px-4 py-1.5 text-xs font-medium text-text-secondary">
              <Sparkles className="w-3 h-3 text-neon-green" />
              The agent era needs a control tower
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-8 font-display text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95]"
          >
            Your AI agents.
            <br />
            <span className="text-gradient-green">Under control.</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-6 text-lg md:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            Manage every API key. Track every dollar. Watch every agent.
            <br />
            One dashboard to rule them all.
          </motion.p>

          {/* CTAs */}
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
              Start Free
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-void-400 px-8 py-3.5 text-base font-medium text-text-secondary hover:text-text-primary hover:border-void-500 transition-all"
            >
              <Eye className="w-4 h-4" />
              See How It Works
            </a>
          </motion.div>

          {/* Terminal */}
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
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-mono font-bold text-text-primary">
                {stat.value}
              </div>
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
              Everything you need.
              <br />
              <span className="text-text-muted">Nothing you don&apos;t.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`group relative rounded-xl border border-void-300 bg-void-50 p-6 hover:border-void-400 transition-all duration-300 ${feature.glow}`}
              >
                <feature.icon className={`w-8 h-8 ${feature.color} mb-4`} />
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {feature.description}
                </p>
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
              Three steps. <span className="text-gradient-green">Total control.</span>
            </h2>
          </div>

          <div className="space-y-12">
            {[
              {
                step: "01",
                title: "Connect your providers",
                description:
                  "Add your API keys from OpenAI, Anthropic, Google, and 20+ other providers. AES-256 encrypted, zero-knowledge.",
                icon: Lock,
              },
              {
                step: "02",
                title: "See everything in real-time",
                description:
                  "Watch costs tick up live. See which agents are burning tokens. Get alerts before you hit budget limits.",
                icon: Activity,
              },
              {
                step: "03",
                title: "Take control",
                description:
                  "Kill rogue agents instantly. Scope permissions per agent. Share workflows with your team.",
                icon: Zap,
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
                  <span className="font-mono text-lg font-bold text-neon-green">
                    {item.step}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-text-primary mb-1">
                    {item.title}
                  </h3>
                  <p className="text-text-secondary leading-relaxed">
                    {item.description}
                  </p>
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
                Ready to take control?
              </h2>
              <p className="text-lg text-text-secondary mb-8 max-w-lg mx-auto">
                Free forever for 3 API keys. No credit card required. Set up in 2 minutes.
              </p>
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 rounded-lg bg-neon-green px-8 py-4 text-lg font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_40px_rgba(0,255,136,0.4)]"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
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
            <a href="https://github.com/venkat22022202/black-vault" className="hover:text-text-primary transition-colors">
              GitHub
            </a>
            <a href="#" className="hover:text-text-primary transition-colors">
              Docs
            </a>
            <a href="#" className="hover:text-text-primary transition-colors">
              Twitter
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
