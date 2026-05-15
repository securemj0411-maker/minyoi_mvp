#!/usr/bin/env tsx
/**
 * Wave 137 (2026-05-16): one-time backfill — 현재 pool 매물의 qty(수량) 채우고
 * qty > 1 매물 pool에서 invalidate (대량 판매업자 차단).
 *
 * Wave 136 audit 발견: product.qty 88/35/26 = 대량 판매업자, qty 1 = 일반 매물.
 * Wave 132 backfill 패턴 재사용.
 *
 * 실행: npx tsx scripts/wave137-backfill-qty.ts
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

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

const MAX_QTY = 1;
const CONCURRENCY = 10;

type PoolPid = { pid: number };

async function loadPoolPids(): Promise<number[]> {
  const url = `${tableUrl("mvp_candidate_pool")}?select=pid&status=in.(ready,reserved)&limit=5000`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  const rows = (await res.json()) as PoolPid[];
  return rows.map((r) => Number(r.pid)).filter((p) => Number.isFinite(p));
}

async function patchQty(pid: number, qty: number): Promise<void> {
  const url = `${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`;
  const res = await restFetch(url, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ qty, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`patch qty failed pid=${pid} status=${res.status}`);
}

async function invalidatePoolEntry(pid: number, reason: string): Promise<void> {
  const url = rpcUrl("invalidate_mvp_pool_entry");
  const res = await restFetch(url, {
    method: "POST",
    headers: { ...serviceHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ p_pid: pid, p_reason: reason }),
  });
  if (!res.ok) {
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
  qty: number | null;
  invalidated: boolean;
  error: string | null;
}> {
  try {
    const detail = await fetchDetail(String(pid));
    if (!detail) return { pid, qty: null, invalidated: false, error: "detail_null" };
    const qty = detail.qty ?? 1;
    await patchQty(pid, qty);
    if (qty > MAX_QTY) {
      await invalidatePoolEntry(pid, `qty_above_${MAX_QTY}`);
      return { pid, qty, invalidated: true, error: null };
    }
    return { pid, qty, invalidated: false, error: null };
  } catch (err) {
    return { pid, qty: null, invalidated: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.join(__dirname, "..");
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  console.log("Wave 137 backfill: loading pool pids…");
  const pids = await loadPoolPids();
  console.log(`Pool 매물 ${pids.length}건 — qty fetch 시작 (concurrency=${CONCURRENCY})`);

  const start = Date.now();
  const results: Array<Awaited<ReturnType<typeof processOne>>> = [];
  for (let i = 0; i < pids.length; i += CONCURRENCY) {
    const wave = pids.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(wave.map(processOne))));
    if ((i + CONCURRENCY) % 100 === 0 || i + CONCURRENCY >= pids.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  ${Math.min(i + CONCURRENCY, pids.length)}/${pids.length} (${elapsed}s)`);
    }
  }

  const succeeded = results.filter((r) => r.error === null);
  const failed = results.filter((r) => r.error !== null);
  const invalidated = results.filter((r) => r.invalidated);
  const dist = new Map<string, number>();
  for (const r of succeeded) {
    const bucket = r.qty === null ? "null"
      : r.qty === 1 ? "1 (일반)"
      : r.qty <= 5 ? "2-5"
      : r.qty <= 20 ? "6-20"
      : r.qty <= 50 ? "21-50"
      : "50+";
    dist.set(bucket, (dist.get(bucket) ?? 0) + 1);
  }

  console.log("\n=== Wave 137 backfill 결과 ===");
  console.log(`총 pool 매물: ${pids.length}, 성공: ${succeeded.length}, 실패: ${failed.length}`);
  console.log(`Pool 떨어뜨림 (qty > ${MAX_QTY}): ${invalidated.length}`);
  console.log("qty 분포:");
  for (const [b, c] of [...dist.entries()].sort()) console.log(`  ${b}: ${c}건`);
  if (invalidated.length > 0) {
    console.log("\n떨어진 매물 top 10 (qty 높은 순):");
    invalidated.sort((a, b) => (b.qty ?? 0) - (a.qty ?? 0)).slice(0, 10)
      .forEach((r) => console.log(`  pid=${r.pid} qty=${r.qty}`));
  }
}

main().catch((err) => {
  console.error("Wave 137 backfill failed:", err);
  process.exit(1);
});
