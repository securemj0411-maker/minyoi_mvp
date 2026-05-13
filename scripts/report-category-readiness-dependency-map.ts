import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CATEGORY_DISPLAY_ORDER,
  buildSnapshot,
  type CategorySnapshot,
  type DbMeasurement,
  type ReadinessRow,
} from "./lib/category-readiness-snapshot.js";

const reportsDir = path.join(process.cwd(), "reports");

// DB measurements snapshot — recorded 2026-05-14 from supabase MCP. Re-measure on schema change.
const DB_MEASURE: Record<string, DbMeasurement | null> = {
  earphone: { parsedCount: 2089, needsReviewFalse: 1847, comparableKeyComplete: 1857, distinctComparableKeys: 17 },
  smartwatch: { parsedCount: 2356, needsReviewFalse: 2163, comparableKeyComplete: 1400, distinctComparableKeys: 110 },
  smartphone: { parsedCount: 1662, needsReviewFalse: 1475, comparableKeyComplete: 1475, distinctComparableKeys: 86 },
  tablet: { parsedCount: 2333, needsReviewFalse: 1962, comparableKeyComplete: 1962, distinctComparableKeys: 207 },
  laptop: { parsedCount: 1418, needsReviewFalse: 490, comparableKeyComplete: 479, distinctComparableKeys: 688 },
  monitor: null,
  speaker: null,
  camera: null,
  desktop: null,
  game_console: null,
  home_appliance: null,
};

const READINESS: Record<string, ReadinessRow | null> = {
  earphone: { status: "ready", minReadyPool: 6, minParseRate: 0.85, minTrustedKeys: 5 },
  smartwatch: { status: "ready", minReadyPool: 6, minParseRate: 0.8, minTrustedKeys: 5 },
  smartphone: { status: "internal_only", minReadyPool: 8, minParseRate: 0.9, minTrustedKeys: 10 },
  tablet: { status: "internal_only", minReadyPool: 8, minParseRate: 0.88, minTrustedKeys: 8 },
  laptop: { status: "internal_only", minReadyPool: 8, minParseRate: 0.85, minTrustedKeys: 8 },
  monitor: null,
  speaker: null,
  camera: null,
  desktop: null,
  game_console: null,
  home_appliance: null,
};

// option-parser comparable_key dimensions per category (read-only inventory; matches schema mvp_category_from_comparable_key + option-parser construction).
const COMPARABLE_KEY_INVENTORY: Record<string, { dimensions: number; missingAxes: number; notes: string[] }> = {
  earphone: { dimensions: 4, missingAxes: 1, notes: ["family|model|generation|connectivity (closed-set, USB-C/Lightning marker)"] },
  smartwatch: { dimensions: 4, missingAxes: 2, notes: ["family|model|size|connectivity; cellular/GPS distinguished; size mm parser gap (28/1000 unknown_size)"] },
  smartphone: { dimensions: 3, missingAxes: 5, notes: ["family|model|storage only; self/carrier/color/dual_sim/esim axes missing (LAUNCH_PLAN §0.4 — phones bottleneck wave 확정)"] },
  tablet: { dimensions: 5, missingAxes: 2, notes: ["family|model|size|storage|connectivity; cellular/wifi 분리 OK; color/keyboard accessory missing"] },
  laptop: { dimensions: 6, missingAxes: 4, notes: ["family|model|chip|ram|ssd|size; chip/ram/ssd 추정 위험 — 명시 token만; 브랜드 diversity 큼 (distinct keys=688)"] },
  monitor: { dimensions: 5, missingAxes: 3, notes: ["family|model_code|size|resolution|panel_type 가능 — registry packet group 'monitor-modelcode' 활용; mvp_category_from_comparable_key 매핑 부재 → 'unknown' 분류"] },
  speaker: { dimensions: 3, missingAxes: 2, notes: ["family|model|connectivity (portable_bluetooth_speaker) 단순; mvp_category_from_comparable_key 매핑 부재"] },
  camera: { dimensions: 4, missingAxes: 3, notes: ["family|model|body_only|lens_kit; lens 동봉 매물과 body-only 분리 부담; 매핑 부재"] },
  desktop: { dimensions: 5, missingAxes: 4, notes: ["family|model|chip|ram|ssd; full-unit vs barebone 경계; 매핑 부재"] },
  game_console: { dimensions: 3, missingAxes: 3, notes: ["family|model|edition (disc/digital/slim/pro); 풀박/Pro/CFI-7022 false positive (wave2 PS5 결정); 매핑 부재"] },
  home_appliance: { dimensions: 3, missingAxes: 3, notes: ["family|model|subtype (vacuum/etc); broad open vocabulary; 매핑 부재"] },
};

type DependencyEdge = {
  blocker: string;
  severity: "hard" | "medium" | "soft";
  fixOwner: "owner_decision" | "report_only_wave" | "runtime_parser_change" | "runtime_catalog_change" | "schema_function_update" | "mining_strengthen" | "ai_l2_routing";
  unblocks: string[];
  estimatedEffort: "minutes" | "hours" | "days" | "weeks";
  note: string;
};

function deriveDependencies(snap: CategorySnapshot): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  if (snap.readinessStatus === "unregistered") {
    edges.push({
      blocker: "mvp_category_readiness row absent",
      severity: "hard",
      fixOwner: "owner_decision",
      unblocks: ["pack_open RPC에서 cr.status='ready' 통과", "candidate_pool reserve 가능"],
      estimatedEffort: "minutes",
      note: "category row INSERT 필요. min_ready_pool/min_parse_rate/min_trusted_keys 기준 owner 결정.",
    });
  }
  if (snap.readinessStatus === "internal_only") {
    edges.push({
      blocker: `readiness status=internal_only (min_parse_rate=${snap.minParseRate ?? "?"}, min_trusted_keys=${snap.minTrustedKeys ?? "?"})`,
      severity: "hard",
      fixOwner: "owner_decision",
      unblocks: ["pack_open RPC 통과 (status='ready' 필요)"],
      estimatedEffort: "minutes",
      note: "status를 ready로 승격하기 전, 아래 blocker들이 먼저 해소되어야 함.",
    });
  }
  if (snap.readinessStatus === "blocked") {
    edges.push({
      blocker: "readiness status=blocked",
      severity: "hard",
      fixOwner: "owner_decision",
      unblocks: ["전체 흐름 차단"],
      estimatedEffort: "weeks",
      note: "blocked 사유 분석 후 결정.",
    });
  }

  // category->category mapping function gap
  if (["monitor", "speaker", "camera", "desktop", "game_console", "home_appliance"].includes(snap.category)) {
    edges.push({
      blocker: "mvp_category_from_comparable_key()이 이 카테고리 미매핑",
      severity: "hard",
      fixOwner: "schema_function_update",
      unblocks: ["candidate_pool reserve_mvp_pool_candidates RPC가 카테고리 인식"],
      estimatedEffort: "minutes",
      note: "schema function 한 줄 추가 (when 'monitor' then 'monitor' 등). DDL이지만 함수 정의 update. owner 명시 필요.",
    });
  }

  if (snap.parsedCount === 0) {
    edges.push({
      blocker: "DB parsed_count=0 — production parser가 카테고리 인식 안 함",
      severity: "hard",
      fixOwner: "runtime_parser_change",
      unblocks: ["live data flow"],
      estimatedEffort: "days",
      note: "production replay 측정 자체 부재 — option-parser 보강 + replay 측정 wave 선행 필요.",
    });
  } else {
    if (snap.minParseRate !== null && snap.needsReviewFalseShare < snap.minParseRate) {
      edges.push({
        blocker: `needs_review=false share ${snap.needsReviewFalseShare} < min_parse_rate ${snap.minParseRate}`,
        severity: "hard",
        fixOwner: "runtime_parser_change",
        unblocks: ["readiness 통과 (parse rate 게이트)"],
        estimatedEffort: "days",
        note: "option-parser 보강 필요. 추정 fallback 금지 (LAUNCH_PLAN §12b).",
      });
    }
    if (snap.minTrustedKeys !== null && snap.distinctComparableKeys < snap.minTrustedKeys) {
      edges.push({
        blocker: `distinct comparable_keys ${snap.distinctComparableKeys} < min_trusted_keys ${snap.minTrustedKeys}`,
        severity: "medium",
        fixOwner: "mining_strengthen",
        unblocks: ["readiness 통과 (trusted keys 게이트)"],
        estimatedEffort: "days",
        note: "narrow lane mining 추가로 distinct comparable_key 다양화 필요.",
      });
    }
    if (snap.comparableKeyCompleteShare < 0.85) {
      edges.push({
        blocker: `comparable_key 완성 비율 ${snap.comparableKeyCompleteShare} 낮음`,
        severity: "medium",
        fixOwner: "runtime_parser_change",
        unblocks: ["downstream market price / candidate_pool 신뢰도"],
        estimatedEffort: "days",
        note: "option-parser comparable_key 빌딩 보강 필요. unknown_* marker가 너무 많음.",
      });
    }
  }

  if (snap.comparableKeyMissingAxes >= 3) {
    edges.push({
      blocker: `comparable_key axis ${snap.comparableKeyMissingAxes} 개 missing`,
      severity: "hard",
      fixOwner: "runtime_parser_change",
      unblocks: ["같은 SKU 매물 분리 정밀도", "silent-state row 추정 차단 강제"],
      estimatedEffort: "weeks",
      note: "AI L2 routing이 우선 (no runtime change). axis 확장은 별도 wave + instrumentation 선행.",
    });
  }

  if (snap.semanticPollutionShare !== null && snap.semanticPollutionShare > 0.15) {
    edges.push({
      blocker: `semantic pollution ${snap.semanticPollutionShare} (>15%)`,
      severity: "medium",
      fixOwner: "report_only_wave",
      unblocks: ["mining yield, ambiguity 분리"],
      estimatedEffort: "hours",
      note: "pollution은 permanent — recall 향상 무관. catalog mustNotContain / parser reject 보강 유지.",
    });
  }

  if (snap.miningParseReady === 0 && snap.miningTotalFetched === 0) {
    edges.push({
      blocker: "mining lane 없음 — narrow lane parse_summary 미존재",
      severity: "hard",
      fixOwner: "mining_strengthen",
      unblocks: ["lane-level readiness 측정"],
      estimatedEffort: "days",
      note: "mine-narrow-lane-v1 등 mining script 실행 필요. lane_config 정의 선행.",
    });
  }

  return edges;
}

async function main(): Promise<void> {
  const snapshots: CategorySnapshot[] = [];
  for (const category of CATEGORY_DISPLAY_ORDER) {
    const inv = COMPARABLE_KEY_INVENTORY[category];
    const snap = await buildSnapshot(
      category,
      DB_MEASURE[category],
      READINESS[category],
      inv?.dimensions ?? 0,
      inv?.missingAxes ?? 0,
      inv?.notes ?? [],
    );
    snapshots.push(snap);
  }

  const dependencyMap = snapshots.map((snap) => ({
    category: snap.category,
    snapshot: snap,
    edges: deriveDependencies(snap),
    edgeCount: deriveDependencies(snap).length,
    hardBlockerCount: deriveDependencies(snap).filter((e) => e.severity === "hard").length,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "category_readiness_dependency_map",
    family: "all_categories",
    decision: "category_readiness_dependency_map_report_only",
    metrics: {
      categories: snapshots.length,
      readyCategories: snapshots.filter((s) => s.readinessStatus === "ready").length,
      internalOnlyCategories: snapshots.filter((s) => s.readinessStatus === "internal_only").length,
      unregisteredCategories: snapshots.filter((s) => s.readinessStatus === "unregistered").length,
      blockedCategories: snapshots.filter((s) => s.readinessStatus === "blocked").length,
      totalHardBlockers: dependencyMap.reduce((a, c) => a + c.hardBlockerCount, 0),
      runtimeApprovedRows: 0,
    },
    dependencyMap,
    policyImplications: [
      "Dependency map은 각 카테고리가 ready 되기 위해 무엇이 해소되어야 하는지 측정 기반 분석.",
      "fixOwner 유형별로 작업 단위가 다름 — owner_decision (DB row update) / report_only_wave (분석) / runtime_parser_change (option-parser 변경) / runtime_catalog_change (catalog 변경) / schema_function_update (DDL function) / mining_strengthen (narrow lane mining) / ai_l2_routing (L2 wiring).",
      "정확성 > recall (LAUNCH_PLAN §12b) — 어떤 blocker도 추정/silent fallback으로 우회 금지.",
      "이 packet은 read-only 정리만. 어떤 변경도 자동 실행 안 함.",
    ],
    doNotDo: [
      "Do not lower readiness thresholds (min_parse_rate, min_trusted_keys) to inflate ready count",
      "Do not promote a category to ready without resolving its hard blockers",
      "Do not propose runtime/catalog/parser changes from this packet — see priority-table + implementation-wave-spec",
      "Do not infer silent state from absence of token",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "category-readiness-dependency-map-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Category Readiness Dependency Map",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only dependency map: 각 카테고리가 ready 되기 위한 blocker 목록 (severity / fixOwner / estimatedEffort).",
    "",
    "## Totals",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Per-Category Snapshot",
    "",
    "| category | status | parsed | needsReviewFalse% | compKey% | distinctKeys | miningReady% | pollution% | compKeyDims | missingAxes |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...snapshots.map(
      (s) =>
        `| ${s.category} | ${s.readinessStatus} | ${s.parsedCount} | ${s.needsReviewFalseShare} | ${s.comparableKeyCompleteShare} | ${s.distinctComparableKeys} | ${s.miningParseReadyShare} | ${s.semanticPollutionShare ?? "-"} | ${s.comparableKeyDimensions} | ${s.comparableKeyMissingAxes} |`,
    ),
    "",
    "## Dependency Edges",
    "",
    ...dependencyMap.flatMap((c) => [
      `### ${c.category} — ${c.edgeCount} blocker(s) (hard=${c.hardBlockerCount})`,
      "",
      ...c.edges.map(
        (e) =>
          `- [${e.severity}] ${e.blocker} → fix by **${e.fixOwner}** (~${e.estimatedEffort}). unblocks: ${e.unblocks.join("; ")}. note: ${e.note}`,
      ),
      "",
    ]),
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
    `category-readiness-dependency-map: categories=${snapshots.length}, ready=${report.metrics.readyCategories}, internalOnly=${report.metrics.internalOnlyCategories}, unregistered=${report.metrics.unregisteredCategories}, hardBlockers=${report.metrics.totalHardBlockers}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
