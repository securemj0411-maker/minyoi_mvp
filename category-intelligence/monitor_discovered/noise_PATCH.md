# Monitor From Bunjang Category — Noise Rule Suggestions (v2)

- category: monitor_discovered
- generated_at: 2026-05-10T18:07:57.182Z
- method: cluster-discovered (auto-validated)

## Discovered Noise Clusters

| cluster | type | confidence | distinctive_keywords | rationale |
|---|---|---|---|---|
| 3 | accessory | high | 어댑터, 전원선, HDMI 케이블, 모니터 본체 포함, 액세서리 | 이 클러스터는 LG 모니터 본체와 함께 판매되는 어댑터, 전원선, HDMI 케이블 등 모니터 사용에 필요한 부속품 및 액세서리 위주로 구성되어 있습니다. 일부는 모니터 본체도 포함되어 있으나, 대표적으로 어댑터 단독 판매가 다수이며, 모니터 본체 단독 매물과는 구분되는 액세서리 중심의 매물들이 혼재되어 있습니다. 따라서 번개장터 모니터 카테고리 내 정상 매물(모니터 본체)와 구분되는 액세서리 유형으로 분류됩니다. |
| 5 | accessory | high | 모니터 스탠드, 거치대, 부품용, 액정파손, 삼성 | 이 클러스터는 모니터 본체가 아닌 모니터 스탠드, 거치대 등 모니터 사용에 필요한 부속품 위주로 구성되어 있습니다. 일부는 부품용 액정 파손 제품도 있으나, 대부분 스탠드 단독 판매이며, 모니터 본체와는 별개로 취급되는 액세서리 성격이 강합니다. 따라서 모니터 본체가 아닌 액세서리로 분류하는 것이 적합합니다. |
| 8 | multi | high | 게임용 본체, 게이밍 모니터, 컴퓨터 풀세트, 본체 모니터, 벤큐 게이밍 모니터 | 이 클러스터는 게이밍 컴퓨터 풀세트(본체+모니터)와 단독 게이밍 모니터 매물이 혼재되어 있어 단일한 'normal' 모니터 본체 타입으로 분류하기 어렵고, 액세서리나 부품 단독 매물이 없으며, 본체와 모니터가 함께 포함된 '풀세트' 형태와 단독 모니터 판매가 섞여 있어 'multi' 타입으로 분류됩니다. |

## Auto-Validated Keywords

> precision ≥ 0.80 → pipeline.ts에 추가 권장. 0.60~0.79 → 사람 검수 후 추가. < 0.60 → 제외.

### ✅ 자동 승인 (precision ≥ 0.80)

- `풀세트` — precision: 0.80, hits: 6 — 전체적으로 5개 매물 중 4개가 'multi' 타입인 풀세트로 적절히 분류되었으나, 1개는 풀세트 기준에 부합하지 않아 정밀도는 0.8임.
- `문의는` — precision: 0.80, hits: 5 — 총 5개 매물 중 4개가 noise 타입으로 정확히 분류되어 전체 precision은 0.8입니다.
- `신품` — precision: 0.80, hits: 9 — 총 5개 중 4개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.8입니다.
- `풀세트입니다` — precision: 1.00, hits: 3 — 모든 매물이 '풀세트입니다' 키워드에 부합하는 'noise' 타입으로 정확히 분류됨.
- `무료증정` — precision: 1.00, hits: 3 — 모든 매물이 'multi' 타입에 적합하여 정확도가 100%입니다.

### 🔍 사람 검수 필요 (0.60 ≤ precision < 0.80)

- `본체만` — precision: 0.75, hits: 4 — 전체적으로 4개 중 3개가 '본체만' 키워드를 포함한 'noise' 타입으로 정확히 분류되어 정밀도는 0.75임.
- `rtx` — precision: 0.60, hits: 7 — 총 5개 매물 중 3개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.6입니다.

### ❌ 자동 기각 (precision < 0.60)

- `2번` — precision: 0.00, hits: 9
- `키보드` — precision: 0.40, hits: 8
- `마우스` — precision: 0.20, hits: 8
- `9400f` — precision: 0.50, hits: 4
- `16g` — precision: 0.00, hits: 7
- `안전결제해주시면` — precision: 0.20, hits: 12
- `12` — precision: 0.00, hits: 23
- `미개봉` — precision: 0.00, hits: 9
- `주세요` — precision: 0.00, hits: 25
- `중고` — precision: 0.00, hits: 16
- `직거래는` — precision: 0.20, hits: 6
- `택배문의` — precision: 0.00, hits: 3

