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

const blockerPatterns = {
  boxBlocker: /(박스|풀박스|충전기\s*선|충전\s*케이블|충전기|케이블|설명서)/,
  cosmeticWearBlocker: /(스크래치 조금|액정|상태|기스 하나 없|사용감 있음)/,
  strapBlocker: /(밴드|스트랩)/,
  ownerCareBlocker: /(항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|아껴서 사용|보관만|상태\s*s급|상태도 좋|깔끔한 상태)/,
  personalReasonBlocker: /(사용 빈도수 줄어서|갤럭시로 넘어가|한동안 안쓰다가|판매합니다|보관만 해놨고)/,
  pricePushBlocker: /(에눌가능|가격 낮춥니다|오늘까지만|편하게 연락주세요|쿨거시)/,
  nearlyNewBlocker: /(거의 새제품|새제품|실착\s*\d+번|3번도 착용 안하고)/,
  cellularBlocker: /(gps\s*\+\s*cellular|cellular|셀룰러|lte)/,
  premiumBundleBlocker: /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프)/,
  bodyOnlyBlocker: /(구성품\)\s*본체|본체\s*단품|시계\s*단품)/,
  completePackagingBlocker: /(구성품\s*모두\s*포함|설명서|박스,\s*충전\s*케이블|박스.*설명서)/,
} as const;

type BlockerKey = keyof typeof blockerPatterns;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
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

  const adjacentRows = baseRows.filter((row) => !coherentCore.has(String(row.pid ?? "")));
  const blockerHits = adjacentRows.map((row) => {
    const text = textFor(row);
    const hits = (Object.entries(blockerPatterns) as Array<[BlockerKey, RegExp]>)
      .filter(([, pattern]) => pattern.test(text))
      .map(([key]) => key);
    return {
      pid: String(row.pid ?? "-"),
      hits,
    };
  });

  const blockerCounts = Object.fromEntries(
    (Object.keys(blockerPatterns) as BlockerKey[]).map((key) => [
      key,
      blockerHits.filter((row) => row.hits.includes(key)).length,
    ]),
  ) as Record<BlockerKey, number>;

  const pairCount = (a: BlockerKey, b: BlockerKey): number =>
    blockerHits.filter((row) => row.hits.includes(a) && row.hits.includes(b)).length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_adjacent_wording_blocker_dominance_report_only",
    metrics: {
      adjacentRows: adjacentRows.length,
      boxBlockerRows: blockerCounts.boxBlocker,
      cosmeticWearBlockerRows: blockerCounts.cosmeticWearBlocker,
      strapBlockerRows: blockerCounts.strapBlocker,
      ownerCareBlockerRows: blockerCounts.ownerCareBlocker,
      personalReasonBlockerRows: blockerCounts.personalReasonBlocker,
      pricePushBlockerRows: blockerCounts.pricePushBlocker,
      nearlyNewBlockerRows: blockerCounts.nearlyNewBlocker,
      cellularBlockerRows: blockerCounts.cellularBlocker,
      premiumBundleBlockerRows: blockerCounts.premiumBundleBlocker,
      bodyOnlyBlockerRows: blockerCounts.bodyOnlyBlocker,
      completePackagingBlockerRows: blockerCounts.completePackagingBlocker,
      boxAndCosmeticOverlapRows: pairCount("boxBlocker", "cosmeticWearBlocker"),
      boxAndStrapOverlapRows: pairCount("boxBlocker", "strapBlocker"),
      boxAndOwnerCareOverlapRows: pairCount("boxBlocker", "ownerCareBlocker"),
      boxAndPersonalReasonOverlapRows: pairCount("boxBlocker", "personalReasonBlocker"),
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      boxBlockerPids: blockerHits.filter((row) => row.hits.includes("boxBlocker")).map((row) => row.pid),
      cosmeticWearBlockerPids: blockerHits.filter((row) => row.hits.includes("cosmeticWearBlocker")).map((row) => row.pid),
      strapBlockerPids: blockerHits.filter((row) => row.hits.includes("strapBlocker")).map((row) => row.pid),
      ownerCareBlockerPids: blockerHits.filter((row) => row.hits.includes("ownerCareBlocker")).map((row) => row.pid),
      personalReasonBlockerPids: blockerHits.filter((row) => row.hits.includes("personalReasonBlocker")).map((row) => row.pid),
      pricePushBlockerPids: blockerHits.filter((row) => row.hits.includes("pricePushBlocker")).map((row) => row.pid),
      cellularBlockerPids: blockerHits.filter((row) => row.hits.includes("cellularBlocker")).map((row) => row.pid),
      premiumBundleBlockerPids: blockerHits.filter((row) => row.hits.includes("premiumBundleBlocker")).map((row) => row.pid),
      completePackagingBlockerPids: blockerHits.filter((row) => row.hits.includes("completePackagingBlocker")).map((row) => row.pid),
    },
    policyImplications: [
      "This packet checks which wording blockers actually dominate the five Series9 adjacent rows instead of treating all adjacency noise as one bundle blob.",
      "If box plus cosmetic wear dominates while cellular and premium bundle stay narrow, the next guardrail should stay wording-first rather than broad carrier-first.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare the top blocker pair against future adjacent rows before changing any packaging penalty",
      "keep narrow one-off blockers like premium bundle and cellular separate from the dominant box-plus-cosmetic story",
    ],
    doNotDo: [
      "Do not treat blocker dominance as runtime approval",
      "Do not collapse all adjacent rows into one contamination class when the blocker mix is uneven",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blocker-dominance-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Adjacent Wording Blocker Dominance",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only blocker-dominance packet for the five Series9 adjacent rows.",
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
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blocker-dominance-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blocker-dominance-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-wording-blocker-dominance-latest.md");
  console.log(
    `applewatch series9 adjacent wording blocker dominance: adjacent=${adjacentRows.length}, box=${blockerCounts.boxBlocker}, cosmetic=${blockerCounts.cosmeticWearBlocker}, strap=${blockerCounts.strapBlocker}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
