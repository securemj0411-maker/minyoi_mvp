// 번개장터 분당 신규 등록 속도 측정.
// order=date로 page 0 (96 items) 긁어와서 update_time span으로 rate 추산.
// 우리의 5분/2000건 cadence가 실제 등록 속도 대비 충분한지 검증.

import { searchPage } from "@/lib/bunjang";

type Sample = {
  query: string;
  fetched: number;
  newestKst: string;
  oldestKst: string;
  spanMinutes: number;
  itemsPerMinute: number;
  itemsPer5Min: number;
  catchableIn5MinPage0: boolean;
};

const QUERIES = [
  "아이폰", "갤럭시", "맥북", "아이패드", "에어팟", "애플워치",
  "닌텐도", "플스5", "PS5", "갤럭시탭", "갤럭시워치",
  "맥미니", "아이맥",
  "지샥", "세이코", "타이틀리스트",
  "소니 카메라", "캐논",
  "보스", "WH-1000XM",
  "다이슨", "로보락",
];

function kst(ts: number): string {
  return new Date(ts * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

async function measureQuery(query: string): Promise<Sample | null> {
  const items = await searchPage(query, 0, { order: "date", limit: 96 });
  if (items.length < 5) return null;
  const times = items
    .map((i) => i.updateTime)
    .filter((t): t is number => typeof t === "number" && t > 0)
    .sort((a, b) => b - a);
  if (times.length < 5) return null;
  const newest = times[0];
  const oldest = times[times.length - 1];
  const spanSec = newest - oldest;
  const spanMin = spanSec / 60;
  const itemsPerMin = spanMin > 0 ? times.length / spanMin : 0;
  const itemsPer5Min = itemsPerMin * 5;
  return {
    query,
    fetched: times.length,
    newestKst: kst(newest),
    oldestKst: kst(oldest),
    spanMinutes: Math.round(spanMin * 10) / 10,
    itemsPerMinute: Math.round(itemsPerMin * 10) / 10,
    itemsPer5Min: Math.round(itemsPer5Min),
    catchableIn5MinPage0: itemsPer5Min <= 96,
  };
}

async function main() {
  console.log("측정 시작: 번개장터 분당 신규 등록 속도");
  console.log("기준: 각 query order=date page 0 (최대 96건) → update_time span으로 rate 추산\n");

  const samples: Sample[] = [];
  for (const q of QUERIES) {
    process.stdout.write(`"${q}" ... `);
    try {
      const s = await measureQuery(q);
      if (s) {
        samples.push(s);
        const flag = s.catchableIn5MinPage0 ? "OK" : "MISS";
        console.log(`${s.fetched}개 / ${s.spanMinutes}분 span = ${s.itemsPerMinute}/min (5분 ${s.itemsPer5Min}건, page0 96 한도: ${flag})`);
      } else {
        console.log("표본부족");
      }
    } catch (e) {
      console.log(`err: ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("\n=== 결과 정렬 (분당 등록 속도) ===");
  samples.sort((a, b) => b.itemsPerMinute - a.itemsPerMinute);
  for (const s of samples) {
    const flag = s.catchableIn5MinPage0 ? "✓" : "✗ MISS";
    console.log(`  ${s.query.padEnd(15)} ${String(s.itemsPerMinute).padStart(6)}/min  (5min=${String(s.itemsPer5Min).padStart(4)}건)  ${flag}`);
  }

  const totalPerMin = samples.reduce((sum, s) => sum + s.itemsPerMinute, 0);
  const missing = samples.filter((s) => !s.catchableIn5MinPage0);
  console.log(`\n측정 query 합산: ${totalPerMin.toFixed(1)}건/min = ${Math.round(totalPerMin * 5)}건/5min`);
  console.log(`5분/page0(96건)로 못 따라가는 query: ${missing.length}개 → ${missing.map((s) => s.query).join(", ") || "없음"}`);
  console.log("\n참고: 우리 tick은 5분/2000건 collected_count = page 0~N 누적. query 1개당 96건 한도면 page 1+ 더 긁어야 됨.");
}

main().catch((e) => { console.error(e); process.exit(1); });
