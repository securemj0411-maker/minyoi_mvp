# 2026-05-22 — Launch CRITICAL #4: listing_state 'active' 가드 추가

## audit 발견 (TRUE positive)
`/api/packs/pool/route.ts:262-271` 가 `mvp_candidate_pool.status=eq.ready` 만 확인.
근데 `mvp_raw_listings.listing_state` 가 `sold_confirmed / disappeared / missing_suspect`
로 바뀌어도 lifecycle cron (`invalidatePoolEntries`) 이 안 돌면 candidate_pool.status
는 ready 그대로 → **죽은 매물이 사용자 풀에 노출**.

## 위험
- 사용자가 본 매물 click → 번개장터 가서 "판매완료" → 신뢰 박살
- lifecycle cron 30분만 lag 나도 stale 매물 노출
- wave505 freshness gate (parser 측) 와 다른 layer

## fix — server-side response 시점 active 가드
`/api/packs/pool/route.ts:339` 에 `listing_state` 컬럼 select 추가 + meta fetch 후
필터링:

```ts
// ready row 중 listing_state != 'active' 인 pid 차단
// soldOut row (status=invalidated) 는 의도적 노출 (sold_out 마스킹 디자인)
const blockedPids = new Set<number>();
for (const row of pool) {
  if (row.soldOut) continue;
  const meta = metaByPidLocal.get(row.pid);
  if ((meta?.listing_state ?? null) !== "active") blockedPids.add(row.pid);
}
// pool / raws / metas 셋 다 blockedPids 제외
```

- `listing_state` null 도 차단 (보수 — 옛 row 의심스러우면 빼는 게 안전)
- console.warn 로 차단 카운트 로깅 (운영 metric)

## 영향 분석
- 코드 변경: `/api/packs/pool/route.ts` 1 파일
- DB 변경 X
- 사용자 영향: 풀 매물 N% 감소 가능 (stale 매물 비율만큼) — 의도. ✅
- 운영자: lifecycle cron lag 시 사용자 노출 차단됨. 동시에 candidate_pool 의 stale
  row 발견 시그널 (warn 로그) 확보.

## sibling endpoint 검토 (후속)
- `/api/public/pool-listings` (peek-pool-7f3kz9) — listingState 응답에 포함됨,
  UI 측 마스킹 가능. 별 step 에서 가드 검토.
- `/api/admin/pool-listings` — 운영자가 stale 매물 보는 게 의도 (lifecycle 검증).
  가드 추가 X.

## 메모리 룰
- 일반인 친화: stale 매물 차단 = 신뢰 강화. 일반인 손해 방지 ✅
- 3 화면 일관성: 메인 풀 (pack-reveal-modal / user-reveal-dashboard) 입력 = 같은 endpoint,
  이미 일관. admin 풀은 별도 endpoint 라 의도적 분리.

## 검증
- TypeScript compile clean
- production 트래픽에서 console.warn "[pool] listing_state stale block" 모니터링
- 차단 카운트 > total_ready * 5% 면 lifecycle cron 점검 신호
