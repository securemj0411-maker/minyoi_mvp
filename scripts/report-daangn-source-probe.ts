import {
  DAANGN_FASHION_CATEGORIES,
  DEFAULT_DAANGN_FASHION_QUERY_SEEDS,
  DEFAULT_DAANGN_REGION_SEEDS,
  type DaangnQuerySeed,
  type DaangnRegionSeed,
  probeDaangnPublicSource,
} from "@/lib/daangn";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function parseRegions(raw: string | undefined): DaangnRegionSeed[] {
  if (!raw?.trim()) return DEFAULT_DAANGN_REGION_SEEDS;
  return raw
    .split(",")
    .map((part) => {
      const [name, id] = part.split(":").map((entry) => entry.trim());
      return name && id ? { name, id } : null;
    })
    .filter((entry): entry is DaangnRegionSeed => Boolean(entry));
}

function parseQueries(raw: string | undefined): DaangnQuerySeed[] {
  if (!raw?.trim()) return DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((search) => ({
      label: "custom",
      search,
      categoryIds: [14, 31, 5],
    }));
}

async function main() {
  const report = await probeDaangnPublicSource({
    mode: process.env.DAANGN_SOURCE_MODE === "active" ? "active" : "probe",
    regions: parseRegions(process.env.DAANGN_PROBE_REGIONS),
    queries: parseQueries(process.env.DAANGN_PROBE_QUERIES),
    categories: DAANGN_FASHION_CATEGORIES,
    maxCombos: positiveInt(process.env.DAANGN_PROBE_MAX_COMBOS, 18),
    maxDetailSamples: positiveInt(process.env.DAANGN_PROBE_MAX_DETAIL_SAMPLES, 5),
    delayMs: positiveInt(process.env.DAANGN_PROBE_DELAY_MS, 650),
    timeoutMs: positiveInt(process.env.DAANGN_PROBE_TIMEOUT_MS, 10_000),
    freshWindowHours: positiveInt(process.env.DAANGN_PROBE_FRESH_HOURS, 24),
    activeWindowHours: positiveInt(process.env.DAANGN_PROBE_ACTIVE_HOURS, 72),
    staleBoostedDays: positiveInt(process.env.DAANGN_PROBE_STALE_DAYS, 21),
  });

  console.log(JSON.stringify({
    ...report,
    note: "No database writes. This probe only checks Daangn web payload viability for fashion/shoe source onboarding.",
  }, null, 2));

  if (report.decision === "stop_on_block_or_error") {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    source: "daangn",
    ok: false,
    writable: false,
    decision: "stop_on_block_or_error",
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});
