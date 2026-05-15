// Wave 89-B: 기존 sweep 10개 카테고리 sample 측정 (read-only)
// wave89 결과와 합쳐 통합 매트릭스 출력.

import { readFile, writeFile } from "node:fs/promises";

const SEARCH_URL = "https://api.bunjang.co.kr/api/1/find_v2.json";
const TREE_URL = "https://api.bunjang.co.kr/api/1/categories/list.json";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "ko-KR,ko;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  origin: "https://m.bunjang.co.kr",
  referer: "https://m.bunjang.co.kr/",
};

// 기존 sweep 10개 (pipeline-config.ts DEFAULT_CATEGORY_SWEEPS)
const EXISTING_SWEEP = [
  { id: "600700", rootId: "600", title: "휴대폰", root: "디지털" },
  { id: "600710", rootId: "600", title: "태블릿", root: "디지털" },
  { id: "600720", rootId: "600", title: "워치/밴드", root: "디지털" },
  { id: "600100", rootId: "600", title: "PC/노트북", root: "디지털" },
  { id: "600300", rootId: "600", title: "카메라/DSLR", root: "디지털" },
  { id: "600500", rootId: "600", title: "오디오/영상", root: "디지털" },
  { id: "600600", rootId: "600", title: "게임/타이틀", root: "디지털" },
  { id: "421", rootId: "421", title: "시계 (전체)", root: "시계" },
  { id: "610", rootId: "610", title: "가전제품 (전체)", root: "가전" },
  { id: "700600", rootId: "700", title: "골프", root: "스포츠/레저" },
];

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

function findInTree(nodes, id) {
  for (const n of nodes) {
    if (String(n.id) === String(id)) return n;
    if (Array.isArray(n.categories)) {
      const f = findInTree(n.categories, id);
      if (f) return f;
    }
  }
  return null;
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
  };
}

async function main() {
  console.log("[1/3] fetching category tree for count lookup...");
  const tree = await fetchJson(TREE_URL);
  const rootsArr = tree.categories || tree;

  console.log("[2/3] sampling existing sweep categories...");
  const results = [];
  for (const c of EXISTING_SWEEP) {
    const node = findInTree(rootsArr, c.id);
    const count = node ? Number(node.count) : null;
    process.stdout.write(`  [${c.id}] ${c.title.padEnd(15)} (count=${count?.toLocaleString().padStart(10)}) ... `);
    const r = await sampleCategory(c.id, c.title);
    results.push({ ...c, count, ...r });
    console.log(`fetched=${r.fetched} median=₩${r.price.median?.toLocaleString().padStart(10)} age_med=${r.ageMedianH?.toFixed(1)}h`);
    await new Promise((r) => setTimeout(r, 250));
  }

  console.log("\n[3/3] loading wave89 new-candidate results...");
  let waveNew = { results: [] };
  try {
    waveNew = JSON.parse(await readFile("reports/wave89-consumer-category-sample-latest.json", "utf-8"));
  } catch {
    console.log("  wave89 JSON missing, skipping merge");
  }

  await writeFile(
    "reports/wave89-existing-sweep-sample-latest.json",
    JSON.stringify({ wave: "89-B", measured_at: new Date().toISOString(), existing: results, new_candidates: waveNew.results }, null, 2),
  );

  // 통합 매트릭스 print
  console.log("\n\n┌─────────────────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ 통합 매트릭스 — 기존 sweep + 신규 후보                                                   │");
  console.log("└─────────────────────────────────────────────────────────────────────────────────────────┘");

  const formatRow = (kind, root, title, count, p25, med, p75, ageH) => {
    const c = count ? count.toLocaleString().padStart(10) : "—".padStart(10);
    const p25s = p25 ? `₩${p25.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const meds = med ? `₩${med.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const p75s = p75 ? `₩${p75.toLocaleString()}`.padStart(10) : "—".padStart(10);
    const age = ageH != null ? `${ageH.toFixed(1)}h`.padStart(6) : "—".padStart(6);
    return `${kind} │ ${root.padEnd(8)} │ ${title.padEnd(18)} │ ${c} │ ${p25s} │ ${meds} │ ${p75s} │ ${age}`;
  };

  console.log(`종류 │ root     │ 카테고리            │   매물수    │  가격p25   │  가격med   │  가격p75   │ 신선도`);
  console.log("─".repeat(110));
  console.log("───── 기존 sweep (이미 적용 중) ─────");
  for (const r of results) {
    console.log(formatRow("기존", r.root, r.title, r.count, r.price.p25, r.price.median, r.price.p75, r.ageMedianH));
  }
  console.log("\n───── 신규 후보 (wave89 측정) ─────");
  for (const root of waveNew.results) {
    for (const sub of root.subs) {
      if (sub.error || !sub.price) continue;
      console.log(formatRow("신규", root.rootTitle, sub.title, sub.count, sub.price.p25, sub.price.median, sub.price.p75, sub.ageHours.median));
    }
  }

  console.log("\n→ reports/wave89-existing-sweep-sample-latest.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
