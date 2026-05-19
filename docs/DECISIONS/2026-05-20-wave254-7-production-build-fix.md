# Wave 254.7 (2026-05-20) — production build FAILING → 5 deploy 모두 실패 root cause

## 발단 (사용자 발견)

사용자 직접 SQL 검증 — Wave 254.5/254.6 production 적용 0%:
- shoe v8 / bag v8 / clothing v8 records = **0건**
- v7 매물 condition_notes 채워진 비율 = **0%** (4,013건)
- 사용자 매물 pid 408858108 (가젤 볼드) 그대로 v4/mint, pid 331382713 (눕시 쇼츠) 그대로 v7/down_jacket

## 진단 결과 — 영역 A confirmed

### cron 정상 작동
- tick: 5min interval, duration 57-69s
- detail-worker: 3min interval, duration 6-8s
- 0 failures last 30min
- mvp_detail_queue:done 60건/5min (active)

### detail stage 99% failure (별도 wave 후속)
- claimed=200 매 tick / detailFailed=197~200 / enriched=0~3
- 대부분 매물이 delisted/API error/parse error
- pool skip 1순위: `sku_median_unavailable` (5~20건 매 tick)

### Vercel deploy queue 폭증 — 5 deployments in 1h
| created | commit | wave |
|---|---|---|
| 21:22:35Z | 59392a7 | (다른 agent 의 push) |
| 21:16:31Z | 8940f86 | Wave 254.6 |
| 20:49:11Z | c47f40f | Wave 254.5 step 2+3 |
| 20:37:00Z | 2b41044 | Wave 254.4 doc |
| 20:24:15Z | 4b10017 | Wave 254.5 step 1 |

각 push 가 새 Vercel build 트리거. 그러나 **모두 build 실패** → production 옛 코드 유지.

## **진짜 root cause — Vercel build TypeScript 오류**

`npx next build` 실행 결과:
```
./src/app/api/packs/pool/route.ts:354:28
Type error: Property 'first_seen_at' does not exist on type 'RawListingMeta'.
Did you mean 'last_seen_at'?
```

**이 오류는 내 Wave 254.5/254.6 코드가 아님** — 다른 wave (Wave 394.* P0-Upload feature) 가 박은 코드:
- `firstSeenAt: meta?.first_seen_at ?? null` (route.ts:354)
- 그런데 `RawListingMeta` type 정의에 `first_seen_at` 누락
- SELECT 쿼리 (route.ts:269) 는 first_seen_at 포함하지만 TypeScript type 만 누락
- Wave 394.* commit 직후부터 모든 build 실패

내 Wave 254.5/254.6 + Wave 394.* 의 모든 push 가 같은 broken build 위에 쌓여 **production 멈춤**.

## fix (additive only, 비파괴)

### 1. `src/app/api/packs/pool/route.ts`

`RawListingMeta` type 에 `first_seen_at: string | null` 추가 (SELECT 쿼리는 이미 박혀있음).

### 2. `src/components/user-reveal-dashboard.tsx`

`RevealItem.firstSeenAt` required 필드 — `nextItems.map` 에서 `firstSeenAt: null` fallback 추가 (reveal 이벤트는 시점 정보 없음).

### 3. `src/lib/rematch-helpers.ts`

`insertIgnoreRows<{ pid: number }>` generic 추론으로 `rowDefaults` 가 `Partial<{ pid: number }>` 만 허용 → `status`/`priority` 등 거부. fix: explicit `DetailQueueRow` type + generic param.

이 3개 fix 는 **모두 additive type 정의 보강** — 기존 runtime 동작 변경 없음.

## 검증

- `npx next build` ✅ pass (Wave 254 첫 push 후 처음 성공)
- `npm run test:core` 674 pass / 11 fail (pre-existing /me UI baseline)

## 효과 (Vercel deploy 정상화 후)

push 직후 Vercel 가 새 build 시작 → 성공 시 production cron 새 코드 load. 그러면:
1. Wave 254.5 step 1+2+3 (conditionFromTextFashion shoe/bag/clothing) 발현
2. Wave 254.6 (regex 우선순위) 발현
3. Wave 394.* P0-Upload feature 발현
4. LATEST_PARSER_VERSION_BY_CATEGORY (shoe v8 / bag v8 / clothing v8) 가 stale check → score_dirty=true 매물 (~5,315건) re-parse → v8 발현

자연 reparse 가능 매물 (score_dirty=true): 약 5,315건 / 매 tick 처리 5~23건 = 약 4시간 후 모두 발현.

score_dirty=false 매물 (~5,569건, pid 408858108 포함): 자연 reparse 안 됨. **사용자 명시 승인 시 manual rematch 필요**.

## 영역 B 후속 wave plan (whack-a-mole 종료, 별도 wave 255)

사용자 결정 필요:
1. **build status 자동 알림** — Vercel webhook → telegram. 매번 build 실패 즉시 알림 (이번처럼 5h 잠재 잘못 차단).
2. **parser_version drift auto-detection** — cron tick 마다 sample 100건 parser_version 검사 → drift > 5% 시 자동 score_dirty=true (manual rematch 불필요).
3. **deploy commit hash 검증** — production endpoint `/api/health` 가 build commit sha 노출 → 검증 가능.

## 자율 진행 정책 준수

✅ **additive type fix** — runtime 동작 변경 없음, 단지 TypeScript 시그니처 누락 보강
✅ **Vercel deploy 자동 트리거** (push commit) — empty commit 아닌 실제 build 수정 commit
❌ **destructive UPDATE / DELETE 안 함**
❌ **새 feature 추가 안 함**

## 미완 후속

1. **이번 push 후 Vercel build 완료 확인** (~5분)
2. **production cron 새 코드 load 확인** — shoe v8 첫 record 발현 측정
3. **사용자 매물 재검증** — pid 408858108, pid 331382713
4. **manual rematch trigger** — 사용자 명시 승인 시 17,623건 score_dirty=true
5. **영역 B wave 255** — build/deploy 자동 알림 + drift auto-detection
