import { NextRequest, NextResponse } from "next/server";

import {
  RAW_TEXT_ACTIVE_RETENTION_DAYS,
  RAW_TEXT_DEAD_RETENTION_DAYS,
  RAW_TEXT_RETENTION_BATCH_LIMIT,
  runRawTextRetention,
  type RawTextRetentionResult,
  type RawTextRetentionStep,
} from "@/lib/compliance-retention";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuard, cronGuardSkipBody } from "@/lib/cron-guard";

export const maxDuration = 60;

function parseIntParam(value: string | null, fallback: number, min: number, max: number): number {
  if (value === null) return fallback;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseBoolParam(value: string | null): boolean {
  if (value === null) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isOkStep(step: RawTextRetentionStep): step is RawTextRetentionStep & { ok: true; count: number } {
  return step.ok === true;
}

async function handleComplianceRetention(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) {
    return NextResponse.json(
      { ok: false, mode: "compliance-retention", error: "unauthorized", reason: authReason },
      { status: 401 },
    );
  }

  const guard = acquireCronGuard("compliance_retention", req);
  if (!guard.allowed) {
    return NextResponse.json(cronGuardSkipBody(guard));
  }

  const params = req.nextUrl.searchParams;
  const dryRun = parseBoolParam(params.get("dry_run"));
  const activeDays = parseIntParam(params.get("active_days"), RAW_TEXT_ACTIVE_RETENTION_DAYS, 1, 3650);
  const deadDays = parseIntParam(params.get("dead_days"), RAW_TEXT_DEAD_RETENTION_DAYS, 1, 3650);
  const batchLimit = parseIntParam(params.get("batch_limit"), RAW_TEXT_RETENTION_BATCH_LIMIT, 1, 50000);
  const startedAt = new Date().toISOString();

  try {
    const result: RawTextRetentionResult = await runRawTextRetention({
      dryRun,
      activeDays,
      deadDays,
      batchLimit,
    });

    const hasFailure = result.steps.some((step) => !step.ok);
    const totalCount = result.steps.filter(isOkStep).reduce((sum, step) => sum + step.count, 0);

    console.info("[compliance-retention] run complete", {
      startedAt,
      dryRun: result.dryRun,
      hasFailure,
      totalCount,
      params: { activeDays, deadDays, batchLimit },
      steps: result.steps,
    });

    return NextResponse.json(
      {
        ok: !hasFailure,
        mode: "compliance-retention",
        dryRun: result.dryRun,
        params: { activeDays, deadDays, batchLimit },
        totalCount,
        steps: result.steps,
        startedAt,
      },
      { status: hasFailure ? 207 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[compliance-retention] route caught", { startedAt, message });
    return NextResponse.json(
      {
        ok: false,
        mode: "compliance-retention",
        error: message,
        startedAt,
      },
      { status: 500 },
    );
  } finally {
    guard.release();
  }
}

export async function GET(req: NextRequest) {
  return handleComplianceRetention(req);
}

export async function POST(req: NextRequest) {
  return handleComplianceRetention(req);
}
