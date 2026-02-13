import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-void-0 bg-grid">
      <div className="bg-radial-fade absolute inset-0 pointer-events-none" />
      <div className="relative z-10">
        <div className="mb-8 text-center">
          <h1 className="font-mono text-3xl font-bold tracking-tight text-neon-green">
            BLACKVAULT
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Your AI agents. Under control.
          </p>
        </div>
        <SignIn afterSignInUrl="/dashboard" />
      </div>
    </div>
  );
}
