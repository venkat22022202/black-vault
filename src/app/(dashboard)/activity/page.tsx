"use client";

import { motion } from "framer-motion";
import { Activity, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { ACTIVITY_TYPES } from "@/lib/constants";

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "key", label: "Keys" },
  { key: "agent", label: "Agents" },
  { key: "review", label: "Reviews" },
  { key: "workflow", label: "Workflows" },
  { key: "killswitch", label: "Kill Switch" },
] as const;

export default function ActivityPage() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [limit, setLimit] = useState(20);

  const { data: activities, isLoading } = trpc.activity.getAll.useQuery({
    limit: limit + 20, // Fetch extra to know if there's more
    offset: 0,
  });

  const filtered =
    activeTab === "all"
      ? activities
      : activities?.filter((a) => a.type.startsWith(activeTab));

  const displayed = filtered?.slice(0, limit);
  const hasMore = (filtered?.length ?? 0) > limit;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Activity className="w-6 h-6 text-neon-cyan" />
          Activity Feed
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Everything that happens in your vault, tracked.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              activeTab === tab.key
                ? "bg-neon-green/10 text-neon-green"
                : "text-text-muted hover:text-text-primary hover:bg-void-200"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
        </div>
      )}

      {/* Activity List */}
      {!isLoading && displayed && displayed.length > 0 && (
        <div className="space-y-1">
          {displayed.map((item, i) => {
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
                className="flex items-start gap-4 rounded-xl border border-void-300 bg-void-50 p-4 hover:border-void-400 transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: actType.color + "15" }}
                >
                  <div className="w-4 h-4" style={{ color: actType.color }}>
                    {actType.icon}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {item.title}
                    </span>
                    <span
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: actType.color + "15",
                        color: actType.color,
                      }}
                    >
                      {actType.label}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-text-muted mt-0.5 truncate">
                      {item.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-text-muted shrink-0 mt-0.5">
                  {timeAgo}
                </span>
              </motion.div>
            );
          })}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={() => setLimit((l) => l + 20)}
                className="text-sm text-neon-green hover:underline"
              >
                Load more...
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!displayed || displayed.length === 0) && (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            No activity yet
          </h3>
          <p className="text-sm text-text-secondary">
            Start adding keys, browsing agents, or creating workflows to see activity here.
          </p>
        </div>
      )}
    </div>
  );
}
