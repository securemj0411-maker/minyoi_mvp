import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

async function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function supabaseRestBase() {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL missing");
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") + "/rest/v1";
}

function serviceHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
  };
}

function fileContains(relativePath: string, needle: string) {
  const absolute = path.join(appDir, relativePath);
  if (!existsSync(absolute)) return false;
  return readFileSync(absolute, "utf8").includes(needle);
}

async function probePoolEligibleColumn() {
  const url = `${supabaseRestBase()}/mvp_raw_listings?select=pid,pool_eligible&limit=1`;
  const started = Date.now();
  const res = await fetch(url, {
    headers: serviceHeaders(),
    signal: AbortSignal.timeout(8_000),
  });
  const body = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    durationMs: Date.now() - started,
    columnExists: res.ok,
    errorCode: res.ok ? null : body.match(/"code"\s*:\s*"([^"]+)"/)?.[1] ?? null,
    sanitizedMessage: res.ok
      ? "pool_eligible column selectable"
      : body.replace(/"details"\s*:\s*"[^"]*"/g, '"details":"<redacted>"').slice(0, 280),
  };
}

function buildMarkdown(report: {
  generatedAt: string;
  conclusion: string;
  probe: Awaited<ReturnType<typeof probePoolEligibleColumn>>;
  localChecks: Record<string, boolean>;
  decision: string;
  nextSteps: string[];
}) {
  return `${[
    "# Pool Eligibility Production Preflight",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- runtimePatchApplied: false",
    "- publicPromotion/candidatePoolPolicyWiring: false/false",
    "",
    "## Production Probe",
    "",
    `- pool_eligible selectable: ${report.probe.columnExists}`,
    `- status: ${report.probe.status}`,
    `- durationMs: ${report.probe.durationMs}`,
    `- errorCode: ${report.probe.errorCode ?? "null"}`,
    `- message: ${report.probe.sanitizedMessage}`,
    "",
    "## Local Checks",
    "",
    ...Object.entries(report.localChecks).map(([key, value]) => `- ${key}: ${value}`),
    "",
    "## Decision",
    "",
    `- ${report.decision}`,
    "",
    "## Next Steps",
    "",
    ...report.nextSteps.map((step) => `- ${step}`),
    "",
  ].join("\n")}\n`;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));
  mkdirSync(reportsDir, { recursive: true });

  const migrationPath = "supabase/migrations/202605121231_add_pool_eligible_to_raw_listings.sql";
  const probe = await probePoolEligibleColumn();
  const localChecks = {
    migrationFileExists: existsSync(path.join(appDir, migrationPath)),
    schemaContainsPoolEligible: fileContains("supabase/schema.sql", "pool_eligible boolean not null default true"),
    migrationContainsAddColumn: fileContains(migrationPath, "add column if not exists pool_eligible"),
    runtimeFilterAlreadyApplied: fileContains("src/lib/tick-pipeline.ts", "pool_eligible"),
  };

  const migrationReady =
    localChecks.migrationFileExists && localChecks.schemaContainsPoolEligible && localChecks.migrationContainsAddColumn;
  const conclusion = probe.columnExists
    ? "pool_eligible_column_exists_runtime_filter_can_be_reviewed_next"
    : migrationReady
      ? "pool_eligible_column_missing_migration_ready_runtime_patch_blocked"
      : "pool_eligible_column_missing_migration_not_ready";

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    productionDbMutation: false,
    runtimePatchApplied: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    probe,
    localChecks,
    conclusion,
    decision: probe.columnExists
      ? "Production DB has pool_eligible; next review can patch runtime pool loader filter and internal acquisition writer."
      : "Production DB does not expose pool_eligible; do not patch runtime query or apply internal acquisition writes yet.",
    nextSteps: probe.columnExists
      ? [
          "Patch loadScorableRows/candidate-pool loaders to require pool_eligible=eq.true.",
          "Patch internal acquisition writer to set pool_eligible=false.",
          "Run 20-row internal acquisition dry-run/apply only after pack-open and source-health checks remain healthy.",
        ]
      : [
          "Apply the migration draft only when owner explicitly approves a production DB schema change.",
          "After migration, rerun this preflight before any runtime code references pool_eligible.",
          "Continue no-write/category evidence work while migration is pending.",
        ],
  };

  const jsonPath = path.join(reportsDir, "pool-eligibility-prod-preflight-latest.json");
  const mdPath = path.join(reportsDir, "pool-eligibility-prod-preflight-latest.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(mdPath, buildMarkdown(report));

  console.log(
    JSON.stringify(
      {
        conclusion,
        columnExists: probe.columnExists,
        status: probe.status,
        errorCode: probe.errorCode,
        migrationReady,
        runtimeFilterAlreadyApplied: localChecks.runtimeFilterAlreadyApplied,
        jsonPath,
        mdPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
