# Wave 37 — 24h baseline 재측정 (BLOCKED: dev server offline)

> Status: **measure-only, blocked**. 실측 24h 측정 시도했으나 localhost dev server가 가동 중이지 않아 baseline 자체가 생산되지 않음. apply 0, cron 0.

## 1. Elapsed window

- 측정 db_now: **2026-05-13 20:09 UTC**
- Wave 35 gate ON: 2026-05-13 ~20:03 UTC
- 실제 elapsed: **약 6분**

24h 측정은 elapsed 자체가 부족. 그러나 더 큰 blocker가 별도로 존재 (§3).

## 2. Dev server 가동 여부 — **OFF**

Production runtime = localhost dev server (LAUNCH_PLAN §2.1). 두 가지 silent signal로 OFF 확인:

| Signal | Value | Expected if running |
|---|---:|---|
| `mvp_raw_listings.last_seen_at >= now() - 15m` | 0 | >0 (collect cron 5분 주기) |
| `mvp_raw_listings.last_seen_at >= now() - 1h` | 0 | >100 (collect/detail 진행 중) |
| `mvp_listing_ai_classifications` last_classified | 2026-05-13 16:40 UTC | recent |
| Cache rows since gate ON | 0 | depends |

**판정: localhost dev server는 Wave 35 gate ON 시점 이전부터 OFF 상태.** Wave 35는 코드/env에 반영됐지만 runtime이 죽어 있어 escrow path를 한 번도 실행하지 않았다.

## 3. Escrow 발화수 (실측)

| Flag | analysis count | pool leak |
|---|---:|---:|
| ai_escrow_pending | **0** | 0 |
| ai_escrow_held | **0** | 0 |
| ai_escrow_unavailable | **0** | 0 |
| resolved_pass (추정 — pending이 사라진 row) | **0** | n/a |

선택 (selected) 추정: scoreStage가 한 번도 안 돌았으므로 **0**.

## 4. Pool leak

```sql
SELECT count(*) FROM mvp_candidate_pool p
  JOIN mvp_listing_analysis a USING (pid)
  WHERE 'ai_escrow_pending'=ANY(a.score_flags)
     OR 'ai_escrow_held'=ANY(a.score_flags)
     OR 'ai_escrow_unavailable'=ANY(a.score_flags);
-- 0
```

**Pool leak = 0**. 그러나 escrow flag가 1건도 부여된 적이 없어 **negative confirmation 그대로**. positive confirmation (실제 escrow row가 pool에서 차단되는지)은 dev server 가동 + 실제 escrow 발화 이후에만 가능.

## 5. AI cache write 재개 여부

| Metric | Value |
|---|---:|
| total | 529 |
| last 24h | 195 (rolling slide만, gate ON 이후 0) |
| last 1h | 0 |
| since gate ON (~20:03 UTC) | **0** |

**재개 안 됨.** dev server OFF가 원인.

## 6. Cron sign-off 판정

**불가**. 다음 자료가 비어 있음:
- escrow 발화수 4개 (selected/resolved_pass/held/unavailable): 모두 0, 측정 불가
- escrow가 cache 증가량에 미치는 영향: 측정 불가
- escrow가 pool 진입을 실제로 차단하는지 (positive confirmation): 측정 불가
- cap=2가 binding constraint인지 (실제 발화 시 cap에 닿는지): 측정 불가

→ **cron sign-off 재제출 보류**.

## 7. 원칙 ack
- apply 추가 금지: ✓ (read-only SQL 4건만)
- cron live 등록 금지: ✓
- cap 변경 금지: ✓ (env 그대로)
- broad smartphone widening 금지: ✓ (변경 0)
- silent carrier 추정 금지: ✓ (변경 0)

## 8. 다음 액션

Wave 38은 **재측정 wave가 아니라 dev server preflight wave**. 순서:
1. owner가 `npm run dev` (또는 prod equivalent) 가동 + cron 워커가 들어오는지 확인
2. raw_seen_15m > 0 확인 후 1h 이상 가동 유지
3. eligible escrow row 1건 (현재 inventory)이 실제로 scoreStage를 통과하는지 stats log 확인
4. 그 결과로 Wave 38에서 baseline 재측정 + cron sign-off 자료 완성

체크리스트만 Wave 38에 넘기고, 본 wave는 측정 실패를 기록.

## 9. 변경/검증/위험
- 변경: 없음
- 검증: 3 read-only SQL (db_now / leak join / raw_seen)
- 위험: 없음 (측정만)
- 위험 신호: localhost dev server가 장기 OFF면 Bunjang 매물 inflow 자체가 멈춰 production candidate_pool stale 진행. owner에게 가동 확인 우선 요청.

## 10. 남은 blocker
1. **(신규)** localhost dev server 가동 — 측정 자체의 prerequisite
2. housekeeper cron + live merge — 측정 데이터 부족으로 sign-off 불가
3. (관찰) escrow eligible inventory 빈약 (1 row) — Wave 36 finding 그대로

→ **남은 blocker 2건** (#1, #2). #3은 정책 제약으로 의도된 결과.
