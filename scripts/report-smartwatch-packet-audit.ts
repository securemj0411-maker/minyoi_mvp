import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type RegistryEntry = {
  file: string;
  decision: string | null;
  family: string | null;
  reportOnly: boolean | null;
  publicPromotion: boolean | null;
  runtimeCatalogApply: boolean | null;
  candidatePoolPolicyWiring: boolean | null;
  hasMd: boolean;
};
type Registry = { entries: RegistryEntry[] };

type Finding = {
  severity: "hard" | "soft";
  file: string;
  rule: string;
  detail: string;
};

async function main(): Promise<void> {
  const registry = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-packet-registry-latest.json"), "utf8"),
  ) as Registry;

  const findings: Finding[] = [];
  const decisionSeen = new Map<string, string[]>();

  for (const entry of registry.entries) {
    // hard: must be report-only
    if (entry.reportOnly !== true) {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "report_only_flag_required",
        detail: `reportOnly=${entry.reportOnly}. every smartwatch packet must declare reportOnly=true.`,
      });
    }
    if (entry.publicPromotion !== false) {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "public_promotion_must_be_false",
        detail: `publicPromotion=${entry.publicPromotion}.`,
      });
    }
    if (entry.runtimeCatalogApply !== false) {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "runtime_catalog_apply_must_be_false",
        detail: `runtimeCatalogApply=${entry.runtimeCatalogApply}.`,
      });
    }
    if (entry.candidatePoolPolicyWiring !== false) {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "candidate_pool_policy_wiring_must_be_false",
        detail: `candidatePoolPolicyWiring=${entry.candidatePoolPolicyWiring}.`,
      });
    }
    // soft: md pair
    if (!entry.hasMd) {
      findings.push({
        severity: "soft",
        file: entry.file,
        rule: "md_pair_missing",
        detail: "json present without md pair.",
      });
    }
    // check runtimeApprovedRows = 0 in metrics
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(await readFile(path.join(reportsDir, entry.file), "utf8"));
    } catch {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "invalid_json",
        detail: "cannot parse json content.",
      });
      continue;
    }
    const metrics = (parsed.metrics ?? {}) as Record<string, unknown>;
    if (typeof metrics.runtimeApprovedRows === "number" && metrics.runtimeApprovedRows !== 0) {
      findings.push({
        severity: "hard",
        file: entry.file,
        rule: "runtime_approved_rows_must_be_zero",
        detail: `runtimeApprovedRows=${metrics.runtimeApprovedRows}.`,
      });
    }
    // decision collision check
    if (entry.decision) {
      const list = decisionSeen.get(entry.decision) ?? [];
      list.push(entry.file);
      decisionSeen.set(entry.decision, list);
    } else {
      findings.push({
        severity: "soft",
        file: entry.file,
        rule: "decision_field_missing",
        detail: "no decision string on this packet.",
      });
    }
  }

  for (const [decision, files] of decisionSeen.entries()) {
    if (files.length > 1) {
      findings.push({
        severity: "soft",
        file: files.join(", "),
        rule: "decision_collision",
        detail: `decision='${decision}' reused across ${files.length} files.`,
      });
    }
  }

  const hardCount = findings.filter((f) => f.severity === "hard").length;
  const softCount = findings.filter((f) => f.severity === "soft").length;

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    decision: "smartwatch_packet_audit_report_only",
    totals: {
      packets: registry.entries.length,
      hardFindings: hardCount,
      softFindings: softCount,
      pass: hardCount === 0,
    },
    findings,
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "smartwatch-packet-audit-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Packet Audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only audit checking report-only invariants across all smartwatch packets.",
    "",
    "## Totals",
    "",
    ...Object.entries(report.totals).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Findings",
    "",
    findings.length === 0
      ? "- none"
      : findings.map((f) => `- [${f.severity}] ${f.file} :: ${f.rule} — ${f.detail}`).join("\n"),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(
    `smartwatch-packet-audit: packets=${report.totals.packets}, hard=${hardCount}, soft=${softCount}, pass=${report.totals.pass}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
