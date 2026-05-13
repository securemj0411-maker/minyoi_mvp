import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type DetailReport = {
  rows?: Array<{
    pid: string;
    title: string;
    price: number;
    detailComparableKey?: string | null;
    activeClean?: boolean;
    exactButBundleReview?: boolean;
    sold?: boolean;
    listingType?: string;
    reasons?: string[];
    descriptionPreview?: string;
  }>;
};

const SOURCES = [
  { lane: "switch_oled", file: "switch-oled-no-write-detail-verification-latest.json", cap: 12 },
  { lane: "ps5_disc_digital_standard", file: "ps5-disc-digital-no-write-detail-verification-latest.json", cap: 12 },
  { lane: "ipad_pro_13_m2_refined_wifi", file: "ipad-pro-13-m2-refined-no-write-detail-verification-latest.json", cap: 10 },
  { lane: "ipad_pro_11_m4_256_wifi", file: "ipad-pro-11-m4-no-write-detail-verification-latest.json", cap: 10 },
] as const;

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, "reports", relativePath), "utf8")) as T;
}

function isHardHold(reasons: string[]) {
  return reasons.some((reason) =>
    reason.startsWith("sold_") ||
    reason.startsWith("listing_type_") ||
    reason.includes("accessory_only") ||
    reason.includes("game_or_account") ||
    reason.includes("damaged_or_parts") ||
    reason.includes("wrong_model") ||
    reason.includes("wrong_generation") ||
    reason.includes("cellular_signal") ||
    reason === "buying_signal",
  );
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function compact(text: unknown, limit = 92) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "_none_";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => String(row[header] ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const queue = [];
  const skipped = [];

  for (const source of SOURCES) {
    const report = await readJson<DetailReport>(source.file);
    const bundleRows = (report.rows ?? []).filter((row) => row.exactButBundleReview || row.reasons?.some((reason) => reason.includes("bundle_price_review")));
    let selected = 0;
    for (const row of bundleRows) {
      const reasons = row.reasons ?? [];
      if (isHardHold(reasons)) {
        skipped.push({ lane: source.lane, pid: row.pid, title: row.title, reasons, skipReason: "hard_hold_signal" });
        continue;
      }
      if (selected >= source.cap) {
        skipped.push({ lane: source.lane, pid: row.pid, title: row.title, reasons, skipReason: "lane_cap" });
        continue;
      }
      selected += 1;
      queue.push({
        lane: source.lane,
        pid: row.pid,
        title: row.title,
        price: row.price,
        comparableKey: row.detailComparableKey ?? null,
        reasons,
        descriptionPreview: row.descriptionPreview ?? "",
        requestedSchema: "bundle_l2_v1",
      });
    }
  }

  const output = {
    generatedAt,
    scope: "ai_l2_bundle_eval_queue",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    queue,
    skipped,
    metrics: {
      queuedRows: queue.length,
      skippedRows: skipped.length,
    },
    byLane: countBy(queue, (row) => row.lane),
    skippedByReason: countBy(skipped, (row) => row.skipReason),
    decision:
      queue.length > 0
        ? "bundle_l2_eval_queue_ready_no_api_call_yet"
        : "bundle_l2_eval_queue_empty_keep_no_write",
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-eval-queue-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  const md = [
    "# AI L2 Bundle Eval Queue",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${output.decision}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    `- queuedRows: ${output.metrics.queuedRows}`,
    `- skippedRows: ${output.metrics.skippedRows}`,
    "",
    "## By Lane",
    "",
    "```json",
    JSON.stringify(output.byLane, null, 2),
    "```",
    "",
    "## Queue",
    "",
    mdTable(queue.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      price: row.price,
      comparableKey: row.comparableKey,
      reasons: row.reasons.join("; "),
      title: compact(row.title),
    }))),
    "",
    "## Skipped",
    "",
    "```json",
    JSON.stringify(output.skippedByReason, null, 2),
    "```",
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "ai-l2-bundle-eval-queue-latest.md"), md);
  console.log(JSON.stringify(output.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
