# Wave 765 — Audit 후속: AirPods Max 2 차단 + Crocs All-Terrain / AJ11 Low·High / Arc'teryx Alpha·Gamma sub-line 분리

- 시간: 2026-05-27 KST
- 트리거: Wave 764 audit 보고 → 사용자 "다음거 바로 가자 ㄱㄱ".

## 발견 (audit)

| 매물/SKU | 문제 |
|---|---|
| pid 7003881424606 "에어팟 맥스2 미드나이트 2026" | broad `airpods-max` (1세대) 로 매칭. `mustNotContain` 에 "맥스2" 차단 누락 |
| pid 9002813599589 "크록스 클래식 올터레인 클로그 290" | All-Terrain (정가 ~7-8만) 인데 Classic Clog (정가 4-5만) 시세로 비교 |
| pid 330723956 "조던 11 레트로 로우 체리" | broad `airjordan_11` → High/Low 통합 시세 (Low 30-40% 저렴) |
| Arc'teryx 알파/감마 매물들 | SV/AR/LT/FL/SL/MX/SL/Lightweight sub-line 통합 |

## 변경

### `src/lib/catalog.ts`
1. **`airpods-max` mustNotContain 보강**: "맥스2", "맥스 2", "max 2", "max2", "2세대", "미드나이트", "스타라이트", "퍼플", "오렌지" (2세대 전용 컬러), "a3184" (2세대 model number) 추가.
2. **`shoe-crocs-classic-clog` mustNotContain**: "all terrain", "올터레인" 등 차단.
3. **신규 `shoe-crocs-all-terrain`**: msrp 79,000, 별도 SKU.
4. **`clothing-arcteryx-gamma` mustNotContain**: sub-line 키워드 차단.
5. **신규 `clothing-arcteryx-gamma-mx`** (msrp 450,000), **`clothing-arcteryx-gamma-sl`** (msrp 280,000).
6. **`clothing-arcteryx-alpha` mustNotContain**: sub-line 키워드 차단.
7. **신규 `clothing-arcteryx-alpha-sv`** (msrp 1,100,000, flagship), **`clothing-arcteryx-alpha-ar`** (msrp 900,000), **`clothing-arcteryx-alpha-lt`** (msrp 700,000).

### `src/lib/generated/catalog-shoe-narrow-wave134.ts`
8. **`shoe-nike-airjordan-11` mustNotContain**: "로우/Low", "하이/High" 차단 (sub-line 분리).
9. **신규 `shoe-nike-airjordan-11-low`** (msrp 199,000), **`shoe-nike-airjordan-11-high`** (msrp 269,000).

### Daangn manner_temp 재backfill
- v2 backfill 실행 — 30/30 success, manner temp 박힘.
- 분포: 37~99°C, 평균 ~50°C.

## 검증
- `npx tsc --noEmit` 0 에러
- catalog 신규 SKU 8개 (Crocs All-Terrain + Arc'teryx Alpha 3 + Gamma 2 + AJ11 Low/High)
- Daangn manner temp NULL 29 → 0

## 위험
- 0. broad SKU 의 mustNotContain 추가는 false negative recall 감소만, false positive 발생 X (precision 우선 원칙).
- 새 narrow SKU 의 mustContain 은 strict — sub-line 명시 매물만 잡음. 정확.

## 다음
- production replay 측정 (몇 시간 후 새 SKU 매물 inflow 확인).
- 추가 sub-line split 후보 (audit 잔여): Hoka Bondi 5/6/7/X, Hoka Mach 5/6/X, Asics Gel Nimbus 시리즈, Mizuno Morelia Neo 2/3/4.
