import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(file: string, fallback: T): T {
  const filePath = path.join(reportDir, file);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

type LaneReplay = {
  lane: string;
  total: number;
  skuMatchPct: string;
  laneMatchPct: string;
  parseReadyPct: string;
  needsReviewFalsePct: string;
  unknownPartsPct: string;
  comparableKeyCompletePct: string;
  grade: string;
  nextAction: string;
};

type ExpansionRow = {
  lane: string;
  stage: string;
  reason: string;
  next: string;
};

type BoardLane = {
  lane: string;
  fetched: number;
  activeClean: number;
  reviewRows: number;
  readiness: string;
  next: string;
  blocker: string;
  evidence: string;
};

type DetailVerification = {
  detail?: {
    fetched?: number;
    activeClean?: number;
    sold?: number;
    review?: number;
    fetchFailed?: number;
  };
  proshopOrOfficialCount?: number;
  reasonHistogram?: Record<string, number>;
  priceStats?: { count: number; min: number; median: number; max: number };
};

type LegacyDetailVerification = {
  activeClean?: number;
  holdOrReview?: number;
  detailFetched?: number;
  bundlePriceReview?: number;
  packageReview?: number;
};

type CategoryGroup = { key: string; label: string; lanes: string[] };

const CATEGORY_GROUPS: CategoryGroup[] = [
  { key: "monitor", label: "모니터", lanes: ["monitor_discovered", "monitor_exact_model_code"] },
  { key: "speaker_audio", label: "스피커/오디오", lanes: ["speaker_audio_discovered", "speaker_jbl_flip6"] },
  { key: "camera", label: "카메라", lanes: ["camera_discovered", "camera_body_only_exact_model"] },
  { key: "desktop_pc", label: "데스크탑/PC", lanes: ["desktop_pc_discovered", "desktop_private_used_cpu_gpu"] },
  { key: "home_appliance", label: "가전/홈 어플라이언스", lanes: ["home_appliance_tech_discovered", "home_appliance_stick_vacuum"] },
  {
    key: "game_console",
    label: "게임 콘솔",
    lanes: [
      "game_console_discovered",
      "game_console_body_narrow",
      "switch_oled_base_unit_only",
      "ps5_disc_basic",
      "ps5_digital_basic",
      "ps5_slim_disc_basic",
      "ps5_slim_digital_basic",
      "ps5_pro_basic",
      "switch_oled",
      "ps5_disc_digital_standard",
      "ps5_slim",
    ],
  },
  {
    key: "tablet_evidence",
    label: "태블릿 (evidence 있는 lane)",
    lanes: [
      "ipad_pro_11_m4_256_wifi",
      "ipad_pro_13_m4_256_wifi",
      "ipad_air_m2_11_256_wifi",
      "ipad_air_m3_11_256_wifi",
      "ipad_pro_11_m2_256_wifi",
      "ipad_mini_7_128_wifi",
      "ipad_pro_13_m2_256_wifi",
      "ipad_pro_13_m2_refined_wifi",
      "galaxy_tab_s10_ultra_256_self",
    ],
  },
  {
    key: "laptop_evidence",
    label: "노트북 (evidence 있는 lane)",
    lanes: ["macbook_air_m2_13_256", "macbook_air_m3_13_256", "macbook_pro_14_m3_18_512", "lg_gram_17_2024", "lg_gram_17_2024_modelcode"],
  },
  {
    key: "smartphone_evidence",
    label: "스마트폰 (evidence 있는 lane)",
    lanes: [
      "iphone_11_pro_128gb_self",
      "iphone_12_pro_128gb_self",
      "iphone_13_pro_128gb_self",
      "iphone_14_pro_128gb_self",
      "iphone_15_pro_128gb_self",
      "iphone_16_pro_128gb_self",
      "galaxy_s23_ultra_256_self",
      "galaxy_s24_ultra_256_self",
      "galaxy_s25_ultra_256_self",
      "galaxy_z_flip_5_256_self",
    ],
  },
];

const DETAIL_FILE_MAP: Record<string, { file: string; legacy: boolean }> = {
  monitor_exact_model_code: { file: "monitor-exact-no-write-detail-verification-latest.json", legacy: true },
  speaker_jbl_flip6: { file: "jbl-flip6-no-write-detail-verification-latest.json", legacy: true },
  camera_body_only_exact_model: { file: "camera-body-exact-no-write-detail-verification-latest.json", legacy: true },
  ps5_disc_digital_standard: { file: "ps5-disc-digital-no-write-detail-verification-latest.json", legacy: true },
  ps5_slim: { file: "ps5-slim-no-write-detail-verification-latest.json", legacy: true },
  switch_oled: { file: "switch-oled-no-write-detail-verification-latest.json", legacy: true },
  ipad_pro_11_m4_256_wifi: { file: "ipad-pro-11-m4-no-write-detail-verification-latest.json", legacy: true },
  ipad_pro_13_m2_refined_wifi: { file: "ipad-pro-13-m2-refined-no-write-detail-verification-latest.json", legacy: true },
  ipad_air_m3_11_256_wifi: { file: "ipad_air_m3_11_256_wifi-no-write-verification-latest.json", legacy: false },
  switch_oled_base_unit_only: { file: "switch_oled_base_unit_only-no-write-verification-latest.json", legacy: false },
  ps5_disc_basic: { file: "ps5_disc_basic-no-write-verification-latest.json", legacy: false },
  ps5_digital_basic: { file: "ps5_digital_basic-no-write-verification-latest.json", legacy: false },
  ps5_slim_disc_basic: { file: "ps5_slim_disc_basic-no-write-verification-latest.json", legacy: false },
  ps5_slim_digital_basic: { file: "ps5_slim_digital_basic-no-write-verification-latest.json", legacy: false },
  ps5_pro_basic: { file: "ps5_pro_basic-no-write-verification-latest.json", legacy: false },
};

function pctNum(value: string | number | undefined): number {
  if (value === undefined) return 0;
  if (typeof value === "number") return value;
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

type LaneInfo = {
  lane: string;
  inLaneReplay: boolean;
  inExpansion: boolean;
  inBoard: boolean;
  sampleTotal: number;
  skuMatchPct: number;
  comparableKeyCompletePct: number;
  needsReviewFalsePct: number;
  unknownPartsPct: number;
  grade: string;
  replayNextAction: string;
  expansionStage: string;
  expansionReason: string;
  expansionNext: string;
  boardReadiness: string;
  boardFetched: number;
  boardActiveClean: number;
  boardReviewRows: number;
  boardBlocker: string;
  detailFetched: number;
  detailActiveClean: number;
  detailSold: number;
  detailReview: number;
  detailProshop: number;
  topReasons: Array<{ reason: string; count: number }>;
  priceMin: number;
  priceMedian: number;
  priceMax: number;
};

function buildLaneInfo(
  lane: string,
  replayMap: Map<string, LaneReplay>,
  expansionMap: Map<string, ExpansionRow>,
  boardMap: Map<string, BoardLane>,
): LaneInfo {
  const replay = replayMap.get(lane);
  const expansion = expansionMap.get(lane);
  const board = boardMap.get(lane);

  let detailFetched = board?.fetched ?? 0;
  let detailActiveClean = board?.activeClean ?? 0;
  let detailSold = 0;
  let detailReview = board?.reviewRows ?? 0;
  let detailProshop = 0;
  let topReasons: Array<{ reason: string; count: number }> = [];
  let priceMin = 0;
  let priceMedian = 0;
  let priceMax = 0;

  const detailEntry = DETAIL_FILE_MAP[lane];
  if (detailEntry) {
    if (detailEntry.legacy) {
      const legacy = readJson<LegacyDetailVerification>(detailEntry.file, {});
      detailFetched = legacy.detailFetched ?? detailFetched;
      detailActiveClean = legacy.activeClean ?? detailActiveClean;
      detailReview = legacy.holdOrReview ?? legacy.bundlePriceReview ?? legacy.packageReview ?? detailReview;
    } else {
      const newFormat = readJson<DetailVerification>(detailEntry.file, {});
      detailFetched = newFormat.detail?.fetched ?? detailFetched;
      detailActiveClean = newFormat.detail?.activeClean ?? detailActiveClean;
      detailSold = newFormat.detail?.sold ?? 0;
      detailReview = newFormat.detail?.review ?? detailReview;
      detailProshop = newFormat.proshopOrOfficialCount ?? 0;
      topReasons = Object.entries(newFormat.reasonHistogram ?? {})
        .map(([reason, count]) => ({ reason, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      priceMin = newFormat.priceStats?.min ?? 0;
      priceMedian = newFormat.priceStats?.median ?? 0;
      priceMax = newFormat.priceStats?.max ?? 0;
    }
  }

  return {
    lane,
    inLaneReplay: Boolean(replay),
    inExpansion: Boolean(expansion),
    inBoard: Boolean(board),
    sampleTotal: replay?.total ?? 0,
    skuMatchPct: pctNum(replay?.skuMatchPct),
    comparableKeyCompletePct: pctNum(replay?.comparableKeyCompletePct),
    needsReviewFalsePct: pctNum(replay?.needsReviewFalsePct),
    unknownPartsPct: pctNum(replay?.unknownPartsPct),
    grade: replay?.grade ?? "—",
    replayNextAction: replay?.nextAction ?? "—",
    expansionStage: expansion?.stage ?? "—",
    expansionReason: expansion?.reason ?? "—",
    expansionNext: expansion?.next ?? "—",
    boardReadiness: board?.readiness ?? "—",
    boardFetched: board?.fetched ?? 0,
    boardActiveClean: board?.activeClean ?? 0,
    boardReviewRows: board?.reviewRows ?? 0,
    boardBlocker: board?.blocker ?? "—",
    detailFetched,
    detailActiveClean,
    detailSold,
    detailReview,
    detailProshop,
    topReasons,
    priceMin,
    priceMedian,
    priceMax,
  };
}

type Status =
  | "owner_review_ready"
  | "deterministic_stop_ready"
  | "needs_ai_l2"
  | "needs_more_mining"
  | "blocked_market_noise"
  | "blocked_policy_decision";

function classifyStatus(info: LaneInfo): { status: Status; reason: string } {
  if (info.boardReadiness === "owner_review_tiny_acquisition_design_ready") {
    return { status: "owner_review_ready", reason: `detail-verified activeClean=${info.detailActiveClean}/${info.detailFetched}` };
  }

  // policy-blocked: switch/ps5/game console bundle decisions
  if (/^(switch_oled|ps5_|game_console_body_narrow)/.test(info.lane)) {
    if (info.detailActiveClean !== undefined && info.detailActiveClean < 4) {
      return { status: "blocked_policy_decision", reason: `bundle/full-set/edition policy 미정; activeClean=${info.detailActiveClean}/${info.detailFetched}` };
    }
  }

  // detail-verified but market noise
  if (info.detailFetched > 0) {
    const rate = info.detailFetched > 0 ? info.detailActiveClean / info.detailFetched : 0;
    if (rate < 0.3) {
      return {
        status: "blocked_market_noise",
        reason: `activeClean rate ${(rate * 100).toFixed(0)}% (bundle/sold/proshop 압력 또는 표본 오염)`,
      };
    }
  }

  // deterministic_stop: A급 + nextAction stop
  if (info.replayNextAction === "stop_deterministic_patching_watch_leaks" && info.sampleTotal >= 30) {
    return { status: "deterministic_stop_ready", reason: `A급 결정론 완성 (sku ${info.skuMatchPct.toFixed(1)}%, sample ${info.sampleTotal})` };
  }

  // small sample → needs_more_mining
  if (info.sampleTotal > 0 && info.sampleTotal < 30) {
    return { status: "needs_more_mining", reason: `표본 ${info.sampleTotal}건 (mining 또는 query 정제 필요)` };
  }

  // ai_l2 routing
  if (info.expansionStage === "ai_l2_escrow" || /ambiguity|ai_l2|escrow/.test(info.expansionReason)) {
    return { status: "needs_ai_l2", reason: info.expansionReason || "AI L2 영역" };
  }

  if (info.expansionStage === "collect_only") {
    return { status: "needs_more_mining", reason: info.expansionReason || "query/scope 정제 필요" };
  }

  return { status: "needs_more_mining", reason: "표본 또는 evidence 부족" };
}

function nextActionLabel(info: LaneInfo, status: Status): string {
  switch (status) {
    case "owner_review_ready":
      return "✅ owner 승인 시 internal acquisition 진입";
    case "deterministic_stop_ready":
      return "🟢 결정론 완성 — leak 감시만";
    case "needs_ai_l2":
      return "🤖 AI L2 영역 — FK/cache approval 후 escrow";
    case "needs_more_mining":
      return "📊 표본/쿼리 보강";
    case "blocked_market_noise":
      return "⚠️ 시장 노이즈 — bundle/sold 정책 또는 표본 재정의";
    case "blocked_policy_decision":
      return "🚫 정책 결정 대기 (owner)";
  }
}

function publicReadyEstimate(info: LaneInfo, status: Status): string {
  if (status === "owner_review_ready") {
    return "owner-review 통과 + source_health healthy + DDL approval + acquisition apply + pack quality 검증 후 narrow lane 단위 공개 후보";
  }
  if (status === "deterministic_stop_ready") {
    return "결정론 자체는 완성. 별도 detail/live verification 후 narrow lane 공개 가능성 있음 (현재 evidence 부족)";
  }
  return "현재 단계에서 narrow lane 공개 비대상";
}

function deterministicVsAiL2(info: LaneInfo, status: Status): "deterministic_more_possible" | "deterministic_stop" | "ai_l2" | "more_mining" | "policy" {
  if (status === "owner_review_ready" || status === "deterministic_stop_ready") return "deterministic_stop";
  if (status === "blocked_policy_decision") return "policy";
  if (status === "blocked_market_noise" || status === "needs_more_mining") return "more_mining";
  if (status === "needs_ai_l2") return "ai_l2";
  if (info.replayNextAction === "precision_stop_or_one_small_patch_then_stop") return "deterministic_more_possible";
  return "ai_l2";
}

async function main() {
  const replay = readJson<{ lanes?: LaneReplay[] }>("lane-replay-readiness-latest.json", { lanes: [] });
  const expansion = readJson<{ rows?: ExpansionRow[] }>("internal-acquisition-expansion-plan-latest.json", { rows: [] });
  const board = readJson<{ lanes?: BoardLane[] }>("exact-acquisition-readiness-board-latest.json", { lanes: [] });

  const replayMap = new Map<string, LaneReplay>((replay.lanes ?? []).map((l) => [l.lane, l]));
  const expansionMap = new Map<string, ExpansionRow>((expansion.rows ?? []).map((r) => [r.lane, r]));
  const boardMap = new Map<string, BoardLane>((board.lanes ?? []).map((l) => [l.lane, l]));

  const result = CATEGORY_GROUPS.map((group) => {
    const lanes = group.lanes.map((lane) => {
      const info = buildLaneInfo(lane, replayMap, expansionMap, boardMap);
      const { status, reason } = classifyStatus(info);
      const route = deterministicVsAiL2(info, status);
      return {
        ...info,
        status,
        statusReason: reason,
        nextActionLabel: nextActionLabel(info, status),
        publicReady: publicReadyEstimate(info, status),
        route,
      };
    });

    const summary = {
      laneCount: lanes.length,
      ownerReviewReady: lanes.filter((l) => l.status === "owner_review_ready").length,
      deterministicStop: lanes.filter((l) => l.status === "deterministic_stop_ready").length,
      needsAiL2: lanes.filter((l) => l.status === "needs_ai_l2").length,
      needsMoreMining: lanes.filter((l) => l.status === "needs_more_mining").length,
      blockedMarketNoise: lanes.filter((l) => l.status === "blocked_market_noise").length,
      blockedPolicyDecision: lanes.filter((l) => l.status === "blocked_policy_decision").length,
      publicReadyEligible: lanes.filter((l) => l.status === "owner_review_ready").length,
    };

    return { category: group.key, label: group.label, summary, lanes };
  });

  const output = {
    generatedAt: new Date().toISOString(),
    scope: "category_convergence_map",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    candidatePoolPatch: false,
    categories: result,
    grandTotal: {
      lanesAnalyzed: result.reduce((acc, c) => acc + c.summary.laneCount, 0),
      ownerReviewReady: result.reduce((acc, c) => acc + c.summary.ownerReviewReady, 0),
      deterministicStop: result.reduce((acc, c) => acc + c.summary.deterministicStop, 0),
      needsAiL2: result.reduce((acc, c) => acc + c.summary.needsAiL2, 0),
      needsMoreMining: result.reduce((acc, c) => acc + c.summary.needsMoreMining, 0),
      blockedMarketNoise: result.reduce((acc, c) => acc + c.summary.blockedMarketNoise, 0),
      blockedPolicyDecision: result.reduce((acc, c) => acc + c.summary.blockedPolicyDecision, 0),
    },
  };

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "category-convergence-map-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

  const md: string[] = [];
  md.push("# Category Convergence Map (가전/테크 결정론 수렴 지도)");
  md.push("");
  md.push(`- generatedAt: ${output.generatedAt}`);
  md.push("- mode: report_only_no_write");
  md.push("- runtimeMutation / supabaseMutation / publicPromotion / candidatePool: false / false / false / false");
  md.push("");
  md.push("## Grand Total");
  md.push("");
  md.push("| status | count |");
  md.push("| --- | ---: |");
  md.push(`| ✅ owner_review_ready | ${output.grandTotal.ownerReviewReady} |`);
  md.push(`| 🟢 deterministic_stop_ready | ${output.grandTotal.deterministicStop} |`);
  md.push(`| 🤖 needs_ai_l2 | ${output.grandTotal.needsAiL2} |`);
  md.push(`| 📊 needs_more_mining | ${output.grandTotal.needsMoreMining} |`);
  md.push(`| ⚠️ blocked_market_noise | ${output.grandTotal.blockedMarketNoise} |`);
  md.push(`| 🚫 blocked_policy_decision | ${output.grandTotal.blockedPolicyDecision} |`);
  md.push(`| **total lanes analyzed** | **${output.grandTotal.lanesAnalyzed}** |`);
  md.push("");

  for (const cat of result) {
    md.push(`## ${cat.label} (\`${cat.category}\`)`);
    md.push("");
    md.push(`- lane count: ${cat.summary.laneCount}`);
    md.push(
      `- distribution: owner_review ${cat.summary.ownerReviewReady} / det_stop ${cat.summary.deterministicStop} / ai_l2 ${cat.summary.needsAiL2} / more_mining ${cat.summary.needsMoreMining} / market_noise ${cat.summary.blockedMarketNoise} / policy ${cat.summary.blockedPolicyDecision}`,
    );
    md.push("");
    md.push("| lane | status | sku% | complete% | sample | activeClean | sold/proshop | next |");
    md.push("| --- | --- | ---: | ---: | ---: | --- | --- | --- |");
    for (const l of cat.lanes) {
      const statusEmoji = ({
        owner_review_ready: "✅",
        deterministic_stop_ready: "🟢",
        needs_ai_l2: "🤖",
        needs_more_mining: "📊",
        blocked_market_noise: "⚠️",
        blocked_policy_decision: "🚫",
      } as const)[l.status];
      const activeCleanCell = l.detailFetched > 0
        ? `${l.detailActiveClean}/${l.detailFetched}`
        : "—";
      const soldProshopCell = l.detailFetched > 0
        ? `${l.detailSold}/${l.detailProshop}`
        : "—";
      md.push(
        `| ${l.lane} | ${statusEmoji} ${l.status} | ${l.skuMatchPct.toFixed(1)} | ${l.comparableKeyCompletePct.toFixed(1)} | ${l.sampleTotal} | ${activeCleanCell} | ${soldProshopCell} | ${l.nextActionLabel} |`,
      );
    }
    md.push("");
    const policy = cat.lanes.filter((l) => l.status === "blocked_policy_decision");
    if (policy.length > 0) {
      md.push("### 정책 결정 대기");
      md.push("");
      for (const p of policy) {
        md.push(`- **${p.lane}**: ${p.statusReason}. ${p.boardBlocker !== "—" ? p.boardBlocker : p.expansionReason}`);
      }
      md.push("");
    }
    md.push("");
  }

  md.push("## 결정론 vs AI L2 분리");
  md.push("");
  const allLanes = result.flatMap((c) => c.lanes);
  const detStopLanes = allLanes.filter((l) => l.route === "deterministic_stop");
  const detMoreLanes = allLanes.filter((l) => l.route === "deterministic_more_possible");
  const aiL2Lanes = allLanes.filter((l) => l.route === "ai_l2");
  const moreMiningLanes = allLanes.filter((l) => l.route === "more_mining");
  const policyLanes = allLanes.filter((l) => l.route === "policy");
  md.push(`- 🟢 결정론 완성/감시만: ${detStopLanes.length} lanes — ${detStopLanes.map((l) => l.lane).join(", ") || "—"}`);
  md.push(`- 🔵 결정론 작은 패치 가능: ${detMoreLanes.length} lanes — ${detMoreLanes.map((l) => l.lane).join(", ") || "—"}`);
  md.push(`- 🤖 AI L2로 넘기기: ${aiL2Lanes.length} lanes — ${aiL2Lanes.map((l) => l.lane).join(", ") || "—"}`);
  md.push(`- 📊 표본/쿼리 보강: ${moreMiningLanes.length} lanes — ${moreMiningLanes.map((l) => l.lane).join(", ") || "—"}`);
  md.push(`- 🚫 정책 결정 대기: ${policyLanes.length} lanes — ${policyLanes.map((l) => l.lane).join(", ") || "—"}`);
  md.push("");
  md.push("## Public 후보 가능 여부");
  md.push("");
  md.push("LAUNCH_PLAN §1.3 / 13 — narrow lane 단위로 점진적 공개. 카테고리 전체 ready 아님.");
  md.push("");
  md.push("Public 후보 진입 게이트: owner_review_ready + source_health healthy + DDL approval + acquisition apply + pack quality 검증.");
  md.push("");
  const publicEligible = allLanes.filter((l) => l.status === "owner_review_ready");
  md.push(`현재 public 후보 진입 가능 lane (게이트 다 풀린 후): ${publicEligible.length} lanes`);
  for (const l of publicEligible) {
    md.push(`- ${l.lane}: detail activeClean ${l.detailActiveClean}/${l.detailFetched}`);
  }

  await writeFile(path.join(reportDir, "category-convergence-map-latest.md"), `${md.join("\n")}\n`);

  console.log("wrote reports/category-convergence-map-latest.{json,md}");
  console.log(JSON.stringify(output.grandTotal, null, 2));
  console.log("\nCategories:");
  for (const c of result) {
    console.log(`  ${c.label}: ${JSON.stringify(c.summary)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
