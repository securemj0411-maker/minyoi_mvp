import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const axisProposals = [
    {
      axis: "carrier",
      affectedCategories: ["smartphone", "tablet"],
      currentState: "catalog mustNotContain (carrier_skt/kt/lg/locked_generic) — comparable_key 미포함",
      proposedTokens: ["자급제", "공기계", "정상해지", "skt", "kt", "lg", "lgu+", "유플러스"],
      regexDraft: "/(자급제|공기계|정상해지|skt(?!\\s*완납폰)|kt(?!\\s*완납폰)|lg\\s?u\\+?|유플러스)/i",
      comparableKeyValueSet: ["self", "skt", "kt", "lg", "unknown_carrier"],
      precisionRisk: "low — 명시 token이므로 false positive 낮음",
      forbiddenInference: "carrier wording 부재를 self로 추정 금지 (silent ≠ explicit)",
      ownerActionRequired: true,
    },
    {
      axis: "esim_capable",
      affectedCategories: ["smartphone"],
      currentState: "미인코딩 — 한국 iPhone의 dual-SIM 여부와 결합. 글로벌 모델 vs 한국 정발 시세 차이 큼",
      proposedTokens: ["eSIM", "이심", "물리심", "듀얼심", "글로벌", "정발"],
      regexDraft: "/(esim|이심|물리\\s?심|듀얼\\s?심|글로벌(?:\\s?모델)?|정발)/i",
      comparableKeyValueSet: ["esim_only", "physical_sim", "dual_sim", "global_model", "domestic_only", "unknown_sim"],
      precisionRisk: "medium — 글로벌/정발 token이 carrier wording과 혼동 가능. catalog mustNotContain 보강 필요",
      forbiddenInference: "model name → esim 자동 매핑 금지 (Korea iPhone은 dual physical만, 글로벌은 esim 변형)",
      ownerActionRequired: true,
    },
    {
      axis: "color",
      affectedCategories: ["smartphone", "tablet", "smartwatch"],
      currentState: "미인코딩 — 시세 분석에서 색상별 가격 차이 있는데 comparable_key collapse됨",
      proposedTokens: "카테고리별 color taxonomy 필요 (iPhone: 그라파이트/실버/골드/시에라블루/스타라이트 등)",
      regexDraft: "카테고리별 color whitelist regex — 각 catalog SKU에 color enum 등록",
      comparableKeyValueSet: "카테고리별 color enum + unknown_color",
      precisionRisk: "high — color synonym 다양 (그래파이트=그라파이트=graphite). catalog 정규화 필요",
      forbiddenInference: "default color 추정 금지",
      ownerActionRequired: true,
    },
    {
      axis: "connectivity_wifi_cellular",
      affectedCategories: ["tablet", "smartwatch"],
      currentState: "smartwatch: comparable_key에 부분 인코딩 (GPS/Cellular). tablet: catalog mustContain 'wifi'/'wi-fi'에 의존, comparable_key 미인코딩",
      proposedTokens: ["wifi", "wi-fi", "cellular", "lte", "5g", "셀룰러"],
      regexDraft: "/(wi-?fi|cellular|lte|5g|셀룰러)/i",
      comparableKeyValueSet: ["wifi_only", "cellular", "unknown_connectivity"],
      precisionRisk: "low — 명시 token",
      forbiddenInference: "smartwatch 모델별 가능 connectivity → 추정 금지 (S10 46mm는 GPS만 또는 GPS+Cellular)",
      ownerActionRequired: true,
    },
    {
      axis: "physical_dual_sim",
      affectedCategories: ["smartphone"],
      currentState: "미인코딩 — 한국 iPhone (eSIM 미지원, dual physical) vs 글로벌 dual variant 구분 필요",
      proposedTokens: "이심/듀얼심 + 정발/글로벌 결합 분석",
      regexDraft: "esim_capable axis와 합쳐서 처리 가능",
      comparableKeyValueSet: "esim_capable axis로 흡수",
      precisionRisk: "medium",
      forbiddenInference: "model → dual_sim 추정 금지",
      ownerActionRequired: false,
    },
  ];

  const accuracyMeasurementPlan = [
    "Wave 6 instrumentation 활성화 후 7일 데이터 수집 — title_only/desc_only/ambiguous axis 분포 측정",
    "각 axis regex draft를 sample 200건에 dry-run — precision/recall 측정 (오답률)",
    "false positive 패턴 collect — catalog mustNotContain 보강",
    "owner review queue 통한 ambiguous 사례 학습 → regex 보강 iterate",
    "axis별 readiness threshold 갱신 검토 (axis 추가는 distinct keys 증가 → min_trusted_keys 통과 쉬워짐)",
  ];

  const dependencyOnOtherWaves = [
    "Wave 6 (parser instrumentation) 선행 — measurement 없이 regex 변경 위험",
    "Wave 5 (AI L2 routing) 동시 — silent state는 axis 추가해도 AI L2가 fallback",
    "Wave 1 (schema function) 이미 적용 — 카테고리 매핑 OK",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave7_comparable_key_axis_extension_proposal",
    family: "comparable_key_axis",
    decision: "wave7_comparable_key_axis_extension_proposal_report_only",
    metrics: {
      axesProposed: axisProposals.length,
      ownerActionsRequired: axisProposals.filter((a) => a.ownerActionRequired).length,
      measurementSteps: accuracyMeasurementPlan.length,
      dependencies: dependencyOnOtherWaves.length,
      runtimeApprovedRows: 0,
    },
    axisProposals,
    accuracyMeasurementPlan,
    dependencyOnOtherWaves,
    policyImplications: [
      "axis 확장은 정확도 향상 패치 — 결정론 widening 아님 (LAUNCH_PLAN §0.5 — 정확성 위주 보강은 숫자와 무관하게 허용).",
      "단 silent state 추정은 모든 axis에서 금지 (§12b).",
      "Wave 6 instrumentation이 prerequisite — measurement 없이 regex 적용 금지.",
      "본 packet은 design only — runtime 변경 owner 명시 후 별도 wave.",
    ],
    doNotDo: [
      "Do not apply regex changes to option-parser.ts from this packet",
      "Do not auto-fill axis values from silent state",
      "Do not change comparable_key construction without Wave 6 measurement first",
      "Do not extend axes for categories without sufficient distinct rows (small_appliance/desktop 등 production 0)",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave7-comparable-key-axis-extension-proposal-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 7 — Comparable_Key Axis Extension Proposal",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only proposal packet. comparable_key에 carrier/esim/color/connectivity/dual_sim axis 추가 design. owner 명시 + Wave 6 measurement 선행.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Axis Proposals",
    "",
    ...axisProposals.flatMap((a) => [
      `### ${a.axis}`,
      "",
      `- affectedCategories: ${a.affectedCategories.join(", ")}`,
      `- currentState: ${a.currentState}`,
      `- proposedTokens: ${Array.isArray(a.proposedTokens) ? a.proposedTokens.join(", ") : a.proposedTokens}`,
      `- regexDraft: ${a.regexDraft}`,
      `- comparableKeyValueSet: ${Array.isArray(a.comparableKeyValueSet) ? a.comparableKeyValueSet.join(", ") : a.comparableKeyValueSet}`,
      `- precisionRisk: ${a.precisionRisk}`,
      `- forbiddenInference: ${a.forbiddenInference}`,
      `- ownerActionRequired: ${a.ownerActionRequired ? "YES" : "no"}`,
      "",
    ]),
    "## Accuracy Measurement Plan",
    "",
    ...accuracyMeasurementPlan.map((p, i) => `${i + 1}. ${p}`),
    "",
    "## Dependencies On Other Waves",
    "",
    ...dependencyOnOtherWaves.map((d) => `- ${d}`),
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
  console.log(`wave7 axis-extension: axes=${axisProposals.length}, ownerActions=${axisProposals.filter((a) => a.ownerActionRequired).length}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
