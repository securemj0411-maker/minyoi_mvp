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

  const limit = intArg("limit", Number(process.env.PIPELINE_MARKET_STATS_LIMIT ?? 2000));
  process.env.PIPELINE_MARKET_STATS_LIMIT = String(limit);

  const { marketStatsStage } = await import("@/lib/tick-pipeline");
  const result = await marketStatsStage();
  console.log(JSON.stringify({ limit, result }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
