import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-void-0 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-8xl font-mono font-bold text-neon-green mb-4 opacity-80">
          404
        </div>
        <h1 className="text-2xl font-bold text-text-primary mb-2">
          Lost in the void
        </h1>
        <p className="text-text-secondary mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-6 py-3 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
