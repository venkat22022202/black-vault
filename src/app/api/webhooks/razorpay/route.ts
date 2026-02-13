import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// This is now a Razorpay webhook handler (kept at same path for simplicity)
export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("x-razorpay-signature");

  if (!signature || !process.env.RAZORPAY_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 });
  }

  // Verify Razorpay webhook signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body);

  switch (event.event) {
    case "payment.captured": {
      const payment = event.payload.payment.entity;
      const clerkId = payment.notes?.clerkId;
      const plan = payment.notes?.plan;

      if (clerkId && plan) {
        await db
          .update(users)
          .set({ plan, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }

    case "subscription.activated": {
      const subscription = event.payload.subscription.entity;
      const clerkId = subscription.notes?.clerkId;
      const plan = subscription.notes?.plan;

      if (clerkId && plan) {
        await db
          .update(users)
          .set({ plan, updatedAt: new Date() })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }

    case "subscription.cancelled": {
      const subscription = event.payload.subscription.entity;
      const clerkId = subscription.notes?.clerkId;

      if (clerkId) {
        await db
          .update(users)
          .set({ plan: "free", updatedAt: new Date() })
          .where(eq(users.clerkId, clerkId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
