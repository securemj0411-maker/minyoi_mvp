// Wave 89: 일반인 친화 카테고리 sample 측정 (read-only)
// 5 일반인 친화 root × 각 root sub-category top 5 → page 0 100건 fetch → 분포 측정
// 출력: console summary + reports/wave89-consumer-category-sample-latest.json

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

// 사용자 친화 + 차익 가능성 후보 root
const TARGET_ROOTS = [
  { id: "500", title: "유아동/출산", priority: 1 },
  { id: "700", title: "스포츠/레저", priority: 1 },
  { id: "410", title: "뷰티/미용", priority: 2 },
  { id: "405", title: "신발", priority: 2 },
  { id: "430", title: "가방/지갑", priority: 3 },
  { id: "422", title: "쥬얼리", priority: 3 },
  { id: "920", title: "음반/악기", priority: 3 },
];

const SUBS_PER_ROOT = 5;
const SAMPLES_PER_SUB = 100;

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = n.categories ? findNode(n.categories, id) : null;
    if (found) return found;
  }
  return null;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

function topWords(titles, k = 12) {
  const STOP = new Set([
    "팝니다", "판매", "삽니다", "구매", "정품", "새상품", "미개봉", "거의새것", "급처",
    "양도", "분양", "무료", "직거래", "택배", "교환", "할인", "급매", "원", "만원", "원만",
    "가능", "사용감", "포함", "포함된", "박스", "풀세트", "한정", "리퍼", "단품"
  ]);
  const freq = new Map();
  for (const t of titles) {
    const words = (t || "").split(/[\s\/\(\)\[\]\{\},\-_+·•★☆!?@#$%&*\d]+/u).filter(Boolean);
    for (const w of words) {
      if (w.length < 2) continue;
      if (STOP.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, k);
}

async function sampleCategory(categoryId, title) {
  const url = `${SEARCH_URL}?f_category_id=${categoryId}&order=date&n=${SAMPLES_PER_SUB}&page=0&stat_category_required=1&req_ref=category&stat_device=w&version=4`;
  let items = [];
  try {
    const data = await fetchJson(url);
    items = data.list || data.items || [];
  } catch (err) {
    return { categoryId, title, error: err.message, fetched: 0 };
  }

  const prices = items.map((i) => Number(i.price)).filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  const titles = items.map((i) => i.name || i.title || "");
  const saleStatusCounts = new Map();
  for (const i of items) {
    const status = (i.status || i.sale_status || "unknown").toString();
    saleStatusCounts.set(status, (saleStatusCounts.get(status) || 0) + 1);
  }

  const ages = [];
  const now = Date.now();
  for (const i of items) {
    const ts = Number(i.update_time) * 1000;
    if (Number.isFinite(ts) && ts > 0 && ts < now) {
      ages.push((now - ts) / (60 * 60 * 1000));
    }
  }
  ages.sort((a, b) => a - b);

  return {
    categoryId,
    title,
    fetched: items.length,
    price: {
      min: prices[0] ?? null,
      p25: percentile(prices, 0.25),
      median: percentile(prices, 0.5),
      p75: percentile(prices, 0.75),
      max: prices[prices.length - 1] ?? null,
      mean: prices.length ? Math.round(prices.reduce((s, p) => s + p, 0) / prices.length) : null,
    },
    ageHours: {
      p25: percentile(ages, 0.25),
      median: percentile(ages, 0.5),
      p75: percentile(ages, 0.75),
      max: ages[ages.length - 1] ?? null,
    },
    saleStatus: Object.fromEntries(saleStatusCounts),
    topWords: topWords(titles),
    sampleTitles: titles.slice(0, 5),
  };
}

async function main() {
  console.log("fetching category tree...");
  const tree = await fetchJson(TREE_URL);
  const rootsArr = tree.categories || tree.data?.categories || tree;

  const results = [];
  for (const { id, title, priority } of TARGET_ROOTS) {
    const node = findNode(rootsArr, id);
    if (!node) {
      console.log(`  root ${id} (${title}) not found`);
      continue;
    }
    const subs = (node.categories || [])
      .map((c) => ({ id: c.id, title: c.title, count: Number(c.count) || 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, SUBS_PER_ROOT);

    console.log(`\n=== [${id}] ${title} — total ${node.count?.toLocaleString()} ; top ${subs.length} sub ===`);
    const subResults = [];
    for (const sub of subs) {
      process.stdout.write(`  [${sub.id}] ${sub.title} (count=${sub.count.toLocaleString()}) ... `);
      const r = await sampleCategory(sub.id, sub.title);
      subResults.push({ ...sub, ...r });
      if (r.error) {
        console.log(`ERROR ${r.error}`);
      } else {
        const p = r.price;
        console.log(`fetched=${r.fetched} price[p25=${p.p25?.toLocaleString()} med=${p.median?.toLocaleString()} p75=${p.p75?.toLocaleString()}] median_age=${r.ageHours.median?.toFixed(1)}h`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    results.push({ rootId: id, rootTitle: title, priority, total: node.count, subs: subResults });
  }

  await writeFile(
    "reports/wave89-consumer-category-sample-latest.json",
    JSON.stringify({ wave: 89, measured_at: new Date().toISOString(), results }, null, 2),
  );
  console.log("\n→ reports/wave89-consumer-category-sample-latest.json");

  console.log("\n\n=== ROOT SUMMARY (price median + age median across sub) ===");
  for (const r of results) {
    const validSubs = r.subs.filter((s) => !s.error && s.price?.median);
    if (validSubs.length === 0) continue;
    const medianOfMedians = validSubs.map((s) => s.price.median).sort((a, b) => a - b);
    const medMid = medianOfMedians[Math.floor(medianOfMedians.length / 2)];
    const agesValid = validSubs.map((s) => s.ageHours.median).filter((a) => a != null).sort((a, b) => a - b);
    const ageMid = agesValid[Math.floor(agesValid.length / 2)] || null;
    console.log(`  [${r.rootId}] ${r.rootTitle.padEnd(15)} median(sub_medians)=₩${medMid?.toLocaleString().padStart(10)} median_age=${ageMid?.toFixed(1)}h`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
