# Wave 64 — landing 평균 차익 trimmed mean (상하 10%)

> Status: **applied (code only).** DB write 0, DDL 0. autonomy 범위.

CLAUDE.md 6 필드 포맷.

## 0.1 landing averageProfit outlier 왜곡 해소

- 시간: 2026-05-14 KST
- 발견: `src/lib/landing-showcases.ts:297` `averageProfit`이 단순 산술평균 (5000 row 균등 1/N 가중). pool ready 368개 중 max midpoint 794,750원 같은 고가 outlier (카메라/GPU)가 평균을 끌어올림.
- 변경: `src/lib/landing-showcases.ts` `loadLandingKpisCached` 내부 — midpoint sort 후 `Math.floor(n * 0.1)` 만큼 상하 절사 후 평균. 라벨 "평균 차익" 유지 (사용자에 trimmed mean임을 노출 안 함, 산술평균 → 보수적 추정으로만 변경).
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
  - production data 비교 (pool=368): 단순평균 120,174원 → trimmed 94,305원 (-21%). max midpoint 794,750원 (단일 outlier)이 trim 적용 시 제외.
- 위험:
  - landing UI에 표시되는 "평균 차익" 숫자가 약 20% 감소. 마케팅 메시지 약화 가능. 단 **보수적·정직** 방향이며 사용자 신뢰 ↑.
  - `unstable_cache revalidate=10800` (3h) → 첫 반영은 다음 cache refresh 시.
  - n < 10 인 경우 trim count = 0 → 그대로 산술평균 fallback (의도된 behavior).
- 다음: landing 페이지 실제 노출값 모니터링 (3h cache 후). 마케팅이 평균값 회복 요구 시 median + max 병기 같은 별도 표시 검토.
