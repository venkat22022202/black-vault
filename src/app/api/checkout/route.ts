import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { razorpay } from "@/lib/razorpay";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { plan, amount } = await req.json();

  try {
    const order = await razorpay.orders.create({
      amount: amount * 100, // Razorpay uses paise (INR cents)
      currency: "INR",
      receipt: `bv_${userId}_${Date.now()}`,
      notes: {
        clerkId: userId,
        plan: plan ?? "pro",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
