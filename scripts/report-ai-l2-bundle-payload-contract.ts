import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type BundlePolicy = {
  lanes: Array<{
    lane: string;
    activeClean: number;
    bundleRows: number;
    soldInactive: number;
    holdOrReview: number;
    topReasons: Array<{ reason: string; count: number }>;
  }>;
};

async function readJson<T>(relativePath: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, relativePath), "utf8")) as T;
}

function classifyLane(lane: BundlePolicy["lanes"][number]) {
  if (lane.bundleRows === 0 && lane.activeClean >= 6) return "bare_or_fullset_exact_ready";
  if (lane.bundleRows >= lane.activeClean) return "bundle_ai_l2_required";
  if (lane.activeClean >= 4) return "thin_bare_lane_more_detail_needed";
  return "hold_live_or_bundle_blocked";
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const bundle = await readJson<BundlePolicy>("reports/live-bundle-policy-design-latest.json");
  const lanes = bundle.lanes.map((lane) => ({
    ...lane,
    route: classifyLane(lane),
  }));

  const outputSchema = {
    version: "bundle_l2_v1",
    fields: {
      base_item_present: "boolean - true only when the main target product body/full unit is present",
      base_item_sku_match: "boolean - true only when main product matches the target SKU/lane",
      package_type: "bare_unit | full_set | light_bundle | paid_bundle | accessory_only | parts_or_damaged | buying | unclear",
      included_extras: "array of normalized extras such as controller, game_title, pencil, keyboard, dock, case, storage_card, charger",
      extras_estimated_paid_value_krw: "number|null - rough extra value if obvious; null if unknown",
      visible_price_scope: "base_only | package_total | unclear",
      comparable_policy: "bare_comparable | bundle_review | reject",
      confidence: "0..1",
      reason_codes: "array of short reason codes",
    },
  };

  const hardRules = [
    "AI L2 cannot override sold/inactive, buying, accessory-only, parts/damaged, counterfeit, or wrong-SKU hard holds.",
    "AI L2 cannot set needs_review=false by itself; it only writes classification metadata for a later policy gate.",
    "bundle_review rows cannot enter public candidate pool until a lane-specific bundle normalization policy exists.",
    "If visible_price_scope is unclear, comparable_policy must be bundle_review or reject.",
    "If package_type is paid_bundle, comparable_policy is bundle_review unless the lane has an explicit bundle key.",
  ];

  const cacheKey = {
    key: "provider:model:bundle_l2_v1:target_lane:pid:title_hash:detail_hash:price",
    invalidation: [
      "title changes",
      "detail description changes",
      "price changes",
      "target lane changes",
      "bundle_l2 prompt/schema version changes",
    ],
  };

  const promptContract = [
    "Given title, description, price, target lane, deterministic SKU/comparable key, and known hard-hold signals, classify package semantics only.",
    "Do not estimate market value of the base product.",
    "Do not decide whether to show the listing to users.",
    "Return JSON only matching bundle_l2_v1.",
    "Prefer false positives protection: unclear package price becomes bundle_review.",
  ];

  const report = {
    generatedAt,
    scope: "ai_l2_bundle_payload_contract",
    reportOnly: true,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    lanes,
    outputSchema,
    hardRules,
    cacheKey,
    promptContract,
    decision:
      "AI L2 should first be used for bundle payload metadata, not public promotion. Switch/PS5/iPad are bundle-L2 candidates; Galaxy Buds3 Pro and monitor exact lanes remain deterministic/internal-acquisition candidates.",
  };

  await writeFile(path.join(reportsDir, "ai-l2-bundle-payload-contract-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# AI L2 Bundle Payload Contract",
    "",
    `- generatedAt: ${generatedAt}`,
    `- scope: ${report.scope}`,
    "- reportOnly/runtimeMutation/supabaseMutation/publicPromotion: true/false/false/false",
    "",
    "## Lane Routes",
    "",
    "| lane | route | active clean | bundle rows | sold/inactive |",
    "| --- | --- | ---: | ---: | ---: |",
    ...lanes.map((lane) => `| ${lane.lane} | ${lane.route} | ${lane.activeClean} | ${lane.bundleRows} | ${lane.soldInactive} |`),
    "",
    "## Output Schema",
    "",
    "```json",
    JSON.stringify(outputSchema, null, 2),
    "```",
    "",
    "## Hard Rules",
    "",
    ...hardRules.map((rule) => `- ${rule}`),
    "",
    "## Cache Key",
    "",
    `- key: \`${cacheKey.key}\``,
    ...cacheKey.invalidation.map((item) => `- invalidation: ${item}`),
    "",
    "## Prompt Contract",
    "",
    ...promptContract.map((item) => `- ${item}`),
    "",
    "## Decision",
    "",
    `- ${report.decision}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "ai-l2-bundle-payload-contract-latest.md"), md);
  console.log(JSON.stringify({ lanes: lanes.length, routes: lanes.reduce<Record<string, number>>((acc, lane) => {
    acc[lane.route] = (acc[lane.route] ?? 0) + 1;
    return acc;
  }, {}) }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
