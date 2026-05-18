// Wave 217 (2026-05-19): shoe/bag/clothing 전체 1회성 re-parse.
//
// 변경: parseFashionMobility 이 bunjang_condition_label + resolveConditionClass 활용.
//   이전 (Wave 216 까지): metadata 무시 → bag 100% normal, shoe 25% normal.
//   이후: NEW/LIKE_NEW/LIGHTLY_USED/HEAVILY_USED/DAMAGED 다 활용 →
//   condition_class 다양화 → 시세 grouping 정확.
//
// PARSER_VERSION_W92 v1 → v2 bump 했지만 ensureParsedRows 는 marketStatsStage
// 안에서만 호출됨. 1회성으로 직접 reparse + market_invalidation enqueue.

import { skuById } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
  bunjang_condition_label: string | null;
};

async function fetchByPrefix(prefix: string): Promise<RawRow[]> {
  const all: RawRow[] = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id,sku_name,bunjang_condition_label&sku_id=like.${prefix}-%25&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) {
      console.error(`fetch fail ${prefix} offset=${offset}: ${res.status}`);
      break;
    }
    const rows = (await res.json()) as RawRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function upsertParsedBatch(parsedRows: ReturnType<typeof toParsedListingRow>[]): Promise<boolean> {
  if (parsedRows.length === 0) return true;
  const url = `${tableUrl("mvp_listing_parsed")}`;
  const res = await restFetch(url, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(parsedRows),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`upsert fail: ${res.status} ${text.slice(0, 300)}`);
    return false;
  }
  return true;
}

async function processCategory(prefix: string, label: string) {
  console.log(`\n=== ${label} ===`);
  const rows = await fetchByPrefix(prefix);
  console.log(`Fetched ${rows.length} ${label} raw_listings`);

  const stats = {
    total: rows.length,
    parsed: 0,
    usable: 0,
    upserted: 0,
    byClass: new Map<string, number>(),
  };

  const batch: ReturnType<typeof toParsedListingRow>[] = [];
  const BATCH_SIZE = 200;

  for (const row of rows) {
    if (!row.sku_id) continue;
    const sku = skuById(row.sku_id);
    if (!sku) continue;
    const parsed = parseListingOptions({
      title: row.name ?? "",
      description: row.description_preview ?? "",
      skuId: row.sku_id,
      skuName: row.sku_name,
      category: sku.category,
      bunjangConditionLabel: row.bunjang_condition_label,
    });
    stats.parsed += 1;
    if (!parsed.needsReview && (parsed.parseConfidence ?? 0) >= 0.65) {
      stats.usable += 1;
    }
    const klass = parsed.conditionClass ?? "null";
    stats.byClass.set(klass, (stats.byClass.get(klass) ?? 0) + 1);
    batch.push(toParsedListingRow(row.pid, parsed));
    if (batch.length >= BATCH_SIZE) {
      const ok = await upsertParsedBatch(batch);
      if (ok) stats.upserted += batch.length;
      batch.length = 0;
    }
  }
  if (batch.length > 0) {
    const ok = await upsertParsedBatch(batch);
    if (ok) stats.upserted += batch.length;
  }

  console.log(`  Parsed: ${stats.parsed} / Usable: ${stats.usable} (${stats.parsed > 0 ? ((stats.usable / stats.parsed) * 100).toFixed(1) : 0}%)`);
  console.log(`  Upserted: ${stats.upserted}`);
  console.log(`  condition_class distribution:`);
  const sorted = [...stats.byClass.entries()].sort((a, b) => b[1] - a[1]);
  for (const [klass, cnt] of sorted) {
    console.log(`    ${klass}: ${cnt} (${((cnt / stats.parsed) * 100).toFixed(1)}%)`);
  }
}

async function main() {
  await processCategory("shoe", "shoe");
  await processCategory("bag", "bag");
  await processCategory("clothing", "clothing");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
