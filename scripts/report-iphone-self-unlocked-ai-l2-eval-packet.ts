import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type EvalQueueRow = {
  lane: string;
  total: number;
  explicitSelfUnlocked: number;
  cleanExplicitSelfUnlocked: number;
  carrierAmbiguous: number;
  accessoryOrParts: number;
  buyingOrCommercial: number;
  examples: {
    explicit: string[];
    ambiguous: string[];
    blocked: string[];
  };
  decision: string;
};

type EvalQueueReport = {
  generatedAt: string;
  policy: {
    deterministicAllowed: string;
    aiL2: string;
    forbidden: string;
  };
  rows: EvalQueueRow[];
};

type LaneSplitRow = {
  lane: string;
  total: number;
  grade: string;
  nextAction: string;
  routingDecision: string;
  aiL2Reason: string;
  action: string;
  actionReason: string;
};

type LaneSplitReport = {
  rows: LaneSplitRow[];
};

type RoutingRow = {
  lane: string;
  total: number;
  decision: string;
  aiL2Reason: string;
  notes: string[];
};

type RoutingReport = {
  summary: Record<string, number>;
  lanes: RoutingRow[];
};

type CacheFkReview = {
  decision?: {
    status?: string;
    preferredMigration?: string;
    rationale?: string;
  };
};

type ClassifiedExample = {
  lane: string;
  title: string;
  bucket: "clean_explicit" | "ai_l2_candidate" | "blocked";
  reason: string;
};

const reportsDir = path.join(process.cwd(), "reports");
const outputBase = "iphone-self-unlocked-ai-l2-eval-packet-latest";
const targetLanes = ["iphone_12_pro_128gb_self", "iphone_13_pro_128gb_self"];

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

function mdTable(headers: string[], rows: Array<Array<unknown>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function laneModelRegex(lane: string): RegExp {
  if (lane.includes("iphone_12")) {
    return /아이폰\s*12\s*(?:프로|pro)(?!\s*(?:맥스|max))|iphone\s*12\s*pro(?!\s*max)/i;
  }
  return /아이폰\s*13\s*(?:프로|pro)(?!\s*(?:맥스|max))|iphone\s*13\s*pro(?!\s*max)/i;
}

function hasExplicitSelfUnlocked(title: string): boolean {
  return /자급제|공기계|정상\s*해지|정상해지|언락|unlocked|sim\s*free/i.test(title);
}

function hasStorage128(title: string): boolean {
  return /128\s*(?:g|gb|기가)?\b|128기가/i.test(title);
}

function hasBlocker(title: string): boolean {
  return /매입|삽니다|구해요|구매합니다|파손|고장|불량|부품|액정|케이스|필름|배터리\s*(?:교체|대용량|nohon|노혼)|프로\s*맥스|프로맥스|pro\s*max|아이패드|맥북|갤럭시/i.test(title);
}

function carrierAmbiguousReason(title: string): string {
  if (/skt|kt|u\+|유플러스|통신사|선택약정|보험|유심기변|확정기변/i.test(title)) {
    return "carrier wording present without explicit self-unlocked resolution";
  }
  return "silent or weak carrier-state evidence; AI L2 question required";
}

function classifyExample(lane: string, title: string, source: "explicit" | "ambiguous" | "blocked"): ClassifiedExample {
  const matchesLaneModel = laneModelRegex(lane).test(title);
  const explicitSelfUnlocked = hasExplicitSelfUnlocked(title);
  const storage128 = hasStorage128(title);
  const blocked = hasBlocker(title);

  if (source === "ambiguous" && matchesLaneModel && storage128 && !blocked) {
    return {
      lane,
      title,
      bucket: "ai_l2_candidate",
      reason: carrierAmbiguousReason(title),
    };
  }

  if (matchesLaneModel && explicitSelfUnlocked && storage128 && !blocked) {
    return {
      lane,
      title,
      bucket: "clean_explicit",
      reason: "exact model + 128GB + explicit self-unlocked wording; deterministic eligible",
    };
  }

  const reasons = [
    !matchesLaneModel ? "wrong_or_missing_exact_model" : "",
    !storage128 ? "missing_128gb_storage" : "",
    !explicitSelfUnlocked ? "missing_explicit_self_unlocked" : "",
    blocked ? "blocked_parts_buying_accessory_or_wrong_variant" : "",
  ].filter(Boolean);

  return {
    lane,
    title,
    bucket: "blocked",
    reason: reasons.join(","),
  };
}

function uniqueExamples(rows: ClassifiedExample[]): ClassifiedExample[] {
  const seen = new Set<string>();
  const result: ClassifiedExample[] = [];
  for (const row of rows) {
    const key = `${row.lane}\0${row.bucket}\0${row.title}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(row);
    }
  }
  return result;
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [evalQueue, laneSplit, routing, cacheFkReview] = await Promise.all([
    readJson<EvalQueueReport>(path.join(reportsDir, "iphone-self-unlocked-eval-queue-latest.json")),
    readJson<LaneSplitReport>(path.join(reportsDir, "lane-next-action-split-latest.json")),
    readJson<RoutingReport>(path.join(reportsDir, "ai-l2-parser-gap-routing-latest.json")),
    readJson<CacheFkReview>(path.join(reportsDir, "ai-l2-cache-fk-review-latest.json")),
  ]);

  const queueRows = evalQueue.rows.filter((row) => targetLanes.includes(row.lane));
  const laneSplitRows = laneSplit.rows.filter((row) => targetLanes.includes(row.lane));
  const routingRows = routing.lanes.filter((row) => targetLanes.includes(row.lane));

  const classifiedExamples = uniqueExamples(
    queueRows.flatMap((row) => [
      ...row.examples.explicit.map((title) => classifyExample(row.lane, title, "explicit")),
      ...row.examples.ambiguous.map((title) => classifyExample(row.lane, title, "ambiguous")),
      ...row.examples.blocked.map((title) => classifyExample(row.lane, title, "blocked")),
    ]),
  );

  const cleanExamples = classifiedExamples.filter((row) => row.bucket === "clean_explicit");
  const aiL2Examples = classifiedExamples.filter((row) => row.bucket === "ai_l2_candidate");
  const blockedExamples = classifiedExamples.filter((row) => row.bucket === "blocked");
  const totals = queueRows.reduce(
    (acc, row) => ({
      total: acc.total + row.total,
      explicitSelfUnlocked: acc.explicitSelfUnlocked + row.explicitSelfUnlocked,
      cleanExplicitSelfUnlocked: acc.cleanExplicitSelfUnlocked + row.cleanExplicitSelfUnlocked,
      carrierAmbiguous: acc.carrierAmbiguous + row.carrierAmbiguous,
      accessoryOrParts: acc.accessoryOrParts + row.accessoryOrParts,
      buyingOrCommercial: acc.buyingOrCommercial + row.buyingOrCommercial,
    }),
    {
      total: 0,
      explicitSelfUnlocked: 0,
      cleanExplicitSelfUnlocked: 0,
      carrierAmbiguous: 0,
      accessoryOrParts: 0,
      buyingOrCommercial: 0,
    },
  );

  const aiL2QuestionContract = {
    question:
      "Given only title/description/seller context, is this exact iPhone Pro 128GB listing explicitly self-unlocked, explicitly carrier-locked/ambiguous, or silent/insufficient?",
    allowedAnswers: [
      "explicit_self_unlocked",
      "explicit_not_self_unlocked_or_carrier_bound",
      "ambiguous_or_silent_carrier_state",
      "not_exact_lane_or_blocked",
    ],
    deterministicPassThrough:
      "Rows with exact model + 128GB + explicit 자급제/공기계/정상해지/언락 wording remain deterministic and do not need AI L2.",
    aiL2Scope:
      "AI L2 may evaluate silent carrier state, weak carrier hints, and carrier ambiguity, but cannot infer self-unlocked from price, seller reputation, clean condition, or ordinary used-phone wording.",
    hardBlocks: [
      "wrong iPhone generation/model, base model, Pro Max, or missing 128GB",
      "parts/accessory/battery/case/film listings",
      "buying/commercial mass-purchase posts",
      "damaged/for-parts rows unless the task is explicitly a parts lane",
    ],
  };

  const cacheMetadataFieldsNeeded = [
    "pid",
    "content_hash",
    "source_table",
    "lane",
    "category",
    "title",
    "description_preview",
    "price",
    "sale_status",
    "parser_sku_id",
    "parser_comparable_key",
    "parser_needs_review",
    "parser_reject_reasons",
    "carrier_state_question_version",
    "ai_l2_answer",
    "ai_l2_confidence",
    "evidence_spans",
    "model",
    "prompt_hash",
    "classified_at",
    "policy_blockers",
  ];

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    directThirtyDayPlanEdit: false,
    ownership: "iPhone 12/13 Pro 128GB self-unlocked AI L2 evaluation packet only",
    inputFiles: [
      "reports/iphone-self-unlocked-eval-queue-latest.json",
      "reports/iphone-self-unlocked-eval-queue-latest.md",
      "reports/lane-next-action-split-latest.json",
      "reports/lane-next-action-split-latest.md",
      "reports/ai-l2-parser-gap-routing-latest.json",
      "reports/ai-l2-parser-gap-routing-latest.md",
      "reports/ai-l2-cache-fk-review-latest.json",
      "reports/ai-l2-cache-fk-review-latest.md",
    ],
    policy: evalQueue.policy,
    totals,
    byLane: queueRows.map((queueRow) => ({
      ...queueRow,
      laneSplit: laneSplitRows.find((row) => row.lane === queueRow.lane),
      routing: routingRows.find((row) => row.lane === queueRow.lane),
    })),
    exampleCounts: {
      classifiedExamples: classifiedExamples.length,
      cleanExplicitExamples: cleanExamples.length,
      aiL2CandidateExamples: aiL2Examples.length,
      blockedExamples: blockedExamples.length,
    },
    cleanExplicitExamples: cleanExamples,
    aiL2CandidateExamples: aiL2Examples,
    blockedExamples,
    aiL2QuestionContract,
    cacheMetadataFieldsNeeded,
    cachePolicyDependency: {
      status: cacheFkReview.decision?.status ?? "review_only_no_migration_applied",
      blocker:
        "Needs-review escrow cache writes remain blocked until FK/cache approval; this packet defines metadata and policy only.",
    },
    decision: {
      deterministicRecall: "remain_capped_to_explicit_self_unlocked_only",
      aiL2: "evaluate_silent_or_ambiguous_carrier_state_after_cache_fk_approval_or_report_only_batch",
      moreMining: "needed_for_exact_clean_iPhone_12_13_Pro_128GB_eval_rows",
      runtimePatch: "not_recommended",
      rationale:
        "Explicit self-unlocked wording is safe deterministically; silent or ambiguous carrier state is semantic and should not be rescued by weakening parser/catalog recall.",
    },
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, `${outputBase}.json`);
  const mdPath = path.join(reportsDir, `${outputBase}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# iPhone Self-Unlocked AI L2 Evaluation Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- runtimeCatalogApply: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision.deterministicRecall}`,
    "",
    "## Key Counts",
    "",
    `- totalRows: ${totals.total}`,
    `- explicitSelfUnlocked: ${totals.explicitSelfUnlocked}`,
    `- cleanExplicitSelfUnlocked: ${totals.cleanExplicitSelfUnlocked}`,
    `- carrierAmbiguous: ${totals.carrierAmbiguous}`,
    `- accessoryOrParts: ${totals.accessoryOrParts}`,
    `- buyingOrCommercial: ${totals.buyingOrCommercial}`,
    `- cleanExplicitExamples: ${report.exampleCounts.cleanExplicitExamples}`,
    `- aiL2CandidateExamples: ${report.exampleCounts.aiL2CandidateExamples}`,
    `- blockedExamples: ${report.exampleCounts.blockedExamples}`,
    "",
    "## Lane Counts",
    "",
    mdTable(
      ["lane", "total", "explicit", "cleanExplicit", "ambiguous", "parts/accessory", "buying/commercial", "nextAction"],
      report.byLane.map((row) => [
        row.lane,
        row.total,
        row.explicitSelfUnlocked,
        row.cleanExplicitSelfUnlocked,
        row.carrierAmbiguous,
        row.accessoryOrParts,
        row.buyingOrCommercial,
        row.laneSplit?.nextAction,
      ]),
    ),
    "",
    "## Clean Explicit Samples",
    "",
    mdTable(
      ["lane", "title", "reason"],
      cleanExamples.map((row) => [row.lane, row.title, row.reason]),
    ),
    "",
    "## AI L2 Candidate Samples",
    "",
    mdTable(
      ["lane", "title", "reason"],
      aiL2Examples.map((row) => [row.lane, row.title, row.reason]),
    ),
    "",
    "## Blocked Sample Rules",
    "",
    mdTable(
      ["lane", "title", "reason"],
      blockedExamples.slice(0, 20).map((row) => [row.lane, row.title, row.reason]),
    ),
    "",
    "## AI L2 Question Contract",
    "",
    `- question: ${aiL2QuestionContract.question}`,
    `- allowedAnswers: ${aiL2QuestionContract.allowedAnswers.join(", ")}`,
    `- deterministicPassThrough: ${aiL2QuestionContract.deterministicPassThrough}`,
    `- aiL2Scope: ${aiL2QuestionContract.aiL2Scope}`,
    "",
    "## Cache Metadata Fields Needed",
    "",
    ...cacheMetadataFieldsNeeded.map((field) => `- ${field}`),
    "",
    "## Decision",
    "",
    `- deterministicRecall: ${report.decision.deterministicRecall}`,
    `- aiL2: ${report.decision.aiL2}`,
    `- moreMining: ${report.decision.moreMining}`,
    `- runtimePatch: ${report.decision.runtimePatch}`,
    `- rationale: ${report.decision.rationale}`,
    "",
  ].join("\n");
  await writeFile(mdPath, `${md}\n`);

  console.log(JSON.stringify({
    deterministicRecall: report.decision.deterministicRecall,
    totalRows: totals.total,
    cleanExplicitSelfUnlocked: totals.cleanExplicitSelfUnlocked,
    carrierAmbiguous: totals.carrierAmbiguous,
    cleanExplicitExamples: report.exampleCounts.cleanExplicitExamples,
    aiL2CandidateExamples: report.exampleCounts.aiL2CandidateExamples,
    blockedExamples: report.exampleCounts.blockedExamples,
    jsonPath,
    mdPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
