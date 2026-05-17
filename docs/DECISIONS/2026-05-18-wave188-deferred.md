# Wave 188 보류 — catalog 기반 search query 자동 매핑

> **상태: TODO (보류)** — Wave 184/187 효과 측정 + catalog 다른 세션 작업 안정 후 진행.

## 의도

Wave 187 진단 결과 — **신발 카테고리만 fresh_28h 80~92%** (specific query 30+), **나머지 전자기기 카테고리 10~25%** (broad query 만). 신발의 specific query 보강 패턴 재현 필요.

사용자 통찰:
> "왜 맥북 에어13 i3랑 m1 이런거만? 우리 sku에 있는 테크 다 적용해야되는거아님 전자기기??"

→ catalog 의 모든 narrow SKU (329개) 가 search query 로 매핑되어야. 신발이 한 것 그대로 다른 카테고리.

## 보류 사유

1. **catalog.ts 가 다른 세션 동시 활발 수정 중** — Wave 188 의 Sku 타입 + helper 변경이 동시 작업 충돌 위험. system reminder 두 번 "file modified" 알림.
2. **Wave 184/187 효과 측정 noise** — 1~2일 측정 안 끝남. Wave 188 동시 박으면 fresh % 개선이 어느 wave 덕인지 attribution 불가.
3. **사용자 압도 표현** ("다 뭐가 뭔지 모르겠다") — 큰 변경 더 박지 말고 정리 단계 필요.

## 진행 시 plan (재개 시)

### 1. Sku 타입 확장

`src/lib/catalog.ts` 의 `Sku` interface 에 optional 필드:
```ts
searchQueries?: string[];  // 박힌 SKU 는 그 값. 없으면 aliases fallback. 빈 배열 = noise 위험 SKU 명시 차단.
```

### 2. catalog helper

`src/lib/catalog.ts` 에 export:
```ts
export function buildCatalogSearchQueries(): string[] {
  const queries = new Set<string>();
  for (const sku of CATALOG) {
    const list = sku.searchQueries ?? sku.aliases;
    for (const q of list) queries.add(q);
  }
  return [...queries];
}
```

### 3. pipeline-config 병합

`src/lib/pipeline-config.ts` 의 `envQueries()` 에 catalog-derived query 병합 (DEFAULT_SEARCH_QUERIES + CATALOG_DERIVED dedupe).

### 4. 효과 측정

DB `mvp_raw_listings` 의 SKU 별 fresh_28h % 측정:
- 현재 desktop-imac-m3-24 3.2%, galaxy-s23 6.5%, ipad-pro-11-m4-256-wifi 8.3% 등 underserved SKU
- Wave 188 후 fresh % 60%+ 목표 (신발 사례)

### 5. noise 위험 검토

- alias 가 모델 코드 (ILCE-7C 등) 면 noise — Wave 86 boost diag 결과 (94% noise) 참조
- alias 한국어 자연어 위주인 SKU 만 자동 매핑
- noise 발견 SKU 는 searchQueries: [] 박아서 명시 차단

## 재개 trigger

다음 조건 다 충족 시:
1. catalog.ts 의 다른 세션 작업 안정 (git status clean)
2. Wave 184/187 효과 1~2일 측정 완료 (fresh_28h % 측정)
3. 사용자 명시적 진행 요청

## 측정 baseline (Wave 188 진행 전)

5/18 KST 측정 (Wave 184/187 적용 후):
- 전체 active 매물 fresh_28h % 평균 ~15%
- 신발 카테고리 80~92%
- 전자기기 카테고리 10~25%

재개 시 비교 baseline.
