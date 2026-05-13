import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type Packet = {
  decisionKey?: string;
  summary?: string;
  recommendation?: { pick?: string; reason?: string };
  metrics?: Record<string, number>;
};

async function tryReadJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const phonesAiL2 = await tryReadJson<Packet>("owner-decision-unblock-phones-ai-l2-routing-latest.json");
  const ps5 = await tryReadJson<Packet>("owner-decision-unblock-ps5-catalog-vs-adapter-regex-latest.json");
  const nextLane = await tryReadJson<Packet>("owner-decision-unblock-next-lane-apply-latest.json");
  const pool = await tryReadJson<Packet>("owner-decision-unblock-candidate-pool-promotion-latest.json");

  const decisions = [
    { id: 1, key: phonesAiL2?.decisionKey, summary: phonesAiL2?.summary, recommendation: phonesAiL2?.recommendation, packet: "owner-decision-unblock-phones-ai-l2-routing-latest" },
    { id: 2, key: ps5?.decisionKey, summary: ps5?.summary, recommendation: ps5?.recommendation, packet: "owner-decision-unblock-ps5-catalog-vs-adapter-regex-latest" },
    { id: 3, key: nextLane?.decisionKey, summary: nextLane?.summary, recommendation: nextLane?.recommendation, packet: "owner-decision-unblock-next-lane-apply-latest" },
    { id: 4, key: pool?.decisionKey, summary: pool?.summary, recommendation: pool?.recommendation, packet: "owner-decision-unblock-candidate-pool-promotion-latest" },
  ];

  const headline =
    "사업 진전 unblock = 4개 owner decision. 자동화 packet은 정보만 정리 — 결정은 owner가 한 줄 명시해야 사업이 움직임. 추천 sequence: #4 (candidate_pool tiny trial) → #3 (다음 lane apply) → #2 (PS5 regex 보강) → #1 (phones AI L2 routing).";

  const recommendedSequence = [
    {
      order: 1,
      decisionKey: "candidate_pool_internal_to_public_promotion",
      pick: pool?.recommendation?.pick ?? "A → B",
      rationale:
        "가장 빠른 사용자 노출 경로. 1차 16 row 이미 internal_only로 있음. tiny cap 5 row trial → 측정 → 전체 16 row 승격. 미니 미션 (팩에서 진짜 상품) 직접 충족.",
    },
    {
      order: 2,
      decisionKey: "next_lane_apply",
      pick: nextLane?.recommendation?.pick ?? "D 먼저, 그 다음 A",
      rationale:
        "1차 wave 패턴 검증된 상태에서 Mac mini M2 + Sony A7M4 추가. lane 다양성 확장. catalog 기존 등록 활용 (확인 필요).",
    },
    {
      order: 3,
      decisionKey: "ps5_catalog_vs_adapter_regex",
      pick: ps5?.recommendation?.pick ?? "B → C",
      rationale:
        "B (adapter regex)는 runtime 변경 0 — 즉시 검증 가능. dry-run 21/21 fail이 0이 되는지 확인. 그 후 C (catalog 등록)는 owner 명시 필요한 별도 wave.",
    },
    {
      order: 4,
      decisionKey: "phones_ai_l2_routing",
      pick: phonesAiL2?.recommendation?.pick ?? "A",
      rationale:
        "AI L2 routing wiring (catalog/parser 변경 0). instrumentation 없이 즉시 진행 가능하지만 cost envelope 결정 필요. 위 3개보다 우선순위 낮음 (가전·테크 closed-set lane이 더 빠른 사용자 노출 경로).",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "owner_decision_unblock",
    family: "summary",
    decision: "owner_decision_unblock_summary_report_only",
    headline,
    decisions,
    recommendedSequence,
    metrics: {
      decisionsPending: decisions.length,
      decisionsResolved: 0,
      runtimeApprovedRows: 0,
    },
    coreMissionAlignment: {
      mission: "사용자가 팩에서 진짜 상품을 뽑을 수 있어야 한다 (CLAUDE.md / LAUNCH_PLAN.md 코어).",
      gap: "현재 1차 16 row internal_only — 사용자 노출 0. wave 노가다는 정보 정리 ratchet에 머무름.",
      unblockPath:
        "위 4 decision 중 #4 (candidate_pool tiny trial)이 핵심. 이거 한 번에 미니 미션 충족 시작. 나머지 3개는 lane 다양성 / 확장 / 비용 측면.",
    },
    automationAlignment: {
      runners: [
        "npm run report:wave -- --wave all-weekly (smartwatch + phones)",
        "npm run report:wave -- --wave owner-decision-unblock (이 packet wave)",
        "node --import tsx scripts/run-report-supervisor.ts --concurrency 5 (전체 family 병렬)",
      ],
      note:
        "자동화는 report-only 노가다를 줄여 owner decision 집중 여력 확보용. 자동화 도구 자체는 사업 진전 아님 — owner decision 4개가 사업 진전 trigger.",
    },
    policyImplications: [
      "이 summary는 owner가 한 번에 4 decision 보고 우선순위 정해 결정 던지도록 정리.",
      "각 decision은 별도 packet에 옵션/권장/실행step 박혀있음 — 본 summary는 인덱스.",
      "어떤 옵션도 자동 실행 안 함 — owner 명시 trigger 필수.",
    ],
    doNotDo: [
      "Do not execute any recommendation without explicit owner decision trigger",
      "Do not collapse 4 decisions into a single bulk decision — each has different risk profile",
      "Do not delay #4 (candidate_pool) for the others — it's the user-exposure unlock",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "owner-decision-unblock-summary-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Owner Decision Unblock — Summary",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `**${headline}**`,
    "",
    "## Core Mission Alignment",
    "",
    `- mission: ${report.coreMissionAlignment.mission}`,
    `- gap: ${report.coreMissionAlignment.gap}`,
    `- unblockPath: ${report.coreMissionAlignment.unblockPath}`,
    "",
    "## Recommended Decision Sequence",
    "",
    "| order | decisionKey | pick | rationale |",
    "|---:|---|---|---|",
    ...recommendedSequence.map((s) => `| ${s.order} | ${s.decisionKey} | ${s.pick} | ${s.rationale} |`),
    "",
    "## Decisions (Indexed Packet Pointers)",
    "",
    "| id | decisionKey | recommendation | packet |",
    "|---:|---|---|---|",
    ...decisions.map((d) => `| ${d.id} | ${d.key ?? "-"} | ${d.recommendation?.pick ?? "-"} | ${d.packet} |`),
    "",
    "## Automation Alignment",
    "",
    "- runners:",
    ...report.automationAlignment.runners.map((r) => `  - ${r}`),
    `- note: ${report.automationAlignment.note}`,
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`owner-decision-summary: decisions=${decisions.length}, recommendedSequence=${recommendedSequence.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
