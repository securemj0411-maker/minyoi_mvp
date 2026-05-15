// 2026-05-15: Cron watchdog.
// 사용자 코멘트로 발견된 8시간 갭 (5/13 22시 ~ 5/14 06시 lifecycle-worker 완전 멈춤)
// 처럼 worker invocation 자체가 안 들어오는 사고를 즉시 감지.
//
// 동작:
// - tick 끝부분에서 매번 호출 (1-2분마다)
// - mvp_collect_runs.started_at 봐서 각 worker의 마지막 호출 시각 확인
// - 예상 주기 × 3배 이상 지나면 telegram 알림
// - 같은 worker 30분 cooldown (mvp_cron_locks의 watchdog_alert_<name> mode 활용)
//
// tick worker 자체가 멈추면 못 잡음 — 그건 외부 모니터링(UptimeRobot 등)이 필요.
//
// 2026-05-15 fix: target별 lookback window 동적 결정 (alertAfterMinutes × 1.5).
// 이전엔 전체 6시간 fixed lookback이었어서 24h 주기 worker (reference-price-refresh,
// compliance-retention 등) false positive 발생.

import { reportCriticalIncident } from "@/lib/operational-notifier";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type WatchdogTarget = {
  name: string;
  requestPath: string; // mvp_collect_runs.request_path prefix 매칭
  expectedMinutes: number; // 정상 호출 주기
  alertAfterMinutes: number; // 이 시간 이상 안 돌면 alert
};

// Wave 106: 운영 readiness audit. 진짜 stale 3개만 추가 추적.
// - landing-showcases / ai-cache-prune / compliance-retention: 별도 cron에서만 호출 (다른 cron 흡수 X). 24h 0회 = 진짜 stale.
// - collect / hotdeal-worker는 다른 cron 흡수 (tick:searchStage / pool-warmer:hotdeal stage) → 추적 제외 (의도).
//
// 2026-05-16 (베타 우선순위 정책): landing-showcases + housekeeper-ai-cache-prune watchdog 추적 제거.
// - landing-showcases: 베타 traffic 7명. 랜딩 stale 영향 작음. QStash 등록 안 해도 OK.
// - housekeeper-ai-cache-prune: 베타 traffic 작아 cache 누적도 작음. QStash 등록 안 해도 OK.
// - compliance-retention: 법적 책무. 추적 유지 + QStash 등록 권장.
// - reference-price-refresh: 시세 정확도. 사용자 선택. 추적 유지.
const WATCHDOG_TARGETS: WatchdogTarget[] = [
  { name: "lifecycle-worker", requestPath: "/api/cron/lifecycle-worker", expectedMinutes: 7, alertAfterMinutes: 21 },
  { name: "tick", requestPath: "/api/cron/tick", expectedMinutes: 2, alertAfterMinutes: 10 },
  { name: "detail-worker", requestPath: "/api/cron/detail-worker", expectedMinutes: 2, alertAfterMinutes: 10 },
  { name: "market-worker", requestPath: "/api/cron/market-worker", expectedMinutes: 60, alertAfterMinutes: 180 },
  { name: "pool-warmer", requestPath: "/api/cron/pool-warmer", expectedMinutes: 30, alertAfterMinutes: 90 },
  { name: "deep-crawl", requestPath: "/api/cron/deep-crawl", expectedMinutes: 60, alertAfterMinutes: 180 },
  { name: "housekeeper", requestPath: "/api/cron/housekeeper", expectedMinutes: 30, alertAfterMinutes: 90 },
  // landing-showcases: 베타 단계 추적 제외 (영향 작음).
  // housekeeper-ai-cache-prune: 베타 단계 추적 제외 (cache 작음).
  { name: "compliance-retention", requestPath: "/api/cron/compliance-retention", expectedMinutes: 1440, alertAfterMinutes: 2880 },
  { name: "reference-price-refresh", requestPath: "/api/cron/reference-price-refresh", expectedMinutes: 1440, alertAfterMinutes: 1800 },
];

const COOLDOWN_MINUTES = 30;

function lookbackMinutesForTarget(target: WatchdogTarget): number {
  // alertAfterMinutes × 1.5 (최소 6시간, 최대 48시간).
  // - 1440분(24h) 주기 worker는 ~45h lookback → 정상 호출 1-2회 잡힘.
  // - 2분 주기 worker는 minimum 6h lookback → 충분.
  return Math.max(360, Math.min(Math.round(target.alertAfterMinutes * 1.5), 48 * 60));
}

async function loadLastRunForTarget(target: WatchdogTarget): Promise<Date | null> {
  const lookbackMinutes = lookbackMinutesForTarget(target);
  const sinceIso = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
  // PostgREST `like` pattern: * in place of %.
  // request_path은 "/api/cron/X?wait=1" 형태라 prefix matching.
  const filterValue = `like.${target.requestPath}*`;
  const url = `${tableUrl("mvp_collect_runs")}?select=started_at&request_path=${encodeURIComponent(filterValue)}&started_at=gte.${encodeURIComponent(sinceIso)}&order=started_at.desc&limit=1`;
  try {
    const res = await restFetch(url, { method: "GET", headers: serviceHeaders() });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ started_at: string }>;
    if (rows.length === 0) return null;
    return new Date(rows[0].started_at);
  } catch {
    return null;
  }
}

async function tryAcquireAlertCooldown(workerName: string): Promise<boolean> {
  // mvp_cron_locks에 watchdog_alert_<name> mode로 lock 시도. 이미 lock 있으면 false → alert skip.
  // RPC: try_acquire_mvp_cron_lock(p_mode text, p_owner text, p_lease_seconds integer)
  //      returns (acquired boolean, owner text, lease_until timestamptz)
  const mode = `watchdog_alert_${workerName}`;
  try {
    const res = await restFetch(rpcUrl("try_acquire_mvp_cron_lock"), {
      method: "POST",
      headers: serviceHeaders(),
      body: JSON.stringify({
        p_mode: mode,
        p_owner: "watchdog",
        p_lease_seconds: COOLDOWN_MINUTES * 60,
      }),
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as Array<{ acquired?: boolean }>;
    return Boolean(rows[0]?.acquired);
  } catch {
    return false; // 호출 실패면 alert 안 보냄 (다음 tick에서 재시도).
  }
}

export async function checkCronWatchdog(): Promise<{
  checked: number;
  stale: { worker: string; minutesSinceLast: number }[];
  alertsSent: number;
}> {
  const stale: { worker: string; minutesSinceLast: number }[] = [];
  let alertsSent = 0;

  try {
    // target별 lookback 동적 (24h 주기 worker도 정확히 잡힘). 병렬 fetch (10개 쿼리 동시).
    const targetsWithLastRun = await Promise.all(
      WATCHDOG_TARGETS.map(async (target) => ({
        target,
        lastRun: await loadLastRunForTarget(target),
      })),
    );

    const now = Date.now();

    for (const { target, lastRun } of targetsWithLastRun) {
      if (!lastRun) {
        // lookback window 안에 한 번도 안 돔 → stale.
        const lookback = lookbackMinutesForTarget(target);
        stale.push({ worker: target.name, minutesSinceLast: lookback });
        const acquired = await tryAcquireAlertCooldown(target.name);
        if (acquired) {
          await reportCriticalIncident({
            source: "cron_watchdog",
            summary: `[${target.name}] ${Math.floor(lookback / 60)}시간+ 안 돔 (예상 ${target.expectedMinutes}분 주기)`,
            context: {
              worker: target.name,
              expectedMinutes: target.expectedMinutes,
              lookbackMinutes: lookback,
            },
          });
          alertsSent += 1;
        }
        continue;
      }

      const minutesSinceLast = (now - lastRun.getTime()) / 60_000;
      if (minutesSinceLast > target.alertAfterMinutes) {
        stale.push({ worker: target.name, minutesSinceLast: Math.round(minutesSinceLast) });
        const acquired = await tryAcquireAlertCooldown(target.name);
        if (acquired) {
          await reportCriticalIncident({
            source: "cron_watchdog",
            summary: `[${target.name}] ${Math.round(minutesSinceLast)}분째 안 돔 (예상 ${target.expectedMinutes}분 주기, threshold ${target.alertAfterMinutes}분)`,
            context: {
              worker: target.name,
              minutesSinceLast: Math.round(minutesSinceLast),
              expectedMinutes: target.expectedMinutes,
              lastRunAt: lastRun.toISOString(),
            },
          });
          alertsSent += 1;
        }
      }
    }
  } catch (err) {
    console.error("[cron-watchdog] error", err instanceof Error ? err.message : String(err));
  }

  return { checked: WATCHDOG_TARGETS.length, stale, alertsSent };
}
