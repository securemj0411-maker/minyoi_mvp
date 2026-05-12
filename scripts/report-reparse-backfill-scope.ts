import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { classifyListing } from "../src/lib/pipeline";

type PoolRow = {
  pid: number;
  status: string | null;
  profit_band: number | null;
  category: string | null;
  expected_profit_min: number | null;
  expected_profit_max: number | null;
  confidence: number | null;
};

type RawRow = {
  pid: number;
  name: string | null;
  description_preview: string | null;
  price: number | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  sale_status: string | null;
  last_seen_at: string | null;
};

type AnalysisRow = {
  pid: number;
  score_flags: string[] | null;
  risk_hits: number | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function chunks<T>(rows: T[], size: number) {
  const output: T[][] = [];
  for (let i = 0; i < rows.length; i += size) output.push(rows.slice(i, i + size));
  return output;
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compact(value: unknown, length = 78) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const generatedAt = new Date().toISOString();
  const pool = await restJson<PoolRow[]>(
    "/mvp_candidate_pool?select=pid,status,profit_band,category,expected_profit_min,expected_profit_max,confidence&status=in.(ready,reserved,invalidated)&limit=5000",
  );
  const pids = [...new Set(pool.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawMap = new Map<number, RawRow>();
  const analysisMap = new Map<number, AnalysisRow>();

  for (const chunk of chunks(pids, 180)) {
    const ids = chunk.join(",");
    const [rawRows, analysisRows] = await Promise.all([
      restJson<RawRow[]>(
        `/mvp_raw_listings?select=pid,name,description_preview,price,listing_type,sku_id,sku_name,sale_status,last_seen_at&pid=in.(${ids})`,
      ),
      restJson<AnalysisRow[]>(`/mvp_listing_analysis?select=pid,score_flags,risk_hits&pid=in.(${ids})`),
    ]);
    for (const row of rawRows) rawMap.set(Number(row.pid), row);
    for (const row of analysisRows) analysisMap.set(Number(row.pid), row);
  }

  const rows = pool.map((poolRow) => {
    const pid = Number(poolRow.pid);
    const raw = rawMap.get(pid);
    const analysis = analysisMap.get(pid);
    const next = raw
      ? classifyListing(raw.name ?? "", raw.description_preview ?? "", Number(raw.price ?? 0))
      : { listingType: "unknown" as const, sku: null };
    const currentType = raw?.listing_type ?? "missing_raw";
    const nextType = next.listingType;
    const currentSku = raw?.sku_id ?? null;
    const nextSku = next.sku?.id ?? null;
    const active = poolRow.status === "ready" || poolRow.status === "reserved";
    const action =
      !raw ? "hold_missing_raw" :
      !active && nextType !== "normal" ? "already_inactive_reparse_needed" :
      nextType !== "normal" ? "invalidate_active_pool" :
      currentType !== nextType || currentSku !== nextSku ? "reparse_refresh_outputs" :
      "keep";
    const reason =
      !raw ? "raw_missing" :
      nextType !== "normal" ? `new_type_${nextType}` :
      currentSku !== nextSku ? "sku_changed" :
      currentType !== nextType ? "type_changed" :
      "unchanged";

    return {
      pid,
      action,
      reason,
      currentType,
      nextType,
      currentSku,
      nextSku,
      title: raw?.name ?? null,
      descriptionPreview: raw?.description_preview ?? null,
      price: raw?.price ?? null,
      saleStatus: raw?.sale_status ?? null,
      band: poolRow.profit_band,
      status: poolRow.status,
      category: poolRow.category,
      profitMax: poolRow.expected_profit_max,
      scoreFlags: analysis?.score_flags ?? [],
      riskHits: analysis?.risk_hits ?? 0,
    };
  });

  const actionRows = countBy(rows, (row) => row.action);
  const reasonRows = countBy(rows, (row) => row.reason);
  const invalidationExamples = rows
    .filter((row) => row.action !== "keep")
    .sort((a, b) => Number(b.profitMax ?? 0) - Number(a.profitMax ?? 0))
    .slice(0, 40);
  const activeInvalidationRows = rows
    .filter((row) => row.action === "invalidate_active_pool")
    .sort((a, b) => Number(b.profitMax ?? 0) - Number(a.profitMax ?? 0));
  const reparseRefreshRows = rows
    .filter((row) => row.action === "reparse_refresh_outputs")
    .sort((a, b) => Number(b.profitMax ?? 0) - Number(a.profitMax ?? 0));
  const targetPid = rows.find((row) => row.pid === 403398925) ?? null;

  const report = {
    summary: {
      generatedAt,
      auditedPoolRows: rows.length,
      activePoolRows: rows.filter((row) => row.status === "ready" || row.status === "reserved").length,
      inactivePoolRows: rows.filter((row) => row.status === "invalidated").length,
      keepRows: rows.filter((row) => row.action === "keep").length,
      invalidateRows: rows.filter((row) => row.action === "invalidate_active_pool").length,
      reparseRefreshRows: rows.filter((row) => row.action === "reparse_refresh_outputs").length,
      alreadyInactiveReparseRows: rows.filter((row) => row.action === "already_inactive_reparse_needed").length,
      holdMissingRawRows: rows.filter((row) => row.action === "hold_missing_raw").length,
      targetPid403398925Action: targetPid?.action ?? null,
      targetPid403398925NextType: targetPid?.nextType ?? null,
    },
    actionRows,
    reasonRows,
    activeInvalidationRows,
    reparseRefreshRows,
    invalidationExamples,
    targetPid,
  };

  const markdown = [
    "# Reparse / Backfill Scope Dry-run",
    "",
    `- generated_at: ${generatedAt}`,
    "- mode: read_only_no_mutation",
    "- scope: mvp_candidate_pool ready/reserved/invalidated rows; active rows are the only immediate invalidation candidates",
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(report.summary).map(([key, value]) => [key, value])),
    "",
    "## Actions",
    "",
    table(["action", "count"], actionRows.map((row) => [row.name, row.count])),
    "",
    "## Reasons",
    "",
    table(["reason", "count"], reasonRows.map((row) => [row.name, row.count])),
    "",
    "## Active Invalidation Candidates",
    "",
    activeInvalidationRows.length > 0
      ? table(
          ["pid", "reason", "type", "sku", "band", "profit_max", "title", "desc"],
          activeInvalidationRows.map((row) => [
            row.pid,
            row.reason,
            `${row.currentType} -> ${row.nextType}`,
            `${row.currentSku ?? "-"} -> ${row.nextSku ?? "-"}`,
            row.band,
            row.profitMax,
            compact(row.title),
            compact(row.descriptionPreview, 120),
          ]),
        )
      : "- none",
    "",
    "## Non-keep Examples",
    "",
    table(
    ["pid", "status", "action", "reason", "type", "sku", "band", "profit_max", "flags", "title", "desc"],
      invalidationExamples.map((row) => [
        row.pid,
        row.status,
        row.action,
        row.reason,
        `${row.currentType} -> ${row.nextType}`,
        `${row.currentSku ?? "-"} -> ${row.nextSku ?? "-"}`,
        row.band,
        row.profitMax,
        row.scoreFlags.slice(0, 4).join(", "),
        compact(row.title),
        compact(row.descriptionPreview, 90),
      ]),
    ),
    "",
    "## Decision",
    "",
    "- 이 리포트는 기존 후보풀을 수정하지 않는다.",
    "- `invalidate_active_pool` 행은 새 런타임 분류 기준으로 normal이 아니므로, 다음 적용 단계에서 raw reclassify 후 candidate_pool invalidation 대상으로 삼는다.",
    "- `reparse_refresh_outputs` 행은 normal 유지지만 SKU/분류 출력이 달라질 수 있으므로 소량 reparse 대상이다.",
    "",
  ].join("\n");

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "reparse-backfill-scope-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "reparse-backfill-scope-latest.md"), markdown);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
