import { probeJoongnaPublicSource } from "@/lib/joongna";

async function main() {
  const report = await probeJoongnaPublicSource({
    maxSitemaps: Number(process.env.JOONGNA_PROBE_MAX_SITEMAPS ?? 1),
    maxProductUrls: Number(process.env.JOONGNA_PROBE_MAX_PRODUCT_URLS ?? 20),
    timeoutMs: Number(process.env.JOONGNA_PROBE_TIMEOUT_MS ?? 10_000),
  });

  console.log(JSON.stringify({
    ...report,
    note: "No database writes. Joongna source must remain off unless JOONGNA_SOURCE_MODE=shadow or active is explicitly set.",
  }, null, 2));

  if (report.decision === "stop_on_block_or_error") {
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(JSON.stringify({
    source: "joongna",
    ok: false,
    decision: "stop_on_block_or_error",
    error: err instanceof Error ? err.message : String(err),
  }, null, 2));
  process.exitCode = 1;
});
