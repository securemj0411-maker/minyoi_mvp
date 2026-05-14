// Wave 89-C: Bunjang 25개 root 카테고리 전수 sample 측정 (read-only)
// root ID로 직접 fetch 100건씩 → 가격 분포 + 회전 + top word 측정
// 사용자 지적: 7개만 측정했고 나머지 18개는 매물 count + 직관으로 defer해서 다시.

import { writeFile } from "node:fs/promises";

const TREE_URL = "https://api.bunjang.co.kr/api/1/categories/list.json";
const SEARCH_URL = "https://api.bunjang.co.kr/api/1/find_v2.json";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "ko-KR,ko;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  origin: "https://m.bunjang.co.kr",
  referer: "https://m.bunjang.co.kr/",
};

const SAMPLES = 100;

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

const STOP = new Set([
  "팝니다", "판매", "삽니다", "구매", "정품", "새상품", "미개봉", "거의새것", "급처",
  "양도", "분양", "무료", "직거래", "택배", "교환", "할인", "급매", "원", "만원",
  "가능", "사용감", "포함", "박스", "풀세트", "한정", "리퍼", "단품", "있는", "있어",
  "팝", "판", "팝니", "올", "올림", "한번", "거의", "새것", "있음", "정도",
]);

function topWords(titles, k = 10) {
  const freq = new Map();
  for (const t of titles) {
    const words = (t || "").split(/[\s\/\(\)\[\]\{\},\-_+·•★☆!?@#$%&*\d]+/u).filter(Boolean);
    for (const w of words) {
      if (w.length < 2) continue;
      if (STOP.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([w, c]) => `${w}(${c})`);
}

async function sampleCategory(categoryId, title) {
  const url = `${SEARCH_URL}?f_category_id=${categoryId}&order=date&n=${SAMPLES}&page=0&stat_category_required=1&req_ref=category&stat_device=w&version=4`;
  let items = [];
  try {
    const data = await fetchJson(url);
    items = data.list || [];
  } catch (err) {
    return { categoryId, title, error: err.message, fetched: 0 };
  }
  const prices = items.map((i) => Number(i.price)).filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  const titles = items.map((i) => i.name || "");
  const ages = [];
  const now = Date.now();
  for (const i of items) {
    const ts = Number(i.update_time) * 1000;
    if (Number.isFinite(ts) && ts > 0 && ts < now) ages.push((now - ts) / 3_600_000);
  }
  ages.sort((a, b) => a - b);
  return {
    categoryId,
    title,
    fetched: items.length,
    price: {
      p25: percentile(prices, 0.25),
      median: percentile(prices, 0.5),
      p75: percentile(prices, 0.75),
      max: prices[prices.length - 1] ?? null,
    },
    ageMedianH: percentile(ages, 0.5),
    topWords: topWords(titles),
    sampleTitles: titles.slice(0, 3),
  };
}

async function main() {
  console.log("[1/2] fetching category tree...");
  const tree = await fetchJson(TREE_URL);
  const roots = (tree.categories || tree).map((n) => ({ id: n.id, title: n.title, count: Number(n.count) || 0, subCount: (n.categories || []).length }))
    .sort((a, b) => b.count - a.count);

  console.log(`[2/2] sampling ${roots.length} root categories...`);
  const results = [];
  for (const r of roots) {
    process.stdout.write(`  [${r.id}] ${r.title.padEnd(15)} (count=${r.count.toLocaleString().padStart(10)}, sub=${String(r.subCount).padStart(2)}) ... `);
    const s = await sampleCategory(r.id, r.title);
    results.push({ ...r, ...s });
    if (s.error || s.fetched === 0) {
      console.log(`SKIP (${s.error || "0건"})`);
    } else {
      console.log(`med=₩${(s.price.median ?? 0).toLocaleString().padStart(10)} p75=₩${(s.price.p75 ?? 0).toLocaleString().padStart(10)} age_med=${s.ageMedianH?.toFixed(1)}h`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  await writeFile(
    "reports/wave89-all-roots-sample-latest.json",
    JSON.stringify({ wave: "89-C", measured_at: new Date().toISOString(), results }, null, 2),
  );

  console.log("\n\n┌─────────────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ 25개 root 전수 sample 매트릭스                                                                   │");
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────────────┘");
  console.log(`ID      │ 카테고리        │   매물(만)│ 가격 p25  │ 가격 med  │ 가격 p75  │ 회전(h) │ top 키워드`);
  console.log("─".repeat(180));
  for (const r of results) {
    const cnt = (r.count / 10000).toFixed(1);
    if (r.error || r.fetched === 0) {
      console.log(`${r.id.padEnd(8)}│ ${r.title.padEnd(14)} │ ${cnt.padStart(7)}만│ ERROR/0건`);
      continue;
    }
    const p25 = r.price.p25 ? `₩${r.price.p25.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const med = r.price.median ? `₩${r.price.median.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const p75 = r.price.p75 ? `₩${r.price.p75.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const age = r.ageMedianH != null ? `${r.ageMedianH.toFixed(1)}h`.padStart(6) : "—".padStart(6);
    const words = (r.topWords || []).slice(0, 6).join(" ");
    console.log(`${r.id.padEnd(8)}│ ${r.title.padEnd(14)} │ ${cnt.padStart(7)}만│ ${p25} │ ${med} │ ${p75} │ ${age} │ ${words}`);
  }

  console.log("\n→ reports/wave89-all-roots-sample-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
