# Wave 761 — 당근 region seed: 강원도 18 시·군 + 충북 5 구·시 cherry-pick

- 시간: 2026-05-26 KST
- 트리거: 사용자 — "전국 다 해야되는거 아닌가?" + "동단위로 안했는데 비효율적".

## 발견

### sibling cascade 검증 (DB)
- 1854 가평읍 seed → **1855 설악면 매물 330건 수집** (1855 not seed before Wave 760)
- 1829 여주시 seed → 1830 가남읍 매물 274건 수집

→ **1 seed per 군·시 = 그 군·시 전체 매물 cascade ✅**

→ 동·읍·면 다 박을 필요 X. 군·시당 1 seed = 충분 + 효율적.

### scan 결과 (v2 + v3)
- 1830-1989 (v2, 146 IDs): 경기 외곽 + 강원도 동·읍·면
- 1990-2165 (v3, 143 IDs): 강원 일부 + 충북 (청주 4구 + 충주)
- 2166+ : rate limit 으로 scan 실패 — 충남/전라/경상/제주/세종 미커버

## 변경

`src/lib/daangn.ts::DEFAULT_DAANGN_REGION_SEEDS` 에 **23 seed cherry-pick 추가**:

### 강원도 18 시·군 (각 1 seed)
- 춘천 1880 / 원주 1902 / 강릉 1928 / 동해 1950 / 태백 1961 / 속초 1970 / 삼척 1979
- 홍천 1993 / 횡성 2004 / 영월 2014 / 평창 2025 / 정선 2035
- 철원 2046 / 화천 2059 / 양구 2065 / 인제 2071 / 고성 2079 / 양양 2086

### 충북 5
- 청주 상당구 2095 / 서원구 2109 / 흥덕구 2121 / 청원구 2133
- 충주시 2142

## 검증
- `npx tsc --noEmit` 0 에러
- region seed 141 → 164

## 위험
- 0. raw inflow 만 증가, 정확도 영향 X.
- cron API 부담 ~16% 증가 (141 → 164 region × 6 query = 약 1000 calls/cycle, 기존 ~850).

## 다음 (별도 wave 필수)
**충남/전라/경상/제주/세종 미커버** — 약 100개 시·군 더 추가 필요.

작업:
1. daangn rate limit 회복 후 (몇 시간 ~ 1 일 대기)
2. ID range 2166-9999 정밀 scan (느린 batch, e.g., 3 batch × 1500ms delay)
3. 발견된 cluster 별 1 seed cherry-pick
4. 다음 wave commit

scan tool: `scripts/daangn-region-discover-v2.ts {start} {end} {batch} {delay}` 동작 확인됨 — 매물 inflow 안정화 후 재실행.
