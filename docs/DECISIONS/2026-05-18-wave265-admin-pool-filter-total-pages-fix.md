# 2026-05-18 wave265 — 운영자풀 가격 필터 totalPages 보정

## 결정
- 가격대/SKU/검색처럼 pid pre-filter를 쓰는 운영자풀 조회는 `content-range` 대신 실제 필터 교집합 row 수로 `total`을 계산한다.
- 같은 row 배열을 `pageSize`로 slice해서 페이지네이션과 목록이 같은 기준을 보게 했다.
- admin endpoint와 public peek endpoint 모두 동일하게 수정했다.

## 보류
- 5,000건을 넘는 pid pre-filter 결과는 현재 운영 규모에서 별도 pagination 설계가 필요하지 않아 유지했다.
