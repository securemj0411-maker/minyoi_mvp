// Wave 216 (2026-05-19): clothing parser fix 후 시세 daily 강제 trigger.
//
// 문제: market-worker cron 은 1시간 간격 (다음 cron 까지 46분 대기).
//       사용자 답답함 — 즉시 결과 확인 필요.
//
// fix: marketStatsStage 직접 호출 → production 로직 그대로 적용 (idempotent).
//      mvp_market_key_invalidation 146 clothing keys 시세 daily 박힘.

import { marketStatsStage } from "@/lib/tick-pipeline";

async function main() {
  console.log("Starting marketStatsStage (Wave 216 clothing trigger)...");
  const result = await marketStatsStage();
  console.log("\n=== marketStatsStage result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
