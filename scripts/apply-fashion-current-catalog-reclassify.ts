import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const CHUNK_SIZE = 80;

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  condition_tier: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
};

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  price: number | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
};

async function loadEnvFile(filePath: string) {
  try {
    const raw = await readFile(filePath, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...rest] = trimmed.split("=");
      const value = rest.join("=").trim().replace(/^["']|["']$/g, "");
      process.env[key] ??= value;
    }
  } catch {
    // Optional local env file.
  }
}

function arg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inList(nums: number[]) {
  return `(${nums.join(",")})`;
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const res = await restFetch(url, { headers: serviceHeaders() });
  return (await res.json()) as T[];
}

async function fetchParsedByComparableKeys(keys: string[], limitPerKey: number) {
  const rows: ParsedRow[] = [];
  for (const key of keys) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_tier,needs_review,parse_confidence&comparable_key=eq.${encodeURIComponent(key)}&needs_review=eq.false&parse_confidence=gte.0.65&limit=${limitPerKey}`,
    ));
  }
  return rows;
}

async function fetchParsedByPids(pids: number[]) {
  const rows: ParsedRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<ParsedRow>(
      `${tableUrl("mvp_listing_parsed")}?select=pid,comparable_key,condition_tier,needs_review,parse_confidence&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function fetchRawRows(pids: number[]) {
  const rows: RawRow[] = [];
  for (const part of chunk([...new Set(pids)], 200)) {
    rows.push(...await fetchJson<RawRow>(
      `${tableUrl("mvp_raw_listings")}?select=pid,sku_id,sku_name,name,price,description_preview,bunjang_condition_label&pid=in.${inList(part)}&limit=${part.length}`,
    ));
  }
  return rows;
}

async function upsertParsed(rows: Record<string, unknown>[]) {
  for (const part of chunk(rows, CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(part),
    });
  }
}

async function patchParsedRejected(pids: number[], reason: string) {
  for (const part of chunk(pids, CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        comparable_key: null,
        needs_review: true,
        parse_confidence: 0.45,
        parser_version: reason,
      }),
    });
  }
}

async function patchRawRows(rows: Array<{ pid: number; skuId: string | null; skuName: string | null }>) {
  for (const row of rows) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${row.pid}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        sku_id: row.skuId,
        sku_name: row.skuName,
        score_dirty: true,
        ...(row.skuId ? {} : { pool_eligible: false }),
      }),
    });
  }
}

async function invalidatePool(pids: number[], reason: string) {
  const updatedAt = new Date().toISOString();
  for (const part of chunk(pids, CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_candidate_pool")}?pid=in.${inList(part)}&status=in.(ready,reserved)`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        status: "invalidated",
        invalidated_reason: reason.slice(0, 120),
        reserved_until: null,
        updated_at: updatedAt,
      }),
    });
  }
}

function normConditionTier(value: string | null | undefined) {
  const v = value?.trim().toLowerCase();
  if (!v) return null;
  if (v === "s" || v === "s_grade") return "S";
  if (v === "a" || v === "a_grade") return "A";
  if (v === "b" || v === "b_grade") return "B";
  if (v === "c" || v === "c_grade") return "C";
  if (v === "d" || v === "reject") return "D";
  if (v === "unknown" || v === "unknown_condition") return "UNKNOWN";
  return value;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const reason = arg("reason", "wave802_current_catalog_reclassify").slice(0, 120);
  const keys = arg("comparable-keys", "").split(";;").map((item) => item.trim()).filter(Boolean);
  const pidsArg = arg("pids", "").split(",").map((item) => Number(item.trim())).filter(Number.isFinite);
  const limitPerKey = Number(arg("limit-per-key", "80"));
  const reportLimit = Number(arg("report-limit", "80"));

  const parsedRows = [
    ...await fetchParsedByComparableKeys(keys, limitPerKey),
    ...await fetchParsedByPids(pidsArg),
  ];
  const pids = [...new Set(parsedRows.map((row) => Number(row.pid)).filter(Number.isFinite))];
  const rawRows = await fetchRawRows(pids);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map<number, ParsedRow>();
  for (const row of parsedRows) {
    const pid = Number(row.pid);
    const existing = parsedByPid.get(pid);
    if (!existing || (!existing.comparable_key && row.comparable_key)) {
      parsedByPid.set(pid, row);
    }
  }

  const candidates = pids.map((pid) => {
    const raw = rawByPid.get(pid);
    const storedParsed = parsedByPid.get(pid);
    const current = raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "") : null;
    if (!raw) return null;
    const parsed = current ? parseListingOptions({
      title: raw.name ?? "",
      description: raw.description_preview ?? "",
      skuId: current.id,
      skuName: current.modelName,
      category: current.category,
      bunjangConditionLabel: raw.bunjang_condition_label,
      defaultProductType: current.defaultProductType ?? null,
    }) : null;
    const parsedRow = parsed ? toParsedListingRow(pid, parsed) : null;
    const currentTier = parsedRow?.condition_tier ? String(parsedRow.condition_tier) : null;
    if ((current?.id ?? null) === (raw.sku_id ?? null)) {
      if (!current && storedParsed?.comparable_key) {
        return {
          pid,
          title: raw.name,
          price: raw.price,
          oldSkuId: raw.sku_id,
          currentSkuId: null,
          currentKey: null,
          oldTier: storedParsed?.condition_tier ?? null,
          currentTier: null,
          action: "reject_current_catalog",
          parsedRow: null,
          rawPatch: null,
        };
      }
      if (
        !parsed ||
        (
          storedParsed?.comparable_key === parsed.comparableKey &&
          normConditionTier(storedParsed?.condition_tier) === normConditionTier(currentTier)
        )
      ) return null;
      return {
        pid,
        title: raw.name,
        price: raw.price,
        oldSkuId: raw.sku_id,
        currentSkuId: current?.id ?? null,
        currentKey: parsed.comparableKey,
        oldTier: storedParsed?.condition_tier ?? null,
        currentTier,
        action: "refresh_parsed_key",
        parsedRow,
        rawPatch: null,
      };
    }
    return {
      pid,
      title: raw.name,
      price: raw.price,
      oldSkuId: raw.sku_id,
      currentSkuId: current?.id ?? null,
      currentKey: parsed?.comparableKey ?? null,
      oldTier: storedParsed?.condition_tier ?? null,
      currentTier,
      action: current ? "reclassify" : "reject_current_catalog",
      parsedRow: current && parsed ? parsedRow : null,
      rawPatch: { pid, skuId: current?.id ?? null, skuName: current?.modelName ?? null },
    };
  }).filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (apply) {
    await patchRawRows(candidates.map((row) => row.rawPatch).filter((row): row is NonNullable<typeof row> => Boolean(row)));
    await upsertParsed(candidates.map((row) => row.parsedRow).filter((row): row is NonNullable<typeof row> => Boolean(row)));
    await patchParsedRejected(candidates.filter((row) => row.action === "reject_current_catalog").map((row) => row.pid), reason);
    await invalidatePool(candidates.map((row) => row.pid), reason);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    reason,
    scope: { comparableKeys: keys, pids: pidsArg, limitPerKey },
    totals: {
      scannedParsedRows: parsedRows.length,
      rawRows: rawRows.length,
      candidateRows: candidates.length,
      reclassifyRows: candidates.filter((row) => row.action === "reclassify").length,
      refreshParsedRows: candidates.filter((row) => row.action === "refresh_parsed_key").length,
      rejectRows: candidates.filter((row) => row.action === "reject_current_catalog").length,
    },
    samples: candidates.slice(0, Math.max(0, reportLimit)).map(({ parsedRow: _parsedRow, rawPatch: _rawPatch, ...row }) => row),
  };

  const jsonPath = path.join(reportsDir, "fashion-current-catalog-reclassify-latest.json");
  const mdPath = path.join(reportsDir, "fashion-current-catalog-reclassify-latest.md");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Fashion Current Catalog Reclassify",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    ...Object.entries(report.totals).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Samples",
    ...report.samples.map((row) => `- pid ${row.pid}: ${row.title} / ${row.oldSkuId} -> ${row.currentSkuId ?? "null"} / key=${row.currentKey ?? "null"} / tier=${row.oldTier ?? "null"}->${row.currentTier ?? "null"} / ${row.action}`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({ jsonPath, mdPath, totals: report.totals }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
