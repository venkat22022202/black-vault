"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  Activity,
  Zap,
  ArrowUpRight,
  Key,
  Shield,
  Lock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

export default function DashboardPage() {
  const { data: keys, isLoading } = trpc.vault.getAll.useQuery();

  const totalKeys = keys?.length ?? 0;
  const activeKeys = keys?.filter((k) => k.isActive).length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Your AI agent command center. Everything at a glance.
        </p>
      </div>

      {/* Stats Cards - Real Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Vault Keys",
            value: isLoading ? "..." : String(totalKeys),
            icon: Key,
            color: "text-neon-green",
            borderColor: "border-neon-green/20",
            bgGlow: "bg-neon-green/5",
          },
          {
            label: "Active Keys",
            value: isLoading ? "..." : String(activeKeys),
            icon: Shield,
            color: "text-neon-cyan",
            borderColor: "border-neon-cyan/20",
            bgGlow: "bg-neon-cyan/5",
          },
          {
            label: "Providers",
            value: isLoading
              ? "..."
              : String(new Set(keys?.map((k) => k.provider)).size),
            icon: Activity,
            color: "text-neon-purple",
            borderColor: "border-neon-purple/20",
            bgGlow: "bg-neon-purple/5",
          },
          {
            label: "Plan",
            value: "Free",
            icon: Zap,
            color: "text-neon-amber",
            borderColor: "border-neon-amber/20",
            bgGlow: "bg-neon-amber/5",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={cn(
              "relative rounded-xl border bg-void-50 p-5 overflow-hidden",
              card.borderColor
            )}
          >
            <div className={cn("absolute inset-0 opacity-50", card.bgGlow)} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-muted">{card.label}</span>
                <card.icon className={cn("w-4 h-4", card.color)} />
              </div>
              <div className={cn("text-3xl font-mono font-bold", card.color)}>
                {isLoading && card.value === "..." ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  card.value
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Vault Keys */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Lock className="w-4 h-4 text-neon-green" />
              Recent Vault Keys
            </h2>
            <Link
              href="/vault"
              className="text-xs text-neon-green hover:underline"
            >
              View All
            </Link>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-neon-green animate-spin" />
            </div>
          ) : keys && keys.length > 0 ? (
            <div className="space-y-3">
              {keys.slice(0, 5).map((key, i) => (
                <motion.div
                  key={key.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 + i * 0.08 }}
                  className="flex items-center justify-between py-2 border-b border-void-300/50 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded bg-void-200 flex items-center justify-center">
                      <Key className="w-3 h-3 text-text-muted" />
                    </div>
                    <div>
                      <div className="text-sm text-text-primary">{key.label}</div>
                      <div className="text-xs text-text-muted font-mono">
                        {key.keyPrefix}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      key.isActive
                        ? "bg-neon-green/10 text-neon-green"
                        : "bg-void-300 text-text-muted"
                    )}
                  >
                    {key.isActive ? "Active" : "Off"}
                  </span>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Key className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted mb-3">No keys yet</p>
              <Link
                href="/vault"
                className="inline-flex items-center gap-1 text-xs text-neon-green hover:underline"
              >
                Add your first key <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </motion.div>

        {/* Getting Started / Cost Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-neon-purple" />
              Getting Started
            </h2>
          </div>

          <div className="space-y-4">
            {[
              {
                step: "01",
                title: "Add your API keys",
                description: "Store keys from OpenAI, Anthropic, Google, and more",
                done: totalKeys > 0,
                href: "/vault",
              },
              {
                step: "02",
                title: "Browse the agent registry",
                description: "Discover and review community AI agents",
                done: false,
                href: "/agents",
              },
              {
                step: "03",
                title: "Upgrade to Pro",
                description: "Unlock 50 keys, cost analytics, and budget alerts",
                done: false,
                href: "/billing",
              },
            ].map((item) => (
              <Link
                key={item.step}
                href={item.href}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-void-200/50 transition-colors group"
              >
                <div
                  className={cn(
                    "w-7 h-7 rounded-md flex items-center justify-center text-xs font-mono font-bold shrink-0",
                    item.done
                      ? "bg-neon-green/10 text-neon-green"
                      : "bg-void-200 text-text-muted"
                  )}
                >
                  {item.done ? "✓" : item.step}
                </div>
                <div>
                  <div
                    className={cn(
                      "text-sm font-medium",
                      item.done
                        ? "text-text-muted line-through"
                        : "text-text-primary"
                    )}
                  >
                    {item.title}
                  </div>
                  <div className="text-xs text-text-muted">{item.description}</div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-neon-green transition-colors ml-auto shrink-0 mt-0.5" />
              </Link>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {[
          {
            label: "Add API Key",
            href: "/vault",
            icon: Zap,
            description: "Encrypt and store a provider key",
          },
          {
            label: "Browse Agents",
            href: "/agents",
            icon: Activity,
            description: "Discover community AI agents",
          },
          {
            label: "Upgrade Plan",
            href: "/billing",
            icon: DollarSign,
            description: "Unlock Pro features",
          },
        ].map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="group flex items-center justify-between rounded-xl border border-void-300 bg-void-50 p-4 hover:border-void-400 hover:bg-void-100 transition-all"
          >
            <div className="flex items-center gap-3">
              <action.icon className="w-5 h-5 text-text-muted group-hover:text-neon-green transition-colors" />
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {action.label}
                </div>
                <div className="text-xs text-text-muted">{action.description}</div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-neon-green transition-colors" />
          </Link>
        ))}
      </motion.div>
    </div>
  );
}
