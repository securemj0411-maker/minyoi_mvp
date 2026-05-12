# earphone_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T15:27:45.577Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=earphone_discovered --dry-run
node scripts/promote-catalog.mjs --category=earphone_discovered --apply
```

## 반영 후보 요약

- noise rules: 20개 (2개 고신뢰)
- sku candidates: 3개 (2개 promotion 후보, 1개 risk 차단)

## pipeline.ts 후보

- parts: `유닛` (precision 1.00, hits 35)
- parts: `단품` (precision 1.00, hits 11)

## catalog.ts 후보

- 에어팟-프로-2세대-c타입: 에어팟 프로 2세대 C타입 / aliases=에어팟 프로 2세대 C타입, 에어팟 프로2, C타입, 본체, 충전케이스
- airpods-pro2: Airpods Pro2 / aliases=Airpods Pro2, 미개봉, 에어팟 프로2, 새상품, 비닐 포장

## 차단된 SKU 후보 (검수 필요)

- 뉴클-nctw-cl-10-iz-lg-톤프리-hbs-tfn7-앱코-atf1000-삼성-갤럭시버즈fe-애플-비츠-핏-프: 뉴클 NCTW-CL-10-IZ, LG 톤프리 HBS-TFN7, 앱코 ATF1000, 삼성 갤럭시버즈FE, 애플 비츠 핏 프로 / risk=many_separators_in_sku_hint
