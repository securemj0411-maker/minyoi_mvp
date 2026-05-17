# 2026-05-17 시세 그래프 임계값 3→2 (fresh start 누적 부족)

## 사용자 보고

- 시간: 2026-05-17
- 보고: "근데 시세 그래프는 없앤거 아니지?? 지금 그래프 그려질 데이터가 없어서 그런거임??"
- 의도: 그래프 컴포넌트 살아있는지 + 데이터 부족 여부 확인.

## 진단

- 시간: 2026-05-17
- 검증 (supabase MCP `mvp_market_price_daily` 직접 쿼리):
  - 30 일 history: **2 일분만** (2026-05-16, 2026-05-17)
  - 90 일 가도 동일 — 5/16 이전 데이터 0
  - 첫 insert: 2026-05-15 18:38 UTC ≈ 5/16 03:38 KST (시스템 fresh start 시점)
  - market-worker 정상 동작: 5/16 (611 row) → 5/17 (987 row) 누적 중
- 발견: 그래프 컴포넌트 자체 살아있음 ([market-history-chart.tsx](../../src/components/market-history-chart.tsx)). 임계값 `data.length < 3` 에 막혀서 "시세 데이터 N일 — 3일 이상 누적되면 그래프 표시" 텍스트만 노출. 사용자 본 매물 대부분 동일 증상.

## 변경

- 시간: 2026-05-17
- 파일: [src/components/market-history-chart.tsx](../../src/components/market-history-chart.tsx)
- 위치: L95 부근

```ts
// Before
if (data.length < 3) {
  return <div>시세 데이터 {data.length}일 — 3일 이상 누적되면 그래프 표시</div>;
}

// After
if (data.length < 2) {
  return <div>시세 누적 1일째 — 내일부터 추이 그래프 자동 표시</div>;
}
```

- 임계값 3 → 2 점. 2 점 라인은 단일 시점보단 약하지만 그래프 자체 표시 가능.
- 메시지 카피 — "N일 이상 누적되면" → "내일부터 자동 표시" (구체적 시점 안내).

## 검증

- `npx tsc --noEmit` — 변경 파일 에러 0.
- DB 현재 상태 2 일 → fix 후 매물 모달 열면 2 점 active/sold 라인 + 현재 매물 가격 horizontal line 표시 가능.
- 5/18 부터는 3 일 누적 → 더 풍부한 라인 (의도 영역).

## 위험

- 2 점 라인 정보량 적음 — 사용자 "시세 추이" 보단 "현재 vs 어제" 비교 정도. 시간 흐르면서 자동 보강.
- 임계값 변경은 매물 모달 시세 시각에만 영향. 다른 곳 (admin pool, pack reveal 등) 에서 lazy MarketHistoryChart 도 동일 적용 — 동일 임계값 사용.
- DB fresh start 사유 미파악 — schema reset / TTL purge / 신규 배포 가능성. 후속 wave 에서 origin 추적 권장.

## 다음

- prod 배포 후 사용자 매물 모달 열어 라인 표시 확인.
- (선택) DB fresh start origin 추적 — `mvp_market_price_daily` 가 왜 5/16 부터인지 (schema migration / 신규 배포 vs 의도된 TTL).
- (선택) market-worker cron 주기 확인 — Vercel dashboard cron 설정 (코드에 vercel.json 없음).

## Lesson

UX 임계값 (그래프 최소 점 수 등) 은 시스템 성숙도 (데이터 누적 일수) 와 분리되어 hardcode 되면 fresh start 후 사용자 신뢰 brittle. data-aware threshold (e.g. "min 2 점 + 시점 시작일 안내") 가 더 견고.

또 사용자 문의 "그래프 없앤거 아니지?" — 미신 안내 부재 시 사용자가 시스템 회귀 / 정책 변경 의심. 자연 누적 단계 명시 카피 ("내일부터 자동 표시") 가 신뢰 보호.
