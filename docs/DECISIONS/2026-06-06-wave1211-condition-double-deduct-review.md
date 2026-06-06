# Wave 1211 (review) — condition 이중차감 검토 (audit P2, 측정)

날짜: 2026-06-06
관련: Wave 1205 audit, profit.ts conditionResaleAdjustmentKrw

## 검토 결과

`expectedProfitFromMarketPrice`(profit.ts:86)가 시세에서 `conditionResaleAdjustmentKrw`(condition 페널티)를
뺀다. 시세가 이미 condition별로 분리됐으면 이중차감 우려 → 확인:

### 전자기기 (condition_class) — 무해 (이미 방지)
- `SOFT_CONDITION_RESALE_ADJUSTMENTS`의 `skipConditionClasses`(profit.ts:33-35) + 적용부(65):
  - `low_battery_health` chip → conditionClass=`low_batt`면 skip
  - `cosmetic_wear` chip → conditionClass=`worn`면 skip
- 즉 low_batt 시세에 battery 페널티 / worn 시세에 cosmetic 페널티를 **이미 skip** → 이중차감 방지 설계됨. **무해**.

### fashion (conditionTier S/A/B/C/D) — 불확실 (측정 필요)
- fashion chip(`fashion_stain_or_discoloration`, `clothing_fading`, `clothing_pilling` 등, :39-46)은
  `skipConditionClasses`가 없음 + 적용부(65)는 `conditionClass`만 체크(conditionTier 미체크).
- 따라서 tier별 시세(Wave 814-818)에 fashion chip 페널티가 **추가로** 적용됨.
- **이중인지 불확실**: tier(전반 상태)와 chip(특정 결함, 얼룩 등)이 다른 축이면 정당한 추가 차감,
  tier 시세가 이미 그 결함을 반영하면 이중. → tier C 매물 중 stain 유/무의 실거래가 차이를 측정해야 판정 가능.
- **베타 초기라 실거래 데이터 부족 → 측정 불가. 미해결 관찰로 남김.**

## 결정

- 무리한 fix 안 함 (시세 차익 핵심 — 잘못 건드리면 전체 차익 왜곡).
- 데이터 1~2주 누적 후 fashion tier × chip 이중차감 측정 → 정당하면 유지, 이중이면 fashion chip도
  conditionTier 매칭 시 skip 추가.

## 오늘 audit 전체 종료
- P0: 배터리(1194b)/0~1원(1206)/시세조회(1207)/무한스크롤(1208) + race·4번 무해 검증
- P1: 홈동네(1202)/madTrim(1209) + sold blend 유지(합리)
- P2: lookup/closeRefreshModal/telegram/모바일필터(1210) + 저빈도 보류
- condition 이중차감: 전자기기 무해, fashion 측정 대기(본 문서)
