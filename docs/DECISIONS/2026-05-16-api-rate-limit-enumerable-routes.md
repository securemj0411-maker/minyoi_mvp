# 2026-05-16 — API rate limit (enumeration 가능 endpoint)

## 트리거
Iteration 6 API/route 보안 audit (Explore agent). 40 routes 점검, 5 case 발견. 그 중 의도된 공개 + admin 보호 제외하면 진짜 hole 2개.

## 문제
| Route | 문제 | 우선순위 |
|---|---|---|
| `/api/market/history` | rate limit 없음. comparable_key 알면 시세 히스토리 전수 추출 가능. | MED |
| `/api/listings/[pid]/market-source` | rate limit 없음. pid enumeration으로 모든 매물 시세 근거 fetch 가능 + 쿼리 무거움 (3 parallel REST + max 30 comparables). | MED |

audit에서 발견된 다른 케이스 (별도 처리 / 보류):
| Route | 진단 |
|---|---|
| `/api/debug/agent-bridge`, `/api/debug/reset-db` error.message leak | admin 4중 가드라 fix 우선순위 낮음. 별도 wave에서 console.error + generic message로 통일 가능 |
| `/api/packs/preview-inventory` 높은 rate limit | 의도된 공개 + default 환경변수 기반. 사용자 결정 필요 |

## Fix

### `src/app/api/market/history/route.ts`
- `checkRateLimit({ bucketKey: market-history:<ip>, maxRequests: 30, windowSeconds: 60 })`.
- 일반 사용자 충분 (카드 reveal 모달 1회 호출). abuse만 차단.

### `src/app/api/listings/[pid]/market-source/route.ts`
- `checkRateLimit({ bucketKey: market-source:<ip>, maxRequests: 60, windowSeconds: 60 })`.
- pid enumeration 차단. 시세 근거 fetch는 사용자가 카드별로 1회 클릭이라 60/min 충분.
- 첫 줄 주석도 update (auth 제거가 의도된 변경임 명시).

## 검증
- TypeScript: validator.ts 외 무에러.
- ESLint: 2 routes 무에러.
- rate-limit lib은 `RATE_LIMIT_ENABLED=1` env 변수로 활성. env 0이면 fail-open (안전).

## 보류 / 다음
- agent-bridge/reset-db error.message leak: 별도 wave에서 generic message로 통일.
- preview-inventory rate limit lowering: 사용자 결정 필요 (UX 영향 가능성).
- Production에서 `RATE_LIMIT_ENABLED=1` 확인 필요. 0이면 위 fix 효과 없음 (fail-open).
