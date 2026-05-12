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

type Packet = {
  scope: string;
  rows: number;
  merchantLikeRows: number;
  nonMerchantRows: number;
  activationRows: number;
  chargerIncludedRows: number;
  fullboxRows: number;
  cosmeticWearRows: number;
  samplePids: Array<string | number>;
  sampleTitles: string[];
  reportOnlyAction: string;
  runtimeApproved: false;
};

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "galaxywatch", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

const globalExclude = /(삽니다|구매|매입|부품용|고장|파손|케이스만|스트랩만|밴드만|충전기만|본체없음)/;
const accessoryOnlyTitle = /(케이스|스트랩|밴드|커버|필름)/;
const unopenedPressure = /(미개봉|새상품|새제품|미사용)/;
const personalStory = /(선물|실사용|사용감|몇번|집에서만|깨끗|기스|스크레치|초기화|풀충전|직거래|하자x|하자 x|눈에 띄는 하자)/;
const explicitBluetooth = /(블루투스|불루투스|bluetooth|wifi|와이파이)/;
const lteNegative = /(lte모델x|lte 모델x|lte 미지원|셀룰러 사용은 불가|블루투스로만|통신사것 아님|통신사 것 아님|블루투스용)/;
const activationFuture = /(가개통|6개월후|개통가능|개통 가능|유심|통신사|바로 개통 가능|개통하여 사용가능)/;
const accessoryBundle = /(스트랩|밴드|케이스|커버|필름|충전기|충전 케이블|액정커버|보호케이스|보호필름|풀박스)/;
const chargerIncluded = /(충전기포함|충전기 포함|충전기까지|박스 안에 충전기|충전 케이블)/;
const fullboxSignal = /(풀박스|풀박)/;
const cosmeticWear = /(긁힘|기스|스크레치)/;

function textFor(sample: Sample): string {
  return `${sample.title ?? sample.name ?? ""}\n${sample.description ?? ""}`.toLowerCase().replace(/\s+/g, " ");
}

function cleanTitle(sample: Sample): string {
  return (sample.title ?? sample.name ?? "-").replace(/\|/g, "\\|");
}

function merchantLike(sample: Sample): boolean {
  const s = sample.seller ?? {};
  return Boolean(s.proshop || s.is_official || Number(s.review_count ?? 0) >= 30 || Number(s.sales_count ?? 0) >= 30);
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const baseRows = samples.filter((sample) => {
    const text = textFor(sample);
    const title = (sample.title ?? sample.name ?? "").toLowerCase();
    return (
      /(갤럭시\s*워치\s*8|갤럭시워치8|galaxy\s*watch\s*8)/.test(text) &&
      /\b44mm\b|44m\b/.test(text) &&
      !/(클래식|classic|울트라|ultra)/.test(text) &&
      !globalExclude.test(text) &&
      !accessoryOnlyTitle.test(title) &&
      !unopenedPressure.test(text) &&
      (personalStory.test(text) || explicitBluetooth.test(text) || lteNegative.test(text) || activationFuture.test(text))
    );
  });

  const overlapRows = baseRows.filter((row) => accessoryBundle.test(textFor(row)));

  const packetDefs = [
    {
      scope: "watch8_44mm_overlap_activation_charger_nonmerchant",
      match: (sample: Sample) => {
        const text = textFor(sample);
        return accessoryBundle.test(text) && activationFuture.test(text) && chargerIncluded.test(text) && !merchantLike(sample);
      },
      reportOnlyAction: "keep as activation-future overlap only; charger inclusion here is not clean body evidence",
    },
    {
      scope: "watch8_44mm_overlap_merchant_ownercare_fullbox",
      match: (sample: Sample) => {
        const text = textFor(sample);
        return accessoryBundle.test(text) && fullboxSignal.test(text) && personalStory.test(text) && merchantLike(sample);
      },
      reportOnlyAction: "keep as merchant-like owner-care/fullbox overlap; do not merge into non-merchant clean residue",
    },
  ];

  const packets: Packet[] = packetDefs.map((def) => {
    const rows = overlapRows.filter((sample) => def.match(sample));
    return {
      scope: def.scope,
      rows: rows.length,
      merchantLikeRows: rows.filter(merchantLike).length,
      nonMerchantRows: rows.filter((row) => !merchantLike(row)).length,
      activationRows: rows.filter((row) => activationFuture.test(textFor(row))).length,
      chargerIncludedRows: rows.filter((row) => chargerIncluded.test(textFor(row))).length,
      fullboxRows: rows.filter((row) => fullboxSignal.test(textFor(row))).length,
      cosmeticWearRows: rows.filter((row) => cosmeticWear.test(textFor(row))).length,
      samplePids: rows.slice(0, 5).map((row) => row.pid ?? "-"),
      sampleTitles: rows.slice(0, 5).map(cleanTitle),
      reportOnlyAction: def.reportOnlyAction,
      runtimeApproved: false as const,
    };
  });

  const matchedPids = new Set(
    packets.flatMap((packet) => packet.samplePids.map((pid) => String(pid))),
  );
  const unmatchedOverlapRows = overlapRows.filter((row) => !matchedPids.has(String(row.pid ?? "-")));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    family: "galaxywatch",
    decision: "galaxywatch_watch8_44mm_overlap_context_split_report_only",
    metrics: {
      baseRows: baseRows.length,
      overlapRows: overlapRows.length,
      activationChargerNonMerchantRows: packets.find((row) => row.scope === "watch8_44mm_overlap_activation_charger_nonmerchant")?.rows ?? 0,
      merchantOwnerCareFullboxRows: packets.find((row) => row.scope === "watch8_44mm_overlap_merchant_ownercare_fullbox")?.rows ?? 0,
      activationWithCosmeticWearRows: overlapRows.filter((row) => activationFuture.test(textFor(row)) && cosmeticWear.test(textFor(row))).length,
      chargerIncludedRows: overlapRows.filter((row) => chargerIncluded.test(textFor(row))).length,
      fullboxRows: overlapRows.filter((row) => fullboxSignal.test(textFor(row))).length,
      merchantLikeRows: overlapRows.filter(merchantLike).length,
      nonMerchantRows: overlapRows.filter((row) => !merchantLike(row)).length,
      unmatchedOverlapRows: unmatchedOverlapRows.length,
      runtimeApprovedRows: 0,
    },
    packets,
    unmatchedOverlapPids: unmatchedOverlapRows.map((row) => row.pid ?? "-"),
    policyImplications: [
      "The current Watch8 44mm accessory overlap is not one problem: one row is activation-plus-charger pressure from a non-merchant seller, while the other is merchant-like owner-care fullbox pressure.",
      "Keeping these two overlap contexts separate is more useful than broadening the lane while clean residual remains zero.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "if more overlap rows arrive, split merchant-like fullbox rows by repeated seller template vs one-off owner-care wording",
      "pair activation-charger overlap rows with the connectivity conflict packet before any Watch8 parser discussion",
    ],
    doNotDo: [
      "Do not treat charger-included activation rows as clean body-support evidence",
      "Do not merge merchant-like fullbox overlap into non-merchant personal-clean residue",
      "Do not runtime-wire this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-overlap-context-split-latest.json"),
    JSON.stringify(report, null, 2),
  );

  const table = [
    "| scope | rows | merchant_like_rows | non_merchant_rows | activation_rows | charger_included_rows | fullbox_rows | cosmetic_wear_rows | report_only_action | sample_pids |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
    ...packets.map(
      (row) =>
        `| ${row.scope} | ${row.rows} | ${row.merchantLikeRows} | ${row.nonMerchantRows} | ${row.activationRows} | ${row.chargerIncludedRows} | ${row.fullboxRows} | ${row.cosmeticWearRows} | ${row.reportOnlyAction} | ${row.samplePids.join(", ")} |`,
    ),
  ].join("\n");

  const md = [
    "# Smartwatch Galaxy Watch8 44mm Overlap Context Split",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only split for the current Watch8 44mm activation/accessory overlap rows.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Packets",
    "",
    table,
    "",
    "## Unmatched Overlap PIDs",
    "",
    report.unmatchedOverlapPids.length > 0 ? report.unmatchedOverlapPids.map((pid) => `- ${pid}`).join("\n") : "- none",
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

  await writeFile(path.join(reportsDir, "smartwatch-galaxywatch-watch8-44mm-overlap-context-split-latest.md"), `${md}\n`);
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-overlap-context-split-latest.json");
  console.log("wrote reports/smartwatch-galaxywatch-watch8-44mm-overlap-context-split-latest.md");
  console.log(
    `watch8 44mm overlap context split: overlap=${report.metrics.overlapRows}, activation_charger_nonmerchant=${report.metrics.activationChargerNonMerchantRows}, merchant_ownercare_fullbox=${report.metrics.merchantOwnerCareFullboxRows}, unmatched=${report.metrics.unmatchedOverlapRows}, runtime_approved=0`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
