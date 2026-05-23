# 2026-05-21 Wave456 — shoe broad Stansmith/Gazelle cleanup

## 배경
- 신발 broad sweep 에서 Adidas popular broad 들의 stale parse 와 변형 모델 섞임이 크게 보였다.
- 특히 `shoe-adidas-stansmith-broad` 는 generated/manual catalog 중복 때문에 current rule 재매칭이 null 로 떨어지고 있었다.
- `shoe-adidas-gazelle-og-broad` 는 Gazelle Bold / Boost / 85 / Clot / platform 변형이 OG broad 비교군에 섞여 있었다.

## 결정
- 같은 SKU id 가 generated/manual 양쪽에서 중복 hit 하면 ambiguous 로 버리지 않고 하나의 candidate 로 취급한다.
- Gazelle OG broad 는 vetted OG 계열만 남기고, Bold/Boost/85/Clot/platform 은 broad 에서 제외한다.
- Gazelle broad 에서 description narrow promotion 을 할 때는 Gazelle 계열 narrow 만 허용한다.
  - 이유: 판매자가 설명에 “스페지알/삼바와 같은 쉐입” 같은 비교문구를 자주 넣어 실제 Spezial 로 오염될 수 있다.

## 코드 변경
- `src/lib/catalog.ts`
  - `chooseUniqueCandidate` 에 동일 SKU id 중복 후보 dedupe 를 추가했다.
  - Gazelle broad 의 narrow promotion 을 Gazelle 계열으로 제한했다.
- `src/lib/generated/catalog-shoe-broad-wave138.ts`
  - `shoe-adidas-gazelle-og-broad` mustNot 에 `bold/볼드`, `boost/부스트`, `platform/플랫폼`, `gazelle 85/가젤 85`, `clot/클랏`, `edison/에디슨` 을 추가했다.
- `tests/wave254-6-product-type-priority.test.ts`
  - Stan Smith 중복 catalog 후보 회귀 테스트를 추가했다.
  - Gazelle OG 유지, Gazelle Bold/Boost/Clot/platform 차단, Spezial 설명문 오염 차단, Gazelle Indoor promotion 테스트를 추가했다.

## DB 적용
- `shoe-adidas-stansmith-broad`
  - active 120건 중 116건 재파싱.
  - 4건 clear unknown: Brain Dead / Raf Simons / Pharrell Williams / Mastermind 변형.
- `shoe-adidas-gazelle-og-broad`
  - active 361건 중 264건 재파싱.
  - 1건 `shoe-adidas-gazelle-indoor-bold-orange` 로 이동.
  - 96건 clear unknown: Gazelle Bold / Boost / 85 / Clot / platform 등 변형.

## 검증
- Stan Smith post dry-run:
  - sourceRows 116, reparse 116, reject 0.
- Gazelle post dry-run:
  - sourceRows 264, reparse 264, migrate 0, reject 0.
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 결과: 156 pass / 0 fail.

## 보류
- Gazelle Bold 는 반복량이 많지만 아직 별도 ready lane 으로 열지 않았다.
- 사이즈별 회전률/비평균 사이즈 회전률 분리는 별도 wave 에서 market-stat grouping 정책으로 검토한다.
- 다음 shoe broad 후보는 Superstar / Samba / remaining Adidas popular broad 순서로 계속 본다.
