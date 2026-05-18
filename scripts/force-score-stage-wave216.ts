// Wave 216: score-stage 강제 trigger → dirty=true 매물 score 재계산 → candidate_pool 진입.
//
// 직전: marketStatsStage 호출 → mvp_market_price_daily clothing 119 keys 박힘 (high conf).
// 다음 병목: raw_listings clothing 1708 dirty=true 박혔지만 pool_eligible=0.
//          score-stage 가 dirty 매물 score 재계산 + candidate_pool 진입 결정.

import { scoreStage } from "@/lib/tick-pipeline";

async function main() {
  // 60초 deadline (enough for batch processing)
  const deadlineMs = Date.now() + 60_000;
  console.log("Starting scoreStage (Wave 216 trigger)...");
  const result = await scoreStage(deadlineMs);
  console.log("\n=== scoreStage result ===");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
