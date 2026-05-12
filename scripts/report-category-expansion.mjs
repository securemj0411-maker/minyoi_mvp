import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const intelligenceDir = path.join(appDir, "category-intelligence");
const reportsDir = path.join(appDir, "reports");

const RUNTIME_BLOCKERS = {
  monitor_discovered: "monitor parser skeleton exists, but runtime catalog/pool gate is not promoted yet",
  game_console_discovered: "game-console runtime category/comparable-key parser is not implemented yet",
  camera_discovered: "camera runtime category/comparable-key parser is not implemented yet",
  speaker_audio_discovered: "speaker/audio runtime category/comparable-key parser is not implemented yet",
  desktop_pc_discovered: "desktop PC runtime category/comparable-key parser is not implemented yet",
  home_appliance_tech_discovered: "home-appliance runtime risk model and logistics gate are not implemented yet",
};

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function sumClusterSizes(clusters, type) {
  return clusters
    .filter((cluster) => cluster.listing_type === type)
    .reduce((sum, cluster) => sum + Number(cluster._size ?? 0), 0);
}

function recommendation(summary) {
  if (summary.normalRate < 40) return "mine_narrower: 정상 본품 비율 낮음";
  if (summary.pendingSkuCount === 0) return "mine_more: 승격 후보 SKU 없음";
  if (summary.runtimeBlocker) return "design_only: runtime category/parser/gate 선행 필요";
  if (summary.blockedSkuCount > summary.pendingSkuCount) return "hold: broad/mixed SKU 위험 큼";
  return "parser_gate_candidate: parser/gate 설계 검토 가능";
}

async function summarizeCategory(category) {
  const dir = path.join(intelligenceDir, category);
  const samples = await readJson(path.join(dir, "samples.json"), []);
  const clusters = await readJson(path.join(dir, "cluster_analysis.json"), []);
  const skuCatalog = await readJson(path.join(dir, "sku_catalog.json"), { skus: [] });
  const noiseRules = await readJson(path.join(dir, "noise_rules.json"), { rules: [] });
  const priceDistribution = await readJson(path.join(dir, "price_distribution.json"), []);

  const normalCount = sumClusterSizes(clusters, "normal");
  const nonNormalCount = clusters.reduce((sum, cluster) => sum + Number(cluster._size ?? 0), 0) - normalCount;
  const skuStatusCounts = countBy(skuCatalog.skus ?? [], (sku) => sku.approval_status ?? "unknown");
  const noiseStatusCounts = countBy(noiseRules.rules ?? [], (rule) => `${rule.type ?? "unknown"}/${rule.approval_status ?? "unknown"}`);
  const riskySkuCount = (skuCatalog.skus ?? []).filter((sku) => (sku.risk_flags ?? []).length).length;
  const pendingSkuCount = skuStatusCounts.needs_human_approval ?? 0;
  const blockedSkuCount = skuStatusCounts.blocked_needs_review ?? 0;

  const summary = {
    category,
    generatedAt: skuCatalog.generated_at ?? null,
    sampleCount: samples.length,
    clusterCount: clusters.length,
    normalCount,
    nonNormalCount,
    normalRate: pct(normalCount, samples.length),
    pendingSkuCount,
    blockedSkuCount,
    riskySkuCount,
    autoNoiseCount: (noiseRules.rules ?? []).filter((rule) => rule.approval_status === "auto_approved_for_review").length,
    runtimeBlocker: RUNTIME_BLOCKERS[category] ?? "",
    skuStatusCounts,
    noiseStatusCounts,
    topPendingSkus: (skuCatalog.skus ?? [])
      .filter((sku) => sku.approval_status === "needs_human_approval")
      .slice(0, 8)
      .map((sku) => ({
        id: sku.id,
        modelName: sku.model_name,
        aliases: (sku.aliases ?? []).slice(0, 6),
      })),
    topBlockedSkus: (skuCatalog.skus ?? [])
      .filter((sku) => (sku.risk_flags ?? []).length)
      .slice(0, 8)
      .map((sku) => ({
        id: sku.id,
        modelName: sku.model_name,
        riskFlags: sku.risk_flags ?? [],
      })),
    priceDistribution,
  };

  return {
    ...summary,
    recommendation: recommendation(summary),
  };
}

async function main() {
  const entries = await readdir(intelligenceDir, { withFileTypes: true });
  const categories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_discovered"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "ko"));

  const summaries = [];
  for (const category of categories) summaries.push(await summarizeCategory(category));

  const report = {
    generatedAt: new Date().toISOString(),
    summaries,
  };

  const md = [
    "# Category Expansion Readiness",
    "",
    `- generated_at: ${report.generatedAt}`,
    "",
    table(
      ["category", "samples", "normal%", "pending SKU", "blocked SKU", "auto noise", "runtime blocker", "recommendation"],
      summaries.map((summary) => [
        summary.category,
        String(summary.sampleCount),
        `${summary.normalRate}%`,
        String(summary.pendingSkuCount),
        String(summary.blockedSkuCount),
        String(summary.autoNoiseCount),
        summary.runtimeBlocker ? "yes" : "no",
        summary.recommendation,
      ]),
    ),
    "",
    "## Category Notes",
    "",
    ...summaries.flatMap((summary) => [
      `### ${summary.category}`,
      "",
      `- runtime_blocker: ${summary.runtimeBlocker || "none"}`,
      `- sku_status: ${JSON.stringify(summary.skuStatusCounts)}`,
      `- noise_status: ${JSON.stringify(summary.noiseStatusCounts)}`,
      `- top_pending_skus: ${summary.topPendingSkus.map((sku) => sku.id).join(", ") || "-"}`,
      `- top_blocked_skus: ${summary.topBlockedSkus.map((sku) => `${sku.id}(${sku.riskFlags.join(",")})`).join(", ") || "-"}`,
      "",
    ]),
  ].join("\n");

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "category-expansion-latest.json"), JSON.stringify(report, null, 2));
  await writeFile(path.join(reportsDir, "category-expansion-latest.md"), md);

  console.log("wrote reports/category-expansion-latest.json");
  console.log("wrote reports/category-expansion-latest.md");
  for (const summary of summaries) {
    console.log(`${summary.category}: normal=${summary.normalRate}% pending=${summary.pendingSkuCount} blocked=${summary.blockedSkuCount} rec=${summary.recommendation}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
