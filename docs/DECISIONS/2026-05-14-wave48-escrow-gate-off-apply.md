# Wave 48 — Escrow gate OFF apply (owner sign-off)

> Status: **applied (env only).** DDL 0, 코드 변경 0, candidate_pool/public promotion 0, held rows 삭제 0. parser precision wave와 분리. Wave 47 권고대로 owner 사인오프 반영.

## 1. 적용 내역

| 항목 | 값 |
|---|---|
| `.env.local: AI_L2_ESCROW_PHASE2_ENABLED` | `1` → **`0`** |
| `.env.local: AI_L2_ESCROW_PHASE2_PER_RUN_CAP` | `2` 유지 (재활성 시 같은 cap 회복) |
| 코드 변경 | 없음 |
| DDL | 없음 |
| held rows 삭제 | 없음 (analysis_held 8 그대로) |
| pool/public promotion | 없음 |

Rollback: `.env.local`에서 `AI_L2_ESCROW_PHASE2_ENABLED=0` → `=1` 으로 되돌리고 dev server restart. 데이터 영향 0.

## 2. Runtime OFF 검증

`curl http://localhost:3000/api/cron/tick?force=1` (gate OFF 적용 후 첫 fire):

| Metric | Value |
|---|---:|
| ok | true |
| `score_phase2_escrow_gate_enabled` | **0** |
| `score_phase2_escrow_selected` | 0 |
| `score_needs_review_skipped` | 0 |
| ai_api_calls | 0 |

→ Next.js dev mode가 `.env.local` 변경을 인식, runtime이 OFF 분기로 진입.

## 3. Current-state DB 재측정

```sql
analysis_pending:    0
analysis_held:       8   ← Wave 47 그대로 보존
analysis_unavailable: 0
pool_leak:           0   ✓
cache_total:       560   ← 변동 없음 (escrow AI 호출 OFF 후 신규 0)
pool_total:        982
listings_total:  9,783
```

held 8 rows는 `ai_escrow_held` flag 유지 → pool-policy hard block 그대로 → user-facing 노출 0.

## 4. pack-open dry-run (`diagnose:pack-open`)

| band | sampled | wouldReveal | openLikely | liveChecked |
|---:|---:|---:|---:|---:|
| 1 | 16 | (생략) | true | 7 |
| 2 | 16 | 15 | true | 11 |
| 3 | 16 | 12 | true | 16 |

3 band 모두 `openLikely=true`. escrow gate OFF가 사용자 팩 오픈 시뮬에 부정적 영향 0.  
산출물: `reports/pack-open-dry-run-latest.{md,json}`.

## 5. db-hotpaths report (`report:db-hotpaths`)

- runs=120, failed=6, pg_stat=ok
- top suspect: tick worker 누적 함수시간 665s
- 산출물: `reports/db-hotpaths-2026-05-13.{md,json}`, `reports/db-hotpaths-latest.md`

gate OFF apply가 hotpath profile에 미치는 즉시 영향은 없음 (tick 자체는 기존 그대로 가동). escrow path는 dead branch가 되어 future profile에서 더 단순해질 예정.

## 6. Pool diagnose (`diagnose:pool`)

`ai_escrow_pending/held/unavailable` flag로 blocked된 row가 `blocked_*` 카테고리에 나타나지 않음. pool 진입을 시도하는 단계에서 이미 차단되고 진단 출력에는 다른 block flag (ai_second_opinion_hold, coarse_market_price 등)가 상위 노출. escrow flag는 inventory가 작아 별도 카테고리로 표시되지 않는 것 정상.

## 7. Escrow 최종 분포 보고서

| Metric | Final (gate OFF 직전 상태) |
|---|---:|
| selected (cumulative since Wave 35 gate ON) | 8 |
| resolved_pass | 0 |
| held | 8 |
| unavailable | 0 |
| pool_leak | 0 |
| AI cache writes via escrow path | 8 |
| AI cost via escrow path | ~$0.002 cumulative |
| pool entries gained from escrow | 0 |

산출물: `reports/wave47-escrow-soak-full-population-latest.json` (Wave 47 산출물 그대로 사업효과 보고서 역할).

## 8. 영향 분석 — 사용자 노출/팩

- **candidate_pool**: 982건 변동 없음. escrow가 진입 기여 0이었으므로 OFF 후에도 0.
- **mvp_listings**: 9,783건 그대로. escrow row는 scoreStage가 skip하여 listings에 안 들어가는 기존 동작 복원 (Wave 33 이전 동일).
- **pack-open**: 3 band 모두 openLikely=true. 노출 가능 inventory 변동 없음.
- **AI cache**: 560 rows, 향후 escrow 경로 AI write 0. legacy review path는 그대로 (smartwatch/earphone 등 high-conf 매물 review).

## 9. 원칙 ack
- gate OFF만 적용: ✓
- parser precision wave와 섞지 않음: ✓
- candidate_pool/public promotion 금지: ✓ (변화 0)
- 기존 held rows 삭제 금지: ✓ (8 rows 그대로)
- apply 후 재측정 (current-state / pack-open / db-hotpaths / escrow): ✓
- broad smartphone widening / silent carrier 추정 금지: ✓ (영구)

## 10. 변경/검증/위험
- 변경: `.env.local` 2 lines (값 변경 + 주석 갱신)
- 검증: tick gate=0 확인 / held=8 보존 / pool_leak=0 / pack-open 3 band openLikely=true / db-hotpaths runs=120 pg_stat=ok
- 위험: 매우 낮음. rollback 1줄.
- 다음: Wave 49 — (a) R3 contentHash 더블체크 path (retention 트랙 후속), 또는 (b) Wave 39 옵션 C parser storage 정확도 patch (별도 wave, escrow 재활성 prerequisite은 아님 — escrow는 dormant 유지)

## 11. 남은 blocker

| # | blocker | 상태 |
|---|---|---|
| 1 | R3 contentHash 더블체크 path | retention 트랙 후속 |
| 2 | parser storage 정확도 (Wave 39 옵션 C) | 정확성 트랙, escrow 의존 없음 |

→ **남은 blocker 2건.** escrow 관련 blocker는 모두 폐기.

## 12. 재활성 trigger (참고)
- Wave 39 옵션 C 진행 → needs_review iphone row 감소 + 남은 row의 conf 상승 → escrow eligible 모집단 재정의.
- 또는 narrow whitelist 추가 사인오프 (pro_max series storage variant SKU 별도 등).
- 둘 중 하나가 발생할 때까지 escrow는 dormant.
