import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type DryRunReport = {
  rows: {
    pid: number;
    decision: string;
    liveDecision: string;
    status: string | null;
    exposureCount: number | null;
    maxExposure: number | null;
    nonAdminRevealCount: number;
  }[];
};

type PoolRow = {
  pid: number;
  profit_band: number;
  status: string;
  exposure_count: number | null;
  max_exposure: number | null;
  updated_at: string | null;
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

function supabaseRestUrl() {
  const raw = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL required");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function authHeaders(extra?: Record<string, string>) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY required");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    ...extra,
  };
}

async function restJson<T>(pathname: string): Promise<T> {
  const res = await fetch(`${supabaseRestUrl()}${pathname}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${pathname} ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function patchRows(pids: number[]) {
  const res = await fetch(`${supabaseRestUrl()}/mvp_candidate_pool?pid=in.(${pids.join(",")})&status=eq.spent`, {
    method: "PATCH",
    headers: authHeaders({
      "content-type": "application/json",
      prefer: "return=representation",
    }),
    body: JSON.stringify({
      status: "ready",
      exposure_count: 0,
      reserved_until: null,
      invalidated_reason: null,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!res.ok) throw new Error(`PATCH ${res.status}: ${await res.text()}`);
  return res.json() as Promise<PoolRow[]>;
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

  const dryRunPath = path.join(reportsDir, "admin-spent-restore-dry-run-latest.json");
  const dryRun = JSON.parse(await readFile(dryRunPath, "utf-8")) as DryRunReport;
  const restorePids = dryRun.rows
    .filter((row) => (
      row.decision === "restore_candidate" &&
      row.liveDecision === "restore_live_candidate" &&
      row.status === "spent" &&
      row.nonAdminRevealCount === 0
    ))
    .map((row) => row.pid);

  if (restorePids.length === 0) throw new Error("no restore candidates");

  const before = await restJson<PoolRow[]>(
    `/mvp_candidate_pool?select=pid,profit_band,status,exposure_count,max_exposure,updated_at&pid=in.(${restorePids.join(",")})&limit=1000`,
  );
  const restored = await patchRows(restorePids);
  const after = await restJson<PoolRow[]>(
    `/mvp_candidate_pool?select=pid,profit_band,status,exposure_count,max_exposure,updated_at&pid=in.(${restorePids.join(",")})&limit=1000`,
  );

  const generatedAt = new Date().toISOString();
  const report = {
    generatedAt,
    mutationApplied: true,
    restorePids,
    before,
    restored,
    after,
    excluded: dryRun.rows.filter((row) => !restorePids.includes(row.pid)),
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "admin-spent-restore-apply-latest.json");
  const mdPath = path.join(reportsDir, "admin-spent-restore-apply-latest.md");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));

  const md = `# Admin Spent Restore Apply

- generatedAt: ${generatedAt}
- mutationApplied: true
- restored: ${restored.length}

## Restored Rows

${table(
  ["pid", "before", "after", "exp"],
  after.map((row) => {
    const prev = before.find((item) => item.pid === row.pid);
    return [row.pid, prev?.status, row.status, `${row.exposure_count ?? "-"} / ${row.max_exposure ?? "-"}`];
  }),
)}

## Excluded Rows

${table(
  ["pid", "decision", "live", "status", "nonAdmin"],
  report.excluded.map((row) => [row.pid, row.decision, row.liveDecision, row.status, row.nonAdminRevealCount]),
)}
`;

  await writeFile(mdPath, `${md}\n`);
  console.log(JSON.stringify({ generatedAt, restored: restored.length, jsonPath, mdPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
