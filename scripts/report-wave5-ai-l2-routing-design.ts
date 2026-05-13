import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const escrowTriggerRules = [
    {
      rule: "axis_missing_silent_state",
      detail:
        "comparable_key가 unknown_* marker를 ≥1개 포함하고, 동일한 base SKU의 row 중 명시 token이 있는 row가 같이 존재하는 경우 — silent vs explicit 비교가 가치 있음.",
      sample_categories: ["smartphone", "smartwatch", "tablet", "laptop"],
    },
    {
      rule: "needs_review_true_clean_format",
      detail:
        "needs_review=true이지만 carrier/parts/bundle hard-hold에 해당 안 됨 — title이 clean하지만 description 검토 필요.",
      sample_categories: ["smartphone (silent carrier)", "laptop (silent chip/generation)"],
    },
    {
      rule: "multi_baggage_outlier",
      detail:
        "smartwatch hold-family closure에서 발견된 패턴 — 1 row가 care/cellular/bundle/titanium 4 baggage 동시 보유. 단일 sibling branch 분류 불가. AI L2가 분류 책임.",
      sample_categories: ["smartwatch (S10 46mm adjacent)", "phones (multi-baggage adjacent 추정)"],
    },
  ];

  const costEnvelope = {
    tinyCapDailyEscrowRows: 100,
    perRowMaxCostUsd: 0.03,
    dailyMaxCostUsd: 3.0,
    monthlyMaxCostUsd: 90.0,
    modelChoice: "claude-haiku-4-5 (escrow reviewer 권장) — Opus는 critical decisions만",
    note: "tiny cap은 시작 보수적. 측정 후 점진 확장.",
  };

  const promptShape = {
    inputs: [
      "comparable_key (현 unknown_* 포함)",
      "raw_listing.title + description (description만 별도 표시)",
      "raw_listing.price",
      "candidate base SKU + 가능한 axis 옵션 (예: '아이폰 13 Pro 128GB, color in {그라파이트/실버/골드/시에라블루}')",
      "user_intent: 'fix unknown_storage' 같은 명시 axis",
    ],
    outputs: [
      "decision: 'explicit_match' | 'description_only' | 'ambiguous' | 'hard_hold'",
      "filled_axis_value (if explicit_match)",
      "evidence_quote (title/description snippet)",
      "confidence (0~1)",
      "owner_review_needed: boolean",
    ],
    invariants: [
      "model output은 evidence_quote 없이 axis value 채울 수 없음 — 추정 금지 강제.",
      "ambiguous/hard_hold면 silent fallback 안 함 — owner_review queue로.",
      "confidence < 0.85면 owner_review 강제.",
    ],
  };

  const routingFlow = [
    "Step 1 (parser pipeline): mvp_listing_parsed write 후 needs_review=true OR comparable_key has unknown_* 인 row를 escrow candidate으로 식별.",
    "Step 2 (tiny cap filter): daily quota 100건, 카테고리별 라운드 로빈, 카테고리 internal_only 우선.",
    "Step 3 (AI L2 call): Claude Haiku 4.5에 prompt shape 적용. evidence_quote 필수 강제.",
    "Step 4 (decision write): mvp_ai_l2_decision table에 (pid, decision, axis_value, evidence, confidence) 박음. 별도 새 table — owner 명시 필요.",
    "Step 5 (owner review queue): ambiguous/hard_hold/low_confidence는 별도 owner_review queue로. owner UI 분리.",
    "Step 6 (back-propagation): explicit_match decision은 mvp_listing_parsed.comparable_key 업데이트 — 단 axis 값이 catalog와 충돌하지 않을 때만.",
  ];

  const blockers = [
    "mvp_ai_l2_decision table schema 미존재 — DDL 필요 (owner 결정, 별도 wave)",
    "AI L2 API key + cost monitoring 인프라 점검 필요",
    "기존 ai-l2-* dry-run scripts (`scripts/dry-run-ai-l2-wire.ts` 등) 검토 후 패턴 재사용",
    "owner_review UI / queue 정의 — admin/status 페이지에 신규 섹션 추가 가능",
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave5_ai_l2_routing_design",
    family: "ai_l2_routing",
    decision: "wave5_ai_l2_routing_design_report_only",
    metrics: {
      escrowTriggerRules: escrowTriggerRules.length,
      routingSteps: routingFlow.length,
      blockers: blockers.length,
      tinyCapDailyEscrowRows: costEnvelope.tinyCapDailyEscrowRows,
      dailyMaxCostUsd: costEnvelope.dailyMaxCostUsd,
      runtimeApprovedRows: 0,
    },
    escrowTriggerRules,
    costEnvelope,
    promptShape,
    routingFlow,
    blockers,
    targetCategories: [
      { category: "smartphone", reason: "axis missing 5 (carrier/self/esim/dual_sim/color) — semantic_pollution_hold 영역. AI L2가 유일 정답." },
      { category: "laptop", reason: "unknown_generation 49% — 결정론 금지. AI L2 정답." },
      { category: "tablet", reason: "unknown_storage 15% description-only — AI L2 보조." },
      { category: "smartwatch", reason: "unknown_connectivity 38% silent — AI L2 보조 (hold family closure 정합)." },
    ],
    policyImplications: [
      "AI L2 routing은 silent-state row의 정답 (LAUNCH_PLAN §6 AI L2 escrow reviewer).",
      "tiny cap 100/day로 시작 — owner 명시 후만 활성. 측정 후 확장.",
      "evidence_quote 강제로 모델 추정 차단 (LAUNCH_PLAN §12b 정합).",
      "owner_review queue가 ambiguous를 받음 — 결정론 widening 우회 차단.",
      "본 packet은 design only. 실 wiring은 owner 명시 후 별도 wave.",
    ],
    doNotDo: [
      "Do not enable AI L2 routing without explicit owner approval + cost envelope confirmation",
      "Do not auto-update comparable_key from low-confidence AI L2 decisions",
      "Do not bypass evidence_quote requirement",
      "Do not let AI L2 override parser hard-hold (sold/inactive/accessory/parts/bundle/buying/counterfeit)",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave5-ai-l2-routing-design-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 5 — AI L2 Routing Design",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only design packet. silent-state row를 AI L2 escrow로 보내는 routing flow 정의. owner 명시 후 wiring.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Escrow Trigger Rules",
    "",
    ...escrowTriggerRules.flatMap((r) => [`### ${r.rule}`, "", `- detail: ${r.detail}`, `- sample_categories: ${r.sample_categories.join(", ")}`, ""]),
    "## Cost Envelope (tiny cap 시작)",
    "",
    ...Object.entries(costEnvelope).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Prompt Shape",
    "",
    "### Inputs",
    "",
    ...promptShape.inputs.map((i) => `- ${i}`),
    "",
    "### Outputs",
    "",
    ...promptShape.outputs.map((o) => `- ${o}`),
    "",
    "### Invariants",
    "",
    ...promptShape.invariants.map((i) => `- ${i}`),
    "",
    "## Routing Flow",
    "",
    ...routingFlow.map((s, i) => `${i + 1}. ${s}`),
    "",
    "## Target Categories",
    "",
    "| category | reason |",
    "|---|---|",
    ...report.targetCategories.map((c) => `| ${c.category} | ${c.reason} |`),
    "",
    "## Blockers",
    "",
    ...blockers.map((b) => `- ${b}`),
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
  console.log(`wave5 ai-l2-routing-design: tinyCap=${costEnvelope.tinyCapDailyEscrowRows}/day, dailyMaxUsd=${costEnvelope.dailyMaxCostUsd}, blockers=${blockers.length}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
