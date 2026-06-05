# 2026-06-05 Wave 1160 — 당근 가까운 순 피드 후보 깊이 확대

## 결정
- `/api/packs/pool`에서 `source=daangn` 또는 `sort=distance` 요청도 500개 ready 후보까지 깊게 검증한다.
- 예산 필터뿐 아니라 당근 로컬 피드도 source median, lifecycle, stale guard 재계산 후에 최종 30개를 자른다.

## 배경
- 운영자 계정 기준 동네는 DB상 `서울특별시 동작구 사당동`으로 정상 저장되어 있었다.
- cau pool에는 동작구 15만원 이하 당근 후보가 존재했지만, 사용자 피드는 `예산 전체 + 당근 + 가까운 순`에서 강남/금천/영등포 고가 매물이 먼저 보였다.
- 기존 첫 로드 경로는 당근 로컬 요청도 25개 후보만 깊게 검증했다. 가까운 후보 일부가 source median/lifecycle 재검증에서 탈락하면 뒤쪽 가까운 후보를 보충하지 못하고, profit-ordered 원거리 후보가 최종 피드에 남을 수 있었다.

## 보류
- cau pool에서 ready로 보이지만 raw listing이 stale/disappeared인 행을 운영 UI에서 별도 표시/정리하는 작업은 후속으로 둔다.
