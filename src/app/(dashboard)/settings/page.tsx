"use client";

import { motion } from "framer-motion";
import {
  Settings,
  User,
  Shield,
  CreditCard,
  Github,
  Calendar,
  Crown,
  Loader2,
  Check,
  ExternalLink,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useUser, useClerk } from "@clerk/nextjs";
import Link from "next/link";

export default function SettingsPage() {
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const { data: dbUser, isLoading } = trpc.user.me.useQuery();
  const utils = trpc.useUtils();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (dbUser) {
      setDisplayName(dbUser.displayName ?? "");
      setBio(dbUser.bio ?? "");
      setGithubUrl(dbUser.githubUrl ?? "");
    }
  }, [dbUser]);

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      utils.user.me.invalidate();
      setSaved(true);
      toast.success("Profile updated!");
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (err) => toast.error(err.message || "Failed to update profile"),
  });

  const handleSave = () => {
    updateMutation.mutate({
      displayName: displayName.trim() || undefined,
      bio: bio.trim(),
      githubUrl: githubUrl.trim(),
    });
  };

  const { data: vaultKeys } = trpc.vault.getAll.useQuery();
  const keyCount = vaultKeys?.length ?? 0;

  const planLabel = "Beta";
  const planColor = "text-neon-green";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-neon-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <Settings className="w-6 h-6 text-text-secondary" />
          Settings
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Manage your account and preferences.
        </p>
      </div>

      {/* Profile Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-5 flex items-center gap-2">
          <User className="w-4 h-4 text-neon-green" />
          Profile
        </h2>

        <div className="flex items-center gap-4 mb-6">
          {clerkUser?.imageUrl ? (
            <img
              src={clerkUser.imageUrl}
              alt="Avatar"
              className="w-14 h-14 rounded-full border-2 border-void-300"
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-void-200 flex items-center justify-center text-lg font-bold text-text-muted">
              {displayName?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div>
            <div className="text-sm font-medium text-text-primary">
              {clerkUser?.emailAddresses[0]?.emailAddress}
            </div>
            <div className="text-xs text-text-muted">
              @{dbUser?.username}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-text-muted mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={3}
              maxLength={300}
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30 resize-none"
            />
            <div className="text-xs text-text-muted text-right mt-1">
              {bio.length}/300
            </div>
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1.5 flex items-center gap-1">
              <Github className="w-3 h-3" />
              GitHub URL
            </label>
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/yourusername"
              className="w-full rounded-lg border border-void-300 bg-void-200 px-3 py-2.5 text-sm text-text-primary placeholder-text-muted font-mono focus:border-neon-green focus:outline-none focus:ring-1 focus:ring-neon-green/30"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="rounded-lg bg-neon-green px-6 py-2.5 text-sm font-semibold text-black hover:bg-neon-green/90 transition-all hover:shadow-[0_0_20px_rgba(0,255,136,0.3)] disabled:opacity-50 flex items-center gap-2"
          >
            {updateMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <Check className="w-4 h-4" />
            ) : null}
            {saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </motion.div>

      {/* Plan & Usage Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-5 flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-neon-purple" />
          Plan & Usage
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Crown className={cn("w-4 h-4", planColor)} />
                <span className={cn("text-sm font-semibold", planColor)}>
                  {planLabel} Plan
                </span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                All features unlocked during beta. No limits.
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neon-green/10 text-neon-green border border-neon-green/20">
              ACTIVE
            </span>
          </div>

          <div className="border-t border-void-300/50 pt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-text-muted">Vault Keys Stored</span>
              <span className="font-mono text-text-primary">
                {keyCount} / &infin;
              </span>
            </div>
            <div className="text-xs text-text-muted">
              No limits during beta
            </div>
          </div>
        </div>
      </motion.div>

      {/* Account Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-xl border border-void-300 bg-void-50 p-6"
      >
        <h2 className="text-sm font-semibold text-text-primary mb-5 flex items-center gap-2">
          <Shield className="w-4 h-4 text-neon-cyan" />
          Account
        </h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">Member since</div>
              <div className="text-xs text-text-muted flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {dbUser?.createdAt
                  ? new Date(dbUser.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-text-primary">Encryption</div>
              <div className="text-xs text-text-muted">
                AES-256-GCM with per-user derived keys via HKDF
              </div>
            </div>
            <span className="text-xs bg-neon-green/10 text-neon-green px-2 py-0.5 rounded-full">
              Active
            </span>
          </div>

          <div className="border-t border-void-300/50 pt-4">
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="rounded-lg border border-void-400 px-4 py-2 text-sm text-text-secondary hover:text-neon-red hover:border-neon-red/30 transition-all"
            >
              Sign Out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
