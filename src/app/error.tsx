"use client";

export default function RootError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-void-0 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl font-mono font-bold text-neon-red mb-4 opacity-80">
          ERROR
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Something went wrong
        </h1>
        <p className="text-text-secondary mb-8">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-6 py-3 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
