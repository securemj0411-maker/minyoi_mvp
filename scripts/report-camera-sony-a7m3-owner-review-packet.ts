import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type StrictContract = {
  category: string;
  firstLaneModelCode: string;
  requiredGateBeforeAnyFutureWrite: string[];
  metrics: {
    strictAllowedRows: number;
    excludedRows: number;
    maxFutureWriteCap: number;
  };
  allowedRows: Array<{
    pid: string;
    title: string;
    price: number;
    url?: string;
    saleStatus: string;
    description?: string;
    reason?: string;
    model: string;
  }>;
  excludedRows: Array<{
    pid: string;
    title: string;
    model: string;
    disposition: string;
    reason: string;
  }>;
};

type SourceBackfillReport = {
  rows: Array<{
    modelCode: string;
    brandModel: string;
    sourceTier: string;
    sourceConfidence: string;
    sourceUrl: string;
    verifiedSpec: Record<string, string>;
  }>;
};

type RankingReport = {
  entries: Array<{
    category: string;
    firstTarget: string;
    score: number;
    rankGroup: string;
    reason: string;
    requiredBeforeExecution: string[];
  }>;
};

type SecondWaveReport = {
  metrics: {
    freshLiveCandidates: number;
    manualReviewRows: number;
    holdRows: number;
  };
  freshRows: Array<{
    pid: string;
    title: string;
    price: number;
    saleStatus: string;
    reason: string;
    model: string | null;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
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
  const strict = await readJson<StrictContract>("camera-body-only-strict-contract-latest.json");
  const sourceBackfill = await readJson<SourceBackfillReport>("camera-sony-a7m3-source-backfill-latest.json");
  const ranking = await readJson<RankingReport>("next-acquisition-readiness-ranking-latest.json");
  const secondWave = await readJson<SecondWaveReport>("camera-a7m3-second-live-read-wave-latest.json");
  const rankingEntry = ranking.entries.find(
    (entry) => entry.category === strict.category && entry.firstTarget === strict.firstLaneModelCode,
  );
  const directSourceRows = sourceBackfill.rows.filter(
    (row) => row.modelCode === strict.firstLaneModelCode && row.sourceConfidence === "high" && row.sourceTier.startsWith("official"),
  );
  const packageBoundaryEvidenceRows = strict.excludedRows.filter(
    (row) => row.reason.includes("not_selling") || row.reason.includes("buying_text") || row.reason.includes("accessory"),
  );
  const uniqueCleanPids = new Set([
    ...strict.allowedRows.map((row) => row.pid),
    ...secondWave.freshRows.map((row) => row.pid),
  ]);
  const secondWaveRequired = uniqueCleanPids.size < 4;

  const packet = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "camera_sony_a7m3_owner_review_packet",
    category: strict.category,
    target: strict.firstLaneModelCode,
    sourceReports: [
      "camera-body-only-strict-contract-latest.json",
      "camera-sony-a7m3-source-backfill-latest.json",
      "camera-body-lens-package-fixture-packet-latest.json",
      "camera-package-title-token-boundary-evidence-latest.json",
      "camera-a7m3-second-live-read-wave-latest.json",
      "next-acquisition-readiness-ranking-latest.json",
    ],
    metrics: {
      rankScore: rankingEntry?.score ?? null,
      rankGroup: rankingEntry?.rankGroup ?? null,
      strictAllowedRows: strict.metrics.strictAllowedRows,
      maxFutureWriteCap: strict.metrics.maxFutureWriteCap,
      excludedRows: strict.metrics.excludedRows,
      directSourceRows: directSourceRows.length,
      packageBoundaryEvidenceRows: packageBoundaryEvidenceRows.length,
      secondWaveFreshRows: secondWave.metrics.freshLiveCandidates,
      secondWaveManualReviewRows: secondWave.metrics.manualReviewRows,
      secondWaveHoldRows: secondWave.metrics.holdRows,
      uniqueCleanBodyRowsAfterSecondWave: uniqueCleanPids.size,
      secondWaveRequired,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      dbMutationRows: 0,
    },
    ownerDecision: {
      recommendedDecision: secondWaveRequired
        ? "hold_execution_second_wave_still_thin"
        : "approve_no_write_or_internal_only_review_after_p0_stability",
      notApprovedHere: [
        "public candidate pack promotion",
        "candidate pool wiring",
        "runtime catalog apply",
        "DB acquisition executor",
        "schema or migration changes",
      ],
      reviewPrerequisites: [
        ...strict.requiredGateBeforeAnyFutureWrite,
        "second_live_read_wave_required_before_execution",
        "body_only_no_lens_context_must_survive_fresh_detail_refetch",
      ],
    },
    sourceEvidenceStatus: {
      directSourceRows: directSourceRows.map((row) => ({
        brandModel: row.brandModel,
        sourceTier: row.sourceTier,
        sourceConfidence: row.sourceConfidence,
        sourceUrl: row.sourceUrl,
        verifiedSpec: row.verifiedSpec,
      })),
    },
    riskNotes: [
      `A7M3 has only ${uniqueCleanPids.size} unique clean body-only rows after the second no-write live-read wave.`,
      "Camera rows have package ambiguity: full-box is packaging state, not proof of lens-kit or no-lens.",
      "Body-only must stay separate from lens kit, full-box unknown package, and accessory-only rows.",
      "Higher ticket price makes false-positive trust damage larger than for low-priced accessories.",
    ],
    allowedRows: strict.allowedRows,
    excludedRows: strict.excludedRows,
    conclusion: secondWaveRequired
      ? "camera_sony_a7m3_owner_review_packet_blocked_second_wave_still_thin"
      : "camera_sony_a7m3_owner_review_packet_ready_report_only_no_execution",
    nextStep: secondWaveRequired
      ? "Keep blocked; second no-write wave still did not reach 4 unique clean body-only rows."
      : "Wait for P0 stabilization, then owner can decide whether to create a tiny internal-only no-public executor.",
  };

  const jsonPath = path.join(reportsDir, "camera-sony-a7m3-owner-review-packet-latest.json");
  const mdPath = path.join(reportsDir, "camera-sony-a7m3-owner-review-packet-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

  const md = [
    "# Camera Sony A7M3 Owner Review Packet",
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
    `- rankGroup: ${packet.metrics.rankGroup ?? "-"}`,
    `- strictAllowedRows: ${packet.metrics.strictAllowedRows}`,
    `- maxFutureWriteCap: ${packet.metrics.maxFutureWriteCap}`,
    `- excludedRows: ${packet.metrics.excludedRows}`,
    `- directSourceRows: ${packet.metrics.directSourceRows}`,
    `- packageBoundaryEvidenceRows: ${packet.metrics.packageBoundaryEvidenceRows}`,
    `- secondWaveFreshRows: ${packet.metrics.secondWaveFreshRows}`,
    `- secondWaveManualReviewRows: ${packet.metrics.secondWaveManualReviewRows}`,
    `- secondWaveHoldRows: ${packet.metrics.secondWaveHoldRows}`,
    `- uniqueCleanBodyRowsAfterSecondWave: ${packet.metrics.uniqueCleanBodyRowsAfterSecondWave}`,
    `- secondWaveRequired: ${packet.metrics.secondWaveRequired}`,
    "",
    "## Not Approved Here",
    "",
    ...packet.ownerDecision.notApprovedHere.map((item) => `- ${item}`),
    "",
    "## Review Prerequisites",
    "",
    ...packet.ownerDecision.reviewPrerequisites.map((item) => `- ${item}`),
    "",
    "## Source Evidence",
    "",
    mdTable(
      ["brandModel", "tier", "confidence", "verifiedSpec", "source"],
      packet.sourceEvidenceStatus.directSourceRows.map((row) => [
        row.brandModel,
        row.sourceTier,
        row.sourceConfidence,
        Object.entries(row.verifiedSpec).map(([key, value]) => `${key}:${value}`).join(", "),
        row.sourceUrl,
      ]),
    ),
    "",
    "## Risk Notes",
    "",
    ...packet.riskNotes.map((item) => `- ${item}`),
    "",
    "## Allowed Rows",
    "",
    mdTable(
      ["pid", "title", "price", "model", "saleStatus", "reason"],
      packet.allowedRows.map((row) => [row.pid, compact(row.title), row.price, row.model, row.saleStatus, compact(row.reason)]),
    ),
    "",
    "## Excluded Rows",
    "",
    mdTable(
      ["pid", "title", "model", "disposition", "reason"],
      packet.excludedRows.map((row) => [row.pid, compact(row.title), row.model, row.disposition, row.reason]),
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
    strictAllowedRows: packet.metrics.strictAllowedRows,
    secondWaveRequired,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
