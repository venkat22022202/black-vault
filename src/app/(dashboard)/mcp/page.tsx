"use client";

import { motion } from "framer-motion";
import { Plug, Copy, Check, KeyRound, Terminal, ArrowRight, Cpu, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

function useOrigin() {
  const [origin, setOrigin] = useState(process.env.NEXT_PUBLIC_APP_URL || "https://your-blackvault.app");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  return origin;
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative rounded-lg border border-void-300 bg-void-100">
      {language && (
        <div className="px-3 pt-2 text-[10px] font-mono uppercase tracking-wider text-text-muted">{language}</div>
      )}
      <pre className="p-3 pr-10 text-xs font-mono text-text-secondary whitespace-pre-wrap break-all overflow-x-auto">
        {code}
      </pre>
      <button onClick={onCopy} className="absolute top-2 right-2 text-text-muted hover:text-neon-green">
        {copied ? <Check className="w-4 h-4 text-neon-green" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-lg border border-void-400 bg-void-100 flex items-center justify-center font-mono text-sm font-bold text-neon-green">
        {n}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className="text-sm font-semibold text-text-primary pt-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

export default function McpPage() {
  const origin = useOrigin();
  const endpoint = `${origin}/api/mcp`;

  const jsonConfig = `{
  "mcpServers": {
    "blackvault": {
      "url": "${endpoint}",
      "headers": { "Authorization": "Bearer bvt_your_token" }
    }
  }
}`;

  const claudeCodeCmd = `claude mcp add --transport http blackvault \\
  ${endpoint} \\
  --header "Authorization: Bearer bvt_your_token"`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Plug className="w-6 h-6 text-neon-cyan" />
          Connect via MCP
        </h1>
        <p className="text-sm text-text-secondary mt-1 max-w-2xl">
          BlackVault is a remote MCP server. Plug it into Claude Desktop, Cursor, or Claude Code and your agent gets
          governed AI access — your config holds a <span className="font-mono text-neon-cyan">bvt_</span> token, never a
          provider key. Budget caps, model limits, the kill switch, and the audit trail all apply.
        </p>
      </div>

      {/* Endpoint pill */}
      <div className="rounded-xl border border-neon-cyan/20 bg-neon-cyan/5 p-4">
        <div className="text-xs text-text-muted mb-1.5">Your MCP endpoint</div>
        <CodeBlock code={endpoint} />
      </div>

      {/* Steps */}
      <div className="rounded-xl border border-void-300 bg-void-50 p-6 space-y-6">
        <Step n={1} title="Mint a token">
          <p className="text-xs text-text-muted">
            Add a provider key in the Vault, then generate a Proxy Token on it. Set a budget cap or model allowlist if
            you want the agent restricted.
          </p>
          <Link
            href="/vault"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neon-green/40 bg-neon-green/10 px-3 py-1.5 text-xs font-semibold text-neon-green hover:bg-neon-green/20"
          >
            <KeyRound className="w-3.5 h-3.5" />
            Go to Vault
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Step>

        <Step n={2} title="Add it to your client">
          <p className="text-xs text-text-muted">
            Claude Desktop (<span className="font-mono">claude_desktop_config.json</span>) or Cursor
            (<span className="font-mono">mcp.json</span>) — paste this and restart:
          </p>
          <CodeBlock code={jsonConfig} language="json" />
          <p className="text-xs text-text-muted pt-1">Claude Code — run:</p>
          <CodeBlock code={claudeCodeCmd} language="bash" />
        </Step>

        <Step n={3} title="Use it">
          <p className="text-xs text-text-muted">
            Your agent now has the tools below. Every call is brokered through BlackVault — kill the token any time and
            its next call fails instantly.
          </p>
        </Step>
      </div>

      {/* Tools */}
      <div>
        <div className="text-sm font-semibold text-text-primary mb-3">Tools your agent gets</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToolCard
            icon={Cpu}
            name="list_models"
            desc="Lists the models this token is allowed to use, across your vaulted provider keys."
          />
          <ToolCard
            icon={MessageSquare}
            name="chat"
            desc="Runs a completion on any allowed model (gpt-*, claude-*, gemini-*, open-source). The real key is injected server-side; budget/rate/model limits are enforced."
          />
        </div>
      </div>

      {/* curl test */}
      <div className="rounded-xl border border-void-300 bg-void-50 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-4 h-4 text-neon-green" />
          <span className="text-sm font-semibold text-text-primary">Quick test (curl)</span>
        </div>
        <CodeBlock
          language="bash"
          code={`curl -X POST ${endpoint} \\
  -H "Authorization: Bearer bvt_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
        />
      </div>
    </div>
  );
}

function ToolCard({ icon: Icon, name, desc }: { icon: typeof Cpu; name: string; desc: string }) {
  return (
    <div className={cn("rounded-xl border border-void-300 bg-void-50 p-4")}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className="w-4 h-4 text-neon-cyan" />
        <span className="text-sm font-mono font-semibold text-text-primary">{name}</span>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
    </div>
  );
}
