# 2026-05-20 Wave422 - Popular Shoe Broad Safety Tightening

## Context
- Luxury shoe broad/narrow cleanup 이후 일반 인기 신발 lane도 샘플 매칭이 과하게 넓은지 점검했다.
- New Balance 530, Adidas Samba OG, Adidas Superstar 쪽에서 색상/파생모델/의류/박스 단품이 같은 비교군으로 섞이는 문제가 확인됐다.
- 목표는 ready 가능한 SKU를 무리하게 늘리는 것이 아니라, 지금 공개/계산에 들어갈 수 있는 비교군을 보수적으로 좁히는 것이다.

## Decisions
- `shoe-newbalance-530-white-silver-navy`는 `530` 단독이 아니라 `화이트 실버 네이비`, `530SG`, `MR530SG` 같은 exact color/model 신호가 있어야 매칭되도록 좁혔다.
- `shoe-newbalance-530-broad`는 generic 530 lane으로 유지하되, Miu Miu/Salehe Bembury collab, exact 530SG lane, 신발 박스/슈박스/박스만 매물을 차단했다.
- `shoe-adidas-samba-og-broad`는 Sambae, Samba Rose, Indoor, ADV, LT를 plain Samba OG 비교군에서 제외했다.
- `shoe-adidas-superstar-broad`는 jersey/track top/tracksuit 같은 의류와 Adifom Superstar Mule 파생을 제외했다.
- Shoe 공통 mismatch noise에 jersey/uniform 계열을 추가했다.
- Bare `베스트`는 `베스트셀러` 같은 정상 문구를 오염시켜서 신발 mismatch noise에서 제거하고, `다운베스트`, `패딩베스트`, `니트베스트`, `조끼`, `vest` 같은 의류 product-type 신호만 남겼다.

## DB Rematch Applied
- Target lanes replay: NB 530 broad/exact, Adidas Samba OG broad, Adidas Superstar broad.
- 적용 전 current-catalog changes 68개를 확인했고, candidate pool ready/reserved 노출 영향은 0개였다.
- Applied changes:
  - `shoe-adidas-superstar-broad -> null`: 28
  - `shoe-adidas-samba-og-broad -> null`: 23
  - `shoe-newbalance-530-white-silver-navy -> shoe-newbalance-530-broad`: 9
  - `shoe-newbalance-530-white-silver-navy -> null`: 3
  - `shoe-newbalance-530-broad -> shoe-newbalance-530-white-silver-navy`: 2
  - `shoe-adidas-samba-og-broad -> shoe-adidas-samba-og-black`: 2
  - `shoe-newbalance-530-broad -> null`: 1
- Score drain 결과: scored 57, poolUpserted 0, poolSkipped 57, `aiApiCalls=0`.
- Follow-up sample check에서 `뉴발란스 x 살레헤 벰버리 530` 1건이 broad로 남은 것을 확인해 추가 차단했고, 해당 raw row는 `sku_id=null`, `pool_eligible=false`로 내렸다.

## Verification
- Targeted replay after DB apply:
  - `rawSkuRejectedByCurrentCatalog`: 0
  - `rawSkuDiffersFromCurrentCatalog`: 0
  - `dbCleanButCurrentCatalogRejects`: 0
  - `poolExposedWithDrift`: 0
- Targeted replay after Salehe follow-up:
  - `rawSkuRejectedByCurrentCatalog`: 0
  - `rawSkuDiffersFromCurrentCatalog`: 0
  - `dbCleanButCurrentCatalogRejects`: 0
- `report-fashion-pool-purity` after stale pool cleanup:
  - activeFashionPoolRows 53
  - gateBlockedRows 0
  - flaggedRows 0
  - actionableRows 0
- `report-fashion-dirty-queue --scorable-only` final: loadedDirtyFashionRows 0, scorableReadyRows 0, rawCurrentMismatchRows 0.
- Regression bundle:
  - `tests/core-rules.test.ts`
  - `tests/wave254-5-fashion-condition.test.ts`
  - `tests/fashion-catalog-regression.test.ts`
  - `tests/wave254-6-product-type-priority.test.ts`
  - `tests/wave137-shoe-uk-size.test.ts`
  - `tests/wave138-shoe-size-extension.test.ts`
  - `tests/wave139-shoe-eu-us-size.test.ts`
  - Result: 273 pass / 0 fail.

## Deferred
- Size별 가격 차이는 현재 크게 다루지 않고, 회전률/샘플 수 bucket은 Wave420에 별도 wave로 보류했다.
- Samba ADV/LT, Sambae, Samba Rose, Adifom Superstar Mule, NB 530 collab 등은 충분한 sample purity와 거래량을 확인한 뒤 별도 internal/narrow candidate로 검토한다.
- Remaining dirty queue 37개는 Carhartt/CDG/NB530/limited exact/YSK broad 등 internal blocked lane이다. 현재 ready 노출은 없으므로 공개 비교군 정리와 별도로 다음 wave에서 parser stale/key drift 정리를 진행한다.
