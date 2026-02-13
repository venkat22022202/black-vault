import { NextResponse } from "next/server";

// Stripe integration is not active — payments are handled via Razorpay.
// This endpoint returns 410 Gone to clearly signal it's decommissioned.
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is no longer active. Use the Razorpay webhook instead." },
    { status: 410 }
  );
}
