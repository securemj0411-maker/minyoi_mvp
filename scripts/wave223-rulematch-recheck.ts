// Wave 223 (2026-05-19): catalog narrow promotion + mustNotContain 강화 후
//   모든 shoe/clothing/bag 매물 ruleMatch 재실행 → sku_id 재분류.
//
// 사용자 지적: "ready 매물 분류 이상한 거 찾아내" — Arcteryx 감마/베타 매물이
//   broad 에 매칭 / 폴로-포니-티에 타이틀리스트 골프티 매칭 / 구찌-MLB-cap 에
//   반지갑 매칭 등.
//
// fix:
// - NARROW_PROMOTE_CATEGORIES 에 clothing/shoe/bag 추가
// - tryNarrowLanePromotion 가 *_broad/_apparel laneKey 도 promotion 시도
// - polo-pony-tee/mlb-cap-gucci mustNotContain 강화

import { ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
};

async function fetchByPrefix(prefix: string): Promise<RawRow[]> {
  const all: RawRow[] = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id,sku_name&sku_id=like.${prefix}-%25&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) {
      console.error(`fetch ${prefix} offset=${offset} fail: ${res.status}`);
      break;
    }
    const rows = (await res.json()) as RawRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function patchListing(pid: number, skuId: string | null, skuName: string | null): Promise<boolean> {
  const url = `${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`;
  const res = await restFetch(url, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      sku_id: skuId,
      sku_name: skuName,
      score_dirty: true,
      updated_at: new Date().toISOString(),
    }),
  });
  return res.ok;
}

async function processCategory(prefix: string) {
  console.log(`\n=== ${prefix} ===`);
  const rows = await fetchByPrefix(prefix);
  console.log(`Fetched ${rows.length}`);

  const stats = {
    total: rows.length,
    changed: 0,
    unchanged: 0,
    cleared: 0,
    byOldNewKey: new Map<string, number>(),
  };

  let processed = 0;
  for (const row of rows) {
    const matched = ruleMatch(row.name ?? "", row.description_preview ?? "");
    const newSkuId = matched?.id ?? null;
    const newSkuName = matched?.modelName ?? null;
    if (newSkuId !== row.sku_id) {
      const ok = await patchListing(row.pid, newSkuId, newSkuName);
      if (ok) {
        stats.changed += 1;
        if (newSkuId === null) stats.cleared += 1;
        const key = `${row.sku_id ?? "null"} → ${newSkuId ?? "null"}`;
        stats.byOldNewKey.set(key, (stats.byOldNewKey.get(key) ?? 0) + 1);
      }
    } else {
      stats.unchanged += 1;
    }
    processed += 1;
    if (processed % 500 === 0) console.log(`  progress ${processed}/${rows.length}`);
  }

  console.log(`\nTotal: ${stats.total} / Changed: ${stats.changed} / Cleared: ${stats.cleared} / Unchanged: ${stats.unchanged}`);
  console.log(`\nTop migrations:`);
  const sorted = [...stats.byOldNewKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [migration, n] of sorted) console.log(`  ${migration}: ${n}`);
}

async function main() {
  await processCategory("shoe");
  await processCategory("clothing");
  await processCategory("bag");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
