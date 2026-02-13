"use client";

import Link from "next/link";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-24 px-6">
      <div className="text-center max-w-md">
        <div className="text-5xl font-mono font-bold text-neon-red mb-4 opacity-80">
          ERROR
        </div>
        <h1 className="text-xl font-bold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-text-secondary mb-6 text-sm">
          An unexpected error occurred in the dashboard.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-neon-green px-5 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-void-300 px-5 py-2.5 text-sm text-text-secondary hover:bg-void-200 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
