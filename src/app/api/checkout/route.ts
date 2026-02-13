import { NextResponse } from "next/server";

// Checkout disabled during beta — all features are free.
export async function POST() {
  return NextResponse.json(
    {
      error: "Payments are not active during the beta period. All features are free.",
    },
    { status: 403 }
  );
}
