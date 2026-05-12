import fs from "node:fs";
import path from "node:path";

type Packet = {
  category: string;
  metrics: Record<string, number | string>;
  nextAction?: string;
};

type Audit = {
  category: string;
  conclusion: string;
  metrics: {
    filesChecked: number;
    failures: number;
  };
};

const packetFiles = [
  "monitor-model-code-spec-evidence-packet-latest.json",
  "desktop-full-unit-part-split-fixture-packet-latest.json",
  "speaker-model-family-device-class-fixture-packet-latest.json",
  "camera-body-lens-package-fixture-packet-latest.json",
  "home-appliance-vacuum-subtype-fixture-packet-latest.json",
];

const auditFiles = [
  "monitor-artifact-consistency-audit-latest.json",
  "desktop-artifact-consistency-audit-latest.json",
  "speaker-artifact-consistency-audit-latest.json",
  "camera-artifact-consistency-audit-latest.json",
  "home-appliance-artifact-consistency-audit-latest.json",
];

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "reports", file), "utf8")) as T;
}

const packets = packetFiles.map((file) => ({ file, ...readJson<Packet>(file) }));
const audits = auditFiles.map((file) => ({ file, ...readJson<Audit>(file) }));
const auditByCategory = new Map(audits.map((audit) => [audit.category, audit]));

const rows = packets.map((packet) => {
  const audit = auditByCategory.get(packet.category);
  return {
    category: packet.category,
    packetFile: packet.file,
    auditFile: audit?.file ?? null,
    auditConclusion: audit?.conclusion ?? "missing_audit",
    auditFailures: audit?.metrics.failures ?? -1,
    runtimeApprovedRows: Number(packet.metrics.runtimeApprovedRows ?? 0),
    candidatePositiveOnlyRows: Number(packet.metrics.candidatePositiveOnlyRows ?? 0),
    nextAction: packet.nextAction ?? "",
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "pass-category fixture expansion rollup",
  metrics: {
    packets: packets.length,
    audits: audits.length,
    auditFailures: rows.reduce((sum, row) => sum + Math.max(row.auditFailures, 0), 0),
    missingAudits: rows.filter((row) => row.auditFailures === -1).length,
    runtimeApprovedRows: rows.reduce((sum, row) => sum + row.runtimeApprovedRows, 0),
    candidatePositiveOnlyRows: rows.reduce((sum, row) => sum + row.candidatePositiveOnlyRows, 0),
  },
  rows,
  ownerReviewItemsStillSeparate: [
    "headphone_discovered: Bose QC45 pouch accessory leak and AirPods Max manual-review policy tension",
    "game_console_body_narrow: Switch 2 manual-review gate",
  ],
  nextQueue: [
    "main-agent review for headphone/game-console runtime patch proposals",
    "official spec source backfill for selected monitor/speaker/home-appliance subsets",
    "desktop CPU/GPU normalization policy draft",
    "camera fixed-lens and interchangeable body/kit taxonomy split",
  ],
  conclusion: "pass_category_expansion_rollup_completed_report_only",
};

const reportsDir = path.join(process.cwd(), "reports");
const jsonPath = path.join(reportsDir, "pass-category-expansion-rollup-latest.json");
const mdPath = path.join(reportsDir, "pass-category-expansion-rollup-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const md = [
  "# Pass Category Expansion Rollup",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- conclusion: ${report.conclusion}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- packets: ${report.metrics.packets}`,
  `- audits: ${report.metrics.audits}`,
  `- auditFailures: ${report.metrics.auditFailures}`,
  `- missingAudits: ${report.metrics.missingAudits}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  `- candidatePositiveOnlyRows: ${report.metrics.candidatePositiveOnlyRows}`,
  "",
  "## Rows",
  "",
  "| category | packet | audit | auditFailures | runtimeApprovedRows | candidatePositiveOnlyRows |",
  "| --- | --- | --- | ---: | ---: | ---: |",
  ...rows.map(
    (row) =>
      `| ${row.category} | ${row.packetFile} | ${row.auditConclusion} | ${row.auditFailures} | ${row.runtimeApprovedRows} | ${row.candidatePositiveOnlyRows} |`,
  ),
  "",
  "## Owner Review Items Still Separate",
  "",
  ...report.ownerReviewItemsStillSeparate.map((line) => `- ${line}`),
  "",
  "## Next Queue",
  "",
  ...report.nextQueue.map((line) => `- ${line}`),
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(
  JSON.stringify(
    {
      conclusion: report.conclusion,
      packets: report.metrics.packets,
      audits: report.metrics.audits,
      auditFailures: report.metrics.auditFailures,
      runtimeApprovedRows: report.metrics.runtimeApprovedRows,
      jsonPath,
      mdPath,
    },
    null,
    2,
  ),
);
