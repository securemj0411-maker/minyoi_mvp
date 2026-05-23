# Wave 758-759 — 게임 + 골프 카테고리 deep sweep

**날짜**: 2026-05-24
**Owner**: Claude (사용자 명시 "골프 + 게임 둘 다 큰 미커버")
**Status**: Phase 1+2 완료, Phase 3 진행 중

## 배경
Wave 757 (AI audit hold release) 완료 후 사용자가 새 카테고리 발견 제안:
- 골프 클럽: 일평균 904건, uncovered 5,391, mass% 70%, 가품 risk 낮음, ⭐⭐
- 게임 (콘솔+타이틀): 일평균 658건, uncovered 4,401, mass% 80%+, 가품 risk 0, ⭐⭐⭐

게임 우선 시작 → 골프 (현재 진행 중).

## Wave 758 — 게임 카테고리 deep sweep

### 발견 (sample 분석 14일 9,463건 / 7,478 unmatched)

| 콘솔 | unmatched | match% | 문제 |
|------|-----------|--------|------|
| switch_v1 | 2,597 / 3,011 | 14% | 본체 SKU가 게임/액세서리 흡수 (시세 망가짐) |
| other (미분류) | 2,527 / 2,544 | 1% | 카테고리 미식별 |
| old_handheld (3DS/DS) | 940 / 949 | 1% | catalog 없음 |
| ps5 | 602 / 833 | 28% | 신상 매물 stale parse |
| ps4 | 566 / 570 | 1% | broad 작동 X (Wave 754 후) |
| switch_oled | 298 / 474 | 37% | 본체 패턴 일부만 |
| switch_2 | 335 / 375 | 11% | **catalog 없음** (2025 신상) |
| xbox | 77 / 77 | 0% | **catalog 없음** |
| steamdeck | 22 / 22 | 0% | **catalog 없음** |

### CRITICAL BUG (Switch v1)
Sample 분석 결과 switch-v1 본체 SKU가 **게임 카트리지/액세서리/케이블까지 흡수**:
- "닌텐도 스위치 마인크래프트 알칩" 25K → switch-v1 (게임!)
- "닌텐도 스위치 정품 HDMI 케이블" 15K → switch-v1 (케이블!)
- "닌텐도 스위치 본체 풀세트" 220K → switch-v1 (✅ 진짜 본체)

시세 평균 8만 vs 진짜 본체 22만. 차익 계산 다 잘못됨.

### Phase 1 (commit 7456b56) — Switch v1 fix + 콘솔 6 SKU 신설

#### switch-v1 mustNotContain 100+ 토큰 추가
- 게임 카트리지: 알칩/곽팩/디스크 단품/타이틀/스틸북
- 게임 TITLE: 마인크래프트/포켓몬/별의커비/제노블레이드/마리오/젤다/메트로이드/제로블레이드 등
- 액세서리: 프로콘/조이콘 정품/아미보/HDMI 케이블/충전독/스티어링 휠
- 옛 닌텐도: Wii/GBA/게임보이/SFC/슈퍼패미컴/패미콤/dsi
- 한정판 케이스 brand (SWEETCH/헬멧백)

#### 신설 SKU
- **switch-2** (msrp 480K, 2025-06): 335 unmatched 회수
- **xbox-series-x** (msrp 598K), **xbox-series-s** (msrp 398K), **xbox-one** (msrp 498K)
- **steamdeck-oled** (msrp 700K), **steamdeck-lcd** (msrp 400K)

category_readiness 6 entry 등록.

### Phase 2 (commit 91bc419) — PS5/PS4 broad fix

Wave 754에서 신설한 ps5-broad/ps4-broad가 매칭률 28%/1% — Switch v1 같은 bug.

mustNotContain 추가:
- 게임 TITLE: 콜오브듀티/콜옵/GTA/갓오브워/엘든링/사이버펑크/파판/원피스/스카이랜더스/라이덴 등
- 스틸북/스틸케이스/타이틀 일괄/한정판 게임/예약특전
- 액세서리: 펄스 3D 헤드셋/듀얼센스 2개/충전거치대/콘솔 커버
- 모드: goldhen/rebug (jailbreak)

### Phase 3 (보류 - 큰 작업)
- 게임 카트리지/타이틀 별도 카테고리 신설 (parser/comparable_key/시세 logic)
- 옛 콘솔 (Wii/GBA/DS/SFC) — 사용자 친화 ⭐ 낮음, skip

## Wave 759 — 골프 클럽 deep sweep (진행 중)

### Sweep 방법
Wave 266b 패턴 따라 — 번개장터 API 직접 호출:
- 115 queries (10 generic + 15 brands × 7 product types)
- 각 query × 2 pages (96 × 2 = 192건)
- 총 ~22K fetch potential (중복 dedupe 후 ~5-10K unique)

### Search queries
- Generic: 골프 드라이버/아이언/우드/퍼터/웨지/하이브리드/클럽 세트/하프 세트/풀세트/골프 클럽
- Brand: 캘러웨이/타이틀리스트/테일러메이드/PXG/핑/마제스티/혼마/미즈노 골프/스릭슨/브리지스톤 골프/젝시오/오노프/스코티 카메론/오디세이/코브라 골프
- Product type: 드라이버/아이언/우드/퍼터/웨지/하이브리드/클럽 세트

### Output
`docs/AUDIT_LOG/wave759-golf-club-sweep-{timestamp}.json`
- byBrand 분포
- byProductType 분포
- byMatchedSku (어떤 catalog에 흡수되나)
- byPriceTier
- unmatchedSamplesByBrand (catalog 누락 패턴)
- matchedSamplesByBrand (catalog 매칭 검증)

다음 단계 (sweep 결과 후):
- brand 별 SKU 신설 (캘러웨이 드라이버/아이언, PXG 풀세트, 마제스티 등)
- 일반인 표현/은어 catalog 박기
- category_readiness 등록

## Pareto 누계 (이번 session)
- Wave 727-754: 55+ 신규 SKU + bias-free
- Wave 755-757b: pool ready % fix (band threshold sync + AI verdict 완화)
- Wave 758: 게임 콘솔 6 SKU + Switch v1 fix
- Wave 759: 골프 클럽 신설 (진행 중)

## 남은 작업
- Wave 759 sweep 결과 분석 + SKU 신설
- Wave 758 Phase 3 (게임 카트리지 카테고리 신설) — 다음 cycle
- Wave 727-758 24-48h verification
