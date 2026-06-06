"use client";

import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ArrowUpRight,
  Key,
  Shield,
  Lock,
  Loader2,
  Calendar,
  Clock,
  AlertTriangle,
  Wifi,
  Hash,
  ShieldCheck,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import Link from "next/link";
import { PROVIDERS, type ProviderId } from "@/lib/constants";
import { ACTIVITY_TYPES } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function DashboardPage() {
  const { data: keys, isLoading } = trpc.vault.getAll.useQuery();
  const { data: dailyCost } = trpc.cost.getDailySummary.useQuery();
  const { data: weeklyCost } = trpc.cost.getWeeklySummary.useQuery();
  const { data: monthlyCost } = trpc.cost.getMonthlySummary.useQuery();
  const { data: providerCosts } = trpc.cost.getByProvider.useQuery();
  const { data: recentActivity } = trpc.activity.getRecent.useQuery({ limit: 5 });
  const { data: killStatus } = trpc.killswitch.getStatus.useQuery();
  const { data: lastSynced } = trpc.cost.getLastSynced.useQuery();
  const { data: proxyUsage } = trpc.proxy.getKeyUsageSummary.useQuery();

  const totalKeys = keys?.length ?? 0;
  const activeKeys = keys?.filter((k) => k.isActive).length ?? 0;
  const planLabel = "Beta";

  const lastRequestAgo = lastSynced?.lastSynced
    ? (() => {
        const diff = Date.now() - new Date(lastSynced.lastSynced).getTime();
        if (diff < 60000) return "just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
      })()
    : null;

  // Prepare chart data
  const chartData = (providerCosts ?? []).map((p) => ({
    name: PROVIDERS[p.provider as ProviderId]?.name ?? p.provider,
    cost: p.total,
    color: PROVIDERS[p.provider as ProviderId]?.color ?? "#888888",
  }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-1">
            Your AI agent command center. Everything at a glance.
          </p>
        </div>
        {lastRequestAgo && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            Last proxy request: {lastRequestAgo}
          </div>
        )}
      </div>

      {/* Proxy Cost Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: "Proxy Cost Today",
            value: dailyCost?.today ?? 0,
            change: dailyCost?.changePercent ?? 0,
            icon: DollarSign,
            color: "text-neon-green",
            borderColor: "border-neon-green/20",
            bgGlow: "bg-neon-green/5",
          },
          {
            label: "This Week",
            value: weeklyCost?.total ?? 0,
            change: null,
            icon: Calendar,
            color: "text-neon-purple",
            borderColor: "border-neon-purple/20",
            bgGlow: "bg-neon-purple/5",
          },
          {
            label: "This Month",
            value: monthlyCost?.total ?? 0,
            change: null,
            icon: TrendingUp,
            color: "text-neon-cyan",
            borderColor: "border-neon-cyan/20",
            bgGlow: "bg-neon-cyan/5",
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
                ${card.value.toFixed(2)}
              </div>
              {card.change !== null && card.change !== 0 && (
                <div className={cn(
                  "flex items-center gap-1 mt-2 text-xs",
                  card.change > 0 ? "text-neon-red" : "text-neon-green"
                )}>
                  {card.change > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(card.change)}% vs yesterday
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Vault Keys",
            value: isLoading ? "..." : String(totalKeys),
            icon: Key,
            color: "text-neon-green",
            borderColor: "border-neon-green/20",
          },
          {
            label: "Active Keys",
            value: isLoading ? "..." : String(activeKeys),
            icon: Shield,
            color: "text-neon-cyan",
            borderColor: "border-neon-cyan/20",
          },
          {
            label: "Providers",
            value: isLoading
              ? "..."
              : String(new Set(keys?.map((k) => k.provider)).size),
            icon: Activity,
            color: "text-neon-purple",
            borderColor: "border-neon-purple/20",
          },
          {
            label: "Plan",
            value: planLabel,
            icon: Zap,
            color: "text-neon-amber",
            borderColor: "border-neon-amber/20",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.08 }}
            className={cn(
              "rounded-xl border bg-void-50 p-4 overflow-hidden",
              card.borderColor
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">{card.label}</span>
              <card.icon className={cn("w-3.5 h-3.5", card.color)} />
            </div>
            <div className={cn("text-2xl font-mono font-bold", card.color)}>
              {isLoading && card.value === "..." ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                card.value
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Proxy Usage Card */}
      {proxyUsage && proxyUsage.totalSessions > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          className="rounded-xl border border-neon-cyan/20 bg-void-50 p-5 relative overflow-hidden"
        >
          <div className="absolute inset-0 opacity-50 bg-neon-cyan/5" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Wifi className="w-4 h-4 text-neon-cyan" />
                Proxy Gateway
              </h2>
              <Link
                href="/vault"
                className="text-xs text-neon-cyan hover:underline"
              >
                Manage Sessions
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-text-muted mb-1">Active Sessions</div>
                <div className="text-xl font-mono font-bold text-neon-cyan">
                  {proxyUsage.activeSessions}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">Total Requests</div>
                <div className="text-xl font-mono font-bold text-text-primary flex items-center gap-1">
                  <Hash className="w-3.5 h-3.5 text-text-muted" />
                  {proxyUsage.totalRequests.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">Tokens Used</div>
                <div className="text-xl font-mono font-bold text-neon-purple">
                  {proxyUsage.totalTokens >= 1000000
                    ? `${(proxyUsage.totalTokens / 1000000).toFixed(1)}M`
                    : proxyUsage.totalTokens >= 1000
                      ? `${(proxyUsage.totalTokens / 1000).toFixed(1)}K`
                      : proxyUsage.totalTokens}
                </div>
              </div>
              <div>
                <div className="text-xs text-text-muted mb-1">Proxy Cost</div>
                <div className="text-xl font-mono font-bold text-neon-green">
                  ${proxyUsage.totalCost.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spend by Provider Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-neon-purple" />
              Spend by Provider
            </h2>
            <span className="text-xs text-text-muted">Last 30 days</span>
          </div>

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#888", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#888", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1a1a2e",
                    border: "1px solid #333",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}`, "Spend"]}
                />
                <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DollarSign className="w-8 h-8 text-text-muted mb-2" />
              <p className="text-sm text-text-muted">No proxy usage yet</p>
              <p className="text-xs text-text-muted mt-1">Generate a proxy token in the Vault to start tracking costs</p>
            </div>
          )}
        </motion.div>

        {/* Activity Feed */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Activity className="w-4 h-4 text-neon-cyan" />
              Recent Activity
            </h2>
            <Link
              href="/activity"
              className="text-xs text-neon-green hover:underline"
            >
              View All
            </Link>
          </div>

          {recentActivity && recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((item, i) => {
                const actType = ACTIVITY_TYPES[item.type] ?? ACTIVITY_TYPES.default;
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(item.createdAt).getTime();
                  if (diff < 60000) return "just now";
                  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                  return `${Math.floor(diff / 86400000)}d ago`;
                })();

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 + i * 0.08 }}
                    className="flex items-start gap-3 py-2 border-b border-void-300/50 last:border-0"
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                      style={{ backgroundColor: actType.color + "15" }}
                    >
                      <div className="w-3 h-3" style={{ color: actType.color }}>
                        {actType.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-text-primary truncate">{item.title}</div>
                      {item.description && (
                        <div className="text-xs text-text-muted truncate">{item.description}</div>
                      )}
                    </div>
                    <span className="text-xs text-text-muted shrink-0">{timeAgo}</span>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Activity className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-sm text-text-muted mb-1">No activity yet</p>
              <p className="text-xs text-text-muted">Actions you take will appear here</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom row: Recent Keys + Kill Switch Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Vault Keys */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.6 }}
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
                  transition={{ duration: 0.3, delay: 0.6 + i * 0.08 }}
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

        {/* Kill Switch Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
          className="rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-neon-red" />
              Kill Switch Status
            </h2>
            <Link
              href="/vault"
              className="text-xs text-neon-green hover:underline"
            >
              Manage
            </Link>
          </div>

          {killStatus ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-void-100 border border-void-300">
                  <div className="text-2xl font-mono font-bold text-text-primary">
                    {killStatus.total}
                  </div>
                  <div className="text-xs text-text-muted mt-1">Total</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-neon-green/5 border border-neon-green/20">
                  <div className="text-2xl font-mono font-bold text-neon-green">
                    {killStatus.active}
                  </div>
                  <div className="text-xs text-text-muted mt-1">Active</div>
                </div>
                <div className="text-center p-3 rounded-lg bg-neon-red/5 border border-neon-red/20">
                  <div className="text-2xl font-mono font-bold text-neon-red">
                    {killStatus.disabled}
                  </div>
                  <div className="text-xs text-text-muted mt-1">Disabled</div>
                </div>
              </div>
              <p className="text-xs text-text-muted text-center">
                Use the Kill Switch in the Vault to instantly revoke all active keys.
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-neon-red animate-spin" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
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
            label: "Egress Firewall",
            href: "/firewall",
            icon: ShieldCheck,
            description: "Broker a credential to an agent",
          },
          {
            label: "Connect via MCP",
            href: "/mcp",
            icon: Plug,
            description: "Use in Claude Desktop, Cursor, Cline",
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
