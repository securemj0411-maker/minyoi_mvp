import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type RegistryEntry = {
  file: string;
  decision: string | null;
  family: string | null;
  reportOnly: boolean | null;
};
type Registry = { entries: RegistryEntry[] };

type Manifest = {
  file: string;
  decision: string | null;
  family: string | null;
  reportOnly: boolean | null;
  topMetrics: Record<string, number | string>;
  runtimeApprovedRows: number | null;
};

async function main(): Promise<void> {
  const registry = JSON.parse(
    await readFile(path.join(reportsDir, "smartwatch-packet-registry-latest.json"), "utf8"),
  ) as Registry;

  const manifests: Manifest[] = [];
  for (const entry of registry.entries) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(await readFile(path.join(reportsDir, entry.file), "utf8"));
    } catch {
      continue;
    }
    const metrics = (parsed.metrics ?? {}) as Record<string, unknown>;
    const top: Record<string, number | string> = {};
    const orderedKeys = Object.keys(metrics).slice(0, 6);
    for (const key of orderedKeys) {
      const value = metrics[key];
      if (typeof value === "number" || typeof value === "string") {
        top[key] = value;
      }
    }
    manifests.push({
      file: entry.file,
      decision: entry.decision,
      family: entry.family,
      reportOnly: entry.reportOnly,
      topMetrics: top,
      runtimeApprovedRows: typeof metrics.runtimeApprovedRows === "number"
        ? (metrics.runtimeApprovedRows as number)
        : null,
    });
  }

  const totals = {
    packets: manifests.length,
    runtimeApprovedNonZero: manifests.filter(
      (m) => typeof m.runtimeApprovedRows === "number" && m.runtimeApprovedRows > 0,
    ).length,
    missingRuntimeApprovedField: manifests.filter((m) => m.runtimeApprovedRows === null).length,
    nonReportOnly: manifests.filter((m) => m.reportOnly !== true).length,
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "smartwatch_discovered",
    decision: "smartwatch_packet_manifest_report_only",
    totals,
    manifests,
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "smartwatch-packet-manifest-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Smartwatch Packet Manifest",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only manifest collecting top-line metrics for each smartwatch packet.",
    "",
    "## Totals",
    "",
    ...Object.entries(report.totals).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Manifests",
    "",
    ...manifests.flatMap((m) => [
      `### ${m.file}`,
      "",
      `- decision: ${m.decision ?? "-"}`,
      `- family: ${m.family ?? "-"}`,
      `- reportOnly: ${m.reportOnly ?? "-"}`,
      `- runtimeApprovedRows: ${m.runtimeApprovedRows ?? "-"}`,
      "- topMetrics:",
      ...Object.entries(m.topMetrics).map(([k, v]) => `  - ${k}: ${v}`),
      "",
    ]),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(
    `smartwatch-packet-manifest: packets=${totals.packets}, runtimeApprovedNonZero=${totals.runtimeApprovedNonZero}, nonReportOnly=${totals.nonReportOnly}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
