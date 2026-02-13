import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find or create Stripe customer
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, userId))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Search for existing Stripe customer by metadata
  const customers = await stripe.customers.list({
    limit: 1,
    email: undefined,
  });

  // Find customer with matching clerkId in metadata
  const existingCustomer = customers.data.find(
    (c) => c.metadata?.clerkId === userId
  );

  if (!existingCustomer) {
    return NextResponse.json(
      { error: "No active subscription found. Please subscribe first." },
      { status: 400 }
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: existingCustomer.id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
  });

  return NextResponse.json({ url: session.url });
}
