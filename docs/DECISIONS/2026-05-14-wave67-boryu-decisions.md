# Wave 67 — 보류 결정 로그 (DB query drift cleanup + deep-crawl ON)

> Status: **보류 (no action).** code 0, DB 0, DDL 0. owner가 "일단 X / 일단 보류"로 명시. CLAUDE.md 6 필드 포맷.

## 1. mvp_search_queries DB 22 drift cleanup — 보류

- 시간: 2026-05-14 KST
- 발견: GPT 진단에서 코드 `DEFAULT_SEARCH_QUERIES` 74개 vs DB `mvp_search_queries` active 96개 — 22개 옛 query가 DB에만 남아있음. Wave 59-A에서 코드에서 빼고 DB는 동기화 안 됨. 매 cron마다 22 query 추가 호출 → Bunjang API 비용 낭비 가능성.
- 변경: 없음 (보류).
- 검증: GPT가 yield-based downrank 로직이 작동 중이라 cost 영향 미미 진단.
- 위험:
  - 보류 시: API 비용 약간 ↑ (yield downrank로 자동 절감 중이라 미미)
  - cleanup 시: 실수로 active query 삭제 risk 중간 (별도 검증 필요)
- 다음:
  - owner 결정 명시 ("일단 X" — 2026-05-14): cleanup 보류 유지
  - 미래 검토 trigger: API 비용 모니터링에서 22 query 영향 확인되면 cleanup 진행

## 2. deep-crawl cron ON — 보류

- 시간: 2026-05-14 KST
- 발견: deep-crawl cron OFF 상태. long-tail 매물 (인기 query 외 깊이 크롤) 멈춤. 사용자 발견 SKU 다양성 ↓, Bunjang API 비용 ↓.
- 변경: 없음 (보류).
- 검증: 현재 detail-worker 큐 적체 1,200+ 상태 → deep-crawl 켜면 큐 더 적체 가능성.
- 위험:
  - 보류 시: long-tail SKU 발견 멈춤. 신 category 진입 (Wave 67) 효과 측정 늦어질 수 있음.
  - ON 시: 큐 적체 ↑, Bunjang API 비용 ↑ (월 단위 비용 영향).
- 다음:
  - owner 결정 명시 ("일단 보류" — 2026-05-14): OFF 유지
  - 미래 검토 trigger: detail-worker 큐가 안정화 (적체 <100) 되고 + Wave 67 신 카테고리 inflow 측정 후 결정

## 결정 표

| 항목 | 결정 | trigger 시점 |
|---|---|---|
| DB query drift cleanup | 보류 (X) | API 비용 모니터링 시 |
| deep-crawl cron ON | 보류 | 큐 안정화 + Wave 67 측정 후 |
