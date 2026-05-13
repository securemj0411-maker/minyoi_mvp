import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchDetail } from "@/lib/bunjang";
import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { detectSoldOut, isSoldOut, describeSignals } from "@/lib/sold-out";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

async function loadEnvFile(p: string) {
  try {
    const raw = await readFile(p, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const [k, ...r] = t.split("=");
      const v = r.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {}
}

function isActiveSaleStatus(s: string | null | undefined) {
  // Mirror executor exactly (apply-internal-acquisition-executor.ts:103).
  return ["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"].includes(String(s ?? "").trim().toUpperCase());
}

async function probePid(pid: string, evidenceSkuId: string, evidenceKey: string, title: string, price: number) {
  const fresh = await fetchDetail(pid);
  const errors: string[] = [];
  if (!fresh) errors.push("fresh_detail_fetch_failed");
  const description = fresh?.description ?? "";
  const soldSignals = fresh ? detectSoldOut(fresh, price, { title }) : [];
  if (isSoldOut(soldSignals)) errors.push(`fresh_sold_${describeSignals(soldSignals)}`);
  const classified = classifyListing(title, description, price);
  if (classified.listingType !== "normal") errors.push(`fresh_listing_type_${classified.listingType}`);
  const matched = ruleMatch(title, description);
  const sku = matched ?? skuById(evidenceSkuId);
  if (sku?.id !== evidenceSkuId) errors.push(`fresh_sku_mismatch:${sku?.id ?? "missing"}`);
  const parsed = parseListingOptions({ title, description, skuId: sku?.id ?? null, skuName: sku?.modelName ?? null, category: sku?.category ?? null });
  if (parsed.needsReview) errors.push("fresh_parsed_needs_review");
  if (parsed.comparableKey !== evidenceKey) errors.push(`fresh_comparable_key_mismatch:${parsed.comparableKey ?? "missing"}`);
  if (!isActiveSaleStatus(fresh?.saleStatus)) errors.push(`fresh_inactive_sale_status:${fresh?.saleStatus ?? "missing"}`);
  return { pid, errors, saleStatus: fresh?.saleStatus ?? null, freshKey: parsed.comparableKey };
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  const dry = JSON.parse(await readFile(path.join(appDir, "reports/internal-acquisition-executor-dry-run-latest.json"), "utf-8"));
  const results = [];
  for (const r of dry.rows) {
    const res = await probePid(String(r.pid), r.skuId, r.comparableKey, r.title, r.price);
    if (res.errors.length > 0) {
      const { pid: _ignored, ...probe } = res;
      void _ignored;
      results.push({ pid: r.pid, lane: r.lane, title: r.title, ...probe });
      console.log(JSON.stringify({ pid: r.pid, lane: r.lane, errors: res.errors }));
    }
  }
  await writeFile(path.join(appDir, "reports/wave52-fresh-validation-probe-latest.json"), JSON.stringify({ failed: results }, null, 2));
  console.log(`failed_count=${results.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
