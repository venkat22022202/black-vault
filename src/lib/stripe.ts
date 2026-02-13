import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
});

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    maxKeys: 3,
    features: [
      "3 API keys in vault",
      "Basic cost dashboard",
      "Browse agent registry",
      "Community support",
    ],
  },
  pro: {
    name: "Pro",
    price: 9,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    maxKeys: 50,
    features: [
      "50 API keys in vault",
      "Advanced cost analytics",
      "Budget alerts & notifications",
      "Agent replay (30-day history)",
      "Workflow blueprints",
      "Priority support",
    ],
  },
  team: {
    name: "Team",
    price: 29,
    priceId: process.env.STRIPE_TEAM_PRICE_ID,
    maxKeys: 999,
    features: [
      "Unlimited API keys",
      "Shared team vaults",
      "Team cost tracking",
      "Role-based access control",
      "SSO integration",
      "90-day replay history",
      "Dedicated support",
    ],
  },
} as const;

export type PlanId = keyof typeof PLANS;
