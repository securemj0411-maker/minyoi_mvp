import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Preflight = {
  readyForExecutorDesign: boolean;
  preflightChecks: Array<{ id: string; status: string; check: string; detail: string }>;
  forbiddenFiles: string[];
  stopConditions: string[];
};

type Integrity = {
  metrics: {
    auditedFiles: number;
    failFiles: number;
    runtimeApprovedNonZeroFiles: number;
  };
};

const reportsDir = path.join(process.cwd(), "reports");

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const preflight = await readJson<Preflight>(path.join(reportsDir, "headphone-no-mutation-dry-run-preflight-latest.json"));
  const integrity = await readJson<Integrity>(path.join(reportsDir, "subagent-implementation-prep-artifact-integrity-audit-latest.json"));

  const checklist = [
    {
      id: "REVIEW-01",
      status: preflight.readyForExecutorDesign ? "ready" : "blocked",
      item: "Preflight is ready for executor design.",
      evidence: "headphone-no-mutation-dry-run-preflight-latest.json",
    },
    {
      id: "REVIEW-02",
      status: integrity.metrics.failFiles === 0 ? "ready" : "blocked",
      item: "Report-only artifact integrity audit has zero failing files.",
      evidence: "subagent-implementation-prep-artifact-integrity-audit-latest.json",
    },
    {
      id: "REVIEW-03",
      status: integrity.metrics.runtimeApprovedNonZeroFiles === 0 ? "ready" : "blocked",
      item: "No audited report has non-zero runtime approval.",
      evidence: "subagent-implementation-prep-artifact-integrity-audit-latest.json",
    },
    {
      id: "REVIEW-04",
      status: "owner_required",
      item: "Owner/main-agent must explicitly choose headphone_discovered before executor work.",
      evidence: "subagent-implementation-prep-owner-decision-packet-latest.json",
    },
    {
      id: "REVIEW-05",
      status: "owner_required",
      item: "Owner/main-agent must confirm parser_candidate remains non-public.",
      evidence: "subagent-implementation-prep-dry-run-output-contract-latest.json",
    },
    {
      id: "REVIEW-06",
      status: "owner_required",
      item: "Owner/main-agent must confirm no candidate-pool wiring, runtime catalog edits, or production DB writes.",
      evidence: "headphone-no-mutation-dry-run-preflight-latest.json",
    },
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Headphone implementation review checklist before any no-mutation dry-run executor",
    category: "headphone_discovered",
    metrics: {
      checklistItems: checklist.length,
      readyItems: checklist.filter((item) => item.status === "ready").length,
      ownerRequiredItems: checklist.filter((item) => item.status === "owner_required").length,
      blockedItems: checklist.filter((item) => item.status === "blocked").length,
      runtimeApprovedRows: 0,
    },
    checklist,
    forbiddenFiles: preflight.forbiddenFiles,
    stopConditions: preflight.stopConditions,
    decision: "owner_required_before_executor",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "headphone-implementation-review-checklist-latest.json"), JSON.stringify(report, null, 2));

  const rows = checklist.map((item) => `| ${item.id} | ${item.status} | ${item.item} | ${item.evidence} |`);
  const md = [
    "# Headphone Implementation Review Checklist",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only review checklist before any no-mutation headphone dry-run executor. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- checklist items: ${report.metrics.checklistItems}`,
    `- ready items: ${report.metrics.readyItems}`,
    `- owner-required items: ${report.metrics.ownerRequiredItems}`,
    `- blocked items: ${report.metrics.blockedItems}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Checklist",
    "",
    "| id | status | item | evidence |",
    "| --- | --- | --- | --- |",
    ...rows,
    "",
    "## Decision",
    "",
    report.decision,
  ].join("\n");

  await writeFile(path.join(reportsDir, "headphone-implementation-review-checklist-latest.md"), `${md}\n`);
  console.log("wrote reports/headphone-implementation-review-checklist-latest.json");
  console.log("wrote reports/headphone-implementation-review-checklist-latest.md");
  console.log(`headphone review checklist: ready=${report.metrics.readyItems}, owner_required=${report.metrics.ownerRequiredItems}, blocked=${report.metrics.blockedItems}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
