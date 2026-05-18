# 2026-05-18 wave267 — 운영자풀 목록 total 기준 통합

## 결정
- 가격대/SKU/검색 필터가 있을 때 목록 total과 page slice를 candidate_pool base row 기준 서버 메모리 필터로 계산한다.
- 가격대 요약과 목록 필터가 같은 `mvp_listings.price` 값을 보도록 맞췄다.
- admin endpoint와 public peek endpoint 모두 동일하게 수정했다.

## 보류
- 대규모 pool에서 더 빠른 집계가 필요해지면 DB RPC/materialized view로 옮긴다.
