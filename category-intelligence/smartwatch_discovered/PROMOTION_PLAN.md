# smartwatch_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T15:27:45.577Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=smartwatch_discovered --dry-run
node scripts/promote-catalog.mjs --category=smartwatch_discovered --apply
```

## 반영 후보 요약

- noise rules: 17개 (0개 고신뢰)
- sku candidates: 8개 (5개 promotion 후보, 3개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- 삼성-갤럭시-워치7-44mm-실버: 삼성 갤럭시 워치7 44mm 실버 / aliases=삼성 갤럭시 워치7 44mm 실버, 갤럭시 워치7, 44mm, 실버, 본체
- 애플워치-울트라2-내추럴-49mm: 애플워치 울트라2 내추럴 49mm / aliases=애플워치 울트라2 내추럴 49mm, 애플워치 울트라2, 내추럴, 49mm, 배터리 95프로
- 애플워치-se-40mm-44mm: 애플워치 SE 40mm / 44mm / aliases=애플워치 SE 40mm / 44mm, 애플워치 SE, 40mm, 44mm, 정품
- 애플워치-se-44mm: 애플워치 SE 44mm / aliases=애플워치 SE 44mm, 애플워치 SE, 44mm, 풀박스, 배터리 성능
- apple-watch-se-40mm: Apple Watch SE 40mm / aliases=Apple Watch SE 40mm, 애플워치, SE, 40mm, 배터리성능

## 차단된 SKU 후보 (검수 필요)

- 갤럭시-워치-46mm-lte-갤럭시워치6-클래식-43mm-wifi: 갤럭시 워치 46mm LTE, 갤럭시워치6 클래식 43mm WiFi / risk=multi_model_sku_hint, separator_with_multiple_models
- 애플워치10-42mm-애플워치-울트라2-49mm-갤럭시워치8-클래식-46mm-갤럭시워치8-40mm-애플워치-se3-: 애플워치10 42mm, 애플워치 울트라2 49mm, 갤럭시워치8 클래식 46mm, 갤럭시워치8 40mm, 애플워치 SE3 40mm / risk=multi_model_sku_hint, separator_with_multiple_models, many_separators_in_sku_hint, generic_alias_heavy
- 애플워치11-46mm-애플워치11-42mm-애플워치8-에르메스-45mm-애플워치10-에르메스-42mm: 애플워치11 46mm, 애플워치11 42mm, 애플워치8 에르메스 45mm, 애플워치10 에르메스 42mm / risk=multi_model_sku_hint, separator_with_multiple_models, many_separators_in_sku_hint
