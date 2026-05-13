import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LaneRow = {
  lane: string;
  group: string;
  priority: number;
  why: string;
  nextTask: string;
  forbidden: string;
  evidence: {
    total: number;
    skuMatchPct: string;
    laneMatchPct: string;
    completePct: string;
    needsReviewFalsePct: string;
    unknownPartsPct: string;
    aiL2Reason: string | null;
  };
};

type QueueReport = {
  generatedAt?: string;
  rows?: LaneRow[];
};

type Sample = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
};

type PlanRow = {
  lane: string;
  issue: string;
  repairType: "split_to_exact_lanes" | "tighten_query_context" | "ai_l2_for_silent_options";
  querySeeds: string[];
  rejectSignals: string[];
  stopCondition: string;
  forbidden: string;
  sampleTitles: string[];
  evidence: LaneRow["evidence"];
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const INTEL_DIR = path.join(ROOT, "category-intelligence");
const OUT_JSON = path.join(REPORT_DIR, "broad-query-repair-plan-latest.json");
const OUT_MD = path.join(REPORT_DIR, "broad-query-repair-plan-latest.md");

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function sampleTitles(lane: string): string[] {
  const file = path.join(INTEL_DIR, lane, "samples.json");
  const rows = readJson<Sample[]>(file, []);
  return rows
    .map((row) => String(row.name ?? row.title ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function planFor(row: LaneRow): PlanRow {
  if (row.lane === "lg_gram_17_2024") {
    return {
      lane: row.lane,
      issue: "LG home appliance / wrong-size / weak generation contamination dominates the current query.",
      repairType: "tighten_query_context",
      querySeeds: [
        "\"그램 17\" 2024",
        "\"LG gram 17\" 2024",
        "\"그램 17인치\" 울트라",
        "\"그램 17\" \"Ultra\"",
      ],
      rejectSignals: ["세탁기", "건조기", "스타일러", "청소기", "냉장고", "15인치", "16인치", "2020", "2021", "2022"],
      stopCondition: "At least 30 exact laptop-context samples, skuMatch >= 70%, no home-appliance contamination in first 30 rows.",
      forbidden: row.forbidden,
      sampleTitles: sampleTitles(row.lane),
      evidence: row.evidence,
    };
  }
  if (row.lane === "monitor_discovered") {
    return {
      lane: row.lane,
      issue: "Broad monitor discovery cannot be made ready; exact model-code lanes are required.",
      repairType: "split_to_exact_lanes",
      querySeeds: [
        "\"XL2540K\"",
        "\"27US550\"",
        "\"LS27F354\"",
        "\"27GP850\"",
        "\"S2721DGF\"",
      ],
      rejectSignals: ["모니터암", "거치대", "받침대", "터치", "사이니지", "TV", "본체세트"],
      stopCondition: "For each model-code seed, collect 20+ rows with model code visible and no accessory-only contamination.",
      forbidden: row.forbidden,
      sampleTitles: sampleTitles(row.lane),
      evidence: row.evidence,
    };
  }
  if (row.lane === "laptop") {
    return {
      lane: row.lane,
      issue: "Broad laptop rows mix generations, RAM/SSD, screen size, and chip families.",
      repairType: "split_to_exact_lanes",
      querySeeds: [
        "\"맥북 에어 M2 13\" 256",
        "\"맥북 에어 M3 13\" 256",
        "\"맥북 프로 14 M3\" 18 512",
        "\"그램 17\" 2024",
      ],
      rejectSignals: ["부품용", "액정", "키보드", "배터리", "윈도우 설치", "렌탈", "업자", "대량"],
      stopCondition: "Stop broad laptop patching. Exact lanes must individually hit sample >= 30 and comparableComplete >= 80 or move to AI L2.",
      forbidden: row.forbidden,
      sampleTitles: sampleTitles(row.lane),
      evidence: row.evidence,
    };
  }
  return {
    lane: row.lane,
    issue: "Broad smartphone rows cannot safely infer storage/carrier state from silence.",
    repairType: "ai_l2_for_silent_options",
    querySeeds: [
      "\"아이폰 16 프로\" 128 자급제",
      "\"아이폰 15 프로\" 128 자급제",
      "\"갤럭시 S24 울트라\" 256 자급제",
      "\"갤럭시 S25 울트라\" 256 자급제",
    ],
    rejectSignals: ["선택약정", "확정기변", "완납폰", "통신사", "유심", "케이스", "액정", "부품", "삽니다"],
    stopCondition: "Explicit self/unlocked samples only. Silent carrier-state recall goes to AI L2, not deterministic token weakening.",
    forbidden: row.forbidden,
    sampleTitles: sampleTitles(row.lane),
    evidence: row.evidence,
  };
}

const queue = readJson<QueueReport>(path.join(REPORT_DIR, "mining-query-repair-queue-latest.json"), {});
const rows = (queue.rows ?? [])
  .filter((row) => row.group === "broad_scope_query_repair")
  .map(planFor)
  .sort((a, b) => a.lane.localeCompare(b.lane));
const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  sourceQueue: queue.generatedAt ?? null,
  rows,
};

const md = [
  "# Broad Query Repair Plan",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  `- sourceQueue: ${queue.generatedAt ?? "-"}`,
  "",
  "## Plan",
  "",
  mdTable(
    ["lane", "repair", "issue", "query seeds", "reject signals", "stop condition"],
    rows.map((row) => [
      row.lane,
      row.repairType,
      row.issue,
      row.querySeeds.join("<br>"),
      row.rejectSignals.join(", "),
      row.stopCondition,
    ]),
  ),
  "",
  "## Sample Titles",
  "",
  ...rows.flatMap((row) => [
    `### ${row.lane}`,
    "",
    ...row.sampleTitles.map((title) => `- ${title}`),
    "",
  ]),
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, md);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.log(`rows=${rows.length}`);
