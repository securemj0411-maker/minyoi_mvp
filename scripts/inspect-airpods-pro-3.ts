import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions } from "@/lib/option-parser";
import { readFileSync } from "node:fs";

const samples = JSON.parse(readFileSync("category-intelligence/airpods_pro_3/samples.json", "utf-8"));
const ready = samples.filter((s: any) => s.parse_ready === true).slice(0, 12);
for (const s of ready) {
  const sku = ruleMatch(s.name, s.description ?? "");
  const parsed = parseListingOptions({
    title: s.name,
    description: s.description ?? "",
    skuId: sku?.id ?? null,
    skuName: sku?.modelName ?? null,
    category: sku?.category ?? null,
  });
  console.log({
    name: s.name.slice(0, 60),
    sku: sku?.id ?? null,
    key: parsed.comparableKey,
    unknown: parsed.unknownParts,
    needs: parsed.needsReview,
  });
}
