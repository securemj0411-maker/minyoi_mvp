import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchDetail, searchPage, type SearchItem } from "../src/lib/bunjang";

type Disposition = "fresh_live_candidate" | "manual_review" | "hold";

type LiveRow = {
  pid: string;
  title: string;
  price: number;
  url: string;
  query: string;
  saleStatus: string;
  description: string;
  observedAt: string;
};

type Evaluation = {
  disposition: Disposition;
  reason: string;
  model: string | null;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const queries = ["소니 a7m3 바디", "소니 a7 iii 바디", "ilce-7m3 바디", "소니 a7m3 본체"];
const maxSearchRowsPerQuery = 12;
const maxDetailRows = 18;
const activeSaleStatuses = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function compact(value: unknown, limit = 96) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function text(row: LiveRow) {
  return `${row.title}\n${row.description}`.toLowerCase();
}

function exactA7M3(row: LiveRow) {
  const normalized = norm(`${row.title}\n${row.description}`);
  if (/a7m3|a7iii|a73|ilce7m3/.test(normalized)) return "sony-a7m3";
  return null;
}

function baseHold(row: LiveRow) {
  const t = text(row);
  if (!activeSaleStatuses.has(row.saleStatus.trim().toUpperCase())) return `inactive_sale_status:${row.saleStatus || "missing"}`;
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(t)) return "sold_text";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return "buying_text";
  if (/대여|렌탈|임대/.test(t)) return "rental_text";
  if (/고장|파손|부품용|수리|액정\s*깨|작동안|불량/.test(t)) return "damaged_or_parts_text";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_text";
  return null;
}

function evaluateCamera(row: LiveRow): Evaluation {
  const inactive = baseHold(row);
  if (inactive) return { disposition: "hold", reason: inactive, model: null, matchedSignals: [], holdSignals: [inactive] };

  const t = text(row);
  const title = row.title.toLowerCase();
  const model = exactA7M3(row);
  const bodySignal = /바디|body|본체|바디셋/.test(t);
  const bodyOnlySignal = /바디\s*단품|바디만|렌즈\s*없|렌즈없|body\s*only/.test(t);
  const lensBundle = /렌즈\s*포함|렌즈포함|번들렌즈|렌즈\s*세트|렌즈세트|패키지|렌즈.*같이|렌즈.*함께/.test(t);
  const accessoryOnlyTitle = /배터리만|충전기만|스트랩만|렌즈캡|캡만|케이지|스몰리그|그립만/.test(title);
  const newerOrOtherModel = /a7m4|a7iv|a7r|a7s|a7c|a7m2|a7ii|a7m5|a7v/.test(norm(`${row.title}\n${row.description}`));

  if (!model) {
    return { disposition: "manual_review", reason: "a7m3_exact_model_missing", model: null, matchedSignals: [], holdSignals: [] };
  }
  if (newerOrOtherModel) {
    return {
      disposition: "hold",
      reason: "other_sony_a7_family_model_conflict",
      model,
      matchedSignals: [model],
      holdSignals: ["other_a7_model"],
    };
  }
  if (accessoryOnlyTitle) {
    return {
      disposition: "hold",
      reason: "camera_accessory_only_title",
      model,
      matchedSignals: [model],
      holdSignals: ["accessory_only_title"],
    };
  }
  if (lensBundle && !bodyOnlySignal) {
    return {
      disposition: "manual_review",
      reason: "a7m3_lens_bundle_or_package_context",
      model,
      matchedSignals: [model],
      holdSignals: ["lens_bundle"],
    };
  }
  if (!bodySignal) {
    return {
      disposition: "manual_review",
      reason: "a7m3_exact_model_but_body_signal_missing",
      model,
      matchedSignals: [model],
      holdSignals: [],
    };
  }
  return {
    disposition: "fresh_live_candidate",
    reason: bodyOnlySignal ? "a7m3_body_only_explicit" : "a7m3_body_context_present",
    model,
    matchedSignals: [model, bodyOnlySignal ? "body_only" : "body_context"],
    holdSignals: [],
  };
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const dedup = new Map<string, SearchItem>();

  for (const query of queries) {
    const rows = await searchPage(query, 0, { order: "date", limit: maxSearchRowsPerQuery });
    for (const row of rows) {
      if (!dedup.has(row.pid)) dedup.set(row.pid, row);
    }
  }

  const rows: ObservedRow[] = [];
  for (const item of [...dedup.values()].slice(0, maxDetailRows)) {
    const detail = await fetchDetail(item.pid);
    if (!detail) {
      rows.push({
        pid: item.pid,
        title: item.name,
        price: item.price,
        url: item.url,
        query: item.query,
        saleStatus: "DETAIL_UNAVAILABLE",
        description: "",
        observedAt: new Date().toISOString(),
        disposition: "hold",
        reason: "detail_unavailable",
        model: null,
        matchedSignals: [],
        holdSignals: ["detail_unavailable"],
      });
      continue;
    }
    const liveRow: LiveRow = {
      pid: item.pid,
      title: item.name,
      price: item.price,
      url: item.url,
      query: item.query,
      saleStatus: detail.saleStatus,
      description: detail.description,
      observedAt: new Date().toISOString(),
    };
    rows.push({ ...liveRow, ...evaluateCamera(liveRow) });
  }

  const fresh = rows.filter((row) => row.disposition === "fresh_live_candidate");
  const manual = rows.filter((row) => row.disposition === "manual_review");
  const hold = rows.filter((row) => row.disposition === "hold");
  const report = {
    generatedAt,
    reportOnly: true,
    liveFetchPerformed: true,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    runtimeCatalogApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "camera_discovered",
    lane: "sony_a7m3_second_live_read_wave",
    queries,
    metrics: {
      searchRowsRead: dedup.size,
      detailRowsRead: rows.length,
      freshLiveCandidates: fresh.length,
      manualReviewRows: manual.length,
      holdRows: hold.length,
      freshCandidateThresholdForOwnerReady: 4,
      boundaryViolations: 0,
    },
    freshRows: fresh,
    manualRows: manual,
    holdRows: hold,
    rows,
    conclusion:
      fresh.length >= 4
        ? "camera_sony_a7m3_second_wave_has_enough_clean_rows_report_only"
        : "camera_sony_a7m3_second_wave_still_thin_report_only",
    nextStep:
      fresh.length >= 4
        ? "Regenerate A7M3 owner packet/checklist with second-wave evidence; do not execute."
        : "Keep A7M3 blocked and either broaden official model aliases or collect another no-write wave later.",
  };

  const jsonPath = path.join(reportsDir, "camera-a7m3-second-live-read-wave-latest.json");
  const mdPath = path.join(reportsDir, "camera-a7m3-second-live-read-wave-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Camera A7M3 Second Live-Read Wave",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveFetchPerformed: true",
    "- productionDbMutation: false",
    "- supabaseRead/write: false/false",
    "- runtime/public/candidate wiring: false/false/false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Metrics",
    "",
    `- searchRowsRead: ${report.metrics.searchRowsRead}`,
    `- detailRowsRead: ${report.metrics.detailRowsRead}`,
    `- freshLiveCandidates: ${report.metrics.freshLiveCandidates}`,
    `- manualReviewRows: ${report.metrics.manualReviewRows}`,
    `- holdRows: ${report.metrics.holdRows}`,
    "",
    "## Fresh Rows",
    "",
    mdTable(
      ["pid", "price", "status", "reason", "title"],
      fresh.map((row) => [row.pid, row.price, row.saleStatus, row.reason, compact(row.title)]),
    ),
    "",
    "## Manual Rows",
    "",
    mdTable(
      ["pid", "price", "status", "reason", "title"],
      manual.map((row) => [row.pid, row.price, row.saleStatus, row.reason, compact(row.title)]),
    ),
    "",
    "## Hold Rows",
    "",
    mdTable(
      ["pid", "price", "status", "reason", "title"],
      hold.map((row) => [row.pid, row.price, row.saleStatus, row.reason, compact(row.title)]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    searchRowsRead: report.metrics.searchRowsRead,
    detailRowsRead: report.metrics.detailRowsRead,
    freshLiveCandidates: report.metrics.freshLiveCandidates,
    manualReviewRows: report.metrics.manualReviewRows,
    holdRows: report.metrics.holdRows,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
