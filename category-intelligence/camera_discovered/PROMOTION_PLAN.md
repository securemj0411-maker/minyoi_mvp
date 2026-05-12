# camera_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T18:36:24.821Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=camera_discovered --dry-run
node scripts/promote-catalog.mjs --category=camera_discovered --apply
```

## 반영 후보 요약

- noise rules: 0개 (0개 고신뢰)
- sku candidates: 11개 (6개 promotion 후보, 5개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- canon-eos-r6: Canon EOS R6 / aliases=Canon EOS R6, 캐논, EOS R6, EOS M6, 바디
- leica-m6-ttl: Leica M6 TTL / aliases=Leica M6 TTL, leica, m6 ttl, new, 필름카메라
- nikon-z5-nikon-1-j1: Nikon Z5 / Nikon 1 J1 / aliases=Nikon Z5 / Nikon 1 J1, 니콘, 미러리스, 카메라 바디, 배터리
- sony-a5100-a5000-미러리스-카메라-바디: Sony a5100 / a5000 미러리스 카메라 바디 / aliases=Sony a5100 / a5000 미러리스 카메라 바디, 소니, 미러리스, a5100, a5000
- sony-a7-series-full-frame-mirrorless-camera-body: Sony A7 Series Full Frame Mirrorless Camera Body / aliases=Sony A7 Series Full Frame Mirrorless Camera Body, 소니, A7, 풀프레임, 미러리스
- sony-a7rm5-mirrorless-camera-body: Sony A7RM5 Mirrorless Camera Body / aliases=Sony A7RM5 Mirrorless Camera Body, 미러리스 카메라 바디, 정품 박스, 충전기, 배터리

## 차단된 SKU 후보 (검수 필요)

- 니콘-zfc-니콘-z5-삼성-ex2f: 니콘 ZFC, 니콘 Z5, 삼성 EX2F / risk=many_separators_in_sku_hint
- 소니-a6000-캐논-eos-600d-캐논-eos-200d-소니-a5100-후지필름-x-t50: 소니 a6000, 캐논 EOS 600D, 캐논 EOS 200D, 소니 A5100, 후지필름 X-T50 / risk=many_separators_in_sku_hint
- 후지필름-x-s10-x-t20-x-t4-미러리스-카메라-바디: 후지필름 X-S10 / X-T20 / X-T4 미러리스 카메라 바디 / risk=many_separators_in_sku_hint
- canon-eos-r8-eos-r10-eos-r6-eos-6d: Canon EOS R8 / EOS R10 / EOS R6 / EOS 6D / risk=many_separators_in_sku_hint
- sony-cyber-shot-dsc-w830-sony-cyber-shot-dsc-w110-sony-zv-e10: Sony Cyber-shot DSC-W830 / Sony Cyber-shot DSC-W110 / SONY ZV-e10 / risk=many_separators_in_sku_hint
