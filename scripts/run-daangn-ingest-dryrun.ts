// Local dry-run of runDaangnIngest — DB write X, 결과만 측정.
// 운영 배포 코드와 동일 path 실행 → 효과 즉시 검증.

import { runDaangnIngest } from "../src/lib/daangn-ingest";

(async () => {
  console.log("=== Daangn ingest dry-run (전국 검색 mode) ===\n");
  const result = await runDaangnIngest({ dryRun: true });

  console.log("mode:           ", result.mode);
  console.log("skipped:        ", result.skipped, result.skipReason ?? "");
  console.log("durationMs:     ", result.durationMs);
  console.log("");
  console.log("combos:         ", result.combos);
  console.log("executedCombos: ", result.executedCombos);
  console.log("blockedCombos:  ", result.blockedCombos);
  console.log("failedCombos:   ", result.failedCombos);
  console.log("");
  console.log("articles:       ", result.articles);
  console.log("ongoing:        ", result.ongoing);
  console.log("crawlAllowedOngoing:", result.crawlAllowedOngoing);
  console.log("freshBoosted24h:", result.freshBoosted24h);
  console.log("activeBoosted72h:", result.activeBoosted72h);
  console.log("uniqueOngoingUrls:", result.uniqueOngoingUrls);
  console.log("");
  console.log("detailCandidates:", result.detailCandidates);
  console.log("detailFetched:  ", result.detailFetched);
  console.log("detailParsed:   ", result.detailParsed);
  console.log("");
  console.log("shipping:       ", JSON.stringify(result.shipping));
  console.log("rawUpserted:    ", result.rawUpserted, "(dryRun=true 이므로 0 정상)");
  console.log("");
  console.log("sourceHealth:   ", result.sourceHealthStatus, "/", result.sourceHealthReason);
  if (result.blockedSignals.length > 0) {
    console.log("blockedSignals: ", JSON.stringify(result.blockedSignals));
  }
})().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
