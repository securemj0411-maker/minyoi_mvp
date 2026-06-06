# Wave 1194 — 배터리 health 추출 결함 fix (애플워치 64% vs 88% 같은 시세군)

날짜: 2026-06-06
관련: option-parser parseBatteryHealth, condition_class low_batt, condition-chip-policy

## owner 발견 (정확한 진단)

애플워치6 나이키 40mm 두 매물:
- **매물 A**: "베터리 용량 ... 64% 였습니다" + 잔기스 많음, 48,000원
- **매물 B**: "배터리 성능은 88%" + 사용감 있음, 76,000원 (거래완료)

→ 둘이 **같은 시세 비교군(worn)** 으로 묶임.
owner: "배터리 64%+잔기스랑 88%+사용감이 '사용감 있다'는 사실로 같은 분류?? 배터리 효율은 키워드 잡아서 chip 안 하나?? **키워드부터 못 잡는 건지**"

→ owner 진단 정확. **키워드부터 못 잡았다.**

## 근본 원인 — `parseBatteryHealth` 정규식 3중 결함 (option-parser.ts 905)

기존:
```
/(?:배터리\s*)?(?:효율|성능)\s*[:：]?\s*(100|9[0-9]|8[0-9]|7[0-9])\s*%?/
```

1. **숫자 `7[0-9]~100`** = 70~100%만 인식. **60%대 이하(열화 심한 케이스) 아예 못 읽음.** 가장 가치 낮은 매물을 못 거름.
2. **"효율|성능"만** = "용량/헬스/수명" 누락 + **조사("성능은") 못 건넘**. → 매물 B "성능은 88%"도 OLD에선 null.
3. **"배터리"만** = "베터리/밧데리" 오타 누락. → 매물 A "베터리" 못 잡음.

매물 A는 ①②③ 3중 miss, 매물 B는 ②(조사) miss → **둘 다 batteryHealth=null** → low_batt 안 됨 → 같은 worn 군. owner가 본 버그.

## 인프라는 완비돼 있었음 (parser 입구만 막힘)

```
parseBatteryHealth → batteryHealth
  → option-parser 1566: batteryHealth < 85 → "low_battery_health" note
    → option-parser 114: → condition_class = "low_batt"
      → condition-policy 54: low_batt = condition_class 별도 grouping (시세 비교군 분리)
      → condition-chip-policy 46: "condition:low_battery_health" = SOFT_ADJUSTMENT chip (화면 표시)
      → profit 33: low_batt면 chip penalty skip (중복 차감 방지)
```

즉 **64%만 제대로 잡으면** → low_batt 별도 시세군 + "배터리 성능 저하" chip 자동. parser가 못 잡아 체인 전체가 안 돈 것.

## fix — 정규식 4개로 보강

```
/(?:배터리|베터리|밧데리|빳데리|바테리)?\s*(?:효율|성능|헬스|health|수명)\s*(?:은|는|이|가)?\s*[:：]?\s*(100|[1-9][0-9])(?!\d)\s*%?/
/(?:배효)\s*[:：]?\s*(100|[1-9][0-9])(?!\d)\s*%?/
/신품\s*대비\s*(100|[1-9][0-9])(?!\d)\s*%?/
/(?:배터리|베터리|밧데리|빳데리|바테리)[^.!?\n]{0,20}?(100|[1-9][0-9])(?!\d)\s*%(?!\s*(?:충전|남|정도))/
```

- ① 숫자 `[1-9][0-9]~100` (10~100%) + `(?!\d)`로 "256gb" 저장용량 trap 차단
- ② 키워드 효율/성능/헬스/health/수명 + 조사(은/는/이/가) 허용 (용량/상태는 저장용량·일반상태 충돌로 키워드에서 제외 — 자연어 fallback이 "배터리 용량 64%" 커버)
- ③ 오타 베터리/밧데리/빳데리/바테리
- ④ 자연어 fallback: 배터리류 키워드 20자 내 NN% (단 "충전/남음/정도" = 충전잔량 표현 배제)

### 테스트 12 케이스 통과 (false positive 0)
| 입력 | 결과 |
|---|---|
| "베터리 용량 ... 64%" (매물 A) | 64 ✓ |
| "배터리 성능은 88%" (매물 B) | 88 ✓ |
| "배터리 50% 충전해서" (충전잔량 trap) | null ✓ |
| "저장 용량 256gb" (저장용량 trap) | null ✓ |
| "배터리 용량 256gb 모델" | null ✓ (% 없음) |
| "배터리효율 78%" (붙여쓰기) | 78 ✓ |
| "밧데리 성능 65프로" / "65퍼" | 65 ✓ (보너스) |
| "효율 95" (% 생략) | 95 ✓ |
| "배터리 100% 정품" | 100 ✓ |

## parser_version v73 → v74 bump

- `OPTION_PARSER_VERSION`(=PARSER_VERSION) 사용 카테고리만 reparse: **전자기기/시계** (earphone/laptop/tablet/smartwatch/watch/camera/monitor/speaker)
- **fashion(shoe/bag/clothing/bike)은 자체 버전("wave92-shoe-v41" 등)이라 영향 0**
- reparse는 비파괴적 재계산 (score 파이프라인 자동, tick-pipeline LATEST_PARSER_VERSION_BY_CATEGORY 비교 → stale → 큐)

## 영향 규모 (DB 측정, mvp_listing_parsed v73)

| 카테고리 | v73 매물 | 현 배터리 추출 | 추출률 |
|---|---|---|---|
| tablet | 3,767 | 545 | 14% |
| earphone | 2,159 | **0** | **0%** |
| smartwatch | 1,957 | 167 | 8.5% |
| laptop | 1,532 | 218 | 14% |
| 기타(speaker/watch/camera/monitor) | 463 | 0 | 0% |
| **합계** | **~9,878** | | |

→ smartwatch 8.5%는 비현실적으로 낮음 (애플워치 배터리 표기 흔함). owner의 64% 애플워치는 못 잡힌 ~1,790개 중 하나. reparse 후 추출률 대폭 상승 예상 → low_batt 분리 + chip 정상화.
(earphone 0%는 일부 데이터 특성 — 무선이어폰은 health% 측정 기능 없어 정성 표기가 많음. 하지만 측정 표기 매물은 이제 잡힘.)

## 효과

- 매물 A(64%) → low_batt **별도 시세군** + "배터리 성능 저하" chip
- 매물 B(88%) → worn (양호, 정상) — 다른 군
- → owner가 원한 정확한 분리

## TS check
src/ 0 error.

## Sign-off
owner의 "키워드부터 못 잡는 건지" 진단이 정확. parser 정규식 단일 결함이 시세 분리 + chip 둘 다 막고 있었음. fix + v74 bump로 전자기기/시계 reparse 자동 진행.
