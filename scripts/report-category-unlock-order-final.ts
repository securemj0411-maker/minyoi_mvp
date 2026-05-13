import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type AnyReport = { metrics?: Record<string, number | string>; generatedAt?: string };

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const wave3 = await readJson<AnyReport>("wave3-production-replay-measurement-latest.json");
  const wave4 = await readJson<AnyReport>("wave4-tablet-laptop-axis-gap-diagnostic-latest.json");
  const wave5 = await readJson<AnyReport>("wave5-ai-l2-routing-design-latest.json");
  const wave6 = await readJson<AnyReport>("wave6-parser-instrumentation-design-latest.json");
  const wave7 = await readJson<AnyReport>("wave7-comparable-key-axis-extension-proposal-latest.json");
  const wave8 = await readJson<AnyReport>("wave8-tech-narrow-lane-preflight-latest.json");
  const priorityTable = await readJson<AnyReport>("category-unblock-priority-table-latest.json");

  // Final unlock order — measurement based.
  type UnlockEntry = {
    order: number;
    category: string;
    bucket: "ready_now" | "owner_decision_only" | "lane_build_first" | "ai_l2_only" | "parser_extension_required";
    currentReadiness: "ready" | "internal_only" | "blocked";
    keyMetric: string;
    blockingFix: string;
    estimatedEffort: string;
    businessImpact: "high" | "medium" | "low";
    nextOwnerAction: string;
  };

  const unlockOrder: UnlockEntry[] = [
    {
      order: 1,
      category: "monitor",
      bucket: "ready_now",
      currentReadiness: "internal_only",
      keyMetric: "production rows=7, distinct SKU=4, parse rate=100%. min_pool=3 ✅ / min_keys=3 ✅ / min_parse=0.85 ✅",
      blockingFix: "readiness UPDATE status='ready' (owner_decision only, runtime/parser 변경 0)",
      estimatedEffort: "minutes",
      businessImpact: "high",
      nextOwnerAction: "UPDATE mvp_category_readiness SET status='ready' WHERE category='monitor'; — owner 명시 후",
    },
    {
      order: 2,
      category: "earphone",
      bucket: "ready_now",
      currentReadiness: "ready",
      keyMetric: "이미 ready 상태 (Wave 0). distinct keys=17, needs_review_false=88.4%.",
      blockingFix: "유지 — 추가 lane (AirPods Pro 3 / Beats Solo 4 등) narrow 등록만",
      estimatedEffort: "ongoing",
      businessImpact: "medium",
      nextOwnerAction: "(없음 — 이미 ready)",
    },
    {
      order: 3,
      category: "smartwatch",
      bucket: "ready_now",
      currentReadiness: "ready",
      keyMetric: "이미 ready. 단 hold family closure (S9/S10 thickening 보류).",
      blockingFix: "유지 — Ultra2 / SE3 narrow lane 확장만",
      estimatedEffort: "ongoing",
      businessImpact: "medium",
      nextOwnerAction: "(없음 — 이미 ready)",
    },
    {
      order: 4,
      category: "speaker",
      bucket: "lane_build_first",
      currentReadiness: "internal_only",
      keyMetric: "production rows=6, distinct SKU=1 (JBL Flip 6만). min_keys=3 미달 (1<3).",
      blockingFix: "추가 narrow lane (Bose SoundLink Flex / Sonos Roam) mining + catalog + apply",
      estimatedEffort: "days",
      businessImpact: "high",
      nextOwnerAction: "Wave 8 sequence — mining v3 → catalog 등록 → apply → readiness UPDATE",
    },
    {
      order: 5,
      category: "tablet",
      bucket: "parser_extension_required",
      currentReadiness: "internal_only",
      keyMetric: "production 2333 row, distinct keys=207 ✅, needs_review_false=84.1% (<0.88 min_parse 미달). unknown_storage 15%.",
      blockingFix: "Wave 7 — tablet storage axis regex 보강 (option-parser runtime change). Wave 6 instrumentation 선행.",
      estimatedEffort: "weeks",
      businessImpact: "high",
      nextOwnerAction: "Wave 6 (DDL + flag) + Wave 7 (regex 보강) 순차 — owner 명시 필요",
    },
    {
      order: 6,
      category: "camera",
      bucket: "lane_build_first",
      currentReadiness: "internal_only",
      keyMetric: "production 0 row. mining lane_config 부재. catalog SKU unverified.",
      blockingFix: "Wave 8 — Sony A7M4 / Canon EOS narrow lane mining + catalog + apply",
      estimatedEffort: "days",
      businessImpact: "medium",
      nextOwnerAction: "Wave 8 sequence (mining → catalog → apply)",
    },
    {
      order: 7,
      category: "desktop",
      bucket: "lane_build_first",
      currentReadiness: "internal_only",
      keyMetric: "production 0 row. mining lane_config 부재.",
      blockingFix: "Wave 8 — Mac mini M2 narrow lane (Apple closed-set 안전)",
      estimatedEffort: "days",
      businessImpact: "low",
      nextOwnerAction: "Wave 8 sequence",
    },
    {
      order: 8,
      category: "home_appliance",
      bucket: "lane_build_first",
      currentReadiness: "internal_only",
      keyMetric: "production 0 row. mining lane_config 부재.",
      blockingFix: "Wave 8 — Dyson V12 / Roborock S8 narrow lane",
      estimatedEffort: "days",
      businessImpact: "low",
      nextOwnerAction: "Wave 8 sequence",
    },
    {
      order: 9,
      category: "game_console",
      bucket: "owner_decision_only",
      currentReadiness: "internal_only",
      keyMetric: "PS5 21건 Phase 0 fail (synthetic SKU + comparable_key mismatch + 풀박/Pro false positive).",
      blockingFix: "owner_decision_unblock packet #2 — adapter regex (B) → catalog (C) sequence",
      estimatedEffort: "days",
      businessImpact: "medium",
      nextOwnerAction: "owner-decision-unblock packet #2 결정 (B → C 추천)",
    },
    {
      order: 10,
      category: "laptop",
      bucket: "ai_l2_only",
      currentReadiness: "internal_only",
      keyMetric: "distinct keys=688 ✅, needs_review_false=34.6% (<0.85 미달). unknown_generation 49% — 결정론 금지.",
      blockingFix: "Wave 5 AI L2 routing (generation/chip 추정 금지로 결정론 천장 33% 근처).",
      estimatedEffort: "weeks",
      businessImpact: "high",
      nextOwnerAction: "Wave 5 AI L2 routing wiring — owner 명시 후",
    },
    {
      order: 11,
      category: "smartphone",
      bucket: "ai_l2_only",
      currentReadiness: "internal_only",
      keyMetric: "phones anchor-trio bottleneck wave 확정: axis missing 5 (carrier/self/esim/dual_sim/color). 결정론 ready 영원 불가.",
      blockingFix: "Wave 5 AI L2 routing (silent-state 정답). Wave 7 axis 확장은 long-term option.",
      estimatedEffort: "weeks",
      businessImpact: "high",
      nextOwnerAction: "Wave 5 AI L2 wiring (Wave 7 axis 확장은 instrumentation 선행)",
    },
  ];

  const buckets = {
    ready_now: unlockOrder.filter((u) => u.bucket === "ready_now"),
    owner_decision_only: unlockOrder.filter((u) => u.bucket === "owner_decision_only"),
    lane_build_first: unlockOrder.filter((u) => u.bucket === "lane_build_first"),
    parser_extension_required: unlockOrder.filter((u) => u.bucket === "parser_extension_required"),
    ai_l2_only: unlockOrder.filter((u) => u.bucket === "ai_l2_only"),
  };

  const headline =
    "11 카테고리 unlock order 측정 기반 정렬. **monitor**가 즉시 ready 후보 (Wave 1+2 이미 적용 + production rows 충족). speaker/camera/desktop/home_appliance는 Wave 8 narrow lane sequence. tablet은 Wave 6+7 (parser instrumentation + axis 보강). laptop/smartphone은 Wave 5 AI L2 routing이 정답. game_console은 owner-decision-unblock packet #2 결정.";

  const nextImplementationWave = {
    label: "Wave 9 — monitor 카테고리 readiness UPDATE (status='internal_only' → 'ready')",
    rationale:
      "측정 기반 즉시 unlock 가능. production rows=7, distinct SKU=4 (XL2540K / 27GL650F / 27US550 / 39GX900A), needs_review_false=100%. Wave 2 thresholds (min_pool=3, min_keys=3, min_parse=0.85) 모두 충족 ✅. owner_decision only — runtime/catalog/parser 변경 0.",
    expectedEffect:
      "monitor 7 row가 candidate_pool 진입 가능 상태 (pool_eligible=true update + scoreStage trigger는 별도 owner 명시). 사용자 노출은 monitor → ready 승격 후에도 별도 trigger 필요.",
    ownerActionSql:
      "UPDATE mvp_category_readiness SET status='ready', updated_at=now() WHERE category='monitor';",
    rollback:
      "UPDATE mvp_category_readiness SET status='internal_only' WHERE category='monitor';",
    blockers:
      "owner 명시만 필요. 다른 blocker 없음. user-impact는 pool_eligible UPDATE + scoreStage trigger 시점에 발생 — 별도 결정.",
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "category_unlock_order_final",
    family: "all_categories",
    decision: "category_unlock_order_final_report_only",
    headline,
    unlockOrder,
    buckets: {
      ready_now: buckets.ready_now.map((u) => u.category),
      owner_decision_only: buckets.owner_decision_only.map((u) => u.category),
      lane_build_first: buckets.lane_build_first.map((u) => u.category),
      parser_extension_required: buckets.parser_extension_required.map((u) => u.category),
      ai_l2_only: buckets.ai_l2_only.map((u) => u.category),
    },
    nextImplementationWave,
    metrics: {
      categoriesTotal: unlockOrder.length,
      readyNow: buckets.ready_now.length,
      ownerDecisionOnly: buckets.owner_decision_only.length,
      laneBuildFirst: buckets.lane_build_first.length,
      parserExtensionRequired: buckets.parser_extension_required.length,
      aiL2Only: buckets.ai_l2_only.length,
      waveSourcePackets: 7,
      runtimeApprovedRows: 0,
    },
    upstreamWaves: {
      wave3: wave3?.generatedAt ?? null,
      wave4: wave4?.generatedAt ?? null,
      wave5: wave5?.generatedAt ?? null,
      wave6: wave6?.generatedAt ?? null,
      wave7: wave7?.generatedAt ?? null,
      wave8: wave8?.generatedAt ?? null,
      priorityTable: priorityTable?.generatedAt ?? null,
    },
    policyImplications: [
      "unlock order는 측정 기반 자동 — 각 카테고리는 metric 기반 bucket 분류.",
      "ready_now bucket은 owner_decision only — 가장 빠른 unlock.",
      "다른 bucket은 별도 wave 선행 (lane build / parser extension / AI L2).",
      "본 packet은 종합 인덱스. 어떤 변경도 자동 안 함.",
    ],
    doNotDo: [
      "Do not promote any category to ready without owner explicit trigger",
      "Do not lower thresholds to move categories between buckets",
      "Do not infer silent state into deterministic comparable_key (laptop/smartphone)",
      "Do not skip Wave 6 instrumentation before Wave 7 axis extension",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "category-unlock-order-final-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Category Unlock Order — FINAL",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `**${headline}**`,
    "",
    "## Buckets",
    "",
    `- **ready_now**: ${report.buckets.ready_now.join(", ") || "(none)"}`,
    `- **owner_decision_only**: ${report.buckets.owner_decision_only.join(", ") || "(none)"}`,
    `- **lane_build_first**: ${report.buckets.lane_build_first.join(", ") || "(none)"}`,
    `- **parser_extension_required**: ${report.buckets.parser_extension_required.join(", ") || "(none)"}`,
    `- **ai_l2_only**: ${report.buckets.ai_l2_only.join(", ") || "(none)"}`,
    "",
    "## Unlock Order (측정 기반)",
    "",
    "| # | category | bucket | readiness | impact | effort | key metric |",
    "|---:|---|---|---|---|---|---|",
    ...unlockOrder.map((u) => `| ${u.order} | ${u.category} | ${u.bucket} | ${u.currentReadiness} | ${u.businessImpact} | ${u.estimatedEffort} | ${u.keyMetric} |`),
    "",
    "## Per-Category Detail",
    "",
    ...unlockOrder.flatMap((u) => [
      `### ${u.order}. ${u.category} (bucket=${u.bucket}, impact=${u.businessImpact})`,
      "",
      `- currentReadiness: ${u.currentReadiness}`,
      `- keyMetric: ${u.keyMetric}`,
      `- blockingFix: ${u.blockingFix}`,
      `- estimatedEffort: ${u.estimatedEffort}`,
      `- nextOwnerAction: ${u.nextOwnerAction}`,
      "",
    ]),
    "## Next Implementation Wave (이번 wave 끝나면 바로 다음)",
    "",
    `- **label**: ${nextImplementationWave.label}`,
    `- rationale: ${nextImplementationWave.rationale}`,
    `- expectedEffect: ${nextImplementationWave.expectedEffect}`,
    `- ownerActionSql: \`${nextImplementationWave.ownerActionSql}\``,
    `- rollback: \`${nextImplementationWave.rollback}\``,
    `- blockers: ${nextImplementationWave.blockers}`,
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
  console.log(`unlock-order-final: readyNow=${report.metrics.readyNow}, laneBuild=${report.metrics.laneBuildFirst}, parserExt=${report.metrics.parserExtensionRequired}, aiL2=${report.metrics.aiL2Only}, ownerOnly=${report.metrics.ownerDecisionOnly}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
