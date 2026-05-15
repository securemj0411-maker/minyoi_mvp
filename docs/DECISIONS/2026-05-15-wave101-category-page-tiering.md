# Wave 101 — 카테고리 sweep page count 차등

> Status: **applied (code).** 5분 cron tick의 13개 카테고리 sweep을 동일 page 0 (96건)에서 fresh hit rate 기반 page 차등으로 변경. 같은 quota 안에서 fresh capture 극대화.

CLAUDE.md 6 필드 포맷.

## 1. 카테고리 sweep page count 차등 적용

- 시간: 2026-05-15 (Wave 101)
- 발견:
  - 최근 30분 raw_listings 측정 (`first_seen_at >= NOW() - 30min` 기준):

    | 카테고리 (id) | touched | new_30m | fresh % |
    |---|---:|---:|---:|
    | 휴대폰 600700 | 134 | 63 | 47.0% |
    | 태블릿 600710 | 139 | 25 | **18.0%** |
    | 워치/밴드 600720 | 71 | 13 | 18.3% |
    | PC/노트북 600100 | 95 | 68 | 71.6% |
    | 카메라/DSLR 600300 | 82 | 71 | 86.6% |
    | 오디오/영상 600500 | 137 | 64 | 46.7% |
    | 게임/타이틀 600600 | 98 | 72 | 73.5% |
    | 시계 421 | 96 | 61 | 63.5% |
    | 가전제품 610 | 105 | 90 | 85.7% |
    | 골프 700600 | 100 | 88 | 88.0% |
    | 신발 405 | 98 | 86 | 87.8% |
    | 가방/지갑 430 | 103 | 93 | 90.3% |
    | 자전거 700350 | 73 | 68 | 93.2% |

  - 해석:
    - fresh % 낮음 = page 0의 96건 중 같은 stable 매물 반복 fetch 비율 높음.
    - touched < 96 카테고리 (워치/자전거)는 page 0이 안 차므로 page 1 추가 무의미.
    - touched ≥ 130 + fresh % < 50% 카테고리 (휴대폰/태블릿/오디오)는 page 0이 가득 차면서 fresh가 부족 → page 1에서 더 깊은 매물 추가 capture 가능.
- 변경:
  - **[mvp/src/lib/pipeline-config.ts](mvp/src/lib/pipeline-config.ts:69)**
    - `DEFAULT_CATEGORY_SWEEPS` entry에 `pageCount?: number` 추가.
    - 휴대폰(600700), 태블릿(600710), 오디오/영상(600500) 3개에 `pageCount: 2` 박음.
    - 나머지 10개 default (page 0만, 기존 동작).
    - 신규 export `getCategoryPageOverrides(): Record<string, number[]>` — query string → custom pages array.
  - **[mvp/src/lib/tick-pipeline.ts:1023](mvp/src/lib/tick-pipeline.ts:1023)** `searchStage()`
    - import에 `getCategoryPageOverrides` 추가.
    - `pages` → `defaultPages` rename.
    - `categoryPageOverrides` lookup 추가 (`mode !== "deep"` 일 때만).
    - query loop 안에서 `pagesForQuery = categoryPageOverrides[query] ?? defaultPages`.
  - **호출 경로 영향**:
    - `runSearchScorePipeline()` (5분 cron `/api/cron/tick`) — `mode: "fresh"`, override 적용 ✓
    - `runDeepCrawlPipeline()` — `mode: "deep"`, override 비활성 (rotation 보존)
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
- 위험:
  - 매우 낮음. 3개 카테고리에 page 1 추가만 = 5분당 fetch 13→16 (+23%).
  - Bunjang API rate-limit 위반 위험 없음 (이미 query 13개 × page 1개 fetch 가능, +3 fetch).
  - 잘못된 결과 시 (fresh capture 늘지 않음) `pageCount: 2` 제거만 하면 즉시 revert 가능.
- 다음:
  - 30분~1시간 후 raw_listings 재측정해서 휴대폰/태블릿/오디오 fresh 매물 증가 검증.
  - 효과 미미하면 revert. 효과 있으면 워치/밴드 600720은 매물 적어 page 1 무의미, 다른 fresh % 낮은 카테고리도 page 2 검토.
  - 측정 SQL:
    ```sql
    SELECT query, COUNT(*) AS touched,
      COUNT(*) FILTER (WHERE first_seen_at >= NOW() - INTERVAL '30 minutes') AS new_30m
    FROM mvp_raw_listings
    WHERE last_seen_at >= NOW() - INTERVAL '30 minutes' AND query LIKE 'category:%'
    GROUP BY query ORDER BY touched DESC;
    ```

## 2. 거론 금지

- pageCount: 3 이상 (page 2 추가) — 측정 없이 무리. Wave 101 측정 후 결정.
- 워치/밴드 600720 page 2 — touched 71 → page 0도 못 채우는 매물량. 효과 zero.
- broad consolidation (전체 카테고리 동일 page 차등) — fresh capture와 API quota tradeoff 무시한 단순화.
