"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Lock,
  ShieldCheck,
  Plug,
  Settings,
  Gift,
  Menu,
  X,
  Activity,
  Sparkles,
  Star,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

const GITHUB_REPO = "https://github.com/venkat22022202/black-vault";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vault", href: "/vault", icon: Lock },
  { label: "Firewall", href: "/firewall", icon: ShieldCheck },
  { label: "MCP", href: "/mcp", icon: Plug },
  { label: "Activity", href: "/activity", icon: Activity },
  { label: "Billing", href: "/billing", icon: Gift },
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
  const keyCount = keys?.length ?? 0;

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
          <div className="flex items-center gap-2.5">
            <Link
              href="/dashboard"
              className="font-mono text-lg font-bold tracking-tight text-neon-green"
            >
              BLACKVAULT
            </Link>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
              BETA
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            className="press flex items-center gap-1.5 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-neon-green hover:border-neon-green/40"
          >
            <Star className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Star on GitHub</span>
          </a>
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
                  "press flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
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
          <div className="rounded-lg border border-neon-green/20 bg-neon-green/5 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-neon-green" />
              <span className="text-xs font-semibold text-neon-green">Beta</span>
            </div>
            <div className="text-xs text-text-secondary">All features unlocked</div>
            <div className="text-xs text-text-muted mt-0.5">{keyCount} keys stored</div>
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
