import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvidenceKind =
  | "console_body"
  | "bundle_package"
  | "accessory"
  | "game_software"
  | "marketplace_boundary"
  | "release_current_status";

type SourceTier = "official_nintendo" | "official_nintendo_support" | "internal_policy_fixture";

type EvidenceRow = {
  id: string;
  kind: EvidenceKind;
  title: string;
  sourceTier: SourceTier;
  sourceLabel: string;
  url: string | null;
  evidence: string;
  comparableKeyImplication: string;
  manualReviewBoundary: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type BoundaryRow = {
  gate: string;
  classification: "manual_review" | "hold";
  titleExamples: string[];
  sourceEvidenceIds: string[];
  decision: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePool: false;
  runtimeApply: false;
};

type OwnerPacket = {
  metrics?: Record<string, unknown>;
  ownerDecisionsRequired?: string[];
  fixtures?: Array<Record<string, unknown>>;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputJsonPath = path.join(reportsDir, "game-console-switch-2-source-backfill-latest.json");
const outputMdPath = path.join(reportsDir, "game-console-switch-2-source-backfill-latest.md");

const inputFiles = {
  governingWorkOrder: "reports/subagent-source-backfill-wave-2026-05-12.md",
  ownerDecisionPacketJson: "reports/game-console-switch-2-owner-decision-packet-latest.json",
  ownerDecisionPacketMd: "reports/game-console-switch-2-owner-decision-packet-latest.md",
  bodyEditionBoundaryEvidenceJson: "reports/game-console-body-edition-boundary-evidence-latest.json",
  contaminationEvidenceMatrixJson: "reports/game-console-contamination-evidence-matrix-latest.json",
};

const sourceUrls = {
  techSpecs: "https://www.nintendo.com/us/gaming-systems/switch-2/tech-specs/",
  supportSpecs:
    "https://en-americas-support.nintendo.com/app/answers/detail/a_id/68341/~/nintendo-switch%C2%A02-console-and-accessory-technical-specifications",
  marioKartBundle:
    "https://www.nintendo.com/us/store/products/nintendo-switch-2-mario-kart-world-digital-bundle-122179/?pubDate=20250418",
  launchToday:
    "https://www.nintendo.com/us/whatsnew/power-up-your-play-with-nintendo-switch-2-and-mario-kart-world-launching-today/",
  pricingNews:
    "https://www.nintendo.com/us/whatsnew/nintendo-maintains-nintendo-switch-2-pricing-retail-pre-orders-to-begin-april-24-in-u-s/",
  koreaMarioKart: "https://www.nintendo.com/kr/games/switch2/aaaaa/products/soft.html",
  koreaAccessories: "https://support.nintendo.com/kr/switch2/accessory/index.html",
};

const evidenceRows: EvidenceRow[] = [
  {
    id: "SWITCH2-SOURCE-001",
    kind: "console_body",
    title: "Nintendo Switch 2 console body identity",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo Switch 2 Tech Specs",
    url: sourceUrls.techSpecs,
    evidence:
      "Official specs identify Nintendo Switch 2 as the console body with Joy-Con 2 attached, 7.9-inch 1080p-class handheld/tabletop display behavior, HDMI TV output, built-in microphone, game-card slot, and microSD Express storage support.",
    comparableKeyImplication:
      "Supports a Switch 2 hardware-body family, but does not decide marketplace body_only vs full_set by itself.",
    manualReviewBoundary:
      "Keep Switch 2 console-body rows manual-review until the owner approves body_only/full_set evidence requirements.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-002",
    kind: "release_current_status",
    title: "Switch 2 launch/current status",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo launch-day news",
    url: sourceUrls.launchToday,
    evidence:
      "Nintendo announced on June 5, 2025 that Nintendo Switch 2, Mario Kart World, and over 20 titles were available; the US suggested retail price was $449.99.",
    comparableKeyImplication:
      "Switch 2 is a released/current hardware generation, not a speculative future token, but still remains owner-review gated in this repo.",
    manualReviewBoundary:
      "Release status removes future-product ambiguity, not bundle/body/accessory/software marketplace ambiguity.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-003",
    kind: "bundle_package",
    title: "Nintendo Switch 2 + Mario Kart World Bundle",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo official bundle product page",
    url: sourceUrls.marioKartBundle,
    evidence:
      "Official bundle includes Nintendo Switch 2 Console, Mario Kart World full game download, Joy-Con 2 L/R, AC adapter, USB-C charging cable, dock, Joy-Con 2 grip, straps, and Ultra High Speed HDMI cable.",
    comparableKeyImplication:
      "Named Mario Kart World bundle is an official package, but the game download creates a bundle/software axis separate from plain body/full_set.",
    manualReviewBoundary:
      "Keep Mario Kart World bundle rows manual-review unless owner chooses a separate official_bundle key or maps them into full_set with a bundle flag.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-004",
    kind: "bundle_package",
    title: "US MSRP package axis",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo April 18, 2025 pricing news",
    url: sourceUrls.pricingNews,
    evidence:
      "Nintendo listed launch MSRP: Nintendo Switch 2 at $449.99 and Nintendo Switch 2 + Mario Kart World Bundle at $499.99; Mario Kart World separately at $79.99.",
    comparableKeyImplication:
      "Official pricing confirms system-only and Mario Kart bundle are distinct retail offers.",
    manualReviewBoundary:
      "Used as source evidence only; no runtime pricing, public candidate, or valuation rule is approved.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-005",
    kind: "accessory",
    title: "Switch 2 accessory class",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo April 18, 2025 accessory MSRP list",
    url: sourceUrls.pricingNews,
    evidence:
      "Nintendo lists Switch 2 accessories separately from the console, including Pro Controller, Joy-Con 2 Pair, Charging Grip, Strap, Wheel Set, Camera, Dock Set, Carrying Cases, AC Adapter, and microSD Express card.",
    comparableKeyImplication:
      "Accessory/controller-only rows are not console body rows and should not emit game_console|nintendo_switch|switch_2 body keys.",
    manualReviewBoundary:
      "Hold accessory/controller-only rows outside Switch 2 body policy.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-006",
    kind: "accessory",
    title: "Korean support accessory taxonomy",
    sourceTier: "official_nintendo_support",
    sourceLabel: "Nintendo Korea Switch 2 accessory support",
    url: sourceUrls.koreaAccessories,
    evidence:
      "Nintendo Korea support separates Joy-Con 2 Grip, Joy-Con 2 Charging Grip, Nintendo Switch 2 Pro Controller, USB camera, amiibo, and Bluetooth audio as accessory/support topics.",
    comparableKeyImplication:
      "Korean marketplace titles containing Pro Controller, camera, grip, amiibo, or other accessory-only terms should remain accessory boundary rows.",
    manualReviewBoundary:
      "Accessory-only listings remain hold even when they include Switch 2 tokens.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-007",
    kind: "game_software",
    title: "Mario Kart World software identity",
    sourceTier: "official_nintendo",
    sourceLabel: "Nintendo Korea Mario Kart World product info",
    url: sourceUrls.koreaMarioKart,
    evidence:
      "Korean official product page identifies Mario Kart World as Nintendo Switch 2 software with download distribution and package release on 2025.6.5.",
    comparableKeyImplication:
      "Game/software-only rows are media/software, not Switch 2 console body rows.",
    manualReviewBoundary:
      "Hold game card, software, download code, or title-only rows outside hardware body policy.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-008",
    kind: "release_current_status",
    title: "Support page redirects to official technical specs",
    sourceTier: "official_nintendo_support",
    sourceLabel: "Nintendo Support console and accessory technical specifications",
    url: sourceUrls.supportSpecs,
    evidence:
      "Nintendo Support points users to the Nintendo Switch 2 Technical Specs page for full specifications of Switch 2 systems and included accessories.",
    comparableKeyImplication:
      "Support evidence reinforces official specs as the primary source for body/accessory identity.",
    manualReviewBoundary:
      "Specs still do not resolve marketplace condition, sold, buying, or damaged states.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-009",
    kind: "marketplace_boundary",
    title: "Sold-only/title-sold boundary",
    sourceTier: "internal_policy_fixture",
    sourceLabel: "Existing owner decision packet",
    url: "reports/game-console-switch-2-owner-decision-packet-latest.json",
    evidence:
      "Owner packet fixture marks title-sold/sold-only Switch 2 rows as hold_sold_only_or_title_sold with no live candidate/runtime use.",
    comparableKeyImplication:
      "Sold rows may be considered only as separate offline evidence if owner approves, never as live candidate rows from this packet.",
    manualReviewBoundary:
      "Keep sold-only/title-sold rows out of runtime/public/candidate flow.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    id: "SWITCH2-SOURCE-010",
    kind: "marketplace_boundary",
    title: "Buying/damaged boundary",
    sourceTier: "internal_policy_fixture",
    sourceLabel: "Existing owner decision packet",
    url: "reports/game-console-switch-2-owner-decision-packet-latest.json",
    evidence:
      "Owner packet fixtures hold buying/매입/삽니다 rows and damaged/parts-only rows even when Switch 2 body tokens are present.",
    comparableKeyImplication:
      "Buying and damaged/parts rows are not clean seller console-body comparable rows.",
    manualReviewBoundary:
      "Keep buying, damaged, locked, repair, and parts-only rows as hold/manual-review boundaries.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
];

const boundaryRows: BoundaryRow[] = [
  {
    gate: "console_body",
    classification: "manual_review",
    titleExamples: ["닌텐도 스위치2 본체 풀박스", "닌텐도 스위치2 본체만 판매"],
    sourceEvidenceIds: ["SWITCH2-SOURCE-001", "SWITCH2-SOURCE-002"],
    decision: "Switch 2 body rows are real released hardware, but remain manual-review/internal-only until body_only/full_set policy is approved.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    gate: "bundle_package",
    classification: "manual_review",
    titleExamples: ["닌텐도 스위치2 마리오카트 월드 에디션 미개봉", "Nintendo Switch 2 + Mario Kart World Bundle"],
    sourceEvidenceIds: ["SWITCH2-SOURCE-003", "SWITCH2-SOURCE-004"],
    decision: "Official Mario Kart bundle is a distinct package axis; owner must choose separate bundle key vs full_set-with-bundle-note.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    gate: "accessory_controller_only",
    classification: "hold",
    titleExamples: ["닌텐도 스위치2 프로콘 컨트롤러 미개봉", "Nintendo Switch 2 Dock Set"],
    sourceEvidenceIds: ["SWITCH2-SOURCE-005", "SWITCH2-SOURCE-006"],
    decision: "Accessory/controller-only rows are separate official product classes and stay outside console body keys.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    gate: "game_software",
    classification: "hold",
    titleExamples: ["닌텐도 스위치2 마리오카트 월드 게임칩", "Mario Kart World download code"],
    sourceEvidenceIds: ["SWITCH2-SOURCE-003", "SWITCH2-SOURCE-007"],
    decision: "Software/title/download-code rows are not hardware body rows; bundle rows need owner-approved package handling.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
  {
    gate: "sold_only_buying_damaged",
    classification: "hold",
    titleExamples: ["판매완료 닌텐도 스위치2 본체 풀박스", "닌텐도 스위치2 삽니다", "닌텐도 스위치2 액정파손 부품용 본체"],
    sourceEvidenceIds: ["SWITCH2-SOURCE-009", "SWITCH2-SOURCE-010"],
    decision: "Marketplace state/condition boundaries remain hold; official sources do not override sold, buying, damaged, or parts-only contamination.",
    runtimeApproved: false,
    publicPromotion: false,
    candidatePool: false,
    runtimeApply: false,
  },
];

async function readInputs(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    Object.entries(inputFiles).map(async ([key, file]) => {
      const raw = await readFile(path.join(process.cwd(), file), "utf8");
      if (!file.endsWith(".json")) return [key, { path: file, bytes: raw.length, kind: "markdown" }] as const;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return [
        key,
        {
          path: file,
          bytes: raw.length,
          kind: "json",
          rows: Array.isArray(parsed.rows)
            ? parsed.rows.length
            : Array.isArray(parsed.fixtures)
              ? parsed.fixtures.length
              : Array.isArray(parsed.boundaryRows)
                ? parsed.boundaryRows.length
                : null,
        },
      ] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function readOwnerPacket(): Promise<OwnerPacket> {
  const raw = await readFile(path.join(process.cwd(), inputFiles.ownerDecisionPacketJson), "utf8");
  return JSON.parse(raw) as OwnerPacket;
}

function countBy<T extends string>(values: T[]): Record<T, number> {
  return values.reduce(
    (acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    },
    {} as Record<T, number>,
  );
}

function markdownEscape(value: string | null): string {
  return (value ?? "null").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function buildMarkdown(report: Record<string, unknown>): string {
  const boundary = report.boundary as Record<string, unknown>;
  const metrics = report.metrics as Record<string, unknown>;
  const rows = report.evidenceRows as EvidenceRow[];
  const boundaries = report.boundaryRows as BoundaryRow[];

  const lines = [
    "# Game Console Switch 2 Source Backfill",
    "",
    `- generatedAt: ${report.generatedAt}`,
    "- category: game_console_body_narrow",
    "- lane: game_console_switch_2_source_backfill",
    `- conclusion: ${report.conclusion}`,
    "",
    "## Boundary",
    "",
    `- reportOnly: ${boundary.reportOnly}`,
    `- runtimeCatalogApply: ${boundary.runtimeCatalogApply}`,
    `- runtimeApply: ${boundary.runtimeApply}`,
    `- publicPromotion: ${boundary.publicPromotion}`,
    `- candidatePoolPolicyWiring: ${boundary.candidatePoolPolicyWiring}`,
    `- productionDbMutation: ${boundary.productionDbMutation}`,
    `- directThirtyDayPlanEdit: ${boundary.directThirtyDayPlanEdit}`,
    `- runtimeApprovedRows: ${boundary.runtimeApprovedRows}`,
    `- publicPromotionRows: ${boundary.publicPromotionRows}`,
    `- candidatePoolRows: ${boundary.candidatePoolRows}`,
    `- runtimeApplyRows: ${boundary.runtimeApplyRows}`,
    "",
    "## Metrics",
    "",
    `- evidenceRows: ${metrics.evidenceRows}`,
    `- officialNintendoRows: ${metrics.officialNintendoRows}`,
    `- officialSupportRows: ${metrics.officialSupportRows}`,
    `- internalPolicyFixtureRows: ${metrics.internalPolicyFixtureRows}`,
    `- boundaryRows: ${metrics.boundaryRows}`,
    `- ownerFixtureRowsRead: ${metrics.ownerFixtureRowsRead}`,
    `- runtimeApprovedRows: ${metrics.runtimeApprovedRows}`,
    `- publicPromotionRows: ${metrics.publicPromotionRows}`,
    `- candidatePoolRows: ${metrics.candidatePoolRows}`,
    `- runtimeApplyRows: ${metrics.runtimeApplyRows}`,
    "",
    "## Evidence Rows",
    "",
    "| id | kind | sourceTier | title | implication |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map(
      (row) =>
        `| ${row.id} | ${row.kind} | ${row.sourceTier} | ${markdownEscape(row.title)} | ${markdownEscape(row.comparableKeyImplication)} |`,
    ),
    "",
    "## Boundary Rows",
    "",
    "| gate | classification | sourceEvidenceIds | decision |",
    "| --- | --- | --- | --- |",
    ...boundaries.map(
      (row) =>
        `| ${row.gate} | ${row.classification} | ${row.sourceEvidenceIds.join(", ")} | ${markdownEscape(row.decision)} |`,
    ),
    "",
    "## Source URLs",
    "",
    ...rows
      .filter((row) => row.url?.startsWith("http"))
      .map((row) => `- ${row.id}: [${row.sourceLabel}](${row.url})`),
    "",
    "## Recommendation",
    "",
    "- Switch 2 remains manual-review/internal-only.",
    "- Official Nintendo evidence supports console body identity, release/current status, official bundle/package contents, accessory separation, and software separation.",
    "- Sold-only, buying, and damaged/parts boundaries remain local marketplace policy holds because official product/spec pages do not define those listing states.",
    "- No runtime patch, public promotion, candidate pool wiring, Supabase write, cron/lifecycle change, pack UI change, auth change, or 30-day-plan edit is included.",
    "",
  ];

  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const inputReadSummary = await readInputs();
  const ownerPacket = await readOwnerPacket();
  const boundary = {
    reportOnly: true,
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    runtimeApprovedRows: evidenceRows.filter((row) => row.runtimeApproved).length + boundaryRows.filter((row) => row.runtimeApproved).length,
    publicPromotionRows: evidenceRows.filter((row) => row.publicPromotion).length + boundaryRows.filter((row) => row.publicPromotion).length,
    candidatePoolRows: evidenceRows.filter((row) => row.candidatePool).length + boundaryRows.filter((row) => row.candidatePool).length,
    runtimeApplyRows: evidenceRows.filter((row) => row.runtimeApply).length + boundaryRows.filter((row) => row.runtimeApply).length,
  };
  const metrics = {
    evidenceRows: evidenceRows.length,
    evidenceKindCounts: countBy(evidenceRows.map((row) => row.kind)),
    officialNintendoRows: evidenceRows.filter((row) => row.sourceTier === "official_nintendo").length,
    officialSupportRows: evidenceRows.filter((row) => row.sourceTier === "official_nintendo_support").length,
    internalPolicyFixtureRows: evidenceRows.filter((row) => row.sourceTier === "internal_policy_fixture").length,
    boundaryRows: boundaryRows.length,
    boundaryClassificationCounts: countBy(boundaryRows.map((row) => row.classification)),
    ownerFixtureRowsRead: ownerPacket.fixtures?.length ?? 0,
    ownerDecisionRowsRead: ownerPacket.ownerDecisionsRequired?.length ?? 0,
    runtimeApprovedRows: boundary.runtimeApprovedRows,
    publicPromotionRows: boundary.publicPromotionRows,
    candidatePoolRows: boundary.candidatePoolRows,
    runtimeApplyRows: boundary.runtimeApplyRows,
  };
  const report = {
    generatedAt,
    reportOnly: true,
    ownership: "game_console_switch_2_source_backfill_only",
    category: "game_console_body_narrow",
    lane: "game_console_switch_2_source_backfill",
    conclusion: "switch_2_remains_manual_review_internal_only_after_official_source_backfill",
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    boundary,
    inputFiles,
    inputReadSummary,
    sourceUrls,
    metrics,
    evidenceRows,
    boundaryRows,
    sourcePriorityNote:
      "Official Nintendo product, support, technical spec, launch, pricing, and Korean software/accessory pages are used first. Only sold-only, buying, and damaged marketplace states use internal policy fixtures because official Nintendo pages do not define marketplace listing state.",
  };

  await mkdir(reportsDir, { recursive: true });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  JSON.parse(json);
  await writeFile(outputJsonPath, json);
  await writeFile(outputMdPath, buildMarkdown(report));

  console.log(`wrote ${path.relative(process.cwd(), outputJsonPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), outputMdPath)}`);
  console.log(`switch2 source backfill: evidence=${evidenceRows.length}, boundaries=${boundaryRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
