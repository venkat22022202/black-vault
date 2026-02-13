"use client";

import { motion } from "framer-motion";
import {
  GitFork,
  Star,
  ArrowLeft,
  User,
  Calendar,
  Code,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Link from "next/link";
import { use } from "react";

export default function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data: workflow, isLoading } = trpc.workflows.getBySlug.useQuery({ slug });
  const { data: myStars } = trpc.workflows.myStars.useQuery();
  const utils = trpc.useUtils();

  const starMutation = trpc.workflows.star.useMutation({
    onSuccess: () => {
      utils.workflows.getBySlug.invalidate({ slug });
      utils.workflows.myStars.invalidate();
    },
  });

  const forkMutation = trpc.workflows.fork.useMutation({
    onSuccess: () => {
      utils.workflows.list.invalidate();
      toast.success("Workflow forked successfully!");
    },
    onError: () => toast.error("Failed to fork workflow"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="text-center py-24">
        <h2 className="text-xl font-bold text-text-primary mb-2">
          Workflow not found
        </h2>
        <Link href="/workflows" className="text-sm text-neon-green hover:underline">
          Back to Workflows
        </Link>
      </div>
    );
  }

  const isStarred = myStars?.includes(workflow.id) ?? false;
  const createdDate = new Date(workflow.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/workflows"
        className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Workflows
      </Link>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {workflow.name}
            </h1>
            {workflow.description && (
              <p className="text-sm text-text-secondary mt-2">
                {workflow.description}
              </p>
            )}

            {/* Author */}
            <div className="flex items-center gap-2 mt-4">
              {workflow.author.avatarUrl ? (
                <img
                  src={workflow.author.avatarUrl}
                  alt=""
                  className="w-6 h-6 rounded-full"
                />
              ) : (
                <User className="w-6 h-6 text-text-muted" />
              )}
              <span className="text-sm text-text-secondary">
                {workflow.author.displayName}
              </span>
              <span className="text-text-muted">·</span>
              <span className="text-xs text-text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {createdDate}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => starMutation.mutate({ workflowId: workflow.id })}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                isStarred
                  ? "border-neon-amber/30 bg-neon-amber/5 text-neon-amber"
                  : "border-void-300 text-text-secondary hover:border-void-400"
              )}
            >
              <Star className={cn("w-4 h-4", isStarred && "fill-current")} />
              {isStarred ? "Starred" : "Star"} ({workflow.totalStars})
            </button>
            <button
              onClick={() => forkMutation.mutate({ workflowId: workflow.id })}
              disabled={forkMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-4 py-2 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all disabled:opacity-50"
            >
              {forkMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <GitFork className="w-4 h-4" />
              )}
              Fork ({workflow.totalForks})
            </button>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 rounded-xl border border-void-300 bg-void-50 p-5"
        >
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-4">
            <Code className="w-4 h-4 text-neon-green" />
            Workflow Config
          </h2>
          <pre className="rounded-lg bg-void-200 border border-void-300 p-4 text-xs font-mono text-text-secondary overflow-x-auto max-h-[500px] overflow-y-auto">
            {JSON.stringify(workflow.config, null, 2)}
          </pre>
        </motion.div>

        {/* Stats Sidebar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          {/* Stats */}
          <div className="rounded-xl border border-void-300 bg-void-50 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">Stats</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center gap-2">
                  <Star className="w-3.5 h-3.5" /> Stars
                </span>
                <span className="font-mono text-text-primary">{workflow.totalStars}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted flex items-center gap-2">
                  <GitFork className="w-3.5 h-3.5" /> Forks
                </span>
                <span className="font-mono text-text-primary">{workflow.totalForks}</span>
              </div>
              {workflow.estimatedCost !== null && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Est. Cost/Run</span>
                  <span className="font-mono text-neon-green">${workflow.estimatedCost}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Version</span>
                <span className="font-mono text-text-primary">v{workflow.version}</span>
              </div>
            </div>
          </div>

          {/* Providers */}
          {workflow.providersUsed.length > 0 && (
            <div className="rounded-xl border border-void-300 bg-void-50 p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">
                Providers Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {workflow.providersUsed.map((p) => (
                  <span
                    key={p}
                    className="text-xs font-mono px-2.5 py-1 rounded-lg border"
                    style={{
                      borderColor: (PROVIDERS[p as ProviderId]?.color ?? "#888") + "40",
                      color: PROVIDERS[p as ProviderId]?.color ?? "#888",
                      backgroundColor: (PROVIDERS[p as ProviderId]?.color ?? "#888") + "10",
                    }}
                  >
                    {PROVIDERS[p as ProviderId]?.name ?? p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {workflow.tags.length > 0 && (
            <div className="rounded-xl border border-void-300 bg-void-50 p-5">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {workflow.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-xs px-2.5 py-1 rounded-lg bg-void-200 text-text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
