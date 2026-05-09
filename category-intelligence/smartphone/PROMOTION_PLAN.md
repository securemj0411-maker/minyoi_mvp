# smartphone — Promotion Plan (v3)

- generated_at: 2026-05-09T07:59:39.789Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=smartphone --dry-run
node scripts/promote-catalog.mjs --category=smartphone --apply
```

## 반영 후보 요약

- noise rules: 20개 (2개 고신뢰)
- sku candidates: 11개 (5개 promotion 후보, 6개 risk 차단)

## pipeline.ts 후보

- accessory: `케이스티파이` (precision 0.80, hits 21)
- accessory: `맥세이프` (precision 0.80, hits 27)

## catalog.ts 후보

- 아이폰13미니-128gb: 아이폰13미니 128GB / aliases=아이폰13미니 128GB, 아이폰13미니, 128, 고장품 파손품 없음, 모든기능 정상
- iphone-13-mini-128gb: iPhone 13 mini 128GB / aliases=iPhone 13 mini 128GB, 아이폰 13, 아이폰 13미니, 128GB, 배터리 효율
- iphone-13-mini-128gb-256gb: iPhone 13 mini 128GB / 256GB / aliases=iPhone 13 mini 128GB / 256GB, 아이폰13미니, 128, 256, 배터리
- iphone-14-pro-128gb: iPhone 14 Pro 128GB / aliases=iPhone 14 Pro 128GB, 아이폰 14 프로, 128GB, 배터리 효율, 정상 작동
- iphone-15-pro-128gb-256gb: iPhone 15 Pro 128GB / 256GB / aliases=iPhone 15 Pro 128GB / 256GB, 아이폰15pro, 화이트, 256GB, 128GB

## 차단된 SKU 후보 (검수 필요)

- 갤럭시-s23-256gb: 갤럭시 S23 256GB / risk=commercial_or_bait_terms
- 갤럭시-s23-fe-256gb: 갤럭시 S23 FE 256GB / risk=commercial_or_bait_terms
- 갤럭시-s24-256gb: 갤럭시 S24 256GB / risk=commercial_or_bait_terms
- 갤럭시s23-갤럭시s24-아이폰15-프로: 갤럭시S23, 갤럭시S24, 아이폰15 프로 / risk=commercial_or_bait_terms, multi_model_sku_hint, separator_with_multiple_models
- 갤럭시z플립4-256gb-갤럭시s23fe-256gb-갤럭시z플립3-256gb-갤럭시z플립6-256gb-갤럭시z플립5: 갤럭시Z플립4 256GB, 갤럭시S23FE 256GB, 갤럭시Z플립3 256GB, 갤럭시Z플립6 256GB, 갤럭시Z플립5 512GB / risk=commercial_or_bait_terms, multi_model_sku_hint, separator_with_multiple_models
- iphone-16-iphone-16-pro-iphone-17-iphone-17e: iPhone 16, iPhone 16 Pro, iPhone 17, iPhone 17e / risk=commercial_or_bait_terms, multi_model_sku_hint, separator_with_multiple_models
