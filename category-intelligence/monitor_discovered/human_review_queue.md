# Monitor From Bunjang Category — Human Review Queue (v3)

- category: monitor_discovered
- generated_at: 2026-05-10T18:07:57.182Z
- 목적: AI가 만든 룰/SKU 후보 중 production 반영 전 사람이 승인할 것만 모음

## 승인 후보 Noise Rules

| approve | type | keyword | precision | hits | note |
|---|---|---|---:|---:|---|
| [ ] | multi | `풀세트` | 0.80 | 6 | 전체적으로 5개 매물 중 4개가 'multi' 타입인 풀세트로 적절히 분류되었으나, 1개는 풀세트 기준에 부합하지 않아 정밀도는 0.8임. |
| [ ] | noise | `문의는` | 0.80 | 5 | 총 5개 매물 중 4개가 noise 타입으로 정확히 분류되어 전체 precision은 0.8입니다. |
| [ ] | noise | `2번` | 0.00 | 9 | 제공된 모든 매물은 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `본체만` | 0.75 | 4 | 전체적으로 4개 중 3개가 '본체만' 키워드를 포함한 'noise' 타입으로 정확히 분류되어 정밀도는 0.75임. |
| [ ] | noise | `9400f` | 0.50 | 4 | 총 4개 매물 중 2개가 정확히 '9400f' 타입으로 판단되어 정밀도는 0.5입니다. |
| [ ] | noise | `16g` | 0.00 | 7 | 제공된 모든 매물이 'noise' 타입이 아니므로 precision은 0.0입니다. |
| [ ] | noise | `안전결제해주시면` | 0.20 | 12 | 전체 매물 중 'noise' 타입은 1건으로, 정밀도는 0.2로 낮은 편임. |
| [ ] | noise | `12` | 0.00 | 23 | 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `주세요` | 0.00 | 25 | 모든 매물이 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `신품` | 0.80 | 9 | 총 5개 중 4개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.8입니다. |
| [ ] | noise | `rtx` | 0.60 | 7 | 총 5개 매물 중 3개가 'noise' 타입으로 정확히 분류되어 정밀도는 0.6입니다. |
| [ ] | noise | `중고` | 0.00 | 16 | 제공된 모든 매물은 'noise' 타입이 아니므로 정밀도는 0.0입니다. |
| [ ] | noise | `택배문의` | 0.00 | 3 | 제공된 모든 매물은 'noise' 타입이 아니므로 전체 precision은 0.0입니다. |
| [ ] | noise | `풀세트입니다` | 1.00 | 3 | 모든 매물이 '풀세트입니다' 키워드에 부합하는 'noise' 타입으로 정확히 분류됨. |
| [ ] | multi | `무료증정` | 1.00 | 3 | 모든 매물이 'multi' 타입에 적합하여 정확도가 100%입니다. |

## 승인 후보 SKU

| approve | sku_id | model_name | aliases | median | confidence |
|---|---|---|---|---:|---:|
| [ ] | 게이밍-모니터-24-32인치-fhd-144-180hz | 게이밍 모니터 24~32인치 FHD 144~180Hz | 게이밍 모니터 24~32인치 FHD 144~180Hz, 게이밍 모니터, 32인치, 144Hz, 180Hz | - | 0.90 |
| [ ] | 주연테크-27인치-게이밍모니터-qhd-120hz | 주연테크 27인치 게이밍모니터 QHD 120Hz | 주연테크 27인치 게이밍모니터 QHD 120Hz, 27인치, 게이밍모니터, QHD, 144Hz | - | 0.90 |
| [ ] | 화이트-게이밍-모니터-victrack-게이밍-모니터 | 화이트 게이밍 모니터, VICTRACK 게이밍 모니터 | 화이트 게이밍 모니터, VICTRACK 게이밍 모니터, 게이밍 모니터, 모니터 본체, 주사율, 사용 | - | 0.90 |
| [ ] | aw2525hm | aw2525hm | aw2525hm, 모니터, 하자 전혀 없음, 구성품 전부 있음, 3달 | - | 0.90 |
| BLOCK | bg27fm3-pg248qp-mag275qf-xl2540k-유디아-25인치 | BG27FM3, PG248QP, MAG275QF, XL2540K, 유디아 25인치 / risk=many_separators_in_sku_hint | BG27FM3, PG248QP, MAG275QF, XL2540K, 유디아 25인치, 게이밍 모니터, 인치, Hz, 브랜드명 | - | 0.90 |
| BLOCK | lg-울트라기어-27gl650f-기가바이트-gs27qa-rog-swift-oled-pg27aqdp | LG 울트라기어 27GL650F, 기가바이트 GS27QA, ROG SWIFT OLED PG27AQDP / risk=many_separators_in_sku_hint | LG 울트라기어 27GL650F, 기가바이트 GS27QA, ROG SWIFT OLED PG27AQDP, 27인치, 게이밍 모니터, IPS, TN | - | 0.90 |
| [ ] | lg전자-27mp37vq | LG전자 27MP37VQ | LG전자 27MP37VQ, 모니터, LG전자, IPS, 27인치 | - | 0.90 |
| [ ] | msi-275qf-lg-울트라기어-gx | MSI 275QF, LG 울트라기어 GX | MSI 275QF, LG 울트라기어 GX, 새제품, 미개봉, 게이밍모니터, 직거래 | - | 0.90 |
| [ ] | tvlogic-lvm-171a-victrack-2-1k | TVLogic LVM-171A, VICTRACK 2.1K | TVLogic LVM-171A, VICTRACK 2.1K, 모니터, 본체, IPS 패널, 해상도 | - | 0.90 |
