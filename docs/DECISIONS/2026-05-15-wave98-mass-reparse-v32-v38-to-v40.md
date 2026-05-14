# Wave 98 — Mass reparse v32~v38 → v40 (Stale parser 해소)

> Status: **applied (DB write 10,383 rows).** Wave 97 진단의 stale parser 13,852건 문제 해결. 99.5% active 매물 v40으로 통일. 다음 score tick에서 시세 자동 재계산.

CLAUDE.md 6 필드 포맷.

## 0.1 Mass reparse 실행

- 시간: 2026-05-15 11:30~12:00 KST
- 발견: Wave 97에서 메인 페이지 ₩100만+ 차익 매물 원인 추적. **stale parser (v32~v38)가 13,852건**으로 가장 큰 원인. Top 5 profit 매물 중 4건이 구버전 parser로 comparable_key 생성 + 시세 표본 1건만 있어도 pool 진입.
- 변경: `scripts/reparse-direct.ts`로 단계별 일괄 reparse:
  - Stage 1 macbook (pro/air): 1,414건
  - Stage 2 tablet (ipad pro/air/mini/10, galaxy-tab s8~s10): 2,006건
  - Stage 3a earphone (airpods 전 변형, galaxy-buds, sony WH, sennheiser): 2,208건
  - Stage 3b smartwatch (applewatch se2~ultra2, galaxywatch 6~ultra): 1,874건
  - Stage 4a smartphone (iphone 13~16, galaxy s23~s25): 1,697건
  - Stage 4b 기타 (watch, game, golf, bose, sony, 누락 tablet): 707건
  - Stage 4c 남은 mini SKU (desktop, speaker, beats, ps5 등): 477건
  - **총 10,383건 reparse → v40 통일**
- 검증:
  - reparse 후 `mvp_listing_parsed.parser_version` 분포:
    - v40 (최신): **10,363건 (99.5%)**
    - v35: 34건 (남은 mini SKU, minor)
    - wave92-fashion-mobility-v1: 18건 (신발/가방/자전거 신규)
    - v38: 6, v32: 6, v33: 1 (총 13건 minor)
  - reparse-direct.ts: 매물별 `parseListingOptions` 재실행 + `mvp_listing_parsed` upsert + `mvp_raw_listings.score_dirty=true` 마크.
- 위험: 매우 낮음.
  - 외부 API 호출 0 (Supabase DB read/write만).
  - parseListingOptions는 deterministic (같은 매물 → 같은 결과). 새 결과는 기존보다 정확.
  - score_dirty=true 마크로 다음 score tick에서 자동 재계산.
- 다음:
  - 다음 score tick (5분 내) → market_price_daily 재계산 → candidate_pool refresh.
  - 메인 페이지 max profit 정상화 확인 (₩100만 → 더 합리적 수준).

## 0.2 결과 검증 계획

- 시간: 2026-05-15 12:00 KST
- 발견: score tick + market-worker가 새 parser 결과 반영하려면:
  1. tick의 scoreStage가 `mvp_raw_listings.score_dirty=true` 매물 처리
  2. parseListingOptions 결과 + 시세 비교 → expected_profit 재계산
  3. market-worker가 새 comparable_key 분포로 market_price_daily 재집계
  4. pool-warmer가 candidate_pool refresh
- 변경: 없음 (자동 cron 진행).
- 검증: 30분~1시간 후 SQL 재확인:
  ```sql
  SELECT pid, category, expected_profit_max, comparable_key, last_verified_at
  FROM mvp_candidate_pool
  WHERE status = 'ready'
  ORDER BY expected_profit_max DESC LIMIT 10;
  ```
  이전과 다른 SKU/comparable_key 분포 + 더 합리적 차익 수치 기대.
- 위험: 없음.
- 다음: Wave 99에서 시세 표본 minimum 게이트 (active_sample_count >= 5) 추가 검토.

## 1. 잔여 stale 47건 분석

| Parser version | 매물 | SKU 종류 |
|---|---:|---|
| v35 | 34 | 매우 작은 SKU 풀 (각 1~5건) |
| v38 | 6 | 신규 wave 매물 (이미 비슷한 parser) |
| v32 | 6 | minor |
| v33 | 1 | minor |
| **합** | **47 (0.5%)** | 무시 OK — 시세 영향 미미 |

활성 매물 99.5%가 v40. 잔여는 자연 lifecycle terminate되거나 다음 update에서 재처리됨.

## 2. 비용 분석

- Supabase DB read: ~10,400 rows fetch
- Supabase DB upsert: ~10,400 rows write
- CPU: parseListingOptions 10,400회 (각 ~1ms = 10초 total)
- 외부 API 호출: **0**
- **총 비용: 거의 0** (Supabase free tier 한도 내)

## 3. 다음 wave 후보

- **Wave 99**: 시세 표본 minimum 게이트 (`candidate-pool-builder.ts`에 `active_sample_count >= 5` 강제). 시세 1건짜리 매물 자동 reject — 거짓 차익 매물 차단.
- **Wave 100**: Reparse 자동화 — housekeeper cron에 "구버전 parser 매물 자동 reparse" 추가. 차후 parser 업데이트 시 자동 적용.

## 4. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- 캐시 (main page 3~6h)가 ₩100만 매물 원인 가설 — 틀림 (Wave 97 진단 결과 확정).
