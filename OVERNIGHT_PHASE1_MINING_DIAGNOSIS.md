# OVERNIGHT_PHASE1_MINING_DIAGNOSIS.md

> 작성: 2026-05-14 (overnight session)  
> 측정 기반: parse_summary.json + samples.json 직접 확인 (rejected 10건 spot check 포함)

---

## 1. beats_solo_4 — 라벨: **(a) mining 보강 가능**

**측정값**  
- fetched 111 / parse_ready 15 / rejected 96 → 통과율 **13.5%**  
- Top reject: missing_솔로4 (62), wrong_model_solo3 (51), price_too_low (40), **price_too_high (29)**

**spot check (rejected 10건)**  
- TheSoloist 스웨트셔츠 (무관 아이템): 정당한 reject  
- Solo3 아이템 다수: 정당한 reject  
- **Jennie Special Edition 솔로4 29건: price_too_high로 reject되었으나 실제 Solo 4 정품 (310k~600k)** → 이것이 핵심 false reject

**진단**  
price_range_krw 상한 280,000원이 너무 낮다. 비츠 솔로4 제니 스페셜 에디션(BLACKPINK 제니 콜라보)은 공식 Solo 4 제품이며 번개장터에서 310k~400k에 유통 중. 가격 상한을 400k로 올리면 ~20건 추가 확보 가능. parse_ready=15이지만 complete 100%이므로 표본 30~50건 달성이 목표.

**제안 변경 (텍스트, 코드 변경 X)**  
- `price_range_krw` 상한: 280,000 → **400,000** (Jennie edition 커버)  
- query 추가: `"비츠 솔로4 제니"`, `"beats solo 4 jennie"` (제니 에디션 타겟팅)  
- reject_rules: `reject_non_beats_clone` 패턴 유지 (정품 제니 에디션과 짝퉁 구분 가능)  
- 잘못 reject 건: **29건 / 10건 중 7건** (Jennie Edition) → false reject 다수

---

## 2. ipad_pro_13_m2_256_wifi — 라벨: **(b) 시장 자체 적음 → AI L2 후보**

**측정값**  
- fetched 95 / parse_ready 11 / rejected 84 → 통과율 **11.6%**  
- Top reject: missing_13인치 (58), missing_256 (50), missing_m2 (35), reject_ipad_air_or_mini (29), reject_cellular (28), wrong_storage_128 (23)

**spot check (rejected 10건)**  
- iPad Air 13 M2 항목 다수: iPad Air ≠ iPad Pro이므로 정당한 reject  
- 매입/구매 게시글 다수: 정당한 reject  
- 셀룰러 변형 iPad Pro 13 M2: 올바른 기기지만 연결성 다름 → 정당한 reject  
- 잘못 reject 건: **0건 / 10건**

**진단**  
parse_ready 11건 모두 애플펜슬·매직키보드 번들 포함 풀세트 위주. 순수 Wi-Fi 단독 256GB 13인치 M2 iPad Pro 목록이 번개장터에서 매우 희소. 쿼리는 충분히 정밀하며 reject 규칙도 정당. query 변형(6세대, 2022년형 등) 추가해도 실제 market size가 한계. re-mining 효과 ≤ 5건 추정.

**결론**: AI L2 후보로 마킹. 결정론 patch 추가 시도 금지. 표본 부족으로 정확도 측정 불가.

---

## 3. iphone_12_pro_128gb_self — 라벨: **(b) 시장 자체 적음 → AI L2 후보**

**측정값**  
- fetched 202 / parse_ready 3 / rejected 199 → 통과율 **1.5%**  
- Top reject: missing_12프로 (194!), price_too_high (113), wrong_storage_512 (96), wrong_model_pro_max (54), carrier_locked (25)

**spot check (rejected 10건)**  
- "Gemini Pro 구독권": 쿼리 오염 (비관련 아이템) → 정당한 reject  
- "아이폰16 프로 128GB 자급제": 잘못된 모델 → 정당한 reject  
- "매입 중고폰" 게시글 다수: 정당한 reject  
- 아이폰 14/15/16 Pro 항목 다수: 모델 틀림 → 정당한 reject  
- 잘못 reject 건: **0건 / 10건**

**진단**  
missing_12프로 194건 = 쿼리가 관련 없는 아이템을 대거 수집하는 구조 오염. acceptAll `아이폰\s*12\s*(?:프로|pro)` 자체는 정확하나 번개장터 검색이 "아이폰"+"자급제" 유사 키워드로 무관 상품을 반환하고 있음. 아이폰 12 Pro는 2020년 출시 모델로 자급제 명시 중고 시장이 크게 축소됨. fetched=202에서 parse_ready=3은 시장 자체의 한계.

**결론**: AI L2 후보. 결정론 추가 없음. 자급제 명시 iPhone 12 Pro 자체가 감소 추세.

---

## 4. iphone_13_pro_128gb_self — 라벨: **(b) 시장 자체 적음 → AI L2 후보**

**측정값**  
- fetched 60 / parse_ready 6 / rejected 54 → 통과율 **10.0%**  
- Top reject: missing_13프로 (35), carrier_locked (20), wrong_storage_256 (18), price_too_low (16), wrong_model_pro_max (12)

**spot check (rejected 10건)**  
- 캐리어 약정 아이폰 13 Pro: 자급제 아님 → 정당한 reject  
- "아이폰13 리퍼폰": refurbished → 정당한 reject  
- "[자급제, 풀박] 아이폰 13 Pro 시에라 블루 128gb": price_too_low 및 missing 패턴 → 가격 범위(350k+) 미달. 실제로는 128GB 자급제이나 가격이 350k 이하라 reject.  
- 잘못 reject 건: **1건 / 10건** (저가 자급제 아이폰 13 Pro)

**진단**  
fetched=60이 매우 낮음 — queries 4개 × 10페이지임에도 충분히 수집 안 됨. 자급제 명시 iPhone 13 Pro 128GB가 번개장터에서 감소 중. 12 Pro와 동일한 구조적 한계. 6건 parse_ready는 측정 기반 분류를 어렵게 만드는 수준.

**결론**: AI L2 후보. 자급제 명시 표본이 시장에서 희소. re-mining 효과 ≤ 3건.

---

## 5. lg_gram_17_2024 — 라벨: **(a) mining 보강 가능** (단, 효과 제한적)

**측정값**  
- fetched 305 / parse_ready 5 / rejected 300 → 통과율 **1.6%**  
- Top reject: missing_2024/세대/ultra (268), price_too_low (177), wrong_storage_256 (101), wrong_ram_8gb (72), **missing_lg그램 패턴 (63)**, missing_17인치 (42)

**spot check (rejected 10건)**  
- "LG 2024 그램17 노트북 17Z90S 판매합니다": **false reject** — `missing_lg그램` 패턴 실패. `lg\s*그램` 정규식이 "LG 2024 그램17"을 못 잡음 (year가 LG와 그램 사이에 있음). 단, 동시에 `wrong_storage_256`도 발동 → 스토리지가 틀려 어차피 reject됨.  
- "LG전자 그램 16": `lg전자 그램` 패턴 미매칭 → false reject 가능성. 단 16인치라 어차피 wrong_size.  
- "LG 2025 그램17 코어 ultra5": `lg\s*그램` 패턴 미매칭 → false reject. ultra5 있어 세대 조건 충족이지만 패턴 누락.
- 잘못 reject 건: **2~3건 / 10건** (패턴 이슈), 단 대부분 스토리지/사이즈 조건으로 이중 필터됨

**주의사항**: parse_ready 5건 중 `13세대` 항목이 있음 — LG Gram 17 13세대 Intel은 2023 모델(17Z90R)이 주류. accept_any_of에 `13\s*세대`가 포함되어 2023 모델이 2024 lane에 혼입 가능 → **정확도 리스크**. acceptAll fix 전 13세대 허용 여부 재검토 필요.

**제안 변경 (텍스트, 코드 변경 X)**  
- acceptAll 보강: `lg\s*그램` → `lg\s*(?:\d{4}\s*)?그램|lg전자\s*그램` 추가  
- query 추가: `"LG그램 17Z90S"`, `"LG그램 17Z90T"` (2024 모델 넘버 직접 타겟팅)  
- accept_any_of 재검토: `13\s*세대` 제거하고 `14\s*세대|ultra\s*7|ultra\s*5|2024`만 유지 (2023 모델 혼입 차단)  
- 예상 효과: +3~8건. 근본 시장 희소성은 여전히 존재.

---

## 요약 테이블

| lane | fetched | parse_ready | 통과율 | false reject (10건 중) | 라벨 | 권고 |
|---|---:|---:|---:|---:|---|---|
| beats_solo_4 | 111 | 15 | 13.5% | 7건 (Jennie 에디션) | **(a) 보강 가능** | 가격 상한 280k→400k + Jennie query 추가 |
| ipad_pro_13_m2_256_wifi | 95 | 11 | 11.6% | 0건 | **(b) AI L2 후보** | re-mining 효과 ≤5건, 시장 자체 희소 |
| iphone_12_pro_128gb_self | 202 | 3 | 1.5% | 0건 | **(b) AI L2 후보** | 구형 모델 + 자급제 시장 감소 |
| iphone_13_pro_128gb_self | 60 | 6 | 10.0% | 1건 (저가 정품) | **(b) AI L2 후보** | fetched 자체 부족, 자급제 희소 |
| lg_gram_17_2024 | 305 | 5 | 1.6% | 2~3건 (패턴 이슈) | **(a) 보강 가능** | acceptAll 패턴 보강 + 모델번호 query, 단 13세대 false positive 정리 병행 |

> beats_solo_4는 Jennie Edition 가격 상한 완화로 즉시 표본 +20건 가능.  
> lg_gram_17_2024는 acceptAll 패턴 수정으로 +3~8건이지만 13세대 혼입 리스크를 먼저 정리해야 실질 개선.  
> iphone 12/13 Pro와 iPad Pro 13 M2는 AI L2 후보로 전환 — 결정론 추가 patch 불필요.
