# Wave 190 + 191 (2026-05-18) reveal current_profit 자동 재계산 — 근본 fix Layer A+B+C

> **중요도: HIGH.** Wave 189 (표면 UI fix) 의 근본. DB level 자동 sync — 다른 API/시스템도 stale 값 안 봄.
>
> **⚠️ 다른 세션 주의 — 이미 박힘. 중복 작업 금지**:
> - `mvp_pack_reveals` schema 에 **이미 4 컬럼 추가됨**:
>   - `current_profit_min integer NULL`
>   - `current_profit_max integer NULL`
>   - `market_invalidated_at timestamptz NULL`
>   - `last_market_recompute_at timestamptz NULL`
>   - migration `wave190_reveal_current_profit_columns` 적용 완료
>   - partial index `mvp_pack_reveals_market_invalidated_idx` 도 박힘
> - RPC `public.recompute_reveal_current_profits(p_comparable_keys text[])` **이미 존재**
>   - migration `wave191_recompute_reveal_current_profits_rpc` 적용 완료
>   - SECURITY DEFINER, search_path public
> - `tick-pipeline.ts marketStatsStage` 끝에 **RPC 호출 hook 박힘** ([L3035 부근](../../src/lib/tick-pipeline.ts:3035) `markRawScoreDirtyByComparableKeys` 다음)
> - `api/packs/me/route.ts` 가 **current_profit_min / market_invalidated_at 우선 읽음**, snapshot fallback
>
> **다시 박지 마세요**:
> - schema column 다시 추가 X (이미 nullable 박혀있음)
> - 같은 의도의 RPC 재정의 금지 (이미 있음, 덮어쓰면 정책 충돌)
> - marketStatsStage 의 hook 중복 호출 금지
>
> **확장 가능한 부분 (별 wave)**:
> - Layer E (pool entry expected_profit 자동 갱신) — 현재 score_dirty + scoreStage 자동 처리 중. 추가 cron 박지 말 것
> - 무효화 status 라벨 UI 노출은 [Wave 189](2026-05-18-wave189-reveal-realtime-market-gap.md) 의 marketStale 분기 + [Wave 194](2026-05-18-wave194-current-profit-priority-ui.md) 의 "↓ 시세 갱신" 라벨 활용

## 사용자 의도

> "근본적인 해결 맞음?? 다음엔 다신 이런일 없게 할수있는거 맞음?"
> "아니 진행을 해야 해결되는거아니야?? 왜 나한테 물어보는거야?"

→ 표면 fix 박고 묻는 거 비합리적. 진행해야 fix.

## 사전 진단

Wave 189 = 표면 (UI 분기). DB 의 `mvp_pack_reveals.expected_profit_min/max` 는 reveal 시점 snapshot. 시세 갱신 시 자동 갱신 안 됨. **재계산 cron 없음** (사용자 추측 정답).

### Wave 190+191 = Layer A+B+C 묶음 박음:
- **A**: schema 분리 (`current_profit_*` + `market_invalidated_at` 컬럼 추가)
- **B**: 자동 재계산 cron (market-worker 후 trigger)
- **C**: 자동 무효화 status (`current_profit < 0` 시 `market_invalidated_at = now`)

Layer D (UI 분기) 는 Wave 189 가 이미 박음 — DB column 활용으로 backing 변경.
Layer E (pool entry 갱신) 는 별 wave (Wave 192).

## 변경

### 1. Migration `wave190_reveal_current_profit_columns`

```sql
ALTER TABLE public.mvp_pack_reveals
  ADD COLUMN IF NOT EXISTS current_profit_min integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS current_profit_max integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS market_invalidated_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_market_recompute_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS mvp_pack_reveals_market_invalidated_idx
  ON public.mvp_pack_reveals(market_invalidated_at)
  WHERE market_invalidated_at IS NOT NULL;
```

- `ADD COLUMN IF NOT EXISTS` + nullable default → 표준 safe migration
- 기존 `expected_profit_min/max` 그대로 — snapshot historical 의미로 재정의 (의미 변경, 데이터 X)
- partial index — `market_invalidated_at` 빈번 조회 대비

### 2. Migration `wave191_recompute_reveal_current_profits_rpc`

RPC `recompute_reveal_current_profits(p_comparable_keys text[])`:

```sql
CREATE OR REPLACE FUNCTION public.recompute_reveal_current_profits(p_comparable_keys text[])
RETURNS TABLE(updated_count integer, invalidated_count integer)
```

흐름:
1. `latest_market_per_key_cc` — 각 (comparable_key, condition_class) 별 최신 `blended_median_price`
2. `reveal_targets` — `p_comparable_keys` 의 reveal pid + 매물 price + parsed comparable_key + condition_class
3. `computed` — condition fallback chain (target → 'normal' → 첫 매칭) 으로 median 결정
4. UPDATE — `current_profit_min/max = median - price`, `market_invalidated_at = (gap < 0 ? now : NULL)`
5. RETURN updated_count, invalidated_count

- SECURITY DEFINER, search_path public
- median null 인 경우 (시세 0건) 갱신 skip → MacBook i3 같은 niche SKU 자연 처리
- 정상 회복 (gap >= 0) 시 `market_invalidated_at = NULL` 로 reset

### 3. `src/lib/tick-pipeline.ts` marketStatsStage hook (Layer B)

[L3033 부근](../../src/lib/tick-pipeline.ts:3033) `markRawScoreDirtyByComparableKeys` 후 RPC 호출 추가:

```ts
let revealRecomputeStats = { updated: 0, invalidated: 0 };
if (recomputedKeys.length > 0) {
  try {
    const recRes = await restFetch(rpcUrl("recompute_reveal_current_profits"), {
      method: "POST",
      headers: serviceHeaders(),
      body: jsonBody({ p_comparable_keys: recomputedKeys }),
    });
    const recRows = (await recRes.json().catch(() => [])) as Array<{ updated_count?: number; invalidated_count?: number }>;
    revealRecomputeStats = {
      updated: Number(recRows[0]?.updated_count ?? 0),
      invalidated: Number(recRows[0]?.invalidated_count ?? 0),
    };
  } catch (err) {
    console.error("recompute_reveal_current_profits failed (non-fatal)", { err: ... });
  }
}

stats.timingsMs = {
  ...,
  reveal_current_profit_updated: revealRecomputeStats.updated,
  reveal_current_profit_invalidated: revealRecomputeStats.invalidated,
};
```

- non-fatal try/catch — RPC 실패해도 market-worker 정상 진행
- `recomputedKeys` (시세 갱신된 comparable_key) 만 trigger — full sweep 부담 X
- stats 에 출력해서 운영 모니터링 가능

### 4. `src/app/api/packs/me/route.ts` (Layer D backing 변경)

- `RevealRow` 타입에 `current_profit_min/max`, `market_invalidated_at` 추가
- select column list 에 추가
- RevealItem 만들 때 우선순위: DB `current_profit_min` (Wave 190 갱신) > `fallbackGap` (실시간 marketBasis 계산)
- `marketStale = dbMarketInvalidatedAt != null || (fallbackGap < 0)`

backward compat — 옛 reveal (cron 미실행) 은 fallback 으로 표시 정상.

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### 로컬 실측 (force market-worker)

```
"reveal_current_profit_updated": 38
"reveal_current_profit_invalidated": 12
total: 20.9s
```

- 38 reveal 자동 갱신 (시세 갱신된 keys 의 모든 reveal)
- 12 reveal 추천 무효 박힘 (사용자 손해 위험 자동 감지)
- maxDuration 90 안전

### DB 검증 (사용자 본 매물)

| pid | name | snapshot | current | market_invalidated_at |
|---|---|---|---|---|
| 340669075 | 아이패드미니6 64기가 | +67,785 | **-168,000** | 2026-05-17 15:58 ✅ |
| 333471133 | 아이폰 16e 128GB 미개봉 | +42,850 | -225,000 | 2026-05-17 15:58 ✅ |
| 346960447 | 아이폰 15 Pro Max 512GB | +54,650 | -25,000 | 2026-05-17 15:58 ✅ |
| 402906942 | 맥북 에어 M1 13인치 | +43,935 | -190,000 | 2026-05-17 15:58 ✅ |
| 406738962 | 맥북 에어 i3 (시세 0건) | +48,375 | **null** | null ✅ (정상 — 시세 없음) |

→ **시세 < 매입가 매물 자동 무효화. 시세 0건 매물 자연 skip.**

## 안전성 분석 (whack-a-mole 검증)

| 변경 | 위험 | 영향 |
|---|---|---|
| Schema column 추가 (Wave 190) | ✅ 안전 | ADD COLUMN nullable IF NOT EXISTS. 기존 read X |
| RPC 신설 (Wave 191) | ✅ 안전 | SECURITY DEFINER, idempotent. UPDATE FROM CTE 표준 패턴 |
| market-worker hook (recompute call) | ⚠️ 측정됨 | non-fatal try/catch. 시간 +13s (7s → 21s) but maxDuration 90 안전 |
| API column 추가 read | ✅ 안전 | optional null fallback |
| pool entry expected_profit 미갱신 | ⚠️ 별 wave | **whack-a-mole 가능성 — Wave 192 (Layer E) 필요** |

### 남은 whack-a-mole — Layer E 미박음

reveal row 의 current_profit 은 갱신되지만 `mvp_candidate_pool` 의 `expected_profit_min/max` 는 그대로. → **새 reveal 받을 때 pool 의 stale 값으로 snapshot 박힘** = 새 reveal 도 같은 문제 발생 가능.

**Wave 192 (Layer E) — pool entry 갱신**:
- 같은 RPC pattern 으로 `recompute_pool_current_profits(p_comparable_keys text[])`
- 단 pool 의 expected_profit 정의가 candidate-pool-builder 의 식 (sellFee/shipping 차감) 이라 단순 `median - price` X. 정확한 식 적용 필요.
- market-worker 후 동시 호출

→ Wave 192 박아야 100% 근본 fix.

## 다음 (자동 진행 예정 항목)

| Wave | 내용 | 우선 |
|---|---|---|
| **192** | pool entry expected_profit 갱신 (Layer E — whack-a-mole 차단 최종) | **HIGH — 별 wave 로 즉시 진행** |
| 188 (보류) | catalog → search query 자동 매핑 | catalog 안정 후 |
| 187-followup | niche SKU reparse (i3 macbook needs_review) | low |

## Lesson

1. **자율 진행 정책 — 사용자 명확 의도 시 묻지 말 것**. memory "명확한 fix는 묻지 말고 진행". 본 wave 는 자율 진행 권장 case (사용자 두 번 명확 의도 표명).
2. **표면 fix → 근본 fix 단계적 박기**. Wave 189 (UI 분기) → Wave 190 (schema) → 191 (RPC + cron) → 192 (pool) 4 step. 각 step typecheck + 실측 + DB 검증.
3. **whack-a-mole 검증 = 각 layer 별 영향 표**. 본 wave 는 pool entry 만 남음 → Wave 192 즉시 후속.
4. **RPC 가 sweep 의 단일 source of truth** — N+1 patch X. UPDATE FROM CTE 패턴.
5. **null 처리 = 자연 skip 보장** — 시세 0건 매물 (i3 macbook) RPC 가 자동 무시. 별도 condition 없이 graceful.
