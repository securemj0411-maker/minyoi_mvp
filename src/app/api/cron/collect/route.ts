import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

// Vercel cron 또는 외부 cron(cron-job.org 등)에서 호출.
// CRON_SECRET 환경변수로 인증한다.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runPipeline(2);
    return NextResponse.json({ ok: true, ...result, ts: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/collect]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
