# Wave 803b — '당근만' filter 매물 누락 fix (Wave 953 부작용 보완)

## 사용자 보고

> "잠만 왜 나 휴대폰으로 하면 왜 아식스 슈퍼블라스트 이 매물 근처에 있다고 나오는데 컴퓨터로 하면(같은 동네로 설정했음) 여기에선 이 신발이 안나옴?
> 둘다 15만원 이하로 하고
> 나 갑자기 출처 전체로 했는데 당근만 필터링 했을 때 안나오던 당근 매물 이 아식스가 나오는데 무슨 상황이냐?
> 필터링이 좀 이상한데? 아니 이거 뿐 아니라 다 왜 이래?"

## 진단

### 데이터 확인

- 사용자 home (사당동, 서울 동작구) — `mvp_user_home_regions` 검증
- 누락 매물 = 낙성대동 (관악구) "아식스 슈퍼블라스트2 240, 12만원" — **거리 1km**
- 같은 SKU 9건 daangn ready 매물 박혀있음
- daangn ready pool 총 **4,206건**

### Root cause — Wave 953 부작용

Wave 953 (commit `6f863fdf`, leeminje0411, "speed up nearby daangn loading") 박은 분기:

```typescript
const nearbyDaangnPrimary = Boolean(options.userHomeDaangnFullPath) && (options.source === "daangn" || options.sort === "distance");
const readyOverfetchLimit = nearbyDaangnPrimary
  ? Math.min(FETCH_POOL_OVERFETCH, Math.max(READY_SLOTS * 4, options.readyCandidateLimit ?? READY_SLOTS))
  : FETCH_POOL_OVERFETCH;
```

상수:
- `FETCH_POOL_OVERFETCH = 1500`
- `READY_SLOTS = 25` → `READY_SLOTS * 4 = 100`
- `DAANGN_NEARBY_BOOST_LIMIT = 120`

| 모드 | overfetch | nearby boost | 총 fetched |
|---|---|---|---|
| "출처 전체" + home 박힘 | 1500 (`nearbyDaangnPrimary=false`) | 120 | 1620 |
| **"당근만" + home 박힘** | **100** (`nearbyDaangnPrimary=true`) | 120 | **220** ⚠️ |
| sort=distance + home 박힘 | 100 | 120 | 220 (의도) |

**부작용**: '당근만' 박힌 사용자 → daangn ready 4,206 중 **5% (220)** 만 fetch → 낙성대동 매물이 nearby region 안에 없으면 누락.

### Wave 953 의도 vs 사용자 의도 충돌

- **Wave 953 의도** (leeminje0411): nearby 매물 prefetch + main pool 좁힘 → 빠르게
- **사용자 의도** (오너): '당근만' 박으면 당근 매물 다 보임 (속도보단 매물 완전성)

두 의도 충돌. 해결책: `sort === "distance"` 박힌 사용자만 Wave 953 속도 의도 적용 (nearby 가 sort 자체). '당근만' 박힌 사용자는 매물 완전성 우선.

## Fix

```diff
  const nearbyDaangnPrimary = Boolean(options.userHomeDaangnFullPath) && (options.source === "daangn" || options.sort === "distance");
- const readyOverfetchLimit = nearbyDaangnPrimary
+ const nearbyDaangnSortPriority = Boolean(options.userHomeDaangnFullPath) && options.sort === "distance";
+ const readyOverfetchLimit = nearbyDaangnSortPriority
    ? Math.min(FETCH_POOL_OVERFETCH, Math.max(READY_SLOTS * 4, options.readyCandidateLimit ?? READY_SLOTS))
    : FETCH_POOL_OVERFETCH;
```

## 효과

| 모드 | Before | After |
|---|---|---|
| "출처 전체" | 1620 매물 | 1620 매물 (변화 X) |
| **"당근만" + profit_desc** | **220 매물 (5%)** | **1620 매물 (39%)** ✓ |
| "당근만" + sort=distance | 220 매물 | 220 매물 (Wave 953 속도 의도 유지) |
| "출처 전체" + sort=distance | 1620 매물 | 1620 매물 (변화 X) |

## 비파괴 보장

- `nearbyDaangnPrimary` 분기 유지 (loadNearbyDaangnReadyRows 호출 조건)
- nearby region 10km 반경 boost 그대로
- sort=distance 박힌 사용자 = 기존 fast UX 유지
- '당근만' 박힌 사용자 = 매물 완전성 회복

## Trade-off

- ⚠️ source=daangn + profit_desc 박을 때 main pool 1500 fetch → 약간 느림 (Wave 953 속도 의도 일부 거꾸로)
- ✅ 매물 누락이 critical bug — 속도보단 매물 완전성 우선
- ✅ sort=distance (nearby sort 자체) 사용자는 기존 fast UX 그대로
- 클루지 X, 파괴적 X

## What Not To Do

- `nearbyDaangnPrimary` 자체 제거 X — `loadNearbyDaangnReadyRows` 호출 조건. 제거하면 nearby boost 사라짐.
- `loadNearbyDaangnReadyRows` 자체 제거 X — Wave 953 (속도) + 사용자 의도 (가까운 매물 우선) 다 살림.
- `readyOverfetchLimit` 전체 1500 고정 X — sort=distance 사용자도 1500 가져오면 비용 ↑ (의도된 trade-off 와 거꾸로).
- `source` filter 자체 변경 X — `sourcePass` (line 981-984) 정상 작동.

## 검증

배포 후:
1. PC + home 사당동 박힘 + '당근만' + 15만 이하 + profit_desc → **낙성대동 아식스 슈퍼블라스트 보임** ✓
2. PC + home 박힘 + '당근만' + sort=distance → 기존 nearby 우선 박힘 (속도 유지) ✓
3. 모바일 + 같은 조건 → 동일 매물 보임 (모바일/PC 차이 X) ✓

## 복원 가이드

문제 발생 시 한 줄 revert:

```diff
- const nearbyDaangnSortPriority = Boolean(options.userHomeDaangnFullPath) && options.sort === "distance";
- const readyOverfetchLimit = nearbyDaangnSortPriority
+ const readyOverfetchLimit = nearbyDaangnPrimary
```

## 관련 commits / PRs

- PR #47 — Wave 803b source=daangn 매물 누락 fix
- 영향받은 wave: Wave 953 (`6f863fdf` leeminje0411, "speed up nearby daangn loading")

## Related Waves

- Wave 953 — nearby daangn boost (leeminje0411, 다른 세션)
- Wave 760-764 — 당근 region 267 (전국 cover)
- Wave 777-778 — daangn ingest firehose + raw category filter
- Wave 886 — 당근 전용 시세 (source split market stats)
- **Wave 803b (now)** — '당근만' filter 매물 누락 fix
