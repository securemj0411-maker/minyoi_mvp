import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { registryPacketGroups, summarizeRegistryPhases, summarizeRegistryTags } from "./lib/report-packet-registry";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const phaseSummary = summarizeRegistryPhases(registryPacketGroups);
  const tagSummary = summarizeRegistryTags(registryPacketGroups);

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "registry phase and tag summary",
    summary: {
      groups: registryPacketGroups.length,
      packets: registryPacketGroups.reduce((sum, group) => sum + group.scripts.length, 0),
      phases: phaseSummary.length,
      tags: tagSummary.length,
    },
    phaseSummary,
    tagSummary,
    guardrails: [
      "Metadata-only structural report",
      "No runtime parser wiring",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-registry-phase-tag-summary-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Parser Registry Phase and Tag Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- groups: ${report.summary.groups}`,
    `- packets: ${report.summary.packets}`,
    `- phases: ${report.summary.phases}`,
    `- tags: ${report.summary.tags}`,
    "",
    "## Phase Summary",
    "",
    "| phase | groups | packets | categories |",
    "| --- | ---: | ---: | --- |",
    ...phaseSummary.map((row) => `| ${row.phase} | ${row.groups} | ${row.packets} | ${row.categories.join(", ")} |`),
    "",
    "## Tag Summary",
    "",
    "| tag | groups | packets |",
    "| --- | ---: | ---: |",
    ...tagSummary.map((row) => `| ${row.tag} | ${row.groups} | ${row.packets} |`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-registry-phase-tag-summary-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-registry-phase-tag-summary-latest.json");
  console.log("wrote reports/parser-registry-phase-tag-summary-latest.md");
  console.log(`registry phase-tag groups=${report.summary.groups}; packets=${report.summary.packets}; tags=${report.summary.tags}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
