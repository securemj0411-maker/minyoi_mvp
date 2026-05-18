// Wave 216 (2026-05-19): clothing parsed 1253건 1회성 re-parse.
//
// 문제: clothing 카테고리 parser 분기 없어서 default 0.45 confidence + needs_review=true.
//       → mvp_market_price_daily 0건 → mvp_candidate_pool clothing 0건.
//
// fix: parseFashionMobility 에 clothing 분기 추가 (Wave 216) + ensureParsedRows
//      parser_version drift 체크 추가. 자연 cron 도 자동 re-parse 하지만 한 번에
//      배치 못 처리. 1회성 스크립트로 즉시 1253건 다 재처리.
//
// 사용자 명시 "지금 왜 옷들이 ready에 안들어옴? 뭐하는거지?" — 즉시 처리 우선.

import { skuById } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
};

async function fetchClothingListings(): Promise<RawRow[]> {
  const all: RawRow[] = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    // PostgREST like uses % wildcard, must URL-encode as %25
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id,sku_name&sku_id=like.clothing-%25&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) {
      console.error(`fetch fail offset=${offset}: ${res.status}`);
      break;
    }
    const rows = (await res.json()) as RawRow[];
    all.push(...rows);
    console.log(`  fetched ${rows.length} (offset=${offset}, total=${all.length})`);
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

async function main() {
  const rows = await fetchClothingListings();
  console.log(`Fetched ${rows.length} clothing raw_listings`);

  const stats = {
    total: rows.length,
    matched: 0,
    skuNotFound: 0,
    parsed: 0,
    usable: 0,
    upserted: 0,
  };

  const batch: ReturnType<typeof toParsedListingRow>[] = [];
  const BATCH_SIZE = 200;

  for (const row of rows) {
    if (!row.sku_id) continue;
    stats.matched += 1;
    const sku = skuById(row.sku_id);
    if (!sku) {
      stats.skuNotFound += 1;
      continue;
    }
    const parsed = parseListingOptions({
      title: row.name ?? "",
      description: row.description_preview ?? "",
      skuId: row.sku_id,
      skuName: row.sku_name,
      category: sku.category,
    });
    stats.parsed += 1;
    if (!parsed.needsReview && (parsed.parseConfidence ?? 0) >= 0.65) {
      stats.usable += 1;
    }
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

  console.log("\n=== Summary ===");
  console.log(`Total fetched : ${stats.total}`);
  console.log(`sku_id 박힘   : ${stats.matched}`);
  console.log(`SKU not found : ${stats.skuNotFound}`);
  console.log(`Parser 통과    : ${stats.parsed}`);
  console.log(`Usable (conf≥0.65 + !needs_review): ${stats.usable}`);
  console.log(`DB upserted   : ${stats.upserted}`);
  console.log(`Usable ratio  : ${stats.parsed > 0 ? ((stats.usable / stats.parsed) * 100).toFixed(1) : 0}%`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
