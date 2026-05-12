import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type PlanRow = {
  pid: number;
  action: string;
  reason: string;
  currentType: string;
  nextType: string;
  currentSku: string | null;
  nextSku: string | null;
  title: string | null;
};

type ApplyPlan = {
  summary: {
    autoInvalidateRows: number;
    aiEscalationRows: number;
    blockedRows: number;
  };
  autoInvalidateRows: PlanRow[];
  aiEscalationRows: PlanRow[];
  blockedRows: PlanRow[];
};

type RawSnapshot = {
  pid: number;
  listing_type: string | null;
  sku_id: string | null;
  sku_name: string | null;
  updated_at: string | null;
};

type PoolSnapshot = {
  pid: number;
  status: string | null;
  invalidated_reason: string | null;
  reserved_until: string | null;
  updated_at: string | null;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");
const applyMode = process.argv.includes("--apply=1");

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

function authHeaders(prefer?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    ...(prefer ? { prefer } : {}),
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patchRow(table: string, pid: number, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseRestUrl()}/${table}?pid=eq.${pid}`, {
    method: "PATCH",
    headers: authHeaders("return=minimal"),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${table} pid=${pid} ${res.status}: ${await res.text()}`);
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const plan = JSON.parse(await readFile(path.join(reportsDir, "reparse-backfill-apply-plan-latest.json"), "utf-8")) as ApplyPlan;
  if (plan.summary.aiEscalationRows > 0 || plan.aiEscalationRows.length > 0) {
    throw new Error("AI escalation rows exist; refusing automatic apply");
  }
  if (plan.summary.blockedRows > 0 || plan.blockedRows.length > 0) {
    throw new Error("Blocked rows exist; refusing automatic apply");
  }

  const rows = plan.autoInvalidateRows ?? [];
  if (rows.length > 10) throw new Error(`Refusing to apply more than 10 rows at once: ${rows.length}`);
  const pids = rows.map((row) => Number(row.pid)).filter(Number.isFinite);
  const pidFilter = pids.join(",");
  const [rawRows, poolRows] = pids.length > 0
    ? await Promise.all([
        restJson<RawSnapshot[]>(`/mvp_raw_listings?select=pid,listing_type,sku_id,sku_name,updated_at&pid=in.(${pidFilter})`),
        restJson<PoolSnapshot[]>(`/mvp_candidate_pool?select=pid,status,invalidated_reason,reserved_until,updated_at&pid=in.(${pidFilter})`),
      ])
    : [[], []];

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const generatedAt = new Date().toISOString();
  const validations = rows.map((row) => {
    const raw = rawByPid.get(Number(row.pid));
    const pool = poolByPid.get(Number(row.pid));
    const ok =
      raw?.listing_type === row.currentType &&
      (raw?.sku_id ?? null) === (row.currentSku ?? null) &&
      (pool?.status === "ready" || pool?.status === "reserved");
    return {
      pid: row.pid,
      ok,
      reason: ok ? "ready_to_apply" : "snapshot_mismatch",
      expected: { listingType: row.currentType, skuId: row.currentSku, poolStatus: "ready_or_reserved" },
      actual: { listingType: raw?.listing_type ?? null, skuId: raw?.sku_id ?? null, poolStatus: pool?.status ?? null },
    };
  });

  const failed = validations.filter((row) => !row.ok);
  if (failed.length > 0) {
    if (applyMode) {
      console.error(JSON.stringify(failed, null, 2));
      throw new Error("Snapshot validation failed; refusing apply");
    }
  }

  if (applyMode) {
    const now = new Date().toISOString();
    for (const row of rows) {
      await patchRow("mvp_raw_listings", row.pid, {
        listing_type: row.nextType,
        sku_id: null,
        sku_name: null,
        updated_at: now,
      });
      await patchRow("mvp_candidate_pool", row.pid, {
        status: "invalidated",
        invalidated_reason: `reparse_backfill_${row.reason}`.slice(0, 120),
        reserved_until: null,
        updated_at: now,
      });
    }
  }

  const report = {
    generatedAt,
    mode: applyMode ? "apply" : "dry_run",
    sourcePlan: "reports/reparse-backfill-apply-plan-latest.json",
    summary: {
      plannedRows: rows.length,
      validationPassedRows: validations.filter((row) => row.ok).length,
      validationFailedRows: failed.length,
      dbWritesExecuted: applyMode ? rows.length * 2 : 0,
    },
    rows,
    validations,
    preApplySnapshot: {
      rawRows,
      poolRows,
    },
  };

  const stem = applyMode ? "reparse-backfill-apply-apply-latest" : "reparse-backfill-apply-dry-run-latest";
  const md = [
    "# Reparse / Backfill Apply Execution",
    "",
    `- generated_at: ${generatedAt}`,
    `- mode: ${report.mode}`,
    "- source: reports/reparse-backfill-apply-plan-latest.json",
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(report.summary).map(([key, value]) => [key, value])),
    "",
    "## Validation",
    "",
    table(
      ["pid", "ok", "reason", "expected_type", "actual_type", "expected_sku", "actual_sku", "actual_pool_status"],
      validations.map((row) => [
        row.pid,
        row.ok ? "yes" : "no",
        row.reason,
        row.expected.listingType,
        row.actual.listingType,
        row.expected.skuId ?? "-",
        row.actual.skuId ?? "-",
        row.actual.poolStatus ?? "-",
      ]),
    ),
    "",
    "## Rollback Basis",
    "",
    "- `preApplySnapshot.rawRows` and `preApplySnapshot.poolRows` contain the previous values.",
    applyMode
      ? "- If rollback is needed, restore those snapshot values for the same pids."
      : "- No rollback is needed for dry-run mode.",
  ].join("\n");

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, `${stem}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, `${stem}.md`), `${md}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
