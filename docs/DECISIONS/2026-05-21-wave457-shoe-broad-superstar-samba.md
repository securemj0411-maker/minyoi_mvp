# 2026-05-21 Wave457 — shoe broad Superstar/Samba narrowing

## 배경
- Wave456 이후 남은 Adidas popular shoe broad 중 `Superstar` 와 `Samba` 에 변형 모델이 계속 섞여 있었다.
- broad ready lane 이 너무 넓으면 비교 매물 sample 에 의류/콜라보/팀 에디션/파생 라인이 들어와 예상 차익과 회전률을 흔든다.

## 결정
- `shoe-adidas-superstar-broad` 는 plain Superstar 중심으로 좁힌다.
  - 80s, Premium, Metal Toe, Farm, Parley, Slip-on, Mountaineering, D-MOP, Pure, Scarlet, Valentine, Zebra, Lego, Bonega, Sean Wotherspoon 등은 broad 에서 제외한다.
  - Song for the Mute 는 기존 별도 broad 로 이동한다.
- `shoe-adidas-samba-og-broad` 는 club/team/high/classic/Kasina/Italy/Samba Rose 계열을 broad 에서 제외한다.
- `shoe-adidas-samba-og-black` exact SKU 는 `삼바 + OG` 만으로 broad 와 충돌하지 않도록 black/core-black 색상 신호를 요구한다.

## 코드 변경
- `src/lib/catalog.ts`
  - Superstar broad mustNot 을 named derivative 중심으로 확장했다.
- `src/lib/generated/catalog-shoe-broad-wave133.ts`
  - Samba broad mustNot 을 club/team/high/classic/Kasina/Italy/Core Black 계열로 확장했다.
- `src/lib/generated/catalog-shoe-wave91.ts`
  - `shoe-adidas-samba-og-black` 의 mustContain 에 black/core-black 색상 조건을 추가했다.
- `tests/wave254-6-product-type-priority.test.ts`
  - Superstar named derivative 차단 테스트를 추가했다.
  - Samba club/team/high/classic 파생 차단 및 Samba OG/Core Black 분기 테스트를 추가했다.

## DB 적용
- `shoe-adidas-superstar-broad`
  - active 391건 중 257건 재파싱.
  - 3건 `shoe-adidas-song-for-the-mute-broad` 로 이동.
  - 131건 clear unknown: 의류/아디폼/퍼렐/Y-3 및 named derivative.
- `shoe-adidas-samba-og-broad`
  - active 125건 중 114건 재파싱.
  - 11건 clear unknown: Italy vintage, Samba High, club/team variants, Kasina, Samba Rose, Samba Classic.

## 검증
- Superstar post dry-run:
  - sourceRows 257, reparse 257, migrate 0, reject 0.
- Samba post dry-run:
  - sourceRows 114, reparse 114, migrate 0, reject 0.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 결과: 158 pass / 0 fail.

## 보류
- Superstar 80s/Premium/Metal Toe, Samba Classic/club/team/Kasina 는 반복량이 보이면 별도 narrow lane 으로 검수한다.
- 크지 않은 색상 변형(예: Samba linen/savanna, leopard, blue dawn)은 이번 wave 에서 broad 에 남겼다. 가격 분산이 계속 보이면 다음 wave 에서 추가 분리한다.
- 사이즈별 회전률 가중치/비평균 사이즈 grouping 은 별도 market-stat wave 로 남긴다.
