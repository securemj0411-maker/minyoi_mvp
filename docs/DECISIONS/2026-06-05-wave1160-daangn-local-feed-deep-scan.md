# 2026-06-05 Wave 1160 — 당근 가까운 순 피드 후보 깊이 확대

## 결정
- `/api/packs/pool`에서 `source=daangn` 또는 `sort=distance` 요청도 500개 ready 후보까지 깊게 검증한다.
- 예산 필터뿐 아니라 당근 로컬 피드도 source median, lifecycle, stale guard 재계산 후에 최종 30개를 자른다.
- 당근 로컬 prefetch는 가까운 지역 ID를 큰 24개 묶음으로 얕게 보지 않고, 가까운 지역 소그룹(기본 8개) 단위로 더 깊게 확인한다.
- 당근 로컬 prefetch는 더 이상 검증 전 30개 수준에서 멈추지 않고, 기본 180개 ready 후보까지 모은 뒤 사용자 피드 검증을 태운다.
- 로컬 prefetch raw lookup 기본 폭을 1,200개에서 5,000개로 늘리고, batch당 raw 후보를 최대 1,000개까지 본다. 이후 로컬에서 거리순으로 다시 정렬하고 ready pool을 조회한다.
- 로컬 prefetch 예산은 4.5초에서 8초로 늘렸다. 가까운 후보를 못 보여주는 것보다 첫 로드가 약간 더 무거운 편이 멤버십 피드 신뢰에 맞다.
- `source=daangn` 또는 `sort=distance`에서는 카테고리 다양화 cap보다 거리 우선을 앞세운다. 같은 카테고리 근처 매물이 여러 개 있어도 카테고리 cap 때문에 가려지지 않게 했다.
- nearby Daangn in-memory cache key에 로컬 prefetch 버전/실제 batch size/target/return limit을 포함해, 배포 전후 캐시가 오래된 지역 후보 폭을 재사용하지 않게 했다.
- nearby prefetch 도중 raw/pool 조회가 timeout 되면 앞에서 모은 후보까지 통째로 버리지 않고, 부분 결과를 그대로 사용한다. prefetch는 보조 경로라 실패가 전체 nearby 후보 0개로 바뀌면 안 된다.

## 배경
- 운영자 계정 기준 동네는 DB상 `서울특별시 동작구 사당동`으로 정상 저장되어 있었다.
- cau pool에는 동작구 15만원 이하 당근 후보가 존재했지만, 사용자 피드는 `예산 전체 + 당근 + 가까운 순`에서 강남/금천/영등포 고가 매물이 먼저 보였다.
- 기존 첫 로드 경로는 당근 로컬 요청도 25개 후보만 깊게 검증했다. 가까운 후보 일부가 source median/lifecycle 재검증에서 탈락하면 뒤쪽 가까운 후보를 보충하지 못하고, profit-ordered 원거리 후보가 최종 피드에 남을 수 있었다.
- 또한 가까운 지역 ID를 24개씩 묶고 raw 후보 300개만 `last_seen_at desc`로 가져오면, 최신글이 많은 지역이 가까운 동네 후보를 밀어내는 문제가 있었다.
- 반대로 지역을 1개씩 96개 순차 조회하면 정확도는 좋아지지만 4.5초 prefetch budget 안에 끝나지 않을 수 있었다. 따라서 소그룹 단위로 raw 후보를 넓게 가져온 뒤 로컬에서 거리 우선으로 재정렬하는 방식으로 조정했다.
- 기존 nearby prefetch는 루프 안의 timeout 하나가 outer catch로 전파되면 이미 모은 nearby 후보도 모두 폐기될 수 있었다. 광고/운영 상황에서는 timeout은 부분 후보 사용으로 처리해야 한다.
- cau pool은 candidate_pool의 사전 계산값을 보여주지만 사용자 피드는 응답 시점에 당근 source median, raw listing 상태, lifecycle freshness, detail status, sku_id를 다시 검증한다. 따라서 cau pool에 보이는 행이 사용자 피드에서 빠지는 것은 일부 정상이다. 다만 그 정상 탈락을 감안하고도 뒤쪽 후보까지 충분히 훑어야 하므로 local prefetch 폭을 키웠다.
- 당근 로컬 피드는 일반 profit feed와 다르게 "내 근처에서 실제로 살 수 있음"이 핵심이다. 일반 피드용 카테고리 다양화 cap을 그대로 적용하면, 근처 신발/전자기기 후보가 여러 개 있을 때 뒤쪽 후보가 숨는 문제가 생겨 지역 신뢰도를 해친다.

## 보류
- cau pool에서 ready로 보이지만 raw listing이 stale/disappeared인 행을 운영 UI에서 별도 표시/정리하는 작업은 후속으로 둔다.
- 카테고리 칩을 누른 상태에서 서버에 category 파라미터를 보내 전체 ready pool을 category 단위로 다시 깊게 조회하는 작업은 후속으로 둔다. 현재 카테고리 필터는 로드된 snapshot 안에서 동작한다.
