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
    "smartwatch-packet-audit-latest.json",
  );
  const cleanlinessRefresh = await tryReadJson<ReportFile>(
    "smartwatch-applewatch-series9-series10-battery90plus-direct-cleanliness-refresh-latest.json",
  );
  const thickening = await tryReadJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-plain-clean-personal-adjacent-thickening-latest.json",
  );
  const threeBranch = await tryReadJson<ReportFile>(
    "smartwatch-applewatch-series10-46mm-battery90plus-three-branch-neighbor-composition-latest.json",
  );
  const s9Conditions = await tryReadJson<ReportFile>(
    "smartwatch-applewatch-series9-45mm-gps-battery90plus-condition-splits-latest.json",
  );

  const closure = await tryReadJson<ReportFile & { closure?: { reopenCondition?: string } }>(
    "smartwatch-applewatch-series9-series10-hold-family-closure-latest.json",
  );

  const items: RoadmapItem[] = [
    {
      priority: "now",
      scope:
        "Apple Watch Series9 / Series10 thickening family fixed as report-only HOLD FAMILY (see smartwatch-applewatch-series9-series10-hold-family-closure-latest)",
      rationale:
        "Closure packet fixes the conclusions: multi-baggage adjacency, density floor not met under plain_branch, cross-generation thickening rules incompatible. Reopen requires the explicit gate condition.",
      blockers: [
        "reopen condition not met: " +
          (closure?.closure?.reopenCondition ?? "see closure packet"),
      ],
      expectedArtifact:
        "no further smartwatch thickening packets until reopen condition crosses on two consecutive weekly refreshes",
    },
    {
      priority: "now",
      scope: "weekly cleanliness refresh: re-run packet registry/manifest/audit/cleanliness-refresh against latest mining snapshots",
      rationale:
        "All current S9/S10 lanes are singleton-tier. Density tracking is the only honest path. Re-run is cheap, report-only, no runtime impact.",
      blockers: [],
      expectedArtifact: "regenerated registry/manifest/audit/cleanliness-refresh json+md pairs",
    },
    {
      priority: "now",
      scope: "Series10 46mm plain branch thickening watch: only thicken when coherentCore + plainCleanPersonal pass 5 rows without leakage",
      rationale:
        "coherentCoreRows=" +
        (thickening?.metrics?.coherentCoreRows ?? "?") +
        ", plainCleanPersonalRows=" +
        (threeBranch?.metrics?.plainCleanPersonalRows ?? "?") +
        " — too thin for any deterministic move.",
      blockers: ["density floor not met", "branch coverage gaps unresolved"],
      expectedArtifact: "no runtime change until weekly snapshot crosses density floor",
    },
    {
      priority: "next",
      scope: "Series10 46mm care_backed_gps branch — separate report-only sibling lane investigation",
      rationale:
        "Care-backed lane has its own price normalization vs plain GPS. Must not be absorbed into plain branch.",
      blockers: ["catalog change is out of scope this wave", "needs owner decision on price normalization model"],
      expectedArtifact: "report-only owner-care detail packet (S9-style ownercare-lane-purity pattern)",
    },
    {
      priority: "next",
      scope: "Series10 46mm cellular_premium branch — separate report-only sibling lane investigation",
      rationale:
        "Cellular / 티타늄 / premium framing is a distinct price tier. Stay siblings, never absorbed.",
      blockers: ["catalog change out of scope", "cellular vs titanium ambiguity needs further evidence"],
      expectedArtifact: "report-only cellular-premium signal carrier packet",
    },
    {
      priority: "next",
      scope: "Series9 45mm GPS battery90+ ownercare-lane-purity refresh under new packet manifest discipline",
      rationale:
        "S9 lane has heavy adjacency (strap/box). Re-frame existing S9 packets under the same coherent-core vs adjacency taxonomy used for S10.",
      blockers: [
        s9Conditions
          ? "totalRows=" + (s9Conditions.metrics?.totalRows ?? "?") + ", still singleton-tier"
          : "s9 condition splits packet missing",
      ],
      expectedArtifact: "refresh of S9 ownercare-lane-purity using coherent-core vs adjacency dimensions",
    },
    {
      priority: "later",
      scope: "Apple Watch Ultra2 and SE3 packet alignment to the same registry/manifest/audit discipline",
      rationale:
        "Ultra2 and SE3 packets exist but were not framed under the unified manifest taxonomy. Re-frame, do not widen.",
      blockers: ["scope creep risk", "needs owner decision on whether Ultra2/SE3 stay in this wave"],
      expectedArtifact: "Ultra2 + SE3 manifest entries with the same field layout",
    },
    {
      priority: "later",
      scope: "smartwatch unknown_size 28/1000 parser gap closure (mm extraction regex)",
      rationale:
        "Tracked in wave2.md as semantic_pollution for the smartwatch category. Out of scope for this wave (catalog/parser change forbidden).",
      blockers: ["catalog/parser change forbidden this wave", "needs explicit owner approval"],
      expectedArtifact: "future wave: option-parser mm regex hardening + replay measurement",
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    decision: "smartwatch_packet_roadmap_report_only",
    upstreamState: {
      auditPass: audit?.totals.pass ?? null,
      auditHardFindings: audit?.totals.hardFindings ?? null,
      auditSoftFindings: audit?.totals.softFindings ?? null,
      cleanlinessRefreshGeneratedAt: cleanlinessRefresh?.generatedAt ?? null,
    },
    items,
    invariants: [
      "no runtime/public/candidate_pool/DDL/catalog/parser changes from any roadmap item without an explicit new owner approval",
      "no merging of sibling branches into one deterministic lane",
      "no widening of plain-clean lane with adjacency evidence",
      "density-first: deterministic thickening only after multi-week density crossing",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "smartwatch-packet-roadmap-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Packet Roadmap",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only roadmap of next-step smartwatch packet work. No roadmap item authorizes runtime change.",
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
  console.log(
    `smartwatch-packet-roadmap: items=${items.length}, auditPass=${report.upstreamState.auditPass}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
