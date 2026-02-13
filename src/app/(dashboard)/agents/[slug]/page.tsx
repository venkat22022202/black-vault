"use client";

import { motion } from "framer-motion";
import {
  Bot,
  Star,
  ArrowUp,
  ArrowLeft,
  ExternalLink,
  Shield,
  Sparkles,
  Loader2,
  Github,
  Zap,
  MessageSquare,
  DollarSign,
  Lock,
  Tag,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  Send,
  X,
} from "lucide-react";
import { useState, use } from "react";
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

function StarRating({
  rating,
  onRate,
  size = "sm",
}: {
  rating: number;
  onRate?: (r: number) => void;
  size?: "sm" | "md";
}) {
  const iconSize = size === "md" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onRate?.(s)}
          disabled={!onRate}
          className={cn(!onRate && "cursor-default")}
        >
          <Star
            className={cn(
              iconSize,
              s <= rating
                ? "text-neon-amber fill-neon-amber"
                : "text-void-400"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [reviewSort, setReviewSort] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewPros, setReviewPros] = useState<string[]>([""]);
  const [reviewCons, setReviewCons] = useState<string[]>([""]);

  const { data: agent, isLoading } = trpc.agents.getBySlug.useQuery({ slug });
  const { data: myVotes } = trpc.agents.myVotes.useQuery(undefined, {
    retry: false,
  });
  const { data: reviewsData } = trpc.reviews.list.useQuery(
    { agentId: agent?.id ?? "", sort: reviewSort },
    { enabled: !!agent?.id }
  );
  const { data: myReview } = trpc.reviews.myReview.useQuery(
    { agentId: agent?.id ?? "" },
    { enabled: !!agent?.id, retry: false }
  );

  const utils = trpc.useUtils();

  const upvoteMutation = trpc.agents.upvote.useMutation({
    onSuccess: (result) => {
      utils.agents.getBySlug.invalidate({ slug });
      utils.agents.myVotes.invalidate();
      toast.success(result.voted ? "Upvoted!" : "Vote removed");
    },
    onError: () => toast.error("Sign in to vote"),
  });

  const submitReviewMutation = trpc.reviews.submit.useMutation({
    onSuccess: () => {
      toast.success("Review submitted!");
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewTitle("");
      setReviewBody("");
      setReviewPros([""]);
      setReviewCons([""]);
      utils.reviews.list.invalidate();
      utils.reviews.myReview.invalidate();
      utils.agents.getBySlug.invalidate({ slug });
    },
    onError: (err) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 text-neon-purple animate-spin" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="text-center py-32">
        <Bot className="w-16 h-16 text-text-muted mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-text-primary mb-2">Agent not found</h2>
        <Link href="/agents" className="text-sm text-neon-purple hover:underline">
          Back to all agents
        </Link>
      </div>
    );
  }

  const color = PROVIDER_COLORS[agent.provider ?? ""] ?? "#888888";
  const hasVoted = myVotes?.includes(agent.id);
  const capabilities = agent.capabilities ?? [];

  function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (reviewRating === 0) {
      toast.error("Please select a rating");
      return;
    }
    submitReviewMutation.mutate({
      agentId: agent!.id,
      rating: reviewRating,
      title: reviewTitle,
      body: reviewBody,
      pros: reviewPros.filter((p) => p.trim()),
      cons: reviewCons.filter((c) => c.trim()),
    });
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        All Agents
      </Link>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          {/* Agent Avatar + Info */}
          <div className="flex-1">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center text-lg font-bold"
                style={{
                  backgroundColor: color + "20",
                  color: color,
                }}
              >
                {agent.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-text-primary">{agent.name}</h1>
                  {agent.isVerified && (
                    <Shield className="w-5 h-5 text-neon-green" />
                  )}
                  {agent.isFeatured && (
                    <Sparkles className="w-5 h-5 text-neon-amber" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span
                    className="text-xs font-medium rounded-full px-2.5 py-0.5"
                    style={{
                      backgroundColor: color + "20",
                      color: color,
                    }}
                  >
                    {agent.provider}
                  </span>
                  {agent.category && (
                    <span className="text-xs text-text-muted bg-void-200 rounded-full px-2.5 py-0.5">
                      {agent.category}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              {agent.longDescription ?? agent.description}
            </p>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => upvoteMutation.mutate({ agentId: agent.id })}
                disabled={upvoteMutation.isPending}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all border",
                  hasVoted
                    ? "bg-neon-green/10 border-neon-green/30 text-neon-green"
                    : "bg-void-100 border-void-300 text-text-secondary hover:border-neon-green/30 hover:text-neon-green"
                )}
              >
                <ArrowUp className={cn("w-4 h-4", hasVoted && "fill-neon-green")} />
                Upvote ({agent.totalUpvotes.toLocaleString()})
              </button>
              {agent.websiteUrl && (
                <a
                  href={agent.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-void-100 border border-void-300 text-text-secondary hover:border-void-400 hover:text-text-primary transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Website
                </a>
              )}
              {agent.githubUrl && (
                <a
                  href={agent.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-void-100 border border-void-300 text-text-secondary hover:border-void-400 hover:text-text-primary transition-all"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              )}
            </div>
          </div>

          {/* Stats Sidebar */}
          <div className="md:w-64 rounded-lg border border-void-300 bg-void-100 p-4 space-y-4">
            <div>
              <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Trust Score</div>
              <div className="flex items-center gap-2">
                <StarRating rating={Math.round(agent.trustScore)} />
                <span className="text-lg font-bold font-mono text-text-primary">
                  {agent.trustScore.toFixed(1)}
                </span>
              </div>
              <div className="text-xs text-text-muted mt-0.5">
                {agent.totalReviews.toLocaleString()} reviews
              </div>
            </div>
            {agent.avgCostPerRun != null && (
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Avg Cost</div>
                <div className="flex items-center gap-1.5 text-sm text-text-primary">
                  <DollarSign className="w-3.5 h-3.5 text-neon-green" />
                  ${agent.avgCostPerRun}/run
                </div>
              </div>
            )}
            {(agent.permissionsRequired as string[]).length > 0 && (
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Permissions</div>
                <div className="flex flex-wrap gap-1">
                  {(agent.permissionsRequired as string[]).map((p) => (
                    <span
                      key={p}
                      className="flex items-center gap-1 text-xs rounded bg-void-200 px-2 py-0.5 text-text-muted"
                    >
                      <Lock className="w-2.5 h-2.5" />
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {(agent.tags ?? []).length > 0 && (
              <div>
                <div className="text-xs text-text-muted uppercase tracking-wider mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {(agent.tags ?? []).map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-xs rounded bg-void-200 px-2 py-0.5 text-text-muted"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* First-Person Pitch */}
      {agent.pitch && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border border-neon-purple/20 bg-neon-purple/5 p-6"
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-neon-purple" />
            <span className="text-xs font-medium uppercase tracking-wider text-neon-purple">
              In Their Own Words
            </span>
          </div>
          <blockquote className="text-base italic text-text-primary leading-relaxed">
            &ldquo;{agent.pitch}&rdquo;
          </blockquote>
        </motion.div>
      )}

      {/* What I Can Do — Capabilities */}
      {capabilities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Zap className="w-5 h-5 text-neon-green" />
            What I Can Do
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {capabilities.map((cap: string, i: number) => (
              <div
                key={i}
                className="rounded-lg border border-void-300 bg-void-50 p-4 hover:border-neon-green/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-6 h-6 rounded-full bg-neon-green/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-3 h-3 text-neon-green" />
                  </div>
                  <span className="text-sm text-text-secondary">{cap}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* How I Work */}
      {agent.howItWorks && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-void-300 bg-void-50 p-6"
        >
          <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Bot className="w-5 h-5 text-neon-cyan" />
            How I Work
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {agent.howItWorks}
          </p>
        </motion.div>
      )}

      {/* Reviews Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Star className="w-5 h-5 text-neon-amber" />
            Reviews ({reviewsData?.total ?? 0})
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={reviewSort}
              onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
              className="text-xs rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-text-secondary focus:outline-none focus:border-neon-purple"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest Rated</option>
              <option value="lowest">Lowest Rated</option>
            </select>
            {!myReview && (
              <button
                onClick={() => setShowReviewForm(!showReviewForm)}
                className="text-xs rounded-lg bg-neon-green/10 border border-neon-green/30 px-3 py-1.5 text-neon-green font-medium hover:bg-neon-green/20 transition-colors"
              >
                Write a Review
              </button>
            )}
          </div>
        </div>

        {/* Write Review Form */}
        {showReviewForm && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            onSubmit={handleSubmitReview}
            className="rounded-xl border border-void-300 bg-void-50 p-5 mb-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text-primary">Write Your Review</h3>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rating */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Rating *</label>
              <StarRating rating={reviewRating} onRate={setReviewRating} size="md" />
            </div>

            {/* Title */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Title *</label>
              <input
                type="text"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                placeholder="Summarize your experience..."
                required
                minLength={3}
                className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none"
              />
            </div>

            {/* Body */}
            <div>
              <label className="text-xs text-text-muted block mb-1">Review *</label>
              <textarea
                value={reviewBody}
                onChange={(e) => setReviewBody(e.target.value)}
                placeholder="Share your detailed experience..."
                required
                minLength={10}
                rows={4}
                className="w-full rounded-lg border border-void-300 bg-void-100 px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-neon-purple focus:outline-none resize-none"
              />
            </div>

            {/* Pros */}
            <div>
              <label className="text-xs text-text-muted block mb-1 flex items-center gap-1">
                <ThumbsUp className="w-3 h-3 text-neon-green" /> Pros
              </label>
              {reviewPros.map((pro, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input
                    type="text"
                    value={pro}
                    onChange={(e) => {
                      const next = [...reviewPros];
                      next[i] = e.target.value;
                      setReviewPros(next);
                    }}
                    placeholder="Something great about this agent..."
                    className="flex-1 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none"
                  />
                  {reviewPros.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReviewPros(reviewPros.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-neon-red"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {reviewPros.length < 5 && (
                <button
                  type="button"
                  onClick={() => setReviewPros([...reviewPros, ""])}
                  className="text-xs text-neon-green hover:underline"
                >
                  + Add pro
                </button>
              )}
            </div>

            {/* Cons */}
            <div>
              <label className="text-xs text-text-muted block mb-1 flex items-center gap-1">
                <ThumbsDown className="w-3 h-3 text-neon-red" /> Cons
              </label>
              {reviewCons.map((con, i) => (
                <div key={i} className="flex gap-2 mb-1.5">
                  <input
                    type="text"
                    value={con}
                    onChange={(e) => {
                      const next = [...reviewCons];
                      next[i] = e.target.value;
                      setReviewCons(next);
                    }}
                    placeholder="Something that could be better..."
                    className="flex-1 rounded-lg border border-void-300 bg-void-100 px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-red focus:outline-none"
                  />
                  {reviewCons.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setReviewCons(reviewCons.filter((_, j) => j !== i))}
                      className="text-text-muted hover:text-neon-red"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {reviewCons.length < 5 && (
                <button
                  type="button"
                  onClick={() => setReviewCons([...reviewCons, ""])}
                  className="text-xs text-neon-red hover:underline"
                >
                  + Add con
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={submitReviewMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-neon-green/10 border border-neon-green/30 px-4 py-2 text-sm font-medium text-neon-green hover:bg-neon-green/20 transition-colors disabled:opacity-50"
            >
              {submitReviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit Review
            </button>
          </motion.form>
        )}

        {/* Review List */}
        {reviewsData && reviewsData.reviews.length > 0 ? (
          <div className="space-y-3">
            {reviewsData.reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-void-300 bg-void-50 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {review.user.avatarUrl ? (
                      <img
                        src={review.user.avatarUrl}
                        alt=""
                        className="w-7 h-7 rounded-full"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-void-200 flex items-center justify-center text-xs text-text-muted">
                        {review.user.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-text-primary">
                        {review.user.displayName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <StarRating rating={review.rating} />
                        <span className="text-xs text-text-muted">
                          {new Date(review.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {review.title && (
                  <h4 className="text-sm font-semibold text-text-primary mb-1">
                    {review.title}
                  </h4>
                )}
                {review.body && (
                  <p className="text-sm text-text-secondary leading-relaxed mb-3">
                    {review.body}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  {review.pros.length > 0 && (
                    <div className="flex-1">
                      {review.pros.map((pro, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-neon-green mb-0.5">
                          <ThumbsUp className="w-3 h-3" />
                          {pro}
                        </div>
                      ))}
                    </div>
                  )}
                  {review.cons.length > 0 && (
                    <div className="flex-1">
                      {review.cons.map((con, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-neon-red mb-0.5">
                          <ThumbsDown className="w-3 h-3" />
                          {con}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 rounded-xl border border-void-300 bg-void-50">
            <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">No reviews yet. Be the first to review!</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
