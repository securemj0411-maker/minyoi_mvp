import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type StrictContract = {
  conclusion: string;
  category: string;
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
    url?: string;
    query?: string;
    saleStatus: string;
    description?: string;
    reason?: string;
    matchedSignals?: string[];
    holdSignals?: string[];
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

type ExactModelContract = {
  allowedModels: string[];
  rows: Array<{
    caseId: string;
    title: string;
    expectedDecision: string;
    expectedModel: string | null;
    reason: string;
  }>;
};

type RankingReport = {
  entries: Array<{
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

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf-8")) as T;
}

async function readOptionalJson<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
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
  const strict = await readJson<StrictContract>("speaker-selected-subset-strict-contract-latest.json");
  const exact = await readJson<ExactModelContract>("speaker-portable-exact-model-contract-latest.json");
  const ranking = await readJson<RankingReport>("next-acquisition-readiness-ranking-latest.json");
  const sourceBackfill = await readOptionalJson<SourceBackfillReport>("speaker-jbl-flip6-source-backfill-latest.json");

  const rankingEntry = ranking.entries.find(
    (entry) => entry.category === strict.category && entry.firstTarget === strict.firstLaneModelCode,
  );
  const directFixtureRows = exact.rows.filter((row) => row.expectedModel === strict.firstLaneModelCode);
  const directPositiveFixtureRows = directFixtureRows.filter((row) => row.expectedDecision === "candidate_positive_contract");
  const directSourceRows = sourceBackfill?.rows.filter(
    (row) => row.modelCode === strict.firstLaneModelCode && row.sourceConfidence === "high" && row.sourceTier.startsWith("official"),
  ) ?? [];
  const negativeFixtureRows = exact.rows.filter(
    (row) => row.expectedModel === null && /flip\s*6|flip6|플립6/i.test(row.title),
  );
  const exactContractAlreadyAllowsTarget = exact.allowedModels.includes(strict.firstLaneModelCode);
  const exactContractBackfillStillNeeded = !exactContractAlreadyAllowsTarget;
  const sourceBackfillRequired = directPositiveFixtureRows.length === 0 && directSourceRows.length === 0;
  const reviewPrerequisites = [
    ...strict.requiredGateBeforeAnyFutureWrite,
    "direct_source_or_positive_fixture_backfill_for_jbl_flip_6_before_execution",
    "second_live_read_wave_preferred_because_allowed_rows_are_thin",
  ];

  const packet = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "speaker_jbl_flip6_owner_review_packet",
    category: strict.category,
    target: strict.firstLaneModelCode,
    sourceReports: [
      "speaker-selected-subset-strict-contract-latest.json",
      "category-no-write-live-read-observation-latest.json",
      "speaker-portable-exact-model-contract-latest.json",
      "speaker-device-class-boundary-evidence-latest.json",
      "speaker-portable-evidence-latest.json",
      "next-acquisition-readiness-ranking-latest.json",
      "speaker-jbl-flip6-source-backfill-latest.json",
    ],
    metrics: {
      rankScore: rankingEntry?.score ?? null,
      strictAllowedRows: strict.metrics.strictAllowedRows,
      maxFutureWriteCap: strict.metrics.maxFutureWriteCap,
      excludedRows: strict.metrics.excludedRows,
      directPositiveFixtureRows: directPositiveFixtureRows.length,
      directSourceRows: directSourceRows.length,
      negativeFixtureRows: negativeFixtureRows.length,
      exactContractAlreadyAllowsTarget,
      exactContractBackfillStillNeeded,
      sourceBackfillRequired,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      dbMutationRows: 0,
    },
    ownerDecision: {
      recommendedDecision: sourceBackfillRequired
        ? "hold_execution_and_backfill_source_evidence"
        : "approve_no_write_or_internal_only_review_after_p0_stability",
      notApprovedHere: [
        "public candidate pack promotion",
        "candidate pool wiring",
        "runtime catalog apply",
        "DB acquisition executor",
        "schema or migration changes",
      ],
      reviewPrerequisites,
    },
    sourceEvidenceStatus: {
      exactContractAlreadyAllowsTarget,
      exactContractBackfillStillNeeded,
      directPositiveFixtureRows: directPositiveFixtureRows.map((row) => ({
        caseId: row.caseId,
        title: row.title,
        reason: row.reason,
      })),
      directSourceRows: directSourceRows.map((row) => ({
        brandModel: row.brandModel,
        sourceTier: row.sourceTier,
        sourceConfidence: row.sourceConfidence,
        sourceUrl: row.sourceUrl,
        verifiedSpec: row.verifiedSpec,
      })),
      negativeFixtureRows: negativeFixtureRows.map((row) => ({
        caseId: row.caseId,
        title: row.title,
        reason: row.reason,
      })),
      sourceBackfillRequired,
    },
    riskNotes: [
      "JBL Flip 6 has 3 fresh live candidate rows, so it is commercially interesting but thin.",
      "Existing portable exact-model contract does not yet list jbl-flip-6 as a positive allowed model; keep this as a follow-up warning even if official source backfill exists.",
      "Accessory-only hard-shell case, rental, and mixed/damaged bundle examples are already visible in the live read and must remain hard holds.",
      "Model-only titles without speaker context should remain manual review.",
    ],
    allowedRows: strict.allowedRows,
    excludedRows: strict.excludedRows,
    conclusion: sourceBackfillRequired
      ? "speaker_jbl_flip6_owner_review_packet_ready_source_backfill_required"
      : "speaker_jbl_flip6_owner_review_packet_ready_report_only_no_execution",
    nextStep: sourceBackfillRequired
      ? "Backfill direct JBL Flip 6 source/positive fixture evidence or run a second no-write live wave before any executor."
      : "Wait for P0 stabilization, then owner can decide whether to create a tiny internal-only no-public executor.",
  };

  const jsonPath = path.join(reportsDir, "speaker-jbl-flip6-owner-review-packet-latest.json");
  const mdPath = path.join(reportsDir, "speaker-jbl-flip6-owner-review-packet-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(packet, null, 2)}\n`);

  const md = [
    "# Speaker JBL Flip 6 Owner Review Packet",
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
    `- excludedRows: ${packet.metrics.excludedRows}`,
    `- directPositiveFixtureRows: ${packet.metrics.directPositiveFixtureRows}`,
    `- directSourceRows: ${packet.metrics.directSourceRows}`,
    `- negativeFixtureRows: ${packet.metrics.negativeFixtureRows}`,
    `- exactContractAlreadyAllowsTarget: ${packet.metrics.exactContractAlreadyAllowsTarget}`,
    `- exactContractBackfillStillNeeded: ${packet.metrics.exactContractBackfillStillNeeded}`,
    `- sourceBackfillRequired: ${packet.metrics.sourceBackfillRequired}`,
    "",
    "## Not Approved Here",
    "",
    ...packet.ownerDecision.notApprovedHere.map((item) => `- ${item}`),
    "",
    "## Review Prerequisites",
    "",
    ...packet.ownerDecision.reviewPrerequisites.map((item) => `- ${item}`),
    "",
    "## Source Evidence Status",
    "",
    `- exactContractAlreadyAllowsTarget: ${packet.sourceEvidenceStatus.exactContractAlreadyAllowsTarget}`,
    `- exactContractBackfillStillNeeded: ${packet.sourceEvidenceStatus.exactContractBackfillStillNeeded}`,
    `- directPositiveFixtureRows: ${packet.sourceEvidenceStatus.directPositiveFixtureRows.length}`,
    `- directSourceRows: ${packet.sourceEvidenceStatus.directSourceRows.length}`,
    `- negativeFixtureRows: ${packet.sourceEvidenceStatus.negativeFixtureRows.length}`,
    `- sourceBackfillRequired: ${packet.sourceEvidenceStatus.sourceBackfillRequired}`,
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
    sourceBackfillRequired,
    jsonPath,
    mdPath,
  }, null, 2));
}

void main();
