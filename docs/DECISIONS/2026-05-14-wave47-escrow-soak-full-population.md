# Wave 47 — Escrow soak N=8 (full eligible population), 사업효과 판정

> Status: **measure-only.** apply 0, design 변경 0. soak drain 완료. **N=8 transitions, 100% held, 0% pass, 0% unavailable**. pool leak 0.

## 1. Inventory limit 확인 — N>50 은 구조적으로 불가능

- 현재 production DB에서 narrow whitelist 7 prefix + parse_confidence>=0.55 조건을 만족하는 needs_review iphone row = **총 9건**.
- Wave 38에서 본 "52건"은 max_conf 0.60인 SKU 그룹 row 총수였고, 같은 그룹 내에서도 row별 conf는 0.45 / 0.50 / 0.55 / 0.60으로 분포. 게이트(>=0.55) 통과 행 자체가 9건.
- N>50은 (a) inventory 증가 — 자연 inflow + 시간, (b) conf floor 완화 — silent 추정 위험 (원칙 위배), (c) whitelist 확장 — 추가 narrow 모델 사인오프 필요. 모두 본 wave 범위 밖.

## 2. Soak drain 결과 (manual tick 8회, 사실상 full population)

| Metric | Value |
|---|---:|
| selected (전 tick 합) | 8 |
| **resolved_pass** | **0** |
| **held** | **8** |
| **unavailable** | **0** |
| pool_leak | **0** |
| eligible_remaining (drain 후) | 1 (마지막 row가 다른 이유로 selected 안 됨 — score 또는 needs_review 토글 등) |
| sample coverage | 8/9 ≈ **89% of eligible population** |
| AI cache total | 529 → **560** (+31 since gate ON) |

`held rate = 100%`, `pass rate = 0%` on essentially-full population.

## 3. 해석 — AI 행동 패턴

8 row 전부 hold:
- 모두 `|unknown_storage` 종결 comparable_key.
- AI 프롬프트: storage가 명시되지 않은 description에서 normal+high 판정 안 함 → 보수적 hold.
- AI verdict가 일관됨 → 모델 noise/variance 문제 아니라 **데이터 자체의 결정성**.

이는 **AI L2 설계 의도와 부합**:
- "결정론이 못 잡는 row를 AI가 rescue" — 그러나 AI도 데이터 부족으로 rescue 불가 판정.
- AI는 "잘 모르겠으면 hold" 보수 정책을 유지하고 있음 → precision 안전.
- pool leak 0 유지 → user-facing 노출 보호됨.

## 4. 사업효과 판정

| 차원 | 측정 |
|---|---|
| pool 진입 추가 (escrow 덕분에 늘어난 pool 매물) | **0건** |
| 일 escrow AI 호출 (현실치) | 8건 / 본 wave 측정 윈도우 |
| 일 escrow AI 비용 | ~$0.002 (8 × 200 input + 50 output tokens × $0.4/1.6 per 1M) |
| pool leak risk | 0 |
| precision risk | 0 (hold만, pass 0) |
| 운영 복잡도 | escrow code path + cap + gate env + view + boost + 3 block flags 유지 비용 |

**ROI = 0** (lift 0 / 비용 미세 + 복잡도). pool block은 그대로 작동하고 있지만 escrow 덕분이 아니라 결정론 needs_review가 이미 잡고 있던 차단을 재확인할 뿐.

## 5. 권고 — **gate OFF**

근거:
1. 9건 모집단 중 8/8 held = 100% (1개 행 미관찰 포함해도 pass 발생 확률은 매우 낮음).
2. pass rate 0%면 escrow는 user-facing pool 기여 0. 비용은 미세하지만 0 아님.
3. 결정론이 이미 needs_review로 잡아 scoreStage skip하는 흐름이 동일한 결과 (pool 차단)를 만든다. 굳이 AI 거치지 않아도 됨.
4. 운영 복잡도 (escrow path / boost / 3 block flags / view) 유지 비용 > 사업 lift.
5. 향후 (a) parser storage 정확도 patch (Wave 39 option C) 또는 (b) narrow whitelist 확장 사인오프 (Wave 39 option A 추가 모델) 시점에 재평가 가능. 그때까지 dormant.

### gate OFF가 안전한 이유 (rollback risk 검토)
- env 1줄 unset → `evaluatePhase2Escrow` default OFF 경로. needs_review row가 scoreStage에서 skip되는 기존 동작 복원.
- analysis_held=8 row는 그대로 유지 (pool-policy block flag 그대로 → 노출 안 됨).
- code 변경 0. R3 view / housekeeper cron은 별도 트랙으로 유지.
- 향후 재활성 시 env 1줄 set하면 즉시 재가동.

## 6. 원칙 ack
- broad smartphone widening 금지: ✓ (whitelist 변경 0)
- silent carrier 추정 금지: ✓ (conf floor 변경 0)
- gate ON 유지로 soak 완료: ✓ (본 wave 측정 동안 ON)
- soak로 자연 누적 측정만: ✓ (apply 0, design 변경 0)

## 7. 변경/검증/위험
- 변경: 없음 (score_dirty 재마킹 = runtime trigger)
- 검증: 8 transitions 전수 held, pool leak 0, cache write 정상
- 위험: 권고 적용 시 (env 1줄 unset) rollback 1줄, 데이터 손실 0
- 다음: Wave 48 — owner 결정 (gate OFF apply vs continue soak with whitelist 확장 사인오프)

## 8. 남은 blocker (재정렬)

| # | blocker | 상태 |
|---|---|---|
| 1 | escrow 사업효과 판단 | ✅ 본 wave 판정 (gate OFF 권고) |
| 2 | R3 contentHash 더블체크 path | retention 트랙 후속 |
| 3 | (조건부) gate OFF apply 사인오프 | 본 wave 권고에 대한 owner 결정 |

→ **남은 blocker 2건** (#2, #3). #1 폐기.

## 9. 추천 한 줄
**gate OFF 후보** — N=8/9 full-population 100% held, pass 0%, lift 0. 운영 복잡도 회수 안 됨.
