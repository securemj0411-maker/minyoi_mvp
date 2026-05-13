// Wave 43 — ai_escrow_unavailable retry transition 시뮬.
// 목적: end-to-end starvation 우회 (synthetic single-row applyAiReview)로
// OPENAI_API_KEY 부재 시 escrow row가 unavailable 경로로 정확히 흐르는지 확인.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {}
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  // OPENAI_API_KEY 일시 unset → classifyWithCache가 source: "unavailable" 리턴.
  delete process.env.OPENAI_API_KEY;

  const { applyAiReview } = await import("@/lib/pipeline");

  const escrowRow: Parameters<typeof applyAiReview>[0][number] = {
    pid: "9999900001",
    url: "https://example/9999900001",
    name: "[TEST] iPhone 15 Pro Max",
    price: 1_300_000,
    score: 50,
    priceGap: 0.4,
    scoreFlags: ["ai_escrow_pending", "option_needs_review"],
    descriptionPreview: "synthetic escrow row for unavailable retry simulation",
    saleStatus: "0",
    numFaved: 0,
    velocity: 0.5,
    reviewRating: 4,
    reviewCount: 10,
    safety: 0.7,
    riskHits: 0,
    skuId: "iphone-15-pro-max",
    skuName: "iPhone 15 Pro Max",
    skuMedian: 1_500_000,
    estimatedBuyCost: 1_310_000,
    grossResellGap: 200_000,
    netGapAfterShipping: 190_000,
    shippingFee: 0,
    shippingFeeGeneral: 0,
    freeShipping: true,
    comparableKey: "iphone|iphone_15_pro_max|unknown_storage",
    parseConfidence: 0.6,
    parserNeedsReview: true,
    parserUnknownParts: ["storage"],
    parserCriticalUnknown: ["storage"],
    aiEscrowKind: "narrow_smartphone_escrow",
  } as unknown as Parameters<typeof applyAiReview>[0][number];

  const result = await applyAiReview([escrowRow], {
    enabled: true,
    topN: 10,
    concurrency: 1,
  });

  const out = {
    OPENAI_API_KEY_present: Boolean(process.env.OPENAI_API_KEY),
    stats: result.stats,
    escrowUnavailablePids: result.escrowUnavailablePids,
    output_row_score_flags: result.rows[0]?.scoreFlags ?? null,
    has_pending_after: result.rows[0]?.scoreFlags?.includes("ai_escrow_pending") ?? null,
    has_unavailable_after: result.rows[0]?.scoreFlags?.includes("ai_escrow_unavailable") ?? null,
  };

  console.log(JSON.stringify(out, null, 2));

  const pass =
    !out.OPENAI_API_KEY_present
    && out.stats.escrowUnavailableRetry === 1
    && out.escrowUnavailablePids.includes("9999900001")
    && out.has_pending_after === false
    && out.has_unavailable_after === true;

  process.exit(pass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
