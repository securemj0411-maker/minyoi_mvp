# 2026-06-04 Wave 1080 — Golf Club Broad Pool Gate

## 결정

- `sport_golf`의 broad/legacy golf club SKU는 공개 추천 pool에 넣지 않는다.
- broad SKU는 수집/검색/분류 scaffold로만 유지하고, feed 진입은 세대/모델/구성 축이 좁게 감사된 lane만 허용한다.
- score worker는 골프 raw listing의 저장된 `sku_id`를 그대로 신뢰하지 않고 현재 catalog rule로 재검증한다.

## 근거

- `sport_golf|odyssey_putter` 표본이 White Hot, DFX, Tri-Hot 5K, AI-ONE, 2-ball, broomstick 등 서로 다른 가격축을 같이 묶고 있었다.
- `sport_golf|taylormade_iron_set` 표본이 P7/P770/M4/Burner 같은 full iron set과 단품 아이언, driving iron, 우드 포함 묶음까지 섞고 있었다.
- `sport_golf|vokey_sm_wedge` 표본이 SM4~SM10, 단품/세트, 48~60도 loft를 한 comparable key로 묶고 있었다.
- legacy `club-mizuno-jpx`, `club-mizuno-mx`는 `-broad` 접미사가 없지만 실제로는 JPX/MX 여러 세대와 세트/단품을 같이 묶는 broad lane이다.
- DB의 ready/reserved pool에 broad golf SKU 기반 row가 남아 있었다. 예: Callaway driver broad 46건, Odyssey putter broad 26건, full set broad 29건, Vokey wedge broad 13건, TaylorMade iron broad 8건.

## 구현

- `evaluatePoolGate`에서 `sport-golf-*-broad`, `*_broad` laneKey, legacy `club-mizuno-jpx`, `club-mizuno-mx`를 `category_internal_only_sport_golf_broad_lane_required`로 차단한다.
- `tick-pipeline`의 `effectiveCatalogSkuForScorableRow`가 `sport_golf`, `sport-golf-*`, `club-*` SKU도 score 단계에서 `ruleMatch`로 재검증하게 했다.
- 회귀 테스트에 sport golf broad/legacy broad 차단과 Ping i230 narrow lane 허용을 고정했다.

## 보류

- Odyssey putter는 White Hot/DFX/Tri-Hot/AI-ONE/2-ball/broomstick 등 모델 family별 SKU 분리가 필요하다.
- Vokey wedge는 SM 세대, loft, 단품/세트 축 분리가 필요하다.
- TaylorMade iron은 P-series/P770/P790/M-series/SIM/Stealth, driving iron, 단품/세트 축 분리가 필요하다.
- Ping/Mizuno/Titleist iron도 G/i/JPX/MX/T/T200/AP 등 세대와 head-only/single/set 축 분리가 필요하다.
- `mvp_market_price_daily`에서 golf comparable key가 충분히 남는지 별도 점검이 필요하다. velocity만 살아 있고 price daily가 비어 보이는 경로가 있었다.
