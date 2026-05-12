# Smartwatch From Bunjang Category — Noise Rule Suggestions (v2)

- category: smartwatch_discovered
- generated_at: 2026-05-10T15:27:45.577Z
- method: cluster-discovered (auto-validated)

## Discovered Noise Clusters

| cluster | type | confidence | distinctive_keywords | rationale |
|---|---|---|---|---|
| 2 | buying | high | 구매합니다, 삽니다, 연락주세요, 구매, 사자마자 | 두 개의 대표 샘플 모두 가민 스마트워치 모델을 구매하겠다는 의사를 명확히 표현하고 있으며, 판매가 아닌 구매 요청 형태의 글입니다. 따라서 이 클러스터는 구매 희망 매물로 분류됩니다. |
| 11 | accessory | high | 스트랩, 밴드, 밀레니즈 루프, 미사용, 정품 | 이 클러스터는 애플워치 본체와 함께 사용되는 스트랩, 밴드, 밀레니즈 루프 등 액세서리 위주로 구성되어 있습니다. 일부 본체 매물도 있으나, 대표 샘플 대부분이 스트랩이나 밴드 단독 판매이며, '미사용', '정품', '실리콘 스트랩', '밀레니즈 루프' 등의 키워드가 반복적으로 등장합니다. 본체 단독 매물과 달리 충전기, 보호필름, 케이스 등은 포함되어 있지 않고, 배터리 문제나 액정 파손 같은 손상 관련 언급도 없습니다. 따라서 이 클러스터는 스마트워치 액세서리 카테고리에 해당합니다. |

## Auto-Validated Keywords

> precision ≥ 0.80 → pipeline.ts에 추가 권장. 0.60~0.79 → 사람 검수 후 추가. < 0.60 → 제외.

### ✅ 자동 승인 (precision ≥ 0.80)

- `착용을` — precision: 1.00, hits: 2 — 모든 매물이 '착용을 거의 안 한' 상태로 'noise' 타입에 부합하여 정밀도는 1.0입니다.
- `가격제안` — precision: 1.00, hits: 3 — 모든 매물이 '가격제안' 키워드를 포함하여 'noise' 타입으로 정확히 분류되었습니다.

### 🔍 사람 검수 필요 (0.60 ≤ precision < 0.80)

- `지역` — precision: 0.60, hits: 8 — 총 5개 매물 중 3개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.6입니다.

### ❌ 자동 기각 (precision < 0.60)

- `가민` — precision: 0.50, hits: 2
- `어메이즈핏` — precision: 0.00, hits: 2
- `티렉스3` — precision: 0.00, hits: 2
- `개봉씰도` — precision: 0.00, hits: 2
- `안뜯은` — precision: 0.00, hits: 2
- `국내정발` — precision: 0.00, hits: 2
- `택포` — precision: 0.00, hits: 2
- `허용` — precision: 0.00, hits: 2
- `안심결제로만` — precision: 0.00, hits: 2
- `안했습니다` — precision: 0.00, hits: 3
- `중고로` — precision: 0.00, hits: 2
- `신품` — precision: 0.00, hits: 6
- `새제품입니다` — precision: 0.50, hits: 2
- `차단` — precision: 0.00, hits: 4

