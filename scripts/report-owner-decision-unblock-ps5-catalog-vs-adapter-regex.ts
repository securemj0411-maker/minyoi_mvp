import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "owner_decision_unblock",
    family: "game_console_ps5",
    decision: "owner_decision_unblock_ps5_catalog_vs_adapter_regex_report_only",
    decisionKey: "ps5_catalog_vs_adapter_regex",
    summary:
      "PS5 5 lane (disc_basic / digital_basic / slim_disc_basic / slim_digital_basic + switch_oled_base_unit_only)이 Phase 0 dry-run에서 21/21 fail. 3 원인 (synthetic SKU catalog 부재 / comparable_key mismatch / 풀박·Pro false positive) 연쇄. 결정 필요: catalog narrow SKU 등록 vs adapter regex 보강 vs 둘 다.",
    currentState: {
      ps5LanesFailed: 5,
      dryRunFailRows: 21,
      dryRunFailRate: 1.0,
      catalogPs5NarrowSku: "not_registered (policy-ps5-disc-basic, policy-ps5-digital-basic은 adapter 합성, catalog 미등록)",
      adapterFalsePositiveRate: "100% (sample 21건 — 풀박/Pro/CFI-7022B 매물을 base_unit_only로 흡수)",
      currentLaneStatus: "owner_decision_pending + semantic_pollution",
      runtimeApprovedRows: 0,
    },
    options: [
      {
        id: "A",
        label: "catalog narrow SKU 등록 (runtime 변경)",
        scope:
          "catalog.ts에 PS5 narrow SKU 추가: playstation-5-standard-disc-base-unit-only / playstation-5-standard-digital-base-unit-only / playstation-5-slim-disc / playstation-5-slim-digital. 각 SKU에 mustContain (모델명 + base 본품 명시) + mustNotContain (풀박/Pro/CFI-7022 등) 박음.",
        pros: [
          "결정론으로 PS5 처리 가능 — 정확성 보장",
          "comparable_key mismatch 자동 해결 (catalog가 정답)",
          "synthetic SKU 의존 제거 — adapter 단순화",
        ],
        cons: [
          "runtime catalog 변경 — owner 명시 금지선 위반",
          "PS5 narrow lane 정의 (base vs 풀박 vs Pro)에 대한 정책 결정 선행 필요",
          "기존 시세 데이터 호환성 검토 (comparable_key 변경)",
        ],
        owner_actions_needed: [
          "catalog 변경 명시 승인",
          "PS5 lane 정책 정의 (base_unit_only 기준)",
        ],
      },
      {
        id: "B",
        label: "adapter regex 보강 (runtime 변경 없음)",
        scope:
          "scripts/write-game-console-legacy-detail-adapter.ts의 regex에 hard_hold 추가: '풀박/풀세트/풀구성/풀구성품' + 'CFI-7022/CFI-7020/프로/PRO/Pro Edition' + '디스크 드라이브 별도'. base_unit_only 매물만 통과.",
        pros: [
          "runtime catalog/parser 변경 없음 — 가장 안전",
          "ad-hoc script 영역 — owner 명시 catalog 금지선 무관",
          "빠른 검증 가능 (Phase 0 dry-run 다시 실행)",
        ],
        cons: [
          "synthetic SKU + comparable_key mismatch 근본 해결 안 됨",
          "catalog에 미등록인 채 production 진입 시 executor unknown_sku 실패 여전",
          "regex 정확도 한계 — long-term 유지보수 부담",
        ],
        owner_actions_needed: [
          "regex 보강 키워드 리뷰",
          "regex 검증 후 1차 apply 대상 추가할지 결정",
        ],
      },
      {
        id: "C",
        label: "A + B 둘 다",
        scope:
          "catalog narrow SKU 등록 + adapter regex 보강. comparable_key는 catalog 기준으로 정렬되고, adapter는 regex로 1차 filter 후 catalog로 매핑.",
        pros: [
          "근본 해결 + 안전 1차 filter 둘 다",
          "PS5 5 lane 모두 결정론 진입 가능",
        ],
        cons: [
          "runtime catalog 변경 owner 명시 필요 (옵션 A 단점 동일)",
          "작업량 큼 — 2 wave 소요",
        ],
        owner_actions_needed: [
          "옵션 A 모든 actions",
          "옵션 B 모든 actions",
          "두 변경의 정합성 검증",
        ],
      },
      {
        id: "D",
        label: "PS5 long-term hold — 사업 우선순위 외",
        scope:
          "PS5는 별도 정책 단위로 보류. game_console 카테고리는 switch_oled_base_unit_only도 함께 hold. 가전/테크 closed-set lane에 집중.",
        pros: [
          "변경 없음 — 가장 안전",
          "1차 16 row apply가 이미 동작 중 — PS5 빼고 가전·테크 진행 가능",
        ],
        cons: [
          "game_console 카테고리 ready 승격 무기한 보류",
          "PS5 시장 (높은 turnover) 미진입",
        ],
        owner_actions_needed: [
          "PS5 long-term hold 명시",
        ],
      },
    ],
    recommendation: {
      pick: "B → C",
      reason:
        "B (adapter regex 보강)는 runtime 변경 0 — 빠르게 안전하게 검증 가능. dry-run 21/21 fail → 0으로 떨어지는지 먼저 확인. 그 다음 C (catalog 등록)로 근본 해결. A 단독은 regex filter 없이 catalog만 등록하면 풀박/Pro false positive가 catalog에 도달해 잘못된 매칭 가능.",
      tradeoff: "B 먼저 = 즉시 검증 가능하지만 catalog는 여전히 비어 있음. C 단계로 가야 production-ready.",
    },
    executionStepsIfPickedBThenC: [
      "Step 1 (report-only): adapter regex 보강 design packet — 풀박/Pro/CFI-7022 hard_hold 정확 패턴 + sample 검증",
      "Step 2 (no runtime): write-game-console-legacy-detail-adapter.ts 보강 — ad-hoc script 영역, runtime catalog/parser 변경 0",
      "Step 3 (report-only): Phase 0 dry-run 재실행 (PS5 lane filter) — fail 21/21 → 0 기대",
      "Step 4 (owner 명시): C로 진행 — catalog narrow SKU 등록 owner 승인",
      "Step 5 (owner 명시): PS5 1차 apply (5 lane → INTERNAL_ACQUISITION_WRITE_APPROVED=1 trigger)",
    ],
    blockers: [
      "B Step 2의 adapter regex 패턴 owner 검토 필요",
      "C 진입은 catalog 변경 owner 명시 후",
      "기존 1차 16 row apply와 PS5 추가 apply의 conflict 없음 (별도 lane)",
    ],
    metrics: {
      optionsConsidered: 4,
      recommendationConfidence: 0.85,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "B는 ad-hoc script만 — runtime 금지선 무관. 즉시 진행 가능.",
      "C는 catalog 변경 — owner 명시 필수.",
      "사용자 의도 (사업 진전) + 정확성 원칙 동시 충족.",
    ],
    doNotDo: [
      "Do not register PS5 catalog SKUs without explicit owner approval",
      "Do not relax adapter regex to absorb 풀박/Pro variants — they must remain hard_hold",
      "Do not bypass fresh-refetch safety for PS5 apply",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "owner-decision-unblock-ps5-catalog-vs-adapter-regex-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Owner Decision Unblock — PS5 Catalog vs Adapter Regex",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only owner decision packet. PS5 5 lane (21/21 fail)의 처리 정책 결정 필요.",
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
    "## Execution Steps (B → C)",
    "",
    ...report.executionStepsIfPickedBThenC.map((l) => `- ${l}`),
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
  console.log(`owner-decision ps5: pick=${report.recommendation.pick}, options=${report.options.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
