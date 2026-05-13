import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type FrontierLane = {
  laneKey: string;
  category: string;
  inferredSku: string;
  miningLaneConfigExists: boolean;
  catalogSkuExists: boolean | "unknown";
  expectedPrecisionRisk: "low" | "medium" | "high";
  preflightOk: boolean;
  blockers: string[];
  expectedThicknessOnApply: string;
  ownerActionRequired: boolean;
};

const FRONTIER_LANES: FrontierLane[] = [
  {
    laneKey: "desktop_mac_mini_m2_base",
    category: "desktop",
    inferredSku: "Apple Mac mini M2 base unit",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "low",
    preflightOk: false,
    blockers: [
      "mining lane_config 미정의 — `category-intelligence/mac_mini_m2/` 부재",
      "catalog SKU 확인 필요 — `src/lib/catalog.ts` grep",
      "production replay 0 row (Wave 3 측정 확인)",
    ],
    expectedThicknessOnApply: "낮음 (Apple Mac mini는 turnover 적음, 추정 5~15 row/주)",
    ownerActionRequired: true,
  },
  {
    laneKey: "camera_sony_a7m4_body",
    category: "camera",
    inferredSku: "Sony Alpha A7M4 body-only",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "medium",
    preflightOk: false,
    blockers: [
      "mining lane_config 미정의 — `category-intelligence/camera_sony_a7m4/` 부재 (camera_discovered만 존재)",
      "lens-kit / body-only 분리 정밀도 필요 — 'A7M4 + 24-70'은 bundle, 'A7M4 body'는 body_only",
      "catalog SKU 등록 안 됨 추정",
    ],
    expectedThicknessOnApply: "중간 (full-frame body는 turnover 보통, 추정 10~30 row/주)",
    ownerActionRequired: true,
  },
  {
    laneKey: "home_appliance_dyson_v12",
    category: "home_appliance",
    inferredSku: "Dyson V12 vacuum",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "medium",
    preflightOk: false,
    blockers: [
      "mining lane_config 미정의 — `category-intelligence/dyson_v12/` 부재",
      "V8/V10/V11/V12/V15 세대 분리 필요 — model code 명확",
      "Detect/Absolute/Plus 변형 분리 필요",
      "catalog SKU 등록 안 됨 추정",
    ],
    expectedThicknessOnApply: "보통 (Dyson V12는 인기 모델, 추정 15~40 row/주)",
    ownerActionRequired: true,
  },
  {
    laneKey: "home_appliance_roborock_s8",
    category: "home_appliance",
    inferredSku: "Roborock S8 robot vacuum",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "medium",
    preflightOk: false,
    blockers: [
      "mining lane_config 미정의",
      "Pro/Pro+/Ultra/MaxV 변형 분리 필요",
      "catalog SKU 등록 안 됨 추정",
    ],
    expectedThicknessOnApply: "보통 (10~30 row/주)",
    ownerActionRequired: true,
  },
  {
    laneKey: "monitor_lg_ultrafine_27",
    category: "monitor",
    inferredSku: "LG UltraFine 27 5K/4K",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "medium",
    preflightOk: false,
    blockers: [
      "5K vs 4K 변형 분리 필요",
      "UltraFine 27MD5K (구형) vs 27 5K (신형) 모델 코드 분리",
      "Apple Mac 사용자 매칭으로 turnover 안정적",
    ],
    expectedThicknessOnApply: "낮음~보통 (5~15 row/주)",
    ownerActionRequired: true,
  },
  {
    laneKey: "monitor_samsung_odyssey_g7",
    category: "monitor",
    inferredSku: "Samsung Odyssey G7 (모델 코드 narrow)",
    miningLaneConfigExists: false,
    catalogSkuExists: "unknown",
    expectedPrecisionRisk: "medium",
    preflightOk: false,
    blockers: [
      "G5/G7/G9 변형 분리 (각자 시세 다름)",
      "27/32/49 inch 변형 분리",
      "catalog model code 확인 필요 (LC27G7T 등)",
    ],
    expectedThicknessOnApply: "보통 (게이밍 모니터 활발, 15~30 row/주)",
    ownerActionRequired: true,
  },
];

async function main(): Promise<void> {
  const totals = {
    frontierLanes: FRONTIER_LANES.length,
    miningLaneConfigsMissing: FRONTIER_LANES.filter((l) => !l.miningLaneConfigExists).length,
    catalogSkuUnverified: FRONTIER_LANES.filter((l) => l.catalogSkuExists === "unknown").length,
    preflightOkCount: FRONTIER_LANES.filter((l) => l.preflightOk).length,
    ownerActionsRequired: FRONTIER_LANES.filter((l) => l.ownerActionRequired).length,
  };

  const nextSteps = [
    "Step 1 (report-only): 각 frontier lane의 catalog SKU 존재 여부 grep — `src/lib/catalog.ts` 확인. report-only.",
    "Step 2 (report-only): mining lane_config 정의 design — 각 lane별 query/regex/accept/reject draft.",
    "Step 3 (owner 명시): mining v3 실행 — `npm run mine:category:v3 -- --category=<lane>` (실 작업, mining만, runtime 변경 0).",
    "Step 4 (owner 명시): catalog SKU 등록 — 각 lane에 mustContain/mustNotContain 박음.",
    "Step 5 (report-only): production replay 측정 — Wave 3와 동일 패턴.",
    "Step 6 (owner 명시): 1차 wave acquisition apply (INTERNAL_ACQUISITION_WRITE_APPROVED=1, fresh-refetch) — 16 row apply 패턴.",
    "Step 7 (owner 명시): readiness UPDATE → ready 승격 (thresholds 통과 시).",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave8_tech_narrow_lane_preflight",
    family: "tech_home_frontier",
    decision: "wave8_tech_narrow_lane_preflight_report_only",
    metrics: { ...totals, runtimeApprovedRows: 0 },
    frontierLanes: FRONTIER_LANES,
    nextSteps,
    keyFindings: [
      `6 frontier lane 모두 mining lane_config 부재 — Wave 8 진행을 위해 mining v3 선행 필수.`,
      `catalog SKU도 6/6 unverified — 별도 wave (Step 1) grep으로 확인 후 등록 결정.`,
      `preflight pass 0/6 — 본 packet은 차후 wave 진입 조건 정리에 가까움.`,
      `각 lane은 owner_action 필요 (mining + catalog + apply 3 step). report-only로는 design + 검증까지만.`,
    ],
    policyImplications: [
      "frontier 6 lane은 즉시 진입 불가 — mining + catalog 선행 필요. 본 packet은 진입 조건 + blocker 정리.",
      "각 lane은 owner 명시 sequence (mining v3 → catalog 등록 → apply → readiness)로 진행.",
      "기존 1차 16 row apply 패턴 그대로 재사용 (preflight + dry-run + fresh-refetch + tiny cap).",
      "본 packet은 report-only. mining/catalog/apply 자동 실행 0.",
    ],
    doNotDo: [
      "Do not run mining v3 from this packet — owner 명시 후만",
      "Do not register catalog SKUs without owner approval",
      "Do not apply acquisition without preflight + dry-run + fresh-refetch chain",
      "Do not promote any frontier lane to ready before production replay measurement",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave8-tech-narrow-lane-preflight-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 8 — Tech / 가전 Narrow Lane Preflight",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only preflight packet. 6 frontier lane (Mac mini M2 / Sony A7M4 / Dyson V12 / Roborock S8 / LG UltraFine / Samsung Odyssey)의 진입 조건 + blocker 정리.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Frontier Lanes",
    "",
    "| laneKey | category | mining | catalog | risk | preflight | ownerActionRequired |",
    "|---|---|---|---|---|---|---|",
    ...FRONTIER_LANES.map((l) => `| ${l.laneKey} | ${l.category} | ${l.miningLaneConfigExists ? "OK" : "MISSING"} | ${l.catalogSkuExists === true ? "OK" : l.catalogSkuExists === false ? "MISSING" : "UNVERIFIED"} | ${l.expectedPrecisionRisk} | ${l.preflightOk ? "OK" : "FAIL"} | ${l.ownerActionRequired ? "YES" : "no"} |`),
    "",
    "## Per-Lane Detail",
    "",
    ...FRONTIER_LANES.flatMap((l) => [
      `### ${l.laneKey} (${l.category})`,
      "",
      `- inferredSku: ${l.inferredSku}`,
      `- miningLaneConfigExists: ${l.miningLaneConfigExists}`,
      `- catalogSkuExists: ${l.catalogSkuExists}`,
      `- expectedPrecisionRisk: ${l.expectedPrecisionRisk}`,
      `- expectedThicknessOnApply: ${l.expectedThicknessOnApply}`,
      "- blockers:",
      ...l.blockers.map((b) => `  - ${b}`),
      "",
    ]),
    "## Next Steps (owner 명시 sequence)",
    "",
    ...nextSteps.map((s, i) => `${i + 1}. ${s}`),
    "",
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
  console.log(`wave8 frontier-preflight: lanes=${FRONTIER_LANES.length}, miningMissing=${totals.miningLaneConfigsMissing}, catalogUnverified=${totals.catalogSkuUnverified}, preflightOk=${totals.preflightOkCount}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
