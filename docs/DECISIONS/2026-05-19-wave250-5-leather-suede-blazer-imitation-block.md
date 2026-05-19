# Wave 250.5 — leather-suede narrow blazer/style imitation block

- date: 2026-05-19
- type: catalog mustNotContain 보강 (additive — outlier 매물 차단)
- scope:
  - `clothing-polo-rrl-jacket-leather-suede` mustNotContain 보강
  - `clothing-polo-rrl-shirt-leather-suede` mustNotContain 보강 (consistency)
- branch: `fix/market-chart-honesty-2026-05-19`

## 배경

Wave 250 (RRL leather/suede narrow split) 측정 검증 중 발견된 catalog gap.

### Production sample (2026-05-19, 14일 active)

```
clothing-polo-rrl-jacket-leather-suede  n=26  p50 ₩2.68M  CV 0.40  min ₩180k  max ₩3.05M
```

- 평균 가격대는 narrow 의도 (avg ₩2.46M) 와 맞음.
- 그러나 **minimum ₩180k** 가 의심스러워 outlier 확인.

### 발견된 잘못 매칭 (2건)

```sql
SELECT pid, name, price FROM mvp_raw_listings
WHERE sku_id = 'clothing-polo-rrl-jacket-leather-suede'
  AND listing_state = 'active'
ORDER BY price ASC LIMIT 5;
```

| pid | name | price | 문제 |
|---|---|---|---|
| 406756050 | 폴로 랄프로렌 헤링본 **블레이저** 자켓 류준열 RRL 가죽 뉴스보이 | ₩180,000 | blazer (jacket-coat narrow 로 가야) |
| 404563540 | **rrl스타일** 가죽자켓 3xl (105) | ₩220,000 | imitation (정품 RRL 아님 — 가짜 brand) |

## 원인 분석

### 1. 블레이저 (pid 406756050)

- leather-suede mustContain: `RRL × (가죽|leather|suede|...|뉴스보이|...)` → 매물 "RRL 가죽 뉴스보이" 가 둘 다 hit → match.
- mustNotContain 에 `블레이저`/`blazer` 누락 → 통과.
- 이 매물은 본질적으로 **블레이저** (소재가 leather 일 뿐) — jacket-coat narrow (`블레이저`/`blazer` 가 mustContain 에 있음) 으로 routing 되는 게 맞음.

### 2. "rrl스타일" no-space variant (pid 404563540)

- normalize 함수 (`text.replace(/[^0-9a-z가-힣]+/g, " ")`) 는 한글 token 보존.
- 입력 "rrl스타일" → normalized " rrl스타일 ".
- 기존 mustNotContain `"rrl 스타일"` (공백 포함) → " rrl 스타일 " — `includes(" rrl 스타일 ")` 시 " rrl스타일 " 안에 없음 → bypass.
- 결과: 정품 RRL 가 아닌 imitation 매물 (셀러 의도적으로 "rrl스타일" 표기) 이 정품 narrow lane 통과.
- 동일 패턴 GLOBAL_FASHION_NOISE `"무드"` 단독은 잡히지만 (substring), `"스타일"` 단독은 GLOBAL 에 없음 (false positive 위험: 정상 "스타일" 매물).
  → narrow lane 별 명시 `"rrl스타일"` 추가가 안전.

## 결정

### 1. `clothing-polo-rrl-jacket-leather-suede` mustNotContain 보강

추가 키워드:
- `"rrl스타일"`, `"rrl무드"` (공백 없는 변형)
- `"블레이저"`, `"blazer"` (jacket-coat narrow 로 routing — 블레이저 의 본질은 자켓-코트)

### 2. `clothing-polo-rrl-shirt-leather-suede` mustNotContain 보강 (consistency)

기존엔 블레이저/blazer 박혀 있음. "rrl 스타일"/"rrl 무드" 공백 변형만 박혀 있어서 동일하게 no-space 변형 추가:
- `"rrl스타일"`, `"rrl무드"`

## 영향 (additive only)

- 잘못 매칭된 pid 2건 → rematch 후 leather-suede narrow 에서 제외.
- pid 406756050 (블레이저) → jacket-coat narrow 도 차단 (Wave 250 에서 leather/suede 제외 박음). 두 narrow 다 매칭 X → broad RRL 로 fallback (가격 ₩180k 라 broad p50 와 큰 충돌 없음).
- pid 404563540 (rrl스타일) → 정품 RRL narrow 전부 차단 → broad RRL 도 차단 (GLOBAL_FASHION_NOISE `"무드"` substring 가 "스타일" 안 잡지만 별도 wave 검토 가능).
- 정상 leather-suede 매물 (러프아웃/시얼링/뉴스보이/G-1/모토) 영향 X.
- 측정 결과 (CV 0.40, p50 ₩2.68M) 는 narrow 의도 부합 — Wave 250 catalog split 효과 확인됨.

## 검증

- `npx tsc --noEmit -p .` → `src/lib/catalog.ts` 0 error (테스트 파일 pre-existing TS 에러는 무관).
- `npx tsx --test tests/core-rules.test.ts tests/wave130-condition-class.test.ts tests/wave148-ad-listing-block.test.ts tests/wave182-new-skus-parser.test.ts tests/wave207-earphone-single-side-block.test.ts tests/wave247-2-band-aware-pool-median.test.ts tests/wave249-pool-builder-clamp-fix.test.ts` → 256 pass / 0 fail.
- runtime 검증 (`ruleMatch` 직접 호출):
  - pid 406756050 (블레이저 + 가죽) → `null` (의도대로 leather-suede 차단, jacket-coat 도 가죽 차단 으로 둘 다 reject) PASS
  - pid 404563540 ("rrl스타일") → `null` (의도대로 leather-suede 차단) PASS
  - 정품 sample "더블알엘 RRL 러프아웃 스웨이드 자켓 시얼링" → `clothing-polo-rrl-jacket-leather-suede` (영향 없음 확인) PASS

## CV 측정 — 다른 SKU (참고)

```
sku_id                                      n    p50         CV    range
clothing-polo-rrl-jacket-leather-suede     26   ₩2.68M       0.40  ₩180k ~ ₩3.05M  ← Wave 250 narrow 의도 부합
clothing-polo-rrl-shirt                    31   ₩280k        0.42  ₩80k ~ ₩454k    ← Wave 247.1/250 split 효과
clothing-polo-rrl-pants                    13   ₩280k        0.40  ₩120k ~ ₩550k   ← Wave 247.1/250 split 효과
clothing-polo-rrl-knit                     17   ₩350k        0.63  ₩98k ~ ₩1.1M    ← 신설 narrow (Wave 250)
clothing-polo-rrl-shirt-pants (catch-all)  78   ₩357k        0.84  ₩13k ~ ₩2.15M   ← 아직 rematch 안 됨 (post-rematch 검증 필요)
clothing-polo-rrl-jacket-coat              49   ₩840k        0.82  ₩137k ~ ₩4.4M   ← 아직 rematch 안 됨
clothing-fog-essentials-shorts             21   ₩79k         0.81  ₩30k ~ ₩399k    ← 아직 rematch 안 됨
watch-casio-gshock-gmwb5000                26   ₩390k        0.97  ₩7,777 ~ ₩2.35M ← 아직 rematch 안 됨 (PG-9 outlier 잔존)
dji-mini-3-pro                              8   ₩193k        1.12  ₩20k ~ ₩1.35M   ← 아직 rematch 안 됨 (배터리/프롭/조정기 잔존)
dyson-airwrap-hs05                         37   ₩370k        1.41  ₩20k ~ ₩3.9M    ← 아직 rematch 안 됨 (한정판 ₩3.9M 잔존)
```

**관찰**: Wave 250 / 250.4 catalog 보강은 commit 됐지만 production listing 들은 아직 rematch 안 됨 (catalog 변경 X 시점 매칭). 다음 reparse 사이클 후 CV 측정 다시 필요 (별도 wave 가능 — sweep cron 결과 기다림).

## 참고

- Wave 250 (RRL leather/suede narrow split 신설)
- Wave 245 (RRL narrow split 1차)
- Wave 230 (GLOBAL_FASHION_NOISE 도입 — "무드"/"스타일 매물" weak signal)
- 사용자 정책 (memory: feedback_proceed_on_clear_wins — 명백한 버그 fix 자율 진행, feedback_decision_log_required — decision log 박기)
