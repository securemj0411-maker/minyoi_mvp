// Adapter: convert game-console narrow verification JSON → preflight-compatible
// legacy DetailReport format. no DB write, no mutation, scripts/-only.

import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportDir = path.join(process.cwd(), "reports");

type NewVerificationRow = {
  pid: string;
  title: string;
  price: number;
  classification: "base_unit_only" | "review_ai_l2_manual" | "hard_hold" | "wrong_model" | "buying_or_fake_or_damaged";
  reasons: string[];
  inLane: boolean;
  sold: boolean;
  shopUid: string | null;
  shopProshop: boolean;
  descPreview: string;
};

type NewVerification = {
  lane: string;
  laneFamily?: string;
  detail: {
    fetched: number;
    inLane: number;
    outOfLane: number;
    sold: number;
    live: number;
    baseUnitOnly: number;
    reviewAiL2Manual: number;
    hardHold: number;
    buyFakeDamaged: number;
  };
  rows: NewVerificationRow[];
};

const lanes = [
  "switch_oled_base_unit_only",
  "ps5_disc_basic",
  "ps5_digital_basic",
  "ps5_slim_disc_basic",
  "ps5_slim_digital_basic",
];

function syntheticSkuId(lane: string): string {
  return `policy-${lane.replace(/_/g, "-")}`;
}

function syntheticComparableKey(lane: string): string {
  return `game_console|${lane}|base_unit_only`;
}

function adapt(verification: NewVerification) {
  const synSku = syntheticSkuId(verification.lane);
  const synKey = syntheticComparableKey(verification.lane);

  const legacyRows = verification.rows
    .filter((row) => row.inLane)
    .map((row) => {
      const baseUnit = row.classification === "base_unit_only";
      const review = row.classification === "review_ai_l2_manual";
      return {
        pid: row.pid,
        title: row.title,
        price: row.price,
        saleStatus: row.sold ? "SOLD_OUT" : "SELLING",
        sold: row.sold,
        listingType: row.sold ? null : "normal",
        searchSkuId: baseUnit ? synSku : null,
        detailSkuId: baseUnit ? synSku : null,
        searchComparableKey: baseUnit ? synKey : null,
        detailComparableKey: baseUnit ? synKey : null,
        detailNeedsReview: review,
        activeClean: baseUnit && !row.sold,
        reasons: row.reasons,
      };
    });

  const activeClean = legacyRows.filter((r) => r.activeClean).length;
  const holdOrReview = legacyRows.length - activeClean;

  return {
    generatedAt: new Date().toISOString(),
    source: `reports/${verification.lane}-no-write-verification-latest.json`,
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    inputRows: verification.detail.fetched,
    detailFetched: verification.detail.inLane,
    activeClean,
    holdOrReview,
    rows: legacyRows,
  };
}

async function main() {
  await mkdir(reportDir, { recursive: true });
  let written = 0;
  for (const lane of lanes) {
    const inputPath = path.join(reportDir, `${lane}-no-write-verification-latest.json`);
    if (!existsSync(inputPath)) {
      console.warn(`SKIP ${lane}: ${inputPath} missing`);
      continue;
    }
    const verification = JSON.parse(readFileSync(inputPath, "utf8")) as NewVerification;
    const legacy = adapt(verification);
    const jsonOut = path.join(reportDir, `${lane}-no-write-detail-verification-adapter-latest.json`);
    const mdOut = path.join(reportDir, `${lane}-no-write-detail-verification-adapter-latest.md`);
    await writeFile(jsonOut, `${JSON.stringify(legacy, null, 2)}\n`);
    const mdContent = `# ${lane} — legacy detail verification adapter\n\n- generatedAt: ${legacy.generatedAt}\n- source: ${legacy.source}\n- adapter script: scripts/write-game-console-legacy-detail-adapter.ts\n- mode: read_only_no_mutation_format_adapter\n\n## Counts\n\n| metric | value |\n| --- | ---: |\n| inputRows | ${legacy.inputRows} |\n| detailFetched (in-lane only) | ${legacy.detailFetched} |\n| activeClean (base_unit_only && !sold) | ${legacy.activeClean} |\n| holdOrReview | ${legacy.holdOrReview} |\n\n## Purpose\n\nThis file translates the policy-based game console narrow verification (\`classification: base_unit_only | review_ai_l2_manual | hard_hold | wrong_model | buying_or_fake_or_damaged\`) into the preflight-compatible legacy DetailReport schema so that \`scripts/report-internal-acquisition-executor-preflight.ts\` can validate the lane without modification.\n\nSynthetic detailSkuId / detailComparableKey: \`policy-${lane.replace(/_/g, "-")}\` / \`game_console|${lane}|base_unit_only\`.\n`;
    await writeFile(mdOut, mdContent);
    written++;
    console.log(`wrote ${lane}-no-write-detail-verification-adapter-latest.{json,md} (activeClean=${legacy.activeClean}/${legacy.detailFetched})`);
  }
  console.log(`adapter outputs: ${written}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
