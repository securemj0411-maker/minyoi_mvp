import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SpeakerExample = {
  pid?: string;
  title?: string;
  price?: number;
  family?: string;
};

type SpeakerBlockers = {
  category: string;
  genericExamples: SpeakerExample[];
};

const reportsDir = path.join(process.cwd(), "reports");

function exclusionClass(example: SpeakerExample): string {
  const title = example.title ?? "";
  if (/풀셋|우퍼|엠프|앰프|코엑셜/i.test(title)) return "bundle_or_component_mix";
  if (/cd\s?플레이어|휴대폰\s?거치대|오토바이|헬멧|마이크/i.test(title)) return "cross_device_or_accessory_mix";
  if (/라이즈|원빈|스누피|맛동산|클로바|프랜즈/i.test(title)) return "novelty_or_character_speaker";
  if (/jbl|오디오엔진|북쉘프/i.test(title)) return "brand_or_form_factor_without_model";
  return "generic_portable_speaker_no_model";
}

function countBy(items: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

async function main(): Promise<void> {
  const blockers = JSON.parse(
    await readFile(path.join(reportsDir, "speaker-family-blockers-latest.json"), "utf8"),
  ) as SpeakerBlockers;

  const rows = blockers.genericExamples.map((example) => ({
    ...example,
    exclusionClass: exclusionClass(example),
    action: "exclusion_test_candidate_only",
  }));
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: blockers.category,
    decision: "exclusion_candidate_only_report_no_wiring",
    sourceReports: ["speaker-family-blockers-latest.json", "speaker-device-class-review-latest.json"],
    metrics: {
      genericExampleRows: rows.length,
      positiveCandidateRows: 0,
      exclusionCandidateOnlyRows: rows.length,
      exclusionClassCounts: countBy(rows.map((row) => row.exclusionClass)),
    },
    rows,
    policyImplications: [
      "speaker-generic rows are exclusion-test candidates only and must not become comparable keys.",
      "Brand-only or form-factor-only rows still lack model identity.",
      "Bundle/component/cross-device rows must remain outside portable speaker candidate review.",
    ],
    nextReportOnlyExperiments: [
      "compare exclusion classes against reviewable portable speaker families",
      "prepare model-coded portable speaker subset conditions without candidate pool wiring",
      "keep speaker/audio runtime category split out of subagent scope",
    ],
    doNotDo: [
      "Do not promote speaker_audio_discovered",
      "Do not use speaker-generic family as comparable key",
      "Do not wire speaker exclusion candidates into runtime",
      "Do not merge amp_receiver, PA speaker, and portable speaker rows",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-generic-exclusion-readiness-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| pid | exclusion_class | action | title |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.pid ?? "-"} | ${row.exclusionClass} | ${row.action} | ${(row.title ?? "-").replace(/\|/g, "\\|")} |`),
  ].join("\n");

  const md = [
    "# Speaker Generic Exclusion Readiness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only speaker generic exclusion-candidate readiness. This is not runtime wiring and not public promotion.",
    "",
    table,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((line) => `- ${line}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((line) => `- ${line}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-generic-exclusion-readiness-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-generic-exclusion-readiness-latest.json");
  console.log("wrote reports/speaker-generic-exclusion-readiness-latest.md");
  console.log(`speaker generic exclusion readiness: exclusion_candidate_only=${rows.length}, positive_candidates=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
