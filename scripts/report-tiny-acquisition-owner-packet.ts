import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports");

type ReadinessBoard = {
  lanes?: Array<{
    lane: string;
    fetched: number;
    activeClean: number;
    reviewRows: number;
    readiness: string;
    next: string;
    blocker: string;
    evidence: string;
  }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

async function main() {
  const board = readJson<ReadinessBoard>("exact-acquisition-readiness-board-latest.json", {});
  const approvedCandidates = (board.lanes ?? []).filter((lane) => lane.readiness === "owner_review_tiny_acquisition_design_ready");
  const heldCandidates = (board.lanes ?? []).filter((lane) => lane.readiness !== "owner_review_tiny_acquisition_design_ready");

  const executionContract = [
    "No broad category ready change.",
    "No public promotion or candidate-pool release from this packet alone.",
    "Before any future write, refetch detail in the same request and require active sale status.",
    "Write cap must be lane-specific and no higher than the active-clean count in this packet.",
    "Bundle rows, sold/inactive rows, accessory/parts/damaged rows stay excluded.",
    "Any executor must be internal-only and must write an audit report before touching Supabase.",
  ];

  const output = {
    generatedAt: new Date().toISOString(),
    scope: "tiny_acquisition_owner_packet",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    approvedCandidates,
    heldCandidates,
    executionContract,
    decision:
      "Only lanes listed in Owner-Review Candidates are suitable for owner-reviewed tiny internal acquisition design. All other inspected lanes remain no-write.",
  };

  const md = [
    "# Tiny Acquisition Owner Packet",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    "",
    "## Owner-Review Candidates",
    "",
    "| lane | fetched | active clean | review/hold | evidence | max future write cap |",
    "| --- | ---: | ---: | ---: | --- | ---: |",
    ...approvedCandidates.map((lane) =>
      `| ${lane.lane} | ${lane.fetched} | ${lane.activeClean} | ${lane.reviewRows} | ${lane.evidence} | ${lane.activeClean} |`,
    ),
    "",
    "## Held Lanes",
    "",
    "| lane | active clean | reason | next |",
    "| --- | ---: | --- | --- |",
    ...heldCandidates.map((lane) => `| ${lane.lane} | ${lane.activeClean} | ${lane.blocker} | ${lane.next} |`),
    "",
    "## Execution Contract",
    "",
    ...executionContract.map((item) => `- ${item}`),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "tiny-acquisition-owner-packet-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "tiny-acquisition-owner-packet-latest.md"), md);
  console.log("wrote reports/tiny-acquisition-owner-packet-latest.json");
  console.log("wrote reports/tiny-acquisition-owner-packet-latest.md");
  console.log(JSON.stringify({ approved: approvedCandidates.map((lane) => lane.lane), held: heldCandidates.map((lane) => lane.lane) }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
