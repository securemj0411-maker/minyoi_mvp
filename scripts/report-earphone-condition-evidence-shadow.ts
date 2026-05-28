import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { parseEarphoneConditionEvidence, type EarphoneConditionSignal } from "@/lib/condition-evidence/earphone";
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
  title: string;
  source: string | null;
  status: string | null;
  price: number | null;
  expectedProfitMin: number | null;
  expectedProfitMax: number | null;
  comparableKey: string | null;
  signals: EarphoneConditionSignal[];
  evidence: string[];
  currentConditionNotes: string[];
  currentConditionClass: string | null;
  url: string | null;
};

const FUNCTION_ISSUE_SIGNALS = new Set<EarphoneConditionSignal>([
  "audio_output_issue",
  "anc_or_transparency_issue",
  "mic_issue",
  "pairing_or_connection_issue",
  "battery_degraded",
  "physical_damage",
]);

const NOT_FULL_PRODUCT_SIGNALS = new Set<EarphoneConditionSignal>([
  "single_side_unit",
  "charging_case_only",
  "protective_case_only",
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

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
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
    `${tableUrl("mvp_candidate_pool")}?select=${poolSelect}&category=eq.earphone&status=in.(${statuses.join(",")})`,
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
    const evidence = parseEarphoneConditionEvidence({
      title: raw?.name ?? "",
      description: raw?.description_preview ?? "",
    });
    const hardSignals = evidence.hardBlockCandidates;
    const functionIssue = hardSignals.some((signal) => FUNCTION_ISSUE_SIGNALS.has(signal));
    const notFullProduct = hardSignals.some((signal) => NOT_FULL_PRODUCT_SIGNALS.has(signal));
    const warningOnly = hardSignals.length === 0 && evidence.warningSignals.length > 0;
    return {
      pool,
      raw,
      parsed,
      evidence,
      hardSignals,
      functionIssue,
      notFullProduct,
      warningOnly,
    };
  });

  const hardRows = analyzed.filter((row) => row.hardSignals.length > 0);
  const functionRows = analyzed.filter((row) => row.functionIssue);
  const notFullRows = analyzed.filter((row) => row.notFullProduct);
  const warningOnlyRows = analyzed.filter((row) => row.warningOnly);
  const existingBlockNoteRows = analyzed.filter((row) => {
    const notes = row.parsed?.condition_notes ?? [];
    return notes.some((note) => ["single_side_only", "parts_only", "repair_or_defect_signal"].includes(note));
  });

  const sampleRows: SampleRow[] = hardRows
    .map((row) => ({
      pid: Number(row.pool.pid),
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
    pid: row.pool.pid,
  })));

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    supabaseMutation: false,
    candidatePoolMutation: false,
    category: "earphone",
    scope: {
      statuses,
      limit,
      poolRows: poolRows.length,
    },
    metrics: {
      poolRows: poolRows.length,
      hardCandidateRows: hardRows.length,
      hardCandidateRate: pct(hardRows.length, poolRows.length),
      functionIssueRows: functionRows.length,
      functionIssueRate: pct(functionRows.length, poolRows.length),
      notFullProductRows: notFullRows.length,
      notFullProductRate: pct(notFullRows.length, poolRows.length),
      warningOnlyRows: warningOnlyRows.length,
      warningOnlyRate: pct(warningOnlyRows.length, poolRows.length),
      existingBlockNoteRows: existingBlockNoteRows.length,
      newShadowOnlyHardRows: hardRows.length - existingBlockNoteRows.length,
    },
    bySignal: countBy(allSignalRows, (row) => row.signal),
    byHardSignal: countBy(hardRows.flatMap((row) => row.hardSignals.map((signal) => ({ signal }))), (row) => row.signal),
    bySource: countBy(analyzed, (row) => row.raw?.source ?? row.raw?.seller_source),
    hardBySource: countBy(hardRows, (row) => row.raw?.source ?? row.raw?.seller_source),
    statusCounts: countBy(poolRows, (row) => row.status),
    samples: sampleRows.slice(0, 30),
    samplesBySignal: signalSamples(sampleRows, 5),
    recommendation: [
      "Keep parser in shadow_only until hardCandidate samples are reviewed.",
      "not_full_product signals can become first gate candidates if samples remain precise.",
      "function_issue signals should require at least one manual sample pass before pool invalidation.",
      "warning signals should not block ready; use them for UX/checklist or future price adjustment.",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "earphone-condition-evidence-shadow-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const metricsTable = mdTable(
    ["metric", "value"],
    Object.entries(report.metrics),
  );
  const hardSignalTable = mdTable(
    ["signal", "count"],
    report.byHardSignal.map((row) => [row.key, row.count]),
  );
  const sampleTable = mdTable(
    ["pid", "source", "title", "price", "profit", "signals", "evidence"],
    sampleRows.slice(0, 20).map((row) => [
      row.pid,
      row.source ?? "",
      row.title,
      row.price ?? "",
      `${row.expectedProfitMin ?? ""}~${row.expectedProfitMax ?? ""}`,
      row.signals.join(", "),
      row.evidence.join("<br>"),
    ]),
  );
  const md = [
    "# Earphone Condition Evidence Shadow Report",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "No-write report. Applies local earphone condition evidence parser to current candidate_pool earphone rows.",
    "",
    "## Metrics",
    "",
    metricsTable,
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
  await writeFile(path.join(reportsDir, "earphone-condition-evidence-shadow-latest.md"), `${md}\n`);

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    poolRows: report.metrics.poolRows,
    hardCandidateRows: report.metrics.hardCandidateRows,
    functionIssueRows: report.metrics.functionIssueRows,
    notFullProductRows: report.metrics.notFullProductRows,
    warningOnlyRows: report.metrics.warningOnlyRows,
    byHardSignal: report.byHardSignal,
    reportJson: "reports/earphone-condition-evidence-shadow-latest.json",
    reportMd: "reports/earphone-condition-evidence-shadow-latest.md",
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
