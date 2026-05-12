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
  storageGb: number | null;
  connectivity: "wifi" | "cellular" | null;
  comparableKey: string | null;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const targetedMode = process.env.IPAD_TARGETED === "1";
const queries = targetedMode
  ? [
      "아이패드 프로 11 m4 256 와이파이",
      "아이패드 프로 11 m4 256 wifi",
      "아이패드 프로 11 m4 256 셀룰러",
      "ipad pro 11 m4 256 cellular",
    ]
  : [
      "아이패드 프로 11 m4 256",
      "아이패드 프로 11 m4 와이파이",
      "아이패드 프로 m4 11인치",
      "ipad pro 11 m4 256",
    ];
const maxSearchRowsPerQuery = 12;
const maxDetailRows = 24;
const activeSaleStatuses = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function text(row: LiveRow) {
  return `${row.title}\n${row.description}`.toLowerCase();
}

function title(row: LiveRow) {
  return row.title.toLowerCase();
}

function compact(value: unknown, limit = 96) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  return raw.length > limit ? `${raw.slice(0, limit)}...` : raw;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function baseHold(row: LiveRow) {
  const t = text(row);
  if (!activeSaleStatuses.has(row.saleStatus.trim().toUpperCase())) return `inactive_sale_status:${row.saleStatus || "missing"}`;
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(t)) return "sold_text";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return "buying_text";
  if (/대여|렌탈|임대/.test(t)) return "rental_text";
  if (/고장|파손|부품용|수리|액정\s*깨|작동안|불량|침수/.test(t)) return "damaged_or_parts_text";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_text";
  return null;
}

function extractStorageGb(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, "");
  const tb = normalized.match(/(?:용량|storage)?\s*(1|2)\s*(?:tb|테라)\b/);
  if (tb) return Number(tb[1]) * 1000;
  const gb = normalized.match(/(?:용량|storage)?\s*(128|256|512)\s*(?:gb|기가|g)\b/);
  if (gb) return Number(gb[1]);
  const bare = normalized.match(/(?:^|[^0-9])(128|256|512)(?:[^0-9]|$)/);
  return bare ? Number(bare[1]) : null;
}

function extractConnectivity(value: string): "wifi" | "cellular" | null {
  const normalized = value.toLowerCase();
  if (/와이파이|wi[\s-]?fi|wifi|무선랜/.test(normalized)) return "wifi";
  if (/셀룰러|cellular|lte|5g|\b유심\b/.test(normalized)) return "cellular";
  return null;
}

function evaluateTablet(row: LiveRow): Evaluation {
  const inactive = baseHold(row);
  if (inactive) {
    return {
      disposition: "hold",
      reason: inactive,
      model: null,
      storageGb: null,
      connectivity: null,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [inactive],
    };
  }

  const t = text(row);
  const ti = title(row);
  const normalized = norm(`${row.title}\n${row.description}`);
  const titleNorm = norm(row.title);
  const isIpad = /아이패드|ipad/.test(normalized);
  const isPro = /프로|pro/.test(normalized);
  const isM4 = /m4/.test(normalized);
  const is11 = /11인치|11inch|11형|11\"|11\b/.test(t);
  const otherModelConflict = /m1|m2|m3|air|에어|mini|미니|9세대|10세대|7세대|6세대/.test(normalized);
  const accessoryTerms = /펜슬|pencil|키보드|keyboard|매직키보드|케이스|커버|필름|파우치|충전기|어댑터/.test(ti);
  const accessoryOnlyTitle = accessoryTerms && !(/아이패드|ipad/.test(titleNorm));
  const bundleRisk = /펜슬|pencil|키보드|keyboard|매직키보드|케이스|커버|필름|파우치|일괄|\+/.test(t)
    || /(?:케이스|펜슬|키보드|매직키보드|트랙패드).*(?:포함|같이|함께)/.test(t);
  const storageGb = extractStorageGb(t);
  const connectivity = extractConnectivity(t);
  const model = isIpad && isPro && isM4 && is11 ? "apple-ipad-pro-11-m4" : null;

  if (!model) {
    return {
      disposition: "manual_review",
      reason: "ipad_pro_11_m4_exact_model_missing",
      model: null,
      storageGb,
      connectivity,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [],
    };
  }
  if (otherModelConflict) {
    return {
      disposition: "hold",
      reason: "ipad_other_generation_or_family_conflict",
      model,
      storageGb,
      connectivity,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["other_generation_or_family"],
    };
  }
  if (accessoryOnlyTitle) {
    return {
      disposition: "hold",
      reason: "tablet_accessory_only_title",
      model,
      storageGb,
      connectivity,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["accessory_only_title"],
    };
  }
  if (bundleRisk) {
    return {
      disposition: "manual_review",
      reason: "ipad_bundle_or_accessory_context",
      model,
      storageGb,
      connectivity,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["bundle_risk"],
    };
  }
  if (!storageGb || !connectivity) {
    return {
      disposition: "manual_review",
      reason: "ipad_storage_or_connectivity_missing",
      model,
      storageGb,
      connectivity,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: [],
    };
  }

  const comparableKey = `tablet|${model.replaceAll("-", "_")}|${storageGb}|${connectivity}`;
  return {
    disposition: "fresh_live_candidate",
    reason: "ipad_pro_11_m4_with_storage_connectivity",
    model,
    storageGb,
    connectivity,
    comparableKey,
    matchedSignals: [model, `${storageGb}gb`, connectivity],
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
        storageGb: null,
        connectivity: null,
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
    rows.push({ ...liveRow, ...evaluateTablet(liveRow) });
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
    category: "tablet_discovered",
    lane: targetedMode ? "apple_ipad_pro_11_m4_256_targeted_no_write_live_read" : "apple_ipad_pro_11_m4_no_write_live_read",
    queries,
    metrics: {
      searchRowsRead: dedup.size,
      detailRowsRead: rows.length,
      freshLiveCandidates: fresh.length,
      manualReviewRows: manual.length,
      holdRows: hold.length,
      comparableKeys: comparableKeys.length,
      freshCandidateThresholdForOwnerReady: 4,
      boundaryViolations: 0,
    },
    freshRows: fresh,
    manualRows: manual,
    holdRows: hold,
    rows,
    conclusion:
      fresh.length >= 4
        ? "tablet_ipad_pro_11_m4_has_enough_clean_rows_report_only"
        : "tablet_ipad_pro_11_m4_still_needs_thickening_report_only",
    nextStep:
      fresh.length >= 4
        ? "Add official source backfill and owner assessment; do not execute."
        : "Keep tablet internal/report-only and collect a targeted second wave or relax only after reviewing manual rows.",
  };

  const baseName = targetedMode ? "tablet-ipad-pro-m4-targeted-live-read-wave-latest" : "tablet-ipad-pro-m4-live-read-wave-latest";
  const jsonPath = path.join(reportsDir, `${baseName}.json`);
  const mdPath = path.join(reportsDir, `${baseName}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Tablet iPad Pro M4 Live-Read Wave",
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
    "## Fresh Rows",
    "",
    mdTable(
      ["pid", "price", "status", "key", "reason", "title"],
      fresh.map((row) => [row.pid, row.price, row.saleStatus, row.comparableKey, row.reason, compact(row.title)]),
    ),
    "",
    "## Manual Rows",
    "",
    mdTable(
      ["pid", "price", "status", "reason", "storage", "conn", "title"],
      manual.map((row) => [row.pid, row.price, row.saleStatus, row.reason, row.storageGb ?? "-", row.connectivity ?? "-", compact(row.title)]),
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
    report.nextStep,
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
