import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type ModelReadyRow = {
  key: string;
  count: number;
  subtype: string;
  status: string;
};

type VacuumReadiness = {
  category: string;
  testCandidateRows: ModelReadyRow[];
};

type GenericVacuumRow = {
  pid?: string;
  title?: string;
  price?: number;
  key?: string;
  genericClass: string;
  action: string;
};

type GenericVacuumReadiness = {
  rows: GenericVacuumRow[];
};

const reportsDir = path.join(process.cwd(), "reports");

const brandAliases: Record<string, string[]> = {
  clean: ["클린", "clean"],
  dyson: ["다이슨", "dyson"],
  lg: ["lg", "엘지"],
  samsung: ["samsung", "삼성"],
};

function brandFromKey(key: string): string {
  return key.split("-")[0] ?? key;
}

function tokenAliases(token: string): string[] {
  if (token === "codezero") return ["코드제로", "codezero"];
  if (token === "bespoke") return ["비스포크", "bespoke"];
  if (token === "jet") return ["제트", "jet"];
  return [token];
}

function hasAny(text: string, aliases: string[]): boolean {
  return aliases.some((alias) => new RegExp(alias, "i").test(text));
}

async function main(): Promise<void> {
  const vacuumReadiness = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-vacuum-test-candidate-readiness-latest.json"), "utf8"),
  ) as VacuumReadiness;
  const genericReadiness = JSON.parse(
    await readFile(path.join(reportsDir, "home-appliance-generic-vacuum-exclusion-readiness-latest.json"), "utf8"),
  ) as GenericVacuumReadiness;

  const modelKeys = vacuumReadiness.testCandidateRows.map((row) => row.key);
  const brands = [...new Set(modelKeys.map(brandFromKey))].sort();
  const rows = genericReadiness.rows.map((row) => {
    const title = row.title ?? "";
    const brandHits = brands.filter((brand) => hasAny(title, brandAliases[brand] ?? [brand]));
    const modelTokenHits = modelKeys.filter((key) => {
      const [, ...tokens] = key.split("-");
      return tokens.length > 0 && tokens.every((token) => hasAny(title, tokenAliases(token)));
    });
    const overlapClass =
      modelTokenHits.length > 0
        ? "model_token_overlap_exclusion_review"
        : brandHits.length > 0
          ? "brand_only_overlap_exclusion"
          : "no_model_ready_overlap";
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
    category: vacuumReadiness.category,
    decision: "vacuum_model_generic_overlap_evidence_report_only",
    sourceReports: [
      "home-appliance-vacuum-test-candidate-readiness-latest.json",
      "home-appliance-generic-vacuum-exclusion-readiness-latest.json",
    ],
    metrics: {
      modelReadyRows: vacuumReadiness.testCandidateRows.length,
      modelReadyKeys: modelKeys.length,
      genericRows: rows.length,
      brandOnlyOverlapRows: rows.filter((row) => row.overlapClass === "brand_only_overlap_exclusion").length,
      modelTokenOverlapRows: rows.filter((row) => row.overlapClass === "model_token_overlap_exclusion_review").length,
      noOverlapRows: rows.filter((row) => row.overlapClass === "no_model_ready_overlap").length,
      runtimeApprovedRows: rows.filter((row) => row.runtimeApproved).length,
    },
    rows,
    policyImplications: [
      "Brand/model token overlap inside generic vacuum rows is evidence for review, not candidate approval.",
      "Generic rows with model-token overlap still need battery/accessory/subtype checks before main review.",
      "Robot vacuum and bedding cleaner boundaries remain separate from stick/handheld model-ready rows.",
    ],
    nextReportOnlyExperiments: [
      "use overlap rows to build manual-review examples if main requests it",
      "keep logistics row-level export blocked until a source report exposes examples",
      "do not turn model-token overlap into runtime parser behavior in this subagent phase",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum/appliance keys for candidate pool",
      "Do not wire vacuum subtype axes into runtime",
      "Do not mutate production DB or Supabase schema",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-vacuum-overlap-evidence-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | generic_class | overlap_class | brand_hits | model_token_hits | runtime_approved | title |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.genericClass} | ${row.overlapClass} | ${row.brandHits.join(", ") || "-"} | ${row.modelTokenHits.join(", ") || "-"} | ${row.runtimeApproved ? "yes" : "no"} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Home Appliance Vacuum Overlap Evidence",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only overlap evidence between model-ready vacuum rows and generic vacuum exclusions. This is not runtime wiring and not public promotion.",
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

  await writeFile(path.join(reportsDir, "home-appliance-vacuum-overlap-evidence-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-vacuum-overlap-evidence-latest.json");
  console.log("wrote reports/home-appliance-vacuum-overlap-evidence-latest.md");
  console.log(`home appliance vacuum overlap evidence: brand_only=${report.metrics.brandOnlyOverlapRows}, model_token=${report.metrics.modelTokenOverlapRows}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
