# Wave 1217 — 시세 집계 lane에 POOL_BLOCK_NOTES 제외 이식 (화면=시세 일치)

날짜: 2026-06-06
관련: owner 발견(갤버즈3프로 시세 134,250 < 비교매물 15만), tick-pipeline.ts, condition-policy.ts

## owner 핵심 지적 (정확)
"화면 비교매물엔 부품/단품/FE가 안 나오는데(파싱·분류 됐으니), 왜 시세 계산만 오염된 다른 set을 쓰냐?
시세가 화면 비교매물과 다른 lane/필터를 쓰는 거냐?" → **부분적으로 YES.**

## 진단 + 측정 (정직한 정정)
- 시세 집계(tick-pipeline upsertMarketPriceDaily)는 **flawed class(4774) + bundle 2종(4784-5)만** 제외.
  화면 비교매물 lane은 `POOL_BLOCK_NOTES`(단품/한쪽/기능결함/구함/교환/리퍼 등 26종)도 제외 → **불일치.**
- 단 측정: POOL_BLOCK note 매물 19,906건 중 **19,897(99.95%)는 이미 flawed로 양쪽 제외**,
  normal로 시세에만 새는 건 **9건뿐**. → "게이트가 통째로 빠졌다"는 1차 진단은 과장이었음(정정).

## fix (이번)
tick-pipeline 시세 집계 group 빌드(4785 다음)에 `POOL_BLOCK_NOTES` 제외 추가
→ 시세 lane = 화면 lane 구조 일치. 영향 9건(안전, 오염 제거 방향).

## 버즈 시세 진짜 원인 (POOL_BLOCK 밖 — 미해결, 후속)
1. **FE 오매칭**: "버즈3fe"(다른 제품)가 catalog mustNotContain['fe'] 있는데도 comparable_key=
   galaxy_buds_3_pro로 매칭(본문 자동생성 "버즈3 프로" 기준 매칭, 제목 'fe' 누락). → 매칭 경로 수정 필요.
2. **박스빠짐 + trim 차이**: earphone_missing_parts(박스/충전기만 빠짐)는 POOL_BLOCK에도 화면 제외목록에도
   없음 → 화면·시세 둘 다 포함. 단 화면은 표시단계 madTrim/middle-band로 저가가 안 보이고, 시세 sold median은
   decay-trim이라 저가(70~100k)가 일부 살아 median을 끌어내림. → trim 정책 정렬 필요.
3. **미개봉 오분류**: "언박싱 새상품"이 normal로 분류(mint여야).

→ 이 3개는 정밀 작업(매칭/trim/분류)이라 별도 신중 wave. 섣불리 박으면 전 SKU 차익 영향(Wave 798c 교훈).

## TS check
clean.
