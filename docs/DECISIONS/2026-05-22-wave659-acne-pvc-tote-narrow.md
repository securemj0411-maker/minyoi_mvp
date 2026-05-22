# Wave 659 — Acne PVC Tote SKU narrow (bag v21→v22)

## 발견

`bag|acne_pvc_tote|tote|era_unknown|unknown_size_variant|b_grade` (5건, spread 8.73x).

| pid | name | price |
|-----|------|-------|
| 249695195 | 아크네 스튜디오 페이퍼리 나일론 토트백 스몰 다크 브라운 | 480,000 |
| 368940923 | 아크네 스튜디오 블랙 나일론 토트백 | 350,000 |
| 360960562 | 아크네 스튜디오 캔버스 토트백 | 320,000 |
| 394731362 | 아크네 스튜디오 블랙 프린지 토트백 | 90,000 |
| 372514927 | 아크네스튜디오 토트백 | 55,000 |

= PVC가 아닌 나일론/캔버스/프린지 다 흡수.

## 원인

기존 mustContain:
```ts
[["acne", "아크네"], ["pvc", "토트", "tote"]]
```

= "acne" + ("pvc" OR "토트" OR "tote") — PVC 없는 토트도 매칭.

## 조치

mustContain narrow:
```ts
[["acne", "아크네"], ["pvc"], ["토트", "tote"]]
```

= acne + PVC + (토트 OR tote) 모두 강제.

추가 mustNotContain (안전망):
- `나일론 토트` / `nylon tote`
- `캔버스 토트` / `canvas tote`
- `프린지` / `fringe`
- `페이퍼리` / `papery`

parser bag v21 → v22 + invalidate.

## Why

mustContain group이 OR 조합이라 PVC가 옵션 단어 중 하나면 다른 단어만 박혀도 통과. 모델명 좁힐 땐 별도 group으로 강제.

## How to apply

신규 모델명 강제 시 alias 묶음 분리 (`["model"]`) — OR로 묶지 말 것. PVC/나일론/캔버스 라인이 가격대 별개면 별도 SKU 분리 후속 wave.
