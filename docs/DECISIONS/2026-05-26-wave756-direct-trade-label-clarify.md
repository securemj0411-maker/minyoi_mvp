# Wave 756 — "직거래 전제" → "직거래만" 라벨 통일

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "왜 피드에는 직거래 전체라고 나오는거임??"

## 발견
"직거래 전제" 라벨 = `transactionMode === "direct_only"` 일 때 표시. 의미: "택배 불가, 직거래만 가능".

**문제**:
- "전제" (premise) 는 일상어 X — 사용자 80% 가 "전체" 로 잘못 읽거나 의미 못 잡음
- 다른 chip ("배송비 포함", "무료배송") 은 즉시 이해되는데 이거만 jargon
- 사용자 직접 "직거래 전체" 로 오인 confirm 됨

## 변경

6 곳 일괄 sed 치환: `직거래 전제` → `직거래만`

- `src/components/explore-client.tsx:2616` (feed shipping chip)
- `src/components/pack-reveal-modal.tsx:3415` (모달 chip)
- `src/components/user-reveal-dashboard.tsx:724` (내 매물 shippingSummary)
- `src/lib/marketplace-safety.ts:334` (data layer label)
- `src/lib/marketplace-safety.ts:336` (confidenceLabel)
- `src/lib/listing-verdicts.ts:256` (verdict label)

note: `playbook-overview.tsx:304` 의 `"직거래만" 가능하다면 위험` 문장은 이미 "직거래만" — 변경 X.

## 사용자 선택지 (참고)
- ✅ "직거래만" (사용자 선택 — 추천)
- "택배 불가" (직관적이지만 사이트 외 택배도 X 라 약간 과장)
- "동네 직거래만" (한 단어 더 김)

## 검증
- `npx tsc --noEmit` 0 에러
- 6 곳 텍스트 grep 으로 일관성 확인

## 위험
- 0. 라벨 텍스트만 변경. 로직 영향 X.

## 다음
- 운영 후 다른 jargon 라벨도 비슷한 audit 가능.
