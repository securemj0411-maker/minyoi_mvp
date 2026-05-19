// Wave 252.B step 1 (2026-05-20): clothing v3 매물 강제 rematch.
//
// 사용자 명시 정책:
//   - Wave 252.C helper (`triggerRematchForParserVersions`) 사용 — 직접 SQL UPDATE 금지
//   - dry-run sample 50건 먼저 → detail-worker 정상 확인 후 본 trigger
//   - 부하 모니터링 1h (15분 간격) — 큐 안 빠지면 즉시 중단
//
// 영향: wave216-clothing-v3 → 약 2,386 매물 (active 2,330, detail_done 1,828)
// 측정 시점 2026-05-20 16:xx KST.
//
// 사용법:
//   npx tsx scripts/wave252-b-step1-clothing-v3-rematch.ts --dry-run
//   npx tsx scripts/wave252-b-step1-clothing-v3-rematch.ts --apply
//
// 동작:
//   1. triggerRematchForParserVersions(['wave216-clothing-v3'], ..., { dryRun })
//   2. count + sample pids 콘솔 출력
//   3. dryRun=false 면 detail_status='pending' + score_dirty=true 박음
//   4. 다음 cron tick 부터 detail-worker 가 v7 reparse

import { triggerRematchForParserVersions } from "@/lib/rematch-helpers";

const PARSER_VERSIONS = ["wave216-clothing-v3"];
const REASON = "wave252-b-step1-clothing-v3";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const dryRun = !apply;

  console.log("[wave252-b-step1] start", {
    parserVersions: PARSER_VERSIONS,
    reason: REASON,
    dryRun,
    timestamp: new Date().toISOString(),
  });

  const result = await triggerRematchForParserVersions(
    PARSER_VERSIONS,
    REASON,
    { dryRun },
  );

  console.log("[wave252-b-step1] result", result);

  if (dryRun) {
    console.log(
      `\n[wave252-b-step1] dry-run only. ${result.count} listings would be rematched.\n` +
        `  Sample pids: ${result.samplePids.join(", ")}\n` +
        `  Run with --apply to actually trigger rematch.`,
    );
  } else {
    console.log(
      `\n[wave252-b-step1] APPLIED. ${result.count} listings rematch triggered.\n` +
        `  detail_status='pending' + score_dirty=true 박혔습니다.\n` +
        `  다음 cron tick (~5min) 부터 detail-worker 가 reparse 시작합니다.`,
    );
  }
}

main().catch((err) => {
  console.error("[wave252-b-step1] error", err);
  process.exitCode = 1;
});
