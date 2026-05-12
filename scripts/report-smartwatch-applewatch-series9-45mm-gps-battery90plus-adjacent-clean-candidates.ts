import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string | number;
  title?: string;
  name?: string;
  description?: string;
  seller?: {
    review_count?: number | null;
    sales_count?: number | null;
    proshop?: boolean | null;
    is_official?: boolean | null;
  };
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
const ownerCarePattern = /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음|아껴서 사용|상태 좋)/;
const bundlePattern = /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩|충전기|케이블|박스|풀박스|설명서)/;
const cellularPattern = /(cellular|셀룰러|lte)/;
const bodyOnlyPattern = /(구성품\)\s*본체|본체\s*단품|시계\s*단품)/;
const explicitBoxlessPattern = /(박스\s*(?:및\s*충전기\s*)?없이|박스\s*없|풀박스\s*아님|구성품\)\s*본체|본체\s*단품|시계\s*단품)/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function titleFor(sample: Sample): string {
  return normalize(sample.title ?? sample.name ?? "");
}

function descriptionFor(sample: Sample): string {
  return normalize(sample.description ?? "");
}

function textFor(sample: Sample): string {
  return normalize(`${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`);
}

function merchantLike(sample: Sample): boolean {
  const seller = sample.seller ?? {};
  return Boolean(
    seller.proshop ||
      seller.is_official ||
      Number(seller.review_count ?? 0) >= 30 ||
      Number(seller.sales_count ?? 0) >= 30,
  );
}

function hasDescriptionSignal(sample: Sample): boolean {
  const title = titleFor(sample);
  const description = descriptionFor(sample);
  return (
    (!batteryPattern.test(title) && batteryPattern.test(description)) ||
    (!gpsPattern.test(title) && gpsPattern.test(description))
  );
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
  const adjacentCleanCandidateRows = adjacentRows.filter((row) =>
    !merchantLike(row) &&
    !bundlePattern.test(textFor(row)) &&
    !cellularPattern.test(textFor(row)),
  );
  const adjacentOwnerCareRows = adjacentCleanCandidateRows.filter((row) => ownerCarePattern.test(textFor(row)));
  const adjacentDescriptionSignalRows = adjacentCleanCandidateRows.filter((row) => hasDescriptionSignal(row));
  const adjacentBodyOnlyRows = adjacentCleanCandidateRows.filter((row) => bodyOnlyPattern.test(textFor(row)));
  const adjacentBoxlessRows = adjacentCleanCandidateRows.filter((row) => explicitBoxlessPattern.test(textFor(row)));
  const adjacentBundleRows = adjacentRows.filter((row) => bundlePattern.test(textFor(row)));
  const adjacentCellularRows = adjacentRows.filter((row) => cellularPattern.test(textFor(row)));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_adjacent_clean_candidates_report_only",
    metrics: {
      baseRows: baseRows.length,
      coherentCoreRows: baseRows.filter((row) => coherentCore.has(String(row.pid ?? ""))).length,
      adjacentCleanCandidateRows: adjacentCleanCandidateRows.length,
      adjacentOwnerCareRows: adjacentOwnerCareRows.length,
      adjacentDescriptionSignalRows: adjacentDescriptionSignalRows.length,
      adjacentBodyOnlyRows: adjacentBodyOnlyRows.length,
      adjacentBoxlessRows: adjacentBoxlessRows.length,
      adjacentBundleRows: adjacentBundleRows.length,
      adjacentCellularRows: adjacentCellularRows.length,
      runtimeApprovedRows: 0,
    },
    laneSamples: {
      coherentCorePids: baseRows.filter((row) => coherentCore.has(String(row.pid ?? ""))).map((row) => row.pid ?? "-"),
      adjacentCleanCandidatePids: adjacentCleanCandidateRows.map((row) => row.pid ?? "-"),
      adjacentOwnerCarePids: adjacentOwnerCareRows.map((row) => row.pid ?? "-"),
      adjacentDescriptionSignalPids: adjacentDescriptionSignalRows.map((row) => row.pid ?? "-"),
      adjacentBodyOnlyPids: adjacentBodyOnlyRows.map((row) => row.pid ?? "-"),
      adjacentBoxlessPids: adjacentBoxlessRows.map((row) => row.pid ?? "-"),
      adjacentBundlePids: adjacentBundleRows.map((row) => row.pid ?? "-"),
      adjacentCellularPids: adjacentCellularRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether Series9 45mm GPS battery90+ has any near-coherent adjacent rows once the exact clean-overlap core PID is removed.",
      "If adjacent clean candidates remain at zero while bundle rows dominate, the lane is coherent but still too thin to treat as naturally thickening personal-used inventory.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "keep testing adjacent clean candidates separately from bundle-heavy rows before any Series9 confidence discussion",
      "if adjacent bundle rows stay dense, split light bundle and premium bundle again instead of inflating the clean adjacency story",
    ],
    doNotDo: [
      "Do not merge the coherent core PID back into adjacency counts",
      "Do not treat adjacent bundle or cellular rows as runtime-approved clean candidates",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates-latest.json"),
    JSON.stringify(report, null, 2),
  );
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Adjacent Clean Candidates",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only adjacent clean-candidate packet for Series9 45mm GPS battery90+ rows after removing the exact coherent core PID.",
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
    path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates-latest.md"),
    `${md}\n`,
  );
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-adjacent-clean-candidates-latest.md");
  console.log(
    `applewatch series9 adjacent clean candidates: base=${baseRows.length}, coherent_core=${report.metrics.coherentCoreRows}, adjacent_clean=${adjacentCleanCandidateRows.length}, bundle=${adjacentBundleRows.length}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
