import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseTechDeviceConditionEvidence, type TechDeviceConditionSignal } from "@/lib/condition-evidence/tech-device";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

type PoolRow = {
  pid: number;
  status: string | null;
  category: string | null;
  comparable_key: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  profit_band: number | null;
  confidence: number | null;
  condition_class: string | null;
  last_verified_at: string | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  price: number | null;
  source: string | null;
  seller_source: string | null;
  sale_status: string | null;
  listing_state: string | null;
  description_preview: string | null;
  last_seen_at: string | null;
  url: string | null;
};

type ParsedRow = {
  pid: number;
  condition_notes: string[] | null;
  condition_class: string | null;
  parsed_json: Record<string, unknown> | null;
};

type SampleRow = {
  pid: number;
  category: string | null;
  title: string;
  source: string | null;
  status: string | null;
  price: number | null;
  expectedProfitMin: number | null;
  expectedProfitMax: number | null;
  comparableKey: string | null;
  signals: TechDeviceConditionSignal[];
  evidence: string[];
  currentConditionNotes: string[];
  currentConditionClass: string | null;
  url: string | null;
};

const EXISTING_TECH_BLOCK_NOTES = new Set([
  "display_defect",
  "screen_replaced",
  "faceid_issue",
  "parts_only",
]);

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      process.env[key] ??= rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inList(values: Array<number | string>) {
  return `(${values.join(",")})`;
}

async function restJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchAll<T>(baseUrl: string, limit: number, orderBy: string) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset);
    const sep = baseUrl.includes("?") ? "&" : "?";
    const page = await restJson<T>(`${baseUrl}${sep}order=${encodeURIComponent(orderBy)}&limit=${pageLimit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < pageLimit) break;
  }
  return rows;
}

function countBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = keyFn(row) || "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function mdTable(headers: string[], rows: unknown[][]) {
  const clean = (value: unknown) => String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  return [
    `| ${headers.map(clean).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(clean).join(" | ")} |`),
  ].join("\n");
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  const select = [
    "pid",
    "name",
    "price",
    "source",
    "seller_source",
    "sale_status",
    "listing_state",
    "description_preview",
    "last_seen_at",
    "url",
  ].join(",");
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchParsedRows(pids: number[]) {
  const rows: ParsedRow[] = [];
  const select = "pid,condition_notes,condition_class,parsed_json";
  for (const part of chunk([...new Set(pids)], 400)) {
    rows.push(...await restJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=${select}&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

function signalSamples(rows: SampleRow[], limitPerSignal: number) {
  const bySignal: Record<string, SampleRow[]> = {};
  for (const row of rows) {
    for (const signal of row.signals) {
      const current = bySignal[signal] ?? [];
      if (current.length < limitPerSignal) {
        current.push(row);
        bySignal[signal] = current;
      }
    }
  }
  return bySignal;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));

  const limit = Number(arg("limit", "5000"));
  const statuses = arg("statuses", "ready,reserved").split(",").map((item) => item.trim()).filter(Boolean);
  const categories = arg("categories", "smartphone,tablet,smartwatch").split(",").map((item) => item.trim()).filter(Boolean);
  const poolSelect = [
    "pid",
    "status",
    "category",
    "comparable_key",
    "expected_profit_min",
    "expected_profit_max",
    "profit_band",
    "confidence",
    "condition_class",
    "last_verified_at",
  ].join(",");

  const poolRows = await fetchAll<PoolRow>(
    `${tableUrl("mvp_candidate_pool")}?select=${poolSelect}&category=in.${inList(categories)}&status=in.${inList(statuses)}`,
    limit,
    "last_verified_at.desc.nullslast",
  );
  const pids = poolRows.map((row) => Number(row.pid)).filter((pid) => Number.isFinite(pid));
  const [rawRows, parsedRows] = await Promise.all([
    fetchRawRows(pids),
    fetchParsedRows(pids),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));

  const analyzed = poolRows.map((pool) => {
    const raw = rawByPid.get(Number(pool.pid));
    const parsed = parsedByPid.get(Number(pool.pid));
    const evidence = parseTechDeviceConditionEvidence({
      title: raw?.name ?? "",
      description: raw?.description_preview ?? "",
    });
    const hardSignals = evidence.hardBlockCandidates;
    const warningOnly = hardSignals.length === 0 && evidence.warningSignals.length > 0;
    const existingBlockNotes = (parsed?.condition_notes ?? []).filter((note) => EXISTING_TECH_BLOCK_NOTES.has(note));
    return {
      pool,
      raw,
      parsed,
      evidence,
      hardSignals,
      warningOnly,
      existingBlockNotes,
    };
  });

  const hardRows = analyzed.filter((row) => row.hardSignals.length > 0);
  const warningOnlyRows = analyzed.filter((row) => row.warningOnly);
  const existingBlockNoteRows = analyzed.filter((row) => row.existingBlockNotes.length > 0);
  const newEvidenceOnlyRows = hardRows.filter((row) => row.existingBlockNotes.length === 0);

  const sampleRows: SampleRow[] = hardRows
    .map((row) => ({
      pid: Number(row.pool.pid),
      category: row.pool.category,
      title: row.raw?.name ?? "",
      source: row.raw?.source ?? row.raw?.seller_source ?? null,
      status: row.pool.status,
      price: row.raw?.price ?? null,
      expectedProfitMin: row.pool.expected_profit_min,
      expectedProfitMax: row.pool.expected_profit_max,
      comparableKey: row.pool.comparable_key,
      signals: row.hardSignals,
      evidence: row.evidence.facts
        .filter((fact) => row.hardSignals.includes(fact.signal))
        .map((fact) => `${fact.signal}: ${fact.evidence}`),
      currentConditionNotes: row.parsed?.condition_notes ?? [],
      currentConditionClass: row.parsed?.condition_class ?? row.pool.condition_class ?? null,
      url: row.raw?.url ?? null,
    }))
    .sort((a, b) => (b.expectedProfitMax ?? 0) - (a.expectedProfitMax ?? 0));

  const allSignalRows = analyzed.flatMap((row) => row.evidence.signals.map((signal) => ({
    signal,
    status: row.pool.status,
    source: row.raw?.source ?? row.raw?.seller_source ?? null,
    category: row.pool.category,
    pid: row.pool.pid,
  })));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    supabaseMutation: false,
    candidatePoolMutation: false,
    categoryGroup: "tech_device",
    scope: {
      categories,
      statuses,
      limit,
      poolRows: poolRows.length,
    },
    metrics: {
      poolRows: poolRows.length,
      hardCandidateRows: hardRows.length,
      hardCandidateRate: pct(hardRows.length, poolRows.length),
      warningOnlyRows: warningOnlyRows.length,
      warningOnlyRate: pct(warningOnlyRows.length, poolRows.length),
      existingBlockNoteRows: existingBlockNoteRows.length,
      newEvidenceOnlyHardRows: newEvidenceOnlyRows.length,
      newEvidenceOnlyHardRate: pct(newEvidenceOnlyRows.length, poolRows.length),
    },
    byCategory: countBy(analyzed, (row) => row.pool.category),
    hardByCategory: countBy(hardRows, (row) => row.pool.category),
    warningByCategory: countBy(warningOnlyRows, (row) => row.pool.category),
    bySignal: countBy(allSignalRows, (row) => row.signal),
    byHardSignal: countBy(hardRows.flatMap((row) => row.hardSignals.map((signal) => ({ signal }))), (row) => row.signal),
    bySource: countBy(analyzed, (row) => row.raw?.source ?? row.raw?.seller_source),
    hardBySource: countBy(hardRows, (row) => row.raw?.source ?? row.raw?.seller_source),
    statusCounts: countBy(poolRows, (row) => row.status),
    samples: sampleRows.slice(0, 40),
    newEvidenceOnlySamples: sampleRows
      .filter((row) => newEvidenceOnlyRows.some((candidate) => Number(candidate.pool.pid) === row.pid))
      .slice(0, 25),
    samplesBySignal: signalSamples(sampleRows, 5),
    recommendation: [
      "Keep tech-device parser report-only until newEvidenceOnly samples are reviewed.",
      "Existing condition_notes already block display/screen/faceid/parts paths; newEvidenceOnlyHardRows measures the incremental gap.",
      "Battery low/cycles should stay warning/price-adjustment first, not pool hard-block.",
      "If precision holds, add parsed_json.tech_device_condition_* shadow fields before any pool gate.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "tech-device-condition-evidence-sweep-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const metricsTable = mdTable(["metric", "value"], Object.entries(report.metrics));
  const hardSignalTable = mdTable(["signal", "count"], report.byHardSignal.map((row) => [row.key, row.count]));
  const categoryTable = mdTable(["category", "all", "hard"], report.byCategory.map((row) => [
    row.key,
    row.count,
    report.hardByCategory.find((hard) => hard.key === row.key)?.count ?? 0,
  ]));
  const sampleTable = mdTable(
    ["pid", "category", "source", "title", "price", "profit", "signals", "evidence"],
    sampleRows.slice(0, 25).map((row) => [
      row.pid,
      row.category ?? "",
      row.source ?? "",
      row.title,
      row.price ?? "",
      `${row.expectedProfitMin ?? ""}~${row.expectedProfitMax ?? ""}`,
      row.signals.join(", "),
      row.evidence.join("<br>"),
    ]),
  );
  const md = [
    "# Tech Device Condition Evidence Sweep",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "No-write report. Applies local tech-device condition evidence parser to current candidate_pool smartphone/tablet/smartwatch rows.",
    "",
    "## Metrics",
    "",
    metricsTable,
    "",
    "## Category",
    "",
    categoryTable,
    "",
    "## Hard Candidate Signals",
    "",
    hardSignalTable,
    "",
    "## Top Samples",
    "",
    sampleTable,
    "",
    "## Recommendation",
    "",
    ...report.recommendation.map((line) => `- ${line}`),
  ].join("\n");
  await writeFile(path.join(reportsDir, "tech-device-condition-evidence-sweep-latest.md"), `${md}\n`);

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    poolRows: report.metrics.poolRows,
    hardCandidateRows: report.metrics.hardCandidateRows,
    newEvidenceOnlyHardRows: report.metrics.newEvidenceOnlyHardRows,
    warningOnlyRows: report.metrics.warningOnlyRows,
    byHardSignal: report.byHardSignal,
    hardByCategory: report.hardByCategory,
    reportJson: "reports/tech-device-condition-evidence-sweep-latest.json",
    reportMd: "reports/tech-device-condition-evidence-sweep-latest.md",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

