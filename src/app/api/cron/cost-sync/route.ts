import { NextResponse } from "next/server";

// Cost sync cron is no longer needed — costs are tracked in real-time via proxy logs.
export async function GET() {
  return NextResponse.json({
    success: true,
    message: "Cost sync is no longer needed. Costs are tracked via the proxy gateway.",
  });
}
