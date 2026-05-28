# Wave 914 — 당근 수집 지역을 구/시 seed에서 동·읍·면 leaf seed로 전환

## 배경

상도동 사용자가 상도동 근처 매물 대신 사당동 매물을 계속 보는 문제가 있었다.
초기에는 동작구 보강으로 보였지만, 직접 확인 결과 더 근본적인 원인이 있었다.

- `?in=동작구-324` 검색 결과의 `article.region`은 전부 `사당동(6091)`으로 내려왔다.
- `?in=강남구-381` 검색 결과는 전부 `역삼동(6035)` 중심으로 내려왔다.
- `?in=서초구-362` 검색 결과는 전부 `서초동(6128)` 중심으로 내려왔다.

즉 기존 274개 지역 seed는 “전국 구/시를 다 돈다”가 아니라 “각 구/시의 대표 동 하나만 돈다”에 가까웠다.

## 결정

당근 검색 페이지의 숨겨진 `siblingRegions` 데이터를 파싱해 런타임 검색용 leaf seed를 별도 생성했다.

- 신규 `DAANGN_SEARCH_REGION_SEEDS`: 6,306개 동·읍·면 leaf region
- `runDaangnIngest` 기본 지역: `DEFAULT_DAANGN_REGION_SEEDS` → `DAANGN_SEARCH_REGION_SEEDS`
- `runDaangnPriceSweep` 기본 지역도 동일하게 leaf seed 사용
- `DEFAULT_DAANGN_REGION_SEEDS`는 운영자 컨텍스트/legacy fallback 용도로 유지
- `daangn-region-parents.json`도 6,306개 leaf full path로 갱신

## 검증

- 강남구 숨김 sibling인 `삼성동(6034)`, `개포동(6030)`, `도곡동(6033)`이 seed에 포함됨.
- 동작구 `상도동(6093)`, `상도1동(6092)`, `흑석동(331)`, `대방동(337)`이 모두 full path로 매핑됨.
- `tests/daangn-ingest.test.ts`, `tests/home-region-matcher.test.ts`, `tests/daangn-region-distance.test.ts` 통과.

## 운영 영향

한 tick의 기본 fetch cap은 그대로 267개라서 비용/요청량이 한 번에 20배로 튀지는 않는다.
대신 rotation 대상이 274개 대표 지역에서 6,306개 실제 동네로 바뀌므로, 한 바퀴 도는 주기는 길어진다.
따라서 immediate ready 수가 폭증하기보다, 사당동/역삼동 같은 대표 동 편중이 빠지고 전국 동 단위 커버리지가 넓어지는 효과가 먼저 나온다.

## 보류

- 6,306개 전체 leaf 좌표를 Kakao로 정밀 생성하는 작업은 보류했다.
  현재 거리 계산은 기존 geo exact hit가 없으면 full path prefix/시군구 centroid fallback을 사용한다.
- 다음 wave에서 지역별 yield를 12~24시간 보고, leaf 전체 rotation이 너무 느리면 서울/수도권/고수율 leaf를 우선순위 큐로 분리한다.
