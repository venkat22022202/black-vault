"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Lock,
  Bot,
  Settings,
  CreditCard,
  Menu,
  X,
  GitFork,
  Activity,
  DollarSign,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vault", href: "/vault", icon: Lock },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Workflows", href: "/workflows", icon: GitFork },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Billing", href: "/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: keys } = trpc.vault.getAll.useQuery();
  const { data: dbUser } = trpc.user.me.useQuery();
  const { data: costSummary } = trpc.cost.getDailySummary.useQuery();
  const keyCount = keys?.length ?? 0;
  const plan = dbUser?.plan ?? "free";
  const maxKeys = plan === "team" ? 999 : plan === "pro" ? 50 : 3;
  const planLabel = plan === "team" ? "Team" : plan === "pro" ? "Pro" : "Free";

  return (
    <div className="min-h-screen bg-void-0">
      {/* Top Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 glass flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-void-200 text-text-secondary"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <Link
            href="/dashboard"
            className="font-mono text-lg font-bold tracking-tight text-neon-green"
          >
            BLACKVAULT
          </Link>
        </div>
        <div className="flex items-center gap-4">
          {costSummary && costSummary.today > 0 && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-xs font-mono">
              <DollarSign className="w-3 h-3 text-neon-purple" />
              <span className="text-neon-purple font-semibold">
                ${costSummary.today.toFixed(2)}
              </span>
              <span className="text-text-muted">today</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-xs font-mono">
            <span className="text-text-muted">Keys:</span>
            <span className="text-neon-green font-semibold">{keyCount}</span>
          </div>
          <UserButton
            appearance={{
              elements: {
                avatarBox: "w-8 h-8",
              },
            }}
          />
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-14 left-0 bottom-0 w-56 border-r border-void-300 bg-void-50 z-40 transition-transform duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-neon-green/10 text-neon-green"
                    : "text-text-secondary hover:text-text-primary hover:bg-void-200"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-4 left-3 right-3">
          <div className="rounded-lg border border-void-300 bg-void-100 p-3">
            <div className="text-xs text-text-muted mb-1">{planLabel} Plan</div>
            <div className="text-xs text-text-secondary">{keyCount} / {maxKeys === 999 ? "\u221e" : maxKeys} keys used</div>
            <div className="mt-2 h-1.5 rounded-full bg-void-300 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  keyCount >= maxKeys ? "bg-neon-amber" : "bg-neon-green"
                )}
                style={{ width: `${Math.min((keyCount / maxKeys) * 100, 100)}%` }}
              />
            </div>
            <Link
              href="/billing"
              className="mt-2 block text-xs text-neon-green hover:underline"
            >
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:pl-56 pt-14 min-h-screen">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
