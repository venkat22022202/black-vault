"use client";

import { motion } from "framer-motion";
import {
  Check,
  Sparkles,
  Zap,
  Lock,
  Activity,
  Shield,
  Bot,
  GitFork,
  Wifi,
  Gift,
} from "lucide-react";
import Link from "next/link";

const betaFeatures = [
  { icon: Lock, label: "Unlimited vault keys", color: "text-neon-green" },
  { icon: Wifi, label: "Proxy gateway with SSE streaming", color: "text-neon-cyan" },
  { icon: Shield, label: "Real-time kill switch", color: "text-neon-red" },
  { icon: Activity, label: "Live cost tracking per session", color: "text-neon-purple" },
  { icon: Bot, label: "Agent registry access", color: "text-neon-amber" },
  { icon: GitFork, label: "Workflow blueprints", color: "text-neon-green" },
];

export default function BillingPage() {
  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Gift className="w-6 h-6 text-neon-green" />
          Billing & Plans
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          You&apos;re on the free beta. All features are unlocked.
        </p>
      </div>

      {/* Beta Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-neon-green/30 bg-void-50 p-8 overflow-hidden"
      >
        <div className="absolute inset-0 bg-neon-green/5" />
        <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-neon-green/5 blur-[100px] -translate-y-1/2 translate-x-1/2" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-neon-green" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-text-primary">Beta Access</h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20">
                  ACTIVE
                </span>
              </div>
              <p className="text-sm text-text-muted">Everything unlocked. Zero cost.</p>
            </div>
          </div>

          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-5xl font-mono font-bold text-neon-green">$0</span>
            <span className="text-sm text-text-muted">during beta</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {betaFeatures.map((feature) => (
              <div key={feature.label} className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-md bg-void-200 flex items-center justify-center">
                  <feature.icon className={`w-3.5 h-3.5 ${feature.color}`} />
                </div>
                <span className="text-sm text-text-secondary">{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-void-300 bg-void-100 p-4">
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-neon-amber shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text-primary font-medium">
                  What happens after beta?
                </p>
                <p className="text-xs text-text-muted mt-1 leading-relaxed">
                  We&apos;ll introduce affordable plans with generous free tiers. Your data, keys, and proxy sessions will carry over. Early users get special pricing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* What's Included */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          Everything included in Beta
        </h3>
        <div className="space-y-3">
          {[
            "Unlimited API keys in vault",
            "AES-256-GCM encryption with per-user derived keys",
            "Proxy gateway for OpenAI, Anthropic, and Google AI",
            "Full SSE streaming support",
            "Per-session cost tracking and token counting",
            "Instant kill switch with session revocation",
            "Agent registry and community reviews",
            "Workflow blueprints — create, fork, and share",
            "Complete activity audit trail",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-sm text-text-secondary">
              <Check className="w-4 h-4 text-neon-green shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-4"
      >
        <h3 className="text-sm font-semibold text-text-primary">FAQ</h3>
        {[
          {
            q: "Is the beta really free?",
            a: "Yes. All features are fully unlocked at zero cost. No credit card, no catch.",
          },
          {
            q: "Will my data be safe after beta ends?",
            a: "Absolutely. All your encrypted keys, proxy sessions, and activity logs carry over to your account.",
          },
          {
            q: "How long does the beta last?",
            a: "We'll announce timelines as we approach launch. You'll get plenty of advance notice.",
          },
        ].map((item) => (
          <div key={item.q} className="rounded-lg border border-void-300 bg-void-50 p-4">
            <div className="text-sm font-medium text-text-primary mb-1">{item.q}</div>
            <div className="text-xs text-text-muted">{item.a}</div>
          </div>
        ))}
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="text-center py-4"
      >
        <Link
          href="/vault"
          className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-6 py-3 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
        >
          <Lock className="w-4 h-4" />
          Go to Vault
        </Link>
      </motion.div>
    </div>
  );
}
