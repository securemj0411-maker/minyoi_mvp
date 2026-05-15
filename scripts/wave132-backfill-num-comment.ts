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

  // --raw <pid,pid,…> 모드: bunjang API raw JSON 직접 fetch + comment 관련 key 찾기
  const rawArg = process.argv.find((a) => a.startsWith("--raw="));
  if (rawArg) {
    const pids = rawArg.slice("--raw=".length).split(",").map(Number).filter(Number.isFinite);
    for (const pid of pids) {
      const url = `https://api.bunjang.co.kr/api/pms/v3/products-detail/${pid}?viewerUid=-1`;
      const res = await fetch(url);
      const json: any = await res.json();
      const data = json?.data ?? {};
      const product = data?.product ?? {};
      const metrics = product?.metrics ?? {};
      console.log(`\npid=${pid}`);
      console.log("  product keys:", Object.keys(product).filter((k) => /comm|chat|inquir|talk|reply/i.test(k)));
      console.log("  metrics keys:", Object.keys(metrics).filter((k) => /comm|chat|inquir|talk|reply/i.test(k)));
      console.log("  metrics ALL:", JSON.stringify(metrics, null, 2));
    }
    return;
  }

  // Wave 136 (2026-05-16) --audit <pid,…> 모드: 모든 field 매핑 raw response와 비교 audit.
  // Wave 132 commentCount→buntalkCount 같은 wrong path 재발 방지.
  const auditArg = process.argv.find((a) => a.startsWith("--audit="));
  if (auditArg) {
    const pids = auditArg.slice("--audit=".length).split(",").map(Number).filter(Number.isFinite);
    console.log("=== Wave 136 bunjang field 매핑 audit ===\n");
    for (const pid of pids) {
      const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.log(`pid=${pid} HTTP ${res.status} — skip`);
          continue;
        }
        const json: any = await res.json();
        const data = json?.data ?? {};
        const product = data?.product ?? {};
        const shop = data?.shop ?? {};
        const metrics = product?.metrics ?? {};
        console.log(`pid=${pid}`);
        console.log("  metrics.*       :", Object.keys(metrics));
        console.log("    values:", JSON.stringify(metrics));
        console.log("  shop.* (관련만)  :", Object.keys(shop).filter((k) => /review|follow|sales|proshop|official|join|uid/i.test(k)));
        console.log("    shop sample:", JSON.stringify({
          uid: shop.uid,
          reviewRating: shop.reviewRating,
          reviewCount: shop.reviewCount,
          followerCount: shop.followerCount,
          salesCount: shop.salesCount,
          isOfficialSeller: shop.isOfficialSeller,
          joinDate: shop.joinDate,
          proshop: shop.proshop,
        }, null, 2));
        console.log("  product 관련 key:", Object.keys(product).filter((k) => /view|fav|count|num|trade|status|sale/i.test(k)));
        console.log("  ALL product keys:", Object.keys(product));
        console.log("  inspectionStatus =", product.inspectionStatus);
        console.log("  condition/productCondition/status =",
          { condition: product.condition, productCondition: product.productCondition, status: product.status });
        console.log("  qty/originPrice/careType =",
          { qty: product.qty, originPrice: product.originPrice, careType: product.careType });
        console.log("");
      } catch (err) {
        console.log(`pid=${pid} error:`, err);
      }
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
