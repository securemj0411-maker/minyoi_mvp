# Wave 715 — 의류 catalog narrow split (체계적 cycle)

**Date**: 2026-05-23
**Trigger**: Wave 714t 의 patagonia_retro_x 빈티지 noise 발견 → SQL spread audit → **20개 broad SKU 가 5-150x spread** 확인. 어제 신설한 patagonia_synchilla / fog_main_pants 도 50-72x spread (빈티지/콜라보 흡수).
**Scope**: 의류만. 신발은 별도 cycle (사용자 판단 OK 상태). 가방은 ready X (사용자 정책).

## 사용자 지시

> "다 해야겠다 ㅇㅇ. 막 그냥 클루지처럼 하지말고 체계적으로 순서대로 다 하자. 로그도 잘 박고."

체계적 = 클루지 (적당히 처리) 금지 + 우선순위 순 + log 박기.

## Phase 0 — 진단 (완료)

### SQL spread audit (n ≥ 15, 14일 retention)

| Rank | SKU | n | min | median | max | spread_x |
|---|---|---|---|---|---|---|
| 1 | **acne_apparel** | 74 | 1만 | 13.7만 | 150만 | **150x** |
| 2 | **polo_chiefkeef_stadium** | 43 | 2.5만 | 15만 | 330만 | 132x |
| 3 | **adidas_thugclub_collab** | 37 | 1.5만 | 40만 | 180만 | 120x |
| 4 | **polo_apparel_broad** | **488** | 2만 | 6.5만 | 220만 | 110x |
| 5 | polo_rrl_shirt_pants | 112 | 2.3만 | 35.7만 | 215만 | 93x |
| 6 | polo_rrl | 157 | 4.5만 | 59만 | 410만 | 91x |
| 7 | adidas_trefoil | 297 | 1만 | 3.5만 | 77만 | 77x |
| 8 | stussy_apparel_broad | 153 | 2.7만 | 15만 | 200만 | 74x |
| 9 | **patagonia_synchilla** (어제 신설) | 72 | 5만 | 17.7만 | 360만 | 72x |
| 10 | polo_shirt_pattern | 87 | 1만 | 6.5만 | 68만 | 68x |
| 11 | polo_oxford_shirt | 333 | 1.5만 | 5.7만 | 100만 | 67x |
| 12 | polo_pique_classic | 236 | 1만 | 4.5만 | 65만 | 65x |
| 13 | tnf_supreme_collab | 92 | 4.5만 | 50.5만 | 280만 | 62x |
| 14 | arcteryx | 139 | 2만 | 13만 | 119만 | 60x |
| 15 | carhartt_apparel_broad | 319 | 1.1만 | 7.5만 | 65만 | 59x |
| 16 | **thombrowne_apparel_broad** | **640** | 6.9만 | 45만 | 400만 | 58x |
| 17 | polo_rrl_jacket_coat | 68 | 4만 | 50만 | 224만 | 56x |
| 18 | polo_bear_collab | 164 | 1만 | 6.7만 | 55만 | 55x |
| 19 | **fog_main_pants** (어제 신설) | 28 | 4만 | 32.5만 | 215만 | 54x |
| 20 | cdg_apparel_broad | 254 | 3만 | 12.9만 | 160만 | 53x |

**핵심 발견**:
- **polo_apparel_broad 488건 spread 110x** — 가장 큰 noise. 모든 폴로 흡수.
- **thombrowne_apparel_broad 640건 spread 58x** — Thom Browne catalog narrow 안 됨.
- **어제 신설한 SKU 도 spread 50-72x** — patagonia_synchilla / fog_main_pants. 빈티지/콜라보 흡수.
- 임의 정의 X — agent 결과 보고 narrow split.

## Phase 1 — Agent deep sweep (진행 중)

**Agent ID**: `aabedfe02cb8dd347` (백그라운드)
**Sample**: n=5,000 의류 raw 매물 14일 retention.
**범위**: 20 broad SKU 의 sub-cluster 발굴 + 누락 brand/모델 + 신설 SKU 권고.
**제약**: 임의 SKU 정의 X — raw data + sample + 가격 cluster 만 제공.

**예상 결과 (markdown)**:
1. 현재 catalog spread 측정 + cluster 발견
2. 각 broad SKU 안 sub-cluster (50건 sample 분석)
3. **세분화 권고 top 20** — narrow split plan
4. 누락된 brand/모델
5. 신발 vs 의류 spread 비교

## Phase 2 — narrow split sequential (agent 결과 후)

**brand별 순서** (impact 큰 순):

1. **polo_apparel_broad → 카테고리별 분리** (셔츠/팬츠/스웻/니트/베어/베스트)
2. **thombrowne_apparel_broad → 모델별 분리** (스트라이프 카디건/스웻셔츠/4-bar/Polo collar)
3. **polo_oxford_shirt → 빈티지 vs 신모델 분리**
4. **carhartt_apparel_broad → WIP / Detroit / 베스트 분리**
5. **adidas_trefoil → 콜라보 narrow 더 fine-grained**
6. **cdg_apparel_broad → PLAY / 꼼데꼼데/홈므 분리**
7. **polo_pique_classic → 빈티지/콜라보 분리**
8. **polo_bear_collab → Stadium / Soccer / 일반 분리**
9. **polo_rrl → denim/leather/grizzly/Browns Beach 더 분리**
10. **stussy_apparel_broad → 시즌 콜라보 분리**
11. **arcteryx → Alpha/Beta/Atom/Cerium 모델별 분리**
12. **polo_rrl_shirt_pants → shirt/pants 별도**
13. **tnf_supreme_collab → Nuptse/Mountain/Steep Tech 분리**
14. **polo_shirt_pattern → 빈티지/패턴별**
15. **acne_apparel → Face/Knit/Pants/Sweat 모델별 분리**
16. **patagonia_synchilla → 빈티지/신모델/Snap-T 분리**
17. **polo_rrl_jacket_coat → jacket vs coat 분리**
18. **polo_chiefkeef_stadium → 빈티지/신모델**
19. **adidas_thugclub_collab → 모델별 분리**
20. **fog_main_pants → 모델별 분리**

각 brand fix 단계:
- agent 결과 sub-cluster 확인
- catalog.ts narrow SKU 신설 (mustContain / mustNotContain / aliases)
- LANE_READINESS 에 status="ready" 등록
- score_dirty 트리거 (영향 매물 reparse)
- 즉시 commit + log update

## Phase 3 — 검증

- 각 narrow SKU spread 측정 (목표: <5x)
- ready 진입 비율 측정
- 매물 sample audit (10건 random check)

## Phase 4 — backfill 모니터링

- 의류 condition_tier backfill % (현재 17.7%, 24h ETA 50%)
- 매물 매칭률 (현재 60.8%, 목표 75%+)

## 관련 파일

- [src/lib/catalog.ts](../../src/lib/catalog.ts) — narrow SKU 추가
- [src/lib/category-readiness.ts](../../src/lib/category-readiness.ts) — LANE_READINESS ready 등록
- Wave 714t commit `3b81f25` — patagonia_retro_x 빈티지 차단 (이전 fix)

## Agent 추적

- `aabedfe02cb8dd347` — 의류 5000건 deep sweep (Wave 715 sub-cluster 발굴)
- 이전 agent (Wave 714):
  - `abc358079888d9a69` — 신발 sweep n=10,829
  - `ac955968c16adba21` — 신발 5-axis cross-tab n=11,087
  - `acb8fe3ea66f00975` — 의류 sweep n=11,167
  - `a2d7c17a34f40235e` — 의류 5-axis cross-tab n=11,543

## 진행 상황

- [x] Phase 0 — SQL spread audit (20 SKU 식별)
- [ ] Phase 1 — agent deep sweep n=5,000 (진행 중)
- [ ] Phase 2 — narrow split sequential (agent 결과 후)
- [ ] Phase 3 — 검증
- [ ] Phase 4 — backfill 모니터링
