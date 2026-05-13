import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type BoundaryMatrix = {
  rows: Array<{
    status: string;
    category: string;
    target: string;
    score: number;
    allowedRows: number;
    maxFutureWriteCap: number;
    hasRuntimeReviewRequest: boolean;
  }>;
};

type Draft = {
  generatedAt: string;
  reportOnly: true;
  publicPromotion: false;
  runtimeCatalogApply: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  category: string;
  target: string;
  score: number;
  allowedRows: number;
  maxFutureWriteCap: number;
  requestedScope: string[];
  explicitNonScope: string[];
  approvalChecklist: string[];
  requestText: string;
  nextStep: string;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

function fileSlug(category: string, target: string): string {
  return `${category}-${target}`.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "-").replace(/^-+|-+$/g, "");
}

function requestedScopeFor(category: string, target: string): string[] {
  if (category === "monitor_discovered") {
    return [
      `Review only selected exact monitor model-code runtime behavior for ${target}.`,
      "Keep generic monitor_discovered, size-only, Hz-only, TV/monitor hybrid, arm/stand/panel-only, and PC bundle rows outside the scope.",
      "Require exact model-code visibility and same-request fresh detail verification before any future internal-only write.",
      "Do not treat this as monitor category readiness or public candidate-pack approval.",
    ];
  }
  if (category === "tablet_discovered") {
    return [
      `Review only the single exact tablet key ${target}.`,
      "Keep 13-inch/Air/Mini/Cellular/LTE/5G/eSIM/wrong-storage rows outside the scope.",
      "Keep Apple Pencil/Magic Keyboard/case bundle price rows review-only unless a later bundle policy is approved.",
      "Do not treat this as tablet category readiness or broad iPad parser approval.",
    ];
  }
  if (category === "speaker_audio_discovered") {
    return [
      `Review only selected exact speaker model runtime behavior for ${target}.`,
      "Keep other JBL models, case/pouch/stand/charger-only rows, rental/PA/microphone/soundbar rows, buying rows, and damaged rows outside the scope.",
      "Require fresh detail verification and conservative write cap because the lane is thin.",
      "Do not treat this as broad speaker_audio_discovered readiness or public candidate-pack approval.",
    ];
  }
  return [
    `Review only the narrow target ${target}.`,
    "Keep broader category readiness and public promotion outside the scope.",
  ];
}

function explicitNonScope(): string[] {
  return [
    "public promotion",
    "candidate pool wiring",
    "Supabase schema or DB writes",
    "cron/lifecycle/debug/pack UI changes",
    "broad category readiness changes",
    "AI pass overriding parser hard holds",
  ];
}

function approvalChecklistFor(row: BoundaryMatrix["rows"][number]): string[] {
  return [
    `owner chooses ${row.category}/${row.target} narrow runtime review`,
    "owner confirms parser/runtime change remains non-public until separate approval",
    "owner confirms no candidate-pool wiring",
    "owner confirms no production DB/Supabase writes",
    `owner confirms max future internal-only write cap <= ${row.maxFutureWriteCap}`,
    "owner confirms same-request fresh detail refetch is required before any later write executor",
  ];
}

function markdown(draft: Draft): string {
  return [
    `# ${draft.category} Runtime Review Request Draft`,
    "",
    `Generated: ${draft.generatedAt}`,
    "",
    "Report-only draft for a possible separate narrow runtime review request. This does not grant approval.",
    "",
    "## Metrics",
    "",
    `- target: ${draft.target}`,
    `- score: ${draft.score}`,
    `- allowed rows: ${draft.allowedRows}`,
    `- max future write cap: ${draft.maxFutureWriteCap}`,
    "",
    "## Request Text",
    "",
    draft.requestText,
    "",
    "## Requested Scope",
    "",
    ...draft.requestedScope.map((item) => `- ${item}`),
    "",
    "## Explicit Non-Scope",
    "",
    ...draft.explicitNonScope.map((item) => `- ${item}`),
    "",
    "## Approval Checklist",
    "",
    ...draft.approvalChecklist.map((item) => `- ${item}`),
    "",
    "## Next Step",
    "",
    draft.nextStep,
  ].join("\n");
}

async function main(): Promise<void> {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const matrix = await readJson<BoundaryMatrix>("acquisition-approval-boundary-matrix-latest.json");
  const rows = matrix.rows.filter((row) => row.status === "owner_review_ready" && !row.hasRuntimeReviewRequest);
  const drafts: Array<{ category: string; target: string; jsonPath: string; mdPath: string }> = [];

  for (const row of rows) {
    const slug = fileSlug(row.category, row.target);
    const draft: Draft = {
      generatedAt,
      reportOnly: true,
      publicPromotion: false,
      runtimeCatalogApply: false,
      candidatePoolPolicyWiring: false,
      productionDbMutation: false,
      category: row.category,
      target: row.target,
      score: row.score,
      allowedRows: row.allowedRows,
      maxFutureWriteCap: row.maxFutureWriteCap,
      requestedScope: requestedScopeFor(row.category, row.target),
      explicitNonScope: explicitNonScope(),
      approvalChecklist: approvalChecklistFor(row),
      requestText: `Request explicit owner/main-agent approval for a narrow ${row.category}/${row.target} runtime review. This draft does not grant approval.`,
      nextStep: "Stop here unless owner/main-agent explicitly approves narrow runtime review or more live/report-only collection.",
    };
    const jsonFile = `runtime-review-request-draft-${slug}-latest.json`;
    const mdFile = `runtime-review-request-draft-${slug}-latest.md`;
    await writeFile(path.join(reportsDir, jsonFile), `${JSON.stringify(draft, null, 2)}\n`);
    await writeFile(path.join(reportsDir, mdFile), `${markdown(draft)}\n`);
    drafts.push({
      category: row.category,
      target: row.target,
      jsonPath: `reports/${jsonFile}`,
      mdPath: `reports/${mdFile}`,
    });
  }

  const index = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    drafts,
    conclusion: "acquisition_runtime_review_request_drafts_prepared_report_only",
  };
  await writeFile(path.join(reportsDir, "acquisition-runtime-review-request-drafts-latest.json"), `${JSON.stringify(index, null, 2)}\n`);
  await writeFile(
    path.join(reportsDir, "acquisition-runtime-review-request-drafts-latest.md"),
    [
      "# Acquisition Runtime Review Request Drafts",
      "",
      `- generatedAt: ${generatedAt}`,
      "- reportOnly: true",
      "- productionDbMutation/publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false/false",
      "",
      "| category | target | md |",
      "| --- | --- | --- |",
      ...drafts.map((draft) => `| ${draft.category} | ${draft.target} | ${draft.mdPath} |`),
      "",
      "## Decision",
      "",
      "These are approval request drafts only. They do not approve runtime changes, DB writes, or public promotion.",
    ].join("\n"),
  );

  console.log(JSON.stringify({
    conclusion: index.conclusion,
    drafts: drafts.length,
    targets: drafts.map((draft) => draft.target),
  }, null, 2));
}

void main();
