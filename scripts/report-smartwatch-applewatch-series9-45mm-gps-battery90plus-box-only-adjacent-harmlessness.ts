import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
};

type OverlapReport = {
  overlapPids?: Record<string, Array<string | number>>;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스만|보호필름|스트랩만|충전독|호환)/;
const generationPattern = /(series\s*9|시리즈\s*9|애플워치\s*9)/;
const sizePattern = /\b45mm\b/;
const gpsPattern = /\bgps\b/;
const batteryPattern = /(배터리\s*(?:9[0-9]%|100%|90)|배터리.*(?:9[0-9]%|100%)|90퍼|100프로)/;
const premiumPattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프)/;
const strapPattern = /(밴드|스트랩)/;
const boxPattern = /(박스|풀박스|충전기|케이블|설명서)/;
const chargerOnlyPattern = /(충전기\s*선|충전\s*케이블|충전기|케이블)/;
const completePackagingPattern = /(구성품\s*모두\s*포함|설명서|박스,\s*충전\s*케이블|박스.*설명서|사진에서 보시는 것처럼)/;
const ownerCarePattern = /(항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|아껴서 사용|깔끔한 상태)/;
const conditionPattern = /(배터리|스크래치 조금|액정|상태|사용감 있음)/;
const personalReasonPattern = /(사용 빈도수 줄어서|갤럭시로 넘어가|한동안 안쓰다가|판매합니다)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function residualTextFor(sample: Sample): string {
  return textFor(sample)
    .replace(new RegExp(boxPattern.source, "g"), " ")
    .replace(/[+"'()!,:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const overlap = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-clean-overlap-latest.json"), "utf8"),
  ) as OverlapReport;
  const coherentCore = new Set((overlap.overlapPids?.allThree ?? []).map((pid) => String(pid)));

  const baseRows = samples.filter((sample) => {
    const text = textFor(sample);
    return !globalExclude.test(text) &&
      generationPattern.test(text) &&
      sizePattern.test(text) &&
      gpsPattern.test(text) &&
      batteryPattern.test(text);
  });

  const coherentCoreRows = baseRows.filter((row) => coherentCore.has(String(row.pid ?? "")));
  const boxOnlyAdjacentRows = baseRows.filter((row) => {
    const text = textFor(row);
    return !coherentCore.has(String(row.pid ?? "")) &&
      boxPattern.test(text) &&
      !premiumPattern.test(text) &&
      !strapPattern.test(text) &&
      !/(cellular|셀룰러|lte)/.test(text);
  });

  const lightPackagingRows = boxOnlyAdjacentRows.filter((row) => {
    const text = textFor(row);
    return chargerOnlyPattern.test(text) && !completePackagingPattern.test(text) && !/박스/.test(text);
  });
  const completePackagingRows = boxOnlyAdjacentRows.filter((row) => completePackagingPattern.test(textFor(row)));
  const ownerCarePackagingRows = boxOnlyAdjacentRows.filter((row) => ownerCarePattern.test(residualTextFor(row)));
  const personalReasonPackagingRows = boxOnlyAdjacentRows.filter((row) => personalReasonPattern.test(residualTextFor(row)));
  const residualConditionPackagingRows = boxOnlyAdjacentRows.filter((row) => conditionPattern.test(residualTextFor(row)));
  const packagingHarmlessCandidateRows = boxOnlyAdjacentRows.filter((row) => {
    const residual = residualTextFor(row);
    return !completePackagingPattern.test(textFor(row)) &&
      conditionPattern.test(residual) &&
      !ownerCarePattern.test(residual) &&
      !personalReasonPattern.test(residual);
  });
  const packagingStillNoisyRows = boxOnlyAdjacentRows.filter((row) => {
    const residual = residualTextFor(row);
    return completePackagingPattern.test(textFor(row)) ||
      ownerCarePattern.test(residual) ||
      personalReasonPattern.test(residual);
  });

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_box_only_adjacent_harmlessness_report_only",
    metrics: {
      baseRows: baseRows.length,
      coherentCoreRows: coherentCoreRows.length,
      boxOnlyAdjacentRows: boxOnlyAdjacentRows.length,
      lightPackagingRows: lightPackagingRows.length,
      completePackagingRows: completePackagingRows.length,
      ownerCarePackagingRows: ownerCarePackagingRows.length,
      personalReasonPackagingRows: personalReasonPackagingRows.length,
      residualConditionPackagingRows: residualConditionPackagingRows.length,
      packagingHarmlessCandidateRows: packagingHarmlessCandidateRows.length,
      packagingStillNoisyRows: packagingStillNoisyRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      coherentCorePids: coherentCoreRows.map((row) => row.pid ?? "-"),
      boxOnlyAdjacentPids: boxOnlyAdjacentRows.map((row) => row.pid ?? "-"),
      lightPackagingPids: lightPackagingRows.map((row) => row.pid ?? "-"),
      completePackagingPids: completePackagingRows.map((row) => row.pid ?? "-"),
      ownerCarePackagingPids: ownerCarePackagingRows.map((row) => row.pid ?? "-"),
      personalReasonPackagingPids: personalReasonPackagingRows.map((row) => row.pid ?? "-"),
      residualConditionPackagingPids: residualConditionPackagingRows.map((row) => row.pid ?? "-"),
      packagingHarmlessCandidatePids: packagingHarmlessCandidateRows.map((row) => row.pid ?? "-"),
      packagingStillNoisyPids: packagingStillNoisyRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet tests whether the two Series9 box-only adjacent rows are harmless light-packaging neighbors or still noisy full-packaging context.",
      "If only one row survives as a light-packaging harmless candidate while the other stays complete-packaging noisy, packaging-only adjacency should keep a split penalty instead of one blanket rule.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare the light-packaging harmless candidate directly against the coherent core before discussing any softer packaging penalty",
      "keep complete-packaging rows separate so full-set adjacency does not backdoor its way into the clean lane",
    ],
    doNotDo: [
      "Do not treat all box-only adjacency as harmless from this packet alone",
      "Do not merge complete-packaging rows into the coherent clean lane",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-only-adjacent-harmlessness-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Box-Only Adjacent Harmlessness",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only harmlessness split for the two Series9 box-only adjacent rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Lane Samples",
    "",
    ...Object.entries(report.laneSamples).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-box-only-adjacent-harmlessness-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-box-only-adjacent-harmlessness-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-box-only-adjacent-harmlessness-latest.md");
  console.log(
    `applewatch series9 box-only harmlessness: box_only=${boxOnlyAdjacentRows.length}, light_packaging=${lightPackagingRows.length}, complete_packaging=${completePackagingRows.length}, harmless=${packagingHarmlessCandidateRows.length}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
