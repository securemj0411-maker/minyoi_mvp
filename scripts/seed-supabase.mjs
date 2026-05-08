import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const rootDir = path.join(appDir, "..");

function loadEnvFile(filePath) {
  return readFile(filePath, "utf-8")
    .then((raw) => {
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const [key, ...rest] = trimmed.split("=");
        const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = value;
      }
    })
    .catch(() => {});
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_URL이 필요합니다.");
  const base = raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}/rest/v1`;
}

function headers() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || key.includes("replace_with")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY가 필요합니다. 노출된 키는 rotate 후 새 키를 .env.local에 넣어주세요.");
  }
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates",
  };
}

async function readJson(relativePath) {
  const raw = await readFile(path.join(rootDir, relativePath), "utf-8");
  return JSON.parse(raw);
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : fallback;
}

async function upsert(table, rows) {
  if (rows.length === 0) return;
  const response = await fetch(`${supabaseRestUrl()}/${table}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${table} upsert 실패: ${response.status} ${body}`);
  }
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));

  const summary = await readJson("poc/09_summary.json");
  const shipping = await readJson("poc/10_shipping_summary.json").catch(() => ({ rows: [] }));
  const shippingByPid = new Map((shipping.rows || []).map((row) => [String(row.pid), row]));

  const top10 = summary.top10 || [];
  const listings = top10.map((item) => {
    const shippingRow = shippingByPid.get(String(item.pid));
    return {
      pid: toInt(item.pid),
      url: item.url,
      name: item.name,
      price: toInt(item.price),
      sku_name: item.sku_name,
      sku_median: toInt(item.sku_median),
      description_preview: item.description_preview || item.description || "",
      shipping_fee: toInt(shippingRow?.buyer_shipping_fee),
      shipping_fee_general:
        shippingRow?.buyer_shipping_fee_general === null || shippingRow?.buyer_shipping_fee_general === undefined
          ? null
          : toInt(shippingRow.buyer_shipping_fee_general),
      shipping_source: shippingRow?.shipping_source || "not_loaded",
      estimated_buy_cost: toInt(shippingRow?.estimated_buy_cost, toInt(item.price)),
      gross_resell_gap: toInt(shippingRow?.gross_resell_gap, Math.max(0, toInt(item.sku_median) - toInt(item.price))),
      net_gap_after_shipping: toInt(
        shippingRow?.net_gap_after_buy_shipping,
        Math.max(0, toInt(item.sku_median) - toInt(item.price)),
      ),
      source_json: { summary: item, shipping: shippingRow || null },
      generated_at: summary.generated_at,
    };
  });

  const analyses = top10.map((item, index) => ({
    pid: toInt(item.pid),
    price_gap: Number(item.price_gap || 0),
    num_faved: toInt(item.num_faved),
    velocity: Number(item.velocity || 0),
    review_rating: item.review_rating === "" || item.review_rating === undefined ? null : Number(item.review_rating),
    review_count: toInt(item.review_count),
    safety: Number(item.safety || 0),
    risk_hits: toInt(item.risk_hits),
    score: Number(item.score || 0),
    score_flags: item.score_flags || [],
    candidate_rank: index + 1,
    source_json: item,
  }));

  await upsert("mvp_listings?on_conflict=pid", listings);
  await upsert("mvp_listing_analysis?on_conflict=pid", analyses);

  console.log(`Seed complete: ${listings.length} listings, ${analyses.length} analyses`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
