import Razorpay from "razorpay";

export const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
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
    priceUSD: 9,
    priceINR: 749,
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
    priceUSD: 29,
    priceINR: 2499,
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
