# Wave 248 — TNF 1996 Nuptse mismatch fix (사용자 코멘트 id 192~194)

- date: 2026-05-19
- type: catalog fix (additive — mustNotContain only)
- scope: `clothing-tnf-nuptse-1996` SKU
- branch: `ux/me-cleanup-2026-05-19`

## 배경

운영 댓글 (id 192~194) 신규 3건. `clothing-tnf-nuptse-1996` SKU 가 다운자켓 시세 (msrp 360k, defaultProductType `down_jacket`) 적용되는 lane 인데, 다음 매물 잘못 매칭:

| pid | name | price | 문제 |
|---|---|---|---|
| 331382713 | 빔즈 노스페이스 눕시 **쇼츠** M 사이즈 판매합니다. | 89,000 | 다운자켓이 아니라 반바지 |
| 318635782 | 노스페이스 노벨티 눕시 다운 **베스트** 프린트 | 105,000 | 다운자켓이 아니라 베스트 (조끼) |
| 395757345 | 해외판L) 노스페이스 **1994** 눕시 블랙 | 130,000 | 1996 모델이 아니라 1994 에디션 |

추가 audit (production sweep):
- 154건 총 매물 중
  - 베스트/조끼 24건 (15.6%)
  - 에코 19건 (12.3%) — Eco Nuptse 별도 라인 (재활용 소재, 2023+ 리메이크)
  - 1992/1994/1990 8건 (5.2%)
  - 쇼츠 2건 (1.3%)
- 합산 약 50건 (32%) — 시세 분포 inflation 위험 (모든 variant 가 1996 down_jacket 시세 계산에 섞임)

## 결정

`clothing-tnf-nuptse-1996` `mustNotContain` 보강 (additive only):

```ts
mustNotContain: [
  "supreme", "슈프림", "gucci", "구찌", "mm6", "마르지엘라",
  "키즈", "kids", "퍼플라벨", "purple label", "뮬", "mule", "슬리퍼",
  // Wave 248 신설
  "쇼츠", "반바지", "shorts", "short pants", "쇼츠 m", "쇼츠 l",
  "베스트", "조끼", "vest", "푸퍼 베스트", "puffer vest",
  "다운 베스트", "다운 조끼", "패딩 베스트", "패딩 조끼", "패딩조끼",
  "1994", "1992", "1990", "2000년대", "2000s", "2010", "2012",
  "에코 눕시", "에코눕시", "eco nuptse", "리메이크", "remake",
]
```

## 검증

- `npm run test:core` — 기존 7건 pre-existing failure (me-page-contract — UI 잡음, 본 wave 변경 X). catalog 관련 test 124건 PASS.
- Direct match test (in-source script):
  - 쇼츠 / 베스트 / 1994 / 1992 / 에코눕시 매물 5건 → 차단 확인
  - 정상 1996 자켓/패딩/센터로고 매물 3건 → 매칭 유지

## 효과 예측

- pool 154 → 약 104 (-32%)
- 시세 분포 inflation 완화. 다운자켓 only 매물 median 가 더 정확하게 1996 retro 라인 반영.
- 사용자 신뢰 회복 (3 코멘트 직접 해소).

## 후속 (별도 wave)

비교 매물 list — 사용자 reveal 화면 의 비교 매물 list 가 product_type 별 필터 (Wave 236 product_type 활용) 추가 필요. 본 wave 범위 외.

## 정책

- additive only — DB 변경 X. catalog 변경만, 추후 자동 rematch 시점에 매물 재분류 (현재 detail_status 기반 reclassify cron 가 catalog 변경 감지하면 처리).
- 비교 매물 list 친화 가이드 (별도 UI wave) 는 본 wave 범위 외.
- AI L2 learning queue: 본 fix 가 false positive 패턴 차단 → 후속 매물 admin 큐 진입 자동 감소.
