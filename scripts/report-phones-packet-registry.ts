import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

type Entry = {
  file: string;
  generatedAt: string | null;
  decision: string | null;
  category: string | null;
  family: string | null;
  reportOnly: boolean | null;
  publicPromotion: boolean | null;
  runtimeCatalogApply: boolean | null;
  candidatePoolPolicyWiring: boolean | null;
  hasMd: boolean;
};

async function main(): Promise<void> {
  const files = await readdir(reportsDir);
  const jsonFiles = files
    .filter((f) => f.startsWith("phones-") && f.endsWith("-latest.json"))
    .sort();
  const mdSet = new Set(files.filter((f) => f.startsWith("phones-") && f.endsWith("-latest.md")));

  const entries: Entry[] = [];
  for (const file of jsonFiles) {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(await readFile(path.join(reportsDir, file), "utf8"));
    } catch {
      // skip
    }
    const stem = file.replace(/\.json$/, "");
    entries.push({
      file,
      generatedAt: (parsed.generatedAt as string) ?? null,
      decision: (parsed.decision as string) ?? null,
      category: (parsed.category as string) ?? null,
      family: (parsed.family as string) ?? null,
      reportOnly: typeof parsed.reportOnly === "boolean" ? (parsed.reportOnly as boolean) : null,
      publicPromotion: typeof parsed.publicPromotion === "boolean" ? (parsed.publicPromotion as boolean) : null,
      runtimeCatalogApply:
        typeof parsed.runtimeCatalogApply === "boolean" ? (parsed.runtimeCatalogApply as boolean) : null,
      candidatePoolPolicyWiring:
        typeof parsed.candidatePoolPolicyWiring === "boolean" ? (parsed.candidatePoolPolicyWiring as boolean) : null,
      hasMd: mdSet.has(`${stem}.md`),
    });
  }

  const byFamily = new Map<string, number>();
  for (const e of entries) {
    const k = e.family ?? "_unspecified";
    byFamily.set(k, (byFamily.get(k) ?? 0) + 1);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "phones_discovered",
    decision: "phones_packet_registry_report_only",
    totals: {
      packets: entries.length,
      withMdPair: entries.filter((e) => e.hasMd).length,
      withReportOnlyTrue: entries.filter((e) => e.reportOnly === true).length,
      missingFlags: entries.filter(
        (e) =>
          e.reportOnly === null ||
          e.publicPromotion === null ||
          e.runtimeCatalogApply === null ||
          e.candidatePoolPolicyWiring === null,
      ).length,
    },
    byFamily: Object.fromEntries([...byFamily.entries()].sort()),
    entries,
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "phones-packet-registry-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Phones Packet Registry",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only registry of all phones-* packets currently produced under reports/.",
    "",
    "## Totals",
    "",
    ...Object.entries(report.totals).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## By Family",
    "",
    ...Object.entries(report.byFamily).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Entries",
    "",
    "| file | family | reportOnly | publicPromotion | runtimeCatalogApply | candidatePoolPolicyWiring | hasMd |",
    "|---|---|---|---|---|---|---|",
    ...entries.map(
      (e) =>
        `| ${e.file} | ${e.family ?? "-"} | ${e.reportOnly ?? "-"} | ${e.publicPromotion ?? "-"} | ${e.runtimeCatalogApply ?? "-"} | ${e.candidatePoolPolicyWiring ?? "-"} | ${e.hasMd} |`,
    ),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`phones-packet-registry: packets=${report.totals.packets}, missingFlags=${report.totals.missingFlags}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
