# Wave 36 — Phase 2 escrow 24h baseline (measure-only, sub-24h)

> Status: **measure-only**. apply 0, cron 등록 0. 24h 측정 의도였으나 **실제 elapsed window ≈ 2h** (Wave 35 apply 2026-05-13 ~20:03 UTC ↔ 측정 2026-05-13 20:05 UTC). 본 wave는 sub-24h interim baseline으로 기록하고, full 24h는 Wave 37로 이연.

## 1. Elapsed window

| 시점 | 시각 |
|---|---|
| Wave 35 view apply / gate ON | 2026-05-13 ~20:03 UTC |
| 본 측정 db_now | 2026-05-13 20:05 UTC |
| 마지막 AI cache write | 2026-05-13 16:40 UTC (gate ON 전) |
| Gate ON 이후 elapsed | **약 2분** |

→ 24h 측정은 불가. 본 측정은 "Wave 35 직후 즉시 상태" snapshot.

## 2. AI cache delta

| Metric | Wave 31 baseline | Wave 36 측정 | 비고 |
|---|---:|---:|---|
| total_rows | 529 | 529 | 변동 없음 |
| last 24h | 199 | 195 | rolling window slide만 (-4) |
| last 1h | — | 0 | Wave 35 이후 **신규 write 0건** |

해석: gate ON 이후 cache가 1건도 늘지 않았다. 두 가지 원인 가능:
1. **localhost dev server 미가동**: env 갱신 후 process 재기동 필요. tick cron이 들어오지 않으면 scoreStage도 안 돌고 AI 호출도 0.
2. **escrow eligible inventory 부족** (§4 참조): 1 row뿐이라 가동되어도 진행 매우 느림.

## 3. Pool leak 검증

```sql
SELECT
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_pending' = ANY(score_flags)) AS pending,
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_held' = ANY(score_flags)) AS held,
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_unavailable' = ANY(score_flags)) AS unavailable,
  (SELECT count(*) FROM mvp_candidate_pool p JOIN mvp_listing_analysis a USING (pid)
     WHERE 'ai_escrow_pending' = ANY(a.score_flags)
        OR 'ai_escrow_held' = ANY(a.score_flags)
        OR 'ai_escrow_unavailable' = ANY(a.score_flags)) AS pool_leak;
-- pending=0, held=0, unavailable=0, pool_leak=0
```

**Pool leak = 0**. pool-policy block flag가 정상 동작하는지 확인하는 부정형 검증 (escrow flag 부여된 row가 발생하면 pool에서 차단되는지) — 현재는 flag 자체가 부여된 row가 없어 negative confirmation. Wave 37 이후 실측 필요.

## 4. Escrow eligible inventory (production DB 스냅샷)

전체 needs_review iphone 분포:

| comparable_key | rows | max parse_conf |
|---|---:|---:|
| iphone\|iphone_16_pro_max\|unknown_storage | 27 | 0.60 |
| iphone\|iphone_15_pro_max\|unknown_storage | 25 | 0.60 |
| iphone\|iphone_16_pro\|unknown_storage | 13 | 0.45 |
| iphone\|iphone_16e\|unknown_storage | 12 | 0.55 |
| iphone\|iphone_15_pro\|unknown_storage | 12 | 0.55 |
| iphone\|iphone_15\|unknown_storage | 10 | 0.55 |
| iphone\|iphone_16\|unknown_storage | 9 | 0.45 |
| iphone\|iphone_13\|unknown_storage | 7 | 0.55 |
| iphone\|iphone_14_pro\|unknown_storage | 4 | 0.45 |
| iphone\|iphone_14\|unknown_storage | 4 | 0.45 |
| iphone\|iphone_13_pro_max\|unknown_storage | 3 | 0.45 |
| iphone\|iphone_12\|unknown_storage | 3 | 0.50 |
| iphone\|iphone_13_pro\|unknown_storage | 2 | 0.45 |
| iphone\|iphone_14_pro_max\|unknown_storage | 2 | 0.45 |

`SMARTPHONE_NARROW_PREFIXES` (iphone_{15,16,14,13,12}_pro) ∩ parse_confidence>=0.55 = **1 row** (iphone_15_pro 12개 중 conf≥0.55 1건).

**구조적 발견**:
- 모든 needs_review iphone row가 `|unknown_storage` 종결. parser가 storage 추출 실패한 게 needs_review의 주된 원인. (Wave 13 dry-run에서도 동일 패턴 관찰.)
- Pro_max는 narrow prefix 제외 — 의도적 (5 SKU whitelist). pro_max 추가는 별도 측정/사인오프 필요.
- parse_confidence 0.55 floor는 pro 시리즈에서 매우 빡빡 — iphone_15_pro만 0.55에 닿음, 16/14/13/12_pro는 0.45 (storage unknown으로 인한 penalty 추정).

## 5. Cap 2 유지 vs 상향 권고

**권고: cap 2 유지** (변경 0).

근거:
- inventory가 cap의 binding 제약이 아님 — eligible row 1건 < cap 2.
- recall 한계는 cap이 아니라 **parser parse_confidence + narrow prefix**. cap 상향은 무의미.
- 진짜 recall 확장 옵션은: (a) pro_max prefix 추가, (b) parse_confidence floor 0.55→0.45 완화. **둘 다 정확성 risk** — silent carrier/storage 추정으로 흐를 가능성 → 원칙 위반. 보류.

따라서 cap=2는 ramp 안전망으로 그대로. 다음 wave에서 실제 24h 측정 후 재평가.

## 6. Housekeeper cron 재제출 자료 (option B 결정 후 cron 보류 중)

24h 미달이라 cron 재제출 자료 완성 못함. 현재까지 정리된 숫자:
- cache 일 증가량 baseline: 195~199 rows/day (gate OFF 시절 기준)
- retention view R1/R2/R3: 0/0/0 (clean baseline)
- 첫 R1 발화 예측: 2026-06-08 (oldest 2026-05-09 + 30d)
- escrow가 cache 증가에 미치는 영향: 미측정 (full 24h 필요)

Wave 37에서 위 표를 채운 뒤 cron 재제출.

## 7. 원칙 ack
- broad smartphone widening 금지: ✓ (narrow whitelist 변경 0, pro_max 추가 보류)
- silent carrier 추정 금지: ✓ (parse_confidence 0.55 floor 유지)
- cron live 등록 금지: ✓ (option B 결정 그대로)

## 8. 변경/검증/위험
- 변경: 없음 (측정만)
- 검증: 5 read-only SQL + pool leak join
- 위험: 없음
- 다음: Wave 37 — full 24h elapse 후 재측정 + (a) localhost dev server 가동 확인 (b) escrow flag 실제 발화 수 측정 (c) cron 재제출 자료 완성

## 9. 남은 blocker
1. housekeeper cron + live merge (option B 보류, 24h 측정 미완)
2. (신규 관찰) escrow eligible inventory 빈약 — narrow prefix/conf floor 정책 그대로 가면 발화 매우 드묾. 사업 영향 적은 사실 확인은 Wave 37에서.

→ **남은 blocker 1건** (housekeeper cron, 측정 부족으로 Wave 37 대기).
