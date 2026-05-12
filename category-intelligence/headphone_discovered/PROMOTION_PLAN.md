# headphone_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T15:27:45.577Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=headphone_discovered --dry-run
node scripts/promote-catalog.mjs --category=headphone_discovered --apply
```

## 반영 후보 요약

- noise rules: 0개 (0개 고신뢰)
- sku candidates: 10개 (2개 promotion 후보, 8개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- apple-airpods-max-1st-or-2nd-generation-usb-c-모델: Apple AirPods Max (1st or 2nd generation) USB-C 모델 / aliases=Apple AirPods Max (1st or 2nd generation) USB-C 모델, 에어팟 맥스, C타입, 미드나이트, 풀박스
- sony-wh-ch520: Sony WH-CH520 / aliases=Sony WH-CH520, 소니, WH-CH520, 무선 헤드폰, 블루투스

## 차단된 SKU 후보 (검수 필요)

- 에어팟맥스-2026-스타라이트: 에어팟맥스 2026 스타라이트 / risk=generic_alias_heavy
- 젠하이저-hd569-비츠-닥터드레-ep-소니-mdr-30-소니-mdr-zx310ap-b-o-포탈: 젠하이저 HD569, 비츠 닥터드레 EP, 소니 MDR-30, 소니 MDR-ZX310AP, b&o 포탈 / risk=many_separators_in_sku_hint, generic_alias_heavy
- airpods-max-8핀-스페이스-그레이: AirPods Max 8핀 스페이스 그레이 / risk=generic_alias_heavy
- apple-airpods-max: Apple AirPods Max / risk=generic_alias_heavy
- apple-airpods-max-c타입: Apple AirPods Max C타입 / risk=generic_alias_heavy
- bose-qc-ultra: Bose QC Ultra / risk=generic_alias_heavy
- sony-wh-1000xm5: Sony WH-1000XM5 / risk=multi_model_sku_hint
- sony-wh-1000xm5-sony-wh-1000xm6: Sony WH-1000XM5, Sony WH-1000XM6 / risk=multi_model_sku_hint, separator_with_multiple_models
