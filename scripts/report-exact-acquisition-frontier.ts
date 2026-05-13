import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Lane = {
  lane: string;
  fetched: number;
  activeClean: number;
  reviewRows: number;
  readiness: string;
  next: string;
  blocker: string;
  evidence: string;
};

type Board = {
  lanes?: Lane[];
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function activeRate(lane: Lane) {
  if (lane.fetched <= 0) return 0;
  return lane.activeClean / lane.fetched;
}

function bucket(lane: Lane) {
  if (lane.readiness === "owner_review_tiny_acquisition_design_ready") return "owner_review_ready";
  if (lane.activeClean >= 4) return "second_wave_candidate";
  if (/ai_l2|deterministic|connector|ambiguous/i.test(lane.readiness) || /AI L2|manual/i.test(lane.next)) return "ai_l2_or_manual";
  return "hold";
}

async function main() {
  const board = readJson<Board>("exact-acquisition-readiness-board-latest.json", {});
  const lanes = (board.lanes ?? []).map((lane) => ({
    ...lane,
    activeRate: activeRate(lane),
    bucket: bucket(lane),
  }));
  const byBucket = {
    owner_review_ready: lanes.filter((lane) => lane.bucket === "owner_review_ready"),
    second_wave_candidate: lanes.filter((lane) => lane.bucket === "second_wave_candidate"),
    ai_l2_or_manual: lanes.filter((lane) => lane.bucket === "ai_l2_or_manual"),
    hold: lanes.filter((lane) => lane.bucket === "hold"),
  };
  const output = {
    generatedAt: new Date().toISOString(),
    scope: "exact_acquisition_frontier",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    metrics: {
      lanes: lanes.length,
      ownerReviewReady: byBucket.owner_review_ready.length,
      secondWaveCandidates: byBucket.second_wave_candidate.length,
      aiL2OrManual: byBucket.ai_l2_or_manual.length,
      hold: byBucket.hold.length,
    },
    buckets: byBucket,
    decision:
      "Use owner_review_ready lanes as the only candidates for future owner-approved tiny internal acquisition design. All other lanes stay no-write until second-wave detail evidence or AI/manual policy exists.",
  };

  const section = (title: string, rows: typeof lanes) => [
    `## ${title}`,
    "",
    "| lane | fetched | active clean | active rate | readiness | blocker | next |",
    "| --- | ---: | ---: | ---: | --- | --- | --- |",
    ...rows
      .sort((a, b) => b.activeClean - a.activeClean || b.activeRate - a.activeRate)
      .map((lane) =>
        `| ${lane.lane} | ${lane.fetched} | ${lane.activeClean} | ${(lane.activeRate * 100).toFixed(1)}% | ${lane.readiness} | ${lane.blocker} | ${lane.next} |`,
      ),
    "",
  ].join("\n");

  const md = [
    "# Exact Acquisition Frontier",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- lanes: ${output.metrics.lanes}`,
    `- ownerReviewReady: ${output.metrics.ownerReviewReady}`,
    `- secondWaveCandidates: ${output.metrics.secondWaveCandidates}`,
    `- aiL2OrManual: ${output.metrics.aiL2OrManual}`,
    `- hold: ${output.metrics.hold}`,
    "",
    section("Owner Review Ready", byBucket.owner_review_ready),
    section("Second Wave Candidates", byBucket.second_wave_candidate),
    section("AI L2 Or Manual", byBucket.ai_l2_or_manual),
    section("Hold", byBucket.hold),
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "exact-acquisition-frontier-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "exact-acquisition-frontier-latest.md"), md);
  console.log("wrote reports/exact-acquisition-frontier-latest.json");
  console.log("wrote reports/exact-acquisition-frontier-latest.md");
  console.log(JSON.stringify(output.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
