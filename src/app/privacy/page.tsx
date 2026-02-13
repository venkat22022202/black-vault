import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | BlackVault",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-void-0">
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-mono text-xl font-bold tracking-tight text-neon-green">
            BLACKVAULT
          </Link>
          <Link href="/" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
            Back to Home
          </Link>
        </div>
      </nav>

      <main className="pt-28 pb-20 px-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Privacy Policy</h1>
        <p className="text-sm text-text-muted mb-10">Last updated: February 2025</p>

        <div className="space-y-8">
          <Section title="1. Overview">
            <p>
              BlackVault is designed with privacy as a core principle. This policy explains what data we collect,
              how we protect it, and what we do (and don&apos;t do) with it.
            </p>
            <div className="rounded-lg border border-neon-green/20 bg-neon-green/5 p-4 mt-3">
              <p className="text-sm text-neon-green font-medium">
                TL;DR: Your API keys are AES-256-GCM encrypted. We cannot read them at rest. We don&apos;t sell your data. We don&apos;t track you with third-party analytics.
              </p>
            </div>
          </Section>

          <Section title="2. Data We Collect">
            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Account Data</h3>
            <ul>
              <li>Email address (via Clerk authentication)</li>
              <li>Display name, bio, and GitHub URL (optional, user-provided)</li>
              <li>Account creation date</li>
            </ul>

            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Vault Data</h3>
            <ul>
              <li>Encrypted API keys (AES-256-GCM, per-user derived keys — we cannot read the plaintext)</li>
              <li>Key metadata: provider name, label, active status, creation date</li>
              <li>Key prefix (first few characters) for identification in the UI</li>
            </ul>

            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Proxy Data</h3>
            <ul>
              <li>Proxy session metadata: label, creation date, expiry, active status</li>
              <li>Token hash (SHA-256 — the plaintext token is never stored)</li>
              <li>Per-request logs: provider, model, endpoint, HTTP status, token counts, estimated cost, latency</li>
              <li>IP address and User-Agent of proxy requests (for device info display and security)</li>
            </ul>

            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Activity Data</h3>
            <ul>
              <li>Audit log of actions taken in the Service (key created, session killed, etc.)</li>
            </ul>
          </Section>

          <Section title="3. Data We Do NOT Collect">
            <ul>
              <li>Plaintext API keys (encrypted at rest, decrypted only in-memory during proxy forwarding)</li>
              <li>Request/response bodies of proxied API calls (only metadata like token counts)</li>
              <li>Conversation content, prompts, or completions from your AI API calls</li>
              <li>Third-party analytics, advertising trackers, or fingerprinting data</li>
            </ul>
          </Section>

          <Section title="4. How We Protect Your Data">
            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Encryption</h3>
            <ul>
              <li>API keys: AES-256-GCM with per-user derived keys using HMAC-SHA256 (HKDF pattern)</li>
              <li>Each key has a unique IV (initialization vector)</li>
              <li>The master key is stored as a server-side environment variable, never in code or database</li>
            </ul>

            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Proxy Tokens</h3>
            <ul>
              <li>Tokens are cryptographically random (32 bytes)</li>
              <li>Only the SHA-256 hash is stored — the plaintext token is shown once at creation</li>
              <li>Session lookup is cached in Redis with a 60-second TTL for fast revocation</li>
            </ul>

            <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">Infrastructure</h3>
            <ul>
              <li>Database: Neon Postgres (encrypted at rest, TLS in transit)</li>
              <li>Cache: Upstash Redis (TLS, encrypted at rest)</li>
              <li>Authentication: Clerk (SOC 2 compliant)</li>
              <li>Hosting: Vercel (SOC 2 compliant, encrypted in transit)</li>
            </ul>
          </Section>

          <Section title="5. How We Use Your Data">
            <ul>
              <li>To provide the Service: encrypting keys, proxying requests, tracking usage</li>
              <li>To display your dashboard: cost summaries, activity feed, session status</li>
              <li>To enforce security: rate limiting, session revocation, kill switch</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-text-primary">not</strong> use your data for advertising, profiling, or selling to third parties.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <ul>
              <li>Account data: retained while your account is active</li>
              <li>Encrypted vault keys: retained until you delete them or your account</li>
              <li>Proxy logs: retained for 90 days, then automatically purged</li>
              <li>Activity logs: retained for 90 days</li>
            </ul>
            <p className="mt-3">
              When you delete a vault key, all associated proxy sessions and logs are cascade-deleted from the database.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>We use the following third-party services:</p>
            <ul>
              <li><strong className="text-text-primary">Clerk</strong> — authentication (receives your email)</li>
              <li><strong className="text-text-primary">Neon</strong> — database hosting (stores encrypted data)</li>
              <li><strong className="text-text-primary">Upstash</strong> — Redis cache (stores session lookup cache)</li>
              <li><strong className="text-text-primary">Vercel</strong> — hosting and deployment</li>
            </ul>
            <p className="mt-3">
              When you use the proxy gateway, your requests are forwarded to the AI provider you selected
              (OpenAI, Anthropic, Google AI). Those providers&apos; privacy policies apply to the content
              of your API calls.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <ul>
              <li><strong className="text-text-primary">Access:</strong> You can view all your data in the dashboard</li>
              <li><strong className="text-text-primary">Deletion:</strong> You can delete individual keys, sessions, or your entire account</li>
              <li><strong className="text-text-primary">Export:</strong> Your activity and usage data is visible in the dashboard</li>
              <li><strong className="text-text-primary">Revocation:</strong> You can instantly revoke all proxy sessions via the kill switch</li>
            </ul>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this policy as the Service evolves. Continued use after changes constitutes acceptance.
              We will notify users of material changes via the Service.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              For privacy questions or data deletion requests, contact us via GitHub at{" "}
              <a
                href="https://github.com/venkat22022202/black-vault"
                className="text-neon-green hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                github.com/venkat22022202/black-vault
              </a>.
            </p>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text-primary mb-3">{title}</h2>
      <div className="text-sm text-text-secondary leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_h3]:text-sm">
        {children}
      </div>
    </section>
  );
}
