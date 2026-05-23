# launch-86 — safety-stats client timeout 3.5s → 8s (mobile cold start fix)

## 사용자 보고

> "근데 우리 푸쉬안함?? ... 나 방금 내폰으로 첫가입하고 해봤는데 몇 건 걸렀고 이런 정도 숫자가 안나오는데?? 말이 되나?"

## 진단

### DB 캐시는 정상 ✅
`mvp_safety_stats_snapshot` row (`scope_key = 'v2:global::::'`) 확인:
- `total_blocked_7d`: **14,860건**
- `total_reviewed_7d`: **15,080건**
- `profit_low_7d`: 453
- `needs_review_7d`: 7,421
- `listing_parts_7d`: 885
- updated_at: 26분 전 (30분 cron 정상 동작)

DB 자체엔 풍부한 데이터 있음. cron 도 살아있음.

### 진짜 원인: **Client fetch timeout 3.5s 부족**

`explore-client.tsx` 의 `SAFETY_STATS_FETCH_TIMEOUT_MS = 3500`.

모바일 첫 가입 환경:
- Vercel serverless cold start: ~0.5~1.5s
- DB snapshot read (`mvp_safety_stats_snapshot` 1 row select): ~100~300ms
- 4G TLS handshake: ~300~500ms
- 4G round-trip latency: ~200~500ms
- React state update: ~50ms

→ **합산 1.5~3s 라 3.5s timeout 에 빈번히 걸림**.

`loadSafetyStats` catch 분기 (timeout abort 포함):
```ts
} catch {
  // setSafetyStats 안 함 → null 유지
} finally {
  setSafetyStatsLoaded(true);  // 무조건 호출
}
```

→ `stats=null + statsLoaded=true` 상태.

`safetyRowsForExplore(null)` → 3 row 라벨 + value=null.
`formatStatMaybe(null, loaded=true)` → 빈 문자열 반환.

**사용자 본 화면**: row 라벨 ("돈 안 되는 것" / "거래 주의 신호" / "상품 확인 필요") + 숫자 빈칸. 정확히 일치.

### 추가 가능성 — Vercel deploy 진행 중

a5619f1 push 직후 (~2분 전) 사용자가 폰 가입. Vercel 자동 배포 진행 중이면 cold start 더 길어짐. deploy 끝나면 warm 상태로 자연 회복 가능.

## fix

```diff
- const SAFETY_STATS_FETCH_TIMEOUT_MS = 3500;
+ const SAFETY_STATS_FETCH_TIMEOUT_MS = 8000;
```

8s 정도 buffer:
- cold start 최악 ~1.5s
- DB read ~300ms
- TLS + RTT ~1s
- 여유 ~5s — abort 발생 거의 없음

3.5s 가 원래 설계 의도는 "너무 오래 기다리지 말고 fallback skeleton 보여주기" — 근데 fallback 도 비어있는 (raw 라벨만) 모양이라 의미 무. 차라리 8s 기다려서 진짜 데이터 확보가 UX 우위.

## 영향

### 정상 케이스
- desktop / WiFi: 평소 ~500ms 응답. timeout 영향 X (기존 동일).
- 모바일 LTE: ~1.5~2s. timeout 영향 X.

### Cold start / 4G
- 이전: 3.5s 넘으면 abort → 숫자 빈칸 (사용자 본 현상)
- 이후: 8s buffer → 거의 항상 응답 받음. 진짜 14,860건 표시.

### 정말 8s 넘는 경우
- abort → 같은 빈칸 fallback. 사용자 폰 환경 매우 느린 case (희박).

## 검증

- [x] TS 컴파일 통과 — explore-client.tsx 에러 0
- [ ] 폰 첫 가입 → 첫 피드 onboarding card 의 3 row 숫자 표시 확인 (사용자)
- [ ] Vercel deploy 완료 후 cold start 시 timeout 통과 확인

## 관련 파일

- [src/components/explore-client.tsx](../../src/components/explore-client.tsx:419) — `SAFETY_STATS_FETCH_TIMEOUT_MS`
- [src/app/api/public/safety-stats/route.ts](../../src/app/api/public/safety-stats/route.ts) — DB snapshot read 우선 (Wave launch-62)
- [src/app/api/cron/safety-stats-warmer/route.ts](../../src/app/api/cron/safety-stats-warmer/route.ts) — 30분 cron warmer

Owner: caulee1227@gmail.com / 2026-05-23
