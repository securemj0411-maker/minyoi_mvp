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
  ramGb: number | null;
  storageGb: number | null;
  comparableKey: string | null;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const targetedMode = process.env.MACMINI_TARGETED === "1";
const queries = targetedMode
  ? ["맥미니 m2 16 512", "맥미니 m2 16g 512g", "mac mini m2 16 512", "맥미니 m2 pro 16 512"]
  : ["맥미니 m2", "맥 미니 m2", "mac mini m2"];
const maxSearchRowsPerQuery = 12;
const maxDetailRows = targetedMode ? 24 : 18;
const activeSaleStatuses = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);

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

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function text(row: LiveRow) {
  return `${row.title}\n${row.description}`.toLowerCase();
}

function extractRamGb(value: string) {
  const normalized = value.toLowerCase();
  const match = normalized.match(/(?:ram|램|메모리)?\s*(8|16|24)\s*(?:gb|기가|g)\b/);
  return match ? Number(match[1]) : null;
}

function extractStorageGb(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, "");
  const tb = normalized.match(/(?:ssd|용량|저장공간)?\s*(1|2)\s*(?:tb|테라)\b/);
  if (tb) return Number(tb[1]) * 1000;
  const gb = normalized.match(/(?:ssd|용량|저장공간)?\s*(256|512)\s*(?:gb|기가|g)\b/);
  return gb ? Number(gb[1]) : null;
}

function baseHold(row: LiveRow) {
  const t = text(row);
  if (!activeSaleStatuses.has(row.saleStatus.trim().toUpperCase())) return `inactive_sale_status:${row.saleStatus || "missing"}`;
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(t)) return "sold_text";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return "buying_text";
  if (/대여|렌탈|임대/.test(t)) return "rental_text";
  if (/고장|파손|부품용|수리|작동안|불량/.test(t)) return "damaged_or_parts_text";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_text";
  return null;
}

function evaluateDesktop(row: LiveRow): Evaluation {
  const inactive = baseHold(row);
  if (inactive) {
    return {
      disposition: "hold",
      reason: inactive,
      model: null,
      ramGb: null,
      storageGb: null,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [inactive],
    };
  }

  const t = text(row);
  const normalized = norm(`${row.title}\n${row.description}`);
  const isMacMini = /맥미니|맥미니m|macmini/.test(normalized);
  const isM2 = /m2/.test(normalized);
  const isM2Pro = /m2pro|m2프로/.test(normalized);
  const otherModelConflict = /(^|[^a-z0-9])(m1|m4)([^a-z0-9]|$)|인텔|intel/.test(t);
  const accessoryOnlyTitle = /케이블|허브|독|dock|스탠드|거치대|키보드|마우스|어댑터|파워케이블/.test(row.title.toLowerCase()) && !isMacMini;
  const bundleRisk = /모니터|키보드|마우스|트랙패드|도킹|도크|허브|독|dock|일괄|세트|\+/.test(t);
  const ramGb = extractRamGb(t);
  const storageGb = extractStorageGb(t);
  const model = isM2Pro ? "apple-mac-mini-m2-pro" : "apple-mac-mini-m2";

  if (!isMacMini || !isM2) {
    return {
      disposition: "manual_review",
      reason: "mac_mini_m2_exact_model_missing",
      model: null,
      ramGb,
      storageGb,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [],
    };
  }
  if (otherModelConflict) {
    return {
      disposition: "hold",
      reason: "mac_mini_other_chip_conflict",
      model,
      ramGb,
      storageGb,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["other_chip"],
    };
  }
  if (accessoryOnlyTitle) {
    return {
      disposition: "hold",
      reason: "desktop_accessory_only_title",
      model,
      ramGb,
      storageGb,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["accessory_only_title"],
    };
  }
  if (bundleRisk) {
    return {
      disposition: "manual_review",
      reason: "mac_mini_bundle_or_extra_device_context",
      model,
      ramGb,
      storageGb,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["bundle_risk"],
    };
  }
  if (!ramGb || !storageGb) {
    return {
      disposition: "manual_review",
      reason: "mac_mini_m2_ram_or_storage_missing",
      model,
      ramGb,
      storageGb,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: [],
    };
  }

  const comparableKey = `desktop|${model.replaceAll("-", "_")}|ram${ramGb}|ssd${storageGb}`;
  return {
    disposition: "fresh_live_candidate",
    reason: "mac_mini_m2_full_unit_with_ram_storage",
    model,
    ramGb,
    storageGb,
    comparableKey,
    matchedSignals: [model, `ram${ramGb}`, `ssd${storageGb}`],
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
        ramGb: null,
        storageGb: null,
        comparableKey: null,
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
    rows.push({ ...liveRow, ...evaluateDesktop(liveRow) });
  }

  const fresh = rows.filter((row) => row.disposition === "fresh_live_candidate");
  const manual = rows.filter((row) => row.disposition === "manual_review");
  const hold = rows.filter((row) => row.disposition === "hold");
  const comparableKeys = [...new Set(fresh.map((row) => row.comparableKey).filter(Boolean))];
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
    category: "desktop_pc_discovered",
    lane: targetedMode ? "apple_mac_mini_m2_targeted_key_no_write_live_read" : "apple_mac_mini_m2_no_write_live_read",
    queries,
    metrics: {
      searchRowsRead: dedup.size,
      detailRowsRead: rows.length,
      freshLiveCandidates: fresh.length,
      manualReviewRows: manual.length,
      holdRows: hold.length,
      comparableKeys: comparableKeys.length,
      boundaryViolations: 0,
    },
    comparableKeys,
    freshRows: fresh,
    manualRows: manual,
    holdRows: hold,
    rows,
    conclusion:
      targetedMode && fresh.length >= 4
        ? "desktop_mac_mini_m2_targeted_live_read_promising_report_only"
        : !targetedMode && fresh.length >= 4 && comparableKeys.length <= 3
          ? "desktop_mac_mini_m2_live_read_promising_report_only"
          : "desktop_mac_mini_m2_live_read_needs_more_evidence_report_only",
    nextStep:
      targetedMode && fresh.length >= 4
        ? "Prepare a Mac mini targeted owner assessment; do not execute."
        : !targetedMode && fresh.length >= 4 && comparableKeys.length <= 3
          ? "Prepare official source backfill and owner review packet; do not execute."
          : "Keep report-only and either broaden aliases or choose a cleaner desktop lane.",
  };

  const outputPrefix = targetedMode
    ? "desktop-macmini-m2-targeted-live-read-wave-latest"
    : "desktop-macmini-m2-live-read-wave-latest";
  const jsonPath = path.join(reportsDir, `${outputPrefix}.json`);
  const mdPath = path.join(reportsDir, `${outputPrefix}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    targetedMode ? "# Desktop Mac mini M2 Targeted Live-Read Wave" : "# Desktop Mac mini M2 Live-Read Wave",
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
    `- comparableKeys: ${report.metrics.comparableKeys}`,
    "",
    "## Comparable Keys",
    "",
    ...comparableKeys.map((key) => `- ${key}`),
    "",
    "## Fresh Rows",
    "",
    mdTable(
      ["pid", "price", "key", "reason", "title"],
      fresh.map((row) => [row.pid, row.price, row.comparableKey, row.reason, compact(row.title)]),
    ),
    "",
    "## Manual Rows",
    "",
    mdTable(
      ["pid", "price", "reason", "ram", "ssd", "title"],
      manual.map((row) => [row.pid, row.price, row.reason, row.ramGb ?? "-", row.storageGb ?? "-", compact(row.title)]),
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
    comparableKeys: report.metrics.comparableKeys,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
