# Wave 763 — Pool ready SKU audit 7개 fix (분류 정확도)

- 시간: 2026-05-27 KST
- 트리거: owner — "우리 분류 정확한가?? 슬랙스랑 조거팬츠랑 같은 비교매물로 올라왔던데 전체적으로 검토해야됨".

## 발견 — 7개 SKU misclassification

폭넓은 audit (Pool ready 920건 sample + 3,819 active 매물 SKU별 점검) 결과:

### 🔴 즉시 영향 (시세 신뢰도 직격)

1. **AirPods Max 1↔2세대 mix (842건)** — sku_id `airpods-max` 인데 제목 명시 "맥스2/c핀/usbc" 매물 77건이 1세대 SKU 에 박힘. 가격 spread 350K~720K (2.3×). comparable_key 는 `usbc` 박혀서 parser 는 USB-C 인식했지만 SKU 만 1세대 stuck. catalog 이미 fix됨 (line 5961~5970) — rematch trigger 만 필요.

2. **Adidas Trefoil 자켓 SKU 에 슬랙스 매물 (753건)** — owner 발견 case. pid 9003606834511 "아디다스 블랙 슬랙스 32칫수" 가 `adidas_trefoil|pants|b` 로 박힘. modelName "Track Suit / Hoodie / Tee" 3 묶음 + 바지류 차단 토큰 없음.

3. **Yeezy 500/700 broad lumped (4건 잔류 + 138 + 82건 broad split)** — `shoe-yeezy-boost-500-700` SKU 에 500(150K) + 700(50만+) 한 통. Wave 767 fix 가 메모리엔 박혔지만 실제 split SKU 운영 중 (`-500-broad`/`-700-broad`).

### 🟡 false-positive 흡수 (시세 dilution)

4. **Polo Pique Classic (442건)** — St Andrews / 듀빅 / 풋조이 / J.Lindeberg / 몽벨 골프 brand 흡수. "polo" 단독 토큰이 영문 일반 명사로 작동 → 골프 카라티 brand 매물 다 매칭.

5. **Polo Pony Tee (397건)** — 동일 false-positive 패턴.

6. **Polo Knit Sweater (574건, stale)** — sku_id 박힌 매물 있지만 catalog 정의 없음. TNT / 블랭크룸 / 포터리 / LOHNT 등 한국 디자이너 흡수. rematch 시 narrow SKU (`polo-rrl-knit`) 또는 null 로 reroute 예정.

7. **NB Kith Collab (70건, stale)** — catalog 정의 없는 stale sku_id. 990v2/991/2010/860v2/1906r 다 한 통. 시세 5배 차이. rematch 시 narrow NB SKU 또는 null 로 reroute.

8. **Seiko broad (517건)** — sku_name 자체에 "broad — narrow 미박힘 catch-all" 명시. 음반/싱글 false-positive (pid 9002926285481 "시티팝 일본 가수 7" 싱글") 시계로 매칭.

## 변경

### Catalog.ts

- **`clothing-adidas-trefoil`** (line 12983):
  - modelName: "Track Suit / Hoodie / Tee" → "Track Jacket / Hoodie / Tee" (Suit 빼기 — 상하의 세트는 mustNotContain 으로 별도 차단).
  - mustNotContain 추가: 슬랙스, 조거팬츠, 조거, jogger, 면바지, 청바지, 데님 바지, chino, 치노, 와이드 팬츠.
- **`clothing-polo-pique-classic`** (line 8572): mustNotContain 추가 — St Andrews / 듀빅 / TNT / 풋조이 / J.Lindeberg / 포터리 / 블랭크룸 / LOHNT / 몽벨 / pearly gates.
- **`clothing-polo-pony-tee`** (line 8631): 동일 brand 차단 추가.
- **`watch-seiko-broad`** (line 7256): mustNotContain 추가 — LP / vinyl / 음반 / 싱글 / 7인치 / 12인치 / 시티팝 / 재즈 등 음반 매물 차단.

### Rematch trigger (`scripts/apply-wave763-sku-audit-rematch.ts`)

3 phase 로 분할:
- **Phase 2** (catalog 변경 X): `airpods-max` + `shoe-yeezy-boost-500-700` 잔류 → **837건 PATCH**
- **Phase 3** (Polo mustNotContain): `polo-pique-classic` + `polo-pony-tee` → **1,337건 PATCH** (polo-knit-sweater 포함)
- **Phase 4** (Trefoil + 나머지): `adidas-trefoil` + `kith-collab` + `seiko-broad` + `polo-knit-sweater` → **1,318건 PATCH**
- **Total: 3,492건 PATCH** (detail_status='pending' + score_dirty=true + detail_queue INSERT IGNORE)

### Baseline snapshot

`_audit_skus_baseline_20260527` table 생성 — 3,819 매물 (active state) before 상태 박힘. Fix 후 SKU 이동 정량 검증 ground truth.

## 검증 결과 (즉시)

| SKU | Total baseline | score_dirty | detail_status='pending' |
|---|---|---|---|
| airpods-max | 842 | 817 | 834 |
| clothing-adidas-trefoil | 753 | 746 | 738 |
| clothing-polo-knit-sweater | 574 | 570 | 574 |
| watch-seiko-broad | 517 | 516 | 517 |
| clothing-polo-pique-classic | 442 | 431 | 440 |
| clothing-polo-pony-tee | 397 | 383 | 397 |
| shoe-newbalance-kith-collab | 70 | 70 | 70 |
| Yeezy broad (skip — 별도 wave) | 220 | 160 | 0 |

거의 100% rematch trigger 박힘. detail-worker 가 cron tick 마다 재처리 → score-worker 가 sku 재계산 → candidate-pool 업데이트.

## 영향 + 위험 요소

- **Backlog 처리 시간**: score_dirty backlog 64,730 → ~68,000. cron tick 800/회 → ~17h+ 처리 예상.
- **사용자 화면 갱신**: 17h 이내 SKU 매핑 점진 개선. 즉시 갱신 X.
- **stale parser_version (v55)**: AirPods Max 383건. 필요시 `retryStaleParserVersions()` 후속 호출.
- **candidate_pool 'spent'**: 사용자 이미 본 매물은 sku 갱신 X. active raw_listings 만 reparse.
- **PITR 미박힘**: baseline snapshot table 이 안전 net. 필요시 sku_id 복원 가능.

## Follow-up (별도 wave 권장)

- Yeezy 500/700 broad SKU → narrow split (Wave Runner / Inertia / Mauve / 블러쉬 / 유틸리티 별도 SKU).
- NB Kith Collab → narrow SKU 신설 (990v4 Kith / 2010 Kith 등 모델별).
- Polo Knit Sweater → narrow SKU 재정의 (cardigan / pullover / half-zip / turtleneck 분리).
- Seiko broad → narrow 미박힘 매물 따로 분리 (Prospex / Presage / Astron narrow 우선).
- Adidas Trefoil hoodie/tee → 자켓과 별도 narrow SKU 신설 (modelName split).

## 사용된 도구

- Supabase MCP `execute_sql` — baseline snapshot, 영향 측정, 검증
- `triggerRematchForSkus()` (`src/lib/rematch-helpers.ts:170`)
- `scripts/apply-wave763-sku-audit-rematch.ts` (신규 — phase 별 trigger)
- audit agent 1: SKU 분류 정확도 검토 (sample 10건+)
- audit agent 2: reparse pipeline + 영향 매물 list + 검증 방법
