import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileChainArtifacts, registryPacketSuites } from "./lib/report-packet-registry";

type Step = {
  name: string;
  command: string[];
};

const steps: Step[] = [
  ...compileChainArtifacts(registryPacketSuites).readinessSteps,
  { name: "summary", command: ["npx", "tsx", "scripts/report-parser-readiness-summary.ts"] },
  { name: "policy-matrix", command: ["npx", "tsx", "scripts/report-parser-policy-matrix.ts"] },
  { name: "hold-diagnosis", command: ["npx", "tsx", "scripts/report-parser-hold-diagnosis.ts"] },
  { name: "hold-blockers-index", command: ["npx", "tsx", "scripts/report-parser-hold-blockers-index.ts"] },
  { name: "category-evidence-ledger", command: ["npx", "tsx", "scripts/report-parser-category-evidence-ledger.ts"] },
  { name: "category-context-status", command: ["npx", "tsx", "scripts/report-parser-category-context-status.ts"] },
  { name: "suite-status", command: ["npx", "tsx", "scripts/report-parser-suite-status.ts"] },
  { name: "report-manifest", command: ["npx", "tsx", "scripts/report-parser-report-manifest.ts"] },
  { name: "manifest-audit", command: ["npx", "tsx", "scripts/report-parser-manifest-audit.ts"] },
  { name: "suite-coverage", command: ["npx", "tsx", "scripts/report-parser-suite-coverage.ts"] },
  { name: "suite-usage", command: ["npx", "tsx", "scripts/report-parser-suite-usage.ts"] },
  { name: "registry-phase-tag-summary", command: ["npx", "tsx", "scripts/report-parser-registry-phase-tag-summary.ts"] },
  { name: "registry-metadata-status", command: ["npx", "tsx", "scripts/report-parser-registry-metadata-status.ts"] },
  { name: "registry-compiler-candidate", command: ["npx", "tsx", "scripts/report-parser-registry-compiler-candidate.ts"] },
  { name: "registry-backlog-signals", command: ["npx", "tsx", "scripts/report-parser-registry-backlog-signals.ts"] },
  { name: "next-work-queue", command: ["npx", "tsx", "scripts/report-parser-next-work-queue.ts"] },
  { name: "review-examples-index", command: ["npx", "tsx", "scripts/report-parser-review-examples-index.ts"] },
  { name: "review-top-examples", command: ["npx", "tsx", "scripts/report-parser-review-top-examples.ts"] },
  { name: "boundary-review-examples", command: ["npx", "tsx", "scripts/report-parser-boundary-review-examples.ts"] },
  { name: "boundary-example-coverage", command: ["npx", "tsx", "scripts/report-parser-boundary-example-coverage.ts"] },
  { name: "airpods-headphone-boundary-examples", command: ["npx", "tsx", "scripts/report-parser-airpods-headphone-boundary-examples.ts"] },
  { name: "airpods-headphone-coverage", command: ["npx", "tsx", "scripts/report-parser-airpods-headphone-coverage.ts"] },
  { name: "review-coverage-summary", command: ["npx", "tsx", "scripts/report-parser-review-coverage-summary.ts"] },
  { name: "wiring-blockers", command: ["npx", "tsx", "scripts/report-parser-wiring-blockers.ts"] },
  { name: "report-only-audit", command: ["npx", "tsx", "scripts/report-parser-report-only-audit.ts"] },
  { name: "policy-guardrails", command: ["npx", "tsx", "scripts/report-parser-policy-guardrails.ts"] },
];

const reportsDir = path.join(process.cwd(), "reports");

function runStep(step: Step): Promise<{ name: string; code: number; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(step.command[0], step.command.slice(1), {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      output += String(chunk);
    });
    child.on("close", (code) => {
      resolve({ name: step.name, code: code ?? 1, output });
    });
  });
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const results = [];

  for (const step of steps) {
    console.log(`running ${step.name}`);
    const result = await runStep(step);
    results.push(result);
    if (result.code !== 0) {
      console.error(result.output);
      throw new Error(`report step failed: ${step.name}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = {
    generatedAt: finishedAt,
    startedAt,
    reportOnly: true,
    publicPromotion: false,
    steps: results.map((result) => ({
      name: result.name,
      code: result.code,
      lastLine: result.output.trim().split("\n").filter(Boolean).at(-1) ?? "",
    })),
    guardrails: [
      "No public promotion",
      "No production DB mutation",
      "No cron/lifecycle/pack open/source health/Supabase schema/operational log changes",
      "Do not edit 30일_실행계획.md",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-readiness-all-run-latest.json"), JSON.stringify(summary, null, 2));
  const md = [
    "# Parser Readiness All Run",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    "| step | status | last line |",
    "| --- | --- | --- |",
    ...summary.steps.map((step) => `| ${step.name} | ${step.code === 0 ? "ok" : "failed"} | ${step.lastLine.replace(/\|/g, "\\|")} |`),
    "",
    "## Guardrails",
    "",
    ...summary.guardrails.map((line) => `- ${line}`),
  ].join("\n");
  await writeFile(path.join(reportsDir, "parser-readiness-all-run-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-readiness-all-run-latest.json");
  console.log("wrote reports/parser-readiness-all-run-latest.md");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
