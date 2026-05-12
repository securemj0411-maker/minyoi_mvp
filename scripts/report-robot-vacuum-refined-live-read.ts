import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchDetail, searchPage } from "../src/lib/bunjang";

type Disposition = "fresh_live_candidate" | "manual_review" | "hold";

type ObservedRow = {
  pid: string;
  title: string;
  price: number;
  url: string;
  query: string;
  saleStatus: string;
  description: string;
  disposition: Disposition;
  reason: string;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  liveFetchPerformed: true;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  supabaseRead: false;
  supabaseWrite: false;
  sourceHealthMutation: false;
  conclusion: string;
  queries: string[];
  metrics: {
    searchRowsRead: number;
    detailRowsRead: number;
    freshRows: number;
    manualRows: number;
    holdRows: number;
    riskyFreshRows: number;
  };
  rows: ObservedRow[];
  recommendation: string;
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "robot-vacuum-refined-live-read-latest.json");
const outputMdPath = path.join(reportsDir, "robot-vacuum-refined-live-read-latest.md");

const queries = [
  "\"로보락 S8 Pro Ultra\" 로봇청소기 풀박스",
  "\"로보락 S8 Pro Ultra\" 로봇청소기 판매",
  "\"에코백스 T20 옴니\" 로봇청소기",
  "\"X10 Pro Omni\" 로봇청소기 본품",
];

const ACTIVE = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function fullText(row: Pick<ObservedRow, "title" | "description">) {
  return `${row.title}\n${row.description}`.toLowerCase();
}

function evaluate(row: Pick<ObservedRow, "title" | "description" | "saleStatus">): Pick<ObservedRow, "disposition" | "reason"> {
  const t = fullText(row);
  const title = row.title.toLowerCase();
  const status = row.saleStatus.trim().toUpperCase();
  if (!ACTIVE.has(status)) return { disposition: "hold", reason: `inactive_sale_status:${row.saleStatus || "missing"}` };
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out/i.test(t)) return { disposition: "hold", reason: "title_or_description_sold_signal" };
  if (/사기|먹튀|신고|주의|피해|전문사기/.test(t)) return { disposition: "hold", reason: "fraud_warning_signal" };
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return { disposition: "hold", reason: "buying_intent_signal" };
  if (/고장|파손|부품용|수리|작동안|불량|내용필독/.test(t)) return { disposition: "hold", reason: "damaged_or_parts_signal" };
  if (/도크만|스테이션만|본체만|세정제|악세사리|액세서리|먼지봉투|물걸레|브러쉬|필터|배터리|부품|소모품/.test(title)) {
    return { disposition: "hold", reason: "dock_or_consumable_or_body_only_signal" };
  }

  const n = norm(`${row.title} ${row.description}`);
  const exact = [
    "s8proultra",
    "s8 pro ultra",
    "s8프로울트라",
    "s8 프로 울트라",
    "t20옴니",
    "t20 omni",
    "x10proomni",
    "x10 pro omni",
    "x10프로옴니",
  ].some((token) => n.includes(norm(token)));
  const robotContext = /로봇청소기|로봇\s*청소기|robot\s*vacuum/.test(t);
  if (!exact) return { disposition: "manual_review", reason: "exact_robot_vacuum_model_missing" };
  if (!robotContext) return { disposition: "manual_review", reason: "exact_model_but_robot_vacuum_context_missing" };
  if (/세정제|악세사리|액세서리|먼지봉투|물걸레|브러쉬|필터|배터리|소모품/.test(t)) {
    return { disposition: "manual_review", reason: "full_unit_title_but_description_mentions_accessories" };
  }
  return { disposition: "fresh_live_candidate", reason: "active_exact_robot_vacuum_full_unit_context" };
}

function renderMarkdown(report: Report) {
  return `${[
    "# Robot Vacuum Refined Live Read",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- reportOnly: ${report.reportOnly}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- searchRowsRead: ${report.metrics.searchRowsRead}`,
    `- detailRowsRead: ${report.metrics.detailRowsRead}`,
    `- freshRows: ${report.metrics.freshRows}`,
    `- manualRows: ${report.metrics.manualRows}`,
    `- holdRows: ${report.metrics.holdRows}`,
    `- riskyFreshRows: ${report.metrics.riskyFreshRows}`,
    "",
    "## Queries",
    "",
    ...report.queries.map((query) => `- ${query}`),
    "",
    "## Rows",
    "",
    "| disposition | pid | price | saleStatus | reason | query | title |",
    "|---|---:|---:|---|---|---|---|",
    ...report.rows.map((row) =>
      `| ${row.disposition} | ${row.pid} | ${row.price.toLocaleString("ko-KR")} | ${row.saleStatus || "-"} | ${row.reason} | ${row.query.replaceAll("|", "/")} | ${row.title.replaceAll("|", "/")} |`,
    ),
    "",
    "## Recommendation",
    "",
    `- ${report.recommendation}`,
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((item) => `- ${item}`),
    "",
  ].join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const searchRows = new Map<string, { pid: string; name: string; price: number; url: string; query: string }>();
  for (const query of queries) {
    const rows = await searchPage(query, 0, { order: "date", limit: 8 });
    for (const row of rows) {
      if (!searchRows.has(row.pid)) {
        searchRows.set(row.pid, { pid: row.pid, name: row.name, price: row.price, url: row.url, query });
      }
    }
  }

  const observedRows: ObservedRow[] = [];
  for (const row of [...searchRows.values()].slice(0, 16)) {
    const detail = await fetchDetail(row.pid);
    const base = {
      pid: row.pid,
      title: row.name,
      price: row.price,
      url: row.url,
      query: row.query,
      saleStatus: detail?.saleStatus ?? "DETAIL_UNAVAILABLE",
      description: detail?.description ?? "",
    };
    observedRows.push({ ...base, ...evaluate(base) });
  }

  const risky = /렌탈|대여|임대|사기|피해|주의|케이스|파우치|부품|소모품|도크만|본체만|삽니다|가품|짭/i;
  const freshRows = observedRows.filter((row) => row.disposition === "fresh_live_candidate");
  const riskyFreshRows = freshRows.filter((row) => risky.test(`${row.title}\n${row.description}`)).length;
  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    liveFetchPerformed: true,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    sourceHealthMutation: false,
    conclusion: freshRows.length >= 2 && riskyFreshRows === 0
      ? "robot_vacuum_refined_queries_found_clean_fresh_rows_report_only"
      : "robot_vacuum_refined_queries_still_not_ready_for_runtime_review",
    queries,
    metrics: {
      searchRowsRead: searchRows.size,
      detailRowsRead: observedRows.length,
      freshRows: freshRows.length,
      manualRows: observedRows.filter((row) => row.disposition === "manual_review").length,
      holdRows: observedRows.filter((row) => row.disposition === "hold").length,
      riskyFreshRows,
    },
    rows: observedRows,
    recommendation: freshRows.length >= 2 && riskyFreshRows === 0
      ? "Prepare a small robot-vacuum owner review packet, still without runtime apply."
      : "Keep robot vacuum in refinement. Increase full-unit precision or choose another model family.",
    nextSteps: [
      "If clean fresh rows are present, convert them plus hold rows into regression fixture candidates.",
      "If no clean fresh rows are present, keep robot vacuum out of runtime patch scope.",
      "Never publish robot vacuum candidates from this report directly.",
    ],
  };

  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, renderMarkdown(report), "utf8");
  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(JSON.stringify(report.metrics));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
