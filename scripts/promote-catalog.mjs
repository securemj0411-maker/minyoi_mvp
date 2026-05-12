/**
 * Promote approved category-intelligence outputs into generated runtime files.
 *
 * This script is deliberately conservative:
 * - dry-run is the default
 * - only approval_status allowlisted entries are promotable
 * - promotion cache prevents duplicate API/AI mining outputs from being applied repeatedly
 * - generated files are rebuilt from cache, not patched ad hoc
 *
 * Usage:
 *   node scripts/promote-catalog.mjs --category=smartphone --dry-run
 *   node scripts/promote-catalog.mjs --category=smartphone --prepare-approval
 *   node scripts/promote-catalog.mjs --category=smartphone --apply
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promotionNoiseRiskFlags, promotionRiskFlags } from "./lib/promotion-risk.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const intelligenceDir = path.join(appDir, "category-intelligence");
const generatedDir = path.join(appDir, "src", "lib", "generated");
const cachePath = path.join(intelligenceDir, "promotion-cache.json");
const generatedCatalogPath = path.join(generatedDir, "catalog.ts");
const generatedNoisePath = path.join(generatedDir, "noise-rules.ts");

const CATEGORY_MAP = {
  smartphone: "smartphone",
  tablet: "tablet",
  laptop: "laptop",
  small_appliance: "small_appliance",
  airpods: "earphone",
  applewatch: "smartwatch",
  galaxywatch: "smartwatch",
  earphone_discovered: "earphone",
  headphone_discovered: "earphone",
  smartwatch_discovered: "smartwatch",
};

const PROMOTION_BLOCKED_CATEGORIES = {
  monitor_discovered: "monitor parser skeleton exists, but runtime catalog/pool gate is not promoted yet",
  game_console_discovered: "game-console runtime category/comparable-key parser is not implemented yet",
  camera_discovered: "camera runtime category/comparable-key parser is not implemented yet",
  speaker_audio_discovered: "speaker/audio runtime category/comparable-key parser is not implemented yet",
  desktop_pc_discovered: "desktop PC runtime category/comparable-key parser is not implemented yet",
  home_appliance_tech_discovered: "home-appliance runtime risk model and logistics gate are not implemented yet",
};

const NOISE_BUCKETS = {
  buying: "buying",
  callout: "callout",
  parts: "parts",
  damaged: "damaged",
  accessory: "accessory",
  multi: "multi",
  commercial: "commercialStrong",
  counterfeit: "callout",
};

function argValue(name, fallback = null) {
  for (const arg of process.argv) {
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  return process.argv[idx + 1];
}

function hasFlag(name) {
  return process.argv.some((arg) => arg === name || arg.startsWith(`${name}=`));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex").slice(0, 16);
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch (err) {
    if (arguments.length >= 2) return fallback;
    throw err;
  }
}

function uniqueStrings(values) {
  return [...new Set(values.map((v) => String(v ?? "").trim()).filter(Boolean))];
}

function inferBrand(modelName, aliases) {
  const primary = String(modelName ?? "").toLowerCase();
  const text = `${primary} ${aliases.join(" ")}`.toLowerCase();
  if (/galaxy|갤럭시|samsung|삼성|갤탭/.test(primary)) return "Samsung";
  if (/iphone|아이폰|apple|애플|ipad|아이패드|macbook|맥북|airpods?|에어팟/.test(primary)) return "Apple";
  if (/dyson|다이슨/.test(primary)) return "Dyson";
  if (/sony|소니/.test(primary)) return "Sony";
  if (/bose|보스/.test(primary)) return "Bose";
  if (/nintendo|닌텐도/.test(primary)) return "Nintendo";
  if (/galaxy|갤럭시|samsung|삼성|갤탭/.test(text)) return "Samsung";
  if (/iphone|아이폰|apple|애플|ipad|아이패드|macbook|맥북|airpods?|에어팟/.test(text)) return "Apple";
  if (/dyson|다이슨/.test(text)) return "Dyson";
  if (/sony|소니/.test(text)) return "Sony";
  if (/bose|보스/.test(text)) return "Bose";
  if (/nintendo|닌텐도/.test(text)) return "Nintendo";
  return "";
}

function inferReleaseYear(modelName) {
  const text = String(modelName ?? "").toLowerCase();
  const iphone = text.match(/(?:iphone|아이폰)\s*(1[1-9])/);
  if (iphone) {
    const yearByModel = {
      "11": 2019,
      "12": 2020,
      "13": 2021,
      "14": 2022,
      "15": 2023,
      "16": 2024,
      "17": 2025,
    };
    return yearByModel[iphone[1]] ?? new Date().getFullYear();
  }
  const galaxyS = text.match(/(?:galaxy|갤럭시)\s*s\s*(2[0-9])/);
  if (galaxyS) return 2000 + Number(galaxyS[1]);
  const zFoldFlip = text.match(/(?:플립|fold|flip|폴드)\s*([3-9])/);
  if (zFoldFlip) return 2020 + Number(zFoldFlip[1]);
  return new Date().getFullYear();
}

function runtimeCategoryFor(category) {
  return CATEGORY_MAP[category] ?? null;
}

function assertPromotableCategory(category) {
  if (runtimeCategoryFor(category)) return;
  const reason = PROMOTION_BLOCKED_CATEGORIES[category] ?? "no explicit runtime category mapping exists";
  throw new Error(
    `Category "${category}" cannot be promoted yet: ${reason}. ` +
    "Keep it in internal mining/readiness docs until catalog type, parser, gates, and approval policy are added.",
  );
}

function toCatalogSku(raw, category) {
  const runtimeCategory = runtimeCategoryFor(category);
  if (!runtimeCategory) {
    throw new Error(`unpromotable category: ${category}`);
  }
  const aliases = uniqueStrings([raw.model_name, ...(raw.aliases ?? [])]).slice(0, 16);
  const median = Number(raw.sku_median ?? 0);
  const priceRange = Array.isArray(raw.price_range) ? raw.price_range.map(Number).filter(Number.isFinite) : [];
  const rangeMedian = priceRange.length >= 2 ? Math.round((priceRange[0] + priceRange[1]) / 2) : 0;
  const marketMedian = median || rangeMedian || 300000;

  return {
    id: raw.id,
    brand: raw.brand || inferBrand(raw.model_name, aliases),
    category: runtimeCategory,
    modelName: raw.model_name,
    aliases,
    mustContain: [aliases],
    mustNotContain: [],
    // Current runtime uses msrpKrw * 0.5 as sparse-data market fallback.
    // Store 2x mined median so fallback approximates the mined market median.
    msrpKrw: Math.max(1000, Math.round(marketMedian * 2)),
    released: inferReleaseYear(raw.model_name),
    sourceCategory: category,
    sourceClusterIds: raw.source_cluster_ids ?? [],
    promotionHash: hash(raw),
  };
}

function selectPromotionCandidates(category, skuCatalog, noiseRules) {
  const skus = (skuCatalog.skus ?? [])
    .filter((sku) => sku.approval_status === "needs_human_approval")
    .filter((sku) => !(sku.risk_flags ?? []).length)
    .map((sku) => {
      const candidate = toCatalogSku(sku, category);
      return {
        ...candidate,
        riskFlags: promotionRiskFlags(candidate),
      };
    });

  const noise = (noiseRules.rules ?? [])
    .filter((rule) => rule.approval_status === "auto_approved_for_review")
    .filter((rule) => !(rule.risk_flags ?? []).length)
    .map((rule) => ({
      keyword: String(rule.keyword ?? "").trim(),
      type: String(rule.type ?? ""),
      precision: Number(rule.precision ?? 0),
      hitCount: Number(rule.hit_count ?? 0),
      promotionHash: hash(rule),
    }))
    .filter((rule) => rule.keyword && NOISE_BUCKETS[rule.type])
    .map((rule) => ({
      ...rule,
      riskFlags: promotionNoiseRiskFlags(rule, category),
    }));

  return { skus, noise };
}

function approvalPathFor(category) {
  return path.join(intelligenceDir, category, "approval_queue.json");
}

function makeApprovalQueue(category, candidates, previous = null) {
  const previousItems = new Map((previous?.items ?? []).map((item) => [item.key, item]));
  const items = [];

  for (const sku of candidates.skus) {
    const key = `sku:${sku.id}`;
    const prev = previousItems.get(key);
    items.push({
      key,
      kind: "sku",
      approved: Boolean(prev?.approved ?? false),
      rejected: Boolean(prev?.rejected ?? false),
      id: sku.id,
      modelName: sku.modelName,
      brand: sku.brand,
      category: sku.category,
      aliases: sku.aliases,
      medianFallbackKrw: Math.round(sku.msrpKrw * 0.5),
      sourceClusterIds: sku.sourceClusterIds,
      riskFlags: sku.riskFlags ?? [],
      note: prev?.note ?? "",
      candidate: sku,
    });
  }

  for (const rule of candidates.noise) {
    const key = `noise:${rule.type}:${rule.keyword}`;
    const prev = previousItems.get(key);
    items.push({
      key,
      kind: "noise",
      approved: Boolean(prev?.approved ?? false),
      rejected: Boolean(prev?.rejected ?? false),
      type: rule.type,
      keyword: rule.keyword,
      precision: rule.precision,
      hitCount: rule.hitCount,
      riskFlags: rule.riskFlags ?? [],
      note: prev?.note ?? "",
      candidate: rule,
    });
  }

  return {
    version: 1,
    category,
    updated_at: new Date().toISOString(),
    instructions: [
      "Set approved=true only for entries you want to promote into runtime.",
      "Items with non-empty riskFlags are shown for review but are skipped by --apply until the underlying risk is fixed.",
      "Set rejected=true for entries you explicitly do not want to see again.",
      "Leave both false for pending review.",
      "promote-catalog --apply reads only approved=true and rejected!=true entries.",
    ],
    items,
  };
}

async function loadApprovalQueue(category, candidates, { createIfMissing = false } = {}) {
  const filePath = approvalPathFor(category);
  const existing = await readJson(filePath, null);
  if (existing) return existing;
  if (!createIfMissing) return null;
  const queue = makeApprovalQueue(category, candidates);
  await writeFile(filePath, JSON.stringify(queue, null, 2));
  return queue;
}

function filterCandidatesByApproval(candidates, approvalQueue) {
  if (!approvalQueue) return { skus: [], noise: [] };
  const approvedItems = (approvalQueue.items ?? []).filter((item) => item.approved === true && item.rejected !== true);
  const curatedByKey = new Map(
    approvedItems
      .filter((item) => item.candidate && typeof item.candidate === "object")
      .map((item) => [item.key, item.candidate])
  );
  const sourceSkus = new Map(candidates.skus.map((sku) => [`sku:${sku.id}`, sku]));
  const sourceNoise = new Map(candidates.noise.map((rule) => [`noise:${rule.type}:${rule.keyword}`, rule]));
  const skus = [];
  const noise = [];

  for (const item of approvedItems) {
    if (item.kind === "sku") {
      const curated = curatedByKey.get(item.key);
      const fallback = sourceSkus.get(item.key);
      const sku = curated
        ? { ...curated, riskFlags: curated.riskFlags ?? fallback?.riskFlags ?? [] }
        : fallback;
      if (sku && !(sku.riskFlags ?? []).length) skus.push(sku);
    }
    if (item.kind === "noise") {
      const curated = curatedByKey.get(item.key);
      const fallback = sourceNoise.get(item.key);
      const rule = curated
        ? { ...curated, riskFlags: curated.riskFlags ?? fallback?.riskFlags ?? [] }
        : fallback;
      if (rule && !(rule.riskFlags ?? []).length) noise.push(rule);
    }
  }

  return {
    skus,
    noise,
  };
}

function emptyCache() {
  return { version: 1, updated_at: null, promotions: [] };
}

function flattenCache(cache) {
  const skuMap = new Map();
  const noiseMap = new Map();
  for (const promotion of cache.promotions ?? []) {
    for (const sku of promotion.skus ?? []) skuMap.set(sku.id, sku);
    for (const rule of promotion.noise ?? []) noiseMap.set(`${rule.type}:${rule.keyword}`, rule);
  }
  return {
    skus: [...skuMap.values()].sort((a, b) => a.id.localeCompare(b.id, "ko")),
    noise: [...noiseMap.values()].sort((a, b) => `${a.type}:${a.keyword}`.localeCompare(`${b.type}:${b.keyword}`, "ko")),
  };
}

function renderGeneratedCatalog(skus) {
  return `import type { Sku } from "@/lib/catalog";

// Generated by scripts/promote-catalog.mjs.
// Do not edit by hand; approve mining outputs, then rerun the promoter.
export const GENERATED_CATALOG: Sku[] = ${JSON.stringify(skus.map((sku) => ({
    id: sku.id,
    brand: sku.brand,
    category: sku.category,
    modelName: sku.modelName,
    aliases: sku.aliases,
    mustContain: sku.mustContain,
    mustNotContain: sku.mustNotContain,
    msrpKrw: sku.msrpKrw,
    released: sku.released,
  })), null, 2)};
`;
}

function renderGeneratedNoiseRules(noise) {
  const buckets = {
    buying: [],
    callout: [],
    parts: [],
    damaged: [],
    accessory: [],
    multi: [],
    commercialStrong: [],
    commercialWeak: [],
  };
  for (const rule of noise) {
    const bucket = NOISE_BUCKETS[rule.type];
    if (!bucket) continue;
    buckets[bucket].push(rule.keyword);
  }
  for (const key of Object.keys(buckets)) buckets[key] = uniqueStrings(buckets[key]).sort((a, b) => a.localeCompare(b, "ko"));
  return `// Generated by scripts/promote-catalog.mjs.
// Do not edit by hand; approve mining outputs, then rerun the promoter.
export const GENERATED_NOISE_RULES = ${JSON.stringify(buckets, null, 2)} as const satisfies Record<string, readonly string[]>;
`;
}

function summarize({ category, candidates, cache }) {
  const existing = flattenCache(cache);
  const existingSkuIds = new Set(existing.skus.map((sku) => sku.id));
  const existingNoise = new Set(existing.noise.map((rule) => `${rule.type}:${rule.keyword}`));
  const newSkus = candidates.skus.filter((sku) => !existingSkuIds.has(sku.id));
  const skippedSkus = candidates.skus.filter((sku) => existingSkuIds.has(sku.id));
  const newNoise = candidates.noise.filter((rule) => !existingNoise.has(`${rule.type}:${rule.keyword}`));
  const skippedNoise = candidates.noise.filter((rule) => existingNoise.has(`${rule.type}:${rule.keyword}`));

  return {
    category,
    newSkus,
    skippedSkus,
    newNoise,
    skippedNoise,
    totalCachedSkus: existing.skus.length,
    totalCachedNoise: existing.noise.length,
  };
}

function printSummary(summary) {
  console.log(`\n[promote-catalog] category=${summary.category}`);
  console.log(`  new SKU candidates: ${summary.newSkus.length}`);
  for (const sku of summary.newSkus) {
    const risks = (sku.riskFlags ?? []).length ? ` / risks=${sku.riskFlags.join(",")}` : "";
    console.log(`    + ${sku.id} / ${sku.modelName} / medianFallback=${Math.round(sku.msrpKrw * 0.5).toLocaleString("ko-KR")}원${risks}`);
  }
  if (summary.skippedSkus.length) console.log(`  skipped cached SKUs: ${summary.skippedSkus.map((sku) => sku.id).join(", ")}`);

  console.log(`  new noise rules: ${summary.newNoise.length}`);
  for (const rule of summary.newNoise) {
    console.log(`    + ${rule.type}:${rule.keyword} (precision=${rule.precision.toFixed(2)}, hits=${rule.hitCount})`);
  }
  if (summary.skippedNoise.length) console.log(`  skipped cached noise: ${summary.skippedNoise.map((rule) => `${rule.type}:${rule.keyword}`).join(", ")}`);
  console.log(`  cache currently: ${summary.totalCachedSkus} SKUs, ${summary.totalCachedNoise} noise rules`);
}

function printApprovalSummary(queue) {
  const items = queue?.items ?? [];
  const approved = items.filter((item) => item.approved === true && item.rejected !== true);
  const rejected = items.filter((item) => item.rejected === true);
  const pending = items.filter((item) => item.approved !== true && item.rejected !== true);
  console.log(`  approval queue: ${approved.length} approved, ${pending.length} pending, ${rejected.length} rejected`);
}

async function main() {
  const category = argValue("--category");
  const apply = hasFlag("--apply");
  const prepareApproval = hasFlag("--prepare-approval");
  const dryRun = hasFlag("--dry-run") || (!apply && !prepareApproval);
  if (!category) {
    console.error("Usage: node scripts/promote-catalog.mjs --category=<category> [--dry-run|--prepare-approval|--apply]");
    process.exit(1);
  }
  assertPromotableCategory(category);

  const categoryDir = path.join(intelligenceDir, category);
  const skuCatalog = await readJson(path.join(categoryDir, "sku_catalog.json"));
  const noiseRules = await readJson(path.join(categoryDir, "noise_rules.json"));
  const cache = await readJson(cachePath, emptyCache());
  const allCandidates = selectPromotionCandidates(category, skuCatalog, noiseRules);
  if (prepareApproval) {
    const existing = await readJson(approvalPathFor(category), null);
    const queue = makeApprovalQueue(category, allCandidates, existing);
    await writeFile(approvalPathFor(category), JSON.stringify(queue, null, 2));
    console.log(`\n[promote-catalog] wrote approval queue: ${path.relative(appDir, approvalPathFor(category))}`);
    printApprovalSummary(queue);
    return;
  }

  const approvalQueue = await loadApprovalQueue(category, allCandidates);
  const candidates = apply ? filterCandidatesByApproval(allCandidates, approvalQueue) : allCandidates;
  const summary = summarize({ category, candidates, cache });
  printSummary(summary);
  if (approvalQueue) printApprovalSummary(approvalQueue);

  if (dryRun) {
    console.log("\nDry-run only. Use --prepare-approval to write approval_queue.json, then set approved=true and run --apply.");
    return;
  }

  if (!approvalQueue) {
    console.error("\napproval_queue.json missing. Run --prepare-approval first, approve entries, then run --apply.");
    process.exit(1);
  }

  if (summary.newSkus.length === 0 && summary.newNoise.length === 0) {
    console.log("\nNothing new to apply.");
    return;
  }

  const promotion = {
    category,
    applied_at: new Date().toISOString(),
    source_hash: hash({ skuCatalogGeneratedAt: skuCatalog.generated_at, noiseRulesGeneratedAt: noiseRules.generated_at, skus: candidates.skus, noise: candidates.noise }),
    skus: summary.newSkus,
    noise: summary.newNoise,
  };
  cache.promotions = [...(cache.promotions ?? []), promotion];
  cache.updated_at = promotion.applied_at;

  const flattened = flattenCache(cache);
  await mkdir(generatedDir, { recursive: true });
  await writeFile(cachePath, JSON.stringify(cache, null, 2));
  await writeFile(generatedCatalogPath, renderGeneratedCatalog(flattened.skus));
  await writeFile(generatedNoisePath, renderGeneratedNoiseRules(flattened.noise));

  console.log("\nApplied promotion cache and regenerated runtime files:");
  console.log(`  ${path.relative(appDir, cachePath)}`);
  console.log(`  ${path.relative(appDir, generatedCatalogPath)}`);
  console.log(`  ${path.relative(appDir, generatedNoisePath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
