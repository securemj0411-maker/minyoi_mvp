import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

// Production replay measurement after Wave 1 (schema function update) + Wave 2 (readiness rows).
// Source data: supabase MCP measurement 2026-05-13T15:15 UTC.

type LaneMetric = {
  category: string;
  comparableKey: string;
  rowCount: number;
  needsReviewFalse: number;
  needsReviewFalseShare: number;
  inferredSku: string;
};

const PRODUCTION_LANES: LaneMetric[] = [
  { category: "monitor", comparableKey: "monitor|xl2540k|24_5in|fhd|240hz|tn|unknown_shape", rowCount: 3, needsReviewFalse: 3, needsReviewFalseShare: 1.0, inferredSku: "BenQ ZOWIE XL2540K" },
  { category: "monitor", comparableKey: "monitor|27gl650f|27in|fhd|144hz|ips|unknown_shape", rowCount: 2, needsReviewFalse: 2, needsReviewFalseShare: 1.0, inferredSku: "LG 27GL650F" },
  { category: "monitor", comparableKey: "monitor|27us550|27in|uhd_4k|60hz|ips|unknown_shape", rowCount: 1, needsReviewFalse: 1, needsReviewFalseShare: 1.0, inferredSku: "LG 27US550" },
  { category: "monitor", comparableKey: "monitor|39gx900a|39in|wqhd|240hz|oled|curved_ultrawide", rowCount: 1, needsReviewFalse: 1, needsReviewFalseShare: 1.0, inferredSku: "LG 39GX900A" },
  { category: "speaker", comparableKey: "speaker|jbl_flip_6|portable_bluetooth_speaker", rowCount: 6, needsReviewFalse: 6, needsReviewFalseShare: 1.0, inferredSku: "JBL Flip 6" },
];

type CategoryRollup = {
  category: string;
  productionPresence: boolean;
  productionRows: number;
  productionDistinctKeys: number;
  productionNeedsReviewFalseShare: number;
  readinessMinPool: number;
  readinessMinTrustedKeys: number;
  readinessMinParseRate: number;
  poolGap: number;
  keysGap: number;
  parseRateGap: number;
  readyCandidateStatus: "all_thresholds_met" | "keys_only_gap" | "pool_only_gap" | "multi_gap" | "no_production_data";
  note: string;
};

function rollup(category: string): CategoryRollup {
  const lanes = PRODUCTION_LANES.filter((l) => l.category === category);
  const productionRows = lanes.reduce((a, l) => a + l.rowCount, 0);
  const distinctKeys = new Set(lanes.map((l) => l.comparableKey)).size;
  const needsReviewFalseSum = lanes.reduce((a, l) => a + l.needsReviewFalse, 0);
  const share = productionRows > 0 ? Number((needsReviewFalseSum / productionRows).toFixed(3)) : 0;
  // Wave 2 thresholds: min_pool=3, min_parse=0.85, min_keys=3
  const poolGap = Math.max(3 - productionRows, 0);
  const keysGap = Math.max(3 - distinctKeys, 0);
  const parseRateGap = share === 0 ? 0.85 : Math.max(0.85 - share, 0);
  const presence = productionRows > 0;
  let status: CategoryRollup["readyCandidateStatus"] = "no_production_data";
  if (presence) {
    if (poolGap === 0 && keysGap === 0 && parseRateGap === 0) status = "all_thresholds_met";
    else if (poolGap === 0 && parseRateGap === 0 && keysGap > 0) status = "keys_only_gap";
    else if (keysGap === 0 && parseRateGap === 0 && poolGap > 0) status = "pool_only_gap";
    else status = "multi_gap";
  }
  const noteMap: Record<string, string> = {
    monitor: "1차 wave 7 row apply 효과 — 4 distinct SKU, parse rate 100%. min_keys=3 통과 (4≥3), min_pool=3 통과 (7≥3). 이미 모든 thresholds 충족 가능한 상태.",
    speaker: "1차 wave 6 row — JBL Flip 6 단일 SKU. min_keys=3 미달 (1 < 3). 추가 SKU narrow lane 필요 (Bose SoundLink Flex, Sonos Roam 등).",
    camera: "production replay 0 row. catalog/parser가 camera 카테고리 매물 인식 안 함 → mining lane (camera_discovered)은 있지만 production이 아직 매핑 못 함. Wave 8 (narrow lane preflight)에서 Sony A7M4 진입 필요.",
    game_console: "production replay 0 row. PS5 21건 Phase 0 fail은 catalog 부재 + adapter regex 결함 — owner_decision_unblock packet #2 참조. Wave 8 이전에 PS5 regex/catalog 결정 선행 필요.",
    desktop: "production replay 0 row. catalog/parser가 Mac mini / iMac 카테고리 인식 안 함. Wave 8에서 Mac mini M2 narrow lane 진입 필요.",
    home_appliance: "production replay 0 row. catalog/parser가 vacuum/cooker 카테고리 인식 안 함. Wave 8에서 Dyson V/Roborock S narrow lane 진입 필요.",
  };
  return {
    category,
    productionPresence: presence,
    productionRows,
    productionDistinctKeys: distinctKeys,
    productionNeedsReviewFalseShare: share,
    readinessMinPool: 3,
    readinessMinTrustedKeys: 3,
    readinessMinParseRate: 0.85,
    poolGap,
    keysGap,
    parseRateGap: Number(parseRateGap.toFixed(3)),
    readyCandidateStatus: status,
    note: noteMap[category] ?? "",
  };
}

async function main(): Promise<void> {
  const categories = ["monitor", "speaker", "camera", "game_console", "desktop", "home_appliance"];
  const rollups = categories.map(rollup);

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave3_production_replay_measurement",
    family: "tech_home_categories",
    decision: "wave3_production_replay_measurement_report_only",
    metrics: {
      categoriesMeasured: categories.length,
      categoriesWithProduction: rollups.filter((r) => r.productionPresence).length,
      categoriesAllThresholdsMet: rollups.filter((r) => r.readyCandidateStatus === "all_thresholds_met").length,
      categoriesKeysOnlyGap: rollups.filter((r) => r.readyCandidateStatus === "keys_only_gap").length,
      categoriesNoProductionData: rollups.filter((r) => r.readyCandidateStatus === "no_production_data").length,
      totalProductionRows: rollups.reduce((a, r) => a + r.productionRows, 0),
      totalDistinctKeys: rollups.reduce((a, r) => a + r.productionDistinctKeys, 0),
      runtimeApprovedRows: 0,
    },
    productionLanes: PRODUCTION_LANES,
    perCategoryRollup: rollups,
    keyFindings: [
      "**monitor**: all_thresholds_met. 1차 wave apply 데이터로 즉시 ready 후보 (7 row, 4 SKU, parse 100%). user-impact 0 유지하면서 ready 승격 가능 — 단 Wave 9에서 owner 명시 후 readiness UPDATE.",
      "**speaker**: keys_only_gap. JBL Flip 6 단일 SKU. 추가 narrow lane 등록 후 ready 가능. 결정론 widening은 금지 (Bose/Sonos는 별도 SKU).",
      "**camera / game_console / desktop / home_appliance**: production replay 0. catalog/parser가 카테고리 매물 인식 안 함. Wave 8 narrow lane preflight + dry-run + (owner 명시) catalog 등록 필요.",
      "Production replay는 mvp_listing_parsed 기준 — 카테고리 인식이 catalog/parser comparable_key 빌드에 직접 의존. Wave 1 schema function update만으로는 부족 — runtime catalog/parser는 owner 결정.",
    ],
    policyImplications: [
      "monitor는 즉시 ready 후보 — 단 별도 wave (readiness UPDATE)에서 owner 명시 후 승격",
      "speaker는 추가 SKU narrow lane 등록이 ready 승격 trigger",
      "camera/game_console/desktop/home_appliance는 catalog 등록 + production parse 가능 상태 만들기가 선행 — Wave 8 narrow lane preflight에서 다룸",
      "PS5 catalog 결정은 owner_decision_unblock packet #2와 같은 영역 — 별도 owner 결정 필요",
      "이 packet은 report-only. 어떤 readiness 변경도 자동 안 함.",
    ],
    doNotDo: [
      "Do not promote any category to ready from this packet",
      "Do not lower readiness thresholds to make speaker/camera pass artificially",
      "Do not widen catalog matching to absorb other monitor variants without owner approval",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave3-production-replay-measurement-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 3 — Production Replay Measurement (monitor / speaker / camera / game_console / desktop / home_appliance)",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only production replay measurement. Wave 1+2 적용 후 mvp_listing_parsed의 카테고리별 lane-level 현 상태.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Production Lanes (live data)",
    "",
    "| category | comparable_key | rows | needs_review_false | parse_rate | inferred SKU |",
    "|---|---|---:|---:|---:|---|",
    ...PRODUCTION_LANES.map((l) => `| ${l.category} | ${l.comparableKey} | ${l.rowCount} | ${l.needsReviewFalse} | ${l.needsReviewFalseShare} | ${l.inferredSku} |`),
    "",
    "## Per-Category Rollup vs Wave 2 Thresholds (min_pool=3, min_parse=0.85, min_keys=3)",
    "",
    "| category | rows | distinct keys | parse rate | pool gap | keys gap | parseRate gap | status |",
    "|---|---:|---:|---:|---:|---:|---:|---|",
    ...rollups.map(
      (r) =>
        `| ${r.category} | ${r.productionRows} | ${r.productionDistinctKeys} | ${r.productionNeedsReviewFalseShare} | ${r.poolGap} | ${r.keysGap} | ${r.parseRateGap} | ${r.readyCandidateStatus} |`,
    ),
    "",
    "## Per-Category Notes",
    "",
    ...rollups.flatMap((r) => [`### ${r.category}`, "", `- ${r.note}`, ""]),
    "## Key Findings",
    "",
    ...report.keyFindings.map((l) => `- ${l}`),
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((l) => `- ${l}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`wave3 production replay: withProduction=${report.metrics.categoriesWithProduction}, allThresholdsMet=${report.metrics.categoriesAllThresholdsMet}, noData=${report.metrics.categoriesNoProductionData}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
