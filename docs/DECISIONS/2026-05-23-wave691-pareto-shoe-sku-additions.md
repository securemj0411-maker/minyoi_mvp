# Wave 691 — Pareto top brand SKU 신규 신설 (shoe v23→v24)

## 발견 (사용자 지적)

raw 7d 매물 분석 결과 **lane 없는 brand 5,300건/주 누락**:

| brand | 매물/주 | 상태 |
|------|---------|-----|
| **Air Jordan** | 2,231 | lane 0개 |
| **Nike Dunk Low** | 1,374 | narrow 2개만 (Panda/Black-White) — broad 부재 |
| **UGG** | 695 | lane 0개 (사용자 명시 여성 친화!) |
| **Adidas Gazelle** | 601 | lane 0개 |
| **Adidas Samba 일반** | ~400 (collab 제외) | collab 4개만 — broad 부재 |

= 시장 매칭률 **+2.4% 잠재 효과** (16.6% → 19%).

## 조치 — 6 SKU 신설

`catalog-shoe-narrow-wave134.ts` 신규 추가:

1. **shoe-ugg-classic-broad** — Short/Mini/Tall/Ultra Mini/Tasman 통합 broad
   - Noise: "어그로 아님" 자전거 슬랭 / 가방/파우치 / 패딩 / 픽시 부품 다 차단
2. **shoe-adidas-samba-broad** — OG/Classic, collab (Kith/Wales/Pharrell/Sporty) 별도 분리
3. **shoe-adidas-gazelle-broad** — OG/Indoor broad
4. **shoe-nike-dunk-low-broad** — 일반 colorway (Wave 134 Panda + Black/White narrow에서 차단 안 된 매물)
   - 한정/SP/Travis/Off-White/SB/Ambush/Stussy/Strangelove 다 차단
5. **shoe-nike-airjordan-1-low** — AJ1 Low (가품 위험 큼 — 11급/SS급정품/1:1 명시 차단)
6. **shoe-nike-airjordan-1-mid** — AJ1 Mid (High/Low 분리, collab 다 차단)

## 후속

- parser: `wave92-shoe-v23` → `v24`
- tick-pipeline: `shoe` LATEST → `v24`
- LANE_READINESS: 6 lane `ready` 등록 (수동 신설 + Pareto top)
- raw 매물 score_dirty 마크 5K (UGG/Samba/Gazelle/Dunk/AJ keyword 매칭)

## Why

이전 cycle (Wave 678-690) lane release 후 fashion lane 154 ready 도달 — 추가 풀 확장이 답.
사용자 명시 "0~30만 신발 풀 많이 필요" + 여성 친화 brand 부족 발견.
가품 위험 brand (AJ1) 신중하게 narrow 분리 + collab 다 차단.

## How to apply

- 향후 매칭률 < 20% 일 때 raw brand keyword 분석으로 lane 부재 brand 식별
- Pareto top brand는 broad SKU + 한정/collab narrow 분리 패턴
- 가품 위험 큰 brand는 "11급"/"SS급정품"/"1:1"/"미러" 명시 차단 필수
