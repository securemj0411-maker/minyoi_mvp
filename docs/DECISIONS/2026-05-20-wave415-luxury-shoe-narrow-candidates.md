# 2026-05-20 Wave415 — luxury shoe broad narrow candidates

## 배경

Wave414 이후 shoe broad는 안전장치가 좋아졌지만, luxury shoe brand-broad는 여전히 비교군이 너무 넓다.
사용자 방향은 명확했다.

- 신발/의류를 무리하게 ready로 넓히지 않는다.
- broad 안에서 반복적으로 깨끗하게 잡히는 모델만 좁혀 간다.
- 비교매물에 다른 모델/다른 상품군이 섞일 가능성을 먼저 줄인다.

이번 wave에서는 `shoe-prada-broad`, `shoe-hermes-broad`, `shoe-gucci-broad`, `shoe-louisvuitton-broad`, `shoe-dior-broad` active/raw 샘플을 다시 봤다.

## 관찰

- luxury shoe 샘플 265건 중 반복 모델 후보:
  - `hermes_bouncing`: 15건
  - `lv_trainer`: 17건
  - `dior_b23`: 5건
  - `gucci_ace`: 4건
  - `dior_b30`: 3건
- `unknown_model`은 202건으로 너무 넓고 가격대도 6천원~250만원까지 벌어져서 유지하면 안 된다.
- `구찌 신발용 더스트백` 같은 accessory-only row가 아직 `shoe-gucci-broad`로 들어올 수 있었다.
- `LV 트레이너 데님 스니커즈`는 정상 신발인데 bare `데님` shoe mismatch noise 때문에 current catalog에서 reject될 수 있었다.

## 결정

- 아래 5개는 catalog narrow 후보로 추가했다.
  - `shoe-hermes-bouncing`
  - `shoe-louisvuitton-lv-trainer`
  - `shoe-gucci-ace`
  - `shoe-dior-b23`
  - `shoe-dior-b30`
- 단, `LANE_READINESS`에는 추가하지 않았다.
  - 즉 public pool ready가 아니라 internal-only 후보 상태다.
  - 실제 판매 화면 비교군으로 풀기 전에 sample purity를 따로 봐야 한다.
- 각 brand-broad는 새 narrow 모델명을 `mustNotContain`에 넣었다.
  - broad fallback과 narrow가 동시에 매칭되면 ambiguity로 drop되므로, narrow가 단독 매칭되게 분리했다.
- luxury shoe accessory-only noise를 보강했다.
  - `신발용 더스트백`, `신발 dustbag`, `신발상자`, `shoe box` 등.
- denim 소재 스니커즈는 허용했다.
  - `데님`/`denim`은 강한 shoe signal이 있을 때만 shoe mismatch 차단을 건너뛴다.
  - `루이비통 부츠컷 데님` 같은 의류성 매물은 계속 shoe로 들어오지 않는다.

## 검증

- narrow match:
  - `에르메스 바운싱 스니커즈 카프스킨 스웨이드 고트스킨 & 블랑` → `shoe-hermes-bouncing`
  - `[정품] 루이비통 LV 트레이너 데님 스니커즈 (8)` → `shoe-louisvuitton-lv-trainer`
  - `구찌 에이스 웹 스니커즈 빈티지 260` → `shoe-gucci-ace`
  - `디올 B23 오블리크 하이탑 스니커즈 신발 36사이즈 230 235` → `shoe-dior-b23`
  - `[S급/정품] 디올 B30 테크니컬 스니커즈 40` → `shoe-dior-b30`
- accessory / cross-category:
  - `구찌 신발용 더스트백 상태최상 정품 가로21세로39` → `shoe-gucci-broad` 아님
  - `루이비통 패턴 플레어 부츠컷 데님` → shoe 아님

## 실행 결과

- `npx tsx --test tests/core-rules.test.ts tests/wave254-5-fashion-condition.test.ts tests/fashion-catalog-regression.test.ts tests/wave254-6-product-type-priority.test.ts tests/wave137-shoe-uk-size.test.ts tests/wave138-shoe-size-extension.test.ts tests/wave139-shoe-eu-us-size.test.ts`
  - pass: 232
  - fail: 0
- AI 비용 없이 score drain:
  - `PIPELINE_AI_REVIEW_TOP_N=0`
  - `AI_REVIEW_TOP_N=0`
  - `AI_L2_SHADOW_AUDIT_ENABLED=0`
  - scored: 795
  - poolUpserted: 32
  - poolSkipped: 763
  - dirty cleared rows: 800
- pool cleanup:
  - stale `bape_tee` gate-blocked pool row 1건 invalidated
- 최종 리포트:
  - active fashion pool rows: 46
  - clothing: 28
  - shoe: 10
  - bag: 8
  - gate-blocked rows: 0
  - flagged rows: 0
  - actionable rows: 0
  - cleanup candidateRows: 0
  - dirty fashion rows: 0

## 보류

- luxury shoe narrow 후보 5개는 아직 public ready로 풀지 않는다.
- Prada broad 내부 모델(`Downtown`, `Cloudbust`, `Monolith` 등)은 이번 wave에서 narrow로 만들지 않았다.
  - 반복 수/price spread/sample purity를 더 봐야 한다.
- `unknown_model` luxury shoe broad는 internal-only fallback으로만 유지한다.
  - 가격 비교군/사용자 노출에 직접 쓰기에는 너무 넓다.
