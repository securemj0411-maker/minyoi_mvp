# 2026-06-04 Wave 1081 — Clothing Family Lane Pool Gate

## 결정

- 의류 category-wide pool gate는 유지하고, 과거에 `ready`로 풀렸지만 실제 public price axis가 넓은 family lane도 공개 추천 pool에서 차단한다.
- 아래 lane은 parser/search recall 용도로는 유지하되, 세부 SKU로 재분리되기 전까지 feed/pool에 넣지 않는다.
  - `polo_pony_tee`
  - `polo_shirt_pattern`
  - `polo_knit_sweater`
  - `adidas_trefoil`
  - `patagonia_apparel`
  - `mlb_apparel`

## 근거

- `clothing-polo-pony-tee` ready/reserved pool 119건이 반팔티, 반팔남방, 카라티, 반팔셔츠를 한 family lane 아래에서 섞고 있었다.
- `clothing-polo-shirt-pattern` 106건은 체크/스트라이프/깅엄/플란넬/블레이크류 셔츠를 한 가격축으로 보고 있었다.
- `clothing-polo-knit-sweater` 79건에는 현재 catalog rule로는 매칭되지 않는 stale non-brand knit row가 남아 있었다.
- `clothing-adidas-trefoil`은 jacket/pants가 같이 남아 있었고, `clothing-patagonia`, `clothing-mlb-cap`은 brand/apparel broad 성격이 강했다.
- DB 정리 전 clothing ready/reserved 779건 중 위 risky family lane 기반 row가 335건이었다.

## 구현

- `evaluatePoolGate`에 risky clothing family lane guard를 추가했다.
- 위험 lane은 `category_internal_only_clothing_broad_lane_required`로 차단한다.
- 기존 `mvp_candidate_pool`의 ready/reserved row 중 위 SKU 기반 335건을 invalidated 처리했다.

## 보류

- Polo는 라운드넥 tee, 카라티, 반팔셔츠, 패턴셔츠, 니트/케이블, 빈티지/퍼플라벨/RLX 축을 더 명확히 분리해야 한다.
- Adidas Trefoil은 Firebird/track top/jacket/pants/archive 축을 별도 SKU로 재감사해야 한다.
- Patagonia tee/apparel broad와 MLB cap/team/collab/bundle 축은 정밀 SKU 신설 후 재오픈한다.
