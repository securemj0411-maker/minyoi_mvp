# Wave 797 — 당근 매물 거리 ASC 우선 정렬 (진짜 옵션 A)

- 시간: 2026-05-27 KST
- 트리거: owner 피드 검증 — 거리 4km/5km/6km/10km 다 섞임. "거리 우선 정렬 안 됨".

## 발견 — Wave 895 는 필터만, 정렬은 없었음

이전 검토에서 Wave 895 가 거리 기반 정렬 박혀있다고 보고했는데 잘못된 정보:
- Wave 895 의 `daangnActionableByPid` / `daangnDistancePass` 는 **거리 기반 필터** (멀리 있는 매물 차단)
- **거리 ASC 정렬은 박혀있지 않았음**
- 피드에 4km/5km/6km/10km 매물이 차익률 순으로 섞여 나옴

owner 직접 확인: 4km → 6km → 10km → 6km → 4km → 5km → 5km → 5km → 4km — 무작위.

## 변경

`/api/packs/pool/route.ts`:

1. **`daangnDistanceKmByPid` Map 추가** — 당근 매물 distanceKm 저장.
2. **`diversifyByCategory` Phase 1 정렬 변경**:
   - `src === 'daangn'` 일 때 `rows` 를 distance ASC 로 정렬
   - tie-break: 차익 DESC (`expected_profit_max`)
   - 다른 source 는 그대로 (입력 순서 = 차익 DESC)
3. **user home region 등록 안 됐으면 효과 없음** (distanceKmByPid empty)

## 작동 흐름

당근 매물 quota 12개 채울 때:
- Before: 차익 DESC (10km 매물이 4km 매물보다 차익 크면 위로)
- After: distance ASC 우선 (4km → 5km → 6km → ...)

## 예상 결과

owner 피드에서:
- 당근 매물끼리 가까운 동 → 먼 동 순서로 노출
- 다른 source (번장/중나) 는 그대로 차익 순
- user home region 안 등록된 사용자는 무관 (옛 동작 유지)

## 검증 시점

배포 후 owner 피드 새로고침 → 당근 매물 distance ASC 정렬 확인.

## Follow-up

- 만약 차익도 같이 고려하길 원하면 score 가산 패턴 추가 (distance 0~3km +30 score, 3~6km +15, 6km+ 0).
- distance 정보를 매물 카드 raw display 가 아닌 "가까운 동 추천" 뱃지로 시각화도 가능.
