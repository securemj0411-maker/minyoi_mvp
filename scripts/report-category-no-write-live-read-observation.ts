import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchDetail, searchPage, type SearchItem } from "../src/lib/bunjang";

type LaneId =
  | "camera_body_only_exact_model"
  | "monitor_selected_exact_model"
  | "speaker_selected_subset"
  | "home_appliance_robot_vacuum_model_dock";

type Disposition = "fresh_live_candidate" | "manual_review" | "hold";

type LaneConfig = {
  lane: LaneId;
  label: string;
  category: string;
  queries: string[];
  maxSearchRowsPerQuery: number;
  maxDetailRowsPerLane: number;
  evaluate: (row: LiveRow) => Evaluation;
};

type LiveRow = {
  pid: string;
  title: string;
  price: number;
  url: string;
  query: string;
  saleStatus: string;
  description: string;
  observedAt: string;
};

type Evaluation = {
  disposition: Disposition;
  reason: string;
  matchedSignals: string[];
  holdSignals: string[];
};

type ObservedRow = LiveRow & Evaluation;

type LaneResult = {
  lane: LaneId;
  label: string;
  category: string;
  queries: string[];
  searchRowsRead: number;
  detailRowsRead: number;
  freshLiveCandidates: number;
  manualReviewRows: number;
  holdRows: number;
  rows: ObservedRow[];
  interpretation: string;
};

type Report = {
  generatedAt: string;
  reportOnly: true;
  liveFetchPerformed: true;
  writeTargetsTouched: [];
  runtimeCatalogApply: false;
  runtimeApply: false;
  publicPromotion: false;
  candidatePoolPolicyWiring: false;
  productionDbMutation: false;
  sourceHealthMutation: false;
  supabaseRead: false;
  supabaseWrite: false;
  ownership: "category_no_write_live_read_observation";
  conclusion: string;
  metrics: {
    lanes: number;
    totalSearchRowsRead: number;
    totalDetailRowsRead: number;
    totalFreshLiveCandidates: number;
    totalManualReviewRows: number;
    totalHoldRows: number;
    boundaryViolations: 0;
  };
  lanes: LaneResult[];
  nextSteps: string[];
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const outputJsonPath = path.join(reportsDir, "category-no-write-live-read-observation-latest.json");
const outputMdPath = path.join(reportsDir, "category-no-write-live-read-observation-latest.md");

const ACTIVE_SALE_STATUSES = new Set(["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"]);

function norm(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, "");
}

function text(row: LiveRow) {
  return `${row.title}\n${row.description}`.toLowerCase();
}

function hasAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function saleStatusActive(row: LiveRow) {
  return ACTIVE_SALE_STATUSES.has(row.saleStatus.trim().toUpperCase());
}

function baseInactiveHold(row: LiveRow) {
  const t = text(row);
  if (!saleStatusActive(row)) return `inactive_sale_status:${row.saleStatus || "missing"}`;
  if (/판매\s*완료|거래\s*완료|예약\s*완료|\bsold\b|sold\s*out/i.test(t)) return "title_or_description_sold_signal";
  if (/삽니다|구매합니다|매입|구해요|구함|구합니다/.test(t)) return "buying_intent_signal";
  if (/대여|렌탈|임대|하루대여|단기렌탈/.test(t)) return "rental_or_lease_signal";
  if (/사기|먹튀|신고|주의|피해|전문사기/.test(t)) return "fraud_warning_signal";
  if (/고장|파손|부품용|수리|액정\s*깨|작동안|불량/.test(t)) return "damaged_or_parts_signal";
  if (/가품|짭|레플리카|이미테이션|호환품/.test(t)) return "counterfeit_or_compatible_signal";
  return null;
}

function exactToken(row: LiveRow, tokens: string[]) {
  const normalizedTitle = norm(row.title);
  return tokens.find((token) => normalizedTitle.includes(norm(token))) ?? null;
}

function evaluateCamera(row: LiveRow): Evaluation {
  const baseHold = baseInactiveHold(row);
  if (baseHold) return { disposition: "hold", reason: baseHold, matchedSignals: [], holdSignals: [baseHold] };

  const t = text(row);
  const exact = exactToken(row, ["a7m3", "a7iii", "eosr6", "eos r6", "z6ii", "z6 ii"]);
  const bodySignal = hasAny(t, [/바디|body|본체/]);
  const lensPackage = hasAny(t, [/렌즈|번들|패키지|풀박\s*\+?\s*렌즈|세트/]);
  if (!exact) return { disposition: "manual_review", reason: "exact_body_model_missing", matchedSignals: [], holdSignals: [] };
  if (lensPackage && !bodySignal) {
    return {
      disposition: "hold",
      reason: "lens_or_package_without_body_only_signal",
      matchedSignals: [exact],
      holdSignals: ["lens_package_signal"],
    };
  }
  if (!bodySignal) {
    return {
      disposition: "manual_review",
      reason: "exact_model_but_body_only_signal_missing",
      matchedSignals: [exact],
      holdSignals: [],
    };
  }
  return { disposition: "fresh_live_candidate", reason: "active_exact_model_body_only_signal", matchedSignals: [exact, "body"], holdSignals: [] };
}

function evaluateMonitor(row: LiveRow): Evaluation {
  const baseHold = baseInactiveHold(row);
  if (baseHold) return { disposition: "hold", reason: baseHold, matchedSignals: [], holdSignals: [baseHold] };

  const t = text(row);
  const exact = exactToken(row, ["aw2525hm", "xl2540k", "27us550", "u2412mb"]);
  const monitorSignal = /모니터|monitor|게이밍/.test(t);
  const accessory = /모니터암|거치대|스탠드만|부품|패널만|어댑터|케이블/.test(t);
  if (!exact) return { disposition: "manual_review", reason: "exact_monitor_model_missing", matchedSignals: [], holdSignals: [] };
  if (accessory) return { disposition: "hold", reason: "monitor_accessory_or_part_signal", matchedSignals: [exact], holdSignals: ["accessory"] };
  if (!monitorSignal) return { disposition: "manual_review", reason: "exact_model_but_monitor_context_missing", matchedSignals: [exact], holdSignals: [] };
  return { disposition: "fresh_live_candidate", reason: "active_exact_monitor_model", matchedSignals: [exact, "monitor"], holdSignals: [] };
}

function evaluateSpeaker(row: LiveRow): Evaluation {
  const baseHold = baseInactiveHold(row);
  if (baseHold) return { disposition: "hold", reason: baseHold, matchedSignals: [], holdSignals: [baseHold] };

  const t = text(row);
  const exact = exactToken(row, ["flip6", "flip 6", "플립6", "soundlinkmini", "soundlink mini", "사운드링크미니", "emberton", "엠버튼"]);
  const speakerSignal = /스피커|speaker|블루투스/.test(t);
  const fullUnitContext = /음질|소리|로고|색상|박스\s*있|박스있|정품|생활\s*기스|생활기스/.test(t);
  const accessory = /케이스|파우치|거치대|충전기|충전단자만|케이블|부품|배터리/.test(t);
  if (!exact) return { disposition: "manual_review", reason: "selected_speaker_model_missing", matchedSignals: [], holdSignals: [] };
  if (accessory) return { disposition: "hold", reason: "speaker_accessory_or_part_signal", matchedSignals: [exact], holdSignals: ["accessory"] };
  if (!speakerSignal && !fullUnitContext) return { disposition: "manual_review", reason: "exact_model_but_speaker_context_missing", matchedSignals: [exact], holdSignals: [] };
  return {
    disposition: "fresh_live_candidate",
    reason: speakerSignal ? "active_selected_speaker_model" : "active_selected_speaker_model_from_description_context",
    matchedSignals: [exact, speakerSignal ? "speaker" : "description_full_unit_context"],
    holdSignals: [],
  };
}

function evaluateRobotVacuum(row: LiveRow): Evaluation {
  const baseHold = baseInactiveHold(row);
  if (baseHold) return { disposition: "hold", reason: baseHold, matchedSignals: [], holdSignals: [baseHold] };

  const t = text(row);
  const title = row.title.toLowerCase();
  const exact = exactToken(row, [
    "s8proultra",
    "s8 pro ultra",
    "s8프로울트라",
    "s8 프로 울트라",
    "t20옴니",
    "t20 omni",
    "x10프로옴니",
    "x10 pro omni",
  ]);
  const robotSignal = /로봇청소기|로봇\s*청소기|robot\s*vacuum|청소기/.test(t);
  const titleDockOnly = /본체만|도크만|스테이션만|세정제|악세사리|액세서리|먼지봉투|물걸레|브러쉬|필터|배터리|부품|소모품/.test(title);
  const descriptionAccessoryMention = /세정제|악세사리|액세서리|먼지봉투|물걸레|브러쉬|필터|배터리|소모품/.test(t);
  if (!exact) return { disposition: "manual_review", reason: "robot_vacuum_model_missing", matchedSignals: [], holdSignals: [] };
  if (titleDockOnly) return { disposition: "hold", reason: "robot_vacuum_dock_or_consumable_only_signal", matchedSignals: [exact], holdSignals: ["dock_or_consumable"] };
  if (!robotSignal) return { disposition: "manual_review", reason: "exact_model_but_robot_vacuum_context_missing", matchedSignals: [exact], holdSignals: [] };
  if (descriptionAccessoryMention) {
    return {
      disposition: "manual_review",
      reason: "full_unit_title_but_description_mentions_accessories",
      matchedSignals: [exact, "robot_vacuum"],
      holdSignals: [],
    };
  }
  return { disposition: "fresh_live_candidate", reason: "active_robot_vacuum_model_full_unit_context", matchedSignals: [exact, "robot_vacuum"], holdSignals: [] };
}

const lanes: LaneConfig[] = [
  {
    lane: "camera_body_only_exact_model",
    label: "Camera body-only exact model",
    category: "camera_discovered",
    queries: ["소니 a7m3 바디", "캐논 eos r6 바디"],
    maxSearchRowsPerQuery: 8,
    maxDetailRowsPerLane: 8,
    evaluate: evaluateCamera,
  },
  {
    lane: "monitor_selected_exact_model",
    label: "Monitor selected exact model",
    category: "monitor_discovered",
    queries: ["aw2525hm", "xl2540k"],
    maxSearchRowsPerQuery: 8,
    maxDetailRowsPerLane: 8,
    evaluate: evaluateMonitor,
  },
  {
    lane: "speaker_selected_subset",
    label: "Speaker selected subset",
    category: "speaker_audio_discovered",
    queries: ["jbl flip 6", "보스 사운드링크 미니"],
    maxSearchRowsPerQuery: 8,
    maxDetailRowsPerLane: 8,
    evaluate: evaluateSpeaker,
  },
  {
    lane: "home_appliance_robot_vacuum_model_dock",
    label: "Robot vacuum model+dock",
    category: "home_appliance_tech_discovered",
    queries: ["로보락 s8 pro ultra", "에코백스 t20 옴니"],
    maxSearchRowsPerQuery: 8,
    maxDetailRowsPerLane: 8,
    evaluate: evaluateRobotVacuum,
  },
];

function summarizeLane(rows: ObservedRow[]) {
  const freshLiveCandidates = rows.filter((row) => row.disposition === "fresh_live_candidate").length;
  const manualReviewRows = rows.filter((row) => row.disposition === "manual_review").length;
  const holdRows = rows.filter((row) => row.disposition === "hold").length;
  const interpretation = freshLiveCandidates > 0
    ? "실매물에서 fresh live 후보가 잡혔다. 아직 report-only라 공개/저장은 하지 않는다."
    : manualReviewRows > 0
      ? "실매물은 읽혔지만 자동 후보 기준은 보수적으로 통과하지 못했다. 모델/문맥 룰 보강 후보."
      : "읽힌 실매물이 대부분 hold로 떨어졌다. 검색어/카테고리 소스 재조정 후보.";
  return { freshLiveCandidates, manualReviewRows, holdRows, interpretation };
}

async function observeLane(config: LaneConfig): Promise<LaneResult> {
  const dedup = new Map<string, SearchItem>();
  for (const query of config.queries) {
    const rows = await searchPage(query, 0, { order: "date", limit: config.maxSearchRowsPerQuery });
    for (const row of rows) {
      if (!dedup.has(row.pid)) dedup.set(row.pid, row);
    }
  }

  const rows: ObservedRow[] = [];
  for (const item of [...dedup.values()].slice(0, config.maxDetailRowsPerLane)) {
    const detail = await fetchDetail(item.pid);
    if (!detail) {
      rows.push({
        pid: item.pid,
        title: item.name,
        price: item.price,
        url: item.url,
        query: item.query,
        saleStatus: "DETAIL_UNAVAILABLE",
        description: "",
        observedAt: new Date().toISOString(),
        disposition: "hold",
        reason: "detail_unavailable",
        matchedSignals: [],
        holdSignals: ["detail_unavailable"],
      });
      continue;
    }

    const liveRow: LiveRow = {
      pid: item.pid,
      title: item.name,
      price: item.price,
      url: item.url,
      query: item.query,
      saleStatus: detail.saleStatus,
      description: detail.description,
      observedAt: new Date().toISOString(),
    };
    const evaluation = config.evaluate(liveRow);
    rows.push({ ...liveRow, ...evaluation });
  }

  const summary = summarizeLane(rows);
  return {
    lane: config.lane,
    label: config.label,
    category: config.category,
    queries: config.queries,
    searchRowsRead: dedup.size,
    detailRowsRead: rows.length,
    ...summary,
    rows,
  };
}

function renderMarkdown(report: Report) {
  const lines = [
    "# Category No-Write Live Read Observation",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    `- reportOnly: ${report.reportOnly}`,
    `- liveFetchPerformed: ${report.liveFetchPerformed}`,
    `- Supabase read/write: ${report.supabaseRead}/${report.supabaseWrite}`,
    `- runtime/public/candidate/db mutation: ${report.runtimeApply}/${report.publicPromotion}/${report.candidatePoolPolicyWiring}/${report.productionDbMutation}`,
    "",
    "## Metrics",
    "",
    `- lanes: ${report.metrics.lanes}`,
    `- totalSearchRowsRead: ${report.metrics.totalSearchRowsRead}`,
    `- totalDetailRowsRead: ${report.metrics.totalDetailRowsRead}`,
    `- totalFreshLiveCandidates: ${report.metrics.totalFreshLiveCandidates}`,
    `- totalManualReviewRows: ${report.metrics.totalManualReviewRows}`,
    `- totalHoldRows: ${report.metrics.totalHoldRows}`,
    "",
  ];

  for (const lane of report.lanes) {
    lines.push(
      `## ${lane.label}`,
      "",
      `- lane: ${lane.lane}`,
      `- category: ${lane.category}`,
      `- queries: ${lane.queries.join(", ")}`,
      `- search/detail rows: ${lane.searchRowsRead}/${lane.detailRowsRead}`,
      `- fresh/manual/hold: ${lane.freshLiveCandidates}/${lane.manualReviewRows}/${lane.holdRows}`,
      `- interpretation: ${lane.interpretation}`,
      "",
      "| disposition | pid | price | saleStatus | reason | title |",
      "|---|---:|---:|---|---|---|",
      ...lane.rows.slice(0, 8).map((row) =>
        `| ${row.disposition} | ${row.pid} | ${row.price.toLocaleString("ko-KR")} | ${row.saleStatus || "-"} | ${row.reason} | ${row.title.replaceAll("|", "/")} |`,
      ),
      "",
    );
  }

  lines.push(
    "## Next Steps",
    "",
    ...report.nextSteps.map((step) => `- ${step}`),
    "",
  );
  return `${lines.join("\n")}\n`;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const laneResults = [];
  for (const lane of lanes) {
    laneResults.push(await observeLane(lane));
  }

  const totalSearchRowsRead = laneResults.reduce((sum, lane) => sum + lane.searchRowsRead, 0);
  const totalDetailRowsRead = laneResults.reduce((sum, lane) => sum + lane.detailRowsRead, 0);
  const totalFreshLiveCandidates = laneResults.reduce((sum, lane) => sum + lane.freshLiveCandidates, 0);
  const totalManualReviewRows = laneResults.reduce((sum, lane) => sum + lane.manualReviewRows, 0);
  const totalHoldRows = laneResults.reduce((sum, lane) => sum + lane.holdRows, 0);

  const report: Report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    liveFetchPerformed: true,
    writeTargetsTouched: [],
    runtimeCatalogApply: false,
    runtimeApply: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    productionDbMutation: false,
    sourceHealthMutation: false,
    supabaseRead: false,
    supabaseWrite: false,
    ownership: "category_no_write_live_read_observation",
    conclusion: "no_write_live_read_completed_without_db_or_public_mutation",
    metrics: {
      lanes: laneResults.length,
      totalSearchRowsRead,
      totalDetailRowsRead,
      totalFreshLiveCandidates,
      totalManualReviewRows,
      totalHoldRows,
      boundaryViolations: 0,
    },
    lanes: laneResults,
    nextSteps: [
      "Fresh live candidates are observation-only. Do not publish until an owner-approved runtime patch and regression tests exist.",
      "Review hold/manual reasons by lane; if false holds dominate, expand exact-token/context rules in report-only fixtures first.",
      "If this report remains stable after another low-volume live-read wave, prepare a narrow runtime review packet per lane.",
    ],
  };

  await writeFile(outputJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(outputMdPath, renderMarkdown(report), "utf8");
  console.log(`wrote ${path.relative(appDir, outputJsonPath)}`);
  console.log(`wrote ${path.relative(appDir, outputMdPath)}`);
  console.log(JSON.stringify(report.metrics));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
