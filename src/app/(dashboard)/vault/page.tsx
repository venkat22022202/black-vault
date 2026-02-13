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
  Loader2,
  AlertTriangle,
  Power,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PROVIDERS, PROVIDER_LIST, type ProviderId } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ============================================
// ADD KEY MODAL
// ============================================
function AddKeyModal({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState<ProviderId>("openai");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [budget, setBudget] = useState("");
  const utils = trpc.useUtils();

  const createKey = trpc.vault.create.useMutation({
    onSuccess: () => {
      utils.vault.getAll.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success("API key encrypted and saved!");
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to save key");
    },
  });

  const handleSubmit = () => {
    if (!label.trim() || !apiKey.trim()) {
      toast.error("Label and API key are required");
      return;
    }
    createKey.mutate({
      provider,
      label: label.trim(),
      apiKey: apiKey.trim(),
      monthlyBudget: budget ? Number(budget) : undefined,
    });
  };

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
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ProviderId)}
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            >
              {PROVIDER_LIST.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Key"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">
              Monthly Budget (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
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
          <button
            onClick={handleSubmit}
            disabled={createKey.isPending}
            className="flex-1 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {createKey.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : null}
            Encrypt & Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// KILL SWITCH CONFIRMATION MODAL
// ============================================
function KillSwitchModal({ onClose, activeCount }: { onClose: () => void; activeCount: number }) {
  const [confirmText, setConfirmText] = useState("");
  const utils = trpc.useUtils();

  const revokeAll = trpc.killswitch.revokeAll.useMutation({
    onSuccess: (data) => {
      utils.vault.getAll.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success(`Kill Switch activated! ${data.revokedCount} keys revoked.`);
      onClose();
    },
    onError: () => {
      toast.error("Failed to activate Kill Switch");
    },
  });

  const canConfirm = confirmText === "KILL";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md rounded-xl border border-neon-red/50 bg-void-50 p-6 shadow-[0_0_40px_rgba(239,68,68,0.15)]"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-neon-red/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-neon-red" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neon-red">Emergency Kill Switch</h2>
            <p className="text-xs text-text-muted">This action cannot be easily undone</p>
          </div>
        </div>

        <div className="rounded-lg bg-neon-red/5 border border-neon-red/20 p-4 mb-4">
          <p className="text-sm text-text-secondary">
            This will <span className="text-neon-red font-semibold">immediately disable all {activeCount} active API keys</span> in your vault.
            Agents using these keys will lose access instantly.
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-xs text-text-muted mb-1.5">
            Type <span className="text-neon-red font-bold">KILL</span> to confirm
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="KILL"
            className="w-full rounded-lg border border-neon-red/30 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted font-mono focus:border-neon-red focus:outline-none focus:ring-1 focus:ring-neon-red/30"
            autoFocus
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-void-300 px-4 py-2.5 text-sm text-text-secondary hover:bg-void-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => revokeAll.mutate()}
            disabled={!canConfirm || revokeAll.isPending}
            className="flex-1 rounded-lg bg-neon-red px-4 py-2.5 text-sm font-semibold text-white hover:bg-neon-red/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {revokeAll.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            Revoke All Keys
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ============================================
// KEY CARD
// ============================================
interface VaultKeyItem {
  id: string;
  provider: string;
  label: string;
  keyPrefix: string;
  isActive: boolean;
  monthlyBudget: number | null;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
}

function KeyCard({ item }: { item: VaultKeyItem }) {
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();

  const provider = PROVIDERS[item.provider as ProviderId] ?? PROVIDERS.other;

  const revealMutation = trpc.vault.reveal.useMutation({
    onSuccess: (data) => {
      setRevealedKey(data.apiKey);
      setTimeout(() => setRevealedKey(null), 10000);
    },
    onError: () => toast.error("Failed to decrypt key"),
  });

  const toggleMutation = trpc.vault.toggleActive.useMutation({
    onSuccess: () => {
      utils.vault.getAll.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success(item.isActive ? "Key disabled" : "Key enabled");
    },
  });

  const deleteMutation = trpc.vault.delete.useMutation({
    onSuccess: () => {
      utils.vault.getAll.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success("Key deleted permanently");
    },
  });

  const handleCopy = async () => {
    if (revealedKey) {
      await navigator.clipboard.writeText(revealedKey);
    } else {
      const result = await revealMutation.mutateAsync({ id: item.id });
      await navigator.clipboard.writeText(result.apiKey);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Key copied to clipboard");
  };

  const handleReveal = () => {
    if (revealedKey) {
      setRevealedKey(null);
    } else {
      revealMutation.mutate({ id: item.id });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure? This permanently deletes the encrypted key.")) {
      deleteMutation.mutate({ id: item.id });
    }
  };

  const lastUsed = item.lastUsedAt
    ? (() => {
        const diff = Date.now() - new Date(item.lastUsedAt).getTime();
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
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
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: provider.color + "20", color: provider.color }}
          >
            {provider.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-text-primary">{item.label}</div>
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

      <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-void-200 border border-void-300">
        <code className="text-xs font-mono text-text-secondary flex-1 truncate">
          {revealedKey ?? item.keyPrefix}
        </code>
        <button
          onClick={handleReveal}
          disabled={revealMutation.isPending}
          className="p-1 rounded hover:bg-void-300 text-text-muted hover:text-text-primary transition-colors"
        >
          {revealMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : revealedKey ? (
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
        {copied && <span className="text-xs text-neon-green">Copied!</span>}
      </div>

      <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
        <span>Last used: {lastUsed}</span>
        {item.monthlyBudget && (
          <span>Budget: ${item.monthlyBudget}/mo</span>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-void-300/50">
        <button
          onClick={() => toggleMutation.mutate({ id: item.id })}
          disabled={toggleMutation.isPending}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors p-1.5 rounded hover:bg-void-200"
        >
          {item.isActive ? (
            <ToggleRight className="w-4 h-4 text-neon-green" />
          ) : (
            <ToggleLeft className="w-4 h-4" />
          )}
          {item.isActive ? "Disable" : "Enable"}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-neon-red transition-colors p-1.5 rounded hover:bg-void-200 ml-auto"
        >
          {deleteMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Trash2 className="w-3.5 h-3.5" />
          )}
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
  const [showKillSwitch, setShowKillSwitch] = useState(false);
  const [search, setSearch] = useState("");

  const { data: keys, isLoading } = trpc.vault.getAll.useQuery();
  const { data: killStatus } = trpc.killswitch.getStatus.useQuery();

  const filteredKeys = (keys ?? []).filter(
    (k) =>
      k.label.toLowerCase().includes(search.toLowerCase()) ||
      k.provider.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = killStatus?.active ?? 0;

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
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <button
              onClick={() => setShowKillSwitch(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-neon-red/30 bg-neon-red/5 px-4 py-2.5 text-sm font-semibold text-neon-red hover:bg-neon-red/10 transition-all hover:shadow-[0_0_20px_rgba(239,68,68,0.2)] shrink-0"
            >
              <Power className="w-4 h-4" />
              Kill Switch
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Key
          </button>
        </div>
      </div>

      {/* Key Status Bar */}
      {killStatus && killStatus.total > 0 && (
        <div className="flex items-center gap-4 rounded-lg border border-void-300 bg-void-50 px-4 py-3 text-xs font-mono">
          <span className="text-text-muted">Keys:</span>
          <span className="text-neon-green">{killStatus.active} active</span>
          <span className="text-text-muted">/</span>
          <span className="text-neon-red">{killStatus.disabled} disabled</span>
          <span className="text-text-muted">/</span>
          <span className="text-text-secondary">{killStatus.total} total</span>
        </div>
      )}

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

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
        </div>
      )}

      {/* Keys Grid */}
      {!isLoading && filteredKeys.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredKeys.map((key) => (
            <KeyCard key={key.id} item={key} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredKeys.length === 0 && (
        <div className="text-center py-16">
          <Key className="w-12 h-12 text-text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-text-primary mb-1">
            {search ? "No keys match your search" : "Your vault is empty"}
          </h3>
          <p className="text-sm text-text-secondary mb-6">
            {search
              ? "Try a different search term"
              : "Add your first API key to encrypt and store it securely."}
          </p>
          {!search && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-neon-green px-6 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
            >
              <Plus className="w-4 h-4" />
              Add Your First Key
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddKeyModal onClose={() => setShowAddModal(false)} />}
      {showKillSwitch && (
        <KillSwitchModal
          onClose={() => setShowKillSwitch(false)}
          activeCount={activeCount}
        />
      )}
    </div>
  );
}
