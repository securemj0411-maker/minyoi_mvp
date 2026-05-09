import { readFile } from "node:fs/promises";
import path from "node:path";

import { compareCandidates, isVisibleResellCandidate } from "@/lib/profit";
import type { ListingCandidate } from "@/lib/types";

type SummaryListing = {
  pid: string;
  url: string;
  name: string;
  price: number;
  sku_name: string;
  sku_median: number;
  price_gap: number;
  num_faved: number;
  velocity: number;
  review_rating: number | "";
  review_count: number;
  safety: number;
  risk_hits: number;
  score: number;
  score_flags?: string[];
  description_preview?: string;
  description?: string;
  image_url_template?: string | null;
  image_count?: number | null;
  thumbnail_url?: string | null;
};

type Summary = {
  generated_at: string;
  top10: SummaryListing[];
};

type ShippingRow = {
  pid: string;
  buyer_shipping_fee: number;
  buyer_shipping_fee_general?: number | null;
  shipping_source: string;
  estimated_buy_cost: number;
  gross_resell_gap: number;
  net_gap_after_buy_shipping: number;
};

type ShippingSummary = {
  rows: ShippingRow[];
};

type SupabaseCandidateRow = {
  pid: number | string;
  url: string;
  name: string;
  price: number;
  sku_name: string;
  sku_median: number;
  price_gap: number;
  num_faved: number;
  velocity: number;
  review_rating: number | null;
  review_count: number;
  safety: number;
  risk_hits: number;
  score: number;
  score_flags: string[] | null;
  description_preview: string | null;
  image_url_template: string | null;
  image_count: number | null;
  thumbnail_url: string | null;
  shipping_fee: number;
  shipping_fee_general: number | null;
  shipping_source: string;
  estimated_buy_cost: number;
  gross_resell_gap: number;
  net_gap_after_shipping: number;
  generated_at: string | null;
};

function toCandidate(item: SummaryListing, shipping?: ShippingRow): ListingCandidate {
  return {
    pid: item.pid,
    url: item.url,
    name: item.name,
    price: item.price,
    skuName: item.sku_name,
    skuMedian: item.sku_median,
    priceGap: item.price_gap,
    numFaved: item.num_faved,
    velocity: item.velocity,
    reviewRating: item.review_rating,
    reviewCount: item.review_count,
    safety: item.safety,
    riskHits: item.risk_hits,
    score: item.score,
    scoreFlags: item.score_flags ?? [],
    descriptionPreview: item.description_preview || item.description || "",
    imageUrlTemplate: item.image_url_template ?? null,
    imageCount: item.image_count ?? 0,
    thumbnailUrl: item.thumbnail_url ?? null,
    shippingFee: shipping?.buyer_shipping_fee ?? 0,
    shippingFeeGeneral: shipping?.buyer_shipping_fee_general ?? null,
    shippingSource: shipping?.shipping_source ?? "not_loaded",
    estimatedBuyCost: shipping?.estimated_buy_cost ?? item.price,
    grossResellGap: shipping?.gross_resell_gap ?? Math.max(0, item.sku_median - item.price),
    netGapAfterShipping: shipping?.net_gap_after_buy_shipping ?? Math.max(0, item.sku_median - item.price),
  };
}

function toCandidateFromSupabase(row: SupabaseCandidateRow): ListingCandidate {
  return {
    pid: String(row.pid),
    url: row.url,
    name: row.name,
    price: row.price,
    skuName: row.sku_name,
    skuMedian: row.sku_median,
    priceGap: Number(row.price_gap),
    numFaved: row.num_faved,
    velocity: Number(row.velocity),
    reviewRating: row.review_rating ?? "",
    reviewCount: row.review_count,
    safety: Number(row.safety),
    riskHits: row.risk_hits,
    score: Number(row.score),
    scoreFlags: row.score_flags ?? [],
    descriptionPreview: row.description_preview ?? "",
    imageUrlTemplate: row.image_url_template,
    imageCount: row.image_count ?? 0,
    thumbnailUrl: row.thumbnail_url,
    shippingFee: row.shipping_fee,
    shippingFeeGeneral: row.shipping_fee_general,
    shippingSource: row.shipping_source,
    estimatedBuyCost: row.estimated_buy_cost,
    grossResellGap: row.gross_resell_gap,
    netGapAfterShipping: row.net_gap_after_shipping,
  };
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return null;
  const base = raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}/rest/v1`;
}

async function loadCandidatesFromSupabase() {
  const restUrl = supabaseRestUrl();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!restUrl || !serviceKey) return null;

  const response = await fetch(
    `${restUrl}/mvp_listing_candidates?select=*&order=candidate_rank.asc.nullslast&limit=150`,
    {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase 후보 로딩 실패: ${response.status} ${await response.text()}`);
  }

  const rows = (await response.json()) as SupabaseCandidateRow[];
  if (rows.length === 0) {
    return {
      generatedAt: "supabase_empty",
      candidates: [],
    };
  }

  return {
    generatedAt: rows[0]?.generated_at ?? "supabase",
    candidates: rows
      .map(toCandidateFromSupabase)
      .filter(isVisibleResellCandidate)
      .sort(compareCandidates)
      .slice(0, 50),
  };
}

async function loadCandidatesFromLocalJson() {
  const summaryPath = path.join(process.cwd(), "..", "poc", "09_summary.json");
  const shippingPath = path.join(process.cwd(), "..", "poc", "10_shipping_summary.json");
  const raw = await readFile(summaryPath, "utf-8");
  const summary = JSON.parse(raw) as Summary;
  let shippingByPid = new Map<string, ShippingRow>();

  try {
    const shippingRaw = await readFile(shippingPath, "utf-8");
    const shipping = JSON.parse(shippingRaw) as ShippingSummary;
    shippingByPid = new Map(shipping.rows.map((row) => [String(row.pid), row]));
  } catch {
    shippingByPid = new Map();
  }

  return {
    generatedAt: summary.generated_at,
    candidates: summary.top10
      .map((item) => toCandidate(item, shippingByPid.get(String(item.pid))))
      .filter(isVisibleResellCandidate)
      .sort(compareCandidates),
  };
}

export async function loadCandidates() {
  if (process.env.USE_LOCAL_POC_DATA !== "true") {
    const supabaseData = await loadCandidatesFromSupabase();
    if (supabaseData) return supabaseData;
  }

  return loadCandidatesFromLocalJson();
}
