import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type ReportFile = { metrics?: Record<string, number>; generatedAt?: string };

async function tryReadJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const summary = await tryReadJson<ReportFile>(
    "phones-discovered-anchor-trio-parser-bottleneck-summary-latest.json",
  );
  const trustBlocker = await tryReadJson<ReportFile>(
    "phones-discovered-anchor-trio-comparable-key-trust-blocker-latest.json",
  );
  const inventory = await tryReadJson<ReportFile>(
    "phones-discovered-anchor-trio-option-axis-inventory-latest.json",
  );

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "owner_decision_unblock",
    family: "phones_discovered",
    decision: "owner_decision_unblock_phones_ai_l2_routing_report_only",
    decisionKey: "phones_ai_l2_routing",
    summary:
      "phones_discovered (Galaxy S23 / iPhone 13 / Galaxy S25) anchor trio는 report-only AI L2 candidate family로 확정됨. ready 승격 핵심 병목 = trusted comparable_key 부족 (storage만 인코딩, carrier/self/eSIM/dual_sim/color 5 axis missing). 결정 필요: AI L2 routing을 어떤 형태로 wire할 것인가.",
    currentState: {
      anchorsAnalyzed: 3,
      totalFetched: trustBlocker?.metrics?.sumTotalFetched ?? null,
      parseReady: trustBlocker?.metrics?.sumParseReady ?? null,
      comparableKeyDimensionsConstant: 3,
      missingAxesConstant: 5,
      meanSilentCarrierTrustFactor: trustBlocker?.metrics?.meanSilentCarrierTrustFactor ?? null,
      axesInComparableKey: inventory?.metrics?.axesInComparableKey ?? null,
      runtimeApprovedRows: 0,
      laneStatus: "all 3 anchors = report-only AI L2 candidate (C/C/D 급)",
    },
    options: [
      {
        id: "A",
        label: "AI L2 routing wiring 먼저 (catalog/parser 변경 0)",
        scope:
          "phones narrow self lane row가 결정론에서 needs_review=true 또는 미매칭으로 떨어질 때 AI L2 escrow 큐에 넣고, AI L2 응답으로 owner-decision queue를 채운다. comparable_key는 그대로 family|model|storage.",
        pros: [
          "runtime catalog/parser 변경 없음 — 가장 안전",
          "기존 AI L2 인프라 (이미 dry-run/escrow 존재) 재활용",
          "phones 외 다른 카테고리에도 동일 패턴 재사용 가능",
        ],
        cons: [
          "comparable_key trust는 여전히 부족 — silent state는 AI L2가 매번 판단",
          "AI L2 호출 비용 증가 (cost envelope 필요)",
        ],
        owner_actions_needed: [
          "AI L2 routing 활성화 trigger 명시 (no auto-enable)",
          "tiny cap 정책 (escrow row 수 상한)",
          "AI L2 prompt + cost envelope 검토",
        ],
      },
      {
        id: "B",
        label: "option-parser comparable_key axis 확장 + AI L2 fallback (둘 다)",
        scope:
          "option-parser comparable_key에 carrier / self_unlocked / esim / dual_sim 4 axis 추가 (명시 token만, 추정 금지). 명시 안 된 row는 AI L2 escrow.",
        pros: [
          "comparable_key가 phones에 맞게 깊어짐 — 동일 SKU 매물 분리 정밀",
          "AI L2 부담 감소 (명시 row는 결정론이 처리)",
        ],
        cons: [
          "option-parser.ts runtime 변경 필수 — owner 명시 catalog/parser 금지선 위반",
          "axis 추출 regex 정확도 검증 wave 추가 필요 (instrumentation 먼저)",
          "기존 comparable_key를 쓰던 market price 데이터와 호환성 검토 필요 (migration risk)",
        ],
        owner_actions_needed: [
          "option-parser 변경 owner 명시 승인",
          "axis 추출 regex 정확도 측정 wave (instrumentation 먼저)",
          "기존 market price reset 또는 backfill 정책",
        ],
      },
      {
        id: "C",
        label: "보류 — phones는 long-term internal_only, 다른 카테고리에 집중",
        scope:
          "phones 카테고리 ready 승격을 사실상 long-term 보류. 가전/테크 narrow lane 확장 (Sony A7M4 / Mac mini M2 / Dyson V12 / Roborock S8 등)에 집중. phones는 weekly refresh로 drift만 관찰.",
        pros: [
          "가장 안전 — 변경 없음",
          "open-vocabulary 카테고리 무리하지 않음 (LAUNCH_PLAN §12b 정합)",
          "가전/테크 closed-set lane이 사용자 노출 빠른 경로",
        ],
        cons: [
          "phones 시장 (turnover 큰 카테고리) 미진입",
          "수익 모델 측면 손해 (smartphone resale 거래량 큼)",
        ],
        owner_actions_needed: [
          "phones long-term hold 명시",
          "가전/테크 다음 lane 우선순위 결정",
        ],
      },
    ],
    recommendation: {
      pick: "A",
      reason:
        "정확성 > recall 원칙 + runtime 변경 최소화. A는 catalog/parser 그대로 두고 AI L2 wire만 — instrumentation 없이 즉시 가능. B는 option-parser 변경이 필요해 instrumentation wave가 선행되어야 함 (별도 long-term 트랙). C는 사업 진전이 너무 느려 비추천.",
      tradeoff: "AI L2 호출 비용. cost envelope을 tiny cap (예: 일 100 escrow row)로 묶어 시작.",
    },
    executionStepsIfPickedA: [
      "Step 1 (report-only): AI L2 routing design packet — escrow trigger 조건 / tiny cap 정책 / prompt 형식 / cost envelope 명시",
      "Step 2 (report-only): AI L2 routing dry-run — 실제 매물에 대해 routing 시나리오 시뮬레이션 (no AI call yet)",
      "Step 3 (owner 명시): AI L2 routing 활성화 trigger + tiny cap 환경변수 설정 — owner 명시 후만 runtime enable",
      "Step 4 (report-only): AI L2 escrow queue 측정 packet — escrow row 수, cost, owner-decision queue size",
      "Step 5 (owner 명시): owner-decision queue → candidate_pool 진입 정책 (owner_decision_unblock packet #4 참조)",
    ],
    blockers: [
      "AI L2 인프라 동작 확인 (기존 dry-run 산출물 검토)",
      "cost envelope 명시 (owner 결정)",
      "instrumentation 미존재 — Step 1 design packet에서 어느 row가 escrow 대상인지 정의 필요",
    ],
    metrics: {
      optionsConsidered: 3,
      recommendationConfidence: 0.8,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "이 packet은 owner 결정 unblock용. 결정 자체는 owner가 명시해야 함.",
      "runtime/public/candidate_pool/DDL/catalog/parser 변경 0 (report-only 정리).",
      "사용자 의도 (사업 진전 우선) + LAUNCH_PLAN 원칙 (정확성 > recall) 동시 충족하는 옵션 추천.",
    ],
    doNotDo: [
      "Do not enable AI L2 routing without explicit owner approval",
      "Do not modify option-parser comparable_key from this packet",
      "Do not public-promote any phones lane from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "owner-decision-unblock-phones-ai-l2-routing-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Owner Decision Unblock — Phones AI L2 Routing",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only owner decision packet. Decision required: phones_discovered narrow self lanes의 AI L2 routing을 어떻게 wire할 것인가.",
    "",
    "## Summary",
    "",
    `- ${report.summary}`,
    "",
    "## Current State",
    "",
    ...Object.entries(report.currentState).map(([k, v]) => `- ${k}: ${v}`),
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
    "## Execution Steps (if A picked)",
    "",
    ...report.executionStepsIfPickedA.map((l) => `- ${l}`),
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
  console.log(`owner-decision phones-ai-l2-routing: pick=${report.recommendation.pick}, options=${report.options.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
