import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type Contract = {
  category: string;
  lane: string;
  conclusion: string;
  metrics: {
    strictAllowedRows?: number;
    allowedRows?: number;
    maxFutureWriteCap?: number;
  };
  firstLaneModelCode?: string;
  allowedSkus?: string[];
  requiredGateBeforeAnyFutureWrite?: string[];
};

type Ps5Assessment = {
  category: string;
  metrics: {
    ownerReadyKeys: number;
  };
  ownerReadyKeys: Array<{
    modelCode: string;
    rows: number;
  }>;
};

type TabletAssessment = {
  category: string;
  target: string;
  metrics: {
    freshLiveCandidates: number;
    ownerReadyKeys: number;
    promisingKeys: number;
  };
  ownerReadyKeys: Array<{
    comparableKey: string;
    rows: number;
    model: string;
    storageGb: number;
    connectivity: string;
  }>;
  promisingKeys: Array<{
    comparableKey: string;
    rows: number;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function score(rowCount: number, categoryWeight: number, riskPenalty: number) {
  return rowCount * 10 + categoryWeight - riskPenalty;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const headphone = await readJson<Contract>("headphone-first-wave-strict-write-cap-contract-latest.json");
  const monitor = await readJson<Contract>("monitor-selected-exact-model-strict-contract-latest.json");
  const speaker = await readJson<Contract>("speaker-selected-subset-strict-contract-latest.json");
  const camera = await readJson<Contract>("camera-body-only-strict-contract-latest.json");
  const ps5 = await readJson<Ps5Assessment>("game-console-ps5-owner-assessment-latest.json");
  const tablet = await readJson<TabletAssessment>("tablet-ipad-pro-m4-owner-assessment-latest.json");
  const ps5Rows = ps5.ownerReadyKeys.reduce((sum, row) => sum + row.rows, 0);
  const tabletRows = tablet.ownerReadyKeys.reduce((sum, row) => sum + row.rows, 0);

  const entries = [
    {
      rankGroup: "ready_for_owner_review_after_p0",
      category: monitor.category,
      lane: monitor.lane,
      firstTarget: monitor.firstLaneModelCode ?? "benq-zowie-xl2540k",
      rowCount: monitor.metrics.strictAllowedRows ?? 0,
      maxFutureWriteCap: monitor.metrics.maxFutureWriteCap ?? 0,
      score: score(monitor.metrics.strictAllowedRows ?? 0, 12, 0),
      reason: "Thickest fresh live exact-model lane; subagent review found one false hold recovered as bundled-extra context.",
      requiredBeforeExecution: ["other_main_agent_p0_done", "fresh_detail_refetch", "no_public_promotion"],
    },
    {
      rankGroup: "ready_for_owner_review_after_p0",
      category: headphone.category,
      lane: headphone.lane,
      firstTarget: (headphone.allowedSkus ?? []).join(", "),
      rowCount: headphone.metrics.allowedRows ?? 0,
      maxFutureWriteCap: headphone.metrics.maxFutureWriteCap ?? 0,
      score: score(headphone.metrics.allowedRows ?? 0, 8, 8),
      reason: "Good row count but fresh detail rejected 5/12; keep to Sony XM4/CH520 only and defer QC45 key normalization.",
      requiredBeforeExecution: ["other_main_agent_p0_done", "fresh_detail_refetch", "no_public_promotion", "same_sku_and_key"],
    },
    {
      rankGroup: "ready_for_owner_review_after_p0",
      category: speaker.category,
      lane: speaker.lane,
      firstTarget: speaker.firstLaneModelCode ?? "jbl-flip-6",
      rowCount: speaker.metrics.strictAllowedRows ?? 0,
      maxFutureWriteCap: speaker.metrics.maxFutureWriteCap ?? 0,
      score: score(speaker.metrics.strictAllowedRows ?? 0, 6, 4),
      reason: "Thin but checklist-ready after Flip 6 exact-contract backfill; rental/bundle/accessory rows stay hard-held.",
      requiredBeforeExecution: ["other_main_agent_p0_done", "fresh_detail_refetch", "no_public_promotion", "max_write_cap_3"],
    },
    {
      rankGroup: "ready_for_owner_review_after_p0",
      category: ps5.category,
      lane: "playstation_5_disc_digital_body_assessment",
      firstTarget: ps5.ownerReadyKeys.map((row) => row.modelCode).join(", "),
      rowCount: ps5Rows,
      maxFutureWriteCap: Math.min(ps5Rows, 8),
      score: score(ps5Rows, 10, 12),
      reason: "Disc/Digital exact body lanes have enough rows; Slim remains promising but not owner-ready.",
      requiredBeforeExecution: [
        "other_main_agent_p0_done",
        "fresh_detail_refetch",
        "no_public_promotion",
        "disc_digital_only",
        "exclude_slim_and_accessory_drive",
      ],
    },
    {
      rankGroup: "needs_more_rows",
      category: camera.category,
      lane: camera.lane,
      firstTarget: camera.firstLaneModelCode ?? "sony-a7m3",
      rowCount: camera.metrics.strictAllowedRows ?? 0,
      maxFutureWriteCap: camera.metrics.maxFutureWriteCap ?? 0,
      score: score(camera.metrics.strictAllowedRows ?? 0, 5, 8),
      reason: "Clean body-only examples exist, but second no-write live-read wave still found only 2 unique clean rows.",
      requiredBeforeExecution: ["third_or_broader_no_write_live_read_required", "fresh_detail_refetch", "no_public_promotion"],
    },
    {
      rankGroup: tablet.metrics.ownerReadyKeys > 0 ? "ready_for_owner_review_after_p0" : "needs_more_rows",
      category: tablet.category,
      lane: "apple_ipad_pro_11_m4_live_read",
      firstTarget: tablet.ownerReadyKeys.length > 0
        ? tablet.ownerReadyKeys.map((row) => `${row.model}-${row.storageGb}-${row.connectivity}`).join(", ")
        : tablet.target,
      rowCount: tablet.metrics.freshLiveCandidates,
      maxFutureWriteCap: Math.min(tabletRows, 4),
      score: score(tabletRows, 9, 12),
      reason: tablet.metrics.ownerReadyKeys > 0
        ? "iPad Pro 11 M4 has one source-backed storage/connectivity key after targeted wave; keep to that single key only."
        : "iPad Pro 11 M4 has fresh rows but strongest comparable key is still thin; storage/connectivity lanes need thickening.",
      requiredBeforeExecution: ["other_main_agent_p0_done", "fresh_detail_refetch", "single_storage_connectivity_key_only", "no_public_promotion"],
    },
  ].sort((a, b) => b.score - a.score);

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    sourceReports: [
      "headphone-first-wave-strict-write-cap-contract-latest.json",
      "monitor-selected-exact-model-strict-contract-latest.json",
      "speaker-selected-subset-strict-contract-latest.json",
      "camera-body-only-strict-contract-latest.json",
      "camera-a7m3-second-live-read-wave-latest.json",
      "game-console-ps5-owner-assessment-latest.json",
      "tablet-ipad-pro-m4-owner-assessment-latest.json",
    ],
    entries,
    recommendation:
      "After P0 Supabase/runtime stabilization, PS5 Disc/Digital has the strongest row count, while monitor XL2540K remains the safest first execution candidate. Keep all contracts no-public and fresh-detail gated.",
    conclusion: "next_acquisition_readiness_ranking_prepared_report_only",
  };

  const jsonPath = path.join(reportsDir, "next-acquisition-readiness-ranking-latest.json");
  const mdPath = path.join(reportsDir, "next-acquisition-readiness-ranking-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Next Acquisition Readiness Ranking",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Ranking",
    "",
    mdTable(
      ["rank", "group", "category", "lane", "target", "rows", "cap", "score", "reason"],
      entries.map((entry, index) => [
        index + 1,
        entry.rankGroup,
        entry.category,
        entry.lane,
        entry.firstTarget,
        entry.rowCount,
        entry.maxFutureWriteCap,
        entry.score,
        entry.reason,
      ]),
    ),
    "",
    "## Required Before Execution",
    "",
    ...entries.map((entry, index) => `${index + 1}. ${entry.firstTarget}: ${entry.requiredBeforeExecution.join(", ")}`),
    "",
    "## Recommendation",
    "",
    `- ${report.recommendation}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: report.conclusion,
    entries: report.entries.length,
    topTarget: report.entries[0]?.firstTarget,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
