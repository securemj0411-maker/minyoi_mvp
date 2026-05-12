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
  comparableKey: string | null;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const queries = ["플스5 디스크 에디션", "ps5 디지털 에디션", "플스5 슬림 본체", "ps5 본체"];
const maxSearchRowsPerQuery = 12;
const maxDetailRows = 24;
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

function baseHold(row: LiveRow) {
  const t = text(row);
  const title = row.title.toLowerCase();
  if (!activeSaleStatuses.has(row.saleStatus.trim().toUpperCase())) return `inactive_sale_status:${row.saleStatus || "missing"}`;
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out|팔렸/.test(t)) return "sold_text";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return "buying_text";
  if (/대여|렌탈|임대/.test(t)) return "rental_text";
  if (/고장|파손|부품용|수리|작동안|불량|벤\s*기기|밴\s*기기|계정정지/.test(title)) return "damaged_or_restricted_text";
  if (/부품용|작동안|불량|벤\s*기기|밴\s*기기|계정정지/.test(t)) return "damaged_or_restricted_text";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_text";
  return null;
}

function ps5Model(row: LiveRow) {
  const normalizedTitle = norm(row.title);
  const normalized = norm(`${row.title}\n${row.description}`);
  const hasPs5 = /ps5|플스5|플레이스테이션5|playstation5/.test(normalized);
  if (!hasPs5) return null;
  const isPro = /ps5pro|플스5프로|플레이스테이션5프로|프로\b/.test(row.title.toLowerCase());
  const isSlim = /slim|슬림/.test(normalizedTitle);
  const discDriveAbsent = /디스크\s*(안|못)\s*들어|디스크\s*드라이브\s*(없|없는)|디스크\s*없는|디스크리스/.test(text(row));
  const isDigital = /digital|디지털|디스크없는|디스크리스|download/.test(normalized) || discDriveAbsent;
  const isDisc = !discDriveAbsent && /disc|disk|디스크에디션|디스크판|시디판/.test(normalizedTitle);
  if (isPro) return "playstation-5-pro-review";
  if (isSlim && isDigital && !isDisc) return "playstation-5-slim-digital";
  if (isSlim && isDisc) return "playstation-5-slim-disc";
  if (isDigital && !isDisc) return "playstation-5-digital";
  if (isDisc) return "playstation-5-disc";
  return "playstation-5-unknown-edition";
}

function evaluatePs5(row: LiveRow): Evaluation {
  const inactive = baseHold(row);
  if (inactive) return { disposition: "hold", reason: inactive, model: null, comparableKey: null, matchedSignals: [], holdSignals: [inactive] };

  const t = text(row);
  const title = row.title.toLowerCase();
  const model = ps5Model(row);
  const bodySignal = /본체|풀박|풀\s*박|세트|구성품|듀얼센스|패드|플스5|ps5|playstation/.test(t);
  const limitedEditionRisk = /30주년|한정판|리미티드|limited/.test(t);
  const accessoryOnlyTitle =
    /디스크\s*드라이브|듀얼센스|패드|컨트롤러|충전거치대|거치대|커버|스킨|케이스|헤드셋|게임\s*타이틀|시디|cd|소프트|계정|코드/.test(title) &&
    !/본체|풀박|풀\s*박|기기|콘솔/.test(title);
  const gameBundleRisk = /타이틀|게임\s*\d|게임\s*포함|시디\s*포함|cd\s*포함|디스크\s*모두|계정|dl/.test(t);
  const multiBundleRisk = /일괄|닌텐도|스위치|xbox|엑박|모니터|vr|플스4|ps4/.test(t);

  if (!model) {
    return { disposition: "manual_review", reason: "ps5_model_missing", model: null, comparableKey: null, matchedSignals: [], holdSignals: [] };
  }
  if (model === "playstation-5-pro-review") {
    return {
      disposition: "manual_review",
      reason: "ps5_pro_separate_policy_gate",
      model,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: [],
    };
  }
  if (limitedEditionRisk) {
    return {
      disposition: "manual_review",
      reason: "ps5_limited_or_special_edition_context",
      model,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["limited_or_special_edition"],
    };
  }
  if (accessoryOnlyTitle) {
    return {
      disposition: "hold",
      reason: "ps5_accessory_or_game_only_title",
      model,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["accessory_or_game_only"],
    };
  }
  if (multiBundleRisk) {
    return {
      disposition: "hold",
      reason: "ps5_cross_console_or_large_bundle",
      model,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: ["cross_console_or_large_bundle"],
    };
  }
  if (!bodySignal) {
    return {
      disposition: "manual_review",
      reason: "ps5_body_context_missing",
      model,
      comparableKey: null,
      matchedSignals: [model],
      holdSignals: [],
    };
  }
  if (model === "playstation-5-unknown-edition") {
    return {
      disposition: "manual_review",
      reason: "ps5_body_but_edition_unknown",
      model,
      comparableKey: null,
      matchedSignals: [model, "body_context"],
      holdSignals: [],
    };
  }
  if (gameBundleRisk) {
    return {
      disposition: "manual_review",
      reason: "ps5_body_with_game_or_account_bundle_context",
      model,
      comparableKey: null,
      matchedSignals: [model, "body_context"],
      holdSignals: ["game_or_account_bundle"],
    };
  }
  return {
    disposition: "fresh_live_candidate",
    reason: "ps5_body_exact_edition_context",
    model,
    comparableKey: `game_console|${model.replaceAll("-", "_")}|body`,
    matchedSignals: [model, "body_context"],
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
    rows.push({ ...liveRow, ...evaluatePs5(liveRow) });
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
    category: "game_console_body_narrow",
    lane: "playstation_5_body_edition_no_write_live_read",
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
      fresh.length >= 4 && comparableKeys.length <= 3
        ? "game_console_ps5_body_live_read_promising_report_only"
        : "game_console_ps5_body_live_read_needs_more_gates_report_only",
    nextStep:
      fresh.length >= 4 && comparableKeys.length <= 3
        ? "Prepare PS5 official source backfill and owner assessment; do not execute."
        : "Keep PS5 report-only and inspect manual/hold reasons before any owner packet.",
  };

  const jsonPath = path.join(reportsDir, "game-console-ps5-live-read-wave-latest.json");
  const mdPath = path.join(reportsDir, "game-console-ps5-live-read-wave-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console PS5 Live-Read Wave",
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
      ["pid", "price", "model", "reason", "title"],
      manual.map((row) => [row.pid, row.price, row.model ?? "-", row.reason, compact(row.title)]),
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
