import type { PipelineRow } from "@/lib/pipeline";

function intValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.round(parsed);
}

function nonNegativeInt(value: unknown, fallback = 0) {
  return Math.max(0, intValue(value, fallback));
}

function nullableNonNegativeInt(value: unknown) {
  if (value == null) return null;
  return nonNegativeInt(value);
}

export function toListingOutputRows(rows: PipelineRow[], now: string) {
  return rows.map((row) => ({
    pid: intValue(row.pid),
    url: row.url,
    name: row.name,
    price: nonNegativeInt(row.price),
    sku_name: row.skuName,
    sku_median: nonNegativeInt(row.skuMedian),
    description_preview: row.descriptionPreview,
    image_url_template: row.imageUrlTemplate,
    image_count: nonNegativeInt(row.imageCount ?? 0),
    thumbnail_url: row.thumbnailUrl,
    shipping_fee: nonNegativeInt(row.shippingFee),
    shipping_fee_general: nullableNonNegativeInt(row.shippingFeeGeneral),
    shipping_source: row.shippingSource,
    estimated_buy_cost: nonNegativeInt(row.estimatedBuyCost),
    gross_resell_gap: intValue(row.grossResellGap),
    net_gap_after_shipping: intValue(row.netGapAfterShipping),
    source_json: { pipeline: "tick" },
    generated_at: now,
    updated_at: now,
  }));
}

export type ListingOutputRow = ReturnType<typeof toListingOutputRows>[number];

export function toRankedAnalysisRows(rows: PipelineRow[], now: string) {
  const analyses = rows.map((row) => ({
    pid: intValue(row.pid),
    price_gap: row.priceGap,
    num_faved: nonNegativeInt(row.numFaved),
    velocity: row.velocity,
    review_rating: row.reviewRating,
    review_count: nonNegativeInt(row.reviewCount),
    safety: row.safety,
    risk_hits: nonNegativeInt(row.riskHits),
    score: row.score,
    score_flags: row.scoreFlags,
    source_json: { pipeline: "tick" },
    analyzed_at: now,
    updated_at: now,
  }));

  const ranked = analyses
    .map((analysis, index) => ({ ...analysis, originalIndex: index }))
    .sort((a, b) => Number(b.score) - Number(a.score));
  const rankByPid = new Map(ranked.map((analysis, index) => [analysis.pid, index + 1]));
  return analyses.map((analysis) => ({
    ...analysis,
    candidate_rank: rankByPid.get(analysis.pid) ?? null,
  }));
}

export type AnalysisOutputRow = ReturnType<typeof toRankedAnalysisRows>[number];

function sameText(left: unknown, right: unknown) {
  return (left ?? null) === (right ?? null);
}

function sameNumber(left: unknown, right: unknown) {
  if (left == null || right == null) return left == null && right == null;
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return left === right;
  return Math.abs(a - b) < 1e-9;
}

function sameTextArray(left: unknown, right: unknown) {
  const a = Array.isArray(left) ? left.map(String) : [];
  const b = Array.isArray(right) ? right.map(String) : [];
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function listingOutputDiffReasons(row: ListingOutputRow, existing: Record<string, unknown> | undefined) {
  if (!existing) return ["missing"];
  const reasons: string[] = [];
  if (!sameText(row.url, existing.url)) reasons.push("url");
  if (!sameText(row.name, existing.name)) reasons.push("name");
  if (!sameNumber(row.price, existing.price)) reasons.push("price");
  if (!sameText(row.sku_name, existing.sku_name)) reasons.push("sku_name");
  if (!sameNumber(row.sku_median, existing.sku_median)) reasons.push("sku_median");
  if (!sameText(row.description_preview, existing.description_preview)) reasons.push("description_preview");
  if (!sameText(row.image_url_template, existing.image_url_template)) reasons.push("image_url_template");
  if (!sameNumber(row.image_count, existing.image_count)) reasons.push("image_count");
  if (!sameText(row.thumbnail_url, existing.thumbnail_url)) reasons.push("thumbnail_url");
  if (!sameNumber(row.shipping_fee, existing.shipping_fee)) reasons.push("shipping_fee");
  if (!sameNumber(row.shipping_fee_general, existing.shipping_fee_general)) reasons.push("shipping_fee_general");
  if (!sameText(row.shipping_source, existing.shipping_source)) reasons.push("shipping_source");
  if (!sameNumber(row.estimated_buy_cost, existing.estimated_buy_cost)) reasons.push("estimated_buy_cost");
  if (!sameNumber(row.gross_resell_gap, existing.gross_resell_gap)) reasons.push("gross_resell_gap");
  if (!sameNumber(row.net_gap_after_shipping, existing.net_gap_after_shipping)) reasons.push("net_gap_after_shipping");
  return reasons;
}

export function listingOutputChanged(row: ListingOutputRow, existing: Record<string, unknown> | undefined) {
  return listingOutputDiffReasons(row, existing).length > 0;
}

export function analysisOutputDiffReasons(row: AnalysisOutputRow, existing: Record<string, unknown> | undefined) {
  if (!existing) return ["missing"];
  const reasons: string[] = [];
  if (!sameNumber(row.price_gap, existing.price_gap)) reasons.push("price_gap");
  if (!sameNumber(row.num_faved, existing.num_faved)) reasons.push("num_faved");
  if (!sameNumber(row.velocity, existing.velocity)) reasons.push("velocity");
  if (!sameNumber(row.review_rating, existing.review_rating)) reasons.push("review_rating");
  if (!sameNumber(row.review_count, existing.review_count)) reasons.push("review_count");
  if (!sameNumber(row.safety, existing.safety)) reasons.push("safety");
  if (!sameNumber(row.risk_hits, existing.risk_hits)) reasons.push("risk_hits");
  if (!sameNumber(row.score, existing.score)) reasons.push("score");
  if (!sameTextArray(row.score_flags, existing.score_flags)) reasons.push("score_flags");
  if (!sameNumber(row.candidate_rank, existing.candidate_rank)) reasons.push("candidate_rank");
  return reasons;
}

export function analysisOutputChanged(row: AnalysisOutputRow, existing: Record<string, unknown> | undefined) {
  return analysisOutputDiffReasons(row, existing).some((reason) => reason !== "candidate_rank");
}
