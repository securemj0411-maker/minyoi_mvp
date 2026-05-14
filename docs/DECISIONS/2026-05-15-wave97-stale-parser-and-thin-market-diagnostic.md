# Wave 97 — Stale parser + 시세 표본 부족 진단 (₩100만 차익 매물 원인)

> Status: **diagnosed (no fix yet).** 메인 페이지 최대 차익 ₩100만 매물 원인 추적. **캐시 문제 아니고 stale parsed 데이터 + 시세 표본 1건짜리**. Reparse + 시세 표본 minimum 게이트 필요.

CLAUDE.md 6 필드 포맷.

## 0.1 ₩100만 차익 매물 원인 추적

- 시간: 2026-05-15 11:30 KST
- 발견: owner 지적 — "메인페이지 최대 차익 ₩100만 매물 나오는데 비교 로직 바꾸고 저딴 차익 안 나옴. 캐시 3~6h 때문인지 reparse 안 되어서인지 확인". SQL 추적 결과:
  - **Parser version 혼재 (13개 버전 공존)**:
    - v39 (최신, 06:30+): 2,214건 — 오늘 신규 매물만
    - **v35: 13,852건 ⚠️** — 어제~오늘 새벽 매물. **구 parser comparable_key로 시세 계산 중**
    - v32: 1,315건, v31: 608건, v33~v38: 280여건
    - wave92-fashion-mobility-v1: 16건 (신발/가방/자전거 신규)
  - **Top 5 profit 매물 분석**:
    | pid | profit | parser | comparable_key | 시세 median | 표본 |
    |---|---:|---|---|---:|---:|
    | 406566033 | ₩100만 | v39 (새) | ipad_pro 12.9 512 cellular | ₩1.27M | **2건** |
    | 404724019 | ₩88만 | **v32** (구) | macbook_pro M2 13 8/256 | ₩1.00M | **1건** ❌ |
    | 394439158 | ₩86만 | **v35** (구) | macbook_pro **2019 i7** | ₩490k | **1건** |
    | 407687887 | ₩84만 | **v35** (구) | macbook_pro M2 unknown_screen | ₩1.20M | **1건** |
    | 406517939 | ₩83만 | **v35** (구) | macbook_pro **a1398 i7** (Intel 구형!) | ₩800k | **1건** |
- 변경: 없음 (진단만).
- 검증: SQL `mvp_listing_parsed` parser_version + `mvp_market_price_daily` JOIN 결과.
- 위험: 사용자에게 잘못된 차익 추천 가능 (시세 자체가 outlier 1건 매물 가격 기준).
- 다음: Reparse + 시세 표본 minimum 게이트.

## 0.2 진짜 원인 = 캐시 아니고 stale parser + thin market

- 시간: 2026-05-15 11:30 KST
- 발견: 두 가지 동시 문제:
  1. **Stale parser 데이터** (15,000+ 매물이 v32~v38 구버전 parsed) → 구 comparable_key로 시세 계산. Intel 구형 macbook이 신형 SKU와 분리 안 됨.
  2. **시세 표본 1건짜리도 candidate_pool 진입** → 시세 자체가 outlier 매물 가격일 수 있음. `madTrim`은 threshold 5건이지만 매물 자체가 1건이면 trim 안 됨 → 그 1건 가격이 시세로 사용.
  - **캐시 (main page 3~6h) 영향은 작음** — market_price_daily computed_at 최신 (05-15 03:22), candidate_pool verified 05-15 08:17. DB 데이터 자체는 최근.
- 변경: 없음 (분석만).
- 검증: 위 SQL 결과 + LAUNCH_PLAN §1.1 (parser version 혼재 → 옛 매물 재파싱 필요 가능성 명시됨, 2026-05-13).
- 위험: 사용자 신뢰도 risk. ₩100만 차익이 실제로는 시세 1건 outlier 기반이면 실제 차익 못 봄 → 사용자 손실 + 미뇨이 신뢰도 폭락.
- 다음: 2가지 fix 필요 (별도 wave):
  1. **Reparse** — `scripts/reparse-direct.ts`로 v32~v38 매물 일괄 재파싱 (15,000+ 건)
  2. **시세 표본 minimum 게이트** — pool 진입 조건에 `active_sample_count >= 5` 강제 추가 (candidate-pool-builder에서)

## 1. Reparse 계획 (Wave 98 후보)

### 옵션 A: SKU별 reparse (안전)
- `npx tsx scripts/reparse-direct.ts --sku=ipad-pro,ipad-air,ipad-mini,...`
- SKU 단위로 단계 진행. 1 SKU 진행 후 검증.
- 단점: 시간 소요 ↑

### 옵션 B: parser_version 기준 reparse
- v32~v38 13,000+ 건 일괄
- 단점: 큰 변경 한 번에 — risk ↑

### 옵션 C: 신규 매물만 (No action)
- v39+ 매물만 사용. 옛 매물 자연 사라지길 대기 (lifecycle terminate)
- 단점: 옛 매물도 사용자 노출 중. 신뢰도 risk

→ **옵션 A 권장** (안전).

## 2. 시세 표본 minimum 게이트 (Wave 99 후보)

`src/lib/candidate-pool-builder.ts` (pool 진입 게이트):
- 현재: market_price_daily에 시세만 있으면 pool 진입 가능
- 변경: `active_sample_count >= 5` 강제. 그 외 매물은 시세 신뢰도 부족 → pool 진입 X
- 효과: 시세 표본 1건짜리 매물 다 reject → 차익 거짓 추정 차단

## 3. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- 캐시 (main page 3~6h)가 ₩100만 매물 원인이라는 가설 — **틀림**, 진짜 원인은 stale parser + thin market.

## 4. 즉시 노출 risk 평가

- 현재 candidate_pool ready 536건. 그중 시세 표본 < 5건인 매물 비율 추후 측정 필요.
- Wave 96 시뮬에서 90.9% safe는 **위험 신호** 측면. **시세 정확도**는 별개 — 시세 1건 기반 매물도 "good" 처리됨.
- 사용자에게 차익 ₩100만+ 매물 추천 시점에 → 실제 차익 안 나면 신뢰도 ↓
- 즉시 노출 시 **시세 표본 ≥5 게이트가 wave 99 적용 전까지는 보수적 운영 권장**.
