# Wave 109b — raw_listings.sku_id 재분류 (Wave 108 + 109 효과 즉시 반영)

> Status: **applied (code + production update).** owner 자율 진행. Wave 108/109 ruleMatch logic 강화 후 기존 매물에 즉시 적용 위한 reclassify 스크립트.

CLAUDE.md 6 필드 포맷.

## 1. 신규 스크립트 reclassify-raw-sku.ts

- 시간: 2026-05-15
- 발견: Wave 108/109 ruleMatch 변경은 신규 매물(collect cron)부터 적용. 기존 매물은 sku_id 그대로. 즉시 production narrow lane ready 진입 위해 기존 매물도 재분류 필요.
- 변경: **[mvp/scripts/reclassify-raw-sku.ts](mvp/scripts/reclassify-raw-sku.ts)** (신규)
  - broad SKU 매물 fetch (default: iPhone Pro Max/Pro, Galaxy S series)
  - 각 매물에 `ruleMatch(name, description_preview)` 호출
  - 결과 sku_id가 변경됐으면 `mvp_raw_listings.sku_id` UPDATE + `score_dirty=true` set
  - chunk 50, batch update
- 검증: production 실행 (limit 2000):
  - 1,269 매물 처리
  - 37건 reclassification (3%)
  - Top transitions:
    - iphone-16-pro-max → iphone-16-pro-max-256-self: 8
    - galaxy-s25 → galaxy-s25-256-self: 8
    - iphone-15-pro-max → iphone-15-pro-max-256-self: 6
    - galaxy-s23 → galaxy-s23-256-self: 3
    - iphone-14-pro → iphone-14-pro-max: 3 ⚠️ FP 의심
    - galaxy-s24 → galaxy-s24-256-self: 2
    - galaxy-s23-ultra/galaxy-s24-ultra → 256-self: 각 1
- 위험:
  - **iphone-14-pro → iphone-14-pro-max 3건 FP 의심** — 14 Pro 매물이 Pro Max로 잘못 매칭됐을 가능성. catalog `iphone-14-pro` mustNotContain에 "프로맥스" 있는데 매칭 회피한 케이스. **spot check 필요**.
  - 1,269 매물 중 37건 (3%)만 변경 — 보수적 결과 (자급제 명시 + storage 명시 둘 다 description에 있어야 narrow promotion 작동).
- 다음:
  - Pool-warmer 다음 5분 사이클에서 narrow lane ready 진입 처리
  - 1시간 후 측정: `SELECT sku_id, COUNT(*) FROM mvp_candidate_pool WHERE status='ready' AND sku_id LIKE '%-self'`
  - FP spot check: iphone-14-pro → pro-max 3건 매물 title/description 직접 확인
  - description_preview만 사용 (~100자 limit) — 자급제 token이 description 뒤쪽이면 못 잡음. 풀 description fetch 검토 (별도 wave)

## 2. 거론 금지

- ruleMatch logic 완화해서 더 많은 reclassification — 정책 12b 위반.
- raw_listings.sku_id 강제 SQL UPDATE without ruleMatch — 정확성 보장 X.
