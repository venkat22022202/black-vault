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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const categories = [
  "All",
  "Coding",
  "Research",
  "Writing",
  "Design",
  "Automation",
  "Data",
];

const mockAgents = [
  {
    id: "1",
    name: "Claude Code",
    slug: "claude-code",
    description:
      "Autonomous coding agent by Anthropic. Reads, writes, and debugs code across entire codebases.",
    category: "Coding",
    provider: "Anthropic",
    trustScore: 4.6,
    totalReviews: 2341,
    totalUpvotes: 1247,
    avgCost: "$0.12/task",
    permissions: ["filesystem", "network", "shell"],
    isVerified: true,
    isFeatured: true,
    color: "#D4A574",
  },
  {
    id: "2",
    name: "Cursor Agent",
    slug: "cursor-agent",
    description:
      "AI-powered code editor agent. Context-aware completions and multi-file editing with deep codebase understanding.",
    category: "Coding",
    provider: "Cursor",
    trustScore: 4.8,
    totalReviews: 1823,
    totalUpvotes: 987,
    avgCost: "$0.08/task",
    permissions: ["filesystem", "network"],
    isVerified: true,
    isFeatured: true,
    color: "#8B5CF6",
  },
  {
    id: "3",
    name: "Perplexity Deep Research",
    slug: "perplexity-research",
    description:
      "Deep web research agent. Multi-step search, source verification, and comprehensive report generation.",
    category: "Research",
    provider: "Perplexity",
    trustScore: 4.3,
    totalReviews: 945,
    totalUpvotes: 623,
    avgCost: "$0.05/query",
    permissions: ["network"],
    isVerified: true,
    isFeatured: false,
    color: "#06B6D4",
  },
  {
    id: "4",
    name: "Devin",
    slug: "devin",
    description:
      "Fully autonomous software engineer. Plans, codes, tests, and deploys complete features independently.",
    category: "Coding",
    provider: "Cognition",
    trustScore: 3.9,
    totalReviews: 1567,
    totalUpvotes: 445,
    avgCost: "$2.50/task",
    permissions: ["filesystem", "network", "shell", "docker"],
    isVerified: true,
    isFeatured: false,
    color: "#10A37F",
  },
  {
    id: "5",
    name: "GPT Researcher",
    slug: "gpt-researcher",
    description:
      "Open-source autonomous research agent. Generates detailed reports from multiple web sources with citations.",
    category: "Research",
    provider: "Community",
    trustScore: 4.1,
    totalReviews: 678,
    totalUpvotes: 412,
    avgCost: "$0.15/report",
    permissions: ["network"],
    isVerified: false,
    isFeatured: false,
    color: "#F59E0B",
  },
  {
    id: "6",
    name: "Jasper AI Writer",
    slug: "jasper-writer",
    description:
      "Enterprise writing agent. Blog posts, marketing copy, social media content with brand voice matching.",
    category: "Writing",
    provider: "Jasper",
    trustScore: 4.0,
    totalReviews: 534,
    totalUpvotes: 289,
    avgCost: "$0.03/piece",
    permissions: ["network"],
    isVerified: true,
    isFeatured: false,
    color: "#EC4899",
  },
];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = mockAgents.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      activeCategory === "All" || a.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

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
          {categories.map((cat) => (
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
            </button>
          ))}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map((agent, i) => (
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
                    backgroundColor: agent.color + "20",
                    color: agent.color,
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
                  {agent.trustScore}
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
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mb-3">
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {agent.avgCost}
              </span>
              <span className="rounded-full bg-void-200 px-2 py-0.5">
                {agent.category}
              </span>
              {agent.permissions.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-void-200 px-2 py-0.5"
                >
                  {p}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-3 border-t border-void-300/50">
              <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-green transition-colors">
                <ArrowUp className="w-3.5 h-3.5" />
                {agent.totalUpvotes.toLocaleString()}
              </button>
              <button className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors ml-auto">
                View Details
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
