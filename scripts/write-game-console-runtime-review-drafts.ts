import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type GameConsoleVerification = {
  detail?: {
    inLane?: number;
    baseUnitOnly?: number;
    reviewAiL2Manual?: number;
    hardHold?: number;
    sold?: number;
  };
  priceStatsBaseUnit?: { count?: number; median?: number };
  priceStatsLive?: { count?: number; min?: number; median?: number; max?: number };
};

type LaneDraftSpec = {
  laneId: string;
  category: string;
  target: string;
  generationLabel: string;
  editionLabel: string;
  policyHighlights: string[];
};

const lanes: LaneDraftSpec[] = [
  {
    laneId: "switch_oled_base_unit_only",
    category: "game_console_discovered",
    target: "Nintendo Switch OLED (base unit only)",
    generationLabel: "OLED",
    editionLabel: "base unit only",
    policyHighlights: [
      "본체 + 기본 구성 (조이콘 좌/우 일체, 도크, 스탠드, 그립, HDMI 케이블, AC 어댑터)만 comparable",
      "게임 1~2개 동봉은 자동 통과 금지 — AI L2/manual review",
      "풀세트, 다수 게임 (3+), 프로콘, 추가 액세서리 번들은 hard hold",
      "Switch 2 / Switch Lite는 wrong_model 차단",
    ],
  },
  {
    laneId: "ps5_disc_basic",
    category: "game_console_discovered",
    target: "PS5 Standard Disc (basic — 1 controller)",
    generationLabel: "Standard",
    editionLabel: "Disc",
    policyHighlights: [
      "본체 + 기본 컨트롤러 1개 + 케이블 (HDMI, USB-C, 전원) + 박스 = comparable",
      "추가 컨트롤러, 게임 포함, 충전거치대, 헤드셋, 스킨/스티커는 AI L2/manual review",
      "풀세트, 다수 게임 (3+), 다수 컨트롤러 (3+)는 hard hold",
      "Digital 통합 금지 — 가격 차이 약 50k 확인 (Disc 530k vs Digital 480k)",
      "Slim, Pro와 통합 금지",
    ],
  },
  {
    laneId: "ps5_digital_basic",
    category: "game_console_discovered",
    target: "PS5 Standard Digital (basic — 1 controller)",
    generationLabel: "Standard",
    editionLabel: "Digital",
    policyHighlights: [
      "본체 + 기본 컨트롤러 1개 + 케이블 = comparable (디스크 드라이브 없음)",
      "추가 컨트롤러/게임/액세서리는 AI L2/manual review",
      "풀세트, 다수 게임/컨트롤러는 hard hold",
      "Disc 통합 금지 — Digital 시세 별도 (median 480k)",
      "Slim, Pro와 통합 금지",
    ],
  },
  {
    laneId: "ps5_slim_disc_basic",
    category: "game_console_discovered",
    target: "PS5 Slim Disc (basic — 1 controller)",
    generationLabel: "Slim",
    editionLabel: "Disc",
    policyHighlights: [
      "본체 + 기본 컨트롤러 1개 + 케이블 = comparable",
      "추가 컨트롤러/게임/액세서리는 AI L2/manual review",
      "풀세트, 다수 게임/컨트롤러는 hard hold",
      "Standard, Pro와 통합 금지 — 세대별 시세 다름 (Slim Disc median 690k)",
      "Slim Digital과도 정책상 통합 금지 (시장 가격 수렴 관찰됐지만 lane 분리 유지)",
    ],
  },
  {
    laneId: "ps5_slim_digital_basic",
    category: "game_console_discovered",
    target: "PS5 Slim Digital (basic — 1 controller)",
    generationLabel: "Slim",
    editionLabel: "Digital",
    policyHighlights: [
      "본체 + 기본 컨트롤러 1개 + 케이블 = comparable (디스크 드라이브 없음)",
      "추가 컨트롤러/게임/액세서리는 AI L2/manual review",
      "풀세트, 다수 게임/컨트롤러는 hard hold",
      "Standard, Pro와 통합 금지",
      "Slim Disc와 정책상 통합 금지 (median 동일 690k 관찰)",
    ],
  },
];

function slug(category: string, target: string): string {
  return `${category}-${target}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildJson(draftSpec: LaneDraftSpec, verification: GameConsoleVerification, generatedAt: string) {
  const baseUnit = verification.detail?.baseUnitOnly ?? 0;
  const live = (verification.detail?.inLane ?? 0) - (verification.detail?.sold ?? 0);
  const median = verification.priceStatsBaseUnit?.median ?? 0;

  return {
    generatedAt,
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    category: draftSpec.category,
    target: draftSpec.target,
    score: baseUnit,
    allowedRows: baseUnit,
    maxFutureWriteCap: baseUnit,
    requestedScope: [
      `Review only the narrow game_console target ${draftSpec.target}.`,
      ...draftSpec.policyHighlights.map((h) => `Policy: ${h}`),
      "Require same-request fresh detail verification and active sale status before any future internal-only write.",
      "Do not treat this as game_console category readiness or public candidate-pack approval.",
    ],
    explicitNonScope: [
      "public promotion",
      "candidate pool wiring",
      "Supabase schema or DB writes",
      "cron/lifecycle/debug/pack UI changes",
      "broad category readiness changes",
      "AI pass overriding parser hard holds",
      "merging Disc/Digital editions",
      "merging Standard/Slim/Pro generations",
    ],
    approvalChecklist: [
      `owner chooses ${draftSpec.category}/${draftSpec.target} narrow runtime review`,
      "owner confirms parser/runtime change remains non-public until separate approval",
      "owner confirms no candidate-pool wiring",
      "owner confirms no production DB/Supabase writes",
      `owner confirms max future internal-only write cap <= ${baseUnit}`,
      "owner confirms same-request fresh detail refetch is required before any later write executor",
      "owner confirms game console policy (wave2 owner decision) remains authoritative",
    ],
    evidence: {
      detailVerification: `reports/${draftSpec.laneId}-no-write-verification-latest.md`,
      baseUnitOnly: baseUnit,
      inLane: verification.detail?.inLane ?? 0,
      live,
      sold: verification.detail?.sold ?? 0,
      reviewAiL2Manual: verification.detail?.reviewAiL2Manual ?? 0,
      hardHold: verification.detail?.hardHold ?? 0,
      baseUnitMedianKrw: median,
      samplingNote: "Bunjang live search × 5 queries → detail fetch. ad-hoc policy regex (catalog/runtime patch 없음). DB write 0, candidate-pool 0, public 0.",
    },
    requestText: `Request explicit owner/main-agent approval for a narrow ${draftSpec.category}/${draftSpec.target} runtime review under the wave2 game console policy. base_unit_only ${baseUnit}, median ${median.toLocaleString()} KRW. Generation: ${draftSpec.generationLabel}. Edition: ${draftSpec.editionLabel}.`,
    nextStep:
      "Stop here unless owner/main-agent explicitly approves narrow runtime review or more live/report-only collection. Require source_health healthy + pool_eligible/score_dirty migration approval before any acquisition apply. Maintain Disc/Digital and Standard/Slim/Pro lane separation.",
  };
}

function buildMarkdown(draftSpec: LaneDraftSpec, draft: ReturnType<typeof buildJson>) {
  return `# ${draftSpec.category} Runtime Review Request Draft — ${draftSpec.target}

Generated: ${draft.generatedAt}

Report-only draft for a possible separate narrow runtime review request. This does not grant approval.

## Metrics

- target: ${draftSpec.target}
- generation: ${draftSpec.generationLabel}
- edition: ${draftSpec.editionLabel}
- base_unit_only (score / allowedRows / maxFutureWriteCap): ${draft.score}
- base unit median price: ${draft.evidence.baseUnitMedianKrw.toLocaleString()} KRW

## Evidence

- detail verification: [reports/${draftSpec.laneId}-no-write-verification-latest.md](${draftSpec.laneId}-no-write-verification-latest.md)
- base_unit_only: ${draft.evidence.baseUnitOnly}
- in-lane: ${draft.evidence.inLane} (live ${draft.evidence.live}, sold ${draft.evidence.sold})
- review (AI L2/manual): ${draft.evidence.reviewAiL2Manual}
- hard_hold: ${draft.evidence.hardHold}

## Request Text

${draft.requestText}

## Requested Scope

${draft.requestedScope.map((s) => `- ${s}`).join("\n")}

## Explicit Non-Scope

${draft.explicitNonScope.map((s) => `- ${s}`).join("\n")}

## Approval Checklist

${draft.approvalChecklist.map((s) => `- ${s}`).join("\n")}

## Next Step

${draft.nextStep}
`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const written: string[] = [];

  for (const draftSpec of lanes) {
    const verificationPath = path.join(reportsDir, `${draftSpec.laneId}-no-write-verification-latest.json`);
    if (!existsSync(verificationPath)) {
      console.warn(`SKIP ${draftSpec.laneId}: verification file missing`);
      continue;
    }
    const verification = JSON.parse(await readFile(verificationPath, "utf8")) as GameConsoleVerification;
    const draft = buildJson(draftSpec, verification, generatedAt);
    const fileSlug = slug(draftSpec.category, draftSpec.target);
    const jsonFile = `runtime-review-request-draft-${fileSlug}-latest.json`;
    const mdFile = `runtime-review-request-draft-${fileSlug}-latest.md`;
    await writeFile(path.join(reportsDir, jsonFile), `${JSON.stringify(draft, null, 2)}\n`);
    await writeFile(path.join(reportsDir, mdFile), buildMarkdown(draftSpec, draft));
    written.push(jsonFile, mdFile);
    console.log(`wrote ${jsonFile} + ${mdFile} (base ${draft.score})`);
  }

  console.log(`\ndrafts written: ${written.length / 2}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
