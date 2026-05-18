// Wave 198~212 reparse (2026-05-19): 의류/신발/가방 신규 catalog brand 매물 재매칭.
//
// 문제: Wave 198~212 박은 catalog 110 SKU 후 옛 매물 (sku_id NULL) 는 ruleMatch 재실행 안 됨.
// 새 매물만 catalog 매칭. 매칭률 측정 무의미.
//
// 해결: catalog ruleMatch 호출 → 매물 sku_id + sku_name 박음 + score_dirty=true.
// 다음 tick에 ensureParsedRows + scoreStage → 풀 진입.
//
// 사용자 D 결정 (2026-05-19): 측정 우선. reparse 후 매칭률 + 풀 진입 정식 측정.

import { ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const KEYWORDS = [
  // Wave 198 의류 Tier 1
  "폴로", "Polo Ralph", "Ralph Lauren", "RRL",
  "노스페이스", "North Face", "TNF", "눕시", "Nuptse", "Mountain Jacket", "Denali", "Purple Label", "Nanamica",
  "스투시", "Stussy",
  // Wave 199 Tier 2
  "라코스테", "Lacoste",
  "아더에러", "ADER ERROR",
  // Wave 200~201 CDG
  "꼼데가르송", "CDG", "Comme des Garcons",
  // Wave 202 신발/가방
  "On Running", "온러닝", "Cloud Monster", "Cloudsurfer",
  "Birkenstock", "버켄스탁", "Boston", "Arizona", "Zürich", "취리히", "Milano",
  "Lululemon", "룰루레몬",
  // Wave 203 마르지엘라
  "Maison Margiela", "마르지엘라", "Tabi", "타비", "Glam Slam", "글램슬램", "MM6",
  // Wave 204 슈프림
  "Supreme", "슈프림",
  // Wave 205 친화 brand
  "Crocs", "크록스", "Bayaband", "바야밴드",
  "Carhartt", "칼하트",
  "Acne", "아크네", "Triplo", "Bertin", "Musubi",
  "Kitsune", "메종키츠네",
  // Wave 206 푸마
  "Puma", "푸마", "퓨마", "Speedcat", "스피드캣", "Palermo", "팔레르모",
  // Wave 207 미즈노
  "Mizuno", "미즈노", "Morelia", "모렐리아", "Monarcida", "모나르시다",
  // Wave 208 살로몬
  "Salomon", "살로몬", "XT-6", "XA Pro", "Speedcross", "스피드크로스", "ACS",
  // Wave 209 아식스
  "Asics", "아식스", "Gel-1130", "Kayano", "카야노", "Nimbus", "님버스", "Novablast", "Kiko", "키코", "Cecilie Bahnsen",
  // Wave 210 호카 + FOG + 챔피온 + 토미힐피거
  "Hoka", "호카", "Mafate", "마파테", "Anacapa", "아나카파",
  "Fear of God", "피어 오브 갓", "피오갓", "FOG",
  "Champion", "챔피온",
  "Tommy Hilfiger", "토미힐피거", "타미힐피거",
  // Wave 211 나이키 추가
  "Air Max 1", "에어맥스 1", "Air Max 90", "에어맥스 90", "Air Max 95", "에어맥스 95", "Air Max 97", "에어맥스 97",
  "Blazer", "블레이저", "Sacai", "사카이",
  // Wave 212 아디다스 추가
  "아디다스 셔링", "Adidas Hobo", "호보백",
  "Campus", "캠퍼스", "Spezial", "스페지알", "Forum", "포럼", "SL72",
  "Stan Smith", "스탠스미스", "Superstar", "슈퍼스타",
  "Ultraboost", "울트라부스트", "Adilette", "아딜렛",
  "F50", "Predator", "프레데터", "Adizero", "아디제로",
  "Raf Simons", "라프시몬스",
  // Wave 202 collab
  "Levis", "리바이스",
  // Wave 214 의류 mainstream
  "BAPE", "베이프", "A Bathing Ape", "Ape Head", "샤크 후드",
  "Matin Kim", "마뗑킴", "마틴킴",
  "Reebok 트랙수트", "리복 트랙수트", "Reebok Apparel",
  "Arc'teryx", "아크테릭스", "Arc'teryx Beta",
  "Fila 트랙수트", "휠라 트랙수트",
  "Patagonia", "파타고니아", "Retro X",
  "MLB 모자", "MLB Cap",
  "Discovery Expedition", "디스커버리 익스페디션",
  // Wave 215 신발 한정
  "Yeezy", "이지 부스트", "Yeezy Boost", "Yeezy Slide", "이지 슬라이드", "Yeezy Foam",
  "BAPE STA", "Bapesta", "베이프스타",
  "Stussy 8 Ball Knit", "8볼 니트",
];

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
};

async function fetchOrphans(keyword: string): Promise<RawRow[]> {
  const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview&sku_id=is.null&name=ilike.%25${encodeURIComponent(keyword)}%25&limit=500`;
  const res = await restFetch(url, { headers: serviceHeaders() });
  if (!res.ok) {
    console.warn(`fetchOrphans fail (${keyword}): ${res.status}`);
    return [];
  }
  return (await res.json()) as RawRow[];
}

async function patchListing(pid: number, skuId: string, skuName: string): Promise<boolean> {
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

async function main() {
  const seenPids = new Set<number>();
  const stats = new Map<string, number>();
  let totalMatched = 0;
  let totalPatched = 0;
  let totalSkipped = 0;

  for (const kw of KEYWORDS) {
    const rows = await fetchOrphans(kw);
    if (rows.length === 0) continue;
    console.log(`[${kw}] ${rows.length} rows`);
    for (const row of rows) {
      if (seenPids.has(row.pid)) continue;
      seenPids.add(row.pid);
      const matched = ruleMatch(row.name, row.description_preview ?? "");
      if (!matched) {
        totalSkipped += 1;
        continue;
      }
      totalMatched += 1;
      const ok = await patchListing(row.pid, matched.id, matched.modelName);
      if (ok) {
        totalPatched += 1;
        stats.set(matched.id, (stats.get(matched.id) ?? 0) + 1);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Unique PIDs processed: ${seenPids.size}`);
  console.log(`Matched (catalog 박힘): ${totalMatched}`);
  console.log(`Patched (DB UPDATE OK): ${totalPatched}`);
  console.log(`Skipped (catalog 매칭 X): ${totalSkipped}`);
  console.log("\n=== Per SKU (top 30) ===");
  const sorted = Array.from(stats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 30);
  for (const [sku, cnt] of sorted) console.log(`  ${sku}: ${cnt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
