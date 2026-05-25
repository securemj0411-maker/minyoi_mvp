# Daangn Phase 6g — Region 기반 ingest 복귀 (전국 검색 가설 폐기)

**날짜**: 2026-05-26
**Branch**: `codex/daangn-probe`
**Commit**: b22c5dee
**Owner**: Claude (autonomous)

## 배경

Phase 6e (commit 4b470c17, b331f3b2) 에서 "당근 web `?search=` 만으로 전국 매물 cover" 가설로
51 region seed 사용 안 하고 빈 `regions = []` 으로 nationwide mode 전환.

근거: moajung.com 같은 사이트는 region mapping 없이 전국 검색 가능해 보임 + 일부 블로그 글.

## 실제 운영 결과 (24h 측정)

```sql
SELECT daangn_region_id, daangn_region_name, COUNT(*) FROM mvp_raw_listings
WHERE source='daangn' AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1,2;
```

| region_id | name | count |
|-----------|------|-------|
| 366 | 서초4동 | 41 |

**문제**: 41 raws 모두 region 366 (서초4동) 1개. Vercel IP geolocation default 로 추정.
- 51 region seed 활용 못함
- 매물 다양성 1/51 손실
- pool_eligible 비율도 41 → 5 (12%) 만 통과

## 조치

`src/lib/daangn-ingest.ts` (line 456):

```diff
- // 전국 검색 mode (region 매핑 불필요).
- const regions = options.regions ?? [];
+ // Region 기반 ingest (Phase 6g — 6e 전국 검색 가설 폐기).
+ const regions = options.regions ?? DEFAULT_DAANGN_REGION_SEEDS;
```

`selectDaangnCombos` 의 빈 regions branch (Phase 6e) 는 fallback 으로 유지 — 사용자별 동네 검색
미래 use case 대비.

## 예상 효과 (Vercel deploy 후)

- 51 region × 6 query × N category combo round-robin (maxCombos=30 cap)
- 매 cron tick 마다 다른 region pick → 24h 누적 51 region coverage 가능
- raw 매물 ~3-5x 증가 예상 (region 다양성 회복)

## 부가 발견

**로컬 dry-run 결과 articles=0**: 로컬 IP 가 Daangn 에 soft-blocked (이전 brute scan 영향).
- production Vercel IP 는 정상 — 24h 운영 데이터로 확인
- 로컬 dry-run script (`scripts/run-daangn-ingest-dryrun.ts`) 은 path validation 용으로만 유효

**query field 손실**: 현재 raw row 의 `query` 컬럼은 `daangn:<region_name>` 만 저장.
실제 search keyword 잃어버림 → 차후 raw row 분석 시 디버깅 어려움.
**별도 wave 필요**: `daangn:<region>:<search>` 형태로 확장.

## 검증 plan

deploy 5-10 min 후:

```sql
SELECT COUNT(DISTINCT daangn_region_id) AS regions,
       COUNT(*) AS raws,
       COUNT(*) FILTER (WHERE pool_eligible) AS eligible
FROM mvp_raw_listings
WHERE source='daangn' AND created_at > NOW() - INTERVAL '30 minutes';
```

목표:
- regions > 5 (revert 효과)
- raws > 50 (region 다양성으로 매물 증가)
- eligible > 5 (현재 baseline 유지 또는 증가)
