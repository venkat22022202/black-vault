"use client";

import { motion } from "framer-motion";
import {
  GitFork,
  Star,
  Plus,
  Search,
  Loader2,
  User,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Link from "next/link";

// ============================================
// CREATE WORKFLOW MODAL
// ============================================
function CreateWorkflowModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [configJson, setConfigJson] = useState("{}");
  const [providers, setProviders] = useState("");
  const [tags, setTags] = useState("");
  const utils = trpc.useUtils();

  const createWorkflow = trpc.workflows.create.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      toast.success("Workflow created!");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create workflow");
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configJson);
    } catch {
      toast.error("Invalid JSON config");
      return;
    }

    createWorkflow.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      config,
      providersUsed: providers
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-xl border border-void-300 bg-void-50 p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
          <GitFork className="w-5 h-5 text-neon-green" />
          Create Workflow
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Research → Summarize → Draft"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Config (JSON)
            </label>
            <textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={6}
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-xs text-text-primary font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Providers (comma-separated)
            </label>
            <input
              type="text"
              value={providers}
              onChange={(e) => setProviders(e.target.value)}
              placeholder="openai, anthropic"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="research, automation"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-void-300 px-4 py-2.5 text-sm text-text-secondary hover:bg-void-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={createWorkflow.isPending}
            className="flex-1 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createWorkflow.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Publish Workflow
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// WORKFLOWS PAGE
// ============================================
export default function WorkflowsPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"popular" | "newest" | "most-forked">("popular");

  const { data, isLoading } = trpc.workflows.list.useQuery({
    search: search || undefined,
    sort,
    limit: 50,
  });
  const { data: myStars } = trpc.workflows.myStars.useQuery();
  const utils = trpc.useUtils();

  const starMutation = trpc.workflows.star.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      utils.workflows.myStars.invalidate();
    },
  });

  const forkMutation = trpc.workflows.fork.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      toast.success("Workflow forked!");
    },
    onError: () => toast.error("Failed to fork workflow"),
  });

  const starredSet = new Set(myStars ?? []);
  const workflows = data?.workflows ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <GitFork className="w-6 h-6 text-neon-green" />
            Workflow Blueprints
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Share and fork agent workflows. Stop rebuilding from scratch.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows..."
            className="w-full rounded-lg border border-void-300 bg-void-100 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
          />
        </div>
        <div className="flex items-center gap-2">
          {(["popular", "newest", "most-forked"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                sort === s
                  ? "bg-neon-green/10 text-neon-green"
                  : "text-text-muted hover:text-text-primary hover:bg-void-200"
              )}
            >
              {s === "popular" ? "Popular" : s === "newest" ? "Newest" : "Most Forked"}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
        </div>
      )}

      {/* Workflow Grid */}
      {!isLoading && workflows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workflows.map((workflow, i) => (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="rounded-xl border border-void-300 bg-void-50 p-5 hover:border-void-400 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <Link
                  href={`/workflows/${workflow.slug}`}
                  className="text-sm font-semibold text-text-primary hover:text-neon-green transition-colors"
                >
                  {workflow.name}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => starMutation.mutate({ workflowId: workflow.id })}
                    className={cn(
                      "flex items-center gap-1 text-xs p-1 rounded hover:bg-void-200 transition-colors",
                      starredSet.has(workflow.id) ? "text-neon-amber" : "text-text-muted"
                    )}
                  >
                    <Star className={cn("w-3.5 h-3.5", starredSet.has(workflow.id) && "fill-current")} />
                    {workflow.totalStars}
                  </button>
                  <button
                    onClick={() => forkMutation.mutate({ workflowId: workflow.id })}
                    disabled={forkMutation.isPending}
                    className="flex items-center gap-1 text-xs text-text-muted p-1 rounded hover:bg-void-200 hover:text-text-primary transition-colors"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    {workflow.totalForks}
                  </button>
                </div>
              </div>

              {workflow.description && (
                <p className="text-xs text-text-muted mb-3 line-clamp-2">
                  {workflow.description}
                </p>
              )}

              {/* Provider badges */}
              {workflow.providersUsed.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {workflow.providersUsed.map((p) => (
                    <span
                      key={p}
                      className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-void-300 text-text-muted"
                      style={{
                        borderColor: (PROVIDERS[p as ProviderId]?.color ?? "#888") + "40",
                        color: PROVIDERS[p as ProviderId]?.color ?? "#888",
                      }}
                    >
                      {PROVIDERS[p as ProviderId]?.name ?? p}
                    </span>
                  ))}
                </div>
              )}

              {/* Tags */}
              {workflow.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-void-200 text-text-muted"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Author */}
              <div className="flex items-center gap-2 pt-3 border-t border-void-300/50">
                {workflow.author.avatarUrl ? (
                  <img
                    src={workflow.author.avatarUrl}
                    alt=""
                    className="w-5 h-5 rounded-full"
                  />
                ) : (
                  <User className="w-5 h-5 text-text-muted" />
                )}
                <span className="text-xs text-text-muted">
                  {workflow.author.displayName}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && workflows.length === 0 && (
        <div className="text-center py-16">
          <GitFork className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            {search ? "No workflows match your search" : "No workflows yet"}
          </h3>
          <p className="text-sm text-text-secondary mb-6">
            {search
              ? "Try a different search term"
              : "Be the first to publish a workflow blueprint!"}
          </p>
          {!search && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-6 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              Create First Workflow
            </button>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateWorkflowModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}
