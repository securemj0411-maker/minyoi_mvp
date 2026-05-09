import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
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

  after(async () => {
    try {
      const result = await runPipeline(2);
      console.log("[cron/collect]", result);
    } catch (err) {
      console.error("[cron/collect]", err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ ok: true, started: true, ts: new Date().toISOString() });
}
