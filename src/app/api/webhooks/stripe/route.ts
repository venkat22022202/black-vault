import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const clerkId = session.metadata?.clerkId;
      const plan = session.metadata?.plan;

      if (clerkId && plan) {
        await db
          .update(users)
          .set({
            plan,
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkId = subscription.metadata?.clerkId;

      if (clerkId) {
        const isActive =
          subscription.status === "active" ||
          subscription.status === "trialing";

        await db
          .update(users)
          .set({
            plan: isActive ? (subscription.metadata?.plan ?? "pro") : "free",
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const clerkId = subscription.metadata?.clerkId;

      if (clerkId) {
        await db
          .update(users)
          .set({
            plan: "free",
            updatedAt: new Date(),
          })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
