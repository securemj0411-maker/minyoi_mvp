import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  runPipeline(2)
    .then((result) => console.log("[cron/collect]", result))
    .catch((err) => console.error("[cron/collect]", err instanceof Error ? err.message : String(err)));

  return NextResponse.json({ ok: true, started: true, ts: new Date().toISOString() });
}
