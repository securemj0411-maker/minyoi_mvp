import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const PACKAGE_TYPES = new Set([
  "bare_unit",
  "full_set",
  "light_bundle",
  "paid_bundle",
  "accessory_only",
  "parts_or_damaged",
  "buying",
  "unclear",
]);
const VISIBLE_PRICE_SCOPES = new Set(["base_only", "package_total", "unclear"]);
const COMPARABLE_POLICIES = new Set(["bare_comparable", "bundle_review", "reject"]);

type PromptPacket = {
  rows: Array<{
    lane: string;
    pid: string;
    title: string;
    price: number;
    expectedSafeDefault: string;
  }>;
};

type BundleL2Result = {
  pid: string;
  lane: string;
  base_item_present: boolean;
  base_item_sku_match: boolean;
  package_type: string;
  included_extras: string[];
  extras_estimated_paid_value_krw: number | null;
  visible_price_scope: string;
  comparable_policy: string;
  confidence: number;
  reason_codes: string[];
};

function normalizeProvidedResult(row: unknown): BundleL2Result {
  const raw = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const fields = raw.fields && typeof raw.fields === "object" ? (raw.fields as Record<string, unknown>) : raw;
  return {
    pid: String(raw.pid ?? fields.pid ?? ""),
    lane: String(raw.lane ?? fields.lane ?? ""),
    base_item_present: fields.base_item_present as boolean,
    base_item_sku_match: fields.base_item_sku_match as boolean,
    package_type: String(fields.package_type ?? ""),
    included_extras: fields.included_extras as string[],
    extras_estimated_paid_value_krw: fields.extras_estimated_paid_value_krw as number | null,
    visible_price_scope: String(fields.visible_price_scope ?? ""),
    comparable_policy: String(fields.comparable_policy ?? ""),
    confidence: fields.confidence as number,
    reason_codes: fields.reason_codes as string[],
  };
}

async function readJson<T>(fileName: string): Promise<T> {
  return JSON.parse(await readFile(path.join(reportsDir, fileName), "utf8")) as T;
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

function resultTemplate(row: PromptPacket["rows"][number]): BundleL2Result & { status: "pending_ai_eval" } {
  return {
    status: "pending_ai_eval",
    pid: row.pid,
    lane: row.lane,
    base_item_present: false,
    base_item_sku_match: false,
    package_type: "unclear",
    included_extras: [],
    extras_estimated_paid_value_krw: null,
    visible_price_scope: "unclear",
    comparable_policy: row.expectedSafeDefault === "reject" ? "reject" : "bundle_review",
    confidence: 0,
    reason_codes: ["pending_ai_eval"],
  };
}

function validateResult(row: BundleL2Result, knownKeys: Set<string>) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const key = `${row.lane}:${row.pid}`;

  if (!knownKeys.has(key)) errors.push("result_not_in_prompt_packet");
  if (typeof row.base_item_present !== "boolean") errors.push("base_item_present_not_boolean");
  if (typeof row.base_item_sku_match !== "boolean") errors.push("base_item_sku_match_not_boolean");
  if (!PACKAGE_TYPES.has(row.package_type)) errors.push("invalid_package_type");
  if (!Array.isArray(row.included_extras)) errors.push("included_extras_not_array");
  if (
    row.extras_estimated_paid_value_krw !== null &&
    (typeof row.extras_estimated_paid_value_krw !== "number" || row.extras_estimated_paid_value_krw < 0)
  ) {
    errors.push("invalid_extras_estimated_paid_value_krw");
  }
  if (!VISIBLE_PRICE_SCOPES.has(row.visible_price_scope)) errors.push("invalid_visible_price_scope");
  if (!COMPARABLE_POLICIES.has(row.comparable_policy)) errors.push("invalid_comparable_policy");
  if (typeof row.confidence !== "number" || row.confidence < 0 || row.confidence > 1) errors.push("invalid_confidence");
  if (!Array.isArray(row.reason_codes)) errors.push("reason_codes_not_array");

  if (row.comparable_policy === "bare_comparable") {
    if (!row.base_item_present) errors.push("bare_comparable_without_base_item_present");
    if (!row.base_item_sku_match) errors.push("bare_comparable_without_sku_match");
    if (row.visible_price_scope !== "base_only") errors.push("bare_comparable_without_base_only_price");
    if (row.package_type === "paid_bundle" || row.package_type === "unclear") errors.push("bare_comparable_for_paid_or_unclear_bundle");
    warnings.push("bare_comparable_still_report_only_no_public_release");
  }

  if (row.package_type === "paid_bundle" && row.comparable_policy !== "bundle_review") {
    errors.push("paid_bundle_must_remain_bundle_review");
  }
  if (row.visible_price_scope === "unclear" && row.comparable_policy === "bare_comparable") {
    errors.push("unclear_price_scope_cannot_be_bare_comparable");
  }
  if (["accessory_only", "parts_or_damaged", "buying"].includes(row.package_type) && row.comparable_policy !== "reject") {
    errors.push("hard_negative_package_type_must_reject");
  }

  return { key, valid: errors.length === 0, errors, warnings };
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const packet = await readJson<PromptPacket>("ai-l2-bundle-eval-prompt-packet-latest.json");
  const templateRows = packet.rows.map(resultTemplate);
  const knownKeys = new Set(packet.rows.map((row) => `${row.lane}:${row.pid}`));

  const resultsFileName = process.env.AI_L2_BUNDLE_RESULTS_FILE ?? "";
  let providedResults: BundleL2Result[] = [];
  let mode = "template_only_no_ai_results";
  if (resultsFileName) {
    const provided = await readJson<{ rows?: BundleL2Result[] } | BundleL2Result[]>(resultsFileName);
    const rawRows = Array.isArray(provided) ? provided : provided.rows ?? [];
    providedResults = rawRows.map(normalizeProvidedResult);
    mode = "validate_provided_results";
  }

  const validations = providedResults.map((row) => validateResult(row, knownKeys));
  const output = {
    generatedAt,
    scope: "ai_l2_bundle_result_validator",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    mode,
    templateRows,
    metrics: {
      promptPacketRows: packet.rows.length,
      providedResultRows: providedResults.length,
      validRows: validations.filter((row) => row.valid).length,
      invalidRows: validations.filter((row) => !row.valid).length,
      bareComparableRows: providedResults.filter((row) => row.comparable_policy === "bare_comparable").length,
      bundleReviewRows: providedResults.filter((row) => row.comparable_policy === "bundle_review").length,
      rejectRows: providedResults.filter((row) => row.comparable_policy === "reject").length,
    },
    validations,
    decision:
      providedResults.length === 0
        ? "result_template_ready_waiting_for_no_write_ai_eval"
        : validations.every((row) => row.valid)
          ? "provided_ai_l2_results_schema_valid_report_only"
          : "provided_ai_l2_results_invalid_keep_ai_l2_blocked",
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-eval-result-template-latest.json"), `${JSON.stringify({ generatedAt, rows: templateRows }, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "ai-l2-bundle-result-validator-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

  const md = [
    "# AI L2 Bundle Result Validator",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${output.decision}`,
    `- mode: ${mode}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Metrics",
    "",
    "```json",
    JSON.stringify(output.metrics, null, 2),
    "```",
    "",
    "## Validation Rows",
    "",
    mdTable(validations.map((row) => ({
      key: row.key,
      valid: row.valid,
      errors: row.errors.join("; "),
      warnings: row.warnings.join("; "),
    }))),
    "",
    "## Template",
    "",
    `- wrote \`reports/ai-l2-bundle-eval-result-template-latest.json\` with ${templateRows.length} pending rows.`,
    "- This validator never writes to Supabase and never changes public candidate-pool behavior.",
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "ai-l2-bundle-result-validator-latest.md"), md);
  console.log(JSON.stringify(output.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
