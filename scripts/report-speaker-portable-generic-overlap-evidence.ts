import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type PortableRow = {
  family: string;
  brand: string;
  modelExamples: Array<{ key: string; count: number }>;
};

type PortableMatrix = {
  category: string;
  rows: PortableRow[];
};

type GenericRow = {
  pid?: string;
  title?: string;
  price?: number;
  family?: string;
  exclusionClass: string;
  action: string;
};

type GenericReadiness = {
  rows: GenericRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

function titleHasBrand(title: string, brand: string): boolean {
  return new RegExp(`\\b${brand}\\b`, "i").test(title);
}

function titleHasModelToken(title: string, modelKey: string): boolean {
  const modelSuffix = modelKey.split("-").slice(1).join(" ");
  if (!modelSuffix) return false;
  return modelSuffix
    .split(/\s+/)
    .filter((token) => token.length > 1)
    .some((token) => new RegExp(`\\b${token}\\b`, "i").test(title));
}

async function main(): Promise<void> {
  const portableMatrix = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-portable-conditions-matrix-latest.json"), "utf8"),
  ) as PortableMatrix;
  const genericReadiness = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-generic-exclusion-readiness-latest.json"), "utf8"),
  ) as GenericReadiness;

  const brands = [...new Set(portableMatrix.rows.map((row) => row.brand))].sort();
  const modelKeys = portableMatrix.rows.flatMap((row) => row.modelExamples.map((example) => example.key));
  const rows = genericReadiness.rows.map((row) => {
    const title = row.title ?? "";
    const brandHits = brands.filter((brand) => titleHasBrand(title, brand));
    const modelTokenHits = modelKeys.filter((modelKey) => titleHasModelToken(title, modelKey));
    const overlapClass =
      brandHits.length > 0 && modelTokenHits.length === 0
        ? "brand_only_overlap_exclusion"
        : modelTokenHits.length > 0
          ? "model_token_overlap_manual_review"
          : "no_portable_subset_overlap";
    return {
      ...row,
      overlapClass,
      brandHits,
      modelTokenHits,
      runtimeApproved: false,
    };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: portableMatrix.category,
    decision: "portable_generic_overlap_evidence_report_only",
    sourceReports: ["speaker-portable-conditions-matrix-latest.json", "speaker-generic-exclusion-readiness-latest.json"],
    metrics: {
      portableFamilies: portableMatrix.rows.length,
      portableBrands: brands.length,
      portableModelKeys: modelKeys.length,
      genericRows: rows.length,
      brandOnlyOverlapRows: rows.filter((row) => row.overlapClass === "brand_only_overlap_exclusion").length,
      modelTokenOverlapRows: rows.filter((row) => row.overlapClass === "model_token_overlap_manual_review").length,
      noOverlapRows: rows.filter((row) => row.overlapClass === "no_portable_subset_overlap").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
    },
    rows,
    policyImplications: [
      "Brand-only generic speaker rows can overlap with portable brands but still lack model identity.",
      "Model-token overlap would require manual review before any candidate subset; none are runtime approved here.",
      "Generic exclusion rows remain outside portable comparable-key policy.",
    ],
    nextReportOnlyExperiments: [
      "reuse this overlap pattern for other categories where brand-only existing models are common",
      "add source-backed model specification evidence only in report form, not runtime wiring",
      "keep public promotion blocked until main approval and worker stability are complete",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not treat brand-only overlap as model-coded candidate approval",
      "Do not wire overlap evidence into candidate pool policy",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-portable-generic-overlap-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | overlap_class | brand_hits | model_token_hits | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.overlapClass} | ${row.brandHits.join(", ") || "-"} | ${row.modelTokenHits.join(", ") || "-"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Speaker Portable Generic Overlap Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only overlap evidence between portable model-coded subsets and generic speaker exclusions. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-portable-generic-overlap-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-portable-generic-overlap-evidence-latest.json");
  console.log("wrote reports/speaker-portable-generic-overlap-evidence-latest.md");
  console.log(`speaker portable generic overlap evidence: brand_only=${report.metrics.brandOnlyOverlapRows}, model_token=${report.metrics.modelTokenOverlapRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
