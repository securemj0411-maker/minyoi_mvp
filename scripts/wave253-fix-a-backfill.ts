// Wave 253 fix A (2026-05-20): detail_status='pending' 매물 mvp_detail_queue backfill.
//
// 배경 (Wave 253 진단):
//   Wave 252.C helper bug — `mvp_raw_listings.detail_status='pending'` PATCH 만 박고
//   `mvp_detail_queue` INSERT 누락. detail-worker `claim_mvp_detail_queue` RPC 로만
//   작업 수신 → queue 비어있는 14,177 매물 영영 reparse 안 됨.
//
// 본 script:
//   1. mvp_raw_listings 에서 `detail_status='pending' AND listing_state='active'` 14,177 매물 fetch.
//   2. 그 중 mvp_detail_queue 에 이미 pending 으로 있는 매물 skip (INSERT IGNORE 라 어차피 skip 되지만 미리 측정).
//   3. 본 INSERT IGNORE — chunk 1000.
//   4. 사용자 가드:
//      - --dry-run-limit=N : dry-run mode (N pid 만 sample 처리, 실제 INSERT 안 함).
//      - --apply : 본 실행 (INSERT IGNORE).
//      - --apply-limit=N : N pid 만 INSERT IGNORE (단계 적용 — sample 1000 먼저).
//
// 사용:
//   npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --dry-run-limit=1000
//   npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --apply-limit=1000   # 본 sample 1k 먼저
//   npx tsx --env-file=.env.local scripts/wave253-fix-a-backfill.ts --apply              # 본 전체 14,177

import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

const REASON = "wave253-fix-a-backfill";
const DETAIL_QUEUE_REMATCH_PRIORITY = 50;
const INSERT_CHUNK = 1000;
const PAGE = 1000;

type Args = {
  apply: boolean;
  applyLimit?: number;
  dryRunLimit: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let apply = false;
  let applyLimit: number | undefined;
  let dryRunLimit = 1000;
  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg.startsWith("--apply-limit=")) {
      apply = true;
      applyLimit = Number(arg.slice("--apply-limit=".length));
    } else if (arg.startsWith("--dry-run-limit=")) {
      dryRunLimit = Number(arg.slice("--dry-run-limit=".length));
    } else if (arg === "--dry-run") {
      apply = false;
    } else {
      console.warn(`[wave253-fix-a-backfill] unknown arg: ${arg}`);
    }
  }
  return { apply, applyLimit, dryRunLimit };
}

async function fetchPendingPids(limit: number | undefined): Promise<number[]> {
  // mvp_raw_listings 에서 detail_status='pending' + listing_state='active' pid list.
  // limit 있으면 그만큼만, 없으면 페이지네이션으로 모두 수집.
  const allPids: number[] = [];
  let offset = 0;
  while (true) {
    const remaining = limit ? Math.max(0, limit - allPids.length) : PAGE;
    if (limit && remaining === 0) break;
    const pageLimit = limit ? Math.min(PAGE, remaining) : PAGE;
    const url = `${tableUrl("mvp_raw_listings")}?select=pid&detail_status=eq.pending&listing_state=eq.active&order=pid.asc&limit=${pageLimit}&offset=${offset}`;
    const res = await restFetch(url, { headers: serviceHeaders() });
    const rows = (await res.json()) as Array<{ pid: number }>;
    if (rows.length === 0) break;
    allPids.push(...rows.map((r) => Number(r.pid)));
    if (rows.length < pageLimit) break;
    offset += pageLimit;
    if (limit && allPids.length >= limit) break;
  }
  return allPids;
}

async function countAlreadyInQueue(pids: number[]): Promise<number> {
  // mvp_detail_queue 에 이미 pending 으로 있는 pid 수 측정 (INSERT IGNORE 가 skip 할 수).
  // pid IN(...) 으로 한 번에 측정. 14k pid 는 URL 길이 ~140KB 이므로 chunk 1000.
  let totalAlreadyInQueue = 0;
  for (let i = 0; i < pids.length; i += 1000) {
    const chunk = pids.slice(i, i + 1000);
    const url = `${tableUrl("mvp_detail_queue")}?select=pid&pid=in.(${chunk.join(",")})&status=eq.pending&limit=1`;
    const res = await restFetch(url, {
      headers: { ...serviceHeaders(), Prefer: "count=exact" },
    });
    const totalRaw = res.headers.get("content-range")?.split("/")?.[1] ?? "0";
    totalAlreadyInQueue += Number(totalRaw) || 0;
  }
  return totalAlreadyInQueue;
}

async function enqueueDetailQueue(pids: number[]): Promise<number> {
  const triggeredAt = new Date().toISOString();
  let inserted = 0;
  for (let i = 0; i < pids.length; i += INSERT_CHUNK) {
    const chunk = pids.slice(i, i + INSERT_CHUNK);
    const rows = chunk.map((pid) => ({
      pid: Number(pid),
      status: "pending",
      priority: DETAIL_QUEUE_REMATCH_PRIORITY,
      available_at: triggeredAt,
      locked_at: null,
      locked_until: null,
      last_error: null,
      updated_at: triggeredAt,
    }));
    // PostgREST: `Prefer: resolution=ignore-duplicates` + `on_conflict=pid` 둘 다 필요.
    // 없으면 unique constraint violation 23505 raise (Wave 253 fix A apply 첫 시도 발견).
    await restFetch(`${tableUrl("mvp_detail_queue")}?on_conflict=pid`, {
      method: "POST",
      headers: { ...serviceHeaders("resolution=ignore-duplicates,return=minimal") },
      body: JSON.stringify(rows),
    });
    inserted += chunk.length;
    console.log(`[wave253-fix-a-backfill]   chunk ${i / INSERT_CHUNK + 1} INSERT IGNORE ${chunk.length} pids — total ${inserted}/${pids.length}`);
  }
  return inserted;
}

async function main(): Promise<void> {
  const args = parseArgs();
  console.log("[wave253-fix-a-backfill] start", { args, timestamp: new Date().toISOString() });

  // Step 1: pending pid list fetch.
  const fetchLimit = args.apply ? args.applyLimit : args.dryRunLimit;
  const allPids = await fetchPendingPids(fetchLimit);
  console.log(`[wave253-fix-a-backfill] fetched pending pids: ${allPids.length}${fetchLimit ? ` (limit=${fetchLimit})` : ""}`);
  if (allPids.length === 0) {
    console.log("[wave253-fix-a-backfill] nothing to backfill — exit");
    return;
  }

  // Step 2: 이미 queue 에 있는 pid 측정 (사용자 측정용 — INSERT IGNORE 가 어차피 skip).
  const alreadyInQueue = await countAlreadyInQueue(allPids);
  console.log(`[wave253-fix-a-backfill] already in mvp_detail_queue (pending): ${alreadyInQueue}/${allPids.length}`);
  const toBeNewlyInserted = allPids.length - alreadyInQueue;
  console.log(`[wave253-fix-a-backfill] expected new INSERT IGNORE: ${toBeNewlyInserted}`);

  // Step 3: sample 출력 (사용자 검증).
  const samplePids = allPids.slice(0, 10);
  console.log(`[wave253-fix-a-backfill] sample pids (10): ${samplePids.join(", ")}`);

  // dry-run 종료.
  if (!args.apply) {
    console.log(
      `\n[wave253-fix-a-backfill] DRY-RUN complete. ${allPids.length} pids fetched, ${toBeNewlyInserted} would be INSERT IGNORE.\n` +
        `  Run with --apply-limit=1000 (sample) or --apply (full ${allPids.length}) to actually INSERT.\n`,
    );
    return;
  }

  // Step 4: INSERT IGNORE.
  console.log(`\n[wave253-fix-a-backfill] APPLY — INSERT IGNORE ${allPids.length} pids (chunk ${INSERT_CHUNK})`);
  const inserted = await enqueueDetailQueue(allPids);
  console.log(`\n[wave253-fix-a-backfill] APPLIED. ${inserted} INSERT IGNORE issued (${toBeNewlyInserted} expected new).\n` +
    `  검증: SELECT COUNT(*) FROM mvp_detail_queue WHERE status='pending';\n` +
    `  detail-worker 가 다음 cron tick 부터 process 시작.\n`);
}

main().catch((err) => {
  console.error("[wave253-fix-a-backfill] error", err);
  process.exitCode = 1;
});
