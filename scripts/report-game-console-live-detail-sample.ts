import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { parseGameConsoleListing } from "@/lib/game-console-parser";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const sourcePath = path.join(reportsDir, "game-console-live-search-scope-latest.json");

const ACTIVE_SALE_STATUSES = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);
const MAX_DETAIL_ROWS = 40;
const DETAIL_DELAY_MS = 160;

type SourceRow = {
  pid: number;
  title: string;
  price: number;
  query: string;
  comparableKey: string | null;
  parseConfidence: number;
};

type SourceReport = {
  candidateRows: SourceRow[];
};

type DetailDecision = "still_candidate" | "downgraded_manual_review" | "downgraded_hold" | "detail_missing";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compact(text: unknown, limit = 72) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function saleStatusActive(status: string) {
  const normalized = status.trim().toUpperCase();
  return normalized ? ACTIVE_SALE_STATUSES.has(normalized) : true;
}

function hasTextHoldSignal(title: string, description: string) {
  const text = `${title}\n${description}`.toLowerCase();
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out/i.test(text)) return "sold_text_signal";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(text)) return "buying_intent_signal";
  if (/고장|파손|부품용|수리|액정\s*(?:깨짐|깨져|깨진|파손)|작동안|불량|와이파이\s*에러/.test(text)) return "damaged_or_parts_signal";
  if (/기스|스크래치|찍힘|찌그러짐|흠집|외관.{0,8}(?:안좋|안\s*좋|불량)|상태.{0,8}(?:안좋|안\s*좋|불량)/.test(text)) return "condition_contamination_signal";
  if (/타이틀|게임\s*칩|게임칩|칩포함|칩\s*포함|게임\s*다수|게임다수|일괄/.test(text)) return "game_title_or_bundle_signal";
  if (/sd\s*\d|메모리\s*\d|추가\s*조이콘|조이콘\s*추가|슈퍼\s*마리오\s*파티|마리오\s*카트|마리오카트/.test(text)) return "extra_component_or_game_bundle_signal";
  if (/조이트론|네오콘|파우치|케이스|케이스만|파우치만|도크만|독만|조이콘만|충전기만|하우징|스탠드만/.test(text)) return "accessory_or_part_only_signal";
  if (/일본판|홍콩판|해외판|북미판|중국판|스플래툰|젤다|스칼렛|바이올렛|마리오\s*에디션|포켓몬.*에디션|에디션/.test(text)) return "region_or_edition_contamination_signal";
  if (/미개봉|새상품|단순\s*개봉|신품|새거/.test(text)) return "new_or_unopened_condition_signal";
  return null;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const source = JSON.parse(await readFile(sourcePath, "utf-8")) as SourceReport;
  const sample = source.candidateRows.slice(0, MAX_DETAIL_ROWS);

  const rows = [];
  for (const row of sample) {
    const detail = await fetchDetail(String(row.pid));
    if (!detail) {
      rows.push({
        ...row,
        saleStatus: "",
        conditionLabel: null,
        descriptionPreview: "",
        detailComparableKey: null,
        detailListingType: "detail_missing",
        detailNeedsReview: true,
        detailReasons: ["detail_missing"],
        holdSignal: "detail_missing",
        decision: "detail_missing" as DetailDecision,
      });
      await sleep(DETAIL_DELAY_MS);
      continue;
    }

    const parsed = parseGameConsoleListing(row.title, detail.description, row.price);
    const inactive = !saleStatusActive(detail.saleStatus);
    const holdSignal = inactive ? `inactive_sale_status:${detail.saleStatus || "missing"}` : hasTextHoldSignal(row.title, detail.description);
    let decision: DetailDecision;
    if (holdSignal || parsed.listingType !== "normal") {
      decision = "downgraded_hold";
    } else if (!parsed.comparableKey || parsed.needsReview || parsed.comparableKey !== row.comparableKey) {
      decision = "downgraded_manual_review";
    } else {
      decision = "still_candidate";
    }
    rows.push({
      ...row,
      saleStatus: detail.saleStatus,
      conditionLabel: detail.conditionLabel,
      descriptionPreview: compact(detail.description, 180),
      detailComparableKey: parsed.comparableKey,
      detailListingType: parsed.listingType,
      detailNeedsReview: parsed.needsReview,
      detailReasons: parsed.reasons,
      holdSignal,
      decision,
    });
    await sleep(DETAIL_DELAY_MS);
  }

  const counts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.decision] = (acc[row.decision] ?? 0) + 1;
    return acc;
  }, {});
  const downgradedRows = rows.filter((row) => row.decision !== "still_candidate");

  const report = {
    generatedAt,
    reportOnly: true,
    liveDetailNoWrite: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    category: "game_console_body_narrow",
    sourceReport: "reports/game-console-live-search-scope-latest.json",
    metrics: {
      sampledCandidateRows: rows.length,
      stillCandidateRows: counts.still_candidate ?? 0,
      downgradedManualReviewRows: counts.downgraded_manual_review ?? 0,
      downgradedHoldRows: counts.downgraded_hold ?? 0,
      detailMissingRows: counts.detail_missing ?? 0,
      downgradeRate: rows.length ? Number((downgradedRows.length / rows.length).toFixed(3)) : 0,
    },
    byDecision: counts,
    rows,
    downgradedRows,
    decision: downgradedRows.length > rows.length * 0.25
      ? "game_console_title_only_candidates_need_detail_gate_before_any_acquisition"
      : "game_console_detail_sample_supports_no_write_acquisition_lane",
    nextStep: downgradedRows.length > rows.length * 0.25
      ? "Keep title-only live candidates out of DB acquisition; refine bundle/accessory/sold detail gate first."
      : "Use this lane for tiny no-write acquisition rehearsal; still no DB writes or public promotion.",
  };

  const jsonPath = path.join(reportsDir, "game-console-live-detail-sample-latest.json");
  const mdPath = path.join(reportsDir, "game-console-live-detail-sample-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Game Console Live Detail Sample",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- liveDetailNoWrite: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- sampledCandidateRows: ${report.metrics.sampledCandidateRows}`,
    `- stillCandidateRows: ${report.metrics.stillCandidateRows}`,
    `- downgradedManualReviewRows: ${report.metrics.downgradedManualReviewRows}`,
    `- downgradedHoldRows: ${report.metrics.downgradedHoldRows}`,
    `- detailMissingRows: ${report.metrics.detailMissingRows}`,
    `- downgradeRate: ${report.metrics.downgradeRate}`,
    "",
    "## Downgraded Rows",
    "",
    downgradedRows.length
      ? mdTable(
          ["pid", "title", "price", "fromKey", "toKey", "decision", "holdSignal", "reasons"],
          downgradedRows.map((row) => [
            row.pid,
            compact(row.title),
            row.price,
            row.comparableKey ?? "",
            row.detailComparableKey ?? "",
            row.decision,
            row.holdSignal ?? "",
            row.detailReasons.slice(0, 4).join(", "),
          ]),
        )
      : "- none",
    "",
    "## Still Candidate Sample",
    "",
    mdTable(
      ["pid", "title", "price", "key", "saleStatus"],
      rows.filter((row) => row.decision === "still_candidate").slice(0, 40).map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.detailComparableKey ?? "",
        row.saleStatus,
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(
    JSON.stringify(
      {
        conclusion: report.decision,
        sampledCandidateRows: rows.length,
        stillCandidateRows: report.metrics.stillCandidateRows,
        downgradedRows: downgradedRows.length,
        downgradeRate: report.metrics.downgradeRate,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
