import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type CategorySnapshot = {
  category: string;
  readinessStatus: "ready" | "internal_only" | "blocked" | "unregistered";
  parsedCount: number;
  needsReviewFalseShare: number;
  comparableKeyCompleteShare: number;
  distinctComparableKeys: number;
  miningTotalFetched: number;
  miningParseReady: number;
  miningParseReadyShare: number;
  semanticPollutionShare: number | null;
  comparableKeyDimensions: number;
  comparableKeyMissingAxes: number;
  minReadyPool: number | null;
  minParseRate: number | null;
  minTrustedKeys: number | null;
};

type DependencyEdge = {
  blocker: string;
  severity: "hard" | "medium" | "soft";
  fixOwner: string;
  unblocks: string[];
  estimatedEffort: string;
  note: string;
};

type DependencyEntry = {
  category: string;
  snapshot: CategorySnapshot;
  edges: DependencyEdge[];
  hardBlockerCount: number;
};

type DependencyReport = { dependencyMap: DependencyEntry[] };

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
}

type Bucket = "immediate_unlock" | "parser_strengthen_first" | "semantic_pollution_hold";

type PriorityRow = {
  category: string;
  bucket: Bucket;
  rank: number;
  reasoning: string;
  fixSequence: string[];
  blockerSummary: string;
  estimatedTotalEffort: string;
  businessImpact: "high" | "medium" | "low";
};

const SAFETY_WEIGHTS = {
  // 가장 보수적 = 작은 변경으로 큰 unblock. owner_decision (DB row update) / schema_function_update (function only) > runtime parser change > AI L2 routing > catalog change.
  owner_decision: 1,
  schema_function_update: 2,
  report_only_wave: 3,
  ai_l2_routing: 4,
  mining_strengthen: 5,
  runtime_parser_change: 6,
  runtime_catalog_change: 7,
};

function effortToHours(label: string): number {
  switch (label) {
    case "minutes":
      return 0.25;
    case "hours":
      return 3;
    case "days":
      return 16;
    case "weeks":
      return 80;
    default:
      return 24;
  }
}

function classify(entry: DependencyEntry): { bucket: Bucket; reasoning: string } {
  const snap = entry.snapshot;
  const hardEdges = entry.edges.filter((e) => e.severity === "hard");
  const parserBlockers = hardEdges.filter((e) => e.fixOwner === "runtime_parser_change");
  const ownerOnlyHard = hardEdges.every(
    (e) => e.fixOwner === "owner_decision" || e.fixOwner === "schema_function_update",
  );
  const heavyAxisGap = snap.comparableKeyMissingAxes >= 4;
  const extremeAxisGap = snap.comparableKeyMissingAxes >= 5;
  const pollutionMedium = (snap.semanticPollutionShare ?? 0) > 0.15;
  const productionMissing = snap.parsedCount === 0;
  const lowParseRate =
    snap.minParseRate !== null && snap.parsedCount > 0 && snap.needsReviewFalseShare < snap.minParseRate;
  const lowDistinctKeys =
    snap.minTrustedKeys !== null &&
    snap.distinctComparableKeys < snap.minTrustedKeys &&
    snap.parsedCount > 0;

  // Bucket #3: semantic pollution hold — structural axis gap (5+) OR (4+ axis gap with elevated pollution)
  if (extremeAxisGap || (heavyAxisGap && pollutionMedium)) {
    return {
      bucket: "semantic_pollution_hold",
      reasoning:
        `comparable_key axis ${snap.comparableKeyMissingAxes}개 missing + semantic pollution ${snap.semanticPollutionShare}. silent-state 추정 금지 (LAUNCH_PLAN §12b). AI L2 routing 우선, 결정론 widening 금지.`,
    };
  }

  // Bucket #2: parser strengthen first
  if (productionMissing || lowParseRate || lowDistinctKeys || parserBlockers.length > 0) {
    return {
      bucket: "parser_strengthen_first",
      reasoning:
        `production parse rate 부족 또는 comparable_key axis encoding 미흡. parsedCount=${snap.parsedCount}, needsReviewFalse=${snap.needsReviewFalseShare}, distinctKeys=${snap.distinctComparableKeys}. parser/catalog 보강 wave 선행 필요.`,
    };
  }

  // Bucket #1: immediate unlock — owner_decision/schema_function_update만으로 해결 가능
  if (ownerOnlyHard && hardEdges.length > 0) {
    return {
      bucket: "immediate_unlock",
      reasoning:
        `hard blocker가 owner_decision / schema_function_update만 — DB row update + schema function 한 줄 추가로 unblock. 변경 작고 안전. snapshot: needsReviewFalse=${snap.needsReviewFalseShare}, distinctKeys=${snap.distinctComparableKeys}.`,
    };
  }

  // Default: already ready or fully blocked elsewhere
  if (snap.readinessStatus === "ready" && hardEdges.length === 0) {
    return {
      bucket: "immediate_unlock",
      reasoning: "이미 ready 상태. hard blocker 0. 유지 + lane 확장만.",
    };
  }
  return {
    bucket: "parser_strengthen_first",
    reasoning: "기본 분류 — parser 측면 보강 필요.",
  };
}

function deriveFixSequence(entry: DependencyEntry): string[] {
  const sorted = [...entry.edges].sort((a, b) => {
    const weightA = SAFETY_WEIGHTS[a.fixOwner as keyof typeof SAFETY_WEIGHTS] ?? 99;
    const weightB = SAFETY_WEIGHTS[b.fixOwner as keyof typeof SAFETY_WEIGHTS] ?? 99;
    if (weightA !== weightB) return weightA - weightB;
    const severityOrder = { hard: 0, medium: 1, soft: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
  return sorted.map((e) => `[${e.fixOwner}|${e.severity}|~${e.estimatedEffort}] ${e.blocker} → unblocks ${e.unblocks.join(", ")}`);
}

function estimateTotalEffort(entry: DependencyEntry): string {
  const hours = entry.edges.reduce((a, e) => a + effortToHours(e.estimatedEffort), 0);
  if (hours < 1) return `~${Math.round(hours * 60)}min`;
  if (hours < 24) return `~${Math.round(hours)}h`;
  if (hours < 80) return `~${Math.round(hours / 8)}days`;
  return `~${Math.round(hours / 40)}weeks`;
}

function businessImpact(category: string): "high" | "medium" | "low" {
  switch (category) {
    case "smartphone":
    case "monitor":
    case "laptop":
    case "speaker":
    case "tablet":
      return "high";
    case "smartwatch":
    case "earphone":
    case "camera":
    case "game_console":
      return "medium";
    case "desktop":
    case "home_appliance":
      return "low";
    default:
      return "medium";
  }
}

async function main(): Promise<void> {
  const dep = await readJson<DependencyReport>("category-readiness-dependency-map-latest.json");

  const rows: PriorityRow[] = dep.dependencyMap.map((entry) => {
    const { bucket, reasoning } = classify(entry);
    return {
      category: entry.category,
      bucket,
      rank: 0,
      reasoning,
      fixSequence: deriveFixSequence(entry),
      blockerSummary: `hard=${entry.hardBlockerCount}, total=${entry.edges.length}`,
      estimatedTotalEffort: estimateTotalEffort(entry),
      businessImpact: businessImpact(entry.category),
    };
  });

  // rank within bucket: by businessImpact (high first) then by effort hours (low first)
  const byBucket: Record<Bucket, PriorityRow[]> = {
    immediate_unlock: [],
    parser_strengthen_first: [],
    semantic_pollution_hold: [],
  };
  for (const row of rows) byBucket[row.bucket].push(row);
  for (const bucket of Object.keys(byBucket) as Bucket[]) {
    byBucket[bucket].sort((a, b) => {
      const impactOrder = { high: 0, medium: 1, low: 2 };
      if (impactOrder[a.businessImpact] !== impactOrder[b.businessImpact])
        return impactOrder[a.businessImpact] - impactOrder[b.businessImpact];
      return a.estimatedTotalEffort.length - b.estimatedTotalEffort.length;
    });
    byBucket[bucket].forEach((row, idx) => {
      row.rank = idx + 1;
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "category_unblock_priority_table",
    family: "all_categories",
    decision: "category_unblock_priority_table_report_only",
    metrics: {
      categories: rows.length,
      immediateUnlock: byBucket.immediate_unlock.length,
      parserStrengthenFirst: byBucket.parser_strengthen_first.length,
      semanticPollutionHold: byBucket.semantic_pollution_hold.length,
      runtimeApprovedRows: 0,
    },
    buckets: byBucket,
    bucketDefinitions: {
      immediate_unlock:
        "hard blocker가 owner_decision (DB row update) 또는 schema_function_update (DDL function only)로 모두 해결 가능. 변경 작고 안전. 즉시 ready 승격 후보.",
      parser_strengthen_first:
        "production parser 또는 comparable_key 완성도가 readiness threshold에 미달. parser/catalog 보강 wave 선행 필요. owner_decision만으로는 unblock 불가.",
      semantic_pollution_hold:
        "comparable_key axis가 구조적으로 부족하거나 (≥4 missing) semantic pollution 비율 큼 (>20%). silent-state 추정 금지 (LAUNCH_PLAN §12b). AI L2 routing이 정답, 결정론 widening 금지.",
    },
    policyImplications: [
      "이 priority table은 dependency-map의 derivative — 측정값에 기반. fixOwner 가중치 + business impact + estimated effort 합쳐 우선순위.",
      "변경 자체는 자동 안 함 — implementation-wave-spec에서 실행 순서표.",
      "AI L2 routing은 silent-state 카테고리의 정답 (LAUNCH_PLAN §6 AI L2 escrow reviewer).",
    ],
    doNotDo: [
      "Do not auto-promote any category from this packet",
      "Do not lower readiness thresholds to move categories from parser_strengthen_first to immediate_unlock",
      "Do not collapse semantic_pollution_hold categories with deterministic widening",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "category-unblock-priority-table-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Category Unblock Priority Table",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only priority table. dependency-map에서 도출. 카테고리를 3 bucket으로 분류 + bucket 내 rank.",
    "",
    "## Totals",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Bucket Definitions",
    "",
    ...Object.entries(report.bucketDefinitions).map(([k, v]) => `- **${k}**: ${v}`),
    "",
    "## Bucket #1 — Immediate Unlock",
    "",
    "| rank | category | impact | effort | reasoning |",
    "|---:|---|---|---|---|",
    ...byBucket.immediate_unlock.map(
      (r) => `| ${r.rank} | ${r.category} | ${r.businessImpact} | ${r.estimatedTotalEffort} | ${r.reasoning} |`,
    ),
    "",
    "## Bucket #2 — Parser Strengthen First",
    "",
    "| rank | category | impact | effort | reasoning |",
    "|---:|---|---|---|---|",
    ...byBucket.parser_strengthen_first.map(
      (r) => `| ${r.rank} | ${r.category} | ${r.businessImpact} | ${r.estimatedTotalEffort} | ${r.reasoning} |`,
    ),
    "",
    "## Bucket #3 — Semantic Pollution Hold (AI L2 routing target)",
    "",
    "| rank | category | impact | effort | reasoning |",
    "|---:|---|---|---|---|",
    ...byBucket.semantic_pollution_hold.map(
      (r) => `| ${r.rank} | ${r.category} | ${r.businessImpact} | ${r.estimatedTotalEffort} | ${r.reasoning} |`,
    ),
    "",
    "## Fix Sequence Per Category",
    "",
    ...rows.flatMap((r) => [
      `### ${r.category} (bucket=${r.bucket}, rank=${r.rank}, impact=${r.businessImpact}, ${r.blockerSummary})`,
      "",
      ...(r.fixSequence.length === 0 ? ["- (no edges — already ready)"] : r.fixSequence.map((s) => `- ${s}`)),
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
    `category-unblock-priority-table: immediate=${report.metrics.immediateUnlock}, parser=${report.metrics.parserStrengthenFirst}, pollutionHold=${report.metrics.semanticPollutionHold}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
