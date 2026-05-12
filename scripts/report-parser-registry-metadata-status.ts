import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { registryPacketGroups } from "./lib/report-packet-registry";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const rows = registryPacketGroups.map((group) => ({
    key: group.key,
    category: group.category,
    family: group.family,
    phase: group.phase,
    packetCount: group.scripts.length,
    tagCount: group.tags.length,
    noteCount: group.notes.length,
    hasTags: group.tags.length > 0,
    hasNotes: group.notes.length > 0,
  }));

  const phaseCounts = Object.entries(
    rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.phase] = (acc[row.phase] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([phase, count]) => ({ phase, count }));

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "registry packet metadata status",
    summary: {
      groups: rows.length,
      fullyAnnotatedGroups: rows.filter((row) => row.hasTags && row.hasNotes).length,
      totalPackets: rows.reduce((sum, row) => sum + row.packetCount, 0),
      phaseCounts,
    },
    rows,
    guardrails: [
      "Metadata-only structural report",
      "No runtime parser wiring",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-registry-metadata-status-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Parser Registry Metadata Status",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| key | category | family | phase | packets | tags | notes |",
    "| --- | --- | --- | --- | ---: | ---: | ---: |",
    ...rows.map(
      (row) =>
        `| ${row.key} | ${row.category} | ${row.family} | ${row.phase} | ${row.packetCount} | ${row.tagCount} | ${row.noteCount} |`,
    ),
    "",
    `- groups: ${report.summary.groups}`,
    `- fully annotated groups: ${report.summary.fullyAnnotatedGroups}`,
    `- total packets covered: ${report.summary.totalPackets}`,
    "",
    "## Phase Counts",
    "",
    ...phaseCounts.map((item) => `- ${item.phase}: ${item.count}`),
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-registry-metadata-status-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-registry-metadata-status-latest.json");
  console.log("wrote reports/parser-registry-metadata-status-latest.md");
  console.log(
    `registry metadata groups=${report.summary.groups}; fully_annotated=${report.summary.fullyAnnotatedGroups}; packets=${report.summary.totalPackets}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
