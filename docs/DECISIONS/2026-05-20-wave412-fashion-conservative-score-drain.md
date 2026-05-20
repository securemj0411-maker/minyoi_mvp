# 2026-05-20 Wave412 — conservative fashion score drain

## 배경

Wave411 이후 active fashion pool은 깨끗했지만, `score_dirty=true`인 fashion row가 남아 있었다.
사용자 방향은 확장보다 보수적 정밀화다.
즉, 의류/가방/신발은 인기 있고 product type이 안정적인 lane만 pool로 복귀시키고, broad/fallback이나 다른 비교군이 섞일 수 있는 row는 score 단계에서도 막아야 한다.

## 결정

- `scripts/report-fashion-dirty-queue.ts`를 추가했다.
  - fashion dirty row 중 scoreStage가 바로 처리 가능한 row를 current catalog/parser 기준으로 재검증한다.
  - ready vs blocked, current SKU null, parsed key drift, top lane을 분리해서 보고한다.
- `scoreStage`의 fashion SKU 신뢰 정책을 강화했다.
  - 기존: clothing만 current catalog로 재검증.
  - 변경: `shoe`/`bag`/`clothing` 전체를 score 직전에 current `ruleMatch`로 재검증.
  - current catalog가 reject하면 stale raw `sku_id`를 믿지 않고 score output을 만들지 않는다.
- 패션 broad promotion의 교차 오염을 막았다.
  - 기존: title에서 Miu Miu broad를 잡아도 description에 `디올 더스트백` 같은 구성품 브랜드가 있으면 broad→broad promotion으로 Dior broad로 갈아탈 수 있었다.
  - 변경: fashion(`clothing`/`shoe`/`bag`)에서는 broad fallback이 다른 broad fallback으로 승격되지 않는다.
- bag category-level ready도 더 보수적으로 제한했다.
  - bag category는 계속 ready지만, `*_broad`/`-broad` brand fallback은 category ready를 상속하지 않는다.
  - `coach_broad`처럼 `LANE_READINESS`에서 명시적으로 검수된 broad lane만 pool 진입 가능하다.
- 구매 인증 문구가 catalog 매칭을 끊는 문제를 분리했다.
  - 기존: `(구매)`/`[구매]` noise가 normalize 과정에서 bare `구매`로 바뀌어 `백화점구매인증가능` 같은 정상 문구까지 차단했다.
  - 변경: bracketed 구매글은 `classifyListing` raw title 패턴에서 잡고, catalog universal noise에서는 제거했다.
  - 결과: Bottega Cassette `백화점구매인증가능` 매물이 다시 `bag-bottega-cassette-mini` narrow로 매칭된다.
- 명백한 비교군 오염 케이스를 추가 차단했다.
  - 명품 종이 쇼핑백/종이백/패키지 단품.
  - Dior beauty/holiday tote 등 화장품 사은품성 bag.
  - Lemaire x Uniqlo/Uniqlo U 저가 협업 bag.
  - Supreme 5패널/스냅백 모자류가 bag SKU에 잡히는 케이스.
  - Salomon ACS 크로스백/숄더백/웨이스트백이 ACS Pro shoe에 잡히는 케이스.
  - Patagonia shell keyword stuffing: Nike ACG/ROA/Montbell 등 다른 outdoor brand bait.

## 실행 결과

- scoreStage 1차 drain:
  - scored: 787
  - score dirty cleared: 800
  - pool upsert writes: 24
  - pool skip: 762
- gate cleanup:
  - broad shoe `shoe-adidas-song-for-the-mute-broad` 1건이 pool에 올라와 즉시 invalidated 처리.
- scoreStage 2차 drain:
  - scored: 120
  - score dirty cleared: 120
  - pool upsert writes: 7
  - pool skip: 111
- Wave412b cleanup:
  - lane-blocked Patagonia Retro-X 1건이 pool에 재노출되어 invalidated 처리.
  - 이후 dry-run cleanup candidateRows 0 확인.
- Wave412c cleanup:
  - Bottega Cassette / Lululemon Backpack 기존 pool key drift 2건 invalidated 처리.
  - scoreStage 추가 drain:
    - scored: 26
    - score dirty cleared: 26
    - pool upsert writes: 0
    - pool skip: 26

## 최종 상태

- `reports/fashion-pool-purity-latest.json`
  - active fashion pool rows: 48
  - clothing: 30
  - bag: 8
  - shoe: 10
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
- `reports/fashion-pool-gate-cleanup-dry-run-latest.json`
  - candidateRows: 0
- `reports/fashion-dirty-queue-latest.json`
  - scorable fashion dirty rows: 0
  - scorable ready rows: 0
  - scorable blocked rows: 0
- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts`
  - pass: 183
  - fail: 0
- `git diff --check`
  - pass

## 보류

- 전체 dirty queue에는 fashion 외 카테고리 row가 남아 있을 수 있다.
- 의류 broad lane 자체는 계속 blocked 상태다.
  - BAPE tee / Stussy basic tee / Stussy hoodie 같은 매물량 많은 lane은 현재 product type drift는 잡지만, pool release는 별도 샘플 검수 후 진행한다.
