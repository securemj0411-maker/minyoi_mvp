# galaxywatch — Promotion Plan (v3)

- generated_at: 2026-05-09T08:27:28.335Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=galaxywatch --dry-run
node scripts/promote-catalog.mjs --category=galaxywatch --apply
```

## 반영 후보 요약

- noise rules: 7개 (3개 고신뢰)
- sku candidates: 13개 (13개 promotion 후보, 0개 risk 차단)

## pipeline.ts 후보

- mixed: `삽니다` (precision 1.00, hits 30)
- accessory: `3in1` (precision 1.00, hits 6)
- accessory: `무선` (precision 0.80, hits 11)

## catalog.ts 후보

- 갤럭시-워치3-41mm-45mm: 갤럭시 워치3 41mm, 45mm / aliases=갤럭시 워치3 41mm, 45mm, 갤럭시 워치3, 45mm, 41mm, 충전기
- 갤럭시-워치4-40mm-또는-44mm: 갤럭시 워치4 40mm 또는 44mm / aliases=갤럭시 워치4 40mm 또는 44mm, 갤럭시 워치4, 판매합니다, 본체, 기능 정상
- 갤럭시-워치4-44mm-갤럭시-워치5-44mm-갤럭시-워치4-40mm: 갤럭시 워치4 44mm, 갤럭시 워치5 44mm, 갤럭시 워치4 40mm / aliases=갤럭시 워치4 44mm, 갤럭시 워치5 44mm, 갤럭시 워치4 40mm, 갤럭시워치4, 갤럭시 워치5, 44mm, 40mm
- 갤럭시-워치5-40mm-갤럭시-워치5-44mm-갤럭시-워치5-프로-45mm: 갤럭시 워치5 40mm, 갤럭시 워치5 44mm, 갤럭시 워치5 프로 45mm / aliases=갤럭시 워치5 40mm, 갤럭시 워치5 44mm, 갤럭시 워치5 프로 45mm, 갤럭시 워치5, 갤럭시워치5, 워치5 프로, 44mm
- 갤럭시워치4-44mm-갤럭시워치4-클래식: 갤럭시워치4 44mm / 갤럭시워치4 클래식 / aliases=갤럭시워치4 44mm / 갤럭시워치4 클래식, 갤럭시워치4, 갤럭시워치4 클래식, 판매, 본체
- 삼성-갤럭시-워치8-32gb: 삼성 갤럭시 워치8 32GB / aliases=삼성 갤럭시 워치8 32GB, 갤럭시 워치8, 미개봉, 새상품, 32GB
- 삼성-갤럭시워치4-40mm-sm-r860-sm-r865n-sm-r865u-및-갤럭시워치5-40mm-sm-r900: 삼성 갤럭시워치4 40mm SM-R860, SM-R865N, SM-R865U 및 갤럭시워치5 40mm SM-R900 / aliases=삼성 갤럭시워치4 40mm SM-R860, SM-R865N, SM-R865U 및 갤럭시워치5 40mm SM-R900, 갤럭시워치, 삼성, SM-R860, SM-R865N
- 샤오미-레드미워치5-액티브-블랙: 샤오미 레드미워치5 액티브 블랙 / aliases=샤오미 레드미워치5 액티브 블랙, 샤오미, 스마트워치, 레드미워치5, 액티브
- galaxy-watch-3: Galaxy Watch 3 / aliases=Galaxy Watch 3, 갤럭시워치3, 워치3, 본체, 충전기
- galaxy-watch-3-galaxy-watch-5-galaxy-watch-6-톰브라운-에디션-포함: Galaxy Watch 3, Galaxy Watch 5, Galaxy Watch 6 톰브라운 에디션 포함 / aliases=Galaxy Watch 3, Galaxy Watch 5, Galaxy Watch 6 톰브라운 에디션 포함, 갤럭시워치, 삼성, 워치, 스트랩
- galaxy-watch-3-galaxy-watch-ultra-galaxy-watch5-pro-galaxy-activ: Galaxy Watch 3, Galaxy Watch Ultra, Galaxy Watch5 Pro, Galaxy Active2 / aliases=Galaxy Watch 3, Galaxy Watch Ultra, Galaxy Watch5 Pro, Galaxy Active2, 갤럭시 워치, 풀박스, 새상품, s급
- galaxy-watch8-40mm-galaxy-watch8-44mm-galaxy-watch8-classic: Galaxy Watch8 40mm, Galaxy Watch8 44mm, Galaxy Watch8 Classic / aliases=Galaxy Watch8 40mm, Galaxy Watch8 44mm, Galaxy Watch8 Classic, 갤럭시워치8, 미개봉, 새상품, 삼성정품
- samsung-galaxy-watch7-44mm-samsung-galaxy-watch6-40mm: Samsung Galaxy Watch7 44mm, Samsung Galaxy Watch6 40mm / aliases=Samsung Galaxy Watch7 44mm, Samsung Galaxy Watch6 40mm, 갤럭시 워치7, 갤럭시 워치6, 44mm, 40mm
