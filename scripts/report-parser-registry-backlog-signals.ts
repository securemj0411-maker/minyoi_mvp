import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildRegistryBacklogSignalRows, sortRegistryBacklogSignalRows } from "./lib/report-registry-backlog-context";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const sorted = sortRegistryBacklogSignalRows(buildRegistryBacklogSignalRows());

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "registry backlog signals",
    summary: {
      groups: sorted.length,
      highestScore: sorted[0]?.severityScore ?? 0,
      positiveDensityGroups: sorted.filter((row) => row.phase === "positive-density").length,
      holdLaneGroups: sorted.filter((row) => row.lane === "hold").length,
    },
    rows: sorted,
    interpretation: [
      "positive-density groups with hold-heavy narrative should stay top backlog candidates",
      "boundary groups can remain lower-priority unless they block parser or review routing quality",
      "this is a report-only prioritization aid, not runtime approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-registry-backlog-signals-latest.json"), JSON.stringify(report, null, 2));

  const md = [
    "# Parser Registry Backlog Signals",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `- groups: ${report.summary.groups}`,
    `- highest score: ${report.summary.highestScore}`,
    `- positive-density groups: ${report.summary.positiveDensityGroups}`,
    `- hold-lane groups: ${report.summary.holdLaneGroups}`,
    "",
    "| key | category | family | phase | lane | packets | score |",
    "| --- | --- | --- | --- | --- | ---: | ---: |",
    ...sorted.map(
      (row) =>
        `| ${row.key} | ${row.category} | ${row.family} | ${row.phase} | ${row.lane} | ${row.packets} | ${row.severityScore} |`,
    ),
    "",
    "## Interpretation",
    "",
    ...report.interpretation.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-registry-backlog-signals-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-registry-backlog-signals-latest.json");
  console.log("wrote reports/parser-registry-backlog-signals-latest.md");
  console.log(
    `registry backlog groups=${report.summary.groups}; positive_density=${report.summary.positiveDensityGroups}; hold_lanes=${report.summary.holdLaneGroups}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
