#!/usr/bin/env tsx
/**
 * Wave 132 (2026-05-16): one-time backfill — 현재 pool 매물의 num_comment 채우고
 * num_comment >= 8 매물 pool에서 invalidate.
 *
 * 실행: npx tsx scripts/wave132-backfill-num-comment.ts
 *
 * 동작:
 *  1. mvp_candidate_pool status IN ('ready', 'reserved') pid list (default ~1700건)
 *  2. 병렬(c=10) bunjang detail API fetch → commentCount 추출
 *  3. mvp_raw_listings.num_comment UPDATE (batch)
 *  4. num_comment >= 8 매물 → invalidate_mvp_pool_entry RPC 호출 (pool 떨어뜨림)
 *  5. 통계 출력
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

// .env.local 수동 로드 (다른 backfill 스크립트와 동일 패턴)
async function loadEnvFile(filePath: string): Promise<void> {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

const NUM_COMMENT_THRESHOLD = 8;
const CONCURRENCY = 10;

type PoolPid = { pid: number };

async function loadPoolPids(): Promise<number[]> {
  const url = `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&limit=5000`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as PoolPid[];
  return rows.map((r) => Number(r.pid)).filter((p) => Number.isFinite(p));
}

async function patchNumComment(pid: number, numComment: number): Promise<void> {
  const url = `${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`;
  const res = await restFetch(url, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ num_comment: numComment, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) {
    throw new Error(`patch num_comment failed pid=${pid} status=${res.status}`);
  }
}

async function invalidatePoolEntry(pid: number, reason: string): Promise<void> {
  // SECURITY DEFINER RPC. 별도 invalidation 함수 호출 (pool entry status='invalidated').
  const url = rpcUrl("invalidate_mvp_pool_entry");
  const res = await restFetch(url, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ p_pid: pid, p_reason: reason }),
  });
  if (!res.ok) {
    // RPC 실패 시 직접 UPDATE fallback
    const fallbackUrl = `${tableUrl("mvp_candidate_pool")}?pid=eq.${pid}`;
    await restFetch(fallbackUrl, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        status: "invalidated",
        invalidated_reason: reason,
        updated_at: new Date().toISOString(),
      }),
    });
  }
}

async function processOne(pid: number): Promise<{
  pid: number;
  numComment: number | null;
  invalidated: boolean;
  error: string | null;
}> {
  try {
    const detail = await fetchDetail(String(pid));
    if (!detail) {
      return { pid, numComment: null, invalidated: false, error: "detail_null" };
    }
    const numComment = detail.commentCount ?? 0;
    await patchNumComment(pid, numComment);
    if (numComment >= NUM_COMMENT_THRESHOLD) {
      await invalidatePoolEntry(pid, `num_comment_above_${NUM_COMMENT_THRESHOLD}`);
      return { pid, numComment, invalidated: true, error: null };
    }
    return { pid, numComment, invalidated: false, error: null };
  } catch (err) {
    return {
      pid,
      numComment: null,
      invalidated: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.join(__dirname, "..");
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  // --probe <pid,pid,…> 모드: detail API 응답 진단용
  const probeArg = process.argv.find((a) => a.startsWith("--probe="));
  if (probeArg) {
    const probePids = probeArg.slice("--probe=".length).split(",").map(Number).filter(Number.isFinite);
    console.log(`[probe mode] fetching ${probePids.length} pids…`);
    for (const pid of probePids) {
      const d = await fetchDetail(String(pid));
      console.log(`  pid=${pid} commentCount=${d?.commentCount ?? "null"} viewCount=${d?.viewCount ?? "null"} fav=${d?.favoriteCount ?? "null"} status=${d?.saleStatus ?? "null"}`);
    }
    return;
  }

  console.log("Wave 132 backfill: loading pool pids…");
  const pids = await loadPoolPids();
  console.log(`Pool 매물 ${pids.length}건 — 댓글수 fetch 시작 (concurrency=${CONCURRENCY})`);

  const start = Date.now();
  const results: Array<Awaited<ReturnType<typeof processOne>>> = [];
  for (let i = 0; i < pids.length; i += CONCURRENCY) {
    const wave = pids.slice(i, i + CONCURRENCY);
    const waveResults = await Promise.all(wave.map(processOne));
    results.push(...waveResults);
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= pids.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${Math.min(i + CONCURRENCY, pids.length)}/${pids.length} 처리 (${elapsed}s)`);
    }
  }

  const succeeded = results.filter((r) => r.error === null);
  const failed = results.filter((r) => r.error !== null);
  const invalidated = results.filter((r) => r.invalidated);
  const distribution = new Map<string, number>();
  for (const r of succeeded) {
    const bucket =
      r.numComment === null ? "null"
        : r.numComment === 0 ? "0"
        : r.numComment <= 2 ? "1-2"
        : r.numComment <= 5 ? "3-5"
        : r.numComment <= 7 ? "6-7"
        : r.numComment <= 15 ? "8-15"
        : "16+";
    distribution.set(bucket, (distribution.get(bucket) ?? 0) + 1);
  }

  console.log("\n=== Wave 132 backfill 결과 ===");
  console.log(`총 pool 매물: ${pids.length}`);
  console.log(`성공: ${succeeded.length}, 실패: ${failed.length}`);
  console.log(`Pool 떨어뜨림 (num_comment >= ${NUM_COMMENT_THRESHOLD}): ${invalidated.length}`);
  console.log("댓글 수 분포:");
  for (const [bucket, cnt] of [...distribution.entries()].sort()) {
    console.log(`  ${bucket}: ${cnt}건`);
  }
  if (invalidated.length > 0) {
    console.log("\n떨어진 매물 sample (top 10):");
    invalidated
      .sort((a, b) => (b.numComment ?? 0) - (a.numComment ?? 0))
      .slice(0, 10)
      .forEach((r) => console.log(`  pid=${r.pid} comments=${r.numComment}`));
  }
  if (failed.length > 0) {
    console.log("\n실패 sample (top 5):");
    failed.slice(0, 5).forEach((r) => console.log(`  pid=${r.pid} error=${r.error}`));
  }
}

main().catch((err) => {
  console.error("Wave 132 backfill failed:", err);
  process.exit(1);
});
