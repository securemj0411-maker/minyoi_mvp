import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FinalAudit = {
  metrics: Record<string, number>;
  conclusion: string;
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const audit = await readJson<FinalAudit>("headphone-report-only-final-readiness-audit-latest.json");

  const requestedScope = [
    "Review headphone_discovered matched-SKU parser-candidate behavior only.",
    "Inspect whether 5 candidate_positive_only rows can become a narrow implementation proposal.",
    "Keep 4 manual-review and 5 negative-hold rows as guardrails.",
    "Do not include Razer/Beats brand-SKU rows as positives without separate catalog expansion.",
  ];

  const explicitNonScope = [
    "public promotion",
    "candidate pool wiring",
    "runtime catalog apply",
    "Supabase schema or DB writes",
    "cron/lifecycle/debug/pack UI changes",
    "broad headphone_discovered readiness",
    "Razer/Beats/B&O/Logitech/Corsair catalog expansion",
  ];

  const approvalChecklist = [
    "owner chooses headphone_discovered narrow runtime review",
    "owner confirms parser_candidate remains non-public until separate approval",
    "owner confirms no candidate-pool wiring",
    "owner confirms no production DB/Supabase writes",
    "owner confirms manual/hold guardrails stay non-positive",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    category: "headphone_discovered",
    scope: "Draft request for separate narrow runtime review approval",
    inputFiles: ["reports/headphone-report-only-final-readiness-audit-latest.json"],
    metrics: {
      auditPassFiles: audit.metrics.passFiles,
      auditFailFiles: audit.metrics.failFiles,
      runtimeApprovedRowsTotal: audit.metrics.runtimeApprovedRowsTotal,
      publicPromotionRowsTotal: audit.metrics.publicPromotionRowsTotal,
      candidatePoolWiringRowsTotal: audit.metrics.candidatePoolWiringRowsTotal,
      requestedScopeItems: requestedScope.length,
      explicitNonScopeItems: explicitNonScope.length,
      approvalChecklistItems: approvalChecklist.length,
    },
    auditConclusion: audit.conclusion,
    requestedScope,
    explicitNonScope,
    approvalChecklist,
    requestText:
      "Request explicit owner/main-agent approval for a narrow headphone_discovered runtime review limited to matched-SKU parser-candidate behavior. This draft does not grant approval.",
    nextStep: "Stop here unless owner/main-agent explicitly approves narrow runtime review or live/report-only collection.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-runtime-review-request-draft-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Headphone Runtime Review Request Draft",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only draft for a possible separate narrow runtime review request. This does not grant approval.",
    "",
    "## Metrics",
    "",
    `- audit pass/fail files: ${report.metrics.auditPassFiles}/${report.metrics.auditFailFiles}`,
    `- runtime-approved/public/candidate-pool rows total: ${report.metrics.runtimeApprovedRowsTotal}/${report.metrics.publicPromotionRowsTotal}/${report.metrics.candidatePoolWiringRowsTotal}`,
    `- requested scope items: ${report.metrics.requestedScopeItems}`,
    `- explicit non-scope items: ${report.metrics.explicitNonScopeItems}`,
    `- approval checklist items: ${report.metrics.approvalChecklistItems}`,
    "",
    "## Request Text",
    "",
    report.requestText,
    "",
    "## Requested Scope",
    "",
    ...requestedScope.map((item) => `- ${item}`),
    "",
    "## Explicit Non-Scope",
    "",
    ...explicitNonScope.map((item) => `- ${item}`),
    "",
    "## Approval Checklist",
    "",
    ...approvalChecklist.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    report.nextStep,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-runtime-review-request-draft-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-runtime-review-request-draft-latest.json");
  console.log("wrote reports/headphone-runtime-review-request-draft-latest.md");
  console.log(`headphone runtime review request draft: scope=${requestedScope.length}, nonscope=${explicitNonScope.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
