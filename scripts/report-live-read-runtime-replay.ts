import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type LiveRow = {
  pid: string;
  title: string;
  price: number;
  saleStatus: string | null;
  description?: string;
  disposition: "fresh_live_candidate" | "manual_review" | "hold";
  reason: string;
};

type ReviewLane = {
  lane: string;
  label: string;
  freshRows: LiveRow[];
  manualRows: LiveRow[];
  holdRows: LiveRow[];
};

type OwnerPacket = {
  generatedAt: string;
  reviewCandidates: ReviewLane[];
};

type ReplayRow = {
  lane: string;
  pid: string;
  title: string;
  saleStatus: string | null;
  sourceDisposition: LiveRow["disposition"];
  sourceReason: string;
  runtimeListingType: string;
  runtimeSkuId: string | null;
  runtimeCategory: string | null;
  comparableKey: string | null;
  needsReview: boolean | null;
  runtimeReady: boolean;
  outcome: "contract_pass" | "runtime_gap" | "metadata_gate_only" | "manual_review_preserved" | "hold_preserved";
};

const ROOT = process.cwd();
const REPORTS_DIR = path.join(ROOT, "reports");
const SOURCE_FILE = path.join(REPORTS_DIR, "category-live-read-owner-review-packet-latest.json");

function runtimeReplay(row: LiveRow): Omit<ReplayRow, "lane" | "pid" | "title" | "saleStatus" | "sourceDisposition" | "sourceReason" | "outcome"> {
  const classified = classifyListing(row.title, row.description ?? "", row.price);
  const parsed = classified.sku
    ? parseListingOptions({
      category: classified.sku.category,
      skuId: classified.sku.id,
      skuName: classified.sku.modelName,
      title: row.title,
      description: row.description ?? "",
    })
    : null;

  return {
    runtimeListingType: classified.listingType,
    runtimeSkuId: classified.sku?.id ?? null,
    runtimeCategory: classified.sku?.category ?? null,
    comparableKey: parsed?.comparableKey ?? null,
    needsReview: parsed?.needsReview ?? null,
    runtimeReady: classified.listingType === "normal" && Boolean(classified.sku) && Boolean(parsed?.comparableKey) && parsed?.needsReview === false,
  };
}

function outcomeFor(row: LiveRow, replay: ReturnType<typeof runtimeReplay>): ReplayRow["outcome"] {
  if (row.disposition === "fresh_live_candidate") {
    return replay.runtimeReady ? "contract_pass" : "runtime_gap";
  }

  if (row.disposition === "manual_review") {
    return replay.runtimeReady ? "runtime_gap" : "manual_review_preserved";
  }

  if (row.saleStatus && row.saleStatus !== "SELLING") {
    return "metadata_gate_only";
  }
  return replay.runtimeReady ? "runtime_gap" : "hold_preserved";
}

function renderMarkdown(report: {
  generatedAt: string;
  sourceReport: string;
  metrics: Record<string, number>;
  rows: ReplayRow[];
  nextSteps: string[];
}) {
  const byOutcome = report.rows.reduce<Record<string, ReplayRow[]>>((acc, row) => {
    acc[row.outcome] ??= [];
    acc[row.outcome].push(row);
    return acc;
  }, {});

  const sections = Object.entries(byOutcome).map(([outcome, rows]) => [
    `## ${outcome}`,
    "| lane | pid | source | runtime | sku | key | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.lane} | ${row.pid} | ${row.sourceDisposition}/${row.sourceReason} | ${row.runtimeListingType}${row.needsReview === true ? " review" : ""} | ${row.runtimeSkuId ?? "-"} | ${row.comparableKey ?? "-"} | ${row.title.replaceAll("|", "\\|")} |`),
  ].join("\n"));

  return [
    "# Live-read Runtime Replay",
    "",
    "실매물 no-write 관측 fixture를 현재 런타임 분류기/옵션 파서에 재생한 결과입니다.",
    "DB 저장, 후보팩 공개, runtime catalog apply는 하지 않습니다.",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- sourceReport: ${report.sourceReport}`,
    `- totalRows: ${report.metrics.totalRows}`,
    `- contractPassRows: ${report.metrics.contractPassRows}`,
    `- runtimeGapRows: ${report.metrics.runtimeGapRows}`,
    `- metadataGateOnlyRows: ${report.metrics.metadataGateOnlyRows}`,
    `- manualReviewPreservedRows: ${report.metrics.manualReviewPreservedRows}`,
    `- holdPreservedRows: ${report.metrics.holdPreservedRows}`,
    "",
    "## Next Steps",
    ...report.nextSteps.map((step) => `- ${step}`),
    "",
    ...sections,
    "",
  ].join("\n");
}

function main() {
  const packet = JSON.parse(readFileSync(SOURCE_FILE, "utf8")) as OwnerPacket;
  const rows: ReplayRow[] = packet.reviewCandidates.flatMap((lane) => {
    const laneRows = [...lane.freshRows, ...lane.manualRows, ...lane.holdRows];
    return laneRows.map((row) => {
      const replay = runtimeReplay(row);
      return {
        lane: lane.lane,
        pid: row.pid,
        title: row.title,
        saleStatus: row.saleStatus,
        sourceDisposition: row.disposition,
        sourceReason: row.reason,
        ...replay,
        outcome: outcomeFor(row, replay),
      };
    });
  });

  const metrics = {
    totalRows: rows.length,
    freshRows: rows.filter((row) => row.sourceDisposition === "fresh_live_candidate").length,
    manualRows: rows.filter((row) => row.sourceDisposition === "manual_review").length,
    holdRows: rows.filter((row) => row.sourceDisposition === "hold").length,
    contractPassRows: rows.filter((row) => row.outcome === "contract_pass").length,
    runtimeGapRows: rows.filter((row) => row.outcome === "runtime_gap").length,
    metadataGateOnlyRows: rows.filter((row) => row.outcome === "metadata_gate_only").length,
    manualReviewPreservedRows: rows.filter((row) => row.outcome === "manual_review_preserved").length,
    holdPreservedRows: rows.filter((row) => row.outcome === "hold_preserved").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    runtimeApplyRows: 0,
    dbMutationRows: 0,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    sourceReport: "reports/category-live-read-owner-review-packet-latest.json",
    conclusion: metrics.runtimeGapRows > 0
      ? "live_read_fixture_runtime_replay_found_catalog_or_parser_gaps"
      : "live_read_fixture_runtime_replay_ready_for_regression_test_conversion",
    metrics,
    rows,
    nextSteps: metrics.runtimeGapRows > 0
      ? [
        "Do not convert all fixtures into passing regression tests yet; several rows need narrow catalog/parser owner review first.",
        "Split runtime gaps by lane and patch only category-local catalog/parser behavior after owner approval.",
        "Keep public promotion and candidate-pool wiring blocked.",
      ]
      : [
        "Convert the replay rows into runtime regression tests.",
        "Keep public promotion and candidate-pool wiring blocked.",
      ],
  };

  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(path.join(REPORTS_DIR, "live-read-runtime-replay-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(path.join(REPORTS_DIR, "live-read-runtime-replay-latest.md"), renderMarkdown(report));
  console.log(`live-read runtime replay: rows=${metrics.totalRows}, pass=${metrics.contractPassRows}, gaps=${metrics.runtimeGapRows}`);
}

main();
