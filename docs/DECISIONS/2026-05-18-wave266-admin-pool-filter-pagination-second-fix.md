# 2026-05-18 wave266 — 운영자풀 가격 필터 pagination 2차 수정

## 결정
- 가격대/SKU/검색 필터는 candidate_pool `pid=in.(...)` URL에 다시 밀어 넣지 않는다.
- candidate_pool은 status/band/category base filter만 적용해 가져오고, 서버 메모리에서 pid set과 교집합을 낸 뒤 total과 page slice를 계산한다.
- 이 방식으로 `15만원 이하 92건` 같은 summary count와 페이지네이션 total이 같은 row set을 보게 했다.

## 보류
- ready pool이 5,000건을 넘는 시점에는 별도 서버-side RPC 또는 materialized summary 설계를 검토한다.
