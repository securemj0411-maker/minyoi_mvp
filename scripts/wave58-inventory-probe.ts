// Wave 58 inventory probe — for each candidate keyword, hit Bunjang search API
// and estimate listings volume (last 24h / 7d / 30d) + price distribution.
// No DB write, no candidate_pool write.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const API = "https://api.bunjang.co.kr/api/1/find_v2.json";
const HEADERS = {
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
};

type Candidate = { family: string; query: string; price_cap?: number };
const CANDIDATES: Candidate[] = [
  // IT shortlist (Wave 58 prior 8)
  { family: "IT_mouse", query: "MX Master 3", price_cap: 200_000 },
  { family: "IT_mouse", query: "MX Master 3S", price_cap: 200_000 },
  { family: "IT_keyboard", query: "매직 키보드 터치 ID", price_cap: 300_000 },
  { family: "IT_camera", query: "소니 a6400", price_cap: 1_000_000 },
  { family: "IT_camera", query: "후지필름 X-T5", price_cap: 2_000_000 },
  { family: "IT_console", query: "Xbox Series S", price_cap: 700_000 },
  { family: "IT_console", query: "Xbox Series X", price_cap: 900_000 },
  { family: "IT_air", query: "LG 퓨리케어 360" },
  { family: "IT_dyson", query: "다이슨 에어랩" },
  { family: "IT_dyson", query: "Dyson Airwrap" },
  { family: "IT_dyson", query: "다이슨 슈퍼소닉" },
  // Non-IT shortlist (Wave 58 new 6 families)
  { family: "watch_casio", query: "G-Shock", price_cap: 500_000 },
  { family: "watch_casio", query: "지샥 GA-2100" },
  { family: "watch_seiko", query: "Seiko 5", price_cap: 800_000 },
  { family: "watch_seiko", query: "세이코 프로스펙스" },
  { family: "golf_driver", query: "타이틀리스트 TSR2" },
  { family: "golf_driver", query: "타이틀리스트 TSR3" },
  { family: "golf_driver", query: "캘러웨이 파라다임" },
  { family: "golf_driver", query: "테일러메이드 Stealth 2" },
  { family: "camping_snowpeak", query: "스노우피크 화로대" },
  { family: "camping_kovea", query: "코베아 큐브" },
  { family: "camping_coleman", query: "콜맨 230A" },
  { family: "projector", query: "XGIMI Halo" },
  { family: "projector", query: "Aladdin 빔" },
  { family: "projector", query: "삼성 프리스타일" },
  { family: "lego_ucs", query: "레고 UCS 75192" },
  { family: "lego_modular", query: "레고 10307 에펠탑" },
  { family: "lego_technic", query: "레고 42143 페라리" },
];

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86_400;

async function probe(query: string) {
  const url = new URL(API);
  url.searchParams.set("q", query);
  url.searchParams.set("order", "date");
  url.searchParams.set("page", "0");
  url.searchParams.set("n", "100");
  url.searchParams.set("stat_device", "w");
  url.searchParams.set("req_ref", "search");
  url.searchParams.set("stat_category_required", "1");
  url.searchParams.set("version", "4");
  try {
    const res = await fetch(url.toString(), {
      headers: HEADERS,
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return { error: `http_${res.status}` };
    const data = await res.json() as { list?: Array<{ update_time: number; price: string; name: string }> };
    const list = data.list ?? [];
    const prices = list.map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
    prices.sort((a, b) => a - b);
    const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const p25 = prices.length ? prices[Math.floor(prices.length * 0.25)] : 0;
    const p75 = prices.length ? prices[Math.floor(prices.length * 0.75)] : 0;
    const last_24h = list.filter((r) => r.update_time >= NOW - DAY).length;
    const last_7d = list.filter((r) => r.update_time >= NOW - 7 * DAY).length;
    const last_30d = list.filter((r) => r.update_time >= NOW - 30 * DAY).length;
    return {
      total_page0: list.length,
      last_24h,
      last_7d,
      last_30d,
      median_price: median,
      p25_price: p25,
      p75_price: p75,
      sample_titles: list.slice(0, 3).map((r) => r.name),
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function main() {
  const results: Record<string, unknown[]> = {};
  for (const c of CANDIDATES) {
    const r = await probe(c.query);
    const family = c.family;
    if (!results[family]) results[family] = [];
    (results[family] as Array<Record<string, unknown>>).push({
      query: c.query,
      price_cap: c.price_cap,
      ...r,
    });
    console.log(JSON.stringify({ family, query: c.query, ...r }));
    await new Promise((r) => setTimeout(r, 200));
  }
  const out = {
    wave: 58,
    kind: "inventory_probe",
    measured_at: new Date().toISOString(),
    note: "page0 only (top 100), order=date. last_7d / last_24h are accurate for high-volume queries. Total count > 100 means listing volume strong.",
    by_family: results,
  };
  await writeFile(path.join(appDir, "reports/wave58-inventory-probe-latest.json"), JSON.stringify(out, null, 2));
  console.log("\n[done] wrote reports/wave58-inventory-probe-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
