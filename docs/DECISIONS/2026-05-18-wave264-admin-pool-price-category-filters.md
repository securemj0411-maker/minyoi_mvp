# 2026-05-18 wave264 — 운영자풀 가격대/카테고리 ready 분포

## 결정
- `/me` 운영자풀에 가격대별 ready 수와 카테고리별 ready 수를 표시한다.
- 가격대/카테고리 요약 chip을 누르면 같은 기준으로 목록 필터가 걸리게 한다.
- admin endpoint와 public peek endpoint 모두 같은 `priceBucket`, `category` 필터를 지원한다.

## 보류
- 가격대 버킷은 15만원 이하, 15~30만원, 30~50만원, 50~80만원, 80~150만원, 150만원 이상으로 시작한다.
- 카테고리별 세부 SKU drilldown은 기존 SKU select를 유지하고, 별도 chart/heatmap은 추가하지 않았다.
