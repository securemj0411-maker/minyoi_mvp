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

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "applewatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");
const globalExclude = /(삽니다|구매|매입|교환|부품용|고장|파손|수리|케이스만|보호필름|스트랩만|충전독|호환)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const rows = samples.filter((sample) => {
    const t = textFor(sample);
    return !globalExclude.test(t)
      && /(series\s*9|시리즈\s*9|애플워치\s*9)/.test(t)
      && /\b45mm\b/.test(t)
      && /\bgps\b/.test(t)
      && /(배터리\s*9[0-9]%|배터리\s*100%|배터리\s*90)/.test(t);
  });

  const lightBundleOnlyRows = rows.filter((row) => /(박스|충전기|케이블|풀박스)/.test(textFor(row)) && !/(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩)/.test(textFor(row)));
  const premiumBundleRows = rows.filter((row) => /(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩)/.test(textFor(row)));
  const ownerCareRows = rows.filter((row) => /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음)/.test(textFor(row)));
  const ownerCareNoPremiumRows = rows.filter((row) => /(사용 빈도수 줄어서|항상 케이스|기스 없음|스크래치 없음|관리 잘|깨끗하게 사용|실사용|사용감 있음)/.test(textFor(row)) && !/(애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩)/.test(textFor(row)));
  const personalUseReasonRows = rows.filter((row) => /(사용 빈도수 줄어서|넘어감|갈아타|판매합니다|처분)/.test(textFor(row)));
  const unopenedOrCellularRows = rows.filter((row) => /(미개봉|새상품|새제품|미사용|cellular|셀룰러|lte)/.test(textFor(row)));
  const cleanNoBundleRows = rows.filter((row) =>
    !( /(박스|충전기|케이블|풀박스|애케플|케어플러스|정품\s*스트랩|밀레니즈|루프|밴드|스트랩)/.test(textFor(row)) ) &&
    !( /(미개봉|새상품|새제품|미사용|cellular|셀룰러|lte)/.test(textFor(row)) )
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "applewatch",
    decision: "applewatch_series9_45mm_gps_battery90plus_owner_care_bundle_split_report_only",
    metrics: {
      totalRows: rows.length,
      lightBundleOnlyRows: lightBundleOnlyRows.length,
      premiumBundleRows: premiumBundleRows.length,
      ownerCareRows: ownerCareRows.length,
      ownerCareNoPremiumRows: ownerCareNoPremiumRows.length,
      personalUseReasonRows: personalUseReasonRows.length,
      unopenedOrCellularRows: unopenedOrCellularRows.length,
      cleanNoBundleRows: cleanNoBundleRows.length,
      runtimeApprovedRows: 0,
    },
    samplePidsByLane: {
      lightBundleOnly: lightBundleOnlyRows.map((row) => row.pid ?? "-"),
      premiumBundle: premiumBundleRows.map((row) => row.pid ?? "-"),
      ownerCare: ownerCareRows.map((row) => row.pid ?? "-"),
      ownerCareNoPremium: ownerCareNoPremiumRows.map((row) => row.pid ?? "-"),
      personalUseReason: personalUseReasonRows.map((row) => row.pid ?? "-"),
      cleanNoBundle: cleanNoBundleRows.map((row) => row.pid ?? "-"),
    },
    policyImplications: [
      "This packet checks whether Series9 health comes from real owner-care/personal-use context or is just being flattened by everyday light-bundle wording.",
      "If owner-care without premium-bundle pressure survives, Series9 becomes a stronger next thickening target than its tiny raw row count suggests.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "compare owner-care-no-premium rows against clean body-only rows before any confidence discussion",
      "keep premium bundle rows separate so AppleCare/strap pressure does not inflate the lane",
    ],
    doNotDo: [
      "Do not treat all bundle rows as contamination of the same kind",
      "Do not promote Series9 from this packet alone",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Apple Watch Series9 45mm GPS Battery90+ Owner-Care Bundle Split",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only owner-care vs light/premium bundle split for Series9 45mm GPS battery90+ rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Sample PIDs By Lane",
    "",
    ...Object.entries(report.samplePidsByLane).map(([k, v]) => `- ${k}: ${(v as Array<string | number>).join(", ") || "-"}`),
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
  await writeFile(path.join(reportsDir, "smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.json");
  console.log("wrote reports/smartwatch-applewatch-series9-45mm-gps-battery90plus-owner-care-bundle-split-latest.md");
  console.log(`applewatch series9 owner-care split: total=${rows.length}, owner_care_no_premium=${ownerCareNoPremiumRows.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
