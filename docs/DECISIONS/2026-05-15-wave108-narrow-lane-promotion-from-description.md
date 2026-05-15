# Wave 108 — narrow lane promotion from description (smartphone/laptop/tablet/watch/game)

> Status: **applied (code).** owner 요청 "internal_only 매물 강화 + ready 승격". 진단: 자급제 narrow lane이 production에서 ready 0건 (switch-oled 3건 제외). 원인: ruleMatch title-only가 broad 잡고 즉시 return → description의 자급제+용량 token 못 봄.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — narrow lane production 매물 진입 0건

- 시간: 2026-05-15
- 발견:
  - internal_only 카테고리 (smartphone/game_console/camera) 7일 raw: 1,832건, 31 SKU.
  - 단순 카테고리 ready 승격 시 추가 ready 약 ~60건 (+25%). 정책 위반(precision > recall).
  - **진짜 path = narrow lane 추가/활성**. 측정: 등록된 narrow lane 14개 중 switch-oled만 ready 3건 → **13개 자급제 narrow lane은 ready 0건**.
  - 원인 추적: 자급제 매물 (galaxy-s23-ultra `자급제` 명시 24건) 전부 broad SKU로 흡수됨. narrow lane은 매칭 자체 안 됨.
  - 근본 원인: `ruleMatch` title-only가 broad 잡으면 즉시 return. description의 자급제+용량 token 못 봄.
- 변경: 없음 (측정만).
- 검증: SQL 측정으로 확인.
- 위험: —
- 다음: ruleMatch 수정.

## 2. ruleMatch narrow lane promotion 활성

- 시간: 2026-05-15
- 발견: title에서 broad가 1개만 잡혀도 description 포함 combined로 narrow lane 재시도 시 narrow 매칭 가능. precision 보존 (narrow mustContain 자급제+용량 둘 다 명시되어야).
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts:2884)** `ruleMatch()`
  - 새 helper `tryNarrowLanePromotion(broad, combined, titleNorm)`:
    - broad가 narrow lane(`laneKey`) 가지면 skip
    - category가 `smartphone/laptop/tablet/watch/sport_golf/game_console` 중 하나일 때만
    - description 있을 때 (combined !== titleNorm)
    - combined에 매칭되는 narrow lane SKU 1개 있으면 그것 반환
  - title broad 잡힌 후 `tryNarrowLanePromotion` 호출, narrow 있으면 narrow 선택. 기존 broad fallback 유지.
- 검증:
  - `npx tsc --noEmit` exit 0
  - `npx eslint --max-warnings=0` exit 0
  - `npm run test:core` 139/139 pass
  - `npx tsx scripts/lane-replay-readiness.ts` (mining sample 기반):

    | Lane | Before sku% | After sku% | 배수 |
    |---|---:|---:|---:|
    | galaxy_s23_ultra_256_self | 0.5 | **38.5** | 77× |
    | galaxy_s24_ultra_256_self | 1.0 | **44.5** | 44× |
    | iphone_15_pro_128gb_self | 1.5 | **50.0** | 33× |
    | iphone_14_pro_128gb_self | 2.0 | **56.0** | 28× |
    | iphone_16_pro_128gb_self | 28.0 | 40.0 | 1.4× |
    | galaxy_s25_ultra_256_self | 2.0 | 17.5 | 8.7× |

- 위험:
  - **False positive 가능**: description에 "자급제 256gb 모델 있어요" 같은 fuzzy 문맥 매물도 narrow로 promote 가능. 단 narrow mustContain (자급제 + 용량) 둘 다 명시되어야 매칭이라 hit rate 낮음.
  - 정확성 절대 우선 정책 (LAUNCH_PLAN.md 12b) — "자급제 명시 안 함 = self lane 흡수 금지" 위반 아님. description에 자급제 명시되어 있어야 매칭.
  - 측정 후 FP 발견 시 narrow lane mustContain에서 "자급제" 외 strong token (`공기계`, `정상해지`, `언락`) only 강화 검토.
- 다음:
  - Production cron 5분 tick 후 raw_listings → mvp_listing_parsed reparse 일부 시작. 1~3시간 후 narrow lane 매물 ready 진입 측정.
  - 측정 SQL:
    ```sql
    SELECT r.sku_id, COUNT(*) FILTER (WHERE pool.status='ready') AS ready_now
    FROM mvp_candidate_pool pool
    JOIN mvp_raw_listings r ON r.pid = pool.pid
    WHERE r.sku_id LIKE '%-self' GROUP BY r.sku_id ORDER BY ready_now DESC;
    ```
  - FP spot check: narrow lane으로 진입한 매물 sample 10개 직접 확인 (title + description) — 실제 자급제 매물인지.
  - 효과 확인 시 추가 narrow lane 신설 (galaxy_s24_256_self, iphone_15_256_self 등 매물 충분한 lane).

## 3. 거론 금지

- 카테고리 자체 ready 승격 (smartphone/game_console/camera) — LAUNCH_PLAN 원칙 12b/13 위반. 정확성 trade-off 큼.
- broad SKU에 자급제 token mustNotContain 추가 — description fuzzy 매물도 reject 위험. 차라리 narrow promote.
- title-only ruleMatch로 narrow 직접 매칭 강제 — 현실에서 title은 보통 모델명만, description에 자급제 명시. 비현실적.
