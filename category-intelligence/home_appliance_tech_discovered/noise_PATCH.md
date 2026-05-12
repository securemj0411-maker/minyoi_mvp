# Home Appliance Tech From Bunjang Category — Noise Rule Suggestions (v2)

- category: home_appliance_tech_discovered
- generated_at: 2026-05-10T18:54:44.194Z
- method: cluster-discovered (auto-validated)

## Discovered Noise Clusters

| cluster | type | confidence | distinctive_keywords | rationale |
|---|---|---|---|---|
| 4 | multi | high | 미개봉, 새상품, 부스터프로, 청소기, 디바이스 | 이 클러스터는 미개봉 새상품, 뷰티 디바이스, 무선청소기 등 다양한 생활/주방/미용 가전 제품들이 혼재되어 있어 단일 핵심 제품군으로 분류하기 어렵습니다. 일부는 뷰티 디바이스, 일부는 청소기 등 서로 다른 전자식 가전 본체들이 포함되어 있어 하나의 SKU로 대표할 수 없습니다. 또한 일부는 화장품이나 앰플 등 비전자식 소모품도 포함되어 있어 정상(normal) 카테고리에 부합하지 않습니다. 따라서 여러 제품이 혼합된 묶음(multi)으로 분류하는 것이 적절합니다. |
| 7 | accessory | high | 페이셜, 클렌징, 마사지, 미용, 보조기구 | 대표 샘플 '페이셜 클렌징 마사지'는 생활/주방/미용 가전 본체가 아닌 미용 보조기구로, 전자식 가전 본체나 명확한 기본 구성품이 아니며, 클렌징 마사지라는 액세서리 성격이 강해 정상 제품군에 해당하지 않습니다. 따라서 액세서리로 분류하는 것이 적합합니다. |
| 8 | accessory | high | 스타벅스, 키링, 키체인, 파우치, 텀블러 | 이 클러스터는 스타벅스 관련 상품들로, 텀블러, 키링, 키체인, 파우치 등 생활/주방/미용 가전과 직접 관련된 전자식 본체가 아닌 액세서리 및 기념품류 제품들로 구성되어 있습니다. 따라서 전자식 가전 본체가 아닌 주변 액세서리로 분류됩니다. |

## Auto-Validated Keywords

> precision ≥ 0.80 이더라도 일반 판매 문구/모델군 단어/거래 문장은 자동 반영하지 않는다.

### 🔍 사람 검수/자동 차단

- `택배비` — noise, precision: 0.00, hits: 9 / risk=generic_noise_type,transaction_or_sentence_fragment — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `해주세요` — noise, precision: 0.00, hits: 12 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `4천원` — noise, precision: 0.00, hits: 6 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `5000원` — noise, precision: 0.00, hits: 6 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다.
- `메디큐브` — noise, precision: 0.00, hits: 5 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0으로 평가됨.
- `포함` — noise, precision: 0.00, hits: 16 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `배송비` — noise, precision: 0.00, hits: 6 / risk=generic_noise_type,transaction_or_sentence_fragment — 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다.
- `중계동` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `역삼동` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `강남` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0으로 매우 낮음.
- `스펙` — noise, precision: 0.50, hits: 2 / risk=generic_noise_type — 두 매물 중 한 매물만 'noise' 타입으로 정확히 분류되어 전체 정밀도는 0.5입니다.
- `공정상` — noise, precision: 1.00, hits: 2 / risk=generic_noise_type — 모든 매물이 '공정상' 키워드를 포함한 noise 타입으로 정확히 분류됨.
- `해주시면` — noise, precision: 0.00, hits: 16 / risk=generic_noise_type,transaction_or_sentence_fragment — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `가격문의` — noise, precision: 0.50, hits: 2 / risk=generic_noise_type,transaction_or_sentence_fragment — 두 매물 중 한 매물만 noise 타입으로 정확히 분류되어 전체 precision은 0.5입니다.
- `텀쿠` — noise, precision: 0.00, hits: 2 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0입니다.
- `사진은` — noise, precision: 1.00, hits: 2 / risk=generic_noise_type — 모든 매물이 "사진은" 키워드를 포함하여 noise 타입으로 정확히 분류됨.

### ❌ 자동 기각 (precision < 0.60)

- `스타벅스` — precision: 0.40, hits: 6
- `미개봉새제품` — precision: 0.00, hits: 3

