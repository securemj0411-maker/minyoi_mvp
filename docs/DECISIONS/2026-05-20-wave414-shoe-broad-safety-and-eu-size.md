# 2026-05-20 Wave414 — shoe broad safety and EU size hardening

## 배경

Wave413까지는 의류/BAPE 비교군을 집중적으로 좁혔다.
신발은 이미 공통 안전장치가 적용되어 있었다.

- scoreStage에서 fashion 전체(`shoe`/`bag`/`clothing`) raw SKU를 current catalog로 재검증한다.
- shoe category는 기본적으로 internal-only라 category ready를 상속하지 않는다.
- shoe 본품 SKU가 의류/가방 키워드 매물에 잡히면 catalog 단계에서 reject한다.

하지만 dirty queue 샘플을 보면 luxury shoe broad가 아직 내부 분석 대상으로 많이 잡혔다.
특히 `프라다 다운타운 스니커즈`가 bare `다운` noise 때문에 current catalog에서 reject되고, 명품 신발 EU 사이즈(`[40]`, `40.5사이즈`, `42.5 /`)가 unknown size로 남는 문제가 있었다.

## 결정

- shoe mismatch noise의 bare `다운`을 제거했다.
  - 기존: `다운` 토큰 하나로 Prada Downtown 같은 정상 신발명까지 reject.
  - 변경: `다운자켓`, `다운 패딩`, `다운 베스트`, `패딩 베스트` 같은 compound clothing terms만 차단한다.
- luxury shoe accessory-only 매칭을 더 줄였다.
  - `신발상자`, `신발 박스`, `슈박스`, `shoe box`, `박스 세트`, `더스트백 셋트` 등을 high-end shoe broad noise에 추가했다.
  - `구찌신발상자 + 더스트백 셋트`가 `shoe-gucci-broad`로 잡히지 않게 했다.
- shoe parser version을 `wave92-shoe-v11`로 bump했다.
- EU 사이즈 파서를 보강했다.
  - 기존: `EU 38`처럼 prefix 있는 정수 위주.
  - 변경: `[40]`, `[40.5사이즈]`, `[37.5사이즈]`, `42.5 / ... 스니커즈`, `... 스니커즈 43` 같은 명품 신발 실매물 패턴을 보수적으로 파싱한다.
  - bare `39 닥터마틴 ...` 같은 prefix 없는 단독 숫자는 계속 차단한다.

## 검증

- `Prada Downtown sneaker is not rejected by bare down/down jacket noise`
  - `급처! 정품 프라다 다운타운 스니커즈` → `shoe-prada-broad`
- `shoe box + dustbag accessory set does not match Gucci shoe broad`
  - `구찌신발상자 + 더스트백 셋트` → `shoe-gucci-broad` 아님
- `Louis Vuitton bootcut denim is not a shoe despite boot substring`
  - `루이비통 패턴 플레어 부츠컷 데님` → shoe 아님
- EU size regression:
  - `[40] 에르메스 바운싱 스니커즈` → 250
  - `[40.5사이즈] 에르메스 H 부메랑 스니커즈` → 255
  - `[37.5사이즈] 프라다 브러쉬드 레더 스니커즈` → 240
  - `[풀구성] 42.5 / 에르메스 바운싱 스니커즈` → 270
  - `프라다 청키 스니커즈 베이지 43` → 275

## 실행 결과

- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave137-shoe-uk-size.test.ts tests/wave138-shoe-size-extension.test.ts tests/wave139-shoe-eu-us-size.test.ts`
  - pass: 226
  - fail: 0
- AI 비용 없이 score drain:
  - `PIPELINE_AI_REVIEW_TOP_N=0`
  - `AI_REVIEW_TOP_N=0`
  - `AI_L2_SHADOW_AUDIT_ENABLED=0`
- 최종 리포트:
  - active fashion pool rows: 47
  - clothing: 29
  - shoe: 10
  - bag: 8
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
  - cleanup candidateRows: 0
  - dirty fashion rows: 0

## 보류

- Prada/Hermes/Gucci/LV/Dior shoe broad는 아직 public pool release하지 않는다.
- 다음 shoe wave는 broad 안에서 반복적으로 나오는 안전한 모델명(예: Hermes Bouncing, Prada Downtown/Cloudbust/Monolith 등)을 샘플 purity 기준으로 narrow lane 후보화할지 검토한다.
- luxury shoe EU size mapping은 기존 Wave139 mapping을 유지했다. 브랜드별 실측 차이가 있을 수 있으므로 ±5mm 오차는 허용하고, public release는 narrow model purity를 먼저 본다.
