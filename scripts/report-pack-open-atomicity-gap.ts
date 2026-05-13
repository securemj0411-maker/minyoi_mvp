import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports");
const packOpenPath = path.join(root, "src/lib/pack-open.ts");
const schemaPath = path.join(root, "supabase/schema.sql");
const testPath = path.join(root, "tests/pack-open-race.test.ts");

function read(file: string) {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const packOpen = read(packOpenPath);
const schema = read(schemaPath);
const test = read(testPath);

const checks = {
  hasPackOpenTable: schema.includes("create table if not exists public.mvp_pack_opens"),
  hasPackRevealTable: schema.includes("create table if not exists public.mvp_pack_reveals"),
  hasCommitRevealRpc: schema.includes("create or replace function public.commit_mvp_pool_reveal"),
  hasRecordPackOpenRpc: schema.includes("record_mvp_pack_open"),
  appWritesPackOpenDirectly: packOpen.includes('callSupabase("/mvp_pack_opens"'),
  appWritesRevealsDirectly: packOpen.includes('callSupabase("/mvp_pack_reveals"'),
  appCommitsPoolAfterRevealWrite: packOpen.includes("await insertReveals") && packOpen.includes("await rpcCommitReveal"),
  testCoversRevealFailureBeforeCommit: test.includes("reveal write failure") && test.includes("pool exposure is not committed"),
};

const paidMvpStatus = checks.hasRecordPackOpenRpc ? "pass" : "hold";
const betaStatus = checks.hasCommitRevealRpc && checks.testCoversRevealFailureBeforeCommit ? "pass" : "hold";

const output = {
  generatedAt: new Date().toISOString(),
  mode: "report_only_no_runtime_mutation",
  checks,
  betaStatus,
  paidMvpStatus,
  residualRisk:
    "Current flow can leave a pack_open audit row before mvp_pack_reveals write succeeds. Credits are refunded by route error handling, and pool exposure is not committed before reveal write success, but full audit/reveal/commit atomicity is not yet guaranteed.",
  recommendedNext:
    "Before paid MVP, design one Postgres RPC that records pack_open, pack_reveals, and pool commits in one transaction, or add an explicit failed/void audit state and reconciliation job.",
  forbidden: [
    "Do not weaken reservation RPC semantics.",
    "Do not commit pool exposure before reveal rows are written.",
    "Do not hide this as a passing paid-MVP gate.",
  ],
};

function mark(status: string) {
  return status === "pass" ? "pass" : "hold";
}

const md = [
  "# Pack Open Atomicity Gap",
  "",
  `- generatedAt: ${output.generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "",
  "## Status",
  "",
  `- betaStatus: ${mark(betaStatus)}`,
  `- paidMvpStatus: ${mark(paidMvpStatus)}`,
  "",
  "## Checks",
  "",
  "| check | value |",
  "| --- | --- |",
  ...Object.entries(checks).map(([key, value]) => `| ${key} | ${value ? "yes" : "no"} |`),
  "",
  "## Residual Risk",
  "",
  `- ${output.residualRisk}`,
  "",
  "## Recommended Next",
  "",
  `- ${output.recommendedNext}`,
  "",
  "## Forbidden",
  "",
  ...output.forbidden.map((item) => `- ${item}`),
  "",
].join("\n");

mkdirSync(reportDir, { recursive: true });
writeFileSync(path.join(reportDir, "pack-open-atomicity-gap-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(path.join(reportDir, "pack-open-atomicity-gap-latest.md"), md);

console.log("wrote reports/pack-open-atomicity-gap-latest.json");
console.log("wrote reports/pack-open-atomicity-gap-latest.md");
console.log(JSON.stringify({ betaStatus, paidMvpStatus }));
