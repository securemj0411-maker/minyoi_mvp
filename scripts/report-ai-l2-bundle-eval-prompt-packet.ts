import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type QueueReport = {
  generatedAt: string;
  queue: Array<{
    lane: string;
    pid: string;
    title: string;
    price: number;
    comparableKey: string | null;
    reasons: string[];
    descriptionPreview: string;
    requestedSchema: "bundle_l2_v1";
  }>;
  skipped: Array<{ skipReason: string }>;
};

type ContractReport = {
  outputSchema: unknown;
  hardRules: string[];
  promptContract: string[];
  cacheKey: {
    key: string;
    invalidation: string[];
  };
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, relativePath), "utf8")) as T;
}

function compact(text: unknown, limit = 520) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function hashInput(row: QueueReport["queue"][number]) {
  return [
    "bundle_l2_v1",
    row.lane,
    row.pid,
    row.title,
    row.price,
    row.comparableKey ?? "",
    compact(row.descriptionPreview, 120),
  ].join("|");
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 3.2);
}

function buildSystemPrompt(contract: ContractReport) {
  return [
    "You are Minyoi Bundle L2, a conservative package-semantics reviewer for Korean secondhand electronics listings.",
    "Classify only whether the visible listing price is comparable to the bare target item or whether the row needs bundle review/reject.",
    "Return JSON only. Do not write prose.",
    "",
    "Prompt contract:",
    ...contract.promptContract.map((rule) => `- ${rule}`),
    "",
    "Hard rules:",
    ...contract.hardRules.map((rule) => `- ${rule}`),
    "",
    "Output schema:",
    JSON.stringify(contract.outputSchema),
  ].join("\n");
}

function buildUserPayload(row: QueueReport["queue"][number]) {
  return {
    schema: row.requestedSchema,
    target_lane: row.lane,
    pid: row.pid,
    title: row.title,
    price_krw: row.price,
    deterministic_comparable_key: row.comparableKey,
    deterministic_review_reasons: row.reasons,
    description_preview: compact(row.descriptionPreview),
    instruction:
      "Classify package semantics only. If extras are paid-value or price scope is unclear, choose bundle_review. Reject hard-hold rows if present.",
  };
}

function expectedSafeDefault(row: QueueReport["queue"][number]) {
  const text = `${row.title} ${row.descriptionPreview}`.toLowerCase();
  if (/구매|삽니다|매입/.test(text)) return "reject";
  if (/고장|파손|수리|액정\s*깨|부품용|부품만|부품\s*판매/.test(text)) return "reject";
  if (/\+|포함|일괄|칩|게임|펜슬|애펜|매직\s*키보드|컨트롤러|듀얼센스|케이스증정/.test(text)) {
    return "bundle_review";
  }
  return "bundle_review";
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
  const queueReport = await readJson<QueueReport>("ai-l2-bundle-eval-queue-latest.json");
  const contract = await readJson<ContractReport>("ai-l2-bundle-payload-contract-latest.json");
  const systemPrompt = buildSystemPrompt(contract);

  const rows = queueReport.queue.map((row) => {
    const userPayload = buildUserPayload(row);
    const userPayloadJson = JSON.stringify(userPayload);
    return {
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      price: row.price,
      cacheKeyPreview: `bundle_l2_v1:${row.lane}:${row.pid}:${Buffer.from(hashInput(row)).toString("base64url").slice(0, 18)}`,
      expectedSafeDefault: expectedSafeDefault(row),
      inputTokenEstimate: estimateTokens(systemPrompt) + estimateTokens(userPayloadJson),
      outputTokenBudget: 220,
      userPayload,
    };
  });

  const laneCounts = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.lane] = (acc[row.lane] ?? 0) + 1;
    return acc;
  }, {});

  const totalInputTokenEstimate = rows.reduce((sum, row) => sum + row.inputTokenEstimate, 0);
  const totalOutputTokenBudget = rows.reduce((sum, row) => sum + row.outputTokenBudget, 0);
  const samplePrompts = rows.slice(0, 3).map((row) => ({
    pid: row.pid,
    lane: row.lane,
    systemPrompt,
    userPayload: row.userPayload,
  }));

  const output = {
    generatedAt,
    scope: "ai_l2_bundle_eval_prompt_packet",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    sourceQueueGeneratedAt: queueReport.generatedAt,
    rows,
    metrics: {
      queuedRows: rows.length,
      skippedRowsFromQueue: queueReport.skipped.length,
      laneCounts,
      totalInputTokenEstimate,
      totalOutputTokenBudget,
      averageInputTokenEstimate: rows.length ? Math.round(totalInputTokenEstimate / rows.length) : 0,
    },
    samplePrompts,
    decision:
      rows.length > 0
        ? "bundle_l2_prompt_packet_ready_for_tiny_no_write_eval"
        : "bundle_l2_prompt_packet_empty_keep_ai_disabled",
    nextStep:
      "Run a tiny no-write AI evaluation against this packet only after API/model/env is explicitly enabled; do not write results to Supabase or candidate pool.",
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-eval-prompt-packet-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

  const md = [
    "# AI L2 Bundle Eval Prompt Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${output.decision}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    `- queuedRows: ${output.metrics.queuedRows}`,
    `- skippedRowsFromQueue: ${output.metrics.skippedRowsFromQueue}`,
    `- totalInputTokenEstimate: ${output.metrics.totalInputTokenEstimate}`,
    `- totalOutputTokenBudget: ${output.metrics.totalOutputTokenBudget}`,
    `- averageInputTokenEstimate: ${output.metrics.averageInputTokenEstimate}`,
    "",
    "## Lane Counts",
    "",
    "```json",
    JSON.stringify(output.metrics.laneCounts, null, 2),
    "```",
    "",
    "## Rows",
    "",
    mdTable(rows.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      price: row.price,
      expectedSafeDefault: row.expectedSafeDefault,
      inputTokens: row.inputTokenEstimate,
      outputBudget: row.outputTokenBudget,
      title: compact(row.title, 92),
    }))),
    "",
    "## Sample Prompt 1",
    "",
    "```json",
    JSON.stringify(samplePrompts[0] ?? null, null, 2),
    "```",
    "",
    "## Decision",
    "",
    `- ${output.nextStep}`,
    "",
  ].join("\n");

  await writeFile(path.join(reportsDir, "ai-l2-bundle-eval-prompt-packet-latest.md"), md);
  console.log(JSON.stringify(output.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
