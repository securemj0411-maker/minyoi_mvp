# 2026-05-22 — Launch CRITICAL #8: Promise.allSettled 부분 실패 가드

## audit 발견
`/api/packs/pool/analysis` + `/api/packs/reveals/detail` 둘 다 동일 패턴:
```ts
const [marketStats, velocityStats, readinessMap, referencePrices, skuListingFlow, v7SiblingPresence]
  = await Promise.all([...6개 fetch...]);
```

`Promise.all` = 1개만 timeout / reject 나도 전체 throw → outer catch 가 analysis 전체 null
반환. UI 측 (explore-client / pack-reveal-modal) catch 가 silent fail → 사용자는 시세
미확정 안내 없이 expected_profit 그대로 신뢰.

**사용자 손해 risk** (잘못된 시세 기반 매입 결정).

## fix
두 endpoint 다 `Promise.allSettled` + `unwrap()` helper:

```ts
const results = await Promise.allSettled([...]);
function unwrap<T>(r, slot, fallback): T {
  if (r.status === "fulfilled") return r.value;
  console.warn(`[slot] failed`, { pid, err: ... });
  return fallback;
}
const marketStats = unwrap(results[0], "marketStats", new Map());
// 나머지 동일
```

추가 가드: `marketStats.size > 0` 일 때만 marketBasis 계산. 비었으면 null 반환 →
UI 가 "시세 확인중" 표시.

## 책임 분리
- **필수**: `marketStats` — 비면 marketBasis null
- **보조**: velocity / readiness / reference / skuFlow / v7Sibling — 실패 시 fallback 으로 동작

## 영향
- 코드: `src/app/api/packs/pool/analysis/route.ts`, `src/app/api/packs/reveals/detail/route.ts`
- DB: X
- UI: X (응답 형식 동일)
- 사용자 영향: 부분 실패 케이스에 더 많은 정보 표시 (이전엔 null = 아무 정보 X).
  단 marketStats 실패 시엔 동일 (marketBasis null).

## 검증
- TypeScript compile clean
- 부분 실패 시 console.warn 로 어느 slot 실패했는지 추적 가능
- Sentry 박혔으므로 warn 자동 캡처

## 메모리 룰
- 일반인 친화: 사용자 손해 차단 (잘못된 시세 기반 매입 차단)
- decision log: 이 파일
