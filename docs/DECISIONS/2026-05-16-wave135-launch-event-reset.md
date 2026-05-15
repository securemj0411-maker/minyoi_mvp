# Wave 135 — Launch event reset (사업 보고서 L5b 마지막 항목)

> 보고서 인용: "신모델 launch 직후엔 가격 급변동. 옛 시세 baseline 부정확". 
> 예: 아이폰 17 출시 2026-09-15 → iPhone 16 시세가 launch 전후 급변.

## 1. 시간 + 동기
- 2026-05-16 (Wave 134 commit c121792 후속)
- 사용자 명령 "ㄱㄱ" → 사업 보고서 L5b 진행

## 2. 변경

### 2a. DB schema (migration `wave135_launch_events_table`)
- `mvp_launch_events` 테이블 신규
  - `affected_comparable_key` (정확 매칭, 다음 wave에서 prefix wildcard 가능)
  - `event_type`: new_model_release / model_revision / price_reset / manual_baseline_reset
  - `event_date` (KST 기준 권장)
  - `pre_event_weight` (default 0.3 = 옛 baseline 무시 강도, 0~1 CHECK)
  - `effective_until` (NULL = 항구적)
  - `label`, `notes`
- index `idx_mvp_launch_events_key_date`
- RLS enable + service_role only (admin manual 입력)

### 2b. `src/lib/market-math.ts` — weightMultiplier 도입
- `SellerPricedRow.weightMultiplier?: number | null` 추가
- `SellerRepresentative.weightMultiplier: number` (carry-through)
- `sellerRepresentativesWithAge`: 각 매물의 multiplier 보존 + ageDays 없을 때 평균 fallback
- `decayTrimmedSellerMarket`: final weight = `decay(ageDays) * weightMultiplier`

### 2c. `src/lib/tick-pipeline.ts` — launch event load + 적용
- `loadLaunchEvents()`: mvp_launch_events fetch (effective_until 지난 event 제외)
- `launchEventMultiplier(comparableKey, observedAt, events)`: 매물의 observedAt이 event_date 이전이면 가장 강한 reset 적용
- `upsertMarketPriceDaily` 진입 시 launchEvents 로드
- `toSellerPriced(r, comparableKey)`: 매물별 weightMultiplier 사전 계산

### 2d. Test (`tests/wave131-decay-market-price.test.ts`)
- launch event reset 시 옛 baseline 무시 검증
- weightMultiplier 없을 때 backward compat 검증

## 3. 검증
- 167/167 test pass (165 + 2 신규)
- tsc clean (`.next` artifact 외)
- launch_events 테이블 schema + RLS 적용
- 현재 데이터: 0 row (admin 입력 대기). launch event 등록 전엔 모든 매물 multiplier=1 = no-op (backward compat).

## 4. 사업 가치 (예시)

아이폰 17 출시 2026-09-15 등록 시:
```sql
INSERT INTO mvp_launch_events (affected_comparable_key, event_type, event_date, label)
VALUES ('smartphone|iphone|16_pro|128gb|self', 'new_model_release', '2026-09-15',
        '아이폰 17 출시 — iPhone 16 가격 baseline reset');
```
효과:
- iPhone 16 Pro 128GB 자급제 시세 산정 시 2026-09-15 이전 매물 weight 0.3x
- 즉 launch 전 호가 (높은 잔존가) 무시 + launch 후 매물 가격 (하락 트렌드) 시세에 반영
- 사용자가 보는 시세 = "신모델 출시 후 시장이 reset된 가격" = 정확

## 5. 위험

### 5a. 데이터 입력 manual
- launch event는 자동 감지 불가 (외부 이벤트)
- 운영자가 admin/SQL로 입력해야 효력 발생
- 다음 신모델 출시 (예: Galaxy S26, iPhone 17) 시점에 운영자 입력 워크플로우 필요

### 5b. 정확 매칭 한계
- 현재 `affected_comparable_key` 정확 매칭. iPhone 16 Pro의 128GB/256GB/512GB는 따로 row 필요
- 다음 wave에서 prefix wildcard 지원 (예: `smartphone|iphone|16_pro|%`) 검토

### 5c. multiplier 0.3 임의
- 사용자 정책 검증 없음. 다음 신모델 출시 시 실측 후 조정 가능 (0.1 더 강한 reset / 0.5 부드러운 weight)
- DB column `pre_event_weight`이라 event별로 다르게 박을 수 있음

## 6. 다음
- Launch event 발생 시 운영자 입력 워크플로우 (admin UI 또는 SQL 가이드)
- 첫 실제 event 등록 후 효과 측정 (e.g. Galaxy S26 출시)
- 사업 보고서 7-Layer 전부 완료 — 다음은 보고서 외 retention 강화 또는 베타 traffic 측정

## 7. 거론 금지
- launch event UI badge — 다음 wave (admin 입력 후 또는 첫 event 시점)
- 자동 launch event 감지 (외부 API 또는 시세 anomaly detection) — 별도 wave
- prefix wildcard 매칭 — 다음 wave
