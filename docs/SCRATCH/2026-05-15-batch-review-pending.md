# 2026-05-15 — 10 iteration 검토 보류 항목 (사용자 결정 필요)

사용자 지시: 검토 10회 진행 + 명확한 fix 자율 처리. 정책/파괴적 변경은 보류 → 마지막에 한 번 통보.

## 보류 항목

### -1. (Iteration 2 발견 🚨) **4개 cron 완전 미작동** — 가장 시급
mvp_collect_runs 조회 결과 다음 worker가 24h~48h 0회 호출:
- `landing-showcases` (10분 주기 — 24h 0회): 랜딩 캐시 갱신 안 됨 → 사이트 노출 stale 가능성
- `housekeeper-ai-cache-prune` (6h 주기 — 48h 0회): AI cache 누적
- `compliance-retention` (1d 주기 — 48h 0회): retention/cleanup 누락
- `reference-price-refresh` (1d 주기 — 0회): 다나와 reference price 갱신 안 됨

원인 추정: QStash schedule 미등록 또는 잘못된 endpoint/secret.

→ 사용자 액션 필수: QStash console에서 4개 schedule 확인:
- `landing-showcases`: `*/10 * * * *`
- `housekeeper-ai-cache-prune`: `0 */6 * * *`
- `compliance-retention`: `0 18 * * *` (또는 적당히)
- `reference-price-refresh`: `0 19 * * *`

각 endpoint: `https://minyoi-mvp.vercel.app/api/cron/<name>?wait=1` + `Authorization: Bearer minyoi-cron-2026`.

⚠️ watchdog fix 반영 후에도 이 4개는 진짜 alert 계속 옴 (cooldown 30분). 등록 안 하면 매 30분 1회씩 텔레그램 spam.

### -0.9. (Iteration 7 발견) 베타 권한/요금제 boundary
1. **베타 테스터 무한 크레딧 정책 모호**: CLAUDE.md "베타 테스터는 admin 권한 일부" → 코드에선 plan.dailyOpenLimit 그대로 적용 (무한 X). 정책 문서화 또는 코드 통일 필요.
2. **Mock Toss paymentKey idempotency 없음**: `subscribe_mvp_plan` RPC에 last_payment_key 중복 체크 없음. 동시 요청 시 크레딧 2배 grant 가능 (이론). 실제 위험은 낮음 (random 36^9 충돌 거의 0) but production toss 전환 전 idempotency token 추가 권장.
3. **/api/billing/me에 isBetaTester 미반환**: type엔 있는데 응답에 안 박힘. client UI 게이팅 누락 (현재는 admin 페이지에서만 사용).
4. **mvp_user_plans free user implicit**: Free 사용자는 row 없음. paid만 row 1개 + unique constraint. 정상 동작이지만 암묵적.

→ 결정 필요: (a) 베타 정책 명확화, (b) paymentKey idempotency DB migration, (c) isBetaTester client API 노출.

### -0.8. (Iteration 6 발견) API 보안 보류
- `/api/debug/agent-bridge`, `/api/debug/reset-db` error.message leak: admin 4중 가드라 priority 낮음. 별도 wave에서 generic error message로 통일.
- `/api/packs/preview-inventory` default rate limit 60/10s: 다른 packs endpoint (5-30/10s) 대비 높음. UX 영향 있어 사용자 결정 필요.
- Production env `RATE_LIMIT_ENABLED=1` 확인 필요. 0이면 모든 rate limit fail-open (안전 효과 없음).
→ 결정 필요: (a) error.message leak 일괄 generic 처리, (b) preview-inventory rate limit lowering, (c) RATE_LIMIT_ENABLED env 검증.

### -0.7. (Iteration 4 발견 ⚠️) Placeholder price 매물 14건
mvp_listings 11,618건 중 14건이 price ≥ 1억 (placeholder). 셀러가 "교환만 원함" / "분실" / "판매완료" 표시하려고 999999999, 111111111, 99999999 박은 케이스. 시세 sample 끌어올리는 noise.

✅ tick-pipeline에서 시세 집계 + scoreStage 양쪽에 filter 추가 (이번 fix). 다음 tick부터 자연 차단.
→ 결정 필요: 기존 mvp_listings의 14건 placeholder SQL DELETE 즉시 수행 vs 자연 expire (lifecycle worker missing 처리) 대기. 사용자 노출은 priceGap=0이라 풀 진입 안 됨.

### -0.5. (Iteration 2 발견 ⚠️) Lifecycle backlog 2,610건 overdue
- `mvp_lifecycle_checks` 총 17,055건, 그중 `next_check_at < now()` overdue **2,610건** (1h overdue 2,151 / 6h overdue 674).
- lifecycle-worker 7분 주기 + batch 80 → 시간당 ~686건 처리. 정상 throughput.
- 그런데 6h overdue가 674건 = worker가 따라잡지 못하고 spike 중. 유입 ↑ 또는 batch 부족.
- 사용자 통찰 (이전 conversation): "8시간 갭" 사고 이미 cron 7분 + drain RPC로 fix. 현재는 잔여 backlog.
→ 결정 필요: (a) batch 80 → 120/150 증가, (b) drain RPC 수동 1회 실행, (c) 그대로 두고 자연 소화 (다음 6h 안에 처리될 수 있음).

### -0.4. (Iteration 2 발견) Detail-worker queue 10,238 pending
- `mvp_raw_listings` 중 detail_status null/pending = **10,238건**. 신규 매물 유입 빠른 시간대.
- detail-worker 2분 주기 + batch 30 = 시간당 900건. 10k면 ~11시간 소화 시간.
- 새 매물 유입이 시간당 1000건 넘으면 backlog 영구. 측정 필요.
→ 결정 필요: (a) batch 30 → 50 증가, (b) 그대로 두고 다음 사이클에서 측정.

### 0. (Iteration 1 발견) reference-price-refresh 자동화 미완
- `route.ts:loadTopCandidates`: SQL 작성했지만 실제론 KEY_TO_QUERY_LIST fixed 50 SKU 사용. 자동 추출 RPC 필요.
- `route.ts:syncListingSkuMedian`: SQL 작성했지만 void + skip. 즉 reference_price 갱신 후 sku_median 동기화 누락 (다음 tick 사이클에서 update).
- 50 SKU 외 미개봉 매물은 reference price 매핑 안 됨 → 기존 중고 시세 fallback (부정확 가능).
→ 결정 필요: (a) RPC 만들어 동적 추출 + sku_median 즉시 sync, (b) 50 SKU로 유지 (현재), (c) SKU 수 늘리기 (ex. 100/200).

### 1. 미커밋 변경 (origin/main 안 푸시됨)
- `docs/DECISIONS/2026-05-15-wave124-mass-reparse-v42-runtime-execution.md` — wave124 문서 재작성 (제목 변경, 본문 재구성). 누가 변경했는지 불명.
- `src/app/api/packs/preview-inventory/route.ts` — 별도 변경. diff 미확인.

→ 결정 필요: (a) 같이 commit, (b) revert, (c) 추가 검토 필요.

---

(검토 진행 중 발견되는 항목은 여기 누적.)
