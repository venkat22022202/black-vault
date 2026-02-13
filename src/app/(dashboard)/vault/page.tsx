"use client";

import { motion } from "framer-motion";
import {
  Plus,
  Key,
  Copy,
  Eye,
  EyeOff,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PROVIDERS, PROVIDER_LIST, type ProviderId } from "@/lib/constants";

// ============================================
// MOCK DATA (replace with tRPC)
// ============================================
const mockKeys = [
  {
    id: "1",
    provider: "anthropic" as ProviderId,
    label: "Production Claude Key",
    keyPrefix: "sk-ant-xxxx****xxxx",
    isActive: true,
    monthlyBudget: 50,
    currentSpend: 34.21,
    lastUsedAt: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    provider: "openai" as ProviderId,
    label: "GPT-4o Dev Key",
    keyPrefix: "sk-proj-xxxx****xxxx",
    isActive: true,
    monthlyBudget: 100,
    currentSpend: 67.89,
    lastUsedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "3",
    provider: "google" as ProviderId,
    label: "Gemini API Key",
    keyPrefix: "AIza****xxxx",
    isActive: false,
    monthlyBudget: null,
    currentSpend: 12.4,
    lastUsedAt: new Date(Date.now() - 86400000),
  },
];

// ============================================
// ADD KEY MODAL
// ============================================
function AddKeyModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [budget, setBudget] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-6 flex items-center gap-2">
          <Key className="w-5 h-5 text-neon-green" />
          Add API Key
        </h2>

        <div className="space-y-4">
          {/* Provider */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            >
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Label
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Key"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          {/* API Key */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          {/* Monthly Budget */}
          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Monthly Budget (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">
                $
              </span>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="100.00"
                className="w-full rounded-lg border border-void-300 bg-void-200 pl-7 pr-3 py-2.5 text-sm text-text-primary placeholder-text-muted font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-void-300 px-4 py-2.5 text-sm text-text-secondary hover:bg-void-200 transition-colors"
          >
            Cancel
          </button>
          <button className="flex-1 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]">
            Encrypt & Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// KEY CARD
// ============================================
function KeyCard({
  item,
}: {
  item: (typeof mockKeys)[0];
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const provider = PROVIDERS[item.provider];
  const budgetPercentage = item.monthlyBudget
    ? (item.currentSpend / item.monthlyBudget) * 100
    : 0;
  const isWarning = budgetPercentage > 80;

  const handleCopy = () => {
    navigator.clipboard.writeText(item.keyPrefix);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lastUsed = item.lastUsedAt
    ? (() => {
        const diff = Date.now() - item.lastUsedAt.getTime();
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        return `${Math.floor(diff / 3600000)}h ago`;
      })()
    : "Never";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border bg-void-50 p-5 transition-all hover:border-void-400",
        item.isActive ? "border-void-300" : "border-void-300/50 opacity-60"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: provider.color + "20", color: provider.color }}
          >
            {provider.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">
              {item.label}
            </div>
            <div className="text-xs text-text-muted">{provider.name}</div>
          </div>
        </div>
        <span
          className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            item.isActive
              ? "bg-neon-green/10 text-neon-green"
              : "bg-void-300 text-text-muted"
          )}
        >
          {item.isActive ? "Active" : "Disabled"}
        </span>
      </div>

      {/* Key display */}
      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-void-200 border border-void-300">
        <code className="text-xs font-mono text-text-secondary flex-1 truncate">
          {revealed ? "sk-ant-api03-real-key-would-be-here" : item.keyPrefix}
        </code>
        <button
          onClick={() => setRevealed(!revealed)}
          className="p-1 rounded hover:bg-void-300 text-text-muted hover:text-text-primary transition-colors"
        >
          {revealed ? (
            <EyeOff className="w-3.5 h-3.5" />
          ) : (
            <Eye className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={handleCopy}
          className="p-1 rounded hover:bg-void-300 text-text-muted hover:text-text-primary transition-colors"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>
        {copied && (
          <span className="text-xs text-neon-green">Copied!</span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
        <span>Last used: {lastUsed}</span>
        {item.monthlyBudget && (
          <span>
            Budget: ${item.currentSpend.toFixed(2)} / ${item.monthlyBudget}
          </span>
        )}
      </div>

      {/* Budget bar */}
      {item.monthlyBudget && (
        <div className="mb-3">
          <div className="h-1.5 rounded-full bg-void-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(budgetPercentage, 100)}%` }}
              transition={{ duration: 1 }}
              className={cn(
                "h-full rounded-full",
                isWarning ? "bg-neon-amber" : "bg-neon-green"
              )}
            />
          </div>
          {isWarning && (
            <span className="text-xs text-neon-amber mt-1 inline-block">
              {budgetPercentage.toFixed(0)}% of budget used
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-void-300/50">
        <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors p-1.5 rounded hover:bg-void-200">
          {item.isActive ? (
            <ToggleRight className="w-4 h-4 text-neon-green" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {item.isActive ? "Disable" : "Enable"}
        </button>
        <button className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-red transition-colors p-1.5 rounded hover:bg-void-200 ml-auto">
          <Trash2 className="w-3.5 h-3.5" />
          Delete
        </button>
      </div>
    </motion.div>
  );
}

// ============================================
// VAULT PAGE
// ============================================
export default function VaultPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [search, setSearch] = useState("");

  const filteredKeys = mockKeys.filter(
    (k) =>
      k.label.toLowerCase().includes(search.toLowerCase()) ||
      k.provider.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Shield className="w-6 h-6 text-neon-green" />
            API Key Vault
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            AES-256-GCM encrypted. Your keys never leave the vault unencrypted.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Key
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys..."
          className="w-full rounded-lg border border-void-300 bg-void-100 pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
        />
      </div>

      {/* Keys Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredKeys.map((key) => (
          <KeyCard key={key.id} item={key} />
        ))}
      </div>

      {filteredKeys.length === 0 && (
        <div className="text-center py-16">
          <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            No keys found
          </h3>
          <p className="text-sm text-text-secondary">
            {search
              ? "Try a different search term"
              : "Add your first API key to get started"}
          </p>
        </div>
      )}

      {/* Add Key Modal */}
      {showAddModal && <AddKeyModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
