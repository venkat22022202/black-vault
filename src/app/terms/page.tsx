import Link from "next/link";

export const metadata = {
  title: "Terms of Service | BlackVault",
};

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-text-primary mb-2">Terms of Service</h1>
        <p className="text-sm text-text-muted mb-10">Last updated: February 2025</p>

        <div className="prose-custom space-y-8">
          <Section title="1. Acceptance of Terms">
            <p>
              By accessing or using BlackVault (&quot;the Service&quot;), you agree to be bound by these Terms of Service.
              If you do not agree, do not use the Service. BlackVault is operated by its creator (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              BlackVault is an API key management platform that provides encrypted storage for third-party API keys,
              a proxy gateway for routing API requests, session management, cost tracking, and related tools.
              The Service is currently in beta and available free of charge.
            </p>
          </Section>

          <Section title="3. Beta Service">
            <p>
              The Service is provided as a beta release. Features, availability, and pricing may change at any time.
              We do not guarantee uptime, data retention, or uninterrupted service during the beta period.
              We will make reasonable efforts to notify users of material changes.
            </p>
          </Section>

          <Section title="4. User Accounts">
            <p>
              You must create an account to use the Service. You are responsible for maintaining the security of
              your account credentials. You must not share your account or proxy tokens with unauthorized parties.
              You are responsible for all activity under your account.
            </p>
          </Section>

          <Section title="5. API Keys and Proxy Tokens">
            <p>
              You may store third-party API keys in the encrypted vault. You represent that you have the right to
              use these API keys and that storing them in BlackVault does not violate any agreement with the
              key provider. Proxy tokens (<code>bvt_</code> tokens) are shown once at creation and cannot be
              retrieved afterward. You are responsible for storing them securely.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to:</p>
            <ul>
              <li>Use the Service for any illegal purpose</li>
              <li>Attempt to reverse-engineer, decompile, or extract encryption keys from the Service</li>
              <li>Abuse the proxy gateway to circumvent rate limits or terms of third-party API providers</li>
              <li>Share proxy tokens publicly or embed them in client-side code</li>
              <li>Use the Service to store credentials other than API keys (passwords, SSH keys, etc.)</li>
              <li>Attempt to access other users&apos; data or interfere with the Service&apos;s operation</li>
            </ul>
          </Section>

          <Section title="7. Data and Encryption">
            <p>
              API keys are encrypted using AES-256-GCM with per-user derived keys via HKDF.
              We do not have the ability to read your plaintext API keys at rest.
              Proxy requests are decrypted in-memory solely for the purpose of forwarding to the upstream provider
              and are not logged in plaintext. See our <Link href="/privacy" className="text-neon-green hover:underline">Privacy Policy</Link> for
              full details on data handling.
            </p>
          </Section>

          <Section title="8. Service Availability">
            <p>
              We aim to maintain high availability but do not guarantee uptime. The Service may be temporarily
              unavailable for maintenance, updates, or due to factors beyond our control. We are not liable for
              any losses resulting from Service unavailability, including failed proxy requests.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT
              PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
              OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES. OUR TOTAL
              LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM (WHICH
              DURING BETA IS $0).
            </p>
          </Section>

          <Section title="10. Third-Party Services">
            <p>
              BlackVault integrates with third-party services (OpenAI, Anthropic, Google AI, etc.).
              We are not responsible for the availability, accuracy, or policies of these providers.
              Your use of third-party APIs through our proxy is subject to those providers&apos; own terms of service.
            </p>
          </Section>

          <Section title="11. Termination">
            <p>
              You may delete your account at any time. We may suspend or terminate your access if you violate
              these terms. Upon termination, your encrypted keys and session data will be permanently deleted.
            </p>
          </Section>

          <Section title="12. Changes to Terms">
            <p>
              We may update these terms from time to time. Continued use of the Service after changes constitutes
              acceptance. We will make reasonable efforts to notify users of material changes via the Service
              or email.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              For questions about these terms, contact us via GitHub at{" "}
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
      <div className="text-sm text-text-secondary leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_code]:text-neon-green [&_code]:text-xs [&_code]:bg-void-200 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
        {children}
      </div>
    </section>
  );
}
