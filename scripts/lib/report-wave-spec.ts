export type ReportWaveSpec = {
  key: string;
  category: string;
  family: string;
  title: string;
  description: string;
  reportOnly: true;
  scripts: readonly string[];
  metaChain: readonly string[];
  guardrails: readonly string[];
  compositeOf?: readonly string[];
};

const scriptCommand = (scriptFile: string): string[] => ["node", "--import", "tsx", `scripts/${scriptFile}`];

const makeWave = (spec: ReportWaveSpec): ReportWaveSpec => spec;

export const reportWaves: readonly ReportWaveSpec[] = [
  makeWave({
    key: "smartwatch-series10-branch-thickening",
    category: "smartwatch_discovered",
    family: "applewatch_series9_series10",
    title: "Smartwatch Series10 Branch Thickening",
    description:
      "Batch-runs the Series10 46mm branch thickening packet set, refreshes direct cleanliness comparison, and closes the smartwatch meta chain in one report-only wave.",
    reportOnly: true,
    scripts: [
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap.ts",
      "report-smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh.ts",
    ],
    metaChain: [
      "report-smartwatch-packet-registry.ts",
      "report-smartwatch-packet-manifest.ts",
      "report-smartwatch-packet-audit.ts",
      "report-smartwatch-packet-roadmap.ts",
      "report-parser-report-manifest.ts",
      "report-parser-manifest-audit.ts",
    ],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "No candidate_pool/public promotion wiring",
      "Report-only outputs and meta-chain regeneration only",
    ],
  }),
  makeWave({
    key: "phones-anchor-trio-bottleneck",
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    title: "Phones Anchor Trio Comparable-Key Bottleneck",
    description:
      "Runs the phone anchor trio bottleneck packet family together so the structural comparable_key trust problem is measured in one go instead of as isolated single-packet waves.",
    reportOnly: true,
    scripts: [
      "report-phones-discovered-anchor-trio-option-axis-inventory.ts",
      "report-phones-discovered-anchor-trio-comparable-key-trust-blocker.ts",
      "report-phones-discovered-anchor-trio-title-vs-description-signal-carrier.ts",
      "report-phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity.ts",
      "report-phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison.ts",
    ],
    metaChain: [
      "report-parser-report-manifest.ts",
      "report-parser-manifest-audit.ts",
    ],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Do not widen comparable_key or infer silent axes",
      "Report-only outputs and parser manifest/audit refresh only",
    ],
  }),
  makeWave({
    key: "smartwatch-weekly-refresh",
    category: "smartwatch_discovered",
    family: "applewatch_series9_series10",
    title: "Smartwatch Weekly Refresh",
    description:
      "Weekly refresh of the Series9/Series10 hold family — re-runs all member packets (thickening / 3-branch / baggage / density-floor / overlap / hold-family-closure / cleanliness-refresh) and the smartwatch meta chain. report-only.",
    reportOnly: true,
    scripts: [
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-adjacent-baggage-decomposition.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-density-floor-watch.ts",
      "report-smartwatch-applewatch-series10-46mm-battery90plus-coherent-core-vs-adjacent-overlap.ts",
      "report-smartwatch-applewatch-series10-46mm-vs-series9-45mm-battery90plus-cleanliness.ts",
      "report-smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh.ts",
      "report-smartwatch-applewatch-series9-series10-hold-family-closure.ts",
    ],
    metaChain: [
      "report-smartwatch-packet-registry.ts",
      "report-smartwatch-packet-manifest.ts",
      "report-smartwatch-packet-audit.ts",
      "report-smartwatch-packet-roadmap.ts",
    ],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Hold family closure conclusions stay fixed unless reopen condition crosses on the refresh",
      "Report-only outputs and meta-chain regeneration only",
    ],
  }),
  makeWave({
    key: "phones-weekly-refresh",
    category: "phones_discovered",
    family: "smartphone_anchor_trio",
    title: "Phones Weekly Refresh",
    description:
      "Weekly refresh of the phones anchor trio bottleneck family — re-runs all member packets (option-axis-inventory / comparable-key-trust-blocker / title-vs-description / density-pollution-ambiguity / shared-vs-per-model / parser-bottleneck-summary) and the phones meta chain. report-only.",
    reportOnly: true,
    scripts: [
      "report-phones-discovered-anchor-trio-option-axis-inventory.ts",
      "report-phones-discovered-anchor-trio-comparable-key-trust-blocker.ts",
      "report-phones-discovered-anchor-trio-title-vs-description-signal-carrier.ts",
      "report-phones-discovered-anchor-trio-positive-density-semantic-pollution-ambiguity.ts",
      "report-phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison.ts",
      "report-phones-discovered-anchor-trio-parser-bottleneck-summary.ts",
    ],
    metaChain: [
      "report-phones-packet-registry.ts",
      "report-phones-packet-manifest.ts",
      "report-phones-packet-audit.ts",
      "report-phones-packet-roadmap.ts",
    ],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Do not widen comparable_key or infer silent axes",
      "Report-only outputs and meta-chain regeneration only",
    ],
  }),
  makeWave({
    key: "owner-decision-unblock",
    category: "owner_decision_unblock",
    family: "summary",
    title: "Owner Decision Unblock Wave",
    description:
      "Generates the 4 owner-decision unblock packets (phones AI L2 routing / PS5 catalog vs adapter regex / next lane apply / candidate_pool internal→public promotion) + summary. Each packet presents options/recommendation/execution-steps for owner sign-off. report-only.",
    reportOnly: true,
    scripts: [
      "report-owner-decision-unblock-phones-ai-l2-routing.ts",
      "report-owner-decision-unblock-ps5-catalog-vs-adapter-regex.ts",
      "report-owner-decision-unblock-next-lane-apply.ts",
      "report-owner-decision-unblock-candidate-pool-promotion.ts",
      "report-owner-decision-unblock-summary.ts",
    ],
    metaChain: [],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Each packet only presents options; no recommendation is auto-executed",
      "Owner must explicitly trigger any execution step",
    ],
  }),
  makeWave({
    key: "category-readiness-priority",
    category: "all_categories",
    family: "category_readiness_dependency_map",
    title: "Category Readiness Dependency Map + Priority Table + Implementation Wave Spec",
    description:
      "Generates the 3 packets that map every category's readiness blockers, classify them into 3 buckets (immediate_unlock / parser_strengthen_first / semantic_pollution_hold), and produce the next implementation wave step list. report-only.",
    reportOnly: true,
    scripts: [
      "report-category-readiness-dependency-map.ts",
      "report-category-unblock-priority-table.ts",
      "report-category-next-implementation-wave-spec.ts",
    ],
    metaChain: [],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Dependency map is measurement-based; do not relax readiness thresholds to inflate ready count",
      "Owner actions are explicitly flagged in the implementation wave spec",
    ],
  }),
  makeWave({
    key: "wave3-through-8-implementation",
    category: "all_categories",
    family: "tech_home_categories_implementation",
    title: "Wave 3~8 Implementation Chain (production replay + axis gap + AI L2 + instrumentation + axis extension + frontier preflight + final unlock order)",
    description:
      "Runs the report-only implementation chain (Wave 3 production replay + Wave 4 axis gap diagnostic + Wave 5 AI L2 routing design + Wave 6 parser instrumentation design + Wave 7 axis extension proposal + Wave 8 frontier preflight + final unlock-order). report-only.",
    reportOnly: true,
    scripts: [
      "report-wave3-production-replay-measurement.ts",
      "report-wave4-tablet-laptop-axis-gap-diagnostic.ts",
      "report-wave5-ai-l2-routing-design.ts",
      "report-wave6-parser-instrumentation-design.ts",
      "report-wave7-comparable-key-axis-extension-proposal.ts",
      "report-wave8-tech-narrow-lane-preflight.ts",
      "report-category-unlock-order-final.ts",
    ],
    metaChain: [],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes (readiness/raw/parsed 등)",
      "Owner actions are explicitly flagged in each packet",
      "Final unlock-order is the index — each per-wave packet is the detail source",
    ],
  }),
  makeWave({
    key: "all-weekly",
    category: "multi",
    family: "all_active_report_only_families",
    title: "All Weekly Refresh (Composite)",
    description:
      "Composite wave: runs all active report-only family weekly refreshes (smartwatch + phones) in one command. dedupes scripts. report-only.",
    reportOnly: true,
    scripts: [],
    metaChain: [],
    compositeOf: ["smartwatch-weekly-refresh", "phones-weekly-refresh"],
    guardrails: [
      "No runtime/public/candidate_pool/DDL/catalog/parser changes",
      "No DB writes",
      "Composite expansion preserves each member wave's guardrails",
      "Report-only outputs and meta-chain regeneration only",
    ],
  }),
];

const reportWaveByKey = new Map(reportWaves.map((wave) => [wave.key, wave]));

export function findReportWaveByKey(key: string): ReportWaveSpec | null {
  return reportWaveByKey.get(key) ?? null;
}

export function listReportWaveKeys(): string[] {
  return reportWaves.map((wave) => wave.key);
}

function expandCompositeScripts(spec: ReportWaveSpec, visited: Set<string>): { scripts: string[]; metaChain: string[] } {
  if (visited.has(spec.key)) {
    throw new Error(`composite cycle detected at wave key: ${spec.key}`);
  }
  visited.add(spec.key);
  const scripts: string[] = [...spec.scripts];
  const metaChain: string[] = [...spec.metaChain];
  for (const memberKey of spec.compositeOf ?? []) {
    const member = reportWaveByKey.get(memberKey);
    if (!member) {
      throw new Error(`composite member not found: ${memberKey} (parent=${spec.key})`);
    }
    const inner = expandCompositeScripts(member, visited);
    scripts.push(...inner.scripts);
    metaChain.push(...inner.metaChain);
  }
  return { scripts, metaChain };
}

function dedupePreservingOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function compileWaveCommands(spec: ReportWaveSpec): Array<{ name: string; command: string[]; phase: "packets" | "meta" }> {
  const expanded = expandCompositeScripts(spec, new Set());
  const scripts = dedupePreservingOrder(expanded.scripts);
  const metaChain = dedupePreservingOrder(expanded.metaChain);
  return [
    ...scripts.map((scriptFile) => ({
      name: scriptFile.replace(/^report-/, "").replace(/\.ts$/, ""),
      command: scriptCommand(scriptFile),
      phase: "packets" as const,
    })),
    ...metaChain.map((scriptFile) => ({
      name: scriptFile.replace(/^report-/, "").replace(/\.ts$/, ""),
      command: scriptCommand(scriptFile),
      phase: "meta" as const,
    })),
  ];
}
