"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Star,
  ArrowUp,
  ExternalLink,
  Search,
  TrendingUp,
  Shield,
  Sparkles,
  Loader2,
  Github,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// Color map for providers
const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: "#D4A574",
  Cursor: "#8B5CF6",
  Perplexity: "#06B6D4",
  Cognition: "#10A37F",
  Community: "#F59E0B",
  Vercel: "#FFFFFF",
  Codeium: "#09B6A2",
  StackBlitz: "#1389FD",
  Lovable: "#FF6B6B",
  Jasper: "#EC4899",
  Midjourney: "#7C3AED",
  ElevenLabs: "#6C63FF",
  Replit: "#F26207",
};

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const { data, isLoading } = trpc.agents.list.useQuery({
    search: search || undefined,
    category: activeCategory !== "All" ? activeCategory : undefined,
    limit: 20,
  });

  const { data: categories } = trpc.agents.getCategories.useQuery();
  const { data: myVotes } = trpc.agents.myVotes.useQuery();
  const utils = trpc.useUtils();

  const upvoteMutation = trpc.agents.upvote.useMutation({
    onSuccess: (result) => {
      utils.agents.list.invalidate();
      utils.agents.myVotes.invalidate();
      toast.success(result.voted ? "Upvoted!" : "Vote removed");
    },
    onError: () => toast.error("Failed to vote"),
  });

  const categoryNames = ["All", ...(categories?.map((c) => c.name) ?? [])];

  const agents = data?.agents ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Bot className="w-6 h-6 text-neon-purple" />
          Agent Registry
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Discover, rate, and review AI agents. Community-driven trust scores.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full rounded-lg border border-void-300 bg-void-100 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none focus:ring-1 focus:ring-neon-purple/30"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                activeCategory === cat
                  ? "bg-neon-purple/15 text-neon-purple border border-neon-purple/30"
                  : "bg-void-100 text-text-muted border border-void-300 hover:border-void-400 hover:text-text-secondary"
              )}
            >
              {cat}
              {cat !== "All" && categories?.find((c) => c.name === cat) && (
                <span className="ml-1 text-text-muted">
                  ({categories.find((c) => c.name === cat)!.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neon-purple animate-spin" />
        </div>
      )}

      {/* Agent Grid */}
      {!isLoading && agents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {agents.map((agent, i) => {
            const color = PROVIDER_COLORS[agent.provider ?? ""] ?? "#888888";
            const hasVoted = myVotes?.includes(agent.id);

            return (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="group rounded-xl border border-void-300 bg-void-50 p-5 hover:border-void-400 transition-all"
              >
                {/* Top row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: color + "20",
                        color: color,
                      }}
                    >
                      {agent.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">
                          {agent.name}
                        </span>
                        {agent.isVerified && (
                          <Shield className="w-3.5 h-3.5 text-neon-green" />
                        )}
                        {agent.isFeatured && (
                          <Sparkles className="w-3.5 h-3.5 text-neon-amber" />
                        )}
                      </div>
                      <div className="text-xs text-text-muted">{agent.provider}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-neon-amber fill-neon-amber" />
                    <span className="text-sm font-mono font-semibold text-text-primary">
                      {agent.trustScore.toFixed(1)}
                    </span>
                    <span className="text-xs text-text-muted">
                      ({agent.totalReviews.toLocaleString()})
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-text-secondary leading-relaxed mb-3 line-clamp-2">
                  {agent.description}
                </p>

                {/* Meta */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted mb-3">
                  {agent.avgCostPerRun != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      ${agent.avgCostPerRun}/run
                    </span>
                  )}
                  {agent.category && (
                    <span className="rounded-full bg-void-200 px-2 py-0.5">
                      {agent.category}
                    </span>
                  )}
                  {agent.permissionsRequired.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="rounded-full bg-void-200 px-2 py-0.5"
                    >
                      {p}
                    </span>
                  ))}
                </div>

                {/* Tags */}
                {agent.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {agent.tags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] rounded bg-void-200 px-1.5 py-0.5 text-text-muted"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-3 pt-3 border-t border-void-300/50">
                  <button
                    onClick={() => upvoteMutation.mutate({ agentId: agent.id })}
                    disabled={upvoteMutation.isPending}
                    className={cn(
                      "flex items-center gap-1.5 text-xs transition-colors",
                      hasVoted
                        ? "text-neon-green"
                        : "text-text-muted hover:text-neon-green"
                    )}
                  >
                    <ArrowUp className={cn("w-3.5 h-3.5", hasVoted && "fill-neon-green")} />
                    {agent.totalUpvotes.toLocaleString()}
                  </button>
                  {agent.githubUrl && (
                    <a
                      href={agent.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
                    >
                      <Github className="w-3.5 h-3.5" />
                      GitHub
                    </a>
                  )}
                  {agent.websiteUrl && (
                    <a
                      href={agent.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors ml-auto"
                    >
                      Visit
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && agents.length === 0 && (
        <div className="text-center py-16">
          <Bot className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            {search ? "No agents match your search" : "No agents yet"}
          </h3>
          <p className="text-sm text-text-secondary">
            {search
              ? "Try a different search term or category"
              : "Check back soon for community AI agents."}
          </p>
        </div>
      )}

      {/* Result count */}
      {!isLoading && data && data.total > 0 && (
        <div className="text-center text-xs text-text-muted">
          Showing {agents.length} of {data.total} agents
        </div>
      )}
    </div>
  );
}
