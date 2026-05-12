import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvidencePlan = {
  backlogRows: Array<{
    caseId: string;
    lane: string;
    title: string;
    inferredBrandOrFamily: string;
    suspectedModelOrSeries: string;
    currentClass: string;
    blockerType: string;
  }>;
};

type SourceRow = {
  caseId: string;
  brandOrFamily: string;
  suspectedModelOrSeries: string;
  sourceStatus: "official_source_found_report_only" | "partial_official_source_found_report_only";
  sources: Array<{ label: string; url: string; retrievedAt: string; note: string }>;
  stillBlockedForRuntime: true;
  reasonStillBlocked: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function sourcesFor(caseId: string): SourceRow | undefined {
  if (caseId === "HEADPHONE-HOLD-04") {
    return {
      caseId,
      brandOrFamily: "Razer",
      suspectedModelOrSeries: "BlackShark V3 / BlackShark V3 X HyperSpeed family",
      sourceStatus: "official_source_found_report_only",
      sources: [
        {
          label: "Razer - BlackShark V3 product page",
          url: "https://www.razer.com/gaming-headsets/razer-blackshark-v3/",
          retrievedAt: "2026-05-12",
          note: "Official Razer page identifies BlackShark V3 as a wireless esports headset with HyperSpeed Wireless Gen-2.",
        },
        {
          label: "Razer Support - BlackShark V3 X HyperSpeed for Xbox specifications",
          url: "https://mysupport.razer.com/app/answers/detail/a_id/15478",
          retrievedAt: "2026-05-12",
          note: "Official Razer support/spec page identifies a BlackShark V3 X HyperSpeed variant and lists full technical specifications.",
        },
      ],
      stillBlockedForRuntime: true,
      reasonStillBlocked: "The local title says BlackShark V3 Hyperspeed, but exact variant mapping needs more sample/source reconciliation before catalog expansion.",
    };
  }

  if (caseId === "HEADPHONE-HOLD-05") {
    return {
      caseId,
      brandOrFamily: "Beats",
      suspectedModelOrSeries: "Beats EP / unclear Beats on-ear wording",
      sourceStatus: "partial_official_source_found_report_only",
      sources: [
        {
          label: "Beats by Dre - Beats EP Support",
          url: "https://www.beatsbydre.com/ch-de/support/headphones/beats-ep",
          retrievedAt: "2026-05-12",
          note: "Official Beats support page confirms Beats EP support exists, but marketplace wording still needs exact model normalization.",
        },
        {
          label: "Apple Support - Which Beats do I have?",
          url: "https://support.apple.com/en-au/guide/beats/dev1695611e8/web",
          retrievedAt: "2026-05-12",
          note: "Apple support page points older Beats device users to Beats support; useful for model-identification workflow, not runtime approval.",
        },
      ],
      stillBlockedForRuntime: true,
      reasonStillBlocked: "The title mixes Beats/Dr. Dre/EP/on-ear/headset wording; official source exists but exact title-to-SKU policy is not approved.",
    };
  }

  return undefined;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const plan = await readJson<EvidencePlan>(path.join(reportsDir, "headphone-broader-brand-sku-evidence-plan-latest.json"));
  const sourceRows = plan.backlogRows.map((row) => sourcesFor(row.caseId)).filter(Boolean) as SourceRow[];
  const sourceIds = new Set(sourceRows.map((row) => row.caseId));
  const stillNoSourceRows = plan.backlogRows.filter((row) => !sourceIds.has(row.caseId));

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Broader headphone brand/SKU official source backfill",
    inputFiles: ["reports/headphone-broader-brand-sku-evidence-plan-latest.json"],
    metrics: {
      backlogRows: plan.backlogRows.length,
      sourceBackfilledRows: sourceRows.length,
      stillNoSourceRows: stillNoSourceRows.length,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolWiringRows: 0,
    },
    sourceRows,
    stillNoSourceRows,
    policy: [
      "Official source backfill does not change current hold/manual status.",
      "Razer and Beats rows remain non-positive until exact SKU normalization and catalog expansion are separately approved.",
      "AirPods Max ambiguity remains manual-review and is not solved by broader brand/SKU source backfill.",
    ],
    nextStep: "Build a brand/SKU guardrail fixture plan that keeps Razer/Beats non-positive while preserving evidence refs.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-broader-brand-sku-source-backfill-latest.json"), JSON.stringify(report, null, 2));

  const rows = sourceRows.map((row) => {
    const links = row.sources.map((source) => `[${source.label}](${source.url})`).join("<br>");
    return `| ${row.caseId} | ${row.brandOrFamily} | ${row.suspectedModelOrSeries} | ${row.sourceStatus} | ${links} | ${row.reasonStillBlocked.replace(/\|/g, "/")} |`;
  });

  const missingRows = stillNoSourceRows.map((row) => `| ${row.caseId} | ${row.lane} | ${row.inferredBrandOrFamily} | ${row.suspectedModelOrSeries} |`);

  const md = [
    "# Headphone Broader Brand/SKU Source Backfill",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only official source backfill for broader headphone brand/SKU backlog rows. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- backlog rows: ${report.metrics.backlogRows}`,
    `- source-backfilled rows: ${report.metrics.sourceBackfilledRows}`,
    `- still no-source rows: ${report.metrics.stillNoSourceRows}`,
    `- runtime-approved/public/candidate-pool rows: ${report.metrics.runtimeApprovedRows}/${report.metrics.publicPromotionRows}/${report.metrics.candidatePoolWiringRows}`,
    "",
    "## Source Rows",
    "",
    "| case_id | brand_or_family | suspected_model_or_series | source_status | sources | still_blocked_reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Still No-Source Rows",
    "",
    "| case_id | lane | brand_or_family | suspected_model_or_series |",
    "| --- | --- | --- | --- |",
    ...missingRows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-broader-brand-sku-source-backfill-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-broader-brand-sku-source-backfill-latest.json");
  console.log("wrote reports/headphone-broader-brand-sku-source-backfill-latest.md");
  console.log(`headphone broader brand/SKU source backfill: sourced=${sourceRows.length}, missing=${stillNoSourceRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
