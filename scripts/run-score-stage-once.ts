import { readFile } from "node:fs/promises";
import path from "node:path";

const appDir = process.cwd();

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

function argValue(name: string) {
  const prefix = `--${name}=`;
  const exact = process.argv.find((arg) => arg.startsWith(prefix));
  if (exact) return exact.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function intArg(name: string, fallback: number) {
  const raw = argValue(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function main() {
  await loadEnvFile(path.join(appDir, ".env.local"));
  await loadEnvFile(path.join(appDir, ".env"));

  const limit = intArg("limit", Number(process.env.PIPELINE_TICK_SCORE_LIMIT ?? 1000));
  const budgetMs = intArg("budget-ms", Number(process.env.PIPELINE_TICK_SCORE_BUDGET_MS ?? 90_000));

  process.env.PIPELINE_TICK_SCORE_LIMIT = String(limit);
  process.env.PIPELINE_TICK_SCORE_BUDGET_MS = String(budgetMs);
  // Bulk backfill pass: keep the regular score-stage AI review path, but disable the extra shadow audit fanout.
  process.env.AI_L2_SHADOW_AUDIT_ENABLED = process.argv.includes("--shadow-audit") ? "1" : "0";

  const { scoreStage } = await import("@/lib/tick-pipeline");
  const result = await scoreStage(Date.now() + budgetMs);

  console.log(JSON.stringify({
    limit,
    budgetMs,
    shadowAudit: process.env.AI_L2_SHADOW_AUDIT_ENABLED,
    result,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
