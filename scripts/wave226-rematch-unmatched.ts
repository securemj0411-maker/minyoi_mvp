// Wave 226 (2026-05-19): unmatched 매물 ruleMatch 재실행 — 새 NB/Samba/Cortez SKU 매칭.
import { ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

async function fetchUnmatched(): Promise<Array<{ pid: number; name: string; description_preview: string | null }>> {
  const all: Array<{ pid: number; name: string; description_preview: string | null }> = [];
  let offset = 0;
  const PAGE = 500;
  while (true) {
    const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview&sku_id=is.null&listing_state=eq.active&name=ilike.%25%EB%89%B4%EB%B0%9C%25%2C%EC%82%BC%EB%B0%94%2Csamba%2C%EC%BD%94%EB%A5%B4%ED%85%8C%EC%A6%88%2Ccortez&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    // 단순 fetch — name 필터링 client side
    const simpleUrl = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview&sku_id=is.null&listing_state=eq.active&order=pid.asc&limit=${PAGE}&offset=${offset}`;
    const res = await restFetch(simpleUrl, { headers: serviceHeaders() });
    const rows = (await res.json()) as Array<{ pid: number; name: string; description_preview: string | null }>;
    // Wave 227 (2026-05-19): 의류/가방 누락 키워드 추가 — FOG/Coach/Longchamp/Tailwind/Adidas Trefoil.
    // Wave 233 (2026-05-19): Vans 시리즈 키워드 추가.
    const filtered = rows.filter((r) =>
      /뉴발|nb |new balance|newbalance|삼바|samba|코르테즈|cortez|피어오브갓|피오갓|fear of god|fog\s*(essentials|에센셜)|코치|coach|롱샴|longchamp|테일윈드|tailwind|trefoil|트레포일|트랙수트|3-stripe|3선|삼선|반스|vans|올드스쿨|old skool|sk8|에라\b| era |어센틱|authentic|체커보드|checkerboard/i.test(r.name ?? "")
    );
    all.push(...filtered);
    if (rows.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function patchListing(pid: number, skuId: string, skuName: string): Promise<boolean> {
  const url = `${tableUrl("mvp_raw_listings")}?pid=eq.${pid}`;
  const res = await restFetch(url, {
    method: "PATCH",
    headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ sku_id: skuId, sku_name: skuName, score_dirty: true, updated_at: new Date().toISOString() }),
  });
  return res.ok;
}

async function main() {
  const rows = await fetchUnmatched();
  console.log(`Fetched ${rows.length} unmatched 매물 (NB/Samba/Cortez 키워드)`);
  let matched = 0;
  const bySku = new Map<string, number>();
  for (const row of rows) {
    const m = ruleMatch(row.name ?? "", row.description_preview ?? "");
    if (!m) continue;
    matched += 1;
    bySku.set(m.id, (bySku.get(m.id) ?? 0) + 1);
    await patchListing(row.pid, m.id, m.modelName);
  }
  console.log(`Matched: ${matched}`);
  console.log("By SKU:");
  const sorted = [...bySku.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  for (const [sku, n] of sorted) console.log(`  ${sku}: ${n}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
