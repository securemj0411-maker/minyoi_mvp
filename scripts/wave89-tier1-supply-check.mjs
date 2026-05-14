// Wave 89-D: Tier 1 카테고리 매물대 (공급량) 적정성 측정 (read-only)
// page 0/5/20/50 sample → 페이지별 oldest age → 일일 in-flow + 매물 수명 추정
// 사용자 요구: outlier 게임이라 회전 안 빨라도 OK BUT 일일 in-flow 너무 sparse하면 위험

const SEARCH_URL = "https://api.bunjang.co.kr/api/1/find_v2.json";

const HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "ko-KR,ko;q=0.9",
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  origin: "https://m.bunjang.co.kr",
  referer: "https://m.bunjang.co.kr/",
};

const TIER1 = [
  { id: "990", title: "예술/희귀/수집품", count_total: 559_514 },
  { id: "910", title: "스타굿즈",          count_total: 2_272_984 },
  { id: "800", title: "생활/주방용품",      count_total: 165_366 },
  { id: "610", title: "가전제품",          count_total: 105_185 },
];

const PAGES = [0, 5, 20, 50];
const SAMPLES = 100;

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function ageStats(items) {
  const now = Date.now();
  const ages = items
    .map((i) => Number(i.update_time) * 1000)
    .filter((t) => Number.isFinite(t) && t > 0 && t < now)
    .map((t) => (now - t) / 3_600_000)
    .sort((a, b) => a - b);
  if (ages.length === 0) return null;
  return {
    median: ages[Math.floor(ages.length / 2)],
    oldest: ages[ages.length - 1],
    youngest: ages[0],
  };
}

async function fetchPage(catId, page) {
  const url = `${SEARCH_URL}?f_category_id=${catId}&order=date&n=${SAMPLES}&page=${page}&stat_category_required=1&req_ref=category&stat_device=w&version=4`;
  const data = await fetchJson(url);
  return data.list || [];
}

async function main() {
  const out = [];
  for (const t of TIER1) {
    console.log(`\n=== [${t.id}] ${t.title} (total ${t.count_total.toLocaleString()}) ===`);
    const pageStats = [];
    for (const p of PAGES) {
      const items = await fetchPage(t.id, p);
      const stats = ageStats(items);
      if (!stats) {
        console.log(`  page ${p.toString().padStart(2)}: 0건`);
        pageStats.push({ page: p, fetched: 0 });
        continue;
      }
      // page p의 oldest = 100×(p+1) 매물 모이는데 걸린 시간
      const itemsBeforeThisPage = SAMPLES * (p + 1);
      const inflowPerHour = stats.oldest > 0 ? itemsBeforeThisPage / stats.oldest : null;
      const inflowPerDay = inflowPerHour ? inflowPerHour * 24 : null;
      console.log(
        `  page ${p.toString().padStart(2)}: fetched=${items.length} youngest=${stats.youngest.toFixed(2)}h oldest=${stats.oldest.toFixed(1)}h ` +
        `→ ~${itemsBeforeThisPage}건 모이는데 ${stats.oldest.toFixed(1)}h ` +
        `→ in-flow ~${inflowPerHour?.toFixed(0)}건/h (${inflowPerDay?.toFixed(0)}건/일)`
      );
      pageStats.push({ page: p, fetched: items.length, ...stats, itemsBeforeThisPage, inflowPerHour, inflowPerDay });
      await new Promise((r) => setTimeout(r, 200));
    }
    out.push({ ...t, pages: pageStats });
  }

  console.log("\n\n┌──────────────────────────────────────────────────────────────────────────────┐");
  console.log("│ Tier 1 매물대 적정성 평가                                                    │");
  console.log("└──────────────────────────────────────────────────────────────────────────────┘");
  console.log("ID   │ 카테고리          │ p0 oldest │ p20 oldest │ in-flow (일/시간) │ 평가");
  console.log("─".repeat(120));
  for (const r of out) {
    const p0 = r.pages.find((p) => p.page === 0);
    const p20 = r.pages.find((p) => p.page === 20);
    const p50 = r.pages.find((p) => p.page === 50);
    const inflowDay = p20?.inflowPerDay || p0?.inflowPerDay;
    const verdict =
      !inflowDay ? "?"
      : inflowDay > 5000 ? "🟢 풍족 (>5k건/일)"
      : inflowDay > 1000 ? "🟢 충분 (>1k건/일)"
      : inflowDay > 200 ? "🟡 적정 (200~1k건/일)"
      : inflowDay > 50 ? "🟠 sparse (50~200건/일)"
      : "🔴 심각 (<50건/일)";
    const oldest50h = p50?.oldest != null ? `${p50.oldest.toFixed(1)}h (${(p50.oldest / 24).toFixed(1)}일)` : "—";
    console.log(
      `${r.id.padEnd(5)}│ ${r.title.padEnd(16)} │ ${p0?.oldest?.toFixed(1).padStart(7)}h │ ${p20?.oldest?.toFixed(1).padStart(8)}h │ ` +
      `${(inflowDay || 0).toFixed(0).padStart(6)}건/일 / ${(p20?.inflowPerHour || 0).toFixed(0).padStart(4)}건/h │ ${verdict}`
    );
    console.log(`     │     [page 50 oldest = ${oldest50h} → 5000건이 그 시간 안에 등록]`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
