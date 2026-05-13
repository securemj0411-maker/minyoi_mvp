import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANCHORS, readAllAnchorSummaries, type AnchorKey, type ParseSummary } from "./lib/phones-anchor-trio-mining.js";

const reportsDir = path.join(process.cwd(), "reports");

type ReportFile = { metrics: Record<string, number>; perAnchor?: unknown[] };

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

function categorize(label: string): string {
  if (label.startsWith("wrong_model_")) return "model_disambiguation";
  if (label.startsWith("wrong_storage_")) return "storage_disambiguation";
  if (label.startsWith("carrier_")) return "carrier_disambiguation";
  if (["buying_post", "accessory_only", "broken_or_parts", "refurbished_only", "lost_or_locked"].includes(label))
    return "semantic_pollution";
  if (label === "price_too_low" || label === "price_too_high") return "price_band_ambiguity";
  if (label.startsWith("missing_")) return "accept_pattern_gap";
  return "other";
}

function bucketizeRejects(s: ParseSummary): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of s.reject_breakdown) {
    const label = r.reason.replace(/^reject_/, "");
    const cat = categorize(label);
    out[cat] = (out[cat] ?? 0) + r.count;
  }
  return out;
}

async function main(): Promise<void> {
  const all = await readAllAnchorSummaries();
  const density = await readJson<ReportFile>(
    "phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity-latest.json",
  );

  const buckets = ANCHORS.map((a) => ({ anchor: a, buckets: bucketizeRejects(all[a]) }));

  // shared bottleneck = bucket appearing in all three anchors with non-zero count
  const allCategories = new Set<string>();
  for (const b of buckets) Object.keys(b.buckets).forEach((c) => allCategories.add(c));

  type CategoryRow = {
    category: string;
    perAnchorCount: Record<AnchorKey, number>;
    perAnchorShare: Record<AnchorKey, number>;
    presentInAll: boolean;
    sharedSeverity: "high" | "medium" | "low" | "absent";
    dominantAnchor: AnchorKey | null;
    note: string;
  };

  const sharedRows: CategoryRow[] = [];
  for (const cat of allCategories) {
    const perAnchorCount = {} as Record<AnchorKey, number>;
    const perAnchorShare = {} as Record<AnchorKey, number>;
    for (const a of ANCHORS) {
      const c = buckets.find((b) => b.anchor === a)?.buckets[cat] ?? 0;
      perAnchorCount[a] = c;
      perAnchorShare[a] = all[a].total_fetched > 0 ? Number((c / all[a].total_fetched).toFixed(3)) : 0;
    }
    const presentInAll = ANCHORS.every((a) => perAnchorCount[a] > 0);
    const totalShareSum = ANCHORS.reduce((acc, a) => acc + perAnchorShare[a], 0);
    const sharedSeverity = presentInAll
      ? totalShareSum >= 0.45
        ? "high"
        : totalShareSum >= 0.15
          ? "medium"
          : "low"
      : "absent";
    const dominantAnchor = (Object.entries(perAnchorShare) as [AnchorKey, number][]).reduce<[AnchorKey, number] | null>((best, cur) => {
      if (best === null) return cur;
      return cur[1] > best[1] ? cur : best;
    }, null)?.[0] ?? null;
    sharedRows.push({
      category: cat,
      perAnchorCount,
      perAnchorShare,
      presentInAll,
      sharedSeverity,
      dominantAnchor,
      note: presentInAll
        ? "category present across all three anchors — a structural smartphone bottleneck."
        : "category absent in at least one anchor — model-specific bottleneck.",
    });
  }
  sharedRows.sort((a, b) => {
    const order = ["high", "medium", "low", "absent"];
    return order.indexOf(a.sharedSeverity) - order.indexOf(b.sharedSeverity);
  });

  const sharedHigh = sharedRows.filter((r) => r.sharedSeverity === "high").map((r) => r.category);
  const sharedMedium = sharedRows.filter((r) => r.sharedSeverity === "medium").map((r) => r.category);
  const perModel = sharedRows.filter((r) => !r.presentInAll).map((r) => ({ category: r.category, dominantAnchor: r.dominantAnchor }));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    anchors: ANCHORS,
    decision: "phones_discovered_anchor_trio_shared_vs_per_model_bottleneck_comparison_report_only",
    metrics: {
      anchors: ANCHORS.length,
      categories: sharedRows.length,
      sharedHigh: sharedHigh.length,
      sharedMedium: sharedMedium.length,
      perModelOnly: perModel.length,
      runtimeApprovedRows: 0,
      overallPositiveDensity: density?.metrics.overallPositiveDensity ?? null,
      overallPollutionShare: density?.metrics.overallPollutionShare ?? null,
      overallAmbiguityShare: density?.metrics.overallAmbiguityShare ?? null,
    },
    sharedHighCategories: sharedHigh,
    sharedMediumCategories: sharedMedium,
    perModelOnlyCategories: perModel,
    rows: sharedRows,
    interpretation: {
      structuralBottlenecks:
        "categories shared by all three anchors: " + (sharedHigh.concat(sharedMedium).join(", ") || "(none)"),
      modelSpecificBottlenecks:
        "categories present in only some anchors: " + (perModel.map((p) => `${p.category}(${p.dominantAnchor})`).join(", ") || "(none)"),
      verdict:
        "shared categories require a SMARTPHONE-LEVEL fix (option-axis extension or AI L2 routing); model-specific categories are addressed per-anchor catalog/mining adjustments.",
    },
    policyImplications: [
      "shared high-severity categories are structural smartphone bottlenecks — they will not be fixed by per-anchor tweaks.",
      "model-specific bottlenecks can in principle be addressed per-anchor (catalog mustNotContain tightening / mining query refinement) — but doing so is an owner-decision runtime change, not authorized here.",
      "the comparison itself confirms why the anchor trio fails to cross density floors uniformly: shared comparable_key thinness + per-model query/catalog edges.",
      "AI L2 fallback remains the only legitimate near-term path for the silent-state slice.",
      "This packet is report-only and must not be runtime-wired.",
    ],
    nextReportOnlyExperiments: [
      "weekly refresh to track whether category severities drift",
      "future packet (separate wave): per-anchor catalog/mining edge proposals (still report-only)",
    ],
    doNotDo: [
      "Do not propose runtime/catalog/parser changes from this packet",
      "Do not collapse shared and per-model bottlenecks into a single fix recipe",
      "Do not public-promote anything from this packet",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(
    reportsDir,
    "phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison-latest.json",
  );
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Discovered — Anchor Trio Shared vs Per-Model Bottleneck Comparison",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only comparison of which reject categories are shared across the three anchors (structural smartphone bottleneck) vs concentrated in one (model-specific bottleneck).",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Shared High-Severity Categories",
    "",
    ...(sharedHigh.length === 0 ? ["- (none)"] : sharedHigh.map((c) => `- ${c}`)),
    "",
    "## Shared Medium-Severity Categories",
    "",
    ...(sharedMedium.length === 0 ? ["- (none)"] : sharedMedium.map((c) => `- ${c}`)),
    "",
    "## Per-Model-Only Categories",
    "",
    ...(perModel.length === 0 ? ["- (none)"] : perModel.map((p) => `- ${p.category} (dominant=${p.dominantAnchor})`)),
    "",
    "## Rows",
    "",
    "| category | severity | iphone_13_pro_128gb_self | galaxy_s23_ultra_256_self | galaxy_s25_ultra_256_self | dominant | presentInAll |",
    "|---|---|---:|---:|---:|---|---|",
    ...sharedRows.map(
      (r) =>
        `| ${r.category} | ${r.sharedSeverity} | ${r.perAnchorCount.iphone_13_pro_128gb_self} (${r.perAnchorShare.iphone_13_pro_128gb_self}) | ${r.perAnchorCount.galaxy_s23_ultra_256_self} (${r.perAnchorShare.galaxy_s23_ultra_256_self}) | ${r.perAnchorCount.galaxy_s25_ultra_256_self} (${r.perAnchorShare.galaxy_s25_ultra_256_self}) | ${r.dominantAnchor ?? "-"} | ${r.presentInAll} |`,
    ),
    "",
    "## Interpretation",
    "",
    `- structuralBottlenecks: ${report.interpretation.structuralBottlenecks}`,
    `- modelSpecificBottlenecks: ${report.interpretation.modelSpecificBottlenecks}`,
    `- verdict: ${report.interpretation.verdict}`,
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((l) => `- ${l}`),
    "",
    "## Next Report-Only Experiments",
    "",
    ...report.nextReportOnlyExperiments.map((l) => `- ${l}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(
    `phones shared-vs-per-model: sharedHigh=${sharedHigh.length}, sharedMedium=${sharedMedium.length}, perModel=${perModel.length}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
