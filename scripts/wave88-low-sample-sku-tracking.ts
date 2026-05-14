// Wave 88 follow-up: 표본 부족 SKU의 누적 추적 (카메라 + 시계 + 골프 + 저volume narrow).
// Wave 87 카메라 자연 대기 1~2주 시나리오 / Wave 86 시계 표본 부족 측정 후속.
// 매번 실행 시 SKU별 raw_listings 누적량 + 신규 7d 유입 비율 + sku_id 매칭 진척도 확인.
//
// 사용: npx tsx scripts/wave88-low-sample-sku-tracking.ts

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

// Wave 87 카메라 5 SKU + Wave 86 시계 보강 + Wave 67 골프 + 저volume narrow.
const TRACK_SKUS = [
  // 카메라 (Wave 87 internal_only 자연 대기)
  "camera-sony-a7m3",
  "camera-sony-a7c",
  "camera-sony-a7c-ii",
  "camera-sony-a7cr",
  "camera-canon-eos-r6-mark-ii",
  // 시계 G-Shock (Wave 86 표본 부족)
  "watch-casio-gshock-ga2100",
  "watch-casio-gshock-dw5600",
  "watch-casio-gshock-gmwb5000",
  // 시계 세이코
  "watch-seiko-5-sports-srpd",
  // 골프 (Wave 67 ready 후 모니터링)
  "sport-golf-titleist-tsr2",
  "sport-golf-titleist-tsr3",
  // 저volume narrow lane
  "speaker-bose-soundlink-flex",
  "earphone-sony-ult900n",
  "home-appliance-roborock-s8-pro-ultra",
];

type SkuStat = {
  skuId: string;
  totalRaw: number;
  activeRaw: number;
  newest7d: number;
  newest1d: number;
  fromCategoryQuery: number;
  fromNarrowQuery: number;
};

async function loadSkuStats(skuId: string): Promise<SkuStat> {
  const totalRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,listing_state&sku_id=eq.${encodeURIComponent(skuId)}&limit=10000`,
    { headers: serviceHeaders() }
  );
  const totalRows = (await totalRes.json()) as Array<{ pid: number; listing_state: string }>;
  const activeRaw = totalRows.filter((r) => r.listing_state === "active").length;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60_000).toISOString();
  const sevenRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid,query&sku_id=eq.${encodeURIComponent(skuId)}&first_seen_at=gte.${encodeURIComponent(sevenDaysAgo)}&limit=5000`,
    { headers: serviceHeaders() }
  );
  const sevenRows = (await sevenRes.json()) as Array<{ pid: number; query: string }>;
  const oneRes = await restFetch(
    `${tableUrl("mvp_raw_listings")}?select=pid&sku_id=eq.${encodeURIComponent(skuId)}&first_seen_at=gte.${encodeURIComponent(oneDayAgo)}&limit=5000`,
    { headers: serviceHeaders() }
  );
  const oneRows = (await oneRes.json()) as Array<{ pid: number }>;

  const fromCategory = sevenRows.filter((r) => r.query?.startsWith("category:")).length;
  const fromNarrow = sevenRows.length - fromCategory;

  return {
    skuId,
    totalRaw: totalRows.length,
    activeRaw,
    newest7d: sevenRows.length,
    newest1d: oneRows.length,
    fromCategoryQuery: fromCategory,
    fromNarrowQuery: fromNarrow,
  };
}

async function main() {
  console.log(`Wave 88 표본 부족 SKU 누적 추적 (${TRACK_SKUS.length}개)`);
  console.log("- totalRaw: 전체 raw_listings count");
  console.log("- 7d/1d: first_seen 기준 신규 유입");
  console.log("- cat/narrow: 7d 신규 중 출처 (category sweep vs narrow query)");
  console.log("- parsed/review/pool: 파서 결과 + pool 진입\n");

  const stats: SkuStat[] = [];
  for (const skuId of TRACK_SKUS) {
    process.stdout.write(`${skuId} ... `);
    try {
      const s = await loadSkuStats(skuId);
      stats.push(s);
      console.log(`raw=${s.totalRaw}(active=${s.activeRaw}) 7d=${s.newest7d}(cat=${s.fromCategoryQuery}+narrow=${s.fromNarrowQuery}) 1d=${s.newest1d}`);
    } catch (err) {
      console.log(`err: ${err instanceof Error ? err.message : err}`);
    }
  }

  // 그룹별 sum
  const byPrefix = new Map<string, { count: number; raw: number; active: number; sevenD: number }>();
  for (const s of stats) {
    const prefix = s.skuId.split("-")[0];
    const agg = byPrefix.get(prefix) ?? { count: 0, raw: 0, active: 0, sevenD: 0 };
    agg.count += 1;
    agg.raw += s.totalRaw;
    agg.active += s.activeRaw;
    agg.sevenD += s.newest7d;
    byPrefix.set(prefix, agg);
  }
  console.log("\n=== 그룹별 합산 ===");
  for (const [prefix, agg] of byPrefix) {
    console.log(`  ${prefix.padEnd(15)} ${agg.count}개 SKU  raw=${agg.raw}(active=${agg.active})  7d유입=${agg.sevenD}`);
  }

  await writeFile(
    path.join(appDir, "reports/wave88-low-sample-sku-tracking-latest.json"),
    JSON.stringify({ wave: 88, measured_at: new Date().toISOString(), stats }, null, 2),
  );
  console.log("\n→ reports/wave88-low-sample-sku-tracking-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
