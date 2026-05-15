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

import { reportCriticalIncident } from "@/lib/operational-notifier";
import { restFetch, rpcUrl, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

type WatchdogTarget = {
  name: string;
  requestPath: string; // mvp_collect_runs.request_path prefix 매칭
  expectedMinutes: number; // 정상 호출 주기
  alertAfterMinutes: number; // 이 시간 이상 안 돌면 alert
};

// Wave 106: collect / landing-showcases / housekeeper-ai-cache-prune / compliance-retention 추가.
// 측정 결과 4개 worker 가 24h 0회 실행 (silent fail) 발견. 새 매물 수집 + 랜딩 캐시 +
// AI cache 정리 + 개인정보 retention 모두 critical 운영 기능. watchdog 추적 의무.
// hotdeal-worker는 Wave 104 #3 inline integration 후 별도 호출 X — 추적 제외 (의도).
const WATCHDOG_TARGETS: WatchdogTarget[] = [
  { name: "lifecycle-worker", requestPath: "/api/cron/lifecycle-worker", expectedMinutes: 7, alertAfterMinutes: 21 },
  { name: "tick", requestPath: "/api/cron/tick", expectedMinutes: 2, alertAfterMinutes: 10 },
  { name: "detail-worker", requestPath: "/api/cron/detail-worker", expectedMinutes: 2, alertAfterMinutes: 10 },
  { name: "market-worker", requestPath: "/api/cron/market-worker", expectedMinutes: 60, alertAfterMinutes: 180 },
  { name: "pool-warmer", requestPath: "/api/cron/pool-warmer", expectedMinutes: 30, alertAfterMinutes: 90 },
  { name: "deep-crawl", requestPath: "/api/cron/deep-crawl", expectedMinutes: 60, alertAfterMinutes: 180 },
  { name: "housekeeper", requestPath: "/api/cron/housekeeper", expectedMinutes: 30, alertAfterMinutes: 90 },
  { name: "collect", requestPath: "/api/cron/collect", expectedMinutes: 5, alertAfterMinutes: 20 },
  { name: "landing-showcases", requestPath: "/api/cron/landing-showcases", expectedMinutes: 10, alertAfterMinutes: 30 },
  { name: "housekeeper-ai-cache-prune", requestPath: "/api/cron/housekeeper-ai-cache-prune", expectedMinutes: 360, alertAfterMinutes: 1080 },
  { name: "compliance-retention", requestPath: "/api/cron/compliance-retention", expectedMinutes: 1440, alertAfterMinutes: 2880 },
];

const COOLDOWN_MINUTES = 30;

async function loadLastRunByWorker(): Promise<Map<string, Date>> {
  // mvp_collect_runs는 큰 테이블이라 최근 6시간만 봄 (충분히 backstop)
  const sinceIso = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const url = `${tableUrl("mvp_collect_runs")}?select=request_path,started_at&started_at=gte.${encodeURIComponent(sinceIso)}&order=started_at.desc&limit=2000`;
  const res = await restFetch(url, { method: "GET", headers: serviceHeaders() });
  const rows = (await res.json()) as Array<{ request_path: string | null; started_at: string }>;
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (!row.request_path) continue;
    const existing = map.get(row.request_path);
    const cur = new Date(row.started_at);
    if (!existing || cur > existing) map.set(row.request_path, cur);
  }
  // request_path는 "/api/cron/lifecycle-worker?wait=1" 같은 형태. prefix matching 위해 별도 처리.
  return map;
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
    const lastRunMap = await loadLastRunByWorker();
    const now = Date.now();

    for (const target of WATCHDOG_TARGETS) {
      // request_path는 "/api/cron/X?wait=1" 형태 — prefix 매칭
      let lastRun: Date | null = null;
      for (const [path, time] of lastRunMap.entries()) {
        if (path.startsWith(target.requestPath)) {
          if (!lastRun || time > lastRun) lastRun = time;
        }
      }

      if (!lastRun) {
        // 6시간 안에 한 번도 안 돔 — 무조건 stale
        stale.push({ worker: target.name, minutesSinceLast: 360 });
        const acquired = await tryAcquireAlertCooldown(target.name);
        if (acquired) {
          await reportCriticalIncident({
            source: "cron_watchdog",
            summary: `[${target.name}] 6시간+ 안 돔 (예상 ${target.expectedMinutes}분 주기)`,
            context: { worker: target.name, expectedMinutes: target.expectedMinutes },
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
