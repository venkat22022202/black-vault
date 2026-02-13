"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// MOCK DATA (replace with tRPC queries later)
// ============================================
const costCards = [
  {
    label: "Today",
    amount: 4.23,
    change: 12,
    trend: "up" as const,
    color: "text-neon-green",
    borderColor: "border-neon-green/20",
    bgGlow: "bg-neon-green/5",
  },
  {
    label: "This Week",
    amount: 28.91,
    change: -3,
    trend: "down" as const,
    color: "text-neon-purple",
    borderColor: "border-neon-purple/20",
    bgGlow: "bg-neon-purple/5",
  },
  {
    label: "This Month",
    amount: 127.44,
    change: 8,
    trend: "up" as const,
    color: "text-neon-cyan",
    borderColor: "border-neon-cyan/20",
    bgGlow: "bg-neon-cyan/5",
  },
];

const providerSpend = [
  { name: "Anthropic", amount: 52.1, percentage: 41, color: "bg-[#D4A574]" },
  { name: "OpenAI", amount: 41.3, percentage: 32, color: "bg-[#10A37F]" },
  { name: "Google AI", amount: 22.04, percentage: 17, color: "bg-[#4285F4]" },
  { name: "Replicate", amount: 12.0, percentage: 10, color: "bg-white/80" },
];

const recentActivity = [
  {
    time: "12:04:23",
    provider: "Claude 3.5",
    agent: "research-agent",
    tokens: 1247,
    cost: 0.003,
    color: "text-neon-green",
  },
  {
    time: "12:04:21",
    provider: "GPT-4o",
    agent: "code-review",
    tokens: 892,
    cost: 0.002,
    color: "text-neon-purple",
  },
  {
    time: "12:03:58",
    provider: "Gemini 2",
    agent: "summarizer",
    tokens: 2100,
    cost: 0.001,
    color: "text-neon-cyan",
  },
  {
    time: "12:03:45",
    provider: "Claude 3.5",
    agent: "writing-agent",
    tokens: 430,
    cost: 0.001,
    color: "text-neon-green",
  },
  {
    time: "12:03:30",
    provider: "GPT-4o",
    agent: "data-analysis",
    tokens: 1580,
    cost: 0.004,
    color: "text-neon-purple",
  },
  {
    time: "12:03:12",
    provider: "Claude 3.5",
    agent: "research-agent",
    tokens: 890,
    cost: 0.002,
    color: "text-neon-green",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-sm text-text-secondary mt-1">
          Real-time overview of your AI agent activity and spend.
        </p>
      </div>

      {/* Cost Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {costCards.map((card, i) => (
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
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    card.trend === "up" ? "text-neon-green" : "text-neon-red"
                  )}
                >
                  {card.trend === "up" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(card.change)}%
                </div>
              </div>
              <div className={cn("text-3xl font-mono font-bold", card.color)}>
                ${card.amount.toFixed(2)}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Provider */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-neon-green" />
              Spend by Provider
            </h2>
            <span className="text-xs text-text-muted">This month</span>
          </div>

          <div className="space-y-4">
            {providerSpend.map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-text-secondary">{p.name}</span>
                  <span className="text-sm font-mono text-text-primary">
                    ${p.amount.toFixed(2)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-void-300 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${p.percentage}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={cn("h-full rounded-full", p.color)}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Live Activity */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-cyan" />
              Live Activity
            </h2>
            <span className="flex items-center gap-1.5 text-xs text-neon-green">
              <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
              Live
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            {recentActivity.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.08 }}
                className="flex items-center gap-3 py-1.5 border-b border-void-300/50 last:border-0"
              >
                <span className="text-text-muted w-16 shrink-0">
                  {item.time}
                </span>
                <span className={cn("w-20 shrink-0 truncate", item.color)}>
                  {item.provider}
                </span>
                <span className="text-text-secondary truncate flex-1">
                  {item.agent}
                </span>
                <span className="text-text-muted shrink-0">
                  {item.tokens.toLocaleString()} tok
                </span>
                <span className="text-text-primary shrink-0 w-14 text-right">
                  ${item.cost.toFixed(3)}
                </span>
              </motion.div>
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
            description: "Secure a new provider key",
          },
          {
            label: "Browse Agents",
            href: "/agents",
            icon: Activity,
            description: "Discover community agents",
          },
          {
            label: "Set Budget Alert",
            href: "/settings",
            icon: DollarSign,
            description: "Get notified before limits",
          },
        ].map((action) => (
          <a
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
                <div className="text-xs text-text-muted">
                  {action.description}
                </div>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-text-muted group-hover:text-neon-green transition-colors" />
          </a>
        ))}
      </motion.div>
    </div>
  );
}
