## Wave 70 — Safe ready lanes 일괄 풀 진입 마킹 (241건)

- 시간: 2026-05-14 KST
- 발견: Wave 69 후 generic 점검에서 LANE_READINESS=ready 50개 SKU 중 **455건이 raw `pool_eligible=false`로 묶여있음** 발견. catalog는 ready인데 raw 매물 마킹이 별도 트리거 필요한 구조.
- 변경:
  - `scripts/wave70-safe-ready-lanes-pool-promote.ts` (신규): 안전한 27개 SKU 일괄 처리.
  - 안전 기준: catalog mustContain strict (model code 또는 model name) → false positive 본질 0%.
  - 제외: ipad-air-m3 (오염 53%), iPhone/Galaxy 자급제 (자급제 명시 누락 위험), ipad-mini-7 (표본 부족)
  - DB UPDATE 241건 적용 (pool_eligible=true + score_dirty=true)
- 적용 결과 (per SKU):
  - airpods-pro-3: 68 (최대)
  - airpods-4-anc: 32
  - galaxy-buds-3-pro: 24
  - bose-qc45: 23
  - switch-oled: 21
  - sony-wh-1000xm4: 18
  - speaker-jbl-flip-6: 16
  - beats-studio-pro: 12
  - ps5-slim-digital/disc: 12
  - lg-gram-17-2024: 5
  - 기타 narrow strict lanes: 10건
- 검증:
  - 27 SKU 모두 catalog에서 mustContain strict 확인
  - 안전 분류 기준: 모델 코드 (XL2540K) / 모델명 (Bose QC45) / chip+screen+ram+ssd combo (MacBook M3 14")
  - candidate_pool 직접 변경 0 — scoreStage가 다음 tick에서 처리
- 위험:
  - LOW. 모든 SKU strict 매칭 (false positive 본질 0%).
  - PS5 Disc/Digital 동일 laneKey 사용 → pool 진입 후 동일 lane 경합 (사업 결정 보류 중이나 풀 진입은 안전).
  - 시세 데이터/pool-policy로 일부 매물은 자연 hold될 수 있음 (예: 가격 outlier, accessory bundle context).
- 다음:
  - 다음 tick (1분) 후 candidate_pool 실 진입 측정
  - 사용자 풀 노출 약 50건 → 200~250건 도달 예상
  - 잔여 위험 lanes (ipad-air-m3 / 자급제 / ipad-mini-7) 별도 wave (parser/mining 보강 후)

## 오늘 누적

Wave 54 (16) + Wave 69 (11) + Wave 70 (241) = **+268건 신규 풀 마킹**

## 잔여 약 200건 (ready 카테고리지만 위험)
- ipad-air-m3-11-256-wifi: 오염 53% — parser 보강 필요
- iphone-15/16-pro-128gb-self: 자급제 명시 누락 매물 다수
- galaxy-s25-ultra-256-self: 동일
- ipad-mini-7-128-wifi: 표본 부족
- ipad-pro-13-m4-256-wifi: 측정 후 결정
- 기타 narrow lanes 일부

이들은 별도 wave에서 parser/mining 보강 후 단계적 진입.
