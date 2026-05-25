import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { evaluatePoolGate } from "@/lib/candidate-pool-builder";
import { ruleMatch, type Sku } from "@/lib/catalog";
import { CATEGORY_READINESS, LANE_READINESS } from "@/lib/category-readiness";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");
const REASON = "wave809_shoe_sku_safety_cleanup";
const PATCH_CHUNK_SIZE = 80;

const SAMPLE_POLLUTION_PIDS = [
  313222239, // ADER x Converse cap
  337638060, // MM6 x Salomon cap
  341571740, // BAPE collar tee
  365014345, // MM6 x Salomon cap
  368146408, // BAPE mesh cap
  393027532, // Starbucks x BAPE cup
  399826057, // ADER x Converse collar tee
  405930487, // Starbucks x BAPE tumbler
];

const BROAD_FOOTBALL_READY_PIDS = [
  330027143,
  335841370,
  392555340,
  395130195,
  400074309,
  409955508,
];

const RECLASSIFY_PIDS = [
  402077253, // Yeezy Slide stale raw SKU; current ruleMatch is Salomon RX Slide 3.
];

type RawRow = {
  pid: number;
  sku_id: string | null;
  sku_name: string | null;
  name: string | null;
  description_preview: string | null;
  bunjang_condition_label: string | null;
  pool_eligible: boolean | null;
};

type ParsedRow = {
  pid: number;
  comparable_key: string | null;
  needs_review: boolean | null;
  parse_confidence: number | null;
  parser_version: string | null;
};

type PoolRow = {
  pid: number;
  status: string | null;
  comparable_key: string | null;
  category: string | null;
};

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
    // Optional local env.
  }
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

async function fetchRows<T>(table: string, select: string, pids: number[]) {
  const out: T[] = [];
  for (const part of chunk([...new Set(pids)].filter(Number.isFinite), 200)) {
    if (part.length === 0) continue;
    out.push(...await fetchJson<T>(
      `${tableUrl(table)}?select=${select}&pid=in.${inList(part)}&order=pid.asc&limit=${part.length}`,
    ));
  }
  return out;
}

async function patchRawRejected(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        sku_id: null,
        sku_name: null,
        pool_eligible: false,
        score_dirty: true,
      }),
    });
  }
}

async function patchParsedRejected(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_listing_parsed")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        comparable_key: null,
        needs_review: true,
        parse_confidence: 0.45,
        parser_version: REASON,
      }),
    });
  }
}

async function patchRawInternalOnly(pids: number[]) {
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
    await restFetch(`${tableUrl("mvp_raw_listings")}?pid=in.${inList(part)}`, {
      method: "PATCH",
      headers: serviceHeaders("return=minimal"),
      body: jsonBody({
        pool_eligible: false,
        score_dirty: true,
      }),
    });
  }
}

async function invalidatePool(pids: number[], reason: string) {
  const updatedAt = new Date().toISOString();
  for (const part of chunk(pids, PATCH_CHUNK_SIZE)) {
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

async function patchRawReclassify(row: { pid: number; sku: Sku }) {
  await restFetch(`${tableUrl("mvp_raw_listings")}?pid=eq.${row.pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: jsonBody({
      sku_id: row.sku.id,
      sku_name: row.sku.modelName,
      pool_eligible: true,
      score_dirty: true,
    }),
  });
}

async function upsertParsed(row: Record<string, unknown>) {
  await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody([row]),
  });
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  await mkdir(reportsDir, { recursive: true });

  const apply = hasFlag("apply");
  const allPids = [...new Set([...SAMPLE_POLLUTION_PIDS, ...BROAD_FOOTBALL_READY_PIDS, ...RECLASSIFY_PIDS])];
  const [rawRows, parsedRows, poolRows] = await Promise.all([
    fetchRows<RawRow>("mvp_raw_listings", "pid,sku_id,sku_name,name,description_preview,bunjang_condition_label,pool_eligible", allPids),
    fetchRows<ParsedRow>("mvp_listing_parsed", "pid,comparable_key,needs_review,parse_confidence,parser_version", allPids),
    fetchRows<PoolRow>("mvp_candidate_pool", "pid,status,comparable_key,category", allPids),
  ]);
  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));

  const reclassify = [];
  const reclassifyInvalidate = [];
  for (const pid of RECLASSIFY_PIDS) {
    const raw = rawByPid.get(pid);
    const currentSku = raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "") : null;
    const currentParsed = raw && currentSku
      ? parseListingOptions({
          title: raw.name ?? "",
          description: raw.description_preview ?? "",
          skuId: currentSku.id,
          skuName: currentSku.modelName,
          category: currentSku.category,
          bunjangConditionLabel: raw.bunjang_condition_label,
          defaultProductType: currentSku.defaultProductType ?? null,
        })
      : null;
    const parsedRow = currentParsed ? toParsedListingRow(pid, currentParsed) : null;
    const gate = evaluatePoolGate(
      { sku: currentSku, category: currentSku?.category ?? null },
      { categoryReadiness: CATEGORY_READINESS, laneReadiness: LANE_READINESS },
    );
    const pool = poolByPid.get(pid);
    const currentKey = parsedRow?.comparable_key as string | null | undefined;
    const shouldInvalidatePool = !currentSku || !gate.canEnterPool || (pool?.comparable_key && currentKey && pool.comparable_key !== currentKey);
    reclassify.push({
      pid,
      title: raw?.name ?? null,
      oldSkuId: raw?.sku_id ?? null,
      currentSkuId: currentSku?.id ?? null,
      oldKey: parsedByPid.get(pid)?.comparable_key ?? null,
      poolKey: pool?.comparable_key ?? null,
      currentKey: currentKey ?? null,
      gateReason: gate.reason,
      keepPool: !shouldInvalidatePool,
    });
    if (shouldInvalidatePool) reclassifyInvalidate.push(pid);
    if (apply && raw && currentSku && parsedRow) {
      await patchRawReclassify({ pid, sku: currentSku });
      await upsertParsed(parsedRow);
    }
  }

  if (apply) {
    await patchRawRejected(SAMPLE_POLLUTION_PIDS);
    await patchParsedRejected(SAMPLE_POLLUTION_PIDS);
    await invalidatePool(SAMPLE_POLLUTION_PIDS, `${REASON}_sample_pollution`);

    await patchRawInternalOnly(BROAD_FOOTBALL_READY_PIDS);
    await invalidatePool(BROAD_FOOTBALL_READY_PIDS, `${REASON}_football_broad_internal_watch`);
    if (reclassifyInvalidate.length > 0) {
      await invalidatePool(reclassifyInvalidate, `${REASON}_reclassify_key_or_gate_drift`);
    }
  }

  const pollutionRows = SAMPLE_POLLUTION_PIDS.map((pid) => {
    const raw = rawByPid.get(pid);
    return {
      pid,
      title: raw?.name ?? null,
      oldSkuId: raw?.sku_id ?? null,
      currentSkuId: raw ? ruleMatch(raw.name ?? "", raw.description_preview ?? "")?.id ?? null : null,
      oldKey: parsedByPid.get(pid)?.comparable_key ?? null,
      poolStatus: poolByPid.get(pid)?.status ?? null,
    };
  });
  const broadRows = BROAD_FOOTBALL_READY_PIDS.map((pid) => ({
    pid,
    title: rawByPid.get(pid)?.name ?? null,
    skuId: rawByPid.get(pid)?.sku_id ?? null,
    key: parsedByPid.get(pid)?.comparable_key ?? null,
    poolStatus: poolByPid.get(pid)?.status ?? null,
  }));

  const report = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry-run",
    applied: apply,
    samplePollutionPids: SAMPLE_POLLUTION_PIDS.length,
    broadFootballReadyPids: BROAD_FOOTBALL_READY_PIDS.length,
    reclassifyPids: RECLASSIFY_PIDS.length,
    pollutionRows,
    broadRows,
    reclassify,
  };
  const suffix = apply ? "apply" : "dry-run";
  const jsonPath = path.join(reportsDir, `wave809-shoe-sku-safety-cleanup-${suffix}.json`);
  const mdPath = path.join(reportsDir, `wave809-shoe-sku-safety-cleanup-${suffix}.md`);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(mdPath, [
    "# Wave 809 Shoe SKU Safety Cleanup",
    "",
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    "",
    "## Totals",
    `- sample pollution pids: ${report.samplePollutionPids}`,
    `- broad football ready pids: ${report.broadFootballReadyPids}`,
    `- reclassify pids: ${report.reclassifyPids}`,
    "",
    "## Sample Pollution",
    ...pollutionRows.map((row) => `- pid ${row.pid}: old=${row.oldSkuId ?? "null"} current=${row.currentSkuId ?? "null"} pool=${row.poolStatus ?? "none"} key=${row.oldKey ?? "null"} title="${row.title ?? ""}"`),
    "",
    "## Broad Football Internal Watch",
    ...broadRows.map((row) => `- pid ${row.pid}: sku=${row.skuId ?? "null"} pool=${row.poolStatus ?? "none"} key=${row.key ?? "null"} title="${row.title ?? ""}"`),
    "",
    "## Reclassify",
    ...reclassify.map((row) => `- pid ${row.pid}: old=${row.oldSkuId ?? "null"} current=${row.currentSkuId ?? "null"} oldKey=${row.oldKey ?? "null"} poolKey=${row.poolKey ?? "null"} currentKey=${row.currentKey ?? "null"} keepPool=${row.keepPool ? "yes" : "no"} title="${row.title ?? ""}"`),
    "",
  ].join("\n"));

  console.log(JSON.stringify({
    jsonPath,
    mdPath,
    totals: {
      mode: report.mode,
      applied: report.applied,
      samplePollutionPids: report.samplePollutionPids,
      broadFootballReadyPids: report.broadFootballReadyPids,
      reclassifyPids: report.reclassifyPids,
      reclassify,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
