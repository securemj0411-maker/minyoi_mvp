# Wave 760 — 당근 region seed 27개 추가 (경기 외곽) + 비수도권 deferred

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "당근은 지역 어떻게 하고있음? 편파적으로 지역하고있는거임?"

## 발견 (편향 측정)

`DEFAULT_DAANGN_REGION_SEEDS` 114개 = 광역시 7곳 (서울/부산/인천/대구/대전/광주/울산) + 경기 37 시·구.

**누락 (인구 ~1,650만 = 32%)**:
- 세종특별자치시
- 강원 (춘천/원주/강릉)
- 충북 (청주/충주)
- 충남 (천안/아산/서산)
- 전북 (전주/익산/군산)
- 전남 (목포/여수/순천)
- 경북 (포항/구미/경주/안동)
- 경남 (창원/김해/진주/양산)
- 제주 (제주시/서귀포)

DB 측정: raw daangn 52k 매물 → 모두 광역시+수도권. 비수도권 ~0건.

## 변경

### `src/lib/daangn.ts::DEFAULT_DAANGN_REGION_SEEDS` 27개 추가
brute scan (`scripts/daangn-region-brute-scan.ts` range 1830-1878) 결과:
- **여주 12개**: 가남읍/점동면/흥천면/금사면/세종대왕면/대신면/북내면/강천면/산북면/여흥동/중앙동/오학동
- **연천 8개**: 연천읍/전곡읍/군남면/청산면/백학면/미산면/신서면/장남면
- **가평 2개**: 가평읍/설악면
- **양평 5개**: 옥천면/청운면/양동면/용문면/동산면

**시·구 단위는 이미 있음 (1801~1829). 추가는 동·면·읍 단위 → 더 세밀한 region 매물 inflow.**

### `scripts/daangn-region-brute-scan.ts` 정정
range 1830-4500 / batch 25 / delay 100ms 로 안전화. 1878 이후 모두 fallback (사당동) → ID space 비어있음 확인.

## 검증
- `npx tsc --noEmit` 0 에러
- region seed 총 141개 (114 → 141)

## 위험
- 0. raw inflow 만 증가, 정확도 영향 X.
- 비수도권은 여전히 0건 — 사용자 매물 가치 미달.

## 다음 (별도 wave 필수)

비수도권 region ID 발견 작업:
1. 광역시 region 들로부터 BFS 확장 (대전 → 충청 인접 발견 가능성)
2. 또는 daangn local-profile sitemap 분석
3. ID range 5000+ 정밀 스캔 (현재는 1830-4500 만 확인됨, 1878-4500 다 fallback)
4. 또는 daangn web region picker UI HTML 직접 분석

예상 소요: 1시간+ (rate limit 조심 + ID 발견 휴리스틱). 별도 wave 진행 시 진행.

현재 wave 는 작은 increment (경기 외곽 27개) 만 commit.
