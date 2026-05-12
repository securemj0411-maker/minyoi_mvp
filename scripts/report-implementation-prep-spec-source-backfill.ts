import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvidenceGapRow = {
  category: string;
  caseId: string;
  expectedClass: "positive" | "hold" | "manual_review" | "split_only" | "ignore";
  inputTitle: string;
  evidenceStatus: string;
  requiredBeforeRuntime: boolean;
};

type EvidenceGapReport = {
  rows: EvidenceGapRow[];
};

type SourceBackfill = {
  category: string;
  caseId: string;
  inputTitle: string;
  product: string;
  sourceStatus: "official_source_found_report_only";
  sourceKind: "manufacturer_product_page" | "manufacturer_support_page" | "manufacturer_specs_page";
  sources: Array<{ label: string; url: string; retrievedAt: string; note: string }>;
  stillBlockedForRuntime: true;
  reasonStillBlocked: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const sourceBackfills: SourceBackfill[] = [
  {
    category: "headphone_discovered",
    caseId: "HEADPHONE-POS-03",
    inputTitle: "소니 xm5 헤드셋 판매합니다",
    product: "Sony WH-1000XM5",
    sourceStatus: "official_source_found_report_only",
    sourceKind: "manufacturer_specs_page",
    sources: [
      {
        label: "Sony UK - WH-1000XM5 Specifications",
        url: "https://www.sony.co.uk/electronics/headband-headphones/wh-1000xm5/specifications",
        retrievedAt: "2026-05-12",
        note: "Official Sony specification page identifies WH-1000XM5 as wireless noise cancelling headphones and lists battery/spec details.",
      },
    ],
    stillBlockedForRuntime: true,
    reasonStillBlocked: "Spec source is now identified, but runtime parser/catalog wiring still needs main approval and no-mutation dry run.",
  },
  {
    category: "headphone_discovered",
    caseId: "HEADPHONE-POS-04",
    inputTitle: "보스 QC 울트라 헤드폰 화이트 1세대",
    product: "Bose QuietComfort Ultra Headphones",
    sourceStatus: "official_source_found_report_only",
    sourceKind: "manufacturer_product_page",
    sources: [
      {
        label: "Bose - QuietComfort Ultra Headphones product page",
        url: "https://www.bose.com/p/headphones/bose-quietcomfort-ultra-headphones/QCUH-HEADPHONEARN-DPPLM-WW.html",
        retrievedAt: "2026-05-12",
        note: "Official Bose product page identifies QuietComfort Ultra Headphones and lists included accessories, battery, multipoint, and noise-cancelling features.",
      },
    ],
    stillBlockedForRuntime: true,
    reasonStillBlocked: "Source confirms product identity, but title wording such as generation/color still needs fixture policy review.",
  },
  {
    category: "headphone_discovered",
    caseId: "HEADPHONE-POS-05",
    inputTitle: "소니 WH-CH520 블루투스 무선 헤드폰",
    product: "Sony WH-CH520",
    sourceStatus: "official_source_found_report_only",
    sourceKind: "manufacturer_support_page",
    sources: [
      {
        label: "Sony Help Guide - WH-CH520 Specifications",
        url: "https://helpguide.sony.net/mdr/2958/v1/en/contents/TP1000783326.html",
        retrievedAt: "2026-05-12",
        note: "Official Sony help guide identifies the WH-CH520 wireless stereo headset and lists specifications.",
      },
    ],
    stillBlockedForRuntime: true,
    reasonStillBlocked: "Spec source is now identified, but runtime use still requires explicit narrow implementation approval.",
  },
  {
    category: "game_console_body_narrow",
    caseId: "GAME-CONSOLE-POS-03",
    inputTitle: "[2024년형/일본판] 닌텐도 스위치 라이트 핑크 본체",
    product: "Nintendo Switch Lite (HDH-001)",
    sourceStatus: "official_source_found_report_only",
    sourceKind: "manufacturer_specs_page",
    sources: [
      {
        label: "Nintendo - Switch technical specs",
        url: "https://www.nintendo.com/en-ca/gaming-systems/switch/tech-specs/",
        retrievedAt: "2026-05-12",
        note: "Official Nintendo technical specs page includes Nintendo Switch Lite model HDH-001 and hardware specifications.",
      },
    ],
    stillBlockedForRuntime: true,
    reasonStillBlocked: "Official specs exist, but region/year wording in marketplace titles should remain review-gated before runtime policy.",
  },
  {
    category: "game_console_body_narrow",
    caseId: "GAME-CONSOLE-POS-04",
    inputTitle: "닌텐도 스위치 배터리 개선판 본체 퍼플/오렌지 풀박스 s급",
    product: "Nintendo Switch HAC-001(-01)",
    sourceStatus: "official_source_found_report_only",
    sourceKind: "manufacturer_support_page",
    sources: [
      {
        label: "Nintendo Support - Battery duration by Switch model",
        url: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/46835/",
        retrievedAt: "2026-05-12",
        note: "Official Nintendo support page distinguishes HAC-001(-01) and lists its longer battery duration.",
      },
      {
        label: "Nintendo - Switch technical specs",
        url: "https://www.nintendo.com/en-ca/gaming-systems/switch/tech-specs/",
        retrievedAt: "2026-05-12",
        note: "Official Nintendo technical specs page lists Nintendo Switch console HAC-001(-01).",
      },
    ],
    stillBlockedForRuntime: true,
    reasonStillBlocked: "Source confirms model boundary, but only one local positive row exists; broader sample mining remains needed.",
  },
];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const gap = await readJson<EvidenceGapReport>(path.join(reportsDir, "subagent-implementation-prep-spec-evidence-gap-latest.json"));
  const missingPositive = gap.rows.filter((row) => row.expectedClass === "positive" && row.evidenceStatus === "missing_required_spec_source");
  const backfilledIds = new Set(sourceBackfills.map((row) => row.caseId));
  const stillMissing = missingPositive.filter((row) => !backfilledIds.has(row.caseId));

  const report = {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    scope: "Official/spec source backfill for missing positive evidence pointers",
    metrics: {
      missingPositiveBeforeBackfill: missingPositive.length,
      sourceBackfilledRows: sourceBackfills.length,
      stillMissingPositiveRows: stillMissing.length,
      runtimeApprovedRows: 0,
    },
    sourceBackfills,
    stillMissing,
    policy: [
      "Source backfill only closes evidence-pointer gaps; it does not approve runtime implementation.",
      "Rows remain blocked for runtime until main approval, no-mutation dry run, and selected category review.",
      "Older/current model specs should keep using official manufacturer/support pages where possible.",
    ],
    doNotDo: [
      "Do not update runtime catalog or parser files from this report.",
      "Do not promote candidate pool policy.",
      "Do not mutate production DB or Supabase schema.",
      "Do not edit 30일_실행계획.md from this subagent run.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "subagent-implementation-prep-spec-source-backfill-latest.json"), JSON.stringify(report, null, 2));

  const rows = sourceBackfills.map((row) => {
    const sources = row.sources.map((source) => `[${source.label}](${source.url})`).join("<br>");
    return `| ${row.category} | ${row.caseId} | ${row.product} | ${row.sourceKind} | ${sources} | ${row.reasonStillBlocked.replace(/\|/g, "/")} |`;
  });

  const md = [
    "# Subagent Implementation Prep Spec Source Backfill",
    "",
    `Generated: ${generatedAt}`,
    "",
    "Report-only source backfill for missing positive spec evidence. This does not approve runtime wiring.",
    "",
    "## Metrics",
    "",
    `- missing positive before backfill: ${report.metrics.missingPositiveBeforeBackfill}`,
    `- source-backfilled rows: ${report.metrics.sourceBackfilledRows}`,
    `- still missing positive rows: ${report.metrics.stillMissingPositiveRows}`,
    `- runtime-approved rows: ${report.metrics.runtimeApprovedRows}`,
    "",
    "## Source Backfills",
    "",
    "| category | case_id | product | source_kind | sources | still blocked reason |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "## Policy",
    "",
    ...report.policy.map((item) => `- ${item}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((item) => `- ${item}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "subagent-implementation-prep-spec-source-backfill-latest.md"), `${md}\n`);
  console.log("wrote reports/subagent-implementation-prep-spec-source-backfill-latest.json");
  console.log("wrote reports/subagent-implementation-prep-spec-source-backfill-latest.md");
  console.log(`spec source backfill: backfilled=${sourceBackfills.length}, still_missing=${stillMissing.length}, runtime_approved=0`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
