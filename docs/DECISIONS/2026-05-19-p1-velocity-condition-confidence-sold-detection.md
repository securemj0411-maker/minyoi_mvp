# 2026-05-19 — P1 묶음: Velocity condition 분리 + Confidence 뱃지 + Sold 검출 진단

## 결정

velocity P0 fix + 시세 그래프 정직화 후속 P1 4개 중 3개 처리.
나머지 1개(7일/4주 rollup)는 별도 큰 작업이라 후속.

## 변경 (What)

### 1. Velocity RPC v3 — condition_class 분리
파일: Supabase migration `sync_market_velocity_condition_split` apply 완료

이전 v2: 모든 row가 `condition_class='all'` 고정. 사용자가 보는 카드 condition(중고/하급)과 무관한 평균.
v3 변경:
- `eligible` CTE에 `coalesce(p.condition_class, 'normal')` join
- `key_velocity_cc` (condition별 group by) + `key_velocity_all` (전체 aggregate) UNION
- 한 매물당 condition row + 'all' row 두 개 박힘
- backward compat: 기존 `fetchLatestMarketVelocity`가 'all' fallback으로 작동

**결과**:
| 지표 | v2 (condition='all'만) | v3 (분리) | 변화 |
|---|---|---|---|
| total rows | 645 | **1820** | +2.8× |
| condition-split rows | 0 | **1171** | 신규 |
| 'all' aggregate rows | 645 | 649 | 보존 |
| high+medium 진짜 데이터 | 94 | **188** | +2× |
| sold_sample_total | 3416 | 6864 | 같은 매물이 condition + 'all' 둘 다 카운트되어 ×2 |

### 2. Confidence 뱃지 — 시세 그래프 UI 노출
파일: [market-history-chart.tsx](../../src/components/market-history-chart.tsx)

- API는 이미 `confidence` 컬럼 반환 중 (route.ts:101)
- chart Point 타입에 `confidence?: "high" | "medium" | "low"` 추가
- 헤더 제목 옆 뱃지:
  - high: `✓ 신뢰 높음` (emerald)
  - medium: `△ 신뢰 보통` (amber)
  - low: `? 표본 부족` (zinc)
- 사용자가 시세 신뢰도 즉시 인지 (이전엔 sample_count만 봄)

### 3. Sold 검출 진단 (별도 agent 위임 — 분석 보고서)

**Critical 발견** — 신발/의류/가방 sold 비율이 1~5%에 머무는 원인:

| cat | total | sold | % | raw SOLD_OUT | title-triage skipped (lifecycle 미적재) |
|---|---:|---:|---:|---:|---:|
| smartwatch | 3052 | 1230 | **40%** | 1025 | 0 |
| tablet | 3907 | 609 | 16% | 719 | 0 |
| earphone | 3801 | 579 | 15% | 325 | 0 |
| **shoe** | 6701 | **327 (4.9%)** | | 163 | **4208/4222 (99.7%)** |
| **bag** | 1310 | **66 (5%)** | | 27 | **98.6%** |
| **clothing** | 3613 | **46 (1.3%)** | | 17 | **100%** |

3가지 원인 복합:
- **(A) Title-triage가 신발/의류/가방 매물의 99%+를 skip** ([tick-pipeline.ts:838-909](../../src/lib/tick-pipeline.ts#L838)). SKU catalog 매칭 실패 → `detail_status='skipped'` → [seedLifecycleChecks](../../src/lib/tick-pipeline.ts#L1800-1803)가 호출 안 됨 → `mvp_lifecycle_checks`에 영구 누락 → sold polling 대상 X
- **(B) Corpus 신규성** — 평균 age clothing 0.6일 / bag 1.6일 / shoe 1.9일 vs smartwatch 7.9일. sold 전환할 시간 자체 부족
- **(C) 셀러 행동** — 신발/의류/가방 셀러는 SOLD_OUT 표시 대신 **매물 자체를 삭제**하는 경향 (raw SOLD_OUT shoe 2.4%, clothing 0.5% vs smartwatch 33.6%). 미뇨이는 SOLD_OUT만 sold로 잡고 disappeared는 별도 처리

**카테고리 분기는 코드에 명시적으로 없음** — title-triage가 SKU catalog 부족(`title_unknown_sku`)에 비례 차별 작동하는 게 본질

## 후속 (Follow-up — 결정 필요)

### P1-F-Fix-1: Title-triage skipped pid도 lifecycle seed
[tick-pipeline.ts:1325-1332](../../src/lib/tick-pipeline.ts#L1325) 패치 직후에 skipped group의 pid를 `seedLifecycleChecks(..., 'general')`로 추가. general tier + 긴 cooldown으로 폴링 비용 최소화. **이게 박히면 신발/의류/가방 sold 검출이 회복**.

### P1-F-Fix-2: Velocity 함수에 disappeared after N days도 sold 표본 포함 (카테고리 분기)
신발/의류/가방 셀러가 SOLD_OUT 대신 매물 삭제하는 경향 반영. `eligible` CTE에 `OR (listing_state='disappeared' AND first_seen_at < NOW() - INTERVAL '5 days' AND category IN ('shoe','clothing','bag'))` 분기 추가.

→ 둘 다 **결정 필요** (코드 변경 큼, sold 정의 변경은 정책 결정). 사용자 confirm 후 별도 PR.

### P1-G: 7일/4주 rollup 시스템
별도 작업. 결정 사항 많음 (cutoff, weekly 테이블 구조, retention 정책). 후속 PR.

## 안 건드린 것

- `fetchLatestMarketVelocity` condition_class 매칭 — backward compat 유지. UI가 'all' fallback. P2에서 condition 매칭 업그레이드 시 정확도 추가 향상
- `velocityBasisForCandidate`에 카드 condition 전달 — 위와 같음. P2 packaged
- title-triage / lifecycle seed 변경 — 위 P1-F-Fix-1로 분리. 결정 필요

## 관련

- Velocity P0 fix: docs/DECISIONS/2026-05-19-velocity-p0-fix.md
- 시세 그래프 정직화: docs/DECISIONS/2026-05-19-market-chart-honesty-and-schema-drift.md
- Wave 90 source diversification 메모리 — 신발/의류/가방 카테고리 추가 흐름
- Wave 130 condition_class 분리 — 이 작업의 기반
