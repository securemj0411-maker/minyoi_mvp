import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type HeldReview = {
  laneReports: Array<{
    sku: string;
    metrics: {
      activeRows: number;
      activeCleanRows: number;
      activeProblemRows: number;
      activeCleanRate: number;
    };
    activeProblemRows: Array<{
      pid: number;
      title: string;
      price: number;
      detailListingType: string;
      saleStatus: string | null;
      detailNeedsReview: boolean;
    }>;
  }>;
};

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

function compact(text: unknown, limit = 78) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function classifyPattern(title: string, detailType: string, price: number) {
  const text = title.toLowerCase();
  if (/이어폰/.test(text)) return "headphone_vs_earphone_word_conflict";
  if (price <= 50_000) return "too_low_price_accessory_or_fault_risk";
  if (detailType === "damaged") return "detail_damage_context";
  if (detailType === "accessory") return "detail_accessory_context";
  if (detailType === "callout") return "detail_callout_context";
  return "manual_review_context";
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const held = await readJson<HeldReview>("reports/headphone-held-lane-guardrail-review-latest.json");
  const lane = held.laneReports.find((row) => row.sku === "sony-wh-ch720n");
  if (!lane) throw new Error("sony-wh-ch720n lane missing");
  const problemRows = lane.activeProblemRows.map((row) => ({
    ...row,
    pattern: classifyPattern(row.title, row.detailListingType, row.price),
  }));
  const patternCounts = Object.entries(problemRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.pattern] = (acc[row.pattern] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const proposedGuards = [
    {
      guard: "CH720N title/detail contains 이어폰",
      action: "manual_review_or_hold",
      reason: "CH720N is headphone lane, but live problem row used 이어폰 wording and detail classifier switched to callout.",
    },
    {
      guard: "CH720N active price <= 50,000",
      action: "manual_review_or_hold",
      reason: "Observed active accessory/problem row at 40,000원; low price is not sufficient alone, but useful with weak detail/context.",
    },
    {
      guard: "detail classifier returns damaged/accessory/callout",
      action: "hard_hold",
      reason: "No candidate-pool entry should survive if detail classifier is no longer normal.",
    },
  ];
  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    runtimePatchApplied: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    category: "headphone_discovered",
    sku: "sony-wh-ch720n",
    metrics: lane.metrics,
    problemRows,
    patternCounts,
    proposedGuards,
    decision: "sony_wh_ch720n_guardrail_packet_ready_report_only",
    nextStep:
      "Keep CH720N out of acquisition until these guardrails are regression-tested against active clean rows.",
  };
  await writeFile(path.join(reportsDir, "headphone-ch720n-guardrail-packet-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Headphone CH720N Guardrail Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- runtimePatchApplied: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- activeRows: ${lane.metrics.activeRows}`,
    `- activeCleanRows: ${lane.metrics.activeCleanRows}`,
    `- activeProblemRows: ${lane.metrics.activeProblemRows}`,
    `- activeCleanRate: ${(lane.metrics.activeCleanRate * 100).toFixed(1)}%`,
    "",
    "## Problem Patterns",
    "",
    mdTable(["pattern", "count"], patternCounts),
    "",
    "## Problem Rows",
    "",
    mdTable(
      ["pid", "title", "price", "detailType", "pattern"],
      problemRows.map((row) => [row.pid, compact(row.title), row.price, row.detailListingType, row.pattern]),
    ),
    "",
    "## Proposed Guards",
    "",
    mdTable(
      ["guard", "action", "reason"],
      proposedGuards.map((row) => [row.guard, row.action, row.reason]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-ch720n-guardrail-packet-latest.md"), `${md}\n`);
  console.log(`headphone CH720N guardrail packet: problems=${problemRows.length}, patterns=${patternCounts.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
