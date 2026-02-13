import { NextResponse } from "next/server";

// Stripe integration removed — payments not active during beta.
export async function POST() {
  return NextResponse.json(
    { error: "Payments are not active during the beta period." },
    { status: 410 }
  );
}
