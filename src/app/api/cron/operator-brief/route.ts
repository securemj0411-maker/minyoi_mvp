// Wave 195 (2026-05-17): 운영자 daily brief — 매일 KST 08:00 텔레그램.
// 사이트 상태 요약 (사고 아님 — incident-watch와 별도).
//
// 집계 항목 (어제 vs 현재):
// - 어제 신규 가입 수
// - 어제 매수 신고 (bought feedback)
// - 어제 정보 오류 신고 + 카테고리 top
// - 어제 신규 풀 진입 매물
// - 현재 풀 ready 매물 수
// - 현재 검수 대기 (pending) 수
// - 어제 backup 폴더 파일 수
//
// 스케줄: vercel.json crons — schedule "0 23 * * *" (UTC 23:00 = KST 08:00).

import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { sendOperatorBrief } from "@/lib/operational-notifier";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUCKET = "mvp-backups";

function yesterdayDate(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function yesterdayStartIso(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function todayStartIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

async function countRows(table: string, filter: string): Promise<number> {
  const res = await restFetch(
    `${tableUrl(table)}?select=*&${filter}&limit=1`,
    { headers: { ...serviceHeaders(), Prefer: "count=exact" } },
  );
  return Number((res.headers.get("content-range") ?? "0-0/0").split("/")[1] ?? 0);
}

async function listBackupFiles(date: string): Promise<number> {
  const url = `${(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "")}/storage/v1/object/list/${BUCKET}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return -1;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, apikey: key, "content-type": "application/json" },
      body: JSON.stringify({ prefix: date, limit: 100 }),
    });
    if (!res.ok) return -1;
    const objects = (await res.json()) as Array<unknown>;
    return objects.length;
  } catch {
    return -1;
  }
}

async function topInaccurateCategory(yesterdayStart: string, todayStart: string): Promise<string> {
  // 카테고리 추출: note prefix `[라벨]`
  const res = await restFetch(
    `${tableUrl("mvp_reveal_feedback")}?select=note&feedback_type=eq.inaccurate_report&created_at=gte.${encodeURIComponent(yesterdayStart)}&created_at=lt.${encodeURIComponent(todayStart)}&limit=500`,
    { headers: serviceHeaders() },
  );
  const rows = (await res.json()) as Array<{ note: string }>;
  if (rows.length === 0) return "—";
  const counter = new Map<string, number>();
  for (const r of rows) {
    const match = /^\[([^\]]+)\]/.exec(r.note ?? "");
    const label = match ? match[1] : "기타";
    counter.set(label, (counter.get(label) ?? 0) + 1);
  }
  const top = [...counter.entries()].sort((a, b) => b[1] - a[1])[0];
  return top ? `${top[0]} ${top[1]}건` : "—";
}

export async function POST(req: NextRequest) { return GET(req); }

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json({ error: "unauthorized", reason: auth.authReason }, { status: 401 });
  }
  const roleSkip = cronProjectRoleSkip("operator_brief");
  if (roleSkip) return NextResponse.json(roleSkip);

  const yesterday = yesterdayDate();
  const yesterdayStart = yesterdayStartIso();
  const todayStart = todayStartIso();
  const yesterdayFilter = `created_at=gte.${encodeURIComponent(yesterdayStart)}&created_at=lt.${encodeURIComponent(todayStart)}`;

  try {
    // Promise.allSettled — 한 집계 실패해도 brief 나머지 진행.
    const results = await Promise.allSettled([
      countRows("mvp_user_credits", `created_at=gte.${encodeURIComponent(yesterdayStart)}&created_at=lt.${encodeURIComponent(todayStart)}`),
      countRows("mvp_reveal_feedback", `feedback_type=eq.bought&${yesterdayFilter}`),
      countRows("mvp_reveal_feedback", `feedback_type=eq.inaccurate_report&${yesterdayFilter}`),
      topInaccurateCategory(yesterdayStart, todayStart),
      countRows("mvp_candidate_pool", `added_at=gte.${encodeURIComponent(yesterdayStart)}&added_at=lt.${encodeURIComponent(todayStart)}`),
      countRows("mvp_candidate_pool", "status=eq.ready"),
      countRows("mvp_reveal_feedback", "feedback_type=eq.inaccurate_report&admin_status=is.null"),
      listBackupFiles(yesterday),
    ]);

    const v = (i: number, fallback: string | number) =>
      results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<typeof fallback>).value : fallback;

    const newSignups = v(0, "?");
    const yesterdayBought = v(1, "?");
    const yesterdayInaccurate = v(2, "?");
    const topCategory = v(3, "—");
    const yesterdayNewPool = v(4, "?");
    const poolReady = v(5, "?");
    const pendingReview = v(6, "?");
    const backupFiles = v(7, -1);
    const backupStatus = typeof backupFiles === "number" && backupFiles >= 7 ? `✅ ${backupFiles}개` : `⚠️ ${backupFiles}개`;

    const lines = [
      "📊 어제",
      `  신규 가입:     ${newSignups}명`,
      `  매수 신고:     ${yesterdayBought}건`,
      `  정보 오류 신고: ${yesterdayInaccurate}건 (top: ${topCategory})`,
      `  풀 신규 진입:  ${yesterdayNewPool}건`,
      `  일일 백업:     ${backupStatus} (${yesterday})`,
      "",
      "📦 현재",
      `  풀 ready:       ${poolReady}건`,
      `  검수 대기:      ${pendingReview}건`,
    ];

    const notifyResult = await sendOperatorBrief({
      title: "[득템잡이] 운영 brief",
      lines,
    });

    console.log("[cron/operator-brief] sent", { lines: lines.length, notifyResult });

    return NextResponse.json({
      ok: true,
      yesterday,
      stats: { newSignups, yesterdayBought, yesterdayInaccurate, topCategory, yesterdayNewPool, poolReady, pendingReview, backupFiles },
      notify: notifyResult,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/operator-brief] failed", { err: message });
    return NextResponse.json({ error: "operator_brief_failed" }, { status: 500 });
  }
}
