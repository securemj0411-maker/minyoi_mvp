# desktop_pc_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T18:50:49.181Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=desktop_pc_discovered --dry-run
node scripts/promote-catalog.mjs --category=desktop_pc_discovered --apply
```

## 반영 후보 요약

- noise rules: 20개 (0개 고신뢰)
- sku candidates: 10개 (6개 promotion 후보, 4개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- 게이밍-조립식-컴퓨터-본체-i5-9400f-gtx-1060-rtx-2060: 게이밍 조립식 컴퓨터 본체 i5 9400F GTX 1060 / RTX 2060 / aliases=게이밍 조립식 컴퓨터 본체 i5 9400F GTX 1060 / RTX 2060, 게이밍 조립식 컴퓨터 본체, i5 9400F, GTX 1060, RTX 2060
- 인텔-코어-i5-12400-rtx-4060-16gb-ram-조립pc: 인텔 코어 i5 12400 / RTX 4060 16GB RAM 조립PC / aliases=인텔 코어 i5 12400 / RTX 4060 16GB RAM 조립PC, 컴퓨터 본체, 게이밍 컴퓨터, CPU, 그래픽카드
- 조립식-게이밍-데스크탑-pc: 조립식 게이밍 데스크탑 PC / aliases=조립식 게이밍 데스크탑 PC, 조립식PC, 컴퓨터본체, 게이밍, 중고컴퓨터
- 조립식-데스크탑-pc-본체: 조립식 데스크탑 PC 본체 / aliases=조립식 데스크탑 PC 본체, 컴퓨터본체, 데스크탑PC, 조립식컴퓨터, 사무용
- amd-7800x3d-게이밍-컴퓨터-본체: AMD 7800X3D 게이밍 컴퓨터 본체 / aliases=AMD 7800X3D 게이밍 컴퓨터 본체, 게이밍 컴퓨터 본체, AMD 7800X3D, AMD 9800X3D, CPU
- intel-i5-14400f-조립pc-intel-i5-9400f-조립pc: Intel i5 14400F 조립PC, Intel i5 9400F 조립PC / aliases=Intel i5 14400F 조립PC, Intel i5 9400F 조립PC, 인텔 I5 14400F, 인텔 I5 9400F, 조립PC, 완제품 본체

## 차단된 SKU 후보 (검수 필요)

- 선만-꽂으면-끝-게이밍-사무용-완제품-데스크탑-pc: 선만 꽂으면 끝 게이밍/사무용 완제품 데스크탑 PC / risk=broad_bundle_or_usecase_sku_hint
- 성인pc방-맞춤-전용-가성비-컴퓨터-본체-모니터-풀세트: 성인PC방 맞춤 전용 가성비 컴퓨터 본체 모니터 풀세트 / risk=commercial_or_bait_terms, broad_bundle_or_usecase_sku_hint
- 조립pc-게이밍-본체-i5-12400f-rtx3060-등-다양한-cpu-gpu-조합: 조립PC 게이밍 본체 (i5/12400F/RTX3060 등 다양한 CPU+GPU 조합) / risk=many_separators_in_sku_hint
- 조립pc-본체: 조립PC 본체 / risk=commercial_or_bait_terms
