import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type ValidatorReport = {
  metrics: {
    providedResultRows: number;
    validRows: number;
    invalidRows: number;
    bareComparableRows: number;
    bundleReviewRows: number;
    rejectRows: number;
  };
  validations: Array<{
    key: string;
    valid: boolean;
    errors: string[];
    warnings: string[];
  }>;
};

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

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const validator = await readJson<ValidatorReport>("ai-l2-bundle-result-validator-latest.json");

  const routes = [
    {
      aiComparablePolicy: "bare_comparable",
      allowedNextState: "internal_acquisition_review_only",
      publicPoolAllowed: false,
      requiredBeforeWrite: [
        "validator validRows includes the row",
        "same-request live detail refetch remains active",
        "lane has pool_eligible=false write path available",
        "owner reviews bare_comparable examples for the lane",
      ],
      forbidden: [
        "do not set needs_review=false from AI alone",
        "do not write to mvp_candidate_pool",
        "do not change category readiness to ready",
      ],
    },
    {
      aiComparablePolicy: "bundle_review",
      allowedNextState: "bundle_manual_or_bundle_key_backlog",
      publicPoolAllowed: false,
      requiredBeforeWrite: [
        "define lane-specific bundle key such as switch_oled_plus_game or ps5_plus_extra_controller",
        "separate package-total price from base-only price",
        "collect enough bundle comps before any pricing use",
      ],
      forbidden: [
        "do not compare package-total price against bare-unit market stats",
        "do not rescue bundle_review rows into public pool",
      ],
    },
    {
      aiComparablePolicy: "reject",
      allowedNextState: "hold_or_exclude",
      publicPoolAllowed: false,
      requiredBeforeWrite: ["no write needed unless creating an AI cache audit row later"],
      forbidden: ["do not retry repeatedly without title/detail/price change"],
    },
  ];

  const launchGate = [
    "AI L2 result table/cache schema must be owner-approved before persistence.",
    "Any persisted AI classification must be attached to raw pid/detail hash, not candidate-pool visibility.",
    "Candidate-pool release requires deterministic lane readiness plus live verify; AI metadata alone is insufficient.",
    "Bundle-review rows require separate bundle market stats before they can be monetized.",
  ];

  const output = {
    generatedAt,
    scope: "ai_l2_bundle_downstream_plan",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    validatorMetrics: validator.metrics,
    routes,
    launchGate,
    decision:
      validator.metrics.invalidRows === 0 && validator.metrics.validRows > 0
        ? "ai_l2_bundle_downstream_plan_ready_before_cap18_eval"
        : "ai_l2_bundle_downstream_plan_wait_for_valid_eval",
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-downstream-plan-latest.json"), `${JSON.stringify(output, null, 2)}\n`);

  const md = [
    "# AI L2 Bundle Downstream Plan",
    "",
    `- generatedAt: ${generatedAt}`,
    `- decision: ${output.decision}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Validator Metrics",
    "",
    "```json",
    JSON.stringify(output.validatorMetrics, null, 2),
    "```",
    "",
    "## Routes",
    "",
    mdTable(routes.map((route) => ({
      aiComparablePolicy: route.aiComparablePolicy,
      allowedNextState: route.allowedNextState,
      publicPoolAllowed: route.publicPoolAllowed,
      requiredBeforeWrite: route.requiredBeforeWrite.join("; "),
      forbidden: route.forbidden.join("; "),
    }))),
    "",
    "## Launch Gate",
    "",
    ...launchGate.map((item) => `- ${item}`),
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "ai-l2-bundle-downstream-plan-latest.md"), md);
  console.log(JSON.stringify({ decision: output.decision, validatorMetrics: output.validatorMetrics }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
