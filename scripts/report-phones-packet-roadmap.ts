import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type ReportFile = { metrics?: Record<string, number>; generatedAt?: string };

async function tryReadJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as T;
  } catch {
    return null;
  }
}

type RoadmapItem = {
  priority: "now" | "next" | "later";
  scope: string;
  rationale: string;
  blockers: string[];
  expectedArtifact: string;
};

async function main(): Promise<void> {
  const audit = await tryReadJson<{ totals: { hardFindings: number; softFindings: number; pass: boolean } }>(
    "phones-packet-audit-latest.json",
  );
  const summary = await tryReadJson<ReportFile>("phones-discovered-anchor-trio-parser-bottleneck-summary-latest.json");
  const comparison = await tryReadJson<ReportFile>(
    "phones-discovered-anchor-trio-shared-vs-per-model-bottleneck-comparison-latest.json",
  );

  const items: RoadmapItem[] = [
    {
      priority: "now",
      scope: "weekly mining + packet refresh: rerun the 5 anchor-trio packets + registry/manifest/audit against latest mining snapshots",
      rationale: "report-only refresh tracks structural drift without runtime cost.",
      blockers: [],
      expectedArtifact: "regenerated phones-* json+md pairs",
    },
    {
      priority: "now",
      scope: "anchor trio family fixed at report-only AI L2 candidate state",
      rationale:
        "summary verdict: comparable_key trust blocker is structural. " +
        `sharedHigh=${comparison?.metrics?.sharedHigh ?? "?"}, sharedMedium=${comparison?.metrics?.sharedMedium ?? "?"}, perModelOnly=${comparison?.metrics?.perModelOnly ?? "?"}.`,
      blockers: ["any runtime/catalog/parser change is owner-decision territory and out of scope this wave"],
      expectedArtifact: "no runtime change. roadmap status reflected here only.",
    },
    {
      priority: "next",
      scope: "AI L2 phones routing design (report-only first)",
      rationale: "silent-state rows must be owned by AI L2 per LAUNCH_PLAN §12b. design packet should precede runtime wiring.",
      blockers: ["needs owner decision on cost envelope + escrow policy"],
      expectedArtifact: "phones-ai-l2-routing-design packet (report-only)",
    },
    {
      priority: "next",
      scope: "production parser instrumentation design (report-only first)",
      rationale: "description-only signal coverage is UNMEASURED at L1. measurement is the prerequisite for any future axis-extension proposal.",
      blockers: ["needs owner decision on logging shape + retention"],
      expectedArtifact: "phones-parser-instrumentation-design packet (report-only)",
    },
    {
      priority: "later",
      scope: "comparable_key axis extension proposal (carrier / self_unlocked / esim / dual_sim / color)",
      rationale:
        "structural fix for the trust blocker. NEVER do this without explicit owner approval — it is a runtime change to option-parser.",
      blockers: [
        "runtime/parser change forbidden without owner approval",
        "needs prior AI L2 routing design (no preempt)",
        "needs prior instrumentation to validate axis extraction precision",
      ],
      expectedArtifact: "future wave proposal packet (report-only) — then owner decision",
    },
    {
      priority: "later",
      scope: "per-anchor catalog/mining edge proposals (S25 missing_accept gap, iPhone 13 thin parse_ready, S23 wrong_storage_512_1tb)",
      rationale: "model-specific tightening is incremental but secondary to the shared trust blocker. do not preempt the shared fix.",
      blockers: ["runtime/catalog change forbidden without owner approval"],
      expectedArtifact: "per-anchor edge proposal packets (report-only)",
    },
    {
      priority: "later",
      scope: "extend the anchor trio with Galaxy S24 Ultra / iPhone 14 Pro / iPhone 15 Pro family",
      rationale: "broader smartphone density baseline before any deterministic widening. still bounded by the same comparable_key trust blocker.",
      blockers: ["mining lane_config must exist for new anchors", "owner decision on scope creep"],
      expectedArtifact: "expansion proposal packet (report-only)",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    decision: "phones_packet_roadmap_report_only",
    upstreamState: {
      auditPass: audit?.totals.pass ?? null,
      auditHardFindings: audit?.totals.hardFindings ?? null,
      auditSoftFindings: audit?.totals.softFindings ?? null,
      summaryGeneratedAt: summary?.generatedAt ?? null,
      sharedHighCount: comparison?.metrics?.sharedHigh ?? null,
      sharedMediumCount: comparison?.metrics?.sharedMedium ?? null,
      perModelOnlyCount: comparison?.metrics?.perModelOnly ?? null,
    },
    items,
    invariants: [
      "no runtime/public/candidate_pool/DDL/catalog/parser changes from any roadmap item without an explicit new owner approval",
      "silent-state inference (carrier/self/esim/dual_sim) into deterministic comparable_key is forbidden",
      "AI L2 routing is the only legitimate near-term destination for the silent-state slice",
      "report-only refresh is the only authorized recurring activity",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-packet-roadmap-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Packet Roadmap",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only roadmap of next-step phones packet work. No item authorizes runtime change.",
    "",
    "## Upstream State",
    "",
    ...Object.entries(report.upstreamState).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Items",
    "",
    ...items.flatMap((i) => [
      `### [${i.priority}] ${i.scope}`,
      "",
      `- rationale: ${i.rationale}`,
      `- blockers: ${i.blockers.length === 0 ? "(none)" : i.blockers.join("; ")}`,
      `- expectedArtifact: ${i.expectedArtifact}`,
      "",
    ]),
    "## Invariants",
    "",
    ...report.invariants.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`phones-packet-roadmap: items=${items.length}, auditPass=${report.upstreamState.auditPass}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
