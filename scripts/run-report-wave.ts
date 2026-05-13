import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { compileWaveCommands, findReportWaveByKey, listReportWaveKeys } from "./lib/report-wave-spec";
import { findRegistryPacketGroupByKey } from "./lib/report-packet-registry";

type StepResult = {
  name: string;
  phase: "packets" | "meta";
  command: string[];
  code: number;
  output: string;
};

const reportsDir = path.join(process.cwd(), "reports");

function usage(): never {
  const keys = listReportWaveKeys().map((key) => `- ${key}`).join("\n");
  throw new Error(`missing --wave <key> or --group <registry-group-key>\navailable waves:\n${keys}`);
}

function parseArgs(argv: string[]): { waveKey?: string; groupKey?: string; withMeta: boolean } {
  const waveIndex = argv.indexOf("--wave");
  const groupIndex = argv.indexOf("--group");
  const withMeta = argv.includes("--with-meta");
  const waveKey = waveIndex !== -1 && waveIndex + 1 < argv.length ? argv[waveIndex + 1] : undefined;
  const groupKey = groupIndex !== -1 && groupIndex + 1 < argv.length ? argv[groupIndex + 1] : undefined;
  if (!waveKey && !groupKey) usage();
  return { waveKey, groupKey, withMeta };
}

function runStep(name: string, phase: "packets" | "meta", command: string[]): Promise<StepResult> {
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
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
      resolve({
        name,
        phase,
        command,
        code: code ?? 1,
        output,
      });
    });
  });
}

async function main(): Promise<void> {
  const { waveKey, groupKey, withMeta } = parseArgs(process.argv.slice(2));
  let title = "";
  let description = "";
  let category = "";
  let family = "";
  let guardrails: readonly string[] = [];
  let steps: Array<{ name: string; command: string[]; phase: "packets" | "meta" }> = [];

  if (waveKey) {
    const wave = findReportWaveByKey(waveKey);
    if (!wave) usage();
    title = wave.title;
    description = wave.description;
    category = wave.category;
    family = wave.family;
    guardrails = wave.guardrails;
    steps = compileWaveCommands(wave);
  } else if (groupKey) {
    const group = findRegistryPacketGroupByKey(groupKey);
    if (!group) {
      throw new Error(`unknown registry group: ${groupKey}`);
    }
    title = `Registry Group Wave — ${group.family}`;
    description =
      "Runs one registry packet group as an isolated shard worker. Use --with-meta only for a finalizer agent after shard workers finish.";
    category = group.category;
    family = group.family;
    guardrails = [
      "Shard workers should prefer packet-only mode",
      "Use --with-meta only in a single finalizer agent",
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
    ];
    steps = withMeta
      ? [
          { name: "parser-report-manifest", command: ["node", "--import", "tsx", "scripts/report-parser-report-manifest.ts"], phase: "meta" as const },
          { name: "parser-manifest-audit", command: ["node", "--import", "tsx", "scripts/report-parser-manifest-audit.ts"], phase: "meta" as const },
          { name: "parser-registry-backlog-signals", command: ["node", "--import", "tsx", "scripts/report-parser-registry-backlog-signals.ts"], phase: "meta" as const },
          { name: "parser-next-work-queue", command: ["node", "--import", "tsx", "scripts/report-parser-next-work-queue.ts"], phase: "meta" as const },
        ]
      : group.scripts.map((scriptFile) => ({
          name: scriptFile.replace(/^report-/, "").replace(/\.ts$/, ""),
          command: ["node", "--import", "tsx", `scripts/${scriptFile}`],
          phase: "packets" as const,
        }));
  }

  const startedAt = new Date().toISOString();
  const results: StepResult[] = [];

  for (const step of steps) {
    console.log(`running ${step.phase}:${step.name}`);
    const result = await runStep(step.name, step.phase, step.command);
    results.push(result);
    if (result.code !== 0) {
      console.error(result.output);
      throw new Error(`wave step failed: ${step.name}`);
    }
  }

  const finishedAt = new Date().toISOString();
  const report = {
    generatedAt: finishedAt,
    startedAt,
    wave: {
      key: waveKey ?? `group:${groupKey}`,
      category,
      family,
      title,
      description,
      reportOnly: true,
      mode: waveKey ? "wave" : withMeta ? "meta-only-finalizer" : "group-only",
    },
    totals: {
      steps: results.length,
      packetSteps: results.filter((r) => r.phase === "packets").length,
      metaSteps: results.filter((r) => r.phase === "meta").length,
      failed: results.filter((r) => r.code !== 0).length,
    },
    guardrails,
    steps: results.map((result) => ({
      name: result.name,
      phase: result.phase,
      code: result.code,
      lastLine: result.output.trim().split("\n").filter(Boolean).at(-1) ?? "",
    })),
  };

  await mkdir(reportsDir, { recursive: true });
  const artifactKey = waveKey ?? `group-${groupKey}${withMeta ? "-with-meta" : ""}`;
  const jsonPath = path.join(reportsDir, `report-wave-${artifactKey}-latest.json`);
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    `# ${title}`,
    "",
    `Generated: ${report.generatedAt}`,
    "",
    description,
    "",
    "## Totals",
    "",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
    "",
    "## Steps",
    "",
    "| phase | step | status | last line |",
    "| --- | --- | --- | --- |",
    ...report.steps.map((step) => `| ${step.phase} | ${step.name} | ${step.code === 0 ? "ok" : "failed"} | ${step.lastLine.replace(/\|/g, "\\|")} |`),
  ].join("\n");

  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`report-wave: key=${report.wave.key}, steps=${report.totals.steps}, failed=${report.totals.failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
