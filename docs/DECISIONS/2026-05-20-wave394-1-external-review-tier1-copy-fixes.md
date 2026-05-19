# Wave 394.1 — 외부 review Tier 1 카피 정정 7개

날짜: 2026-05-20
영역: pack-reveal-modal (매물 상세 모달) + buy-price-guidance (verdict 라벨)
원본: 외부 사업 검토 리뷰 (사용자 메시지 paste)

## 배경

외부 리뷰어가 매물 상세 모달을 23개 항목으로 비판. 사용자가 "이거 보고 개소리는 빼고 받아들일수있는건 하자" 지시. 23개 분류 (스킵 3 / 부분수용 13 / 무조건수용 7) 후 **Tier 1 무조건수용 7개 카피 정정 일괄 박음**.

- 23 항목 중 #3 (sample 시세 매물), #23 (초보/상세 모드) 는 사용자 명시 채택 — Tier 4 큰 작업.

## Tier 1 정정 (이번 wave)

| # | 항목 | 정정 위치 | 정정 내용 |
|---|---|---|---|
| **#6** | CTA 문구 의미 불명확 | `pack-reveal-modal.tsx` L3087 | "번개장터에서 확인하기" → "번개장터 원본 매물 보기" |
| **#9** | 정품 단정형 ("정품 확인") | `pack-reveal-modal.tsx` L1980-1983 (upperHeaderByCategory) | bag/perfume/watch/clothing 헤더 "정품 확인" → "정품 확인 필요". 능동형 ("구매 전 점검", "기기 점검")은 그대로 |
| **#12** | 그래프 표본 부족 시 list | `market-history-chart.tsx` | **변경 X** — 이미 thin history 처리 (L141, L156, L185, L239-243). data.length < 2 fallback + thin history (< 7일) 배너 + confidenceBadge. 추가 변경 불필요 |
| **#15** | 가격 만원 단위 단순화 | `pack-reveal-modal.tsx` L2508, L2520 (협상 가이드 위험/손해) | `{krw(value)} 이상에 사면` → `약 {(value/10000).toFixed(1)}만원 이상에 사면` — 1자리 소수로 정밀도 유지. 매입가/협상가는 정확 숫자 유지 (실행 가격) |
| **#17** | 비용 1줄에 다 박음 | `pack-reveal-modal.tsx` L2393-2398 (rows value) + L2441 (className) | `value` 문자열 `\n` 줄바꿈 + `whitespace-pre-line` className 추가. "되팔 때 빠지는 돈" 3행 (안전결제 / 재배송비 / 안전버퍼) |
| **#19** | "실시간 근거" 과장 | `pack-reveal-modal.tsx` L2805 (chip) + L2627 (loading text) | "실시간 근거" → "최신 수집 기준". "번개장터 실시간 검증" → "번개장터 최신 호가". 표본 부족 / 호가 추정인데 "실시간"이라 신뢰 역효과 |
| **#22** | 단정형 → 조건부 | `buy-price-guidance.ts` L52-53 (verdict great) | "충분한 차익 · 협상 없어도 OK" → "차익 충분 · 현재 데이터 기준". sub "차익이 충분해서 그대로 사도 안전" → "현재 시세 기준 차익 충분. 매입 전 사진/증빙 재확인" |

## 분류 표 (전체 23개)

### 스킵 (3개) — 우리 사업 안 맞음
- **#2** 100점 점수 분해 — 우리 점수 시스템 없음
- **#16** 화면 분리 — 우리 단일 모달 일반인 친화 (memory 룰)

### 부분 수용 (13개) — 우리식 적용 필요 (Tier 2~3)
- **#1** 첫 화면 압축 — UpperFold 강화
- **#4** 모델별 가품 체크포인트 — 브랜드별 (Tier 4)
- **#5** 하단 CTA 작게
- **#7** 정보 순서 재정렬
- **#8** FAQ → 리스크 카드
- **#10** ConditionChip 근거
- **#13** 채널 리스크 chip
- **#14** 협상가 산출식
- **#18** 색상 의미 일관성
- **#20** 사진 분석 한계 명시
- **#21** /me 추천 매물 비교 이유
- **#24** 패스 조건 명시
- **#7번 (계절성)** 데이터 쌓이면

### 무조건 수용 (7개) — 이번 wave 394.1 (이상)

### 사용자 명시 채택 (2개) — Tier 4 큰 작업
- **#3** sample 시세 매물 노출 (USP 정면 강화)
- **#23** 초보/상세 모드 토글 (메모리 일반인 친화 단일 톤과 충돌하지만 사용자 결정)

## 검증

- TypeScript: `npx tsc --noEmit` — 우리 변경 (buy-price-guidance.ts, pack-reveal-modal.tsx) 에러 0개.
- src/ pre-existing 에러 3개 — 우리 변경 무관 (별도 fix 후보):
  - `src/app/api/packs/pool/route.ts:354` — `first_seen_at` 컬럼 미정의
  - `src/components/user-reveal-dashboard.tsx:350` — RevealItem type 불일치
  - `src/lib/rematch-helpers.ts:116` — `status` 컬럼 type 누락

## 영향

- 모든 매물 reveal 모달 (pack-reveal-modal, user-reveal-dashboard 호출 chain) — buyPriceGuidance verdictLabel 변경은 admin-pool-browser + user-reveal-dashboard + pack-reveal-modal 3화면 자동 적용.
- 일반인 친화 톤 + 방어적 카피 (review #22 핵심).

## 후속 (별 wave)

- **Wave 394.2** Tier 2 (CTA 사이즈, 색상 일관성)
- **Wave 394.3** Tier 3 (정보 구조 재정렬, ConditionChip 근거, 채널 리스크, 협상가 근거 등)
- **Wave 394.4** #3 sample 시세 매물 노출 ⭐ (USP 정면)
- **Wave 394.5** #23 초보/상세 모드 토글
- **Wave 394.B** 옵션 1 fashion conditionFromText (점진 rollout shoe→bag→clothing)
- **Pre-existing TS fix** src/ 3 에러 별도 cleanup

## 원칙

- 일반인 친화 단일 톤 (memory 룰 `project_core_principle_consumer_friendly`)
- 사이트 USP (band-aware 시세 비교) 강조 — Wave 393 부터 적용 중
- 외부 review 채택 시 우리 사이트 핵심 가치와 충돌 항목 스킵 (사용자 검토 통과)
- 3화면 일관성 (admin-pool-browser + pack-reveal-modal + user-reveal-dashboard) — buy-price-guidance 라이브러리 변경으로 자동 적용
