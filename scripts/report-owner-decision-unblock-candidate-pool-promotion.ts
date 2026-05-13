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
    family: "candidate_pool_promotion",
    decision: "owner_decision_unblock_candidate_pool_promotion_report_only",
    decisionKey: "candidate_pool_internal_to_public_promotion",
    summary:
      "1차 acquisition apply 16 row (monitor + JBL + iPad)가 internal_only 상태로 mvp_raw_listings/mvp_listing_parsed에 들어가 있음. pool_eligible=false. 결정 필요: 이 16 row를 candidate_pool에 진입시켜 실제 사용자 팩 노출 시작할 것인가, 진입시킨다면 어떤 cap/gate로.",
    currentState: {
      rowsApplied: 16,
      poolEligibleNow: 0,
      candidatePoolEntered: 0,
      packReveal: "38/38 (기존 candidate pool 동작 중)",
      userExposureFromFirstWaveRows: 0,
      userBlockerSummary:
        "현재 user가 팩에서 보는 candidate는 기존 candidate_pool (구 데이터). 1차 16 row는 internal_only로 들어가 있지만 candidate_pool 미진입 → 사용자에게 노출 안 됨.",
      runtimeApprovedRows: 0,
    },
    options: [
      {
        id: "A",
        label: "tiny cap (예: 5 row) trial 승격",
        scope:
          "16 row 중 5 row만 candidate_pool 진입. cap 작게 시작해서 pack reveal / user 반응 측정 후 확장.",
        pros: [
          "사용자 노출 시작 — 사업 진전",
          "tiny cap으로 실패 시 영향 최소",
          "기존 candidate_pool 동작 검증된 상태에서 안전 진입",
        ],
        cons: [
          "5 row는 통계적 의미 약함 — 측정 지표 흔들림",
          "어떤 5 row 선택할지 cherry-pick 정책 필요",
        ],
        owner_actions_needed: [
          "cap 명시 (5 row)",
          "선택 정책 명시 (예: lane별 균등 / 최고 confidence / 무작위)",
          "INTERNAL_ACQUISITION_WRITE_APPROVED + pool_eligible 업데이트 trigger",
        ],
      },
      {
        id: "B",
        label: "전체 16 row 일괄 승격",
        scope:
          "1차 wave 16 row 모두 candidate_pool 진입. pool_eligible=true 일괄 update.",
        pros: [
          "lane 다양성 (3 lane) 그대로 사용자 노출",
          "측정 지표 신뢰도 (16 row는 trial로 적당)",
          "다음 lane 확장 (packet #3) 전에 user 반응 측정 가능",
        ],
        cons: [
          "한 번에 모두 노출 — 잘못 분류 시 user impact 큼 (단 dry-run 100% pass + fresh-refetch SOLD 제외 안전 검증됨)",
          "candidate_pool 진입 시 다른 시스템 (market price, pack reveal logic)과 상호작용 검증 필요",
        ],
        owner_actions_needed: [
          "전체 승격 명시 승인",
          "pool_eligible=true update + 관련 cron 정상 동작 검증",
        ],
      },
      {
        id: "C",
        label: "보류 — 다음 lane 추가 후 한 번에 승격",
        scope:
          "1차 16 row + 2차 wave (next-lane-apply packet #3) lane 결과를 합쳐 candidate_pool 한 번에 진입.",
        pros: [
          "lane 다양성 더 큼 (3+α lane)",
          "한 번의 승격으로 측정 시작",
        ],
        cons: [
          "사용자 노출 시점 지연",
          "lane 추가 wave 자체가 owner 결정 (packet #3) 선행 필요",
          "데이터 축적 후 일괄 진입 = 잘못 분류 시 영향 큼",
        ],
        owner_actions_needed: [
          "packet #3 결정 선행",
          "두 wave 합쳐 승격 명시",
        ],
      },
      {
        id: "D",
        label: "internal_only 유지 — 사용자 노출 무기한 보류",
        scope:
          "candidate_pool 진입 안 함. 내부 분석/측정만. 사용자 노출은 기존 candidate_pool로 운영.",
        pros: [
          "가장 안전 — 변경 0",
          "측정 후 한참 뒤 진입 결정 가능",
        ],
        cons: [
          "1차 wave 작업이 사용자 경험에 reach 못 함 — 사업 진전 0",
          "core mission (사용자가 팩에서 진짜 상품 뽑기) 미충족",
        ],
        owner_actions_needed: [
          "internal_only 유지 명시",
        ],
      },
    ],
    recommendation: {
      pick: "A → B",
      reason:
        "사용자 의도 (사업 진전 + 사용자 노출) + 정확성 원칙 둘 다 충족. A (tiny 5 row trial)로 시작해 pack reveal / user 클릭 / 신뢰도 측정. 정상 동작 확인 후 B (16 row 전체) 확장. C는 packet #3 결정 선행으로 지연. D는 미션과 정면 충돌.",
      tradeoff:
        "A는 5 row → trial 기간 1~2주 측정. B는 즉시 16 전체. 사용자가 빠르게 가고 싶으면 A를 short trial (3~5일)로 짧게 후 B 진행 가능.",
    },
    executionStepsIfPickedAThenB: [
      "Step 1 (report-only): tiny cap 5 row 선택 정책 design packet — lane별 균등 (monitor 2 + JBL 2 + iPad 1) + confidence 점수 정렬",
      "Step 2 (owner 명시): candidate_pool 진입 trigger — pool_eligible=true update + 관련 cron (pool-warmer / candidate-pool-builder) 동작 확인",
      "Step 3 (report-only): trial 기간 (3~5일) 측정 packet — pack reveal rate / candidate match / user 반응",
      "Step 4 (owner 명시): trial 결과 정상이면 B (전체 16 row) 승격 명시",
      "Step 5 (report-only): post-promotion 측정 — source_health, leak, conflict",
    ],
    blockers: [
      "candidate_pool 진입 시 mvp_market_price_daily + velocity_daily 와 호환성 검증 필요",
      "pool-warmer cron의 pool_eligible filter 동작 확인",
      "pack-open RPC가 신규 candidate 매칭하는지 검증",
    ],
    metrics: {
      optionsConsidered: 4,
      recommendationConfidence: 0.85,
      runtimeApprovedRows: 0,
    },
    policyImplications: [
      "본 결정은 미니 미션 (사용자 팩에서 진짜 상품) 달성 여부의 직접 trigger.",
      "어떤 옵션도 자동 안 함 — owner 명시 trigger 필수.",
      "candidate_pool 진입 후에도 public promotion (카테고리 전체 ready) 은 별도 결정.",
    ],
    doNotDo: [
      "Do not bulk-promote rows to candidate_pool without owner explicit trigger",
      "Do not skip pack-open RPC compatibility check before promotion",
      "Do not promote rows without leak-check pre/post verification",
      "Do not public-promote categories from this packet (candidate_pool ≠ public ready)",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "owner-decision-unblock-candidate-pool-promotion-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Owner Decision Unblock — Candidate Pool Promotion",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only owner decision packet. 1차 16 row를 candidate_pool에 진입시킬지 결정.",
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
    "## Execution Steps (A → B)",
    "",
    ...report.executionStepsIfPickedAThenB.map((l) => `- ${l}`),
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
  console.log(`owner-decision candidate-pool-promotion: pick=${report.recommendation.pick}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
