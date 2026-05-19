// Wave 235 (2026-05-19): SKU 정밀 검증 후 ruleMatch 재실행.
//
// 변경 사항:
//   - Global noise 강화: 구매요청 / SOLD / 모자/캡
//   - SKU mustNotContain 강화 (Blazer Off-White / Vans Vault·BAPE / Superstar collab / TNF Cecilie / Trefoil Balenciaga · Gucci / CDG×Gucci / Marc Jacobs×Denim Tears / NB 530×Miu Miu·Ronnie Fieg)
//   - 신규 5개 SKU: Off-White×Blazer Mid / BAPE×Vans / Clot×Superstar / Thug Club×Superstar / Sato×Vans Era
//
// 처리 흐름:
//   1. sku_id 박힌 매물 + unmatched 매물 둘 다 fetch
//   2. ruleMatch 재실행 → new sku_id
//   3. 차이 나면 patch (sku_id/sku_name reset 또는 새로 박기)
//   4. Top migrations 리포트

import { ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
  sku_id: string | null;
  sku_name: string | null;
};

async function fetchAll(): Promise<RawRow[]> {
  const all: RawRow[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    // shoe / clothing / bag prefix sku_id (있거나 없거나) + listing_state=active
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview,sku_id,sku_name&listing_state=eq.active&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    if (!res.ok) {
      console.error(`fetch offset=${offset} fail: ${res.status}`);
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

function isFashionSku(skuId: string | null): boolean {
  if (!skuId) return false;
  return skuId.startsWith("shoe-") || skuId.startsWith("clothing-") || skuId.startsWith("bag-");
}

function looksFashion(name: string): boolean {
  // Heuristic — fashion 키워드 (Wave 235 신규 5 SKU 의 매칭 후보 trigger).
  const n = name.toLowerCase();
  return /나이키|nike|아디다스|adidas|반스|vans|뉴발|new balance|뉴발란스|블레이저|blazer|슈퍼스타|superstar|올드스쿨|sk8|에라|era|슬립온|slip|체커보드|꼼데|cdg|폴로|polo|rrl|마르지엘라|margiela|타비|tabi|노스페이스|north face|tnf|아크네|acne|마크제이콥스|marc jacobs|스투시|stussy|크록스|crocs|버켄|birken|푸마|puma|미즈노|mizuno|asics|아식스|컨버스|converse|척테일러|chuck/i.test(n);
}

async function main() {
  console.log("fetching all active listings...");
  const rows = await fetchAll();
  console.log(`Fetched ${rows.length}`);

  const stats = {
    total: rows.length,
    changed: 0,
    cleared: 0,
    newly_matched: 0,
    re_matched: 0,
    unchanged: 0,
    byOldNewKey: new Map<string, number>(),
  };

  let processed = 0;
  for (const row of rows) {
    const oldSku = row.sku_id;
    // 효율 — fashion SKU 매칭된 매물 + name 에 fashion 키워드 있는 unmatched 만 재계산.
    if (!isFashionSku(oldSku) && !looksFashion(row.name ?? "")) {
      stats.unchanged += 1;
      processed += 1;
      continue;
    }

    const matched = ruleMatch(row.name ?? "", row.description_preview ?? "");
    const newSkuId = matched?.id ?? null;
    const newSkuName = matched?.modelName ?? null;

    if (newSkuId !== oldSku) {
      const ok = await patchListing(row.pid, newSkuId, newSkuName);
      if (ok) {
        stats.changed += 1;
        if (newSkuId === null) stats.cleared += 1;
        else if (oldSku === null) stats.newly_matched += 1;
        else stats.re_matched += 1;

        const key = `${oldSku ?? "null"} → ${newSkuId ?? "null"}`;
        stats.byOldNewKey.set(key, (stats.byOldNewKey.get(key) ?? 0) + 1);
      }
    } else {
      stats.unchanged += 1;
    }
    processed += 1;
    if (processed % 1000 === 0) console.log(`  progress ${processed}/${rows.length} — changed=${stats.changed}`);
  }

  console.log(`\nTotal: ${stats.total}`);
  console.log(`Changed: ${stats.changed} (cleared=${stats.cleared}, re_matched=${stats.re_matched}, newly_matched=${stats.newly_matched})`);
  console.log(`Unchanged: ${stats.unchanged}`);

  console.log(`\nTop 30 migrations:`);
  const sorted = [...stats.byOldNewKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [migration, n] of sorted) console.log(`  ${migration}: ${n}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
