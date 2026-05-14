import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const API = "https://api.bunjang.co.kr/api/1/find_v2.json";
const HEADERS = {
  Origin: "https://m.bunjang.co.kr",
  Referer: "https://m.bunjang.co.kr/",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
};

const QUERIES = [
  "소니 A7M3","소니 A7C","캐논 R6 Mark II",
  "비츠 솔로4","비츠 스튜디오 프로",
  "갤럭시 버즈 3 프로",
  "보스 QC 울트라","보스 QC45",
  "WH-CH520",
  "LG 그램 17",
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
    const res = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { error: `http_${res.status}` };
    const data = await res.json() as { list?: Array<{ update_time: number; price: string; name: string }> };
    const list = data.list ?? [];
    const prices = list.map(r => Number(r.price)).filter(p => Number.isFinite(p) && p > 0).sort((a,b) => a-b);
    const median = prices.length ? prices[Math.floor(prices.length/2)] : 0;
    return {
      total: list.length,
      last_24h: list.filter(r => r.update_time >= NOW - DAY).length,
      last_7d: list.filter(r => r.update_time >= NOW - 7*DAY).length,
      last_30d: list.filter(r => r.update_time >= NOW - 30*DAY).length,
      median_price: median,
      sample_titles: list.slice(0,2).map(r => r.name),
    };
  } catch (e) { return { error: (e as Error).message }; }
}

async function main() {
  const results: Record<string, unknown> = {};
  for (const q of QUERIES) {
    const r = await probe(q);
    results[q] = r;
    console.log(JSON.stringify({ q, ...r }));
    await new Promise(r => setTimeout(r, 200));
  }
  await writeFile(path.join(appDir, "reports/wave61-inventory-probe-latest.json"),
    JSON.stringify({ wave: 61, measured_at: new Date().toISOString(), results }, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
