import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { failCollectRun, finishCollectRun, startCollectRun } from "@/lib/collect-logs";
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

  const triggerSource = req.headers.get("x-cron-source") ?? req.headers.get("user-agent") ?? "cron";
  const run = await startCollectRun(triggerSource.slice(0, 80));
  const waitForResult = req.nextUrl.searchParams.get("wait") === "1";

  if (waitForResult) {
    try {
      const result = await runPipeline(2);
      await finishCollectRun(run.id, run.startedAt, result);
      return NextResponse.json({ ok: true, started: true, completed: true, runId: run.id, result, ts: run.startedAt });
    } catch (err) {
      await failCollectRun(run.id, run.startedAt, err);
      return NextResponse.json(
        { ok: false, started: true, completed: true, runId: run.id, error: err instanceof Error ? err.message : String(err), ts: run.startedAt },
        { status: 500 },
      );
    }
  }

  after(async () => {
    try {
      const result = await runPipeline(2);
      await finishCollectRun(run.id, run.startedAt, result);
      console.log("[cron/collect]", result);
    } catch (err) {
      await failCollectRun(run.id, run.startedAt, err);
      console.error("[cron/collect]", err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ ok: true, started: true, runId: run.id, ts: run.startedAt });
}
