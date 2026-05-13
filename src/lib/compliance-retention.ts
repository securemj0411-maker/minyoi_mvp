// Compliance retention 격리 모듈.
// 코어 runtime (tick-pipeline.ts)과 분리하여 blast radius를 줄인다.
// 새로운 compliance 작업 (seller hash, 이미지 URL retention 등) 은 이 모듈에 추가한다.

import { jsonBody, restFetch, rpcUrl, serviceHeaders } from "./supabase-rest";

// 매뉴얼 Layer 2 — 잡코리아 패소 패턴 회피 (raw text 영구 보유 → 90/30일 TTL).
// active 매물: description_preview + raw_json (90일). name/이미지 URL 보존.
// dead 매물 (sold_confirmed/disappeared/archived): name + description_preview + raw_json (30일).
// 이미지 URL 삭제는 Wave 1.2 별도 검토.
export const RAW_TEXT_ACTIVE_RETENTION_DAYS = 90;
export const RAW_TEXT_DEAD_RETENTION_DAYS = 30;
export const RAW_TEXT_RETENTION_BATCH_LIMIT = 5000;

export type RawTextRetentionStep =
  | {
      scope: "active" | "dead";
      fnName: string;
      days: number;
      batchLimit: number;
      durationMs: number;
      ok: true;
      count: number;
    }
  | {
      scope: "active" | "dead";
      fnName: string;
      days: number;
      batchLimit: number;
      durationMs: number;
      ok: false;
      error: string;
    };

export type RawTextRetentionResult = {
  dryRun: boolean;
  steps: RawTextRetentionStep[];
};

async function callPruneRpc(
  fnName: string,
  args: { p_days: number; p_batch_limit: number; p_dry_run: boolean },
): Promise<number> {
  const res = await restFetch(rpcUrl(fnName), {
    method: "POST",
    headers: serviceHeaders(),
    body: jsonBody(args),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => "<no body>");
    throw new Error(`[compliance-retention] ${fnName} HTTP ${res.status}: ${errBody}`);
  }

  const body = await res.text();
  const trimmed = body.trim();
  // PostgREST는 bigint scalar를 JSON 문자열 "123" 또는 숫자 123으로 반환할 수 있다.
  // 두 경우 모두 처리하고, 어느 쪽도 아니면 throw (0으로 삼키지 않음).
  let parsed: number | null = null;
  try {
    const json = JSON.parse(trimmed);
    if (typeof json === "number" && Number.isFinite(json)) {
      parsed = json;
    } else if (typeof json === "string") {
      const n = Number.parseInt(json, 10);
      if (Number.isFinite(n)) parsed = n;
    }
  } catch {
    const n = Number.parseInt(trimmed, 10);
    if (Number.isFinite(n)) parsed = n;
  }

  if (parsed === null) {
    throw new Error(`[compliance-retention] ${fnName} non-numeric body: ${trimmed.slice(0, 200)}`);
  }
  return parsed;
}

export async function runRawTextRetention(options: {
  dryRun: boolean;
  activeDays?: number;
  deadDays?: number;
  batchLimit?: number;
}): Promise<RawTextRetentionResult> {
  const activeDays = Math.max(1, Math.min(options.activeDays ?? RAW_TEXT_ACTIVE_RETENTION_DAYS, 3650));
  const deadDays = Math.max(1, Math.min(options.deadDays ?? RAW_TEXT_DEAD_RETENTION_DAYS, 3650));
  const batchLimit = Math.max(1, Math.min(options.batchLimit ?? RAW_TEXT_RETENTION_BATCH_LIMIT, 50000));

  const plan: Array<{ scope: "active" | "dead"; fnName: string; days: number }> = [
    { scope: "active", fnName: "prune_raw_listings_active_text", days: activeDays },
    { scope: "dead", fnName: "prune_raw_listings_dead_text", days: deadDays },
  ];

  const steps: RawTextRetentionStep[] = [];

  for (const item of plan) {
    const startedAt = Date.now();
    try {
      const count = await callPruneRpc(item.fnName, {
        p_days: item.days,
        p_batch_limit: batchLimit,
        p_dry_run: options.dryRun,
      });
      steps.push({
        scope: item.scope,
        fnName: item.fnName,
        days: item.days,
        batchLimit,
        durationMs: Date.now() - startedAt,
        ok: true,
        count,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({
        scope: item.scope,
        fnName: item.fnName,
        days: item.days,
        batchLimit,
        durationMs: Date.now() - startedAt,
        ok: false,
        error: message,
      });
      // dead step 실패해도 active 결과는 이미 반영됨 (또는 그 반대).
      // 호출자(route)가 ok=false인 step을 보고 응답 status 결정.
    }
  }

  return { dryRun: options.dryRun, steps };
}
