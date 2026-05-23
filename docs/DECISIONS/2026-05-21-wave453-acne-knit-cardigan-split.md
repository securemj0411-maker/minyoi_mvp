# 2026-05-21 Wave453 — Acne knit/cardigan split

## 배경
- Acne broad 잔여에 니트/스웨터/가디건이 `clothing-acne-apparel` 로 남아 있었다.
- 티/스웻/자켓/팬츠와 가격대가 달라 broad sample 에 섞이면 시세가 흔들린다.

## 결정
- `clothing-acne-knit` lane 을 추가하고 `acne_knit` 을 ready 로 등록했다.
- `clothing-acne-apparel` 과 generated `clothing-acne-broad` 에 knit/cardigan 계열 must-not 을 추가해 explicit lane 이 우선되게 했다.
- `Acne Studios Peele` token 은 현 DB parser 에서 knit 로 파싱되는 잔여 row 가 있어 같은 knit lane 에 포함했다.

## DB 적용
- 1차 적용:
  - active `clothing-acne-apparel` 17건 중 5건 이동.
  - 대표: `아크네 날론니트 민트M`, `[XS]아크네 모헤어 스트라이프 니트`, `아크네스튜디오 체스트 로고 자수 울 코튼 가디건 L`.
- Wave455 보강 후 추가 적용:
  - `pid=409011364` `아크네 스튜디오 형광 peele` → `clothing-acne-knit`.
  - comparable key: `clothing|acne_knit|knit|b_grade`.

## 검증
- `ruleMatch("[XS]아크네 모헤어 스트라이프 니트")` → `clothing-acne-knit`.
- `ruleMatch("아크네스튜디오 체스트 로고 자수 울 코튼 가디건 L")` → `clothing-acne-knit`.
- `ruleMatch("아크네 스튜디오 형광 peele")` → `clothing-acne-knit`.

## 보류
- `찰스`, `T52`, `A00309863` 은 모델명/품번 검수가 필요해 broad hold 로 남겼다.
