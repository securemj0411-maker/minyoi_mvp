import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { registryPacketGroups } from "./lib/report-packet-registry";

const reportsDir = path.join(process.cwd(), "reports");

type CandidateHelper = {
  name: string;
  input: string;
  output: string;
  replaces: string[];
  status?: "implemented" | "candidate";
};

async function main(): Promise<void> {
  const helpers: CandidateHelper[] = [
    {
      name: "compilePacketArtifacts",
      input: "packet script basename list",
      output: "packet artifact rows (script/report/manifest identity)",
      replaces: ["repeated basename -> latestPhase/manifest derivation inside report-packet-registry.ts"],
      status: "implemented",
    },
    {
      name: "buildRegistryReadinessSteps",
      input: "registryPacketGroups[].scripts",
      output: "RegistryReadinessStep[]",
      replaces: ["manual readiness array spreading in report-parser-readiness-all.ts"],
      status: "candidate",
    },
    {
      name: "buildRegistryLatestPhaseFiles",
      input: "registryPacketGroups[].scripts",
      output: "string[] latestPhaseFiles",
      replaces: ["manual latestPhaseFiles aggregation in report-parser-report-only-audit.ts"],
      status: "candidate",
    },
    {
      name: "buildRegistryManifestFiles",
      input: "registryPacketGroups[].scripts",
      output: "string[] manifest markdown filenames",
      replaces: ["manual mustInclude expansion in report-parser-manifest-audit.ts"],
      status: "candidate",
    },
    {
      name: "buildRegistryCategoryEvidence",
      input: "registryPacketGroups[].category metadata + evidence specs",
      output: "category evidence rows",
      replaces: ["manual family/category stitching in report-parser-category-evidence-ledger.ts"],
      status: "candidate",
    },
  ];

  const rows = registryPacketGroups.map((group) => ({
    key: group.key,
    category: group.category,
    family: group.family,
    phase: group.phase,
    packetCount: group.scripts.length,
    compilerReadiness:
      group.scripts.length >= 3
        ? "good"
        : "thin",
    notes: group.notes.join(" "),
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "registry compiler candidate",
    summary: {
      groups: rows.length,
      packets: rows.reduce((sum, row) => sum + row.packetCount, 0),
      compilerReadyGroups: rows.filter((row) => row.compilerReadiness === "good").length,
      helpers: helpers.length,
      implementedHelpers: helpers.filter((helper) => helper.status === "implemented").length,
      candidateHelpers: helpers.filter((helper) => helper.status !== "implemented").length,
    },
    helpers,
    rows,
    deferred: [
      "No generic runner implementation yet",
      "No runtime parser wiring",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
    recommendation:
      "Start with helper-level compiler extraction for readiness/latestPhase/manifest/category-evidence generation before attempting a full generic packet runner.",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-registry-compiler-candidate-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Parser Registry Compiler Candidate",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- groups: ${report.summary.groups}`,
    `- packets: ${report.summary.packets}`,
    `- compiler-ready groups: ${report.summary.compilerReadyGroups}`,
    `- helpers: ${report.summary.helpers}`,
    `- implemented helpers: ${report.summary.implementedHelpers}`,
    `- candidate helpers: ${report.summary.candidateHelpers}`,
    "",
    "## Suggested Helpers",
    "",
    ...helpers.flatMap((helper) => [
      `### ${helper.name}`,
      `- status: ${helper.status ?? "candidate"}`,
      `- input: ${helper.input}`,
      `- output: ${helper.output}`,
      `- replaces: ${helper.replaces.join("; ")}`,
      "",
    ]),
    "## Group Readiness",
    "",
    "| key | category | family | phase | packets | compiler readiness |",
    "| --- | --- | --- | --- | ---: | --- |",
    ...rows.map(
      (row) =>
        `| ${row.key} | ${row.category} | ${row.family} | ${row.phase} | ${row.packetCount} | ${row.compilerReadiness} |`,
    ),
    "",
    "## Recommendation",
    "",
    report.recommendation,
    "",
    "## Deferred",
    "",
    ...report.deferred.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-registry-compiler-candidate-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-registry-compiler-candidate-latest.json");
  console.log("wrote reports/parser-registry-compiler-candidate-latest.md");
  console.log(
    `registry compiler groups=${report.summary.groups}; packets=${report.summary.packets}; helpers=${report.summary.candidateHelpers}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
