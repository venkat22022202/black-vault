"use client";

import { motion, AnimatePresence } from "framer-motion";
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
  Wifi,
  ChevronDown,
  ChevronUp,
  Skull,
  Clock,
  Hash,
  DollarSign,
  Check,
  Gauge,
  Lock,
  Cpu,
  Globe,
  Settings2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PROVIDERS, PROVIDER_LIST, type ProviderId } from "@/lib/constants";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ============================================
// MODELS BY PROVIDER (for model restriction UI)
// ============================================
const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"],
  anthropic: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-3-5-sonnet-20241022", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
  google: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  nebius: ["deepseek-ai/DeepSeek-R1-0528", "meta-llama/Llama-3.1-70B-Instruct", "meta-llama/Llama-3.1-8B-Instruct", "mistralai/Mixtral-8x22B-Instruct-v0.1"],
};

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
// GENERATE PROXY TOKEN MODAL (with rate limits)
// ============================================
function GenerateTokenModal({
  onClose,
  vaultKeyId,
  provider,
}: {
  onClose: () => void;
  vaultKeyId: string;
  provider: string;
}) {
  const [label, setLabel] = useState("");
  const [expiry, setExpiry] = useState<string>("never");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [proxyBaseUrl, setProxyBaseUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Rate limit controls
  const [rpmEnabled, setRpmEnabled] = useState(false);
  const [rpm, setRpm] = useState("60");
  const [rpdEnabled, setRpdEnabled] = useState(false);
  const [rpd, setRpd] = useState("1000");
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budget, setBudget] = useState("10");
  const [modelRestrictEnabled, setModelRestrictEnabled] = useState(false);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [ipRestrictEnabled, setIpRestrictEnabled] = useState(false);
  const [ipInput, setIpInput] = useState("");
  const [allowedIps, setAllowedIps] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const availableModels = MODELS_BY_PROVIDER[provider] ?? [];

  const generateToken = trpc.proxy.generateToken.useMutation({
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      setProxyBaseUrl(data.proxyBaseUrl);
      utils.proxy.listSessions.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success("Proxy token generated!");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to generate token");
    },
  });

  const handleSubmit = () => {
    if (!label.trim()) {
      toast.error("Label is required");
      return;
    }
    const expiresInHours =
      expiry === "1h"
        ? 1
        : expiry === "24h"
          ? 24
          : expiry === "7d"
            ? 168
            : expiry === "30d"
              ? 720
              : undefined;

    generateToken.mutate({
      vaultKeyId,
      label: label.trim(),
      expiresInHours,
      rateLimitRpm: rpmEnabled ? Number(rpm) : undefined,
      rateLimitRpd: rpdEnabled ? Number(rpd) : undefined,
      maxBudget: budgetEnabled ? Number(budget) : undefined,
      allowedModels: modelRestrictEnabled && selectedModels.length > 0 ? selectedModels : undefined,
      allowedIps: ipRestrictEnabled && allowedIps.length > 0 ? allowedIps : undefined,
    });
  };

  const handleCopy = async () => {
    if (!generatedToken) return;
    await navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Token copied!");
  };

  const addIp = () => {
    const ip = ipInput.trim();
    if (!ip) return;
    if (allowedIps.includes(ip)) {
      toast.error("IP already added");
      return;
    }
    setAllowedIps([...allowedIps, ip]);
    setIpInput("");
  };

  const toggleModel = (model: string) => {
    setSelectedModels((prev) =>
      prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg rounded-xl border border-neon-cyan/30 bg-void-50 p-6 max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Wifi className="w-5 h-5 text-neon-cyan" />
          Generate Proxy Token
        </h2>
        <p className="text-xs text-text-muted mb-6">
          Create a proxy token for {PROVIDERS[provider as ProviderId]?.name ?? provider}. The real API key never leaves BlackVault.
        </p>

        {!generatedToken ? (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  Session Label
                </label>
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder='e.g. "MacBook Pro" or "CI Pipeline"'
                  className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/30"
                />
              </div>

              <div>
                <label className="block text-xs text-text-muted mb-1.5">
                  Expires After
                </label>
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/30"
                >
                  <option value="1h">1 hour</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="30d">30 days</option>
                  <option value="never">Never</option>
                </select>
              </div>

              {/* Advanced Controls Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-xs text-neon-purple hover:text-neon-purple/80 transition-colors w-full py-2 border-t border-void-300/50"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="font-medium">Access Controls & Rate Limits</span>
                {showAdvanced ? (
                  <ChevronUp className="w-3.5 h-3.5 ml-auto" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 ml-auto" />
                )}
                {(rpmEnabled || rpdEnabled || budgetEnabled || modelRestrictEnabled || ipRestrictEnabled) && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-neon-purple/10 text-neon-purple text-[10px] font-bold">
                    {[rpmEnabled, rpdEnabled, budgetEnabled, modelRestrictEnabled, ipRestrictEnabled].filter(Boolean).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden space-y-4"
                  >
                    {/* RPM Limit */}
                    <div className="rounded-lg border border-void-300 bg-void-100 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rpmEnabled}
                          onChange={(e) => setRpmEnabled(e.target.checked)}
                          className="accent-neon-cyan"
                        />
                        <Gauge className="w-3.5 h-3.5 text-neon-cyan" />
                        <span className="text-xs font-medium text-text-primary">Requests per Minute (RPM)</span>
                      </label>
                      {rpmEnabled && (
                        <div className="mt-2 ml-6">
                          <input
                            type="number"
                            value={rpm}
                            onChange={(e) => setRpm(e.target.value)}
                            min="1"
                            max="10000"
                            className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2 text-sm text-text-primary font-mono focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/30"
                          />
                          <p className="text-[10px] text-text-muted mt-1">Agent gets 429 after this many requests in 60 seconds</p>
                        </div>
                      )}
                    </div>

                    {/* RPD Limit */}
                    <div className="rounded-lg border border-void-300 bg-void-100 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rpdEnabled}
                          onChange={(e) => setRpdEnabled(e.target.checked)}
                          className="accent-neon-cyan"
                        />
                        <Clock className="w-3.5 h-3.5 text-neon-amber" />
                        <span className="text-xs font-medium text-text-primary">Requests per Day (RPD)</span>
                      </label>
                      {rpdEnabled && (
                        <div className="mt-2 ml-6">
                          <input
                            type="number"
                            value={rpd}
                            onChange={(e) => setRpd(e.target.value)}
                            min="1"
                            max="1000000"
                            className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2 text-sm text-text-primary font-mono focus:border-neon-cyan focus:outline-none focus:ring-1 focus:ring-neon-cyan/30"
                          />
                          <p className="text-[10px] text-text-muted mt-1">Hard daily cap - resets every 24 hours</p>
                        </div>
                      )}
                    </div>

                    {/* Budget Limit */}
                    <div className="rounded-lg border border-void-300 bg-void-100 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={budgetEnabled}
                          onChange={(e) => setBudgetEnabled(e.target.checked)}
                          className="accent-neon-green"
                        />
                        <DollarSign className="w-3.5 h-3.5 text-neon-green" />
                        <span className="text-xs font-medium text-text-primary">Session Budget Cap</span>
                      </label>
                      {budgetEnabled && (
                        <div className="mt-2 ml-6">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-muted">$</span>
                            <input
                              type="number"
                              value={budget}
                              onChange={(e) => setBudget(e.target.value)}
                              min="0.01"
                              step="0.01"
                              className="w-full rounded-lg border border-void-300 bg-void-200 pl-7 pr-3 py-2 text-sm text-text-primary font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
                            />
                          </div>
                          <p className="text-[10px] text-text-muted mt-1">Agent gets 402 when this budget is exhausted</p>
                        </div>
                      )}
                    </div>

                    {/* Model Restrictions */}
                    {availableModels.length > 0 && (
                      <div className="rounded-lg border border-void-300 bg-void-100 p-3">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={modelRestrictEnabled}
                            onChange={(e) => {
                              setModelRestrictEnabled(e.target.checked);
                              if (!e.target.checked) setSelectedModels([]);
                            }}
                            className="accent-neon-purple"
                          />
                          <Cpu className="w-3.5 h-3.5 text-neon-purple" />
                          <span className="text-xs font-medium text-text-primary">Model Restrictions</span>
                        </label>
                        {modelRestrictEnabled && (
                          <div className="mt-2 ml-6">
                            <div className="flex flex-wrap gap-1.5">
                              {availableModels.map((model) => (
                                <button
                                  key={model}
                                  onClick={() => toggleModel(model)}
                                  className={cn(
                                    "px-2 py-1 rounded text-[11px] font-mono border transition-all",
                                    selectedModels.includes(model)
                                      ? "bg-neon-purple/10 border-neon-purple/40 text-neon-purple"
                                      : "bg-void-200 border-void-300 text-text-muted hover:border-void-400"
                                  )}
                                >
                                  {model}
                                </button>
                              ))}
                            </div>
                            <p className="text-[10px] text-text-muted mt-1.5">
                              {selectedModels.length === 0
                                ? "Select models this token can access"
                                : `${selectedModels.length} model${selectedModels.length !== 1 ? "s" : ""} allowed`}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* IP Allowlist */}
                    <div className="rounded-lg border border-void-300 bg-void-100 p-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ipRestrictEnabled}
                          onChange={(e) => {
                            setIpRestrictEnabled(e.target.checked);
                            if (!e.target.checked) setAllowedIps([]);
                          }}
                          className="accent-neon-red"
                        />
                        <Globe className="w-3.5 h-3.5 text-neon-red" />
                        <span className="text-xs font-medium text-text-primary">IP Allowlist</span>
                      </label>
                      {ipRestrictEnabled && (
                        <div className="mt-2 ml-6">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={ipInput}
                              onChange={(e) => setIpInput(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && addIp()}
                              placeholder="e.g. 203.0.113.50"
                              className="flex-1 rounded-lg border border-void-300 bg-void-200 px-3 py-1.5 text-xs text-text-primary font-mono placeholder-text-muted focus:border-neon-red focus:outline-none"
                            />
                            <button
                              onClick={addIp}
                              className="px-2 py-1.5 rounded-lg bg-void-200 border border-void-300 text-xs text-text-primary hover:bg-void-300 transition-colors"
                            >
                              Add
                            </button>
                          </div>
                          {allowedIps.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {allowedIps.map((ip) => (
                                <span
                                  key={ip}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neon-red/10 text-neon-red text-[11px] font-mono"
                                >
                                  {ip}
                                  <button
                                    onClick={() => setAllowedIps(allowedIps.filter((i) => i !== ip))}
                                    className="hover:text-white"
                                  >
                                    x
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-text-muted mt-1">Only these IPs can use this proxy token</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
                disabled={generateToken.isPending}
                className="flex-1 rounded-lg bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-cyan/90 transition-all hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generateToken.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Generate Token
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-neon-amber/5 border border-neon-amber/20 p-3">
              <p className="text-xs text-neon-amber font-semibold mb-1">
                Copy this token now — it won&apos;t be shown again!
              </p>
            </div>

            <div className="relative">
              <code className="block w-full rounded-lg border border-void-300 bg-void-200 p-3 text-xs font-mono text-neon-green break-all">
                {generatedToken}
              </code>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 rounded bg-void-300 hover:bg-void-400 transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-neon-green" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-text-muted" />
                )}
              </button>
            </div>

            {/* Show configured limits summary */}
            {(rpmEnabled || rpdEnabled || budgetEnabled || modelRestrictEnabled || ipRestrictEnabled) && (
              <div className="rounded-lg border border-neon-purple/20 bg-neon-purple/5 p-3">
                <p className="text-xs font-semibold text-neon-purple mb-2 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" />
                  Access Controls Active
                </p>
                <div className="flex flex-wrap gap-2">
                  {rpmEnabled && (
                    <span className="px-2 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan text-[10px] font-mono">
                      {rpm} RPM
                    </span>
                  )}
                  {rpdEnabled && (
                    <span className="px-2 py-0.5 rounded bg-neon-amber/10 text-neon-amber text-[10px] font-mono">
                      {rpd} RPD
                    </span>
                  )}
                  {budgetEnabled && (
                    <span className="px-2 py-0.5 rounded bg-neon-green/10 text-neon-green text-[10px] font-mono">
                      ${budget} budget
                    </span>
                  )}
                  {modelRestrictEnabled && selectedModels.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-neon-purple/10 text-neon-purple text-[10px] font-mono">
                      {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""}
                    </span>
                  )}
                  {ipRestrictEnabled && allowedIps.length > 0 && (
                    <span className="px-2 py-0.5 rounded bg-neon-red/10 text-neon-red text-[10px] font-mono">
                      {allowedIps.length} IP{allowedIps.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-text-muted mb-2">Usage example:</p>
              <code className="block w-full rounded-lg border border-void-300 bg-void-200 p-3 text-xs font-mono text-text-secondary break-all whitespace-pre-wrap">
{`curl ${proxyBaseUrl}/v1/chat/completions \\
  -H "Authorization: Bearer ${generatedToken.slice(0, 16)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"model": "gpt-4o", "messages": [{"role": "user", "content": "Hello"}]}'`}
              </code>
            </div>

            <button
              onClick={onClose}
              className="w-full rounded-lg bg-neon-cyan px-4 py-2.5 text-sm font-semibold text-black hover:bg-neon-cyan/90 transition-all"
            >
              Done
            </button>
          </div>
        )}
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
      utils.proxy.listSessions.invalidate();
      toast.success(
        `Kill Switch activated! ${data.revokedCount} keys & ${data.sessionsKilled} proxy sessions revoked.`
      );
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
            This will <span className="text-neon-red font-semibold">immediately disable all {activeCount} active API keys</span> in your vault
            and <span className="text-neon-red font-semibold">terminate all proxy sessions</span>.
            Agents using these keys or proxy tokens will lose access instantly.
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
// BUDGET BAR (visual indicator)
// ============================================
function BudgetBar({ spent, limit }: { spent: number; limit: number }) {
  const pct = Math.min(100, (spent / limit) * 100);
  const color =
    pct >= 90 ? "bg-neon-red" : pct >= 70 ? "bg-neon-amber" : "bg-neon-green";
  const textColor =
    pct >= 90 ? "text-neon-red" : pct >= 70 ? "text-neon-amber" : "text-neon-green";

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[10px] mb-0.5">
        <span className={textColor}>${spent.toFixed(4)}</span>
        <span className="text-text-muted">${limit.toFixed(2)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-void-300 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================
// SESSIONS TABLE (per key)
// ============================================
function SessionsTable({ vaultKeyId }: { vaultKeyId: string }) {
  const utils = trpc.useUtils();
  const { data: sessions, isLoading } = trpc.proxy.listSessions.useQuery({
    vaultKeyId,
  });

  const killSession = trpc.proxy.killSession.useMutation({
    onSuccess: () => {
      utils.proxy.listSessions.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success("Session terminated");
    },
    onError: () => toast.error("Failed to kill session"),
  });

  const killAllSessions = trpc.proxy.killAllSessions.useMutation({
    onSuccess: (data) => {
      utils.proxy.listSessions.invalidate();
      utils.killswitch.getStatus.invalidate();
      toast.success(`${data.killedCount} sessions terminated`);
    },
    onError: () => toast.error("Failed to kill sessions"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-neon-cyan" />
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-6">
        <Wifi className="w-6 h-6 text-text-muted mx-auto mb-2" />
        <p className="text-xs text-text-muted">No proxy sessions yet</p>
      </div>
    );
  }

  const activeSessions = sessions.filter((s) => s.isActive && !s.isExpired);

  return (
    <div className="space-y-3">
      {activeSessions.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => {
              if (confirm("Kill all active sessions for this key?")) {
                killAllSessions.mutate({ vaultKeyId });
              }
            }}
            disabled={killAllSessions.isPending}
            className="inline-flex items-center gap-1.5 text-xs text-neon-red hover:text-neon-red/80 transition-colors px-2 py-1 rounded hover:bg-neon-red/5"
          >
            <Skull className="w-3 h-3" />
            Kill All Sessions
          </button>
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((session) => {
          const status = !session.isActive
            ? "killed"
            : session.isExpired
              ? "expired"
              : "active";

          const lastUsed = session.lastUsedAt
            ? (() => {
                const diff = Date.now() - new Date(session.lastUsedAt).getTime();
                if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
                if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                return `${Math.floor(diff / 86400000)}d ago`;
              })()
            : "Never";

          const hasLimits =
            session.rateLimitRpm !== null ||
            session.rateLimitRpd !== null ||
            session.maxBudget !== null ||
            (session.allowedModels && session.allowedModels.length > 0) ||
            (session.allowedIps && session.allowedIps.length > 0);

          return (
            <div
              key={session.id}
              className={cn(
                "rounded-lg border bg-void-100 p-3 text-xs",
                status === "active"
                  ? "border-void-300"
                  : "border-void-300/50 opacity-60"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-text-primary">
                    {session.label}
                  </span>
                  <code className="text-text-muted font-mono">
                    {session.tokenPrefix}
                  </code>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasLimits && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-neon-purple/10 text-neon-purple flex items-center gap-0.5">
                      <Lock className="w-2.5 h-2.5" />
                      Controls
                    </span>
                  )}
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                      status === "active"
                        ? "bg-neon-green/10 text-neon-green"
                        : status === "expired"
                          ? "bg-neon-amber/10 text-neon-amber"
                          : "bg-neon-red/10 text-neon-red"
                    )}
                  >
                    {status === "active"
                      ? "Active"
                      : status === "expired"
                        ? "Expired"
                        : "Killed"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-text-muted mb-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {lastUsed}
                </span>
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  {session.totalRequests} reqs
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />$
                  {session.totalCost.toFixed(4)}
                </span>
                <span>
                  {session.totalTokensUsed.toLocaleString()} tokens
                </span>
              </div>

              {/* Rate limit & access control indicators */}
              {hasLimits && status === "active" && (
                <div className="space-y-1.5 mb-2 pt-2 border-t border-void-300/50">
                  <div className="flex flex-wrap gap-2">
                    {session.rateLimitRpm !== null && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan text-[10px] font-mono">
                        <Gauge className="w-2.5 h-2.5" />
                        {session.rateLimitRpm} RPM
                      </span>
                    )}
                    {session.rateLimitRpd !== null && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-amber/10 text-neon-amber text-[10px] font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {session.rateLimitRpd} RPD
                      </span>
                    )}
                    {session.allowedModels && session.allowedModels.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-purple/10 text-neon-purple text-[10px] font-mono">
                        <Cpu className="w-2.5 h-2.5" />
                        {session.allowedModels.length} model{session.allowedModels.length !== 1 ? "s" : ""}
                      </span>
                    )}
                    {session.allowedIps && session.allowedIps.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-neon-red/10 text-neon-red text-[10px] font-mono">
                        <Globe className="w-2.5 h-2.5" />
                        {session.allowedIps.length} IP{session.allowedIps.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Budget progress bar */}
                  {session.maxBudget !== null && (
                    <BudgetBar spent={session.totalCost} limit={session.maxBudget} />
                  )}
                </div>
              )}

              {status === "active" && (
                <button
                  onClick={() => {
                    if (confirm(`Kill session "${session.label}"?`)) {
                      killSession.mutate({ sessionId: session.id });
                    }
                  }}
                  disabled={killSession.isPending}
                  className="inline-flex items-center gap-1 text-neon-red hover:text-neon-red/80 transition-colors px-1.5 py-0.5 rounded hover:bg-neon-red/5"
                >
                  <Power className="w-3 h-3" />
                  Kill
                </button>
              )}
            </div>
          );
        })}
      </div>
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
  const [showSessions, setShowSessions] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const utils = trpc.useUtils();

  const provider = PROVIDERS[item.provider as ProviderId] ?? PROVIDERS.other;

  const { data: sessions } = trpc.proxy.listSessions.useQuery({
    vaultKeyId: item.id,
  });
  const activeSessionCount =
    sessions?.filter((s) => s.isActive && !s.isExpired).length ?? 0;

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

  // Determine if provider is supported for proxying
  const isProxySupported = ["openai", "anthropic", "google", "nebius"].includes(
    item.provider
  );

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
        <div className="flex items-center gap-2">
          {activeSessionCount > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-neon-cyan/10 text-neon-cyan">
              {activeSessionCount} session{activeSessionCount !== 1 ? "s" : ""}
            </span>
          )}
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

        {item.isActive && isProxySupported && (
          <button
            onClick={() => setShowTokenModal(true)}
            className="flex items-center gap-1.5 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors p-1.5 rounded hover:bg-neon-cyan/5"
          >
            <Wifi className="w-3.5 h-3.5" />
            Proxy Token
          </button>
        )}

        {sessions && sessions.length > 0 && (
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors p-1.5 rounded hover:bg-void-200"
          >
            {showSessions ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Sessions
          </button>
        )}

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

      {/* Expandable sessions table */}
      <AnimatePresence>
        {showSessions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 mt-3 border-t border-void-300/50">
              <SessionsTable vaultKeyId={item.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token generation modal */}
      {showTokenModal && (
        <GenerateTokenModal
          onClose={() => setShowTokenModal(false)}
          vaultKeyId={item.id}
          provider={item.provider}
        />
      )}
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
            AES-256-GCM encrypted. Per-session rate limits, budget caps, model & IP controls.
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
          {killStatus.activeSessions > 0 && (
            <>
              <span className="text-text-muted">|</span>
              <span className="text-neon-cyan">
                {killStatus.activeSessions} proxy session{killStatus.activeSessions !== 1 ? "s" : ""}
              </span>
            </>
          )}
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
