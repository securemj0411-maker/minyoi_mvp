// Wave 186 (2026-05-17): 일일 핵심 테이블 백업 — PITR 대안 (cost 0).
// 메모리 노트 우선순위: "시세 historical 한 번 잃으면 못 돌림"
// PITR 보류 (Wave 184b: C 옵션) 결정 후 mitigation.
//
// 흐름:
// 1. 매일 새벽 (스케줄러 트리거, KST 04:00 권장) `/api/cron/daily-backup` 호출
// 2. 핵심 테이블 N개 SELECT → JSON Lines
// 3. Supabase Storage (`mvp-backups` bucket) PUT — `YYYY-MM-DD/<table>.jsonl`
// 4. 30일 전 backup 폴더 자동 삭제 (보관 정책)
//
// 핵심 테이블 (메모리 노트 + 사업 보고서 우선순위):
// - mvp_market_price_daily       시세 historical (가장 critical)
// - mvp_market_velocity_daily    회전 historical
// - mvp_listing_parsed           parser 결과 (재계산 비용 큼)
// - mvp_candidate_pool           풀 상태
// - mvp_reveal_feedback          사용자 피드백 (보호 필수)
// - mvp_user_credits             사용자 토큰 잔액 (보호 필수)
// - mvp_user_plans               결제 plan

import { NextResponse, type NextRequest } from "next/server";
import { checkCronAuth } from "@/lib/cron-auth";
import { cronProjectRoleSkip } from "@/lib/cron-guard";
import { logAndRespond } from "@/lib/error-response";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90; // Vercel hobby 60s / pro 300s — pro 가정 시 늘릴 수 있음

const BUCKET = "mvp-backups";
const RETENTION_DAYS = 30;
const CHUNK_SIZE = 5000; // PostgREST 단일 쿼리 limit (페이지네이션)

// 핵심 테이블 우선순위 — 작은 것부터 (timeout 안전).
const CORE_TABLES = [
  { name: "mvp_user_credits", critical: true, idCol: "id" },
  { name: "mvp_user_plans", critical: true, idCol: "id" },
  { name: "mvp_reveal_feedback", critical: true, idCol: "id" },
  { name: "mvp_candidate_pool", critical: true, idCol: "pid" },
  { name: "mvp_market_velocity_daily", critical: true, idCol: "date" },
  { name: "mvp_market_price_daily", critical: true, idCol: "date" },
  { name: "mvp_listing_parsed", critical: false, idCol: "pid" }, // 큰 테이블 — 마지막
];

function storageBase(): string {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/$/, "") + "/storage/v1";
}

async function fetchTablePaginated(table: string, idCol: string): Promise<unknown[]> {
  const all: unknown[] = [];
  let offset = 0;
  while (true) {
    const url = `${tableUrl(table)}?select=*&order=${idCol}.asc&limit=${CHUNK_SIZE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const rows = (await res.json()) as unknown[];
    if (!Array.isArray(rows) || rows.length === 0) break;
    all.push(...rows);
    offset += CHUNK_SIZE;
    if (rows.length < CHUNK_SIZE) break;
  }
  return all;
}

async function uploadToStorage(path: string, body: string): Promise<{ ok: boolean; size: number; status?: number; error?: string }> {
  const url = `${storageBase()}/object/${BUCKET}/${path}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  // upsert (이미 박혀있으면 덮어쓰기) — 같은 날 두 번 실행 시 동일 결과.
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
      "x-upsert": "true",
    },
    body,
  });
  if (!res.ok) {
    return { ok: false, size: body.length, status: res.status, error: await res.text().catch(() => "?") };
  }
  return { ok: true, size: body.length, status: res.status };
}

async function deleteFolder(folderPath: string): Promise<{ deleted: number; error?: string }> {
  // 1. List objects in folder
  const listUrl = `${storageBase()}/object/list/${BUCKET}`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");

  const listRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefix: folderPath, limit: 1000 }),
  });
  if (!listRes.ok) {
    return { deleted: 0, error: `list_failed_${listRes.status}` };
  }
  const objects = (await listRes.json()) as Array<{ name: string }>;
  if (objects.length === 0) return { deleted: 0 };

  // 2. Batch delete
  const deleteUrl = `${storageBase()}/object/${BUCKET}`;
  const deleteRes = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${key}`,
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prefixes: objects.map((o) => `${folderPath}/${o.name}`) }),
  });
  if (!deleteRes.ok) {
    return { deleted: 0, error: `delete_failed_${deleteRes.status}` };
  }
  return { deleted: objects.length };
}

export async function POST(req: NextRequest) {
  return GET(req);
}

export async function GET(req: NextRequest) {
  const auth = checkCronAuth(req);
  if (!auth.authOk) {
    return NextResponse.json({ error: "unauthorized", reason: auth.authReason }, { status: 401 });
  }
  const roleSkip = cronProjectRoleSkip("daily_backup");
  if (roleSkip) return NextResponse.json(roleSkip);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const oldDate = new Date();
  oldDate.setUTCDate(oldDate.getUTCDate() - RETENTION_DAYS);
  const oldFolder = oldDate.toISOString().slice(0, 10);

  const results: Array<{
    table: string;
    rowCount?: number;
    sizeBytes?: number;
    ok: boolean;
    error?: string;
    durationMs?: number;
  }> = [];

  for (const { name, idCol } of CORE_TABLES) {
    const startedAt = Date.now();
    try {
      const rows = await fetchTablePaginated(name, idCol);
      // JSON Lines (jsonl) — 큰 테이블도 streaming 친화. 한 줄 = 한 row.
      const body = rows.map((r) => jsonBody(r)).join("\n");
      const upload = await uploadToStorage(`${today}/${name}.jsonl`, body);
      results.push({
        table: name,
        rowCount: rows.length,
        sizeBytes: body.length,
        ok: upload.ok,
        error: upload.error,
        durationMs: Date.now() - startedAt,
      });
    } catch (err) {
      results.push({
        table: name,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      });
    }
  }

  // 30일 보관 — 그 이전 폴더 자동 삭제 (destructive — 명시적 정책).
  let retention: { deleted: number; error?: string; folder: string } = { deleted: 0, folder: oldFolder };
  try {
    const res = await deleteFolder(oldFolder);
    retention = { ...res, folder: oldFolder };
  } catch (err) {
    retention.error = err instanceof Error ? err.message : String(err);
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.length - okCount;
  console.log("[cron/daily-backup] done", {
    date: today,
    okCount,
    failCount,
    totalRows: results.reduce((s, r) => s + (r.rowCount ?? 0), 0),
    totalBytes: results.reduce((s, r) => s + (r.sizeBytes ?? 0), 0),
    retention,
  });

  // 모든 테이블 실패 시 500, 일부만 실패면 207 (partial). 전부 성공이면 200.
  const status = failCount === 0 ? 200 : okCount === 0 ? 500 : 207;

  return NextResponse.json({
    ok: failCount === 0,
    date: today,
    results,
    retention,
    summary: {
      tables: results.length,
      ok: okCount,
      failed: failCount,
      totalRows: results.reduce((s, r) => s + (r.rowCount ?? 0), 0),
      totalBytes: results.reduce((s, r) => s + (r.sizeBytes ?? 0), 0),
    },
  }, { status });
}

// 미사용 import 차단용 (jsonBody는 fetchTablePaginated 안 row 직렬화에서만 호출 → ok).
void logAndRespond;
