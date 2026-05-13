import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function tryReadJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const frontier = await tryReadJson<{ generatedAt?: string; lanes?: unknown[] }>(
    "tech-home-next-lane-frontier-latest.json",
  );

  const frontierLanes = [
    { key: "camera_body_sony_a7m4", category: "camera_discovered", reason: "Sony A7M4 body-only narrow lane — closed-set 모델코드, mining sample 양호 추정", risk: "low" },
    { key: "desktop_mac_mini_m2", category: "desktop_discovered", reason: "Mac mini M2 base unit — Apple closed-set, 결정론 친화", risk: "low" },
    { key: "vacuum_dyson_v12", category: "home_appliance_discovered", reason: "Dyson V12 vacuum — model-code narrow, parts/refurb 경계 필요", risk: "medium" },
    { key: "vacuum_roborock_s8", category: "home_appliance_discovered", reason: "Roborock S8 — model-code narrow, broad family 'S8'와 정확 매칭 필요", risk: "medium" },
    { key: "monitor_lg_ultrafine", category: "monitor_discovered", reason: "LG UltraFine 27인치 Series — Apple Mac 사용자 매칭, 5K/4K 변형 분리 필요", risk: "medium" },
    { key: "monitor_samsung_odyssey", category: "monitor_discovered", reason: "Samsung Odyssey G7/G9 model-code narrow", risk: "medium" },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "owner_decision_unblock",
    family: "tech_home_frontier",
    decision: "owner_decision_unblock_next_lane_apply_report_only",
    decisionKey: "next_lane_apply",
    summary:
      "1차 16 row apply (monitor + JBL + iPad) 완료, internal-only 상태. 다음 acquisition wave 후보 6 lane: camera Sony A7M4 / Mac mini M2 / Dyson V12 / Roborock S8 / Monitor LG UltraFine / Monitor Samsung Odyssey. 결정 필요: 다음 lane 1~3개 선택 + acquisition apply 진행.",
    currentState: {
      firstWaveApplied: 16,
      firstWaveLanes: 3,
      firstWaveStatus: "internal_only (pool_eligible=false, candidate_pool 미진입)",
      frontierLanesAvailable: frontierLanes.length,
      frontierReportGeneratedAt: frontier?.generatedAt ?? null,
      runtimeApprovedRows: 0,
    },
    frontierLanes,
    options: [
      {
        id: "A",
        label: "Mac mini M2 + Sony A7M4 (low risk 우선)",
        scope:
          "Apple closed-set + Sony closed-set 2 lane으로 2차 wave. 가장 낮은 false positive risk.",
        pros: [
          "결정론 친화 — 모델코드 명확",
          "1차 wave 성공 패턴 동일 (catalog narrow + fresh-refetch)",
          "변경 0 — catalog 이미 존재 (확인 필요)",
        ],
        cons: [
          "camera/desktop 시장은 phones/smartphone보다 turnover 낮음",
          "acquisition cap 작을 가능성 (각 5~10 row 정도)",
        ],
        owner_actions_needed: [
          "preflight + dry-run 검증",
          "INTERNAL_ACQUISITION_WRITE_APPROVED=1 trigger",
        ],
      },
      {
        id: "B",
        label: "Monitor Samsung Odyssey + Monitor LG UltraFine (모니터 확장)",
        scope:
          "1차 wave에서 BenQ XL2540K + LG 27US550 성공 — monitor 카테고리 추가 narrow lane 2개로 확장.",
        pros: [
          "monitor 카테고리 lane 다양화 (사용자 노출 다양성)",
          "model-code narrow lane 패턴 동일 (1차 wave 검증됨)",
        ],
        cons: [
          "Odyssey/UltraFine은 size/spec 변형 많음 (LG UltraFine 27 vs 32, Odyssey G7 vs G9)",
          "catalog mustContain 정밀화 필요할 가능성",
        ],
        owner_actions_needed: [
          "catalog narrow SKU 검토",
          "preflight + dry-run 검증",
        ],
      },
      {
        id: "C",
        label: "Dyson V12 + Roborock S8 (home_appliance 확장)",
        scope:
          "home_appliance 카테고리에 vacuum 2 lane. 1차 wave에서 없던 새 카테고리.",
        pros: [
          "home_appliance 카테고리 첫 ready 진입",
          "model-code narrow",
        ],
        cons: [
          "parts/refurb/구성품 분리가 phones보다 어려울 가능성",
          "catalog 신규 등록 필요 (확인)",
          "home_appliance broad mining 데이터 양 검토 필요",
        ],
        owner_actions_needed: [
          "catalog 신규 SKU 등록",
          "mining lane_config 정의 또는 broad 카테고리 mining",
          "preflight + dry-run 검증",
        ],
      },
      {
        id: "D",
        label: "1차 16 row를 candidate_pool로 승격 (frontier 보류)",
        scope:
          "신규 lane 확장보다 1차 16 row를 internal_only에서 candidate_pool로 진입시켜 사용자 노출 시작 (owner_decision_unblock packet #4 참조).",
        pros: [
          "사용자 노출 시작 — 사업 진전 최단",
          "기존 데이터 활용 (추가 mining 0)",
        ],
        cons: [
          "lane 다양성 제한 (3 lane만)",
          "candidate_pool 정책 결정 선행 필요",
        ],
        owner_actions_needed: [
          "owner_decision_unblock packet #4 결정",
        ],
      },
    ],
    recommendation: {
      pick: "D 먼저, 그 다음 A",
      reason:
        "사용자 의도 = 사업 진전 + 사용자 노출. D (candidate_pool 승격)가 가장 빠른 user-exposure path. 그 후 A (Mac mini + Sony A7M4)로 lane 다양성 확장. C는 home_appliance 신규 진입으로 risk 높음 — 후순위. B는 monitor 단일 확장으로 가치 작음.",
      tradeoff: "D는 candidate_pool 정책 결정 (packet #4) 선행 필요. A는 catalog 확인 + preflight + dry-run wave.",
    },
    executionStepsIfPickedDThenA: [
      "Step 1 (owner 명시): packet #4 (candidate_pool internal→public 승격 정책) 결정",
      "Step 2 (owner 명시): 1차 16 row 중 일부 또는 전체를 candidate_pool로 진입 (cap 명시)",
      "Step 3 (report-only): user 노출 측정 packet — pack reveal rate / candidate 매칭률",
      "Step 4 (report-only): A 진행 design — Mac mini M2 + Sony A7M4 preflight + dry-run",
      "Step 5 (owner 명시): INTERNAL_ACQUISITION_WRITE_APPROVED=1 + 2차 wave apply",
    ],
    blockers: [
      "Mac mini M2 / Sony A7M4 catalog 등록 확인 필요",
      "frontier lane mining sample 양 검증",
      "candidate_pool 승격 정책 (packet #4) 선행",
    ],
    metrics: {
      optionsConsidered: 4,
      frontierLanes: frontierLanes.length,
      recommendationConfidence: 0.7,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "D는 candidate_pool 정책 선행. A는 catalog 검증 후 진행.",
      "어느 옵션도 runtime/catalog/parser 변경 자동 안 함 — owner 명시 필요.",
    ],
    doNotDo: [
      "Do not apply new lanes without preflight + dry-run + fresh-refetch",
      "Do not promote any row to candidate_pool without packet #4 decision",
      "Do not bypass INTERNAL_ACQUISITION_WRITE_APPROVED=1 trigger",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "owner-decision-unblock-next-lane-apply-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Owner Decision Unblock — Next Lane Apply",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only owner decision packet. 다음 acquisition wave 대상 결정.",
    "",
    "## Summary",
    "",
    `- ${report.summary}`,
    "",
    "## Current State",
    "",
    ...Object.entries(report.currentState).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Frontier Lanes",
    "",
    "| key | category | risk | reason |",
    "|---|---|---|---|",
    ...frontierLanes.map((l) => `| ${l.key} | ${l.category} | ${l.risk} | ${l.reason} |`),
    "",
    "## Options",
    "",
    ...report.options.flatMap((o) => [
      `### Option ${o.id}: ${o.label}`,
      "",
      `- scope: ${o.scope}`,
      "- pros:",
      ...o.pros.map((p) => `  - ${p}`),
      "- cons:",
      ...o.cons.map((c) => `  - ${c}`),
      "- owner_actions_needed:",
      ...o.owner_actions_needed.map((a) => `  - ${a}`),
      "",
    ]),
    "## Recommendation",
    "",
    `- **Pick: ${report.recommendation.pick}**`,
    `- reason: ${report.recommendation.reason}`,
    `- tradeoff: ${report.recommendation.tradeoff}`,
    "",
    "## Execution Steps (D → A)",
    "",
    ...report.executionStepsIfPickedDThenA.map((l) => `- ${l}`),
    "",
    "## Blockers",
    "",
    ...report.blockers.map((l) => `- ${l}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`owner-decision next-lane-apply: pick=${report.recommendation.pick}, frontier=${frontierLanes.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
