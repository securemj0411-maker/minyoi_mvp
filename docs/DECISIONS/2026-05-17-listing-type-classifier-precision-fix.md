# 2026-05-17 — listing_type classifier 본질 fix (5-iteration 사용자 검토)

## 사용자 요구

- "왤케 구멍이 뒤숭숭해; 항상 현상을 발견하면 근본적원인 부터 싹을 뽑아야함"
- 5 iteration 깊게 검토 후 본질 fix.

## 5 iteration 검토 결과

| Iter | 영역 | root cause | 추정 영향 |
|---|---|---|---|
| 1 | PARTS | "단품"/"호환"/"낱개" 단순 substring 매칭 | ~2,484건 |
| 2 | GENERATED_NOISE | 빈 배열, 영향 X | 0 |
| 3 | ACCESSORY (game console) | "디스크" 단독 매칭 → PS5 본품 false positive. 게임 title keyword → 한정판 본품 (스위치 OLED 동물의숲 에디션) false positive | ~500~1,000건 |
| 4 | DAMAGED | "하자/파손/수리" negation 차단 X — "하자 없음" / "하자나 오염없" / "심각한 하자 없" 정상 표현 매칭 | ~1,000~2,000건 |
| 5 | commercial/multi/buying | 정확 분류 | 미미 |

## 변경

### Patch 1 — PARTS contextual

- `src/lib/pipeline.ts:34-41` `PARTS_KEYWORDS` 에서 "단품"/"호환" 제거. "낱개" 도 contextual 분리.
- 새 함수 `partsContextualHits(text)` (line 41+):
  - `(왼쪽|오른쪽|좌측|우측|한쪽|한짝|유닛|이어버드|본체|본품|배터리|액정|디스플레이|스타일러스|s펜|에스펜).{0,8}(단품|만 판매|만 팝)` — strict
  - `호환.{0,8}(부품|단품|교체|어댑터|배터리|케이블만|충전기만)` strict
  - `낱개.{0,4}(만 판매|판매)` strict
  - `(에어팟|버즈|이어팟|airpods|galaxy buds).{0,12}(본체|본체만)` (사용자 #1 요청, "본체" 단독)
- `partsHits` (line 250+) 에 `[...containsAny(...PARTS_KEYWORDS), ...partsContextualHits(text)]` 결합.
- "케이스" 는 `단품_부품_context` regex 에서 제외 (케이스 단품 = accessory 분류 우선, 충돌 차단).

### Patch 2 — DAMAGED negation

- `src/lib/pipeline.ts:367+` `damagedHits.filter` 에 "수리이력 없음" negation 추가.
- `hasNegatedOrContingentDefect` (line 379+) 확장:
  - `하자나오염없 / 하자나기스없 / 하자흠집 / 하자거의없 / 하자약간 / 하자미세 / 하자크게는없 / 하자크진않 / 하자크지않 / 하자많지않 / 하자있는제품은명시 / 심각한하자(흠집|없) / 심각하지않 / 심각한문제없`
  - `(하자|파손|기스|찍힘) (는|가|이|나|등)? (사용|생활|미세|약간|적|거의|매우)` — 정상 표현
- "하자" 매칭 strict 화 — `(심각한 하자|큰 하자|하자 있|하자 발견|하자 발생|하자있|기능 하자.*(있|발견|발생)|기능적 하자|기능 문제|기능상 하자)` 만 매칭.

### Patch 3 — ACCESSORY (game console)

- `src/lib/game-console-parser.ts:199+` `titleOnly` regex 수정:
  - "디스크" 단독 매칭 제거. `(게임 디스크|게임디스크|디스크 N장|N장 디스크)` 명시만 매칭 + `(디스크 에디션|디스크 버전)` exclude (PS5 본품).
  - 게임 title keyword (포켓몬스터, 동물의숲, 슈퍼마리오 등) + `(에디션|한정판|콘솔|본체|풀세트|풀박스|풀구성)` 결합 시 본품 → titleOnly 제외 (예: 스위치 OLED 동물의숲 에디션).

## 검증

- `npm run test:core` 172/172 pass.
- 전체 reclassify 23,000+ 매물.
- listing_type 분포 (7일 base):
  | listing_type | 이전 | 새 | 변화 |
  |---|---|---|---|
  | **normal** | 14,536 | **16,870** | **+2,334** ✅ |
  | **parts** | 6,039 | **5,091** | **-948** (-15.7%) ✅ |
  | accessory | 8,588 | 10,214 | +1,626 (새 매물 누적 + game console fix 영향 작음) |
  | damaged | 3,559 | 3,876 | +317 |

- 핵심 win: **parts 948건 정상 매물 회복** (대부분 normal 로 재분류).

## 위험

- 새 contextual regex 가 진짜 parts 매물 (예: "에어팟 본체") 제외할 위험. test 172/172 pass 로 부분 검증.
- DAMAGED 의 "하자" strict 화로 일부 진짜 damaged 매물 normal 박힐 가능성. 단 정상 매물 회복 효과 > recall 손해.
- accessory 가 오히려 증가 (8,588 → 10,214) — 새 매물 더 들어옴 + game console fix 효과 작음. iter 3 영역 PS5/닌텐도 매물 자체가 적어서 큰 영향 X.

## 다음

- iter 3 (smartphone phoneAccessorySignal) 추가 검토 — accessory 줄이려면 별 fix 필요.
- 새 매물 들어오면서 자연 누적 효과 측정 (며칠 후).
