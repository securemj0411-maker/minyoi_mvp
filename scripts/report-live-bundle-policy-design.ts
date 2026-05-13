import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const reportDir = path.join(root, "reports");

type VerificationReport = {
  scope?: string;
  inputRows?: number;
  detailFetched?: number;
  activeClean?: number;
  bundlePriceReview?: number;
  holdOrReview?: number;
  rows?: Array<{
    pid: string;
    title: string;
    price: number;
    activeClean?: boolean;
    exactButBundleReview?: boolean;
    sold?: boolean;
    saleStatus?: string | null;
    listingType?: string;
    detailNeedsReview?: boolean;
    reasons?: string[];
  }>;
};

function readJson<T>(fileName: string, fallback: T): T {
  const filePath = path.join(reportDir, fileName);
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function reasonCount(rows: Array<{ reasons?: string[] }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const reason of row.reasons ?? []) counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count }));
}

function summarizeLane(lane: string, report: VerificationReport) {
  const rows = report.rows ?? [];
  const soldInactive = rows.filter((row) => row.sold || row.reasons?.some((reason) => reason.startsWith("sold_"))).length;
  const bundleRows = rows.filter((row) => row.exactButBundleReview || row.reasons?.some((reason) => reason.includes("bundle_price_review"))).length;
  const parserReview = rows.filter((row) => row.detailNeedsReview || row.reasons?.includes("detail_parse_needs_review")).length;
  return {
    lane,
    sourceScope: report.scope ?? "unknown",
    inputRows: report.inputRows ?? rows.length,
    detailFetched: report.detailFetched ?? rows.length,
    activeClean: report.activeClean ?? rows.filter((row) => row.activeClean).length,
    bundleRows,
    soldInactive,
    parserReview,
    holdOrReview: report.holdOrReview ?? rows.filter((row) => !row.activeClean).length,
    topReasons: reasonCount(rows).slice(0, 8),
  };
}

async function main() {
  const lanes = [
    summarizeLane(
      "monitor_exact_model_code",
      readJson<VerificationReport>("monitor-exact-no-write-detail-verification-latest.json", {}),
    ),
    summarizeLane(
      "switch_oled",
      readJson<VerificationReport>("switch-oled-no-write-detail-verification-latest.json", {}),
    ),
    summarizeLane(
      "ipad_pro_13_m2_refined_wifi",
      readJson<VerificationReport>("ipad-pro-13-m2-refined-no-write-detail-verification-latest.json", {}),
    ),
    summarizeLane(
      "ipad_pro_11_m4_256_wifi",
      readJson<VerificationReport>("ipad-pro-11-m4-no-write-detail-verification-latest.json", {}),
    ),
    summarizeLane(
      "ps5_disc_digital_standard",
      readJson<VerificationReport>("ps5-disc-digital-no-write-detail-verification-latest.json", {}),
    ),
    summarizeLane(
      "galaxy_buds_3_pro",
      readJson<VerificationReport>("galaxy-buds3-pro-no-write-detail-verification-latest.json", {}),
    ),
  ];

  const policy = [
    {
      id: "fresh_detail_required",
      rule: "Search-clean rows never become acquisition/write candidates until detail is refetched immediately before use.",
      reason: "iPad and PS5 both had search-clean rows that were SOLD_OUT/RESERVED in detail.",
    },
    {
      id: "active_status_required",
      rule: "Only detail rows with non-terminal sale status and no sold-out text can be active_clean.",
      reason: "Sold/inactive rows are not inventory, but they are useful for market velocity statistics later.",
    },
    {
      id: "bundle_price_review_default_hold",
      rule: "Rows with Apple Pencil, Magic Keyboard, extra controllers, game titles, or similar paid extras stay review-only unless a lane-specific bundle normalization key exists.",
      reason: "Bundle rows are real products but not price-comparable to bare-unit rows.",
    },
    {
      id: "bundle_can_be_ai_l2_not_auto_pass",
      rule: "AI L2 may label bundle rows, but AI pass cannot remove bundle review flags or public-pool blocks by itself.",
      reason: "The AI can explain package contents; it should not silently normalize price without a policy.",
    },
    {
      id: "bundle_payload_schema_required",
      rule: "Before bundle rows can become acquisition candidates, the system needs explicit bundle payload fields: base item, included extras, whether extras are paid-value, and whether the visible price is base-only or package price.",
      reason: "Switch/PS5/iPad rows often contain real product bodies plus extras; treating them as clean bare-unit comps corrupts market price.",
    },
    {
      id: "bundle_lanes_do_not_block_bare_lanes",
      rule: "Bare-unit exact lanes can continue when active_clean is thick enough; bundle-heavy rows are forked to AI L2/manual bundle lanes instead of weakening the bare lane.",
      reason: "Galaxy Buds3 Pro passed after hard parts/buying filtering; Switch/PS5 did not, because their remaining ambiguity is package price, not SKU identity.",
    },
    {
      id: "tiny_acquisition_threshold",
      rule: "A new exact lane needs at least 4 active_clean detail rows for owner review and at least 8 active_clean detail rows for a stronger tiny acquisition design.",
      reason: "Monitor, AirPods Max, Sony, JBL, and Galaxy Buds3 Pro have enough exact active-clean evidence; Switch/PS5/iPad still need bundle policy or more clean detail rows.",
    },
  ];

  const output = {
    generatedAt: new Date().toISOString(),
    scope: "live_detail_and_bundle_policy_design",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    lanes,
    policy,
    decision:
      "Fresh detail refetch and bundle review are launch gates. Bundle-heavy Switch/PS5/iPad rows should move to AI L2/manual bundle lanes; exact bare/full-set lanes continue only when active_clean is thick enough.",
  };

  const md = [
    "# Live Detail + Bundle Policy Design",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    "",
    "## Lane Evidence",
    "",
    "| lane | input | fetched | active clean | sold/inactive | bundle rows | parser review | hold/review |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...lanes.map((lane) =>
      `| ${lane.lane} | ${lane.inputRows} | ${lane.detailFetched} | ${lane.activeClean} | ${lane.soldInactive} | ${lane.bundleRows} | ${lane.parserReview} | ${lane.holdOrReview} |`,
    ),
    "",
    "## Policy",
    "",
    ...policy.map((item) => `- ${item.id}: ${item.rule} Reason: ${item.reason}`),
    "",
    "## Top Reasons",
    "",
    ...lanes.flatMap((lane) => [
      `### ${lane.lane}`,
      "",
      ...(lane.topReasons.length > 0 ? lane.topReasons.map((row) => `- ${row.reason}: ${row.count}`) : ["- none"]),
      "",
    ]),
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "live-bundle-policy-design-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "live-bundle-policy-design-latest.md"), md);
  console.log("wrote reports/live-bundle-policy-design-latest.json");
  console.log("wrote reports/live-bundle-policy-design-latest.md");
  console.log(JSON.stringify({ lanes: lanes.map((lane) => ({ lane: lane.lane, activeClean: lane.activeClean, soldInactive: lane.soldInactive, bundleRows: lane.bundleRows })) }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
