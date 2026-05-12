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
  network: "unlocked" | "carrier" | null;
  batteryHealth: number | null;
  comparableKey: string | null;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const queries = [
  "아이폰 15 프로 256 자급제",
  "아이폰15프로 256 자급제",
  "iphone 15 pro 256 자급제",
  "아이폰 15 프로 256",
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
  if (/고장|파손|부품용|수리|액정\s*깨|작동안|불량|침수|메인보드|전면\s*파손|후면\s*파손/.test(t)) return "damaged_or_parts_text";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_text";
  if (/분실|락걸|락\s*걸|아이클라우드\s*락|icloud\s*lock|정지폰|도난/.test(t)) return "lock_or_lost_risk";
  return null;
}

function extractStorageGb(value: string) {
  const normalized = value.toLowerCase().replace(/,/g, "");
  const gb = normalized.match(/(?:용량|storage)?\s*(128|256|512)\s*(?:gb|기가|g)?\b/);
  return gb ? Number(gb[1]) : null;
}

function extractNetwork(value: string): "unlocked" | "carrier" | null {
  const normalized = value.toLowerCase();
  if (/자급제|언락|unlock|unlocked|공기계/.test(normalized)) return "unlocked";
  if (/skt|kt|lg\s*u\+|lgu|통신사|선약|선택약정|약정|확정기변/.test(normalized)) return "carrier";
  return null;
}

function extractBatteryHealth(value: string) {
  const normalized = value.toLowerCase();
  const match = normalized.match(/(?:배터리|배터리효율|성능|효율|battery)[^0-9]{0,12}(8[0-9]|9[0-9]|100)\s*%?/);
  if (match) return Number(match[1]);
  const compacted = normalized.match(/(8[0-9]|9[0-9]|100)\s*%\s*(?:배터리|효율|성능)/);
  return compacted ? Number(compacted[1]) : null;
}

function evaluatePhone(row: LiveRow): Evaluation {
  const inactive = baseHold(row);
  if (inactive) {
    return {
      disposition: "hold",
      reason: inactive,
      model: null,
      storageGb: null,
      network: null,
      batteryHealth: null,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [inactive],
    };
  }
  const t = text(row);
  const normalized = norm(`${row.title}\n${row.description}`);
  const isIphone = /아이폰|iphone/.test(normalized);
  const is15Pro = /15프로|15pro|iphone15pro|아이폰15프로/.test(normalized);
  const isMaxOrPlus = /promax|프로맥스|plus|플러스/.test(normalized);
  const otherModelConflict = /14프로|14pro|16프로|16pro|15일반|iphone15(?!pro)|아이폰15(?!프로)/.test(normalized);
  const accessoryOnlyTitle = /케이스|필름|충전기|어댑터|박스만|공박스|렌즈커버|카메라보호/.test(row.title.toLowerCase()) && !/아이폰|iphone/.test(row.title.toLowerCase());
  const bundleRisk = /케이스|필름|충전기|애플케어|애케플|일괄|\+/.test(t);
  const storageGb = extractStorageGb(t);
  const network = extractNetwork(t);
  const batteryHealth = extractBatteryHealth(t);
  const model = isIphone && is15Pro && !isMaxOrPlus ? "apple-iphone-15-pro" : null;

  if (!model) {
    return {
      disposition: "manual_review",
      reason: "iphone_15_pro_exact_model_missing",
      model: null,
      storageGb,
      network,
      batteryHealth,
      comparableKey: null,
      matchedSignals: [],
      holdSignals: [],
    };
  }
  if (isMaxOrPlus || otherModelConflict) {
    return {
      disposition: "hold",
      reason: "iphone_other_model_conflict",
      model,
      storageGb,
      network,
      batteryHealth,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["other_model"],
    };
  }
  if (accessoryOnlyTitle) {
    return {
      disposition: "hold",
      reason: "phone_accessory_only_title",
      model,
      storageGb,
      network,
      batteryHealth,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["accessory_only_title"],
    };
  }
  if (bundleRisk) {
    return {
      disposition: "manual_review",
      reason: "iphone_bundle_or_warranty_context",
      model,
      storageGb,
      network,
      batteryHealth,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["bundle_or_warranty"],
    };
  }
  if (!storageGb || !network || !batteryHealth) {
    return {
      disposition: "manual_review",
      reason: "iphone_storage_network_or_battery_missing",
      model,
      storageGb,
      network,
      batteryHealth,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: [],
    };
  }

  const batteryBand = batteryHealth >= 95 ? "bat95plus" : batteryHealth >= 90 ? "bat90_94" : "bat80_89";
  const comparableKey = `smartphone|${model.replaceAll("-", "_")}|${storageGb}|${network}|${batteryBand}`;
  return {
    disposition: "fresh_live_candidate",
    reason: "iphone_15_pro_with_storage_network_battery",
    model,
    storageGb,
    network,
    batteryHealth,
    comparableKey,
    matchedSignals: [model, `${storageGb}gb`, network, batteryBand],
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
        network: null,
        batteryHealth: null,
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
    rows.push({ ...liveRow, ...evaluatePhone(liveRow) });
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
    category: "smartphone_discovered",
    lane: "apple_iphone_15_pro_no_write_live_read",
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
        ? "smartphone_iphone_15_pro_has_clean_rows_report_only"
        : "smartphone_iphone_15_pro_still_needs_parser_or_density_report_only",
    nextStep:
      fresh.length >= 4
        ? "Add source backfill and owner assessment; still avoid runtime because battery/network split is high-risk."
        : "Keep smartphone internal-only and inspect manual reasons before any parser relaxation.",
  };

  const jsonPath = path.join(reportsDir, "smartphone-iphone15pro-live-read-wave-latest.json");
  const mdPath = path.join(reportsDir, "smartphone-iphone15pro-live-read-wave-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Smartphone iPhone 15 Pro Live-Read Wave",
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
      ["pid", "price", "status", "key", "battery", "reason", "title"],
      fresh.map((row) => [row.pid, row.price, row.saleStatus, row.comparableKey, row.batteryHealth ?? "-", row.reason, compact(row.title)]),
    ),
    "",
    "## Manual Rows",
    "",
    mdTable(
      ["pid", "price", "status", "reason", "storage", "network", "battery", "title"],
      manual.map((row) => [row.pid, row.price, row.saleStatus, row.reason, row.storageGb ?? "-", row.network ?? "-", row.batteryHealth ?? "-", compact(row.title)]),
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
