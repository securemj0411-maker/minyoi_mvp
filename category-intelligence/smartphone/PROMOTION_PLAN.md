# smartphone — Promotion Plan (v3)

- generated_at: 2026-05-09T11:25:14.854Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=smartphone --dry-run
node scripts/promote-catalog.mjs --category=smartphone --apply
```

## 반영 후보 요약

- noise rules: 20개 (7개 고신뢰)
- sku candidates: 6개 (1개 promotion 후보, 5개 risk 차단)

## pipeline.ts 후보

- damaged: `파손` (precision 0.80, hits 160)
- buying: `삽니다` (precision 0.80, hits 59)
- buying: `최고가` (precision 1.00, hits 98)
- buying: `출장` (precision 1.00, hits 50)
- buying: `견적` (precision 0.80, hits 65)
- buying: `전문` (precision 1.00, hits 56)
- buying: `프로` (precision 0.80, hits 146)

## catalog.ts 후보

- 갤럭시-s23-s22-s10e-버디-등-다양한-모델: 갤럭시 S23+, S22, S10e, 버디 등 다양한 모델 / aliases=갤럭시 S23+, S22, S10e, 버디 등 다양한 모델, 공기계, 중고 휴대폰, 기기 단품상품, 정상작동

## 차단된 SKU 후보 (검수 필요)

- 갤럭시-s25-256gb-512gb-1tb-모델별로-s25-s25-플러스-s25-엣지-s25-울트라-포함: 갤럭시 S25 256GB, 512GB, 1TB (모델별로 S25, S25 플러스, S25 엣지, S25 울트라 포함) / risk=commercial_or_bait_terms
- 갤럭시s22-256gb-갤럭시s7-32gb-아이폰6s-64gb-갤럭시z폴드7: 갤럭시S22 256GB, 갤럭시S7 32GB, 아이폰6s 64GB, 갤럭시Z폴드7 / risk=commercial_or_bait_terms, multi_model_sku_hint, separator_with_multiple_models
- 아이폰se1-16gb-32gb-128gb: 아이폰SE1 16GB/32GB/128GB / risk=commercial_or_bait_terms
- iphone-15-pro-256gb: iPhone 15 Pro 256GB / risk=commercial_or_bait_terms
- iphone-se1-128gb: iPhone SE1 128GB / risk=commercial_or_bait_terms
