# Wave 770 — Universal placeholder price ceiling (전자기기 critical fix)

**날짜**: 2026-05-24
**Wave**: 770

## 사용자 audit 발견

전자기기 spread audit 결과 **placeholder 가격 매물 다수**:
- galaxywatch_6 40mm gps: **999,999,999원** (10억)
- iphone_14_pro 128gb: **90,000,000원** (9000만)
- iphone_15 unknown_storage: **111,111,111원**
- applewatch_series10 46mm cellular: **999,999,999원**
- macbook_air 2024 m3: **999,999,999원**

= 셀러 placeholder/광고 매물 (정상 거래 X). 시세 sample 오염 + 사용자 풀 정확성 손상.

## Fix — `pipeline.ts categoryScopedNoise` universal sanity check

### 1. Placeholder 패턴 차단
```typescript
const isAllNines = /^9{7,}9?$/.test(String(price));   // 999999999 등
const isAllOnes = /^1{7,}1?$/.test(String(price));    // 111111111 등
const isRepeatingFives = price >= 1M && new Set(price.toString()).size === 1;  // 5555555 등
if (any) return "buying";
```

### 2. 카테고리별 비현실적 max ceiling
```typescript
smartphone: 5M / tablet: 5M / laptop: 8M / earphone: 1.5M
smartwatch: 2.5M / monitor: 5M / speaker: 5M / camera: 15M
desktop: 8M / home_appliance: 3M / game_console: 1.5M / sport_golf: 3M
```

`luxury` 카테고리 (bag/watch 명품) 는 제외 — 정상 매물 1000만+ 있음.

## DB

- ready pool: **0건 invalidate** (이미 Wave 25/719 ceiling 일부 적용 효과)
- mvp_listing_parsed: placeholder 매물 자연 만료 (사용자 결정)
- 새 매물부터 catalog 단계 자동 차단

## 영향

- 시세 sample 정확성 향상 (placeholder 매물 자동 제외)
- 사용자 풀 ceiling 보장 (10억 매물 안 보임)
- 광고/test 매물 reject

## 안전성

- 정상 명품 가방/시계 (1000만+) 영향 0 (해당 카테고리 max ceiling 박지 X)
- 기존 ready pool 영향 0
- parser 변경 없음 — pipeline.ts pre-SKU check 만

## 관련 commit

- `14f56029`: Wave 769 — 신발 floor 2 SKU
- 본 commit: Wave 770 — universal placeholder ceiling
