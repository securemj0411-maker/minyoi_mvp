# Wave 118 — Galaxy Z/Watch/Buds + S Plus 행렬 일괄 + NORMALIZATIONS lookbehind fix

> 사용자 통찰: "다른 brand 빠짐없이 행렬 audit". 시리즈 전체 점검.

## 1. 진단 — 매물 빈도 측정
- 시간: 2026-05-15
- 발견 (14일):
  - Galaxy Watch 4: **261건** ⭐, Watch 5: 125
  - Z Flip 4/5/6 각 30/47/46
  - Z Fold 4/5/6/7 각 4/6/11/30
  - Galaxy Buds 3: 26
  - S21 Plus: 111, S22 Plus: 154, S23 Plus: 274

## 2. catalog 추가
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - Galaxy Z Flip 4/5/6 broad
  - Galaxy Z Fold 4/5/6/7 broad
  - Galaxy Watch 4/5
  - Galaxy Buds 3 일반
  - Galaxy S21/S22/S23 Plus
- 검증: 139/139 test pass.

## 3. Wave 118b — NORMALIZATIONS lookbehind 강화 ⭐ CRITICAL
- 시간: 2026-05-15
- 발견: live-read fixture test fail — "JBL 플립6 팝니다" → galaxy-z-flip-6에 잘못 매칭
- 근본 원인:
  - brand-less normalize `[/플립\s?(\d{1,2})/g, " 갤럭시 z플립 $1 "]` lookbehind에 JBL/Sony/Bose 없음
  - catalog token "플립6" 자체도 normalize → "갤럭시 z플립 6"으로 변환 (catalog token 보호 안 됨)
- 변경: lookbehind 강화:
  ```typescript
  [/(?<=\s)(?<!갤럭시\s)(?<!갤럭시\sz)(?<!jbl\s)(?<!sony\s)(?<!bose\s)플립\s?(\d{1,2})/gi, ...]
  ```
  - `(?<=\s)` — 단어 시작 변환 X (catalog token "플립6" 자체 보호)
  - JBL/Sony/Bose lookbehind 추가 (다른 브랜드 매물 보존)
- 검증: 139/139 test pass.

## 4. Wave 118c — PS5 Pro + Bose QC Ultra Earbuds + Mac Mini M4
- 시간: 2026-05-15
- 변경:
  - ps5-pro (2024-11 신상, 매물 11건)
  - bose-qc-ultra-earbuds (Headphones와 별도 모델, 13건)
  - desktop-mac-mini-m4 (2024-10, 13건)

## 5. Production reclassify
- 실행: scripts/reclassify-wave118-all.ts (3 iter)
- 결과: 89 + 10 + 2 = **101건 복구**

## 6. 거론 금지
- 대괄호 catalog token 금지 — Wave 122b에서 학습.
