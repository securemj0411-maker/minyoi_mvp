# Wave 188 follow-up — production sweep FP 차단 강화 (2026-05-18)

## 배경

Wave 188 초기 (포토카드/굿즈/거치대/케이스만 등 30종 noise 92개 SKU spread) 직후 production sweep 재실행했더니 신규 카테고리 SKU 풀에서 다음 false positive rate 발견:

| SKU | sample | FP | rate |
|-----|--------|----|----|
| Dyson Supersonic HD08 | 26 | 12 | **65%** |
| Dyson Airwrap HS05 | 24 | 8 | **37%** |
| DJI Mini 4 Pro | 2 | 2 | **100%** |
| Dyson Corrale HS07 | 25 | 1 | 4% |
| Dyson Airwrap i.d. | 21 | 0 | 0% |

FP title 분석:
- HD08: "다이슨 슈퍼소닉 노즐 툴 세트" / "박보검 다이슨 슈퍼소닉 포토카드 2종"
- HS05: "다이슨 에어랩 스타일러 컴플리트 **HS01** 풀세트" (구형) / "휙 헤어스타일러 (다이슨 저렴이)"
- DJI Mini 4 Pro: "K&F DJI Mini 4 PRO 2in1 필터 키트" / "DJI 미니4 프로 ND16/64/256 필터 세트"

## 결정

3가지 layer 강화:

1. **WAVE188_NEW_CATEGORY_NOISE 상수 확장** — production sweep으로 발견한 신규 패턴 추가
   - 오타: `"포토카트"` (포토카드 오타)
   - 굿즈 변형: `"포카 2종"`, `"포카 세트"`, `"포토카드 2종"`
   - Dyson 슈퍼소닉 액세서리: `"노즐 툴"`, `"노즐 툴 세트"`, `"툴 세트"`, `"툴 키트"`, `"툴만"`
   - DJI 드론 필터: `"필터 키트"`, `"nd 필터"`, `"nd16/64/256"`, `"k&f"`, `"kf concept"`

2. **DRONE_FILTER_ACCESSORY_NOISE 신규 상수** — drone 공통 필터 액세서리 단품 차단
   ```ts
   const DRONE_FILTER_ACCESSORY_NOISE = [
     "필터만", "필터 단품", "렌즈 필터", "보호 필터", "uv 필터", "cpl", "2in1 필터", "필터 세트",
   ];
   ```
   → DJI 드론 9개 (Mini 2 / Mini 3 Pro / Mini 4 Pro / Mavic 3 / Mavic 3 Pro / Mavic 3 Classic / Air 2S / Air 3 / Air 3S / Avata) 일괄 spread.

3. **개별 SKU mustNotContain 보강**
   - **dyson-supersonic-hd08**: WAVE188 spread 추가 (기존 직접 박힌 30+ noise를 spread로 정리 — 일관성)
   - **dyson-airwrap-hs05**: `"hs01"`, `"hs02"`, `"hs03"`, `"hs04"` 구형 모델 차단 + WAVE188 spread.
     이유: HS05만 매칭되어야 하는데 "HS01 풀세트" 매물이 alias `에어랩 + 컴플리트 + 풀세트` 만족해서 통과.

## 영향 범위

- SKU 13개 강화 (Dyson 2 + DJI 9 + Avata 1 + 신규 공통 spread)
- mustNotContain 일관 정리 — WAVE188_NEW_CATEGORY_NOISE에 박힌 토큰을 SKU 직접 박는 대신 spread로 통일
- typecheck clean, test:core 437/438 (실패 1건 사전 wave159h, 무관)
- commit `d3cbd02`

## 다음 액션 (24h 후)

- production sweep 재실행 — Dyson HD08 / HS05 / DJI Mini 4 Pro FP rate 재측정
- 목표: 모두 **<10%**
- 신규 카테고리 매물 0건이던 Galaxy Book / 향수 / 가민 / 레고 / 킥보드는 매물 들어오면 재측정

## 정책 정합성

§12b "정확성 우선" 충족 — false positive 0 우선, recall loss 감수.
Wave 188 → 188 follow-up 흐름은 정상적 점진적 강화 (over-block 회피하면서 데이터 기반 hardening).
