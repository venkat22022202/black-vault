import { NextResponse } from "next/server";
import { syncAllUserCosts } from "@/server/services/cost-sync";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");

  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncAllUserCosts();
  return NextResponse.json({ success: true, ...result });
}
