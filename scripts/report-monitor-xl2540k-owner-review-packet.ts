import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type RankingReport = {
  entries: Array<{
    rankGroup: string;
    category: string;
    lane: string;
    firstTarget: string;
    rowCount: number;
    maxFutureWriteCap: number;
    score: number;
    reason: string;
    requiredBeforeExecution: string[];
  }>;
};

type ContractReport = {
  conclusion: string;
  metrics: {
    sourceRows: number;
    strictAllowedRows: number;
    optionalRows: number;
    excludedRows: number;
    maxFutureWriteCap: number;
  };
  firstLaneModelCode: string;
  optionalLaterModelCodes: string[];
  requiredGateBeforeAnyFutureWrite: string[];
  allowedRows: Array<{
    pid: string;
    title: string;
    price: number;
    modelCode: string;
    saleStatus: string;
    accessoryFalseHoldRecovery?: boolean;
  }>;
  optionalRows: Array<{
    pid: string;
    title: string;
    price: number;
    modelCode: string;
    saleStatus: string;
  }>;
  excludedRows: Array<{
    pid: string;
    title: string;
    modelCode: string;
    disposition: string;
    reason: string;
  }>;
};

type SourceConfidenceReport = {
  rows: Array<{
    modelCode: string;
    brandModel: string;
    sourceTier: string;
    sourceUrl: string | null;
    sourceConfidence: string;
    sourceVerifiedSpec: Record<string, string>;
    observationReadiness: string;
  }>;
};

async function readReport<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

function compact(text: unknown, limit = 92) {
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

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const ranking = await readReport<RankingReport>("next-acquisition-readiness-ranking-latest.json");
  const contract = await readReport<ContractReport>("monitor-selected-exact-model-strict-contract-latest.json");
  const sourceConfidence = await readReport<SourceConfidenceReport>("monitor-selected-exact-model-source-confidence-latest.json");
  const rankingEntry = ranking.entries.find((entry) => entry.firstTarget === contract.firstLaneModelCode);
  const falseHoldRecoveredRows = contract.allowedRows.filter((row) => row.accessoryFalseHoldRecovery);
  const sourceEvidence = sourceConfidence.rows.find((row) => row.modelCode === "xl2540k") ?? null;
  const trueExcludedRows = contract.excludedRows.filter((row) => row.reason !== "optional_second_monitor_lane_singleton");
  const executionPrerequisites = [
    "other_main_agent_p0_done",
    ...contract.requiredGateBeforeAnyFutureWrite,
    "max_write_cap_5_rows_if_owner_later_approves_internal_acquisition",
  ];

  const packet = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "monitor_xl2540k_owner_review_packet",
    sourceReports: [
      "next-acquisition-readiness-ranking-latest.json",
      "monitor-selected-exact-model-strict-contract-latest.json",
      "category-no-write-live-read-observation-latest.json",
      "monitor-model-code-spec-evidence-packet-latest.json",
      "monitor-selected-exact-model-source-confidence-latest.json",
    ],
    category: "monitor_discovered",
    target: contract.firstLaneModelCode,
    metrics: {
      rankScore: rankingEntry?.score ?? null,
      strictAllowedRows: contract.metrics.strictAllowedRows,
      maxFutureWriteCap: contract.metrics.maxFutureWriteCap,
      optionalRows: contract.metrics.optionalRows,
      excludedRows: trueExcludedRows.length,
      falseHoldRecoveredRows: falseHoldRecoveredRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      dbMutationRows: 0,
    },
    ownerDecision: {
      recommendedDecision: "approve_no_write_or_internal_only_review_after_p0_stability",
      notApprovedHere: [
        "public candidate pack promotion",
        "candidate pool wiring",
        "runtime catalog apply",
        "DB acquisition executor",
        "schema or migration changes",
      ],
      executionPrerequisites,
    },
    sourceEvidence: sourceEvidence
      ? {
          modelCode: sourceEvidence.modelCode,
          brandModel: sourceEvidence.brandModel,
          sourceTier: sourceEvidence.sourceTier,
          sourceConfidence: sourceEvidence.sourceConfidence,
          sourceVerifiedSpec: sourceEvidence.sourceVerifiedSpec,
          observationReadiness: sourceEvidence.observationReadiness,
          sourceUrl: sourceEvidence.sourceUrl,
        }
      : null,
    riskNotes: [
      "AW2525HM has only one active row in this run and remains optional later.",
      "One XL2540K row was recovered from a false hold because '모니터 암까지 드립니다' is bundled-extra context, not accessory-only.",
      "Accessory/part gate must distinguish accessory-only title from included extras.",
    ],
    allowedRows: contract.allowedRows,
    optionalRows: contract.optionalRows,
    excludedRows: trueExcludedRows,
    conclusion: "monitor_xl2540k_owner_review_packet_ready_report_only_no_execution",
    nextStep:
      "Wait for P0 Supabase/runtime stabilization completion, then owner can decide whether to create a tiny internal-only no-public acquisition executor for XL2540K.",
  };

  const jsonPath = path.join(reportsDir, "monitor-xl2540k-owner-review-packet-latest.json");
  const mdPath = path.join(reportsDir, "monitor-xl2540k-owner-review-packet-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

  const md = [
    "# Monitor XL2540K Owner Review Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- conclusion: ${packet.conclusion}`,
    "",
    "## Target",
    "",
    `- category: ${packet.category}`,
    `- target: ${packet.target}`,
    `- recommendedDecision: ${packet.ownerDecision.recommendedDecision}`,
    "",
    "## Metrics",
    "",
    `- rankScore: ${packet.metrics.rankScore ?? "-"}`,
    `- strictAllowedRows: ${packet.metrics.strictAllowedRows}`,
    `- maxFutureWriteCap: ${packet.metrics.maxFutureWriteCap}`,
    `- optionalRows: ${packet.metrics.optionalRows}`,
    `- excludedRows: ${packet.metrics.excludedRows}`,
    `- falseHoldRecoveredRows: ${packet.metrics.falseHoldRecoveredRows}`,
    "",
    "## Source Evidence",
    "",
    packet.sourceEvidence
      ? mdTable(
          ["modelCode", "brandModel", "tier", "confidence", "spec", "source"],
          [[
            packet.sourceEvidence.modelCode,
            packet.sourceEvidence.brandModel,
            packet.sourceEvidence.sourceTier,
            packet.sourceEvidence.sourceConfidence,
            Object.entries(packet.sourceEvidence.sourceVerifiedSpec).map(([key, value]) => `${key}:${value}`).join(", "),
            packet.sourceEvidence.sourceUrl ?? "",
          ]],
        )
      : "- missing",
    "",
    "## Not Approved Here",
    "",
    ...packet.ownerDecision.notApprovedHere.map((item) => `- ${item}`),
    "",
    "## Execution Prerequisites",
    "",
    ...packet.ownerDecision.executionPrerequisites.map((item) => `- ${item}`),
    "",
    "## Risk Notes",
    "",
    ...packet.riskNotes.map((item) => `- ${item}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "modelCode", "saleStatus", "recoveredFalseHold"],
      packet.allowedRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.modelCode,
        row.saleStatus,
        row.accessoryFalseHoldRecovery ? "yes" : "",
      ]),
    ),
    "",
    "## Optional Later Rows",
    "",
    mdTable(
      ["pid", "title", "price", "modelCode", "saleStatus"],
      packet.optionalRows.map((row) => [row.pid, compact(row.title), row.price, row.modelCode, row.saleStatus]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "modelCode", "disposition", "reason"],
      packet.excludedRows.map((row) => [row.pid, compact(row.title), row.modelCode, row.disposition, row.reason]),
    ),
    "",
    "## Next Step",
    "",
    `- ${packet.nextStep}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    conclusion: packet.conclusion,
    target: packet.target,
    strictAllowedRows: packet.metrics.strictAllowedRows,
    maxFutureWriteCap: packet.metrics.maxFutureWriteCap,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
