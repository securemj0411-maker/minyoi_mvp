import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

type HandoffItem = {
  order: number;
  file: string;
  kind: "summary" | "queue" | "evidence" | "contract" | "fixture" | "preflight" | "phase-report";
  audience: "owner" | "main-agent" | "future-executor" | "subagent";
  purpose: string;
  mustReadBeforeRuntime: boolean;
  exists: boolean;
};

const reportsDir = path.join(process.cwd(), "reports");

const items: Array<Omit<HandoffItem, "exists">> = [
  {
    order: 1,
    file: "reports/subagent-implementation-prep-summary-latest.md",
    kind: "summary",
    audience: "owner",
    purpose: "Phase 0-9 progress, category coverage, and no-runtime approval summary.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 2,
    file: "reports/subagent-implementation-prep-next-gate-latest.md",
    kind: "queue",
    audience: "owner",
    purpose: "Ranks narrow review candidates and carries forward deferred blockers.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 3,
    file: "reports/subagent-implementation-prep-spec-evidence-gap-latest.md",
    kind: "evidence",
    audience: "main-agent",
    purpose: "Shows source/spec gaps for top narrow review candidates.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 4,
    file: "reports/subagent-implementation-prep-spec-source-backfill-latest.md",
    kind: "evidence",
    audience: "main-agent",
    purpose: "Records official/spec source backfill for previously missing positive rows.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 5,
    file: "reports/subagent-implementation-prep-fixture-consistency-audit-latest.md",
    kind: "preflight",
    audience: "main-agent",
    purpose: "Checks duplicate IDs and positive evidence gaps across all fixture/prep cases.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 6,
    file: "reports/subagent-implementation-prep-no-mutation-dry-run-plan-latest.md",
    kind: "contract",
    audience: "future-executor",
    purpose: "Defines no-mutation dry-run queue, fixture cases, and owner decision requirements.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 7,
    file: "reports/subagent-implementation-prep-dry-run-output-contract-latest.md",
    kind: "contract",
    audience: "future-executor",
    purpose: "Defines allowed dry-run output fields and blocker validation rules.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 8,
    file: "reports/subagent-implementation-prep-owner-decision-packet-latest.md",
    kind: "queue",
    audience: "owner",
    purpose: "Compares top 3 dry-run candidates and recommends headphone_discovered first.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 9,
    file: "reports/headphone-no-mutation-dry-run-fixture-packet-latest.md",
    kind: "fixture",
    audience: "future-executor",
    purpose: "Headphone-only 9-row fixture packet for future no-mutation dry-run.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 10,
    file: "reports/headphone-no-mutation-dry-run-preflight-latest.md",
    kind: "preflight",
    audience: "future-executor",
    purpose: "Headphone preflight checklist and forbidden file constraints.",
    mustReadBeforeRuntime: true,
  },
  {
    order: 11,
    file: "reports/earphone-airpods-implementation-prep-latest.md",
    kind: "phase-report",
    audience: "subagent",
    purpose: "Phase 1 AirPods implementation-prep fixture report.",
    mustReadBeforeRuntime: false,
  },
  {
    order: 12,
    file: "reports/headphone-matched-sku-implementation-prep-latest.md",
    kind: "phase-report",
    audience: "subagent",
    purpose: "Phase 2 headphone matched-SKU implementation-prep fixture report.",
    mustReadBeforeRuntime: false,
  },
  {
    order: 13,
    file: "reports/game-console-body-narrow-implementation-prep-latest.md",
    kind: "phase-report",
    audience: "subagent",
    purpose: "Phase 3 game console body-narrow implementation-prep fixture report.",
    mustReadBeforeRuntime: false,
  },
];

async function exists(file: string): Promise<boolean> {
  try {
    await stat(path.join(process.cwd(), file));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const indexed: HandoffItem[] = [];
  for (const item of items) indexed.push({ ...item, exists: await exists(item.file) });

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    scope: "Implementation-prep handoff index",
    metrics: {
      indexedFiles: indexed.length,
      existingFiles: indexed.filter((item) => item.exists).length,
      missingFiles: indexed.filter((item) => !item.exists).length,
      mustReadBeforeRuntime: indexed.filter((item) => item.mustReadBeforeRuntime).length,
      runtimeApprovedRows: 0,
    },
    readingOrder: indexed,
    hardBoundaries: [
      "Do not edit runtime parser/catalog/pipeline/candidate-pool files from this handoff.",
      "Do not edit Supabase, cron, lifecycle, source health, pack UI, or production DB.",
      "Do not edit 30일_실행계획.md from this subagent context.",
      "parser_candidate remains non-public.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-handoff-index-latest.json"), JSON.stringify(report, null, 2));

  const rows = indexed.map((item) => `| ${item.order} | ${item.kind} | ${item.audience} | ${item.exists ? "yes" : "no"} | ${item.mustReadBeforeRuntime ? "yes" : "no"} | ${item.file} | ${item.purpose.replace(/\|/g, "/")} |`);
  const md = [
    "# Subagent Implementation Prep Handoff Index",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only handoff index for implementation-prep artifacts. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- indexed files: ${report.metrics.indexedFiles}`,
    `- existing files: ${report.metrics.existingFiles}`,
    `- missing files: ${report.metrics.missingFiles}`,
    `- must-read before runtime: ${report.metrics.mustReadBeforeRuntime}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Reading Order",
    "",
    "| order | kind | audience | exists | must_read_before_runtime | file | purpose |",
    "| ---: | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Hard Boundaries",
    "",
    ...report.hardBoundaries.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-handoff-index-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-handoff-index-latest.json");
  console.log("wrote reports/subagent-implementation-prep-handoff-index-latest.md");
  console.log(`handoff index: indexed=${indexed.length}, missing=${report.metrics.missingFiles}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
