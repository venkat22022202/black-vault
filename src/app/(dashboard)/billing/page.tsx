"use client";

import { motion } from "framer-motion";
import {
  Check,
  CreditCard,
  Sparkles,
  Zap,
  Users,
  Crown,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    priceINR: 0,
    period: "",
    description: "For getting started with AI agent management",
    icon: Zap,
    color: "text-text-secondary",
    borderColor: "border-void-300",
    features: [
      "3 API keys in vault",
      "Basic cost dashboard",
      "Browse agent registry",
      "Community support",
    ],
    cta: "Current Plan",
    disabled: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: 9,
    priceINR: 749,
    period: "/mo",
    description: "For developers running multiple AI agents daily",
    icon: Crown,
    color: "text-neon-green",
    borderColor: "border-neon-green/40",
    popular: true,
    features: [
      "50 API keys in vault",
      "Advanced cost analytics & charts",
      "Budget alerts & notifications",
      "Agent replay (30-day history)",
      "Unlimited workflow blueprints",
      "Priority email support",
    ],
    cta: "Upgrade to Pro",
    disabled: false,
  },
  {
    id: "team",
    name: "Team",
    price: 29,
    priceINR: 2499,
    period: "/seat/mo",
    description: "For teams building with AI at scale",
    icon: Users,
    color: "text-neon-purple",
    borderColor: "border-neon-purple/40",
    features: [
      "Unlimited API keys",
      "Shared team vaults",
      "Team cost tracking & budgets",
      "Role-based access control",
      "SSO integration",
      "90-day replay history",
      "Dedicated Slack support",
    ],
    cta: "Upgrade to Team",
    disabled: false,
  },
];

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BillingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const success = searchParams.get("success");

  const handleUpgrade = async (planId: string, amountINR: number) => {
    setLoading(planId);

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      toast.error("Failed to load payment gateway");
      setLoading(null);
      return;
    }

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, amount: amountINR }),
      });
      const data = await res.json();

      if (!data.orderId) {
        toast.error("Failed to create order");
        setLoading(null);
        return;
      }

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "BlackVault",
        description: `${planId === "pro" ? "Pro" : "Team"} Plan Subscription`,
        order_id: data.orderId,
        handler: () => {
          toast.success("Payment successful! Your plan has been upgraded.");
          window.location.href = "/billing?success=true";
        },
        prefill: {},
        theme: {
          color: "#00FF88",
          backdrop_color: "#000000",
        },
        modal: {
          ondismiss: () => setLoading(null),
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rzp = new ((window as any).Razorpay)(options);
      rzp.open();
    } catch {
      toast.error("Payment initiation failed");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <CreditCard className="w-6 h-6 text-neon-green" />
          Billing & Plans
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Upgrade to unlock more vault slots, advanced analytics, and team features.
        </p>
      </div>

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-neon-green/30 bg-neon-green/10 p-4 text-sm text-neon-green flex items-center gap-2"
        >
          <Check className="w-5 h-5" />
          Payment successful! Your plan has been upgraded.
        </motion.div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan, i) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className={cn(
              "relative rounded-xl border bg-void-50 p-6 flex flex-col",
              plan.borderColor,
              plan.popular &&
                "ring-1 ring-neon-green/30 shadow-[0_0_30px_rgba(0,255,136,0.08)]"
            )}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-neon-green px-3 py-1 text-xs font-semibold text-black">
                  <Sparkles className="w-3 h-3" />
                  Most Popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <plan.icon className={cn("w-5 h-5", plan.color)} />
                <span className="text-sm font-semibold text-text-primary">{plan.name}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className={cn("text-4xl font-bold font-mono", plan.color)}>
                  ${plan.price}
                </span>
                {plan.period && (
                  <span className="text-sm text-text-muted">{plan.period}</span>
                )}
              </div>
              {plan.priceINR > 0 && (
                <div className="text-xs text-text-muted">
                  ~INR {plan.priceINR}{plan.period}
                </div>
              )}
              <p className="text-xs text-text-muted mt-2">{plan.description}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className={cn("w-4 h-4 mt-0.5 shrink-0", plan.color)} />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => !plan.disabled && handleUpgrade(plan.id, plan.priceINR)}
              disabled={plan.disabled || loading === plan.id}
              className={cn(
                "w-full rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2",
                plan.disabled
                  ? "bg-void-200 text-text-muted cursor-not-allowed"
                  : plan.popular
                  ? "bg-neon-green text-black hover:bg-neon-green/90 hover:shadow-[0_0_20px_rgba(0,255,136,0.3)]"
                  : "bg-void-200 text-text-primary hover:bg-void-300 border border-void-400"
              )}
            >
              {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : plan.cta}
            </button>
          </motion.div>
        ))}
      </div>

      {/* Payment Methods Info */}
      <div className="rounded-xl border border-void-300 bg-void-50 p-6">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Accepted Payment Methods</h3>
        <div className="flex flex-wrap gap-3 text-xs text-text-muted">
          {["Visa", "Mastercard", "Amex", "UPI", "Google Pay", "Net Banking", "Wallets"].map((m) => (
            <span key={m} className="rounded-full bg-void-200 px-3 py-1.5 border border-void-300">
              {m}
            </span>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="space-y-4 max-w-2xl">
        <h3 className="text-sm font-semibold text-text-primary">FAQ</h3>
        {[
          {
            q: "What payment methods do you accept?",
            a: "All major credit/debit cards, UPI, Google Pay, net banking, and popular wallets via Razorpay.",
          },
          {
            q: "Can I cancel anytime?",
            a: "Yes. You keep access until the end of your billing period. No questions asked.",
          },
          {
            q: "What happens to my keys if I downgrade?",
            a: "Your keys stay encrypted and safe. You can still view/copy them, but can't add new ones beyond the free limit.",
          },
        ].map((item) => (
          <div key={item.q} className="rounded-lg border border-void-300 bg-void-50 p-4">
            <div className="text-sm font-medium text-text-primary mb-1">{item.q}</div>
            <div className="text-xs text-text-muted">{item.a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
