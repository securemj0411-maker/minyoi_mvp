# 2026-05-19 Wave 353 — 전체 vs 카테고리 일관성: 카테고리 필터 클라이언트 사이드 이동

사용자 지적: "초반 들어오자마자 전체 카테고리라서 전체가 보여야 되는데, 각 카테고리 선택할 때 그냥 전체보다 더 다른 매물이 있는 거 같지?"

## 원인

Wave 346에서 박은 `MAX_PER_CATEGORY = 5` diversification:

- **전체**: 모든 매물 fetch → 카테고리당 최대 5개 노출 → 25개 채움 (이어폰만 30개 되는 거 막기 위함)
- **카테고리 필터**: 백엔드에서 `category=in.(...)` 적용 → 다양화 skip → 해당 카테고리 top 25

즉 신발 매물 50개 있어도 "전체"엔 top 5 신발만, "신발 필터"엔 top 25. 6~25등 신발은 카테고리에서만 보임 → **사용자 신뢰 깨짐**.

## 결정

**백엔드는 항상 다양화된 30개 풀 반환. 카테고리 필터는 클라이언트 사이드.**

- 전체 풀 = 카테고리 필터 결과의 superset (수학적 보장)
- 신발 필터 → 풀 안의 신발만 보여줌 (≤5개)
- 부족하면 "다른 매물 찾기" (cooldown 갱신) 또는 "전체 카테고리 보기"

## 변경 파일

### `src/app/api/packs/pool/route.ts`
- `categoriesParam` 파싱 + `category=in.(...)` URL filter 제거
- `loadPool` 시그니처에서 `categories` 옵션 제거
- `diversifyByCategory` early-return (`if (categories) return rows.slice`) 제거 → 항상 다양화
- `FETCH_POOL_OVERFETCH` 항상 사용 (조건 분기 제거)

### `src/components/explore-client.tsx`
- `loadPool` useCallback의 `selectedCategories` 의존성 제거 (서버 호출 트리거 X)
- 카테고리 변경 시 URL state만 갱신 (재로드 X) — 클라이언트 메모리에서 필터링
- `displayItems = useMemo(() => items.filter(...))` 추가
- 매물 grid `items.map` → `displayItems.map`
- `displayItems.length === 0` 분기 신설: "이번 30개 풀에 해당 카테고리 매물이 없어요" + 전체 보기 / 다른 매물 받기 버튼

## 검증

- `tsc --noEmit` 깨끗 (신규 에러 0)
- `eslint` 깨끗

## 일관성 보장

- 전체 → 다양화된 30개 (카테고리당 max 5)
- 신발 → 그 30개 중 신발만 (즉 ≤5개)
- 신발에 있는데 전체에 없는 매물 = **0건** (수학적으로 불가능)
- 새로 받기 → 30개 풀 갱신 → 그 시점의 다양화 결과

## 사용자 흐름

```
/me 진입 → 30개 풀 (다양화)
  ↓
[신발] 클릭 → 풀 안 신발만 (3~5개)
  ↓
부족하다 느낌 → [다른 매물 찾기] → 새 30개
  또는
[전체 카테고리 보기] → 다시 30개
```

## 트레이드오프

- 카테고리 필터 결과가 적게 보일 수 있음 (≤5)
- 하지만 일관성 신뢰 > 카테고리당 풍부함
- 더 보고 싶으면 → 새 30개 받기 (30분 cooldown) 또는 paywall (맞춤 검색)
