# 2026-05-16 — Batch review 10 iterations 종합

## 트리거
사용자 지시 (2026-05-15 22:51 KST 텔레그램 alert 직후): "커밋푸쉬하고 문제있는부분 한번 새로 검토해서 알아서 해결해주고 한번 더 검토해서 다른 문제 찾고 반복 10회. 내 결정이 필요한건 보류로 계속 기억해두고 마지막 한번만 통보."

## 자율 fix 6건 (commit + push 완료)

| # | iteration | 변경 | commit |
|---|---|---|---|
| 1 | 0 | cron-watchdog lookback 동적화 (24h 주기 worker false positive 차단) | `884b142` |
| 2 | 3 | 4 cron route collect-logs 박기 (compliance-retention/housekeeper-ai-cache-prune/landing-showcases/reference-price-refresh) — watchdog blind spot 해소 | `546087b` |
| 3 | 4 | tick-pipeline placeholder price (≥1억) 시세/풀 차단 — 14건 noise 제거 | `ab5fe12` |
| 4 | 5 | option-parser new_or_open_box false positive 차단 (~27% / 1368건 추정) | `da2ceba` |
| 5 | 6 | market/history + market-source rate limit (enumeration 차단) | `71efb55` |
| 6 | 8 | MarketHistoryChart placeholder 무시 + 429 친절 메시지 | `a45276a` |

## 운영 readiness 종합 (Iteration 10 측정)

| Metric | Value | 평가 |
|---|---:|---|
| Active listings | 11,629 | OK |
| Listings with sku_median | 9,905 (85.2%) | OK |
| Pool ready | 387 | OK (베타 traffic 충분) |
| Parsed OK | 15,644 | OK |
| needs_review | 4,053 (20.6%) | 목표 16-20% 근접 |
| Lifecycle overdue | 2,659 | 주의 (자연 소화 중) |
| Detail pending | 10,224 | 주의 (입력 vs throughput) |
| Reference prices active | 48 | OK (50 SKU 중 96%) |

## 보류 항목 7건 (사용자 결정 필요)

상세 list는 `docs/SCRATCH/2026-05-15-batch-review-pending.md`. 가장 시급 순:

1. **🚨 4 cron QStash schedule 미등록** (Iteration 2)
2. ⚠️ Lifecycle backlog 2.6k overdue (자연 소화 중, batch tuning 옵션)
3. ⚠️ Detail-worker queue 10k pending
4. Placeholder price 매물 14건 DB cleanup
5. 베타 권한/요금제 정책 모호 (4 sub-item)
6. API 보안 잔여 hole (admin error leak, preview-inventory rate limit)
7. reference-price 자동화 미완 (50 SKU fixed → dynamic RPC)

## 검증
- TypeScript: 전체 wave에서 validator.ts(`/plans` dev cache) 외 무에러.
- ESLint: 6 fix 무에러.
- `npm run test:core`: 139/139 pass (iteration 5 검증).

## 위험 / 다음 wave
- watchdog fix 후에도 4 cron 진짜 안 돌면 cooldown 30분마다 alert 계속. QStash 등록 시급.
- detail/lifecycle backlog는 throughput 한계 확인 후 batch tuning 필요.
- production `RATE_LIMIT_ENABLED=1` env 확인 필요.
