import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = {
  category: string;
  report: string;
  status: "parser_candidate" | "parser_candidate_report_only" | "hold_report_only" | "hold_or_split";
  primaryMetric: string;
  caveat: string;
  recommendation: string;
  nextAction: string;
};

const reportsDir = path.join(process.cwd(), "reports");

const reportFiles = [
  "earphone-parser-latest.json",
  "headphone-parser-latest.json",
  "monitor-parser-latest.json",
  "desktop-parser-latest.json",
  "game-console-body-narrow-latest.json",
  "game-console-narrowing-latest.json",
  "camera-parser-latest.json",
  "smartwatch-parser-latest.json",
  "speaker-parser-latest.json",
  "home-appliance-parser-latest.json",
];

const CATEGORY_BY_REPORT: Record<string, string> = {
  "monitor-parser-latest.json": "monitor_discovered",
  "game-console-body-narrow-latest.json": "game_console_body_narrow",
};

function pct(value: unknown): string | null {
  return typeof value === "number" ? `${value}%` : null;
}

function classify(recommendation: string): Row["status"] {
  if (recommendation.startsWith("parser_candidate_report_only")) return "parser_candidate_report_only";
  if (recommendation.startsWith("parser_candidate")) return "parser_candidate";
  if (recommendation.startsWith("hold_or_split")) return "hold_or_split";
  return "hold_report_only";
}

function metricFor(report: Record<string, unknown>): string {
  const pairs: Array<[string, unknown]> = [
    ["parser_ready", report.parserReadyRate],
    ["eligible_parser_ready", report.eligibleParserReadyRate],
    ["normal_parser_ready", report.normalParserReadyRate],
    ["model_ready", report.modelReadyRate],
    ["model_matched", report.modelMatchedRate],
    ["console_candidate", report.consoleCandidateRate],
  ];
  const found = pairs.find(([, value]) => typeof value === "number");
  if (!found) return "n/a";
  return `${found[0]}=${pct(found[1])}`;
}

function nextActionFor(category: string, status: Row["status"], recommendation: string): string {
  if (status === "parser_candidate" && category === "earphone_discovered") return "AirPods-focused policy만 internal 검토; non-AirPods는 approval-only";
  if (status === "parser_candidate" && category === "headphone_discovered") return "matched SKU 중심 internal parser 검토; AirPods Max ambiguous는 review 유지";
  if (status === "parser_candidate" && category === "monitor_discovered") return "모델코드 있는 샘플만 pool policy 설계; generic monitor 금지";
  if (status === "parser_candidate_report_only" && category === "desktop_pc_discovered") return "CPU/GPU 완본체 후보만 policy 설계; commercial/multi gate 선행";
  if (category === "game_console_body_narrow") return "body_narrow만 유지; broad game_console은 split 유지";
  if (recommendation.includes("runtime")) return "runtime category/parser 설계 전까지 hold";
  if (recommendation.includes("generic")) return "generic family 축 분리 전까지 hold";
  return "review-gated 유지";
}

function caveatFor(category: string, report: Record<string, unknown>, recommendation: string): string {
  if (category === "game_console_body_narrow") {
    return "narrowing 후보성은 높지만 parser report는 60% 미만이면 internal skeleton만";
  }
  if (category === "monitor_discovered") {
    return "eligible 기준은 60.7%, 전체 parser_ready는 낮으므로 model-code rows only";
  }
  if (category === "earphone_discovered") {
    return "AirPods-focused 결과이며 non-AirPods coverage로 해석 금지";
  }
  if (recommendation.includes("runtime")) return "runtime category/comparable-key 없음";
  if (typeof report.genericRate === "number" && report.genericRate >= 50) return "generic 비율 높음";
  return "";
}

async function main(): Promise<void> {
  const rows: Row[] = [];
  for (const file of reportFiles) {
    const fullPath = path.join(reportsDir, file);
    let report: Record<string, unknown>;
    try {
      report = JSON.parse(await readFile(fullPath, "utf8")) as Record<string, unknown>;
    } catch {
      continue;
    }
    const category = String(report.category ?? CATEGORY_BY_REPORT[file] ?? file.replace(/-latest\.json$/, ""));
    const recommendation = String(report.recommendation ?? report.decision ?? "hold_report_only: no recommendation");
    const status = classify(recommendation);
    rows.push({
      category,
      report: file,
      status,
      primaryMetric: metricFor(report),
      caveat: caveatFor(category, report, recommendation),
      recommendation,
      nextAction: nextActionFor(category, status, recommendation),
    });
  }

  const order: Record<Row["status"], number> = {
    parser_candidate: 0,
    parser_candidate_report_only: 1,
    hold_or_split: 2,
    hold_report_only: 3,
  };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.category.localeCompare(b.category));

  const summary = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    totalReports: rows.length,
    counts: rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {}),
    rows,
    guardrails: [
      "public promotion 없음",
      "production DB mutation 없음",
      "cron/lifecycle/pack open/source health 건드리지 않음",
      "30일_실행계획.md 수정 없음",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-readiness-summary-latest.json"), JSON.stringify(summary, null, 2));

  const table = [
    "| category | status | metric | caveat | next_action |",
    "| --- | --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.category} | ${row.status} | ${row.primaryMetric} | ${row.caveat || "-"} | ${row.nextAction} |`),
  ].join("\n");

  const md = [
    "# Parser Readiness Summary",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...summary.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-readiness-summary-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-readiness-summary-latest.json");
  console.log("wrote reports/parser-readiness-summary-latest.md");
  console.log(JSON.stringify(summary.counts));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
