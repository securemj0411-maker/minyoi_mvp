# Desktop PC From Bunjang Category — Noise Rule Suggestions (v2)

- category: desktop_pc_discovered
- generated_at: 2026-05-10T18:50:49.181Z
- method: cluster-discovered (auto-validated)

## Discovered Noise Clusters

| cluster | type | confidence | distinctive_keywords | rationale |
|---|---|---|---|---|
| 2 | accessory | high | 윈도우11, 윈도우10, 프로 홈, 정품키, 오피스2021 | 이 클러스터는 윈도우10, 윈도우11 프로 홈 정품키 및 오피스2021 정품키를 판매하는 목록들로, 데스크탑/PC 본체나 조립PC가 아닌 소프트웨어 라이선스 키를 판매하는 상품입니다. 따라서 데스크탑/PC 카테고리 내에서 핵심 제품인 완제품 본체가 아니며, 소프트웨어 정품키는 하드웨어 본체가 아닌 주변기기 또는 액세서리 성격으로 분류됩니다. |
| 11 | buying | high | 매입, 최고가 매입, 컴퓨터 부품, CPU, RAM | 이 클러스터는 데스크탑/PC 부품 및 완제품을 직접 판매하는 매물이 아니라, 컴퓨터 부품 및 노트북 등 다양한 전자기기를 매입하는 광고성 매입글로 구성되어 있습니다. 따라서 정상적인 완제품 데스크탑 본체나 조립PC 본체가 아닌 매입을 목적으로 한 글들이며, 이는 category_hints에서 정의한 '매입글/출장매입/업자 광고' 유형에 부합합니다. |

## Auto-Validated Keywords

> precision ≥ 0.80 이더라도 일반 판매 문구/모델군 단어/거래 문장은 자동 반영하지 않는다.

### 🔍 사람 검수/자동 차단

- `오래된` — noise, precision: 0.00, hits: 11 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 전체 precision은 0.0입니다.
- `안전한` — noise, precision: 0.00, hits: 15 / risk=generic_noise_type — 제공된 모든 매물은 'noise' 타입이 아니므로 전체 precision은 0.0입니다.
- `해드리겠습니다` — noise, precision: 0.00, hits: 14 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `닉네임` — noise, precision: 0.20, hits: 11 / risk=generic_noise_type — 전체적으로 5개 중 1개만 'noise' 타입으로 정확히 분류되어 정밀도는 0.2임.
- `번개톡으로` — buying, precision: 1.00, hits: 11 / risk=transaction_or_sentence_fragment — 모든 매물이 'buying' 타입으로 적절하게 분류되어 정확도가 100%입니다.
- `거래내역` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 전체 precision은 0.0입니다.
- `000건` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `1등` — noise, precision: 1.00, hits: 19 / risk=generic_noise_type — 모든 매물이 'noise' 타입으로 적절하게 분류되어 정밀도는 1.0입니다.
- `microsoft에서` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `출고된` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 모든 매물이 noise 타입이 아니므로 precision은 0.0입니다.
- `1대의` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 제공된 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다.
- `정품인증` — noise, precision: 1.00, hits: 10 / risk=generic_noise_type — 모든 매물이 'noise' 타입으로 정확히 분류되어 정밀도는 1.0입니다.
- `지원됩니다` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type — 제공된 모든 매물은 'noise' 타입이 아니므로 정밀도는 0.0입니다.
- `입력하면` — noise, precision: 0.00, hits: 10 / risk=generic_noise_type,verb_phrase_fragment — 제공된 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다.

### ❌ 자동 기각 (precision < 0.60)

- `프로` — precision: 0.00, hits: 40
- `정품키` — precision: 0.00, hits: 10
- `오피스2021` — precision: 0.00, hits: 10
- `정품키만` — precision: 0.00, hits: 10
- `영구인증` — precision: 0.00, hits: 10
- `리테일` — precision: 0.00, hits: 10

