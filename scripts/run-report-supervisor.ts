import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ShardTask =
  | { kind: "group"; key: string }
  | { kind: "wave"; key: string };

type TaskResult = {
  key: string;
  kind: "group" | "wave" | "finalizer";
  code: number;
  output: string;
  startedAt: string;
  finishedAt: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const defaultTasks: readonly ShardTask[] = [
  { kind: "group", key: "smartwatch-wearables" },
  { kind: "group", key: "earphone-airpods-galaxybuds" },
  { kind: "group", key: "headphone-airpodsmax" },
  { kind: "group", key: "monitor-modelcode" },
  { kind: "group", key: "desktop-fullunit" },
  { kind: "group", key: "game-console-body" },
  { kind: "group", key: "camera-package" },
  { kind: "group", key: "speaker-portable" },
  { kind: "group", key: "home-appliance-vacuum" },
  { kind: "wave", key: "phones-weekly-refresh" },
  { kind: "wave", key: "smartwatch-weekly-refresh" },
  { kind: "wave", key: "owner-decision-unblock" },
  { kind: "wave", key: "category-readiness-priority" },
  { kind: "wave", key: "wave3-through-8-implementation" },
] as const;

function parseArgs(argv: string[]): { concurrency: number } {
  const concurrencyIndex = argv.indexOf("--concurrency");
  if (concurrencyIndex !== -1 && concurrencyIndex + 1 < argv.length) {
    const value = Number(argv[concurrencyIndex + 1]);
    if (Number.isFinite(value) && value > 0) {
      return { concurrency: Math.floor(value) };
    }
  }
  return { concurrency: 4 };
}

function makeCommand(task: ShardTask): string[] {
  if (task.kind === "group") {
    return ["node", "--import", "tsx", "scripts/run-report-wave.ts", "--group", task.key];
  }
  return ["node", "--import", "tsx", "scripts/run-report-wave.ts", "--wave", task.key];
}

function makeFinalizerCommand(): string[] {
  return ["node", "--import", "tsx", "scripts/run-report-wave.ts", "--group", "smartwatch-wearables", "--with-meta"];
}

function runCommand(key: string, kind: TaskResult["kind"], command: string[]): Promise<TaskResult> {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
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
        key,
        kind,
        code: code ?? 1,
        output,
        startedAt,
        finishedAt: new Date().toISOString(),
      });
    });
  });
}

async function runTaskPool(tasks: readonly ShardTask[], concurrency: number): Promise<TaskResult[]> {
  const queue = [...tasks];
  const results: TaskResult[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) return;
      console.log(`starting ${task.kind}:${task.key}`);
      const result = await runCommand(task.key, task.kind, makeCommand(task));
      results.push(result);
      console.log(`finished ${task.kind}:${task.key} code=${result.code}`);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));
  return results;
}

async function main(): Promise<void> {
  const { concurrency } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  const shardResults = await runTaskPool(defaultTasks, concurrency);
  const failedShards = shardResults.filter((result) => result.code !== 0);

  let finalizerResult: TaskResult | null = null;
  if (failedShards.length === 0) {
    console.log("starting finalizer");
    finalizerResult = await runCommand("global-meta-finalizer", "finalizer", makeFinalizerCommand());
    console.log(`finished finalizer code=${finalizerResult.code}`);
  }

  const finishedAt = new Date().toISOString();
  const report = {
    generatedAt: finishedAt,
    startedAt,
    mode: "full-supervisor",
    reportOnly: true,
    totals: {
      shards: defaultTasks.length,
      shardFailures: failedShards.length,
      finalizerRan: finalizerResult !== null,
      finalizerFailed: finalizerResult ? Number(finalizerResult.code !== 0) : 0,
      concurrency,
    },
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Shard workers run packet-only",
      "Finalizer runs meta-only after shard success",
    ],
    shardResults: shardResults.map((result) => ({
      key: result.key,
      kind: result.kind,
      code: result.code,
      lastLine: result.output.trim().split("\n").filter(Boolean).at(-1) ?? "",
    })),
    finalizerResult: finalizerResult
      ? {
          key: finalizerResult.key,
          code: finalizerResult.code,
          lastLine: finalizerResult.output.trim().split("\n").filter(Boolean).at(-1) ?? "",
        }
      : null,
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "report-supervisor-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Report Supervisor",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Runs all default report-only shard workers in parallel, then runs a single meta-only finalizer if every shard succeeds.",
    "",
    "## Totals",
    "",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
    "",
    "## Shards",
    "",
    "| key | kind | status | last line |",
    "| --- | --- | --- | --- |",
    ...report.shardResults.map((row) => `| ${row.key} | ${row.kind} | ${row.code === 0 ? "ok" : "failed"} | ${row.lastLine.replace(/\|/g, "\\|")} |`),
    "",
    "## Finalizer",
    "",
    report.finalizerResult
      ? `- status: ${report.finalizerResult.code === 0 ? "ok" : "failed"}`
      : "- skipped: one or more shard workers failed",
    report.finalizerResult ? `- lastLine: ${report.finalizerResult.lastLine}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);

  if (failedShards.length > 0 || (finalizerResult && finalizerResult.code !== 0)) {
    process.exitCode = 1;
  }

  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(
    `report-supervisor: shards=${defaultTasks.length}, shardFailures=${failedShards.length}, finalizerRan=${finalizerResult !== null}, finalizerFailed=${finalizerResult ? Number(finalizerResult.code !== 0) : 0}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
