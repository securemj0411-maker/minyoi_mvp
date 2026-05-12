# monitor_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T18:07:57.182Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=monitor_discovered --dry-run
node scripts/promote-catalog.mjs --category=monitor_discovered --apply
```

## 반영 후보 요약

- noise rules: 19개 (2개 고신뢰)
- sku candidates: 9개 (7개 promotion 후보, 2개 risk 차단)

## pipeline.ts 후보

- multi: `풀세트` (precision 0.80, hits 6)
- multi: `무료증정` (precision 1.00, hits 3)

## catalog.ts 후보

- 게이밍-모니터-24-32인치-fhd-144-180hz: 게이밍 모니터 24~32인치 FHD 144~180Hz / aliases=게이밍 모니터 24~32인치 FHD 144~180Hz, 게이밍 모니터, 32인치, 144Hz, 180Hz
- 주연테크-27인치-게이밍모니터-qhd-120hz: 주연테크 27인치 게이밍모니터 QHD 120Hz / aliases=주연테크 27인치 게이밍모니터 QHD 120Hz, 27인치, 게이밍모니터, QHD, 144Hz
- 화이트-게이밍-모니터-victrack-게이밍-모니터: 화이트 게이밍 모니터, VICTRACK 게이밍 모니터 / aliases=화이트 게이밍 모니터, VICTRACK 게이밍 모니터, 게이밍 모니터, 모니터 본체, 주사율, 사용
- aw2525hm: aw2525hm / aliases=aw2525hm, 모니터, 하자 전혀 없음, 구성품 전부 있음, 3달
- lg전자-27mp37vq: LG전자 27MP37VQ / aliases=LG전자 27MP37VQ, 모니터, LG전자, IPS, 27인치
- msi-275qf-lg-울트라기어-gx: MSI 275QF, LG 울트라기어 GX / aliases=MSI 275QF, LG 울트라기어 GX, 새제품, 미개봉, 게이밍모니터, 직거래
- tvlogic-lvm-171a-victrack-2-1k: TVLogic LVM-171A, VICTRACK 2.1K / aliases=TVLogic LVM-171A, VICTRACK 2.1K, 모니터, 본체, IPS 패널, 해상도

## 차단된 SKU 후보 (검수 필요)

- bg27fm3-pg248qp-mag275qf-xl2540k-유디아-25인치: BG27FM3, PG248QP, MAG275QF, XL2540K, 유디아 25인치 / risk=many_separators_in_sku_hint
- lg-울트라기어-27gl650f-기가바이트-gs27qa-rog-swift-oled-pg27aqdp: LG 울트라기어 27GL650F, 기가바이트 GS27QA, ROG SWIFT OLED PG27AQDP / risk=many_separators_in_sku_hint
