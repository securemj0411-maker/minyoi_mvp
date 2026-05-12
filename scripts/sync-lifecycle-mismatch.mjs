import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

async function loadEnvFile(filePath) {
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

await loadEnvFile(path.join(appDir, ".env.local"));
await loadEnvFile(path.join(appDir, ".env"));

function arg(name, fallback) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

function flag(name) {
  const raw = arg(name, "");
  return raw === "1" || raw === "true" || raw === "yes" || process.argv.includes(`--${name}`);
}

function intArg(name, fallback, min, max) {
  const parsed = Number.parseInt(arg(name, String(fallback)), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function dbUrl() {
  return process.env.DATABASE_URL
    || process.env.POSTGRES_URL
    || process.env.POSTGRES_PRISMA_URL
    || process.env.SUPABASE_DB_URL
    || "";
}

function psqlArgsFromUrl(rawUrl) {
  const url = new URL(rawUrl);
  return {
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
      PGSSLMODE: url.searchParams.get("sslmode") ?? process.env.PGSSLMODE ?? "require",
    },
    args: [
      "-h", url.hostname,
      "-p", url.port || "5432",
      "-U", decodeURIComponent(url.username),
      "-d", url.pathname.replace(/^\//, "") || "postgres",
    ],
  };
}

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required for REST fallback.");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(prefer) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for REST fallback.");
  const headers = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  if (prefer) headers.prefer = prefer;
  return headers;
}

function chunk(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

function num(value) {
  return Number(value ?? 0).toLocaleString("ko-KR");
}

function table(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function compactName(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 58 ? `${text.slice(0, 58)}...` : text;
}

const sampleLimit = intArg("sampleLimit", 60, 10, 500);
const apply = flag("apply");
const mode = apply ? "apply" : "dry-run";

const CANDIDATE_CTE = `
candidate_rows as (
  select
    c.pid,
    c.status as lifecycle_status,
    c.state_reason,
    c.last_checked_at,
    c.updated_at as lifecycle_updated_at,
    c.transition_confidence,
    r.listing_state as raw_state,
    r.name,
    r.price,
    r.num_faved,
    r.sale_status,
    r.seller_uid,
    r.sku_id,
    r.sku_name,
    r.raw_json,
    p.category,
    p.comparable_key,
    p.parse_confidence,
    p.parser_version
  from public.mvp_lifecycle_checks c
  join public.mvp_raw_listings r on r.pid = c.pid
  left join public.mvp_listing_parsed p on p.pid = c.pid
  where c.status in ('sold_confirmed','disappeared','archived')
    and r.listing_state = 'active'
    and (
      c.state_reason like 'backfill_sale_status_inactive%' or
      c.state_reason like 'sold_signal_%'
    )
)`;

const DRY_RUN_SQL = `
with ${CANDIDATE_CTE},
pool_hits as (
  select p.pid, p.status, p.profit_band
  from public.mvp_candidate_pool p
  join candidate_rows c on c.pid = p.pid
  where p.status in ('ready','reserved')
),
market_keys as (
  select comparable_key, count(*)::int as pid_count
  from candidate_rows
  where comparable_key is not null and comparable_key <> ''
  group by comparable_key
)
select json_build_object(
  'generated_at', now(),
  'mode', '${mode}',
  'applied', false,
  'summary', json_build_object(
    'candidate_count', (select count(*)::int from candidate_rows),
    'pool_ready_or_reserved_count', (select count(*)::int from pool_hits),
    'market_key_count', (select count(*)::int from market_keys),
    'sold_confirmed_count', (select count(*)::int from candidate_rows where lifecycle_status = 'sold_confirmed'),
    'disappeared_count', (select count(*)::int from candidate_rows where lifecycle_status = 'disappeared'),
    'archived_count', (select count(*)::int from candidate_rows where lifecycle_status = 'archived')
  ),
  'counts_by_lifecycle_status', coalesce((select json_agg(row_to_json(t)) from (
    select lifecycle_status, count(*)::int as count
    from candidate_rows
    group by lifecycle_status
    order by count desc, lifecycle_status
  ) t), '[]'::json),
  'top_reasons', coalesce((select json_agg(row_to_json(t)) from (
    select state_reason, count(*)::int as count
    from candidate_rows
    group by state_reason
    order by count desc, state_reason
    limit 20
  ) t), '[]'::json),
  'pool_impact_by_band', coalesce((select json_agg(row_to_json(t)) from (
    select profit_band, status, count(*)::int as count
    from pool_hits
    group by profit_band, status
    order by profit_band, status
  ) t), '[]'::json),
  'market_key_examples', coalesce((select json_agg(row_to_json(t)) from (
    select comparable_key, pid_count
    from market_keys
    order by pid_count desc, comparable_key
    limit 20
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      c.pid,
      c.lifecycle_status,
      c.raw_state,
      c.state_reason,
      c.name,
      c.price,
      c.sale_status,
      c.sku_id,
      c.sku_name,
      c.category,
      c.comparable_key,
      c.last_checked_at,
      c.transition_confidence,
      ph.status as pool_status,
      ph.profit_band
    from candidate_rows c
    left join pool_hits ph on ph.pid = c.pid
    order by c.lifecycle_updated_at desc nulls last, c.pid desc
    limit ${sampleLimit}
  ) t), '[]'::json)
) as report;
`;

const APPLY_SQL = `
with ${CANDIDATE_CTE},
raw_updated as (
  update public.mvp_raw_listings r
  set
    listing_state = c.lifecycle_status,
    sold_detected_at = case
      when c.lifecycle_status = 'sold_confirmed' then coalesce(r.sold_detected_at, c.last_checked_at, c.lifecycle_updated_at, now())
      else r.sold_detected_at
    end,
    disappeared_at = case
      when c.lifecycle_status = 'disappeared' then coalesce(r.disappeared_at, c.last_checked_at, c.lifecycle_updated_at, now())
      else r.disappeared_at
    end,
    missing_count = case
      when c.lifecycle_status in ('sold_confirmed','archived') then 0
      else r.missing_count
    end,
    last_missing_at = case
      when c.lifecycle_status = 'disappeared' then coalesce(r.last_missing_at, c.last_checked_at, c.lifecycle_updated_at, now())
      else r.last_missing_at
    end,
    raw_json = jsonb_set(
      coalesce(r.raw_json, '{}'::jsonb),
      '{lifecycle_mismatch_sync}',
      jsonb_build_object(
        'synced_at', now(),
        'from_raw_state', r.listing_state,
        'to_raw_state', c.lifecycle_status,
        'lifecycle_reason', c.state_reason,
        'script', 'sync-lifecycle-mismatch'
      ),
      true
    ),
    updated_at = now()
  from candidate_rows c
  where r.pid = c.pid
  returning
    r.pid,
    c.lifecycle_status,
    c.state_reason,
    r.name,
    r.price,
    r.num_faved,
    r.sale_status,
    r.seller_uid,
    r.sku_id,
    r.sku_name,
    c.category,
    c.comparable_key,
    c.parse_confidence,
    c.parser_version
),
pool_invalidated as (
  update public.mvp_candidate_pool p
  set
    status = 'invalidated',
    invalidated_reason = 'lifecycle_mismatch_auto_sync',
    reserved_until = null,
    updated_at = now()
  from raw_updated u
  where p.pid = u.pid
    and p.status in ('ready','reserved')
  returning p.pid, p.profit_band, p.comparable_key
),
observations_inserted as (
  insert into public.mvp_listing_observations (
    pid,
    observed_at,
    event_type,
    listing_state,
    price,
    num_faved,
    name,
    sale_status,
    sku_id,
    sku_name,
    comparable_key,
    parse_confidence,
    seller_uid,
    source,
    raw_json
  )
  select
    u.pid,
    now(),
    'state_changed',
    u.lifecycle_status,
    u.price,
    u.num_faved,
    u.name,
    u.sale_status,
    u.sku_id,
    u.sku_name,
    u.comparable_key,
    u.parse_confidence,
    u.seller_uid,
    'lifecycle_mismatch_sync',
    jsonb_build_object(
      'reason', u.state_reason,
      'category', u.category,
      'parser_version', u.parser_version
    )
  from raw_updated u
  returning pid
),
market_queued as (
  insert into public.mvp_market_key_invalidation (
    comparable_key,
    source,
    reason,
    priority,
    affected_pid,
    old_comparable_key,
    new_comparable_key,
    parser_version,
    status,
    event_count,
    first_event_at,
    last_event_at
  )
  select
    u.comparable_key,
    'bunjang',
    'lifecycle_mismatch_auto_sync',
    100,
    min(u.pid),
    u.comparable_key,
    u.comparable_key,
    max(u.parser_version),
    'pending',
    count(*)::int,
    now(),
    now()
  from raw_updated u
  where u.comparable_key is not null and u.comparable_key <> ''
  group by u.comparable_key
  on conflict (comparable_key) do update
  set reason = excluded.reason,
      priority = greatest(public.mvp_market_key_invalidation.priority, excluded.priority),
      affected_pid = coalesce(excluded.affected_pid, public.mvp_market_key_invalidation.affected_pid),
      old_comparable_key = coalesce(excluded.old_comparable_key, public.mvp_market_key_invalidation.old_comparable_key),
      new_comparable_key = coalesce(excluded.new_comparable_key, public.mvp_market_key_invalidation.new_comparable_key),
      parser_version = coalesce(excluded.parser_version, public.mvp_market_key_invalidation.parser_version),
      event_count = public.mvp_market_key_invalidation.event_count + excluded.event_count,
      last_event_at = now(),
      last_error = null,
      status = case
        when public.mvp_market_key_invalidation.status in ('done', 'failed') then 'pending'
        else public.mvp_market_key_invalidation.status
      end
  returning comparable_key
)
select json_build_object(
  'generated_at', now(),
  'mode', '${mode}',
  'applied', true,
  'summary', json_build_object(
    'candidate_count', (select count(*)::int from candidate_rows),
    'raw_updated_count', (select count(*)::int from raw_updated),
    'pool_invalidated_count', (select count(*)::int from pool_invalidated),
    'observations_inserted_count', (select count(*)::int from observations_inserted),
    'market_key_queued_count', (select count(*)::int from market_queued)
  ),
  'counts_by_lifecycle_status', coalesce((select json_agg(row_to_json(t)) from (
    select lifecycle_status, count(*)::int as count
    from raw_updated
    group by lifecycle_status
    order by count desc, lifecycle_status
  ) t), '[]'::json),
  'top_reasons', coalesce((select json_agg(row_to_json(t)) from (
    select state_reason, count(*)::int as count
    from raw_updated
    group by state_reason
    order by count desc, state_reason
    limit 20
  ) t), '[]'::json),
  'pool_impact_by_band', coalesce((select json_agg(row_to_json(t)) from (
    select profit_band, count(*)::int as count
    from pool_invalidated
    group by profit_band
    order by profit_band
  ) t), '[]'::json),
  'examples', coalesce((select json_agg(row_to_json(t)) from (
    select
      u.pid,
      u.lifecycle_status,
      u.state_reason,
      u.name,
      u.price,
      u.sale_status,
      u.sku_id,
      u.sku_name,
      u.category,
      u.comparable_key
    from raw_updated u
    order by u.pid desc
    limit ${sampleLimit}
  ) t), '[]'::json)
) as report;
`;

async function runSql(sql) {
  const rawUrl = dbUrl();
  if (!rawUrl) {
    throw new Error("DATABASE_URL/POSTGRES_URL/POSTGRES_PRISMA_URL/SUPABASE_DB_URL is required.");
  }
  const { env, args } = psqlArgsFromUrl(rawUrl);
  const psql = await findPsql();
  const { stdout } = await execFileAsync(psql, [...args, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", sql], {
    cwd: appDir,
    env,
    maxBuffer: 1024 * 1024 * 20,
  });
  const text = stdout.trim();
  return JSON.parse(text);
}

async function findPsql() {
  const candidates = [
    process.env.PSQL_BIN,
    "psql",
    "/opt/homebrew/opt/libpq/bin/psql",
    "/opt/homebrew/bin/psql",
    "/usr/local/bin/psql",
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "psql") continue;
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return "psql";
}

async function restFetch(pathname) {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Supabase REST failed ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function restFetchAll(pathname, limit = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += limit) {
    const sep = pathname.includes("?") ? "&" : "?";
    const page = await restFetch(`${pathname}${sep}limit=${limit}&offset=${offset}`);
    rows.push(...page);
    if (page.length < limit) return rows;
  }
}

async function restFetchByPids(tableName, select, pids, extraQuery = "") {
  const rows = [];
  for (const ids of chunk(pids, 180)) {
    if (ids.length === 0) continue;
    const suffix = extraQuery ? `&${extraQuery}` : "";
    rows.push(...await restFetch(`/${tableName}?select=${select}&pid=in.(${ids.join(",")})${suffix}`));
  }
  return rows;
}

function sortCountRows(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row[key] || "-";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ [key]: value, count }))
    .sort((a, b) => b.count - a.count || String(a[key]).localeCompare(String(b[key])));
}

function buildDryRunReport(candidates, poolRows) {
  const poolByPid = new Map(poolRows.map((row) => [Number(row.pid), row]));
  const marketCounts = new Map();
  for (const row of candidates) {
    if (!row.comparable_key) continue;
    marketCounts.set(row.comparable_key, (marketCounts.get(row.comparable_key) ?? 0) + 1);
  }

  const poolImpact = [...poolRows.reduce((map, row) => {
    const key = `${row.profit_band}:${row.status}`;
    const current = map.get(key) ?? { profit_band: row.profit_band, status: row.status, count: 0 };
    current.count += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.profit_band - b.profit_band || a.status.localeCompare(b.status));

  return {
    generated_at: new Date().toISOString(),
    mode,
    applied: false,
    summary: {
      candidate_count: candidates.length,
      pool_ready_or_reserved_count: poolRows.length,
      market_key_count: marketCounts.size,
      sold_confirmed_count: candidates.filter((row) => row.lifecycle_status === "sold_confirmed").length,
      disappeared_count: candidates.filter((row) => row.lifecycle_status === "disappeared").length,
      archived_count: candidates.filter((row) => row.lifecycle_status === "archived").length,
    },
    counts_by_lifecycle_status: sortCountRows(candidates, "lifecycle_status"),
    top_reasons: sortCountRows(candidates, "state_reason").slice(0, 20),
    pool_impact_by_band: poolImpact,
    market_key_examples: [...marketCounts.entries()]
      .map(([comparable_key, pid_count]) => ({ comparable_key, pid_count }))
      .sort((a, b) => b.pid_count - a.pid_count || a.comparable_key.localeCompare(b.comparable_key))
      .slice(0, 20),
    examples: candidates
      .slice()
      .sort((a, b) => String(b.lifecycle_updated_at ?? "").localeCompare(String(a.lifecycle_updated_at ?? "")) || Number(b.pid) - Number(a.pid))
      .slice(0, sampleLimit)
      .map((row) => {
        const pool = poolByPid.get(Number(row.pid));
        return {
          ...row,
          pool_status: pool?.status ?? null,
          profit_band: pool?.profit_band ?? null,
        };
      }),
  };
}

async function runRestDryRun() {
  const lifecycleRows = await restFetchAll(
    "/mvp_lifecycle_checks?select=pid,status,state_reason,last_checked_at,updated_at,transition_confidence&status=in.(sold_confirmed,disappeared,archived)&or=(state_reason.like.backfill_sale_status_inactive*,state_reason.like.sold_signal_*)",
  );
  const pids = lifecycleRows.map((row) => Number(row.pid)).filter(Number.isFinite);
  if (pids.length === 0) return buildDryRunReport([], []);

  const [rawRows, parsedRows, poolRows] = await Promise.all([
    restFetchByPids(
      "mvp_raw_listings",
      "pid,listing_state,name,price,num_faved,sale_status,seller_uid,sku_id,sku_name",
      pids,
      "listing_state=eq.active",
    ),
    restFetchByPids(
      "mvp_listing_parsed",
      "pid,category,comparable_key,parse_confidence,parser_version",
      pids,
    ),
    restFetchByPids(
      "mvp_candidate_pool",
      "pid,status,profit_band,comparable_key",
      pids,
      "status=in.(ready,reserved)",
    ),
  ]);

  const rawByPid = new Map(rawRows.map((row) => [Number(row.pid), row]));
  const parsedByPid = new Map(parsedRows.map((row) => [Number(row.pid), row]));
  const candidates = lifecycleRows
    .map((life) => {
      const pid = Number(life.pid);
      const raw = rawByPid.get(pid);
      if (!raw) return null;
      const parsed = parsedByPid.get(pid) ?? {};
      return {
        pid,
        lifecycle_status: life.status,
        state_reason: life.state_reason,
        last_checked_at: life.last_checked_at,
        lifecycle_updated_at: life.updated_at,
        transition_confidence: life.transition_confidence,
        raw_state: raw.listing_state,
        name: raw.name,
        price: raw.price,
        num_faved: raw.num_faved,
        sale_status: raw.sale_status,
        seller_uid: raw.seller_uid,
        sku_id: raw.sku_id,
        sku_name: raw.sku_name,
        category: parsed.category ?? null,
        comparable_key: parsed.comparable_key ?? null,
        parse_confidence: parsed.parse_confidence ?? null,
        parser_version: parsed.parser_version ?? null,
      };
    })
    .filter(Boolean);

  return buildDryRunReport(candidates, poolRows);
}

function renderMarkdown(report) {
  const summary = report.summary ?? {};
  const title = report.applied ? "Lifecycle Mismatch Sync Apply Report" : "Lifecycle Mismatch Sync Dry Run";
  const lines = [
    `# ${title}`,
    "",
    `- generated_at: ${report.generated_at}`,
    `- mode: ${report.mode}`,
    `- applied: ${report.applied ? "yes" : "no"}`,
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(summary).map(([key, value]) => [key, num(value)])),
    "",
  ];

  if (report.counts_by_lifecycle_status?.length) {
    lines.push("## Lifecycle Status", "", table(["status", "count"], report.counts_by_lifecycle_status.map((row) => [row.lifecycle_status, num(row.count)])), "");
  }

  if (report.top_reasons?.length) {
    lines.push("## Top Reasons", "", table(["reason", "count"], report.top_reasons.map((row) => [row.state_reason, num(row.count)])), "");
  }

  if (report.pool_impact_by_band?.length) {
    const poolRows = report.pool_impact_by_band.map((row) => [
      row.profit_band,
      row.status ?? "invalidated",
      num(row.count),
    ]);
    lines.push("## Candidate Pool Impact", "", table(["band", "status", "count"], poolRows), "");
  }

  if (report.market_key_examples?.length) {
    lines.push("## Market Key Examples", "", table(["comparable_key", "pid_count"], report.market_key_examples.map((row) => [row.comparable_key, num(row.pid_count)])), "");
  }

  if (report.examples?.length) {
    lines.push(
      "## Examples",
      "",
      table(
        ["pid", "state", "pool", "reason", "name", "price", "key"],
        report.examples.map((row) => [
          row.pid,
          row.lifecycle_status,
          row.pool_status ? `${row.pool_status}/B${row.profit_band}` : "-",
          row.state_reason,
          compactName(row.name),
          num(row.price),
          row.comparable_key ?? "-",
        ]),
      ),
      "",
    );
  }

  return `${lines.join("\n")}\n`;
}

await mkdir(reportsDir, { recursive: true });

let report;
try {
  report = await runSql(apply ? APPLY_SQL : DRY_RUN_SQL);
} catch (error) {
  if (error?.code !== "ENOENT" || error?.path !== "psql") throw error;
  if (apply) {
    throw new Error("psql is required for --apply=1 so the sync can run as one atomic SQL statement.");
  }
  report = await runRestDryRun();
}
const stem = `lifecycle-mismatch-sync-${apply ? "apply" : "dry-run"}-latest`;
const jsonPath = path.join(reportsDir, `${stem}.json`);
const mdPath = path.join(reportsDir, `${stem}.md`);

await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(mdPath, renderMarkdown(report));

console.log(JSON.stringify({
  mode,
  applied: report.applied,
  summary: report.summary,
  jsonPath,
  mdPath,
}, null, 2));
