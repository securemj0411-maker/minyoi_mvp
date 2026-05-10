import { NextRequest, NextResponse } from "next/server";

import { CATALOG, ruleMatch, type Sku } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { boundedInt } from "@/lib/pipeline-config";

export const maxDuration = 90;

function serviceHeaders(prefer?: string): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

function restBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!raw) throw new Error("SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${restBase()}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase REST failed ${res.status}: ${body}`);
  }
  return res;
}

type RawRow = {
  pid: number;
  name: string;
  price: number;
  description_preview: string | null;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
};

const catalogById = new Map(CATALOG.map((sku) => [sku.id, sku]));

function categoryFor(row: RawRow): Sku["category"] | null {
  return catalogById.get(row.sku_id ?? "")?.category ?? null;
}

async function loadRows(limit: number, offset: number): Promise<RawRow[]> {
  const cols = "pid,name,price,description_preview,listing_type,sku_id,sku_name";
  const res = await restFetch(
    `/mvp_raw_listings?select=${cols}&detail_status=eq.done&order=detail_enriched_at.desc&limit=${limit}&offset=${offset}`,
    { headers: serviceHeaders() },
  );
  return (await res.json()) as RawRow[];
}

async function upsertParsed(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  await restFetch("/mvp_listing_parsed?on_conflict=pid", {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates"),
    body: JSON.stringify(rows),
  });
}

async function patchRawRows(rows: { pid: number; sku_id: string | null; sku_name: string | null; listing_type: string | null; updated_at: string }[]) {
  await Promise.all(rows.map((row) => restFetch(`/mvp_raw_listings?pid=eq.${row.pid}`, {
    method: "PATCH",
    headers: serviceHeaders("return=minimal"),
    body: JSON.stringify({
      sku_id: row.sku_id,
      sku_name: row.sku_name,
      listing_type: row.listing_type,
      updated_at: row.updated_at,
    }),
  })));
}

async function handleReparse(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authOk = !secret || req.headers.get("authorization") === `Bearer ${secret}`;
  if (secret && !authOk) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = boundedInt(req.nextUrl.searchParams.get("limit"), 200, 1, 1000);
  const offset = boundedInt(req.nextUrl.searchParams.get("offset"), 0, 0, 100000);
  const shouldReclassify = req.nextUrl.searchParams.get("reclassify") === "1";
  const rows = await loadRows(limit, offset);
  const summary = {
    total: rows.length,
    needsReview: 0,
    noComparableKey: 0,
    skuRecovered: 0,
    reclassified: 0,
    criticalUnknown: {} as Record<string, number>,
    parserVersion: "option-parser-v2",
  };

  const rawPatchRows: { pid: number; sku_id: string | null; sku_name: string | null; listing_type: string | null; updated_at: string }[] = [];
  const parsedRows = rows.map((row) => {
    const classified = shouldReclassify
      ? classifyListing(row.name ?? "", row.description_preview ?? "", Number(row.price ?? 0))
      : null;
    const fallbackSku = row.sku_id || classified ? null : ruleMatch(row.name ?? "", row.description_preview ?? "");
    const sku = shouldReclassify
      ? (classified?.sku ?? null)
      : (catalogById.get(row.sku_id ?? "") ?? fallbackSku);
    const listingType = classified?.listingType ?? row.listing_type;
    if (!row.sku_id && sku) {
      summary.skuRecovered += 1;
    }
    if (
      shouldReclassify &&
      (row.sku_id !== (sku?.id ?? null) || row.sku_name !== (sku?.modelName ?? null) || row.listing_type !== listingType)
    ) {
      summary.reclassified += 1;
      rawPatchRows.push({
        pid: row.pid,
        sku_id: sku?.id ?? null,
        sku_name: sku?.modelName ?? null,
        listing_type: listingType,
        updated_at: new Date().toISOString(),
      });
    } else if (!row.sku_id && sku) {
      rawPatchRows.push({
        pid: row.pid,
        sku_id: sku.id,
        sku_name: sku.modelName,
        listing_type: row.listing_type,
        updated_at: new Date().toISOString(),
      });
    }
    const parsed = parseListingOptions({
      title: row.name ?? "",
      description: row.description_preview ?? "",
      skuId: sku?.id ?? row.sku_id,
      skuName: sku?.modelName ?? row.sku_name,
      category: sku?.category ?? categoryFor(row),
    });
    if (parsed.needsReview) summary.needsReview += 1;
    if (!parsed.comparableKey) summary.noComparableKey += 1;
    const critical = Array.isArray(parsed.parsedJson.critical_unknown)
      ? parsed.parsedJson.critical_unknown
      : [];
    for (const item of critical) {
      const key = String(item);
      summary.criticalUnknown[key] = (summary.criticalUnknown[key] ?? 0) + 1;
    }
    return toParsedListingRow(row.pid, parsed);
  });

  await patchRawRows(rawPatchRows);
  await upsertParsed(parsedRows);
  return NextResponse.json({ ok: true, offset, limit, summary });
}

export async function GET(req: NextRequest) {
  return handleReparse(req);
}

export async function POST(req: NextRequest) {
  return handleReparse(req);
}
