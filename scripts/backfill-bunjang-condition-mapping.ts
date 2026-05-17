/**
 * Wave 158 backfill (2026-05-17): bunjang 영어 enum 매핑 박힌 후, 기존 3,798건 매물의
 * condition_class 즉시 재계산.
 *
 * 흐름:
 *   1. mvp_raw_listings.bunjang_condition_label NOT NULL 매물 fetch (label + condition_notes 필요)
 *   2. JOIN mvp_listing_parsed (current condition_class + condition_notes)
 *   3. resolveConditionClass(bunjangLabelToConditionClass(label), extractConditionClass(notes))
 *   4. 다르면 UPDATE mvp_listing_parsed SET condition_class = new
 *
 * 시세 영향: condition_class 변경 시 mvp_market_price_daily PK (date, comparable_key, condition_class) 다른 row로.
 * market-worker 다음 tick에 자동 재집계.
 *
 * 사용: npx tsx scripts/backfill-bunjang-condition-mapping.ts [--dry-run] [--limit N]
 */

import {
  bunjangLabelToConditionClass,
  extractConditionClass,
  resolveConditionClass,
  type ConditionClass,
} from "../src/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "../src/lib/supabase-rest";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split("=")[1]) : Infinity;
const BATCH_SIZE = 500;
const UPDATE_BATCH = 50;

type Row = {
  pid: number;
  bunjang_condition_label: string | null;
  condition_notes: string[] | null;
  condition_class: ConditionClass | null;
};

async function fetchBatch(offset: number, limit: number): Promise<{ rows: Row[]; rawCount: number }> {
  // raw_listings 기준: bunjang_condition_label NOT NULL 매물만. parsed embed로 condition_notes/class/parser_version 가져옴.
  // fashion-mobility parser (신발/가방/자전거) 는 condition_notes를 안 박고 shoe_condition_tier 별도 사용 → 제외.
  const url = `${tableUrl("mvp_raw_listings")}?select=pid,bunjang_condition_label,mvp_listing_parsed(condition_class,condition_notes,parser_version)&bunjang_condition_label=not.is.null&order=pid.asc&limit=${limit}&offset=${offset}`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{
    pid: number;
    bunjang_condition_label: string | null;
    mvp_listing_parsed?: { condition_class: ConditionClass | null; condition_notes: string[] | null; parser_version: string | null } | null;
  }>;
  const filtered = rows
    .filter((r) => r.mvp_listing_parsed != null)
    .filter((r) => !(r.mvp_listing_parsed?.parser_version ?? "").startsWith("wave92-fashion-mobility"))
    .map((r) => ({
      pid: r.pid,
      bunjang_condition_label: r.bunjang_condition_label,
      condition_class: r.mvp_listing_parsed?.condition_class ?? null,
      condition_notes: r.mvp_listing_parsed?.condition_notes ?? null,
    }));
  return { rows: filtered, rawCount: rows.length };
}

async function applyUpdate(pid: number, newClass: ConditionClass): Promise<boolean> {
  if (DRY_RUN) return true;
  const res = await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: { ...serviceHeaders(), Prefer: "return=minimal" },
    body: JSON.stringify({ condition_class: newClass, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

async function main() {
  console.log(`Wave 158 backfill (dry-run=${DRY_RUN}, limit=${LIMIT === Infinity ? "all" : LIMIT})`);

  let offset = 0;
  let totalScanned = 0;
  let totalChanged = 0;
  let unchangedSameClass = 0;
  let failed = 0;
  const transitions = new Map<string, number>();

  while (totalScanned < LIMIT) {
    const fetchLimit = Math.min(BATCH_SIZE, LIMIT - totalScanned);
    const { rows, rawCount } = await fetchBatch(offset, fetchLimit);
    if (rawCount === 0) break;

    const updates: Array<{ pid: number; newClass: ConditionClass; oldClass: ConditionClass | null }> = [];
    for (const r of rows) {
      totalScanned += 1;
      const fromMeta = bunjangLabelToConditionClass(r.bunjang_condition_label);
      const fromNotes = extractConditionClass(r.condition_notes ?? []);
      const finalClass = resolveConditionClass(fromMeta, fromNotes);
      if (finalClass === r.condition_class) {
        unchangedSameClass += 1;
        continue;
      }
      updates.push({ pid: r.pid, newClass: finalClass, oldClass: r.condition_class });
      const key = `${r.condition_class ?? "null"} → ${finalClass}`;
      transitions.set(key, (transitions.get(key) ?? 0) + 1);
    }

    for (let i = 0; i < updates.length; i += UPDATE_BATCH) {
      const chunk = updates.slice(i, i + UPDATE_BATCH);
      const results = await Promise.all(chunk.map((u) => applyUpdate(u.pid, u.newClass)));
      for (const ok of results) {
        if (ok) totalChanged += 1;
        else failed += 1;
      }
    }

    console.log(`  offset=${offset} raw=${rawCount} filtered=${rows.length} updates=${updates.length} (total scanned=${totalScanned}, changed=${totalChanged})`);
    offset += rawCount;
    if (rawCount < fetchLimit) break;
  }

  console.log(`\nDone.`);
  console.log(`  scanned: ${totalScanned}`);
  console.log(`  unchanged (same class): ${unchangedSameClass}`);
  console.log(`  changed: ${totalChanged}`);
  console.log(`  failed: ${failed}`);
  console.log(`\nTransition breakdown (top 20):`);
  const sorted = [...transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [key, count] of sorted) {
    console.log(`  ${key}: ${count}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
