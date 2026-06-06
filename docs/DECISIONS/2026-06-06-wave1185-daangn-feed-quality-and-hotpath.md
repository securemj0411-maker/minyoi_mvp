# 2026-06-06 Wave 1185: 당근 피드 품질/근처 조회 hot path

## 진단
- 사당동 기준으로 관악구 남현동, 서초구 방배2동 등이 1~2km 안쪽에 먼저 나오는 것은 거리순 로직상 정상이다.
- 다만 `사이버 픽업 트럭 멜로디`가 `Cyberpunk 2077` 게임 타이틀 lane으로 ready 노출된 것은 명백한 오분류다.
- 근처 당근 후보 raw 조회는 지역 여러 개 + `price <= budget` 조건에서 statement timeout이 발생할 수 있다. 매물이 없어서가 아니라 hot path가 무거운 케이스다.

## 결정
- 게임 타이틀 SKU에서 완구/차량 모형 토큰을 공통 noise로 차단한다.
- 이미 DB에 ready로 남은 stale row는 피드 응답 직전에도 다시 차단한다.
- 당근 근처 피드 raw 조회가 budget 필터를 쓸 때 heap read로 흔들리지 않도록 price를 포함한 covering index migration을 추가한다.

## 보류
- 완전한 근본 구조는 `mvp_raw_listings`를 매 요청마다 근처 지역으로 훑는 대신, worker가 지역별 ready feed snapshot/table을 미리 계산해 두는 방식이다.
- 이번 wave에서는 launch 직전 리스크가 작은 covering index와 응답 방어막까지만 적용한다.
