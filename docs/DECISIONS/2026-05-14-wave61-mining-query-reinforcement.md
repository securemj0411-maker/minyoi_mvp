# Wave 61 — 기존 catalog narrow lane mining query 보강

> Status: **applied (code only).** DB write 0, candidate_pool 0, public 0, DDL 0. 사업 카테고리 신규 아님 — 이미 catalog 등록된 narrow lane 9개의 자연 inflow 0~3건을 살림.

CLAUDE.md 6 필드 포맷.

---

## 0.1 mining query 10건 추가

- 시간: 2026-05-14 KST
- 발견: Wave 60 후 진단에서 catalog narrow lane 등록됐는데 자연 inflow 0~3건인 9 SKU 식별 (camera-sony-a7m3·a7c, camera-canon-r6-mark-ii, beats-solo4, beats-studio-pro, galaxy-buds-3-pro, bose-qc-ultra, bose-qc45, sony-wh-ch520, lg-gram-17-2024). DEFAULT_SEARCH_QUERIES에 해당 query 부재로 cron이 자연 수집 못 함. 사업 카테고리 신규 아니라 autonomy 범위.
- 변경: `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES 61→71 (+10):
  - 카메라 3: "소니 A7M3", "소니 A7C", "캐논 R6 Mark II"
  - 헤드폰/이어폰 5: "비츠 솔로4", "비츠 스튜디오 프로", "갤럭시 버즈 3 프로", "보스 QC 울트라", "보스 QC45"
  - 노트북 1: "LG 그램 17"
  - 소니 1: "WH-CH520"
  - cleanup 사유 comment 박음.
- 검증:
  - tsc clean / test:core 135/135
  - module load 71 queries
  - `scripts/wave61-inventory-probe.ts` Bunjang find_v2 실측 — 10/10 query 자연 inflow 발생
- 위험: queryFamily=unknown → gather + 5m default. yield-based downrank이 evidence 누적 후 적용. mvp_search_queries 자동 등록 (Wave 56·57 동일 메커니즘).
- 다음: cron natural cycle 후 SKU binding 측정 (1~2h). 11 criteria 위반 query (캐논 R6mk2 자본 215만 / 비츠 스튜디오 프로 회전 경계 / WH-CH520 median 4.5만) 1~2 cycle 측정 후 cleanup 결정.

---

## 0.2 11 criteria 실측 결과 (find_v2 page 0)

| query | last_24h | last_7d | last_30d | median 원 | criteria 통과 |
|---|---:|---:|---:|---:|---|
| 소니 A7M3 | 9 | 24 | 45 | 1,200,000 | ✓ |
| 소니 A7C | 27 | 49 | 70 | 1,900,000 | ✓ |
| 캐논 R6 Mark II | 2 | 6 | 18 | 2,150,000 | **자본 200만 초과 경계** |
| 비츠 솔로4 | 2 | 8 | 27 | 340,000 | ✓ (회전 floor 위) |
| 비츠 스튜디오 프로 | 4 | 10 | 22 | 175,000 | **회전 경계** |
| 갤럭시 버즈 3 프로 | 27 | 60 | 94 | 135,000 | ✓ 압도 |
| 보스 QC 울트라 | 27 | 59 | 95 | 260,000 | ✓ 압도 |
| 보스 QC45 | 4 | 13 | 36 | 170,000 | ✓ |
| WH-CH520 | 2 | 6 | 22 | 45,000 | **median 10만 floor 위반** |
| LG 그램 17 | 15 | 36 | 70 | 999,000 | ✓ |

→ 7 강함 / 3 경계 (Wave 62~63에서 catch-up 측정 후 cleanup 결정)

## 1. 변경/검증/위험
- 변경: pipeline-config.ts 10 lines 추가
- 검증: tsc / test:core 135/135 / find_v2 실측 10/10
- 위험: 경계 3 query (캐논 R6mk2 / 비츠 스튜디오 프로 / WH-CH520)는 catch-up 측정 후 cleanup 가능
- 다음: 1~2h 자연 cron cycle 후 SKU binding 측정 (Wave 62) + 경계 query cleanup 결정

## 2. 남은 blocker (재정렬)

1. R3 정밀 hash (한 달+)
2. 38 no_change 정리 (낮음)
3. Phase A backup DROP (2026-05-21+ 자동)
4. PS5 catch-up 완료 측정 (자연 시간)
5. Wave 57 +7 query SKU binding 측정 (자연 시간)
6. **Wave 61 +10 query catch-up 측정 + 경계 3 cleanup** (자연 시간 1~2h)
7. 사업 카테고리 신규 사인오프 (시계/골프/카메라) — owner

→ **남은 blocker 7건** (1·2 우선순위 낮음, 3 자동, 4·5·6 자연 시간, 7 owner)
