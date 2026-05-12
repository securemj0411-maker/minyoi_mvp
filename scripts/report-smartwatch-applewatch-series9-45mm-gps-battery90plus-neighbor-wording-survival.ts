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
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기\s*선|충전\s*케이블|충전기|케이블|설명서|풀박스|박스)/;
const cellularPattern = /(gps\s*\+\s*cellular|cellular|셀룰러|lte)/;
const bodyCarrierPattern = /(본체\+충전기|구성품\)\s*본체)/;
const bundleReplacePattern = new RegExp(bundlePattern.source, "g");
const cellularReplacePattern = new RegExp(cellularPattern.source, "g");
const bodyCarrierReplacePattern = new RegExp(bodyCarrierPattern.source, "g");
const ownerCarePattern = /(항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|아껴서 사용|보관만|실착\s*\d+번|상태\s*s급|상태도 좋|깔끔한 상태)/;
const conditionPattern = /(배터리|사용감 있음|스크래치 조금|기스 하나 없|액정|상태|실착\s*\d+번|거의 새제품|새제품)/;
const personalReasonPattern = /(사용 빈도수 줄어서|갤럭시로 넘어가|한동안 안쓰다가|판매합니다|보관만 해놨고)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function residualTextFor(sample: Sample): string {
  return textFor(sample)
    .replace(cellularReplacePattern, " ")
    .replace(bundleReplacePattern, " ")
    .replace(bodyCarrierReplacePattern, " ")
    .replace(/[+"'()!]/g, " ")
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
  const adjacentRows = baseRows.filter((row) => !coherentCore.has(String(row.pid ?? "")));

  const residualNeighborRows = adjacentRows.filter((row) => {
    const residual = residualTextFor(row);
    return ownerCarePattern.test(residual) || conditionPattern.test(residual) || personalReasonPattern.test(residual);
  });
  const residualOwnerCareRows = adjacentRows.filter((row) => ownerCarePattern.test(residualTextFor(row)));
  const residualConditionRows = adjacentRows.filter((row) => conditionPattern.test(residualTextFor(row)));
  const residualPersonalReasonRows = adjacentRows.filter((row) => personalReasonPattern.test(residualTextFor(row)));
  const residualMultiSignalRows = adjacentRows.filter((row) => {
    const residual = residualTextFor(row);
    const signals = [
      ownerCarePattern.test(residual),
      conditionPattern.test(residual),
      personalReasonPattern.test(residual),
    ].filter(Boolean);
    return signals.length >= 2;
  });
  const residualThinRows = adjacentRows.filter((row) => {
    const residual = residualTextFor(row);
    return !ownerCarePattern.test(residual) && !conditionPattern.test(residual) && !personalReasonPattern.test(residual);
  });
  const bundleCarrierRows = adjacentRows.filter((row) => bundlePattern.test(textFor(row)));
  const cellularCarrierRows = adjacentRows.filter((row) => cellularPattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_neighbor_wording_survival_report_only",
    metrics: {
      baseRows: baseRows.length,
      coherentCoreRows: coherentCoreRows.length,
      adjacentRows: adjacentRows.length,
      residualNeighborRows: residualNeighborRows.length,
      residualOwnerCareRows: residualOwnerCareRows.length,
      residualConditionRows: residualConditionRows.length,
      residualPersonalReasonRows: residualPersonalReasonRows.length,
      residualMultiSignalRows: residualMultiSignalRows.length,
      residualThinRows: residualThinRows.length,
      bundleCarrierRows: bundleCarrierRows.length,
      cellularCarrierRows: cellularCarrierRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      coherentCorePids: coherentCoreRows.map((row) => row.pid ?? "-"),
      residualNeighborPids: residualNeighborRows.map((row) => row.pid ?? "-"),
      residualOwnerCarePids: residualOwnerCareRows.map((row) => row.pid ?? "-"),
      residualConditionPids: residualConditionRows.map((row) => row.pid ?? "-"),
      residualPersonalReasonPids: residualPersonalReasonRows.map((row) => row.pid ?? "-"),
      residualMultiSignalPids: residualMultiSignalRows.map((row) => row.pid ?? "-"),
      residualThinPids: residualThinRows.map((row) => row.pid ?? "-"),
      bundleCarrierPids: bundleCarrierRows.map((row) => row.pid ?? "-"),
      cellularCarrierPids: cellularCarrierRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether non-bundle and non-cellular neighboring wording still survives after stripping accessory and connectivity payload around the coherent Series9 core.",
      "If residual neighbor rows remain dense, the lane may still be narratively coherent even when bundle pressure prevents clean-candidate counts from surviving.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare residual multi-signal rows against the coherent core before deciding whether any softer bundle penalty is worth discussing",
      "keep residual wording survival separate from clean-candidate counts so bundle contamination does not get silently normalized",
    ],
    doNotDo: [
      "Do not treat residual wording survival as runtime approval",
      "Do not collapse bundle-carrier rows into the coherent clean lane just because residual owner-care wording survives",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Neighbor Wording Survival",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only survival packet for neighboring wording after stripping bundle and cellular payload from Series9 adjacent rows.",
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
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-neighbor-wording-survival-latest.md");
  console.log(
    `applewatch series9 neighbor wording survival: adjacent=${adjacentRows.length}, residual_neighbor=${residualNeighborRows.length}, residual_multi=${residualMultiSignalRows.length}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
