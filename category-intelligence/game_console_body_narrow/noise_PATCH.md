# Game Console Body Narrow Mining — Noise Rule Suggestions (v2)

- category: game_console_body_narrow
- generated_at: 2026-05-11T02:09:33.449Z
- method: cluster-discovered (auto-validated)

## Discovered Noise Clusters

| cluster | type | confidence | distinctive_keywords | rationale |
|---|---|---|---|---|
| 5 | multi | high | 닌텐도 스위치 라이트, 본체, 국내 정품, 하우징, 팬 | 클러스터 내에 닌텐도 스위치 라이트 본체와 본체 하우징, 팬 환풍기 등 본체와 직접 비교 가능한 완제품이 아닌 액세서리 및 부품이 혼재되어 있어 단일 본체 SKU로 분류하기 어렵고, 여러 제품군이 묶여 있어 'multi' 타입으로 분류됩니다. |
| 8 | buying | high | 매입, 삽니다, 최고가, 안전결제, 닌텐도 | 이 클러스터는 닌텐도 스위치, 3DS, DS, PS5 등 게임기 본체 및 게임칩을 포함한 다양한 게임기 제품을 최고가로 매입한다는 내용의 매입글로 구성되어 있습니다. 본체 단독 판매가 아닌 매입 의뢰 및 구매 희망 글이 주를 이루며, 매입, 삽니다, 최고가, 안전결제 등의 단어가 반복적으로 등장하여 구매 의도를 명확히 나타냅니다. 따라서 본체 전용 정상 매물(판매)과는 달리 매입(구매) 글로 분류하는 것이 적합합니다. |

## Auto-Validated Keywords

> precision ≥ 0.80 이더라도 일반 판매 문구/모델군 단어/거래 문장은 자동 반영하지 않는다.

### ✅ 자동 승인

- `매입` — precision: 1.00, hits: 4 — 모든 매물이 '매입' 키워드를 포함하고 구매 의사를 명확히 표현하여 모두 'buying' 타입으로 적합합니다.
- `최고가` — precision: 1.00, hits: 4 — 모든 매물이 buying 타입에 부합하여 precision은 1.0입니다.
- `삽니다` — precision: 1.00, hits: 5 — 모든 매물이 '삽니다' 키워드에 부합하는 구매 의도를 가진 'buying' 타입으로 정확히 분류됨.

### 🔍 사람 검수/자동 차단

- `3ds` — noise, precision: 1.00, hits: 4 / risk=generic_noise_type,broad_product_family_keyword — 모든 매물이 'noise' 타입으로 적합하여 정밀도는 1.0입니다.
- `찍어서` — noise, precision: 0.20, hits: 6 / risk=generic_noise_type — 총 5개 매물 중 1개만 '찍어서' 키워드가 포함된 noise 타입으로 정확히 판단되어 정밀도는 0.2임.
- `게임기` — noise, precision: 1.00, hits: 5 / risk=generic_noise_type,broad_product_family_keyword — 모든 매물이 '게임기' 관련 내용으로 noise 타입에 부합하여 전체 precision은 1.0입니다.
- `해드립니다` — noise, precision: 0.20, hits: 10 / risk=generic_noise_type,sentence_fragment,verb_phrase_fragment — 총 5개 매물 중 1개만 'noise' 타입으로 판단되어 정밀도는 0.2임.
- `직접` — noise, precision: 0.50, hits: 4 / risk=generic_noise_type — 전체적으로 닌텐도 직접 매입 관련 매물은 일부에 해당하며, 정확도는 50%로 보임.
- `ds` — noise, precision: 1.00, hits: 4 / risk=generic_noise_type,broad_product_family_keyword — 모든 매물이 'noise' 타입으로 적합하여 정밀도는 1.0입니다.
- `2ds` — noise, precision: 0.00, hits: 3 / risk=generic_noise_type,broad_product_family_keyword — 제공된 모든 매물이 'noise' 타입이 아니므로 전체 precision은 0.0임.
- `3dsxl` — noise, precision: 0.00, hits: 3 / risk=generic_noise_type — 제공된 모든 매물은 'noise' 타입이 아니므로 전체 정밀도는 0.0입니다.
- `24시간` — noise, precision: 0.33, hits: 3 / risk=generic_noise_type — 전체적으로 3개의 매물 중 1개만 'noise' 타입으로 적절하게 분류되어 정밀도가 낮음.
- `가격은` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `보내주시면` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type,transaction_or_sentence_fragment — 제공된 매물 모두 'noise' 타입이 아니므로 전체 precision은 0.0입니다.
- `번개장터` — noise, precision: 0.00, hits: 4 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다.
- `가구요` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0입니다.
- `매입합니다` — buying, precision: 1.00, hits: 2 / risk=sentence_fragment,verb_phrase_fragment — 모든 매물이 buying 타입으로 정확히 분류되어 정밀도는 1.0입니다.
- `진행` — noise, precision: 0.00, hits: 5 / risk=generic_noise_type — 제공된 모든 매물은 'noise' 타입이 아니므로 전체 precision은 0.0입니다.
- `번개페이로만` — noise, precision: 1.00, hits: 2 / risk=generic_noise_type — 모든 매물이 'noise' 타입으로 정확히 분류되었습니다.

### ❌ 자동 기각 (precision < 0.60)

- `국내` — precision: 0.25, hits: 4

