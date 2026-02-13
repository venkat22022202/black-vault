"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  Plus,
  X,
  Flame,
  Clock,
  Trophy,
  Send,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Link from "next/link";

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

const CATEGORY_OPTIONS = [
  "Coding",
  "Research",
  "Design",
  "Writing",
  "Automation",
  "Voice",
  "Data",
  "Other",
];

const SORT_TABS = [
  { key: "trending" as const, label: "Trending", icon: Flame },
  { key: "newest" as const, label: "Newest", icon: Clock },
  { key: "top-rated" as const, label: "Top Rated", icon: Trophy },
];

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortTab, setSortTab] = useState<"trending" | "newest" | "top-rated">("trending");
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Submit form state
  const [submitName, setSubmitName] = useState("");
  const [submitPitch, setSubmitPitch] = useState("");
  const [submitDescription, setSubmitDescription] = useState("");
  const [submitLongDescription, setSubmitLongDescription] = useState("");
  const [submitCategory, setSubmitCategory] = useState("Coding");
  const [submitProvider, setSubmitProvider] = useState("");
  const [submitWebsiteUrl, setSubmitWebsiteUrl] = useState("");
  const [submitGithubUrl, setSubmitGithubUrl] = useState("");
  const [submitCost, setSubmitCost] = useState("");
  const [submitHowItWorks, setSubmitHowItWorks] = useState("");
  const [submitCapabilities, setSubmitCapabilities] = useState<string[]>([""]);
  const [submitPermissions, setSubmitPermissions] = useState<string[]>([]);
  const [submitTags, setSubmitTags] = useState("");

  const { data, isLoading } = trpc.agents.list.useQuery({
    search: search || undefined,
    category: activeCategory !== "All" ? activeCategory : undefined,
    sort: sortTab,
    limit: 20,
  });

  const { data: categories } = trpc.agents.getCategories.useQuery();
  const { data: myVotes } = trpc.agents.myVotes.useQuery(undefined, {
    retry: false,
  });
  const utils = trpc.useUtils();

  const upvoteMutation = trpc.agents.upvote.useMutation({
    onSuccess: (result) => {
      utils.agents.list.invalidate();
      utils.agents.myVotes.invalidate();
      toast.success(result.voted ? "Upvoted!" : "Vote removed");
    },
    onError: () => toast.error("Sign in to vote"),
  });

  const submitMutation = trpc.agents.submit.useMutation({
    onSuccess: () => {
      toast.success("Agent submitted!");
      setShowSubmitModal(false);
      resetSubmitForm();
      utils.agents.list.invalidate();
      utils.agents.getCategories.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  function resetSubmitForm() {
    setSubmitName("");
    setSubmitPitch("");
    setSubmitDescription("");
    setSubmitLongDescription("");
    setSubmitCategory("Coding");
    setSubmitProvider("");
    setSubmitWebsiteUrl("");
    setSubmitGithubUrl("");
    setSubmitCost("");
    setSubmitHowItWorks("");
    setSubmitCapabilities([""]);
    setSubmitPermissions([]);
    setSubmitTags("");
  }

  function handleSubmitAgent(e: React.FormEvent) {
    e.preventDefault();
    submitMutation.mutate({
      name: submitName,
      pitch: submitPitch,
      description: submitDescription,
      longDescription: submitLongDescription || undefined,
      category: submitCategory,
      provider: submitProvider,
      websiteUrl: submitWebsiteUrl || undefined,
      githubUrl: submitGithubUrl || undefined,
      avgCostPerRun: submitCost || undefined,
      howItWorks: submitHowItWorks || undefined,
      capabilities: submitCapabilities.filter((c) => c.trim()),
      permissionsRequired: submitPermissions,
      tags: submitTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  const categoryNames = ["All", ...(categories?.map((c) => c.name) ?? [])];
  const agents = data?.agents ?? [];

  return (
    <div className="space-y-6">
      {/* Header + Submit CTA */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Bot className="w-6 h-6 text-neon-purple" />
            Agent Showcase
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Discover, rate, and review AI agents. Community-driven trust scores.
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 transition-all shadow-[0_0_15px_rgba(0,255,136,0.1)] hover:shadow-[0_0_25px_rgba(0,255,136,0.2)]"
        >
          <Plus className="w-4 h-4" />
          Submit Your Agent
        </button>
      </div>

      {/* Sort Tabs */}
      <div className="flex items-center gap-1 rounded-lg bg-void-100 border border-void-300 p-1 w-fit">
        {SORT_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setSortTab(tab.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                sortTab === tab.key
                  ? "bg-neon-purple/15 text-neon-purple"
                  : "text-text-muted hover:text-text-secondary"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search + Category Filters */}
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
                <div className="flex items-start justify-between mb-2">
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
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
                  </Link>
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

                {/* Pitch preview */}
                {agent.pitch && (
                  <p className="text-xs italic text-neon-purple/70 mb-2 line-clamp-1">
                    &ldquo;{agent.pitch}&rdquo;
                  </p>
                )}

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
                    onClick={(e) => {
                      e.preventDefault();
                      upvoteMutation.mutate({ agentId: agent.id });
                    }}
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
                  <Link
                    href={`/agents/${agent.slug}`}
                    className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-neon-purple transition-colors ml-auto"
                  >
                    View Profile
                    <ExternalLink className="w-3 h-3" />
                  </Link>
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
              : "Be the first to submit an agent!"}
          </p>
        </div>
      )}

      {/* Result count */}
      {!isLoading && data && data.total > 0 && (
        <div className="text-center text-xs text-text-muted">
          Showing {agents.length} of {data.total} agents
        </div>
      )}

      {/* Submit Modal */}
      <AnimatePresence>
        {showSubmitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSubmitModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-void-300 bg-void-50 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                  <Plus className="w-5 h-5 text-neon-green" />
                  Submit Your Agent
                </h2>
                <button
                  onClick={() => setShowSubmitModal(false)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitAgent} className="space-y-4">
                {/* Name + Provider */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Agent Name *</label>
                    <input
                      type="text"
                      value={submitName}
                      onChange={(e) => setSubmitName(e.target.value)}
                      placeholder="e.g. My Cool Agent"
                      required
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Provider *</label>
                    <input
                      type="text"
                      value={submitProvider}
                      onChange={(e) => setSubmitProvider(e.target.value)}
                      placeholder="e.g. OpenAI, Community"
                      required
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                    />
                  </div>
                </div>

                {/* Pitch */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">
                    First-Person Pitch * <span className="text-text-muted/50">(Speak as the agent)</span>
                  </label>
                  <textarea
                    value={submitPitch}
                    onChange={(e) => setSubmitPitch(e.target.value)}
                    placeholder={`I'm [Agent Name]. Give me a [task] and I'll [what you do]...`}
                    required
                    minLength={10}
                    rows={2}
                    className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none resize-none"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">Short Description *</label>
                  <input
                    type="text"
                    value={submitDescription}
                    onChange={(e) => setSubmitDescription(e.target.value)}
                    placeholder="One-line description of what the agent does"
                    required
                    minLength={10}
                    className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                  />
                </div>

                {/* Long Description */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">Long Description</label>
                  <textarea
                    value={submitLongDescription}
                    onChange={(e) => setSubmitLongDescription(e.target.value)}
                    placeholder="Detailed overview of the agent's capabilities and use cases..."
                    rows={3}
                    className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none resize-none"
                  />
                </div>

                {/* Category + Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Category *</label>
                    <select
                      value={submitCategory}
                      onChange={(e) => setSubmitCategory(e.target.value)}
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary focus:border-neon-purple focus:outline-none"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Avg Cost per Run</label>
                    <input
                      type="text"
                      value={submitCost}
                      onChange={(e) => setSubmitCost(e.target.value)}
                      placeholder="0.10"
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                    />
                  </div>
                </div>

                {/* Capabilities */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">Capabilities</label>
                  {submitCapabilities.map((cap, i) => (
                    <div key={i} className="flex gap-2 mb-1.5">
                      <input
                        type="text"
                        value={cap}
                        onChange={(e) => {
                          const next = [...submitCapabilities];
                          next[i] = e.target.value;
                          setSubmitCapabilities(next);
                        }}
                        placeholder="e.g. Multi-file code editing"
                        className="flex-1 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                      />
                      {submitCapabilities.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSubmitCapabilities(submitCapabilities.filter((_, j) => j !== i))
                          }
                          className="text-text-muted hover:text-neon-red"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {submitCapabilities.length < 10 && (
                    <button
                      type="button"
                      onClick={() => setSubmitCapabilities([...submitCapabilities, ""])}
                      className="text-xs text-neon-purple hover:underline"
                    >
                      + Add capability
                    </button>
                  )}
                </div>

                {/* How It Works */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">How It Works</label>
                  <textarea
                    value={submitHowItWorks}
                    onChange={(e) => setSubmitHowItWorks(e.target.value)}
                    placeholder="Explain the agent's approach and methodology..."
                    rows={3}
                    className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none resize-none"
                  />
                </div>

                {/* URLs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-text-muted block mb-1">Website URL</label>
                    <input
                      type="url"
                      value={submitWebsiteUrl}
                      onChange={(e) => setSubmitWebsiteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted block mb-1">GitHub URL</label>
                    <input
                      type="url"
                      value={submitGithubUrl}
                      onChange={(e) => setSubmitGithubUrl(e.target.value)}
                      placeholder="https://github.com/..."
                      className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                    />
                  </div>
                </div>

                {/* Permissions */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">Permissions Required</label>
                  <div className="flex flex-wrap gap-2">
                    {["filesystem", "network", "shell", "docker", "audio", "camera"].map(
                      (perm) => (
                        <button
                          key={perm}
                          type="button"
                          onClick={() =>
                            setSubmitPermissions((prev) =>
                              prev.includes(perm)
                                ? prev.filter((p) => p !== perm)
                                : [...prev, perm]
                            )
                          }
                          className={cn(
                            "rounded-lg px-3 py-1 text-xs font-medium transition-all border",
                            submitPermissions.includes(perm)
                              ? "bg-neon-purple/15 text-neon-purple border-neon-purple/30"
                              : "bg-void-100 text-text-muted border-void-300 hover:border-void-400"
                          )}
                        >
                          {perm}
                        </button>
                      )
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <label className="text-xs text-text-muted block mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={submitTags}
                    onChange={(e) => setSubmitTags(e.target.value)}
                    placeholder="coding, open-source, cli"
                    className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 transition-all disabled:opacity-50"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit Agent
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
