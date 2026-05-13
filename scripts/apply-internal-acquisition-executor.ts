import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fetchDetail } from "@/lib/bunjang";
import { ruleMatch, skuById } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";
import { classifyListing } from "@/lib/pipeline";
import { describeSignals, detectSoldOut, isSoldOut } from "@/lib/sold-out";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

const applyMode = process.argv.includes("--apply=1");
const freshRefetchMode = process.argv.includes("--fresh-refetch=1");

type Preflight = {
  globalStatus: "pass" | "hold";
  lanePreflights: Array<{
    lane: string;
    status: "pass" | "hold";
    futureWriteCap: number;
    proposedPids: string[];
    evidence: string;
  }>;
};

type DetailRow = {
  pid: string;
  title: string;
  price: number;
  saleStatus?: string | null;
  sold?: boolean;
  listingType?: string | null;
  detailSkuId?: string | null;
  detailComparableKey?: string | null;
  detailNeedsReview?: boolean;
  activeClean: boolean;
  descriptionPreview?: string;
};

type DetailReport = {
  runtimeMutation?: boolean;
  supabaseMutation?: boolean;
  publicPromotion?: boolean;
  rows?: DetailRow[];
};

type ConflictPolicy = {
  rows?: Array<{
    pid: number;
    policy: string;
  }>;
};

type ExecutionRow = {
  lane: string;
  pid: number;
  title: string;
  price: number;
  evidenceComparableKey: string;
  evidenceSkuId: string;
  rawPayload: Record<string, unknown>;
  parsedPayload: Record<string, unknown>;
  validationErrors: string[];
};

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
    // optional env file
  }
}

function readJson<T>(relativePath: string): T {
  const jsonRelativePath = relativePath.endsWith(".md") ? relativePath.replace(/\.md$/, ".json") : relativePath;
  const filePath = jsonRelativePath.startsWith("reports/")
    ? path.join(appDir, jsonRelativePath)
    : path.join(reportsDir, jsonRelativePath);
  if (!existsSync(filePath)) throw new Error(`Missing JSON: ${jsonRelativePath}`);
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function tryReadJson<T>(relativePath: string): T | null {
  try {
    return readJson<T>(relativePath);
  } catch {
    return null;
  }
}

function isActiveSaleStatus(status: string | null | undefined) {
  return ["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"].includes(String(status ?? "").trim().toUpperCase());
}

function compact(text: string) {
  return text.replace(/\s+/g, " ").trim().slice(0, 180);
}

function validateEvidenceRow(row: DetailRow) {
  const errors: string[] = [];
  if (!row.activeClean) errors.push("evidence_not_active_clean");
  if (!isActiveSaleStatus(row.saleStatus)) errors.push(`evidence_inactive_sale_status:${row.saleStatus ?? "missing"}`);
  if (row.sold) errors.push("evidence_sold_signal_true");
  if (row.listingType !== "normal") errors.push(`evidence_listing_type_${row.listingType ?? "missing"}`);
  if (row.detailNeedsReview) errors.push("evidence_detail_needs_review");
  if (!row.detailSkuId) errors.push("evidence_missing_sku");
  if (!row.detailComparableKey) errors.push("evidence_missing_comparable_key");
  return errors;
}

function buildPayloadFromEvidence(lane: string, row: DetailRow, generatedAt: string): ExecutionRow {
  const validationErrors = validateEvidenceRow(row);
  const sku = row.detailSkuId ? skuById(row.detailSkuId) : undefined;
  if (!sku) validationErrors.push(`unknown_sku:${row.detailSkuId ?? "missing"}`);
  const parsed = parseListingOptions({
    title: row.title,
    description: row.descriptionPreview ?? "",
    skuId: row.detailSkuId ?? null,
    skuName: sku?.modelName ?? row.detailSkuId ?? null,
    category: sku?.category ?? null,
  });
  if (parsed.needsReview) validationErrors.push("parsed_needs_review_from_evidence");
  if (parsed.comparableKey !== row.detailComparableKey) validationErrors.push("evidence_reparse_comparable_key_mismatch");

  return {
    lane,
    pid: Number(row.pid),
    title: row.title,
    price: row.price,
    evidenceComparableKey: row.detailComparableKey ?? "",
    evidenceSkuId: row.detailSkuId ?? "",
    validationErrors,
    rawPayload: {
      pid: Number(row.pid),
      url: `https://m.bunjang.co.kr/products/${row.pid}`,
      name: row.title,
      price: row.price,
      num_faved: 0,
      free_shipping: false,
      query: `internal_acquisition:${lane}`,
      source: "bunjang",
      description_preview: row.descriptionPreview ?? "",
      sale_status: row.saleStatus ?? "",
      seller_source: "bunjang",
      listing_type: "normal",
      sku_id: row.detailSkuId ?? null,
      sku_name: sku?.modelName ?? row.detailSkuId ?? null,
      detail_status: "done",
      detail_enriched_at: generatedAt,
      raw_json: {
        source: "internal_acquisition_executor",
        lane,
        evidenceComparableKey: row.detailComparableKey,
        evidenceOnly: true,
      },
      listing_state: "active",
      pool_eligible: false,
      score_dirty: false,
      last_seen_at: generatedAt,
      last_changed_at: generatedAt,
      updated_at: generatedAt,
    },
    parsedPayload: toParsedListingRow(row.pid, parsed),
  };
}

async function rebuildWithFreshDetail(row: ExecutionRow): Promise<ExecutionRow> {
  const fresh = await fetchDetail(String(row.pid));
  const validationErrors: string[] = [];
  if (!fresh) validationErrors.push("fresh_detail_fetch_failed");
  const description = fresh?.description ?? "";
  const soldSignals = fresh ? detectSoldOut(fresh, row.price, { title: row.title }) : [];
  const sold = isSoldOut(soldSignals);
  const classified = classifyListing(row.title, description, row.price);
  const matched = ruleMatch(row.title, description);
  const sku = matched ?? skuById(row.evidenceSkuId);
  const parsed = parseListingOptions({
    title: row.title,
    description,
    skuId: sku?.id ?? null,
    skuName: sku?.modelName ?? null,
    category: sku?.category ?? null,
  });

  if (!isActiveSaleStatus(fresh?.saleStatus)) validationErrors.push(`fresh_inactive_sale_status:${fresh?.saleStatus ?? "missing"}`);
  if (sold) validationErrors.push(`fresh_sold_${describeSignals(soldSignals)}`);
  if (classified.listingType !== "normal") validationErrors.push(`fresh_listing_type_${classified.listingType}`);
  if (sku?.id !== row.evidenceSkuId) validationErrors.push(`fresh_sku_mismatch:${sku?.id ?? "missing"}`);
  if (parsed.needsReview) validationErrors.push("fresh_parsed_needs_review");
  if (parsed.comparableKey !== row.evidenceComparableKey) validationErrors.push(`fresh_comparable_key_mismatch:${parsed.comparableKey ?? "missing"}`);

  return {
    ...row,
    validationErrors: [...row.validationErrors, ...validationErrors],
    rawPayload: {
      ...row.rawPayload,
      description_preview: description,
      sale_status: fresh?.saleStatus ?? "",
      shop_review_rating: fresh?.shopReviewRating ?? null,
      shop_review_count: fresh?.shopReviewCount ?? 0,
      seller_uid: fresh?.shopUid ?? null,
      // Wave 54: privacy policy — seller_name (raw shop name) 저장 금지.
      // top-level column 제거 + raw_json 보존도 금지. seller 식별은
      // seller_uid / hashed id / is_proshop / review stats만 허용.
      trade_data: fresh?.tradeData ?? null,
      trades_data: fresh?.tradesData ?? null,
      image_url_template: fresh?.imageUrlTemplate ?? null,
      image_count: fresh?.imageCount ?? 0,
      thumbnail_url: fresh?.thumbnailUrl ?? null,
      raw_json: {
        source: "internal_acquisition_executor",
        lane: row.lane,
        freshRefetched: true,
        saleStatus: fresh?.saleStatus ?? null,
        soldSignals: describeSignals(soldSignals),
      },
      updated_at: new Date().toISOString(),
    },
    parsedPayload: toParsedListingRow(row.pid, parsed),
  };
}

async function postRows(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;
  const res = await restFetch(`${tableUrl(table)}?on_conflict=${onConflict}`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(rows),
  });
  if (!res.ok) throw new Error(`${table} upsert failed`);
}

async function assertPoolEligibilityColumnsSelectable() {
  const res = await restFetch(`${tableUrl("mvp_raw_listings")}?select=pid,pool_eligible,score_dirty&limit=1`, {
    headers: serviceHeaders(),
  });
  if (!res.ok) throw new Error("pool eligibility column probe failed");
}

function mdTable(rows: ExecutionRow[]) {
  return [
    "| lane | pid | price | sku | comparable | validation | title |",
    "| --- | ---: | ---: | --- | --- | --- | --- |",
    ...rows.map((row) =>
      `| ${row.lane} | ${row.pid} | ${row.price} | ${row.evidenceSkuId} | ${row.evidenceComparableKey} | ${row.validationErrors.join("; ") || "ok"} | ${compact(row.title).replace(/\|/g, "/")} |`,
    ),
  ].join("\n");
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const preflight = readJson<Preflight>("internal-acquisition-executor-preflight-latest.json");
  const conflictPolicy = tryReadJson<ConflictPolicy>("internal-acquisition-conflict-policy-latest.json");
  const excludedPids = new Set(
    (conflictPolicy?.rows ?? [])
      .filter((row) => row.policy === "pool_artifact_separate_cleanup")
      .map((row) => Number(row.pid))
      .filter(Number.isFinite),
  );
  if (preflight.globalStatus !== "pass") throw new Error(`Preflight not pass: ${preflight.globalStatus}`);
  if (applyMode && process.env.INTERNAL_ACQUISITION_WRITE_APPROVED !== "1") {
    throw new Error("Apply refused: set INTERNAL_ACQUISITION_WRITE_APPROVED=1 after explicit owner approval");
  }
  if (applyMode && !freshRefetchMode) {
    throw new Error("Apply refused: --fresh-refetch=1 is required");
  }
  if (applyMode) {
    await loadEnvFile(path.join(appDir, ".env.local"));
    await loadEnvFile(path.join(appDir, ".env"));
    await assertPoolEligibilityColumnsSelectable();
  }

  const rows: ExecutionRow[] = [];
  for (const lane of preflight.lanePreflights.filter((item) => item.status === "pass")) {
    const detailReport = readJson<DetailReport>(lane.evidence);
    if (detailReport.runtimeMutation || detailReport.supabaseMutation || detailReport.publicPromotion) {
      throw new Error(`Evidence report is not no-write: ${lane.evidence}`);
    }
    const byPid = new Map((detailReport.rows ?? []).map((row) => [String(row.pid), row]));
    for (const pid of lane.proposedPids.slice(0, lane.futureWriteCap)) {
      if (excludedPids.has(Number(pid))) continue;
      const row = byPid.get(String(pid));
      if (!row) throw new Error(`Missing detail evidence row pid=${pid} lane=${lane.lane}`);
      rows.push(buildPayloadFromEvidence(lane.lane, row, generatedAt));
    }
  }

  const freshRows = applyMode
    ? await Promise.all(rows.map(rebuildWithFreshDetail))
    : rows;
  const failed = freshRows.filter((row) => row.validationErrors.length > 0);
  if (applyMode && failed.length > 0) {
    throw new Error(`Apply refused: ${failed.length} rows failed fresh validation`);
  }
  if (applyMode) {
    await postRows("mvp_raw_listings", freshRows.map((row) => row.rawPayload), "pid");
    await postRows("mvp_listing_parsed", freshRows.map((row) => row.parsedPayload), "pid");
  }

  const report = {
    generatedAt,
    scope: "internal_acquisition_executor",
    mode: applyMode ? "apply" : "dry_run",
    runtimeMutation: applyMode,
    supabaseMutation: applyMode,
    publicPromotion: false,
    candidatePoolWrites: 0,
    excludedByConflictPolicy: excludedPids.size,
    poolEligibleDefault: false,
    scoreDirtyDefault: false,
    metrics: {
      rows: freshRows.length,
      failedRows: failed.length,
      rawUpsertRows: applyMode ? freshRows.length : 0,
      parsedUpsertRows: applyMode ? freshRows.length : 0,
    },
    rows: freshRows.map((row) => ({
      lane: row.lane,
      pid: row.pid,
      title: row.title,
      price: row.price,
      skuId: row.evidenceSkuId,
      comparableKey: row.evidenceComparableKey,
      validationErrors: row.validationErrors,
      rawPayload: row.rawPayload,
      parsedPayload: row.parsedPayload,
    })),
    decision: applyMode
      ? "Applied internal-only raw/parsed rows with pool_eligible=false and score_dirty=false. Candidate pool/public release remains untouched."
      : "Dry-run only. Use --apply=1 --fresh-refetch=1 with INTERNAL_ACQUISITION_WRITE_APPROVED=1 after explicit owner approval.",
  };

  const stem = applyMode ? "internal-acquisition-executor-apply-latest" : "internal-acquisition-executor-dry-run-latest";
  await writeFile(path.join(reportsDir, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const md = [
    "# Internal Acquisition Executor",
    "",
    `- generatedAt: ${generatedAt}`,
    `- mode: ${report.mode}`,
    `- runtimeMutation/supabaseMutation/publicPromotion: ${report.runtimeMutation}/${report.supabaseMutation}/${report.publicPromotion}`,
    `- candidatePoolWrites: ${report.candidatePoolWrites}`,
    `- excludedByConflictPolicy: ${report.excludedByConflictPolicy}`,
    `- poolEligibleDefault: ${report.poolEligibleDefault}`,
    `- scoreDirtyDefault: ${report.scoreDirtyDefault}`,
    "",
    "## Metrics",
    "",
    `- rows: ${report.metrics.rows}`,
    `- failedRows: ${report.metrics.failedRows}`,
    `- rawUpsertRows: ${report.metrics.rawUpsertRows}`,
    `- parsedUpsertRows: ${report.metrics.parsedUpsertRows}`,
    "",
    "## Rows",
    "",
    mdTable(freshRows),
    "",
    "## Decision",
    "",
    `- ${report.decision}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, `${stem}.md`), md);
  console.log(JSON.stringify(report.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
