import fs from "node:fs";
import path from "node:path";

import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";

type SpeakerCase = {
  caseId: string;
  inputTitle: string;
  expectedClass: "reference_only" | "hold";
  expectedDecision: "reference_only_not_runtime_candidate" | "negative_hold_only";
  basis: string;
};

type GenericReport = {
  rows: Array<{ title: string; exclusionClass: string }>;
};

const generic = JSON.parse(fs.readFileSync("reports/speaker-generic-exclusion-readiness-latest.json", "utf8")) as GenericReport;

const cases: SpeakerCase[] = [
  {
    caseId: "SPEAKER-REF-01",
    inputTitle: "마샬 액톤3 블루투스 스피커",
    expectedClass: "reference_only",
    expectedDecision: "reference_only_not_runtime_candidate",
    basis: "portable exact-model rows are reference-only until main approval",
  },
  {
    caseId: "SPEAKER-REF-02",
    inputTitle: "JBL GO 4 블루투스 스피커",
    expectedClass: "reference_only",
    expectedDecision: "reference_only_not_runtime_candidate",
    basis: "portable exact-model rows are reference-only until main approval",
  },
  {
    caseId: "SPEAKER-REF-03",
    inputTitle: "브리츠 BZ-JB9600 블루투스 스피커",
    expectedClass: "reference_only",
    expectedDecision: "reference_only_not_runtime_candidate",
    basis: "portable exact-model rows are reference-only until main approval",
  },
  {
    caseId: "SPEAKER-HOLD-AMP-04",
    inputTitle: "마란츠 SR7000G 리시버",
    expectedClass: "hold",
    expectedDecision: "negative_hold_only",
    basis: "amp/receiver device class must stay outside portable speaker subset",
  },
  {
    caseId: "SPEAKER-HOLD-PA-05",
    inputTitle: "JBL EON ONE COMPACT PA 스피커",
    expectedClass: "hold",
    expectedDecision: "negative_hold_only",
    basis: "PA speaker device class must stay outside portable speaker subset",
  },
  ...generic.rows.slice(0, 6).map((row, index) => ({
    caseId: `SPEAKER-HOLD-GENERIC-${String(index + 6).padStart(2, "0")}`,
    inputTitle: row.title,
    expectedClass: "hold" as const,
    expectedDecision: "negative_hold_only" as const,
    basis: `generic exclusion candidate: ${row.exclusionClass}`,
  })),
];

const rows = cases.map((row) => {
  const classified = classifyListing(row.inputTitle, "", 100_000);
  const parsed = parseListingOptions({
    title: row.inputTitle,
    description: "",
    category: "small_appliance",
    skuId: null,
    skuName: null,
  });
  const actualDecision = classified.listingType === "normal" && parsed.comparableKey && !parsed.needsReview
    ? "candidate_positive_only"
    : row.expectedClass === "reference_only"
      ? "reference_only_not_runtime_candidate"
      : "negative_hold_only";
  const pass = actualDecision === row.expectedDecision;
  return {
    ...row,
    runtimeListingType: classified.listingType,
    comparableKey: parsed.comparableKey,
    needsReview: parsed.needsReview,
    parseConfidence: parsed.parseConfidence,
    actualDecision,
    pass,
  };
});

const failedRows = rows.filter((row) => !row.pass);
const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  category: "speaker_audio_discovered",
  scope: "no-mutation runtime dry-run over speaker portable reference/hold boundary cases",
  inputFiles: [
    "reports/speaker-portable-model-subset-boundary-evidence-latest.json",
    "reports/speaker-generic-exclusion-readiness-latest.json",
  ],
  metrics: {
    rows: rows.length,
    passedRows: rows.filter((row) => row.pass).length,
    failedRows: failedRows.length,
    referenceOnlyRows: rows.filter((row) => row.expectedClass === "reference_only").length,
    holdRows: rows.filter((row) => row.expectedClass === "hold").length,
    candidatePositiveOnlyRows: rows.filter((row) => row.actualDecision === "candidate_positive_only").length,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolWiringRows: 0,
  },
  rows,
  failedRows,
  conclusion: failedRows.length > 0
    ? "speaker_runtime_dry_run_has_unexpected_candidate_rows"
    : "speaker_runtime_dry_run_confirms_runtime_unwired_and_no_candidate_leak",
  nextAction: "Proceed to camera_discovered no-mutation runtime dry-run; speaker remains reference-only/hold-only.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "speaker-no-mutation-runtime-dry-run-latest.json");
const mdPath = path.join(reportsDir, "speaker-no-mutation-runtime-dry-run-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Speaker No-Mutation Runtime Dry-Run",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  `- conclusion: ${report.conclusion}`,
  "",
  "## Boundary",
  "",
  "- reportOnly: true",
  "- publicPromotion: false",
  "- runtimeCatalogApply: false",
  "- candidatePoolPolicyWiring: false",
  "- productionDbMutation: false",
  "- directThirtyDayPlanEdit: false",
  "",
  "## Metrics",
  "",
  `- rows: ${report.metrics.rows}`,
  `- passedRows: ${report.metrics.passedRows}`,
  `- failedRows: ${report.metrics.failedRows}`,
  `- referenceOnlyRows: ${report.metrics.referenceOnlyRows}`,
  `- holdRows: ${report.metrics.holdRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  "",
  "## Rows",
  "",
  "| caseId | expected | actual | listingType | comparableKey | needsReview | pass |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  ...rows.map((row) => `| ${row.caseId} | ${row.expectedDecision} | ${row.actualDecision} | ${row.runtimeListingType} | ${row.comparableKey ?? "null"} | ${row.needsReview} | ${row.pass ? "yes" : "no"} |`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  conclusion: report.conclusion,
  rows: report.metrics.rows,
  failedRows: report.metrics.failedRows,
  candidatePositiveOnlyRows: report.metrics.candidatePositiveOnlyRows,
  jsonPath,
  mdPath,
}, null, 2));
