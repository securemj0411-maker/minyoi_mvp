# Wave 712 cycle — bias-free agent 35 brand 검증 → catalog 일괄 fix + 152 신설

**Date**: 2026-05-23
**Scope**: 의류 14 brand + 신발 21 brand bias-free agent 결과 catalog 일괄 적용.

## 배경

사용자 비판: 이전 cycle (Wave 691-702) sub-agent prompt에 모델/colorway/은어 예시 박아서 bias.
재실행 — example 박지 않은 bias-free prompt로 35 brand 검증.

## Cycle 결과 (5 commit)

| Wave | 내용 | 변경 |
|---|---|---|
| 703 | bias-free critical hotfix | AF1 Mid '07 BUG (124건 false) / AF1 LV "lv" 단독 (49건) / Dunk 범고래 / Palermo collision / AJ1 latushi 정정 (LA to Chicago) / NB 미우미우 제거 / On Loewe cloudventure / Crocs 비신발 차단 |
| 712a | 의류 14 brand hotfix | MLB cap 엠엘비 alias (47건) / MLB Nike/Murakami directSpecificMatch (131건) / Stussy crossbody narrow split / Adidas trefoil 콜라보 차단 / Patagonia Synchilla 신설 (162건) / Polo Bigpony Pique 신설 (193건 black hole) |
| 712b | 의류 28 + 신발 24 신설 | catalog-712b-bias-free.ts (52 SKU) |
| 712c | 신발 추가 100+ 신설 | catalog-712c-shoe-bulk.ts (100+ SKU) |
| 712d | 152 lane readiness ready | 모든 신설 SKU 사용자 풀 진입 활성화 |

**총**: 15 fix + 152 신규 SKU + 152 lane ready 등록. parser bump shoe v35→v38 / clothing v44→v46.

## 핵심 발견 (systemic 패턴 — 14 brand 공통)

| Brand | 사용자 메모 | 실측 | gap 원인 |
|---|---|---|---|
| Carhartt | 99.6% | 62.7% (큐 진입) | Galaxy SS26 false / Junya/Awake/Pop Trading 콜라보 누락 |
| BAPE | 94% | 53.5% (raw) / 84.8% (parsed) | Adidas collab 174건 trefoil 흡수 / 86 ghost SKU |
| Stone Island | 100% | 72% + sold 0건 | Crinkle/Shadow/Ghost sub-line 부재 |
| CDG | 99.6% | 49% (listings 진입) | **🚨 ingest gate bug** — Junya 단독 의류 0개 |
| Patagonia | 70% | 56% | Wave 654 Synchilla 분리만 하고 fallback 미박힘 |
| FOG | 87.5% | 48.3% | Main Line 의류 0개 / DJI 오즈모 false |
| 폴로 모호 | 78.6% | 38.3% | 🔥 빅포니 카라티 black hole (catalog 룰 충돌) |
| Adidas 의류 | 93% | 30% 정확도 | trefoil 31.80x spread (catalog 최악 dirty SKU) |
| MLB | 32.8% | 14.5% | cap "엠엘비" alias 누락 + Nike/Murakami **self-block** (CATEGORY_FASHION_NOISE 차단어가 own SKU 차단) |

→ 모든 brand에서 사이트 노출 매칭률 vs sku_id raw 매칭률 정의 차이 발견. **broad SKU 한 개에 sub-line/collab/product-type 다 흡수** = 매칭률은 보이는데 정확도 망함.

## 신설 SKU 우선순위 (impact 큰 순)

1. **Polo Bigpony Pique 193건** — black hole 회복 (Wave 712a 신설)
2. **Onitsuka Tiger 185건** — Asics와 별 brand catalog 신설 (Wave 712b)
3. **BAPE × Adidas 174건** — Adidas trefoil 흡수에서 분리 (Wave 712b)
4. **Patagonia Synchilla 162건** — Wave 654 fallback 미박힘 fix (Wave 712a)
5. **Yeezy 350 V2 broad 152건** — broad SKU 신설 (Wave 712c)
6. **Polo shirt-pattern 315건 + sweatshirt 150건** — 카테고리 SKU 부재 회복 (Wave 712b)
7. **Asics Gel-Quantum 113건 + Metaspeed 56 + GT-2160 54** — segment 누락 회복 (Wave 712c)
8. **Yeezy Foam Runner 117 + Slide 87 + 500 broad 107** — broad 신설 (Wave 712c)
9. **Salomon XT-Whisper 79 + RX Slide 56 + Phantasm 63** — broad에서 분리 (Wave 712b)
10. **Sacai split 4 SKU (Vaporwaffle 84 / LDV 93 / Blazer Low 69 / Cortez 17)** — 단일 broad에서 분리

## 매칭률 회복 추정

| Brand | 이전 | 신설 후 |
|---|--:|--:|
| MLB | 14.5% | ~80% |
| Polo 모호 | 38.3% | ~65% |
| Asics+Onitsuka | 66.5% | ~88% |
| Patagonia | 56% | ~80% |
| Adidas 의류 정확도 | 30% | ~80% |
| Crocs | 43% | ~75% |
| Salomon | 75% | ~90% |
| Sacai | 57% | ~90% |
| NB | 78% | ~92% |
| Yeezy | 80% | ~92% |

## bias-free vs biased agent 비교

| 항목 | biased (이전) | bias-free |
|---|---|---|
| sub-agent prompt | 모델명/colorway/은어 예시 박힘 | 예시 0개, raw + web research 직접 발굴 명령 |
| Salomon 결과 | 28 SKU plan (Y-Project/Sandy Liang/MM6 sub-split 포함) | 9 SKU + MM6/CDG broad 유지 권고 (sub-model 너무 다양해 broad 효율) |
| Adidas Boost | 13 SKU (Wales Bonner/Pharrell Jellyfish ghost 포함) | 6 SKU + 보강 (ghost 제외, Y-3 collab 발견) |
| Mizuno | 3 SKU (Wave 시리즈만) | 6 SKU + Golf segment 발견 (JPX 36/MX 15) |

→ bias-free가 더 정확하고 ghost SKU 제거 + 누락 segment 발견.

## 남은 작업 (Wave 713+)

1. **systemic audit** (즉시 진행):
   - ingest gate audit (raw → listings 49% 진입률 원인)
   - sold_detected_at 파이프라인 (Stone Island/Carhartt 0건)
   - broad SKU spread 10x+ 자동 알람 (Adidas trefoil 31.80x case)
   - stale reparse 정책 (Wave 패치 후 자동 reparse 없음 — Cortez 88건 stale)

2. **Galaxy SS26 false positive fix** — Carhartt agent 발견, cross-brand 영향

3. **directSpecificMatch 추가** — FOG/BAPE 등 self-block 가능성 brand

4. **score_dirty 트리거** — 신규 lane에 매물 재매칭

## 관련 파일

- `mvp/src/lib/generated/catalog-712b-bias-free.ts` (52 SKU 의류+신발 신설)
- `mvp/src/lib/generated/catalog-712c-shoe-bulk.ts` (100+ SKU 신발 신설)
- `mvp/src/lib/category-readiness.ts` (152 lane ready 등록)
- `mvp/src/lib/catalog.ts` (Adidas trefoil mustNotContain / MLB directSpecificMatch / Stussy / Patagonia Synchilla / Polo Bigpony / 의류 hotfix)
- `mvp/src/lib/parsers/wave92-fashion-mobility.ts` (parser v35→v38 / v44→v46)
- `mvp/src/lib/tick-pipeline.ts` (LATEST_PARSER_VERSION_BY_CATEGORY)
