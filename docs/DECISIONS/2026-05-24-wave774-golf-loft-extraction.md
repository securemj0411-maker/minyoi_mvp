# Wave 774 — sport_golf loft 추출 + comparable_key fragmentation

**날짜**: 2026-05-24
**Wave**: 774 (사용자 #10 검증 메모 — 첫 골프 매물 sample audit)

## 사용자 검증 메모 (pid 407988633)

같은 SKU `타이틀리스트 TSR2` 안에:
- 9도 드라이버 ₩370,000
- 11도 + TSP111 샤프트 ₩565,000 (52% 비쌈)

> "이거 각도 다른데 의도한건가?"

## 진단

**의도 아님**. Wave 759 note:
> "loft 옵션 parser 보강 전 사용자 노출 보류"

= 미해결 미뤘던 거. Wave 760c 에서 ready 풀면서 첫 매물부터 부조리 발견.

Wave 67 잘못된 가정:
> "로프트는 동일 모델 내 시세 영향 작음"

= 9도 vs 11도 52% 시세 차이 — 가정 잘못.

## Fix

`option-parser.ts` sport_golf loft 추출:
- driver/wood/hybrid (iron/wedge skip)
- 정규식: `(?:^|[^0-9])(\d{1,2}(?:\.\d)?)\s*(?:도(?![가-힣])|°|deg)`
- 한글 boundary: `도(?![가-힣])` — "9도 드라이버" ✓, "9도무엇" ✗
- comparable_key 끝에 `loft_9` / `loft_10_5` 등 추가
- parsedJson.golf_loft UI 표시

PARSER_VERSION v57 → v58 → drift gate reparse.

## 검증 (7/7 pass)

| Test | loft | key |
|---|---|---|
| TSR2 9도 | 9 | loft_9 |
| TSR2 11도 + TSP111 | 11 | loft_11 |
| Stealth2 10.5도 | 10.5 | loft_10_5 |
| Qi10 9° 영문 | 9 | loft_9 |
| G430 21도 하이브리드 | 21 | loft_21 |
| 페어웨이 15도 | 15 | loft_15 |
| 아이언 세트 (skip) | null | key 그대로 |

## 효과
- TSR2 9도 → `loft_9` pool 만 시세 비교
- TSR2 11도 → `loft_11` 별도 pool
- 같은 SKU 안 시세 부조리 해소
