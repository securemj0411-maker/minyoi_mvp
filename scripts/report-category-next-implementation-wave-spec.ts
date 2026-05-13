import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type PriorityRow = {
  category: string;
  bucket: "immediate_unlock" | "parser_strengthen_first" | "semantic_pollution_hold";
  rank: number;
  reasoning: string;
  fixSequence: string[];
  blockerSummary: string;
  estimatedTotalEffort: string;
  businessImpact: "high" | "medium" | "low";
};

type PriorityReport = {
  buckets: {
    immediate_unlock: PriorityRow[];
    parser_strengthen_first: PriorityRow[];
    semantic_pollution_hold: PriorityRow[];
  };
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

type WaveStep = {
  order: number;
  scope: string;
  fixOwner: string;
  changeType: "schema_function" | "readiness_row" | "report_only_packet" | "ad_hoc_script" | "ai_l2_routing_design";
  affectedCategories: string[];
  effort: string;
  precondition: string[];
  artifact: string;
  ownerActionRequired: boolean;
};

async function main(): Promise<void> {
  const priority = await readJson<PriorityReport>("category-unblock-priority-table-latest.json");

  const immediate = priority.buckets.immediate_unlock.map((r) => r.category);
  const parserFirst = priority.buckets.parser_strengthen_first.map((r) => r.category);
  const pollutionHold = priority.buckets.semantic_pollution_hold.map((r) => r.category);

  // 가장 보수적 + 사업 unblock 큰 순서로 wave 구성. 변경 작은 것부터.
  const steps: WaveStep[] = [];
  let order = 1;

  // Wave 1: mvp_category_from_comparable_key() schema function 보강 — monitor/speaker/camera/desktop/game_console/home_appliance 매핑 추가. 한 번에 5+ category unblock.
  const unmappedCategories = ["monitor", "speaker", "camera", "desktop", "game_console", "home_appliance"];
  steps.push({
    order: order++,
    scope: `mvp_category_from_comparable_key() schema function에 6 카테고리 매핑 추가 (${unmappedCategories.join(", ")})`,
    fixOwner: "schema_function_update",
    changeType: "schema_function",
    affectedCategories: unmappedCategories,
    effort: "minutes",
    precondition: ["owner approval — DDL function update"],
    artifact: "schema migration patch + supabase apply_migration",
    ownerActionRequired: true,
  });

  // Wave 2: mvp_category_readiness row INSERT/UPDATE — monitor/speaker/camera/desktop/game_console/home_appliance INSERT. 보수적 thresholds (min_parse_rate 0.85 / min_trusted_keys 3~5).
  steps.push({
    order: order++,
    scope: `mvp_category_readiness row INSERT — ${unmappedCategories.join(", ")} (status=internal_only로 일단 등록 + 보수적 thresholds)`,
    fixOwner: "owner_decision",
    changeType: "readiness_row",
    affectedCategories: unmappedCategories,
    effort: "minutes",
    precondition: ["Wave 1 완료 — schema function이 카테고리 인식해야 readiness row가 의미 있음"],
    artifact: "SQL INSERT 6 row to mvp_category_readiness with status='internal_only', min_ready_pool=3, min_parse_rate=0.85, min_trusted_keys=3",
    ownerActionRequired: true,
  });

  // Wave 3: closed-set + narrow lane 측정 wave — monitor/speaker/camera/game_console 등에 대해 lane-level parsed/needs_review 측정 (report-only, no runtime change)
  steps.push({
    order: order++,
    scope: "monitor/speaker/camera/game_console lane-level production replay 측정 packet — needs_review_false / comparable_key_complete share / distinct keys per lane",
    fixOwner: "report_only_wave",
    changeType: "report_only_packet",
    affectedCategories: ["monitor", "speaker", "camera", "game_console"],
    effort: "hours",
    precondition: ["Wave 1+2 완료 — 카테고리 매핑 가능해야 production replay 측정 의미 있음"],
    artifact: "category-lane-level-production-replay-latest packet (per-category needs_review_false / comparable_key_complete share)",
    ownerActionRequired: false,
  });

  // Wave 4: tablet/laptop comparable_key complete share 보강 wave — 측정만, runtime 변경 0
  steps.push({
    order: order++,
    scope: "tablet/laptop comparable_key complete share 보강 — option-parser unknown_* marker가 어떤 axis에서 누락되는지 측정 (axis-level diagnostic packet)",
    fixOwner: "report_only_wave",
    changeType: "report_only_packet",
    affectedCategories: ["tablet", "laptop"],
    effort: "hours",
    precondition: ["기존 phones anchor-trio option-axis-inventory 패턴 재사용"],
    artifact: "tablet-laptop-comparable-key-axis-gap-diagnostic-latest packet",
    ownerActionRequired: false,
  });

  // Wave 5: AI L2 routing design — pollution_hold 카테고리 (smartphone + 가능하면 home_appliance) + parser_strengthen_first 카테고리의 silent-state row를 위한 routing 설계. report-only.
  steps.push({
    order: order++,
    scope: `AI L2 routing design packet — ${pollutionHold.join(", ")} (pollution hold) + silent-state row 전반. cost envelope + tiny cap + escrow trigger 정의. report-only 설계.`,
    fixOwner: "ai_l2_routing",
    changeType: "ai_l2_routing_design",
    affectedCategories: [...pollutionHold, "smartphone"],
    effort: "days",
    precondition: ["기존 phones anchor-trio summary 활용", "AI L2 인프라 기존 dry-run 산출물 검토"],
    artifact: "ai-l2-routing-design-latest packet (silent-state slice 정의 + cost envelope + escrow policy)",
    ownerActionRequired: false,
  });

  // Wave 6: parser instrumentation design — description-only signal coverage 측정 가능한 production parser 로깅 설계. report-only.
  steps.push({
    order: order++,
    scope: "production parser instrumentation design — title vs description token 위치 로깅 schema 설계. parser_strengthen_first 카테고리의 description-only 신호 측정 가능하게.",
    fixOwner: "report_only_wave",
    changeType: "report_only_packet",
    affectedCategories: parserFirst,
    effort: "hours",
    precondition: ["phones anchor-trio title-vs-description packet 산출 패턴 재사용"],
    artifact: "parser-instrumentation-design-latest packet (로깅 shape + retention + 측정 metric)",
    ownerActionRequired: false,
  });

  // Wave 7: option-parser comparable_key axis 확장 proposal — runtime change 영역. 본 wave에서는 design만 (실제 변경 owner 명시 별도).
  steps.push({
    order: order++,
    scope: "option-parser comparable_key axis 확장 proposal packet — carrier/self_unlocked/esim/dual_sim/color axes 추가 design. 명시 token만, 추정 금지. report-only.",
    fixOwner: "runtime_parser_change",
    changeType: "report_only_packet",
    affectedCategories: ["smartphone", "tablet", "laptop"],
    effort: "days",
    precondition: ["Wave 6 instrumentation design 완료 — 추출 정확도 측정 가능한 setup 선행"],
    artifact: "comparable-key-axis-extension-proposal-latest packet (per-axis regex + 정확도 측정 plan)",
    ownerActionRequired: false,
  });

  // Wave 8: lane-level acquisition expansion — 가전·테크 narrow lane (Mac mini M2, Sony A7M4, Dyson V12, Roborock S8) preflight + dry-run. report-only 검증까지만.
  steps.push({
    order: order++,
    scope: "tech/가전 narrow lane expansion preflight + dry-run packets — Mac mini M2 / Sony A7M4 / Dyson V12 / Roborock S8 / Monitor LG UltraFine / Monitor Samsung Odyssey",
    fixOwner: "report_only_wave",
    changeType: "report_only_packet",
    affectedCategories: ["desktop", "camera", "home_appliance", "monitor"],
    effort: "hours",
    precondition: ["Wave 1+2 (category 매핑 + readiness row) 완료"],
    artifact: "tech-narrow-lane-acquisition-preflight-latest + per-lane dry-run packets",
    ownerActionRequired: false,
  });

  const summary = {
    headline:
      "가전/IT 카테고리 전반을 ready로 승격하기 위한 8-step implementation wave. 가장 보수적 (DB row update + schema function) 먼저, 사업 unblock 큰 순서로 정렬. report-only 분석 wave는 자동 진행 가능, owner_decision 필요 step은 명시 표시.",
    immediate_unlock_categories: immediate,
    parser_strengthen_first_categories: parserFirst,
    semantic_pollution_hold_categories: pollutionHold,
    totalSteps: steps.length,
    ownerActionsRequired: steps.filter((s) => s.ownerActionRequired).length,
    reportOnlySteps: steps.filter((s) => !s.ownerActionRequired).length,
  };

  const nextWaveAfterThisOne = {
    nextLabel: "Wave 1 — schema function update",
    nextOwnerAction:
      "mvp_category_from_comparable_key() function에 monitor/speaker/camera/desktop/game_console/home_appliance 매핑 추가. supabase apply_migration. owner 명시 후만.",
    nextReportOnlyChain: [
      "Wave 1 후 Wave 3 (lane-level production replay) 진행 — owner 결정 없이 report-only",
      "동시에 Wave 4 (tablet/laptop axis gap diagnostic) 진행 가능",
      "동시에 Wave 5 (AI L2 routing design) 진행 가능",
      "Wave 6 (instrumentation design) 진행 가능",
      "Wave 8 (가전 lane preflight) 진행 가능",
    ],
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "category_next_implementation_wave_spec",
    family: "all_categories",
    decision: "category_next_implementation_wave_spec_report_only",
    summary,
    steps,
    nextWaveAfterThisOne,
    metrics: {
      steps: steps.length,
      ownerActionsRequired: summary.ownerActionsRequired,
      reportOnlySteps: summary.reportOnlySteps,
      immediateCategories: immediate.length,
      parserStrengthenCategories: parserFirst.length,
      pollutionHoldCategories: pollutionHold.length,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "8-step wave는 dependency-map + priority-table에서 도출. 측정 기반 자동 우선순위.",
      "owner_decision step은 명시 표시 (Wave 1, Wave 2). 나머지는 report-only 자동 진행 가능.",
      "Wave 1 + Wave 2가 모든 후속 wave의 foundation — 둘은 owner 명시 후 진행.",
      "그 후 Wave 3~8는 supervisor에 등록해서 자동 실행 가능.",
    ],
    doNotDo: [
      "Do not skip Wave 1 (schema function update) — 후속 measurement가 무의미해짐",
      "Do not bulk-promote categories to ready without Wave 3 (lane-level production replay) 측정",
      "Do not infer silent state into deterministic comparable_key (Wave 7은 axis 명시 token만)",
      "Do not collapse pollution_hold categories into deterministic ready",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "category-next-implementation-wave-spec-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Category Next Implementation Wave Spec",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `**${summary.headline}**`,
    "",
    "## Bucket Categories",
    "",
    `- immediate_unlock (ready 또는 owner_decision/schema_function만 필요): ${summary.immediate_unlock_categories.join(", ")}`,
    `- parser_strengthen_first: ${summary.parser_strengthen_first_categories.join(", ") || "(none)"}`,
    `- semantic_pollution_hold (AI L2 target): ${summary.semantic_pollution_hold_categories.join(", ") || "(none)"}`,
    "",
    "## Implementation Wave Steps",
    "",
    "| order | scope | fixOwner | effort | ownerActionRequired | precondition |",
    "|---:|---|---|---|---|---|",
    ...steps.map(
      (s) =>
        `| ${s.order} | ${s.scope} | ${s.fixOwner} | ${s.effort} | ${s.ownerActionRequired ? "YES" : "no"} | ${s.precondition.join("; ")} |`,
    ),
    "",
    "## Per-Step Detail",
    "",
    ...steps.flatMap((s) => [
      `### Wave ${s.order} — ${s.scope}`,
      "",
      `- fixOwner: ${s.fixOwner}`,
      `- changeType: ${s.changeType}`,
      `- affectedCategories: ${s.affectedCategories.join(", ")}`,
      `- effort: ${s.effort}`,
      `- precondition: ${s.precondition.join("; ")}`,
      `- artifact: ${s.artifact}`,
      `- ownerActionRequired: ${s.ownerActionRequired ? "YES" : "no"}`,
      "",
    ]),
    "## Next Wave (immediately after this packet)",
    "",
    `- nextLabel: ${nextWaveAfterThisOne.nextLabel}`,
    `- nextOwnerAction: ${nextWaveAfterThisOne.nextOwnerAction}`,
    "- nextReportOnlyChain (자동 가능):",
    ...nextWaveAfterThisOne.nextReportOnlyChain.map((c) => `  - ${c}`),
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
  console.log(
    `category-next-implementation-wave-spec: steps=${steps.length}, ownerActions=${summary.ownerActionsRequired}, reportOnlyChain=${summary.reportOnlySteps}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
