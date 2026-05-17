// Wave 185 internal test (2026-05-18): sku_id NULL 매물 catalog 재분류.
//
// 문제: Wave 182~185 catalog SKU 박은 후 옛 매물 (sku_id NULL) 은 ruleMatch 재실행 안 됨.
// 새 매물만 catalog 매칭. 결과: 매물 production DB 에 156건 있는데 sku_id 안 박힘 → 풀 진입 X.
//
// 해결: catalog ruleMatch 호출 → 매물 sku_id + sku_name 박음 + score_dirty=true 마킹.
// tick worker 다음 사이클에 ensureParsedRows + scoreStage → 풀 진입.
//
// 안전: 매칭 안 되는 매물은 그대로 skip. 매물 시세 영향 X.

import { ruleMatch } from "@/lib/catalog";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const KEYWORDS = [
  // Wave 183 헤어 기기
  "다이슨 슈퍼소닉", "Dyson Supersonic",
  "다이슨 에어랩", "Dyson Airwrap",
  "다이슨 코랄", "Dyson Corrale",
  "시아루스", "Cyaars", "글램팜", "Glampam",
  "EH-NA0J", "EH-NA9C", "EH-NA98", "파나소닉 나노이",
  "바비리스 프로", "BaByliss Pro",
  // Wave 184 drone
  "DJI Mini", "DJI 미니",
  "DJI Mavic", "DJI 매빅",
  "DJI Air", "DJI 에어",
  "DJI Avata", "DJI 아바타",
  "DJI Osmo Action", "오즈모 액션",
  "DJI Osmo Pocket", "오즈모 포켓",
  "GoPro Hero", "고프로 히어로",
  "GoPro Max", "고프로 맥스",
  // Wave 185 perfume
  "조말론", "Jo Malone",
  "르라보", "Le Labo", "산탈 33", "Santal 33",
  "딥디크", "Diptyque", "필로시코스", "도손",
  "톰포드", "Tom Ford", "블랙 오키드", "토바코 바닐라", "로스트 체리",
  "마르지엘라", "Replica", "재즈클럽", "파이어플레이스", "비치워크",
  "메모", "Memo Paris", "러시안 레더", "아이리쉬 레더",
  // Wave 182 Galaxy Book
  "갤럭시 북", "갤럭시북", "Galaxy Book",
];

type RawRow = {
  pid: number;
  name: string;
  description_preview: string | null;
};

async function fetchOrphans(keyword: string): Promise<RawRow[]> {
  const url = `${tableUrl("mvp_raw_listings")}?select=pid,name,description_preview&sku_id=is.null&name=ilike.%25${encodeURIComponent(keyword)}%25&limit=200`;
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
  console.log("\n=== Per SKU ===");
  const sorted = Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
  for (const [sku, cnt] of sorted) console.log(`  ${sku}: ${cnt}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
