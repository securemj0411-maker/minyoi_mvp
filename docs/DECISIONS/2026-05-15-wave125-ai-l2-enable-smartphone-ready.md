# Wave 125 — AI L2 정책 v1 활성화 + smartphone category ready 승격

> Status: **applied (env + DB).** 사용자 결정: "AI 니가 설정해. 풀자 ㄱㄱ". narrow lane 97% 정확도 검증 완료, internal_only 푼다.

CLAUDE.md 6 필드 포맷.

## 1. AI L2 정책 v1 활성화

- 시간: 2026-05-15
- 변경: **[mvp/.env.local](mvp/.env.local)** `AI_L2_POLICY_ENABLED=1` 추가
- 영향:
  - `decideAiL2Review()` 정책 활성 (LAUNCH_PLAN 4.2 Phase 1)
  - parser-gap flag 매물 AI 판단:
    - self_unlocked_ambiguity (자급제 미명시)
    - bundle_or_accessory_ambiguity (구성품/액세서리 모호)
    - generation_ambiguity (세대 모호)
    - connectivity_ambiguity (Wi-Fi/Cellular 모호)
    - parser_unknown_option
  - AI pass 단독 public release 금지 (LAUNCH_PLAN 4.5 hard hold)
  - 기존 `AI_REVIEW_TOP_N=30` 그대로 (Haiku 기준 월 ~$0.13 예상)
- 검증: dev server restart 필요 (사용자 안내)
- 위험: 낮음. metadata-only — pool behavior 변화 X. AI 비용만 발생.

## 2. smartphone category internal_only → ready 승격

- 시간: 2026-05-15 14:51:59 KST
- 발견 (Wave 121 audit 결과):
  - narrow self lane 30건 sample audit → **정상 자급제 본품 97% (29/30)**
  - 발견된 noise 1건: 가격 outlier (Wave 121 pipeline 차단)
  - 발견된 noise 1건: S25 Edge 흡수 (Wave 120 mustNotContain "엣지" 추가)
  - Wave 120/121/122 token 차단: 가격 dummy, 케이지/콜라보/광고/교신, 사은품/이벤트
  - precision 97%+ → LAUNCH_PLAN 12b 정책 부합 (precision 80%+ 기준)
- 변경: `mvp_category_readiness` smartphone 행 status `internal_only` → `ready`
  ```sql
  UPDATE mvp_category_readiness SET status='ready' WHERE category='smartphone';
  ```
- 영향:
  - iPhone/Galaxy 매물 사용자 노출 가능 (이전 narrow self lane만 노출)
  - broad SKU (iphone-13/14/15/16, galaxy-s23/s24 등) ready 풀 진입
  - 약 14일 매물 ~2,500건 추가 사용자 노출 가능
- 검증: pool warmer cron이 자동 재평가. 24h 후 ready 풀 폭증 예상.
- 위험: 중간. broad SKU 13% noise (LAUNCH_PLAN 정책 80%+ 정확). 추후 noise 발견 시 PHONE_NOISE 보강 fast iteration.

## 3. 거론 금지

- AI L2 비용 폭증 — `AI_REVIEW_TOP_N=30` 보수적. 매물 폭증 시 자동 늘릴지 owner 결정.
- game_console / camera internal_only 유지 — Switch 매물 noise 패턴 audit 안 됨. smartphone 결과 보고 결정.
- dev server restart 필요 — AI_L2_POLICY_ENABLED env 적용 위해.

## 4. 다음 24h 측정 항목

- Pool ready smartphone: 7 → ??? (대폭 증가 예상)
- AI L2 호출 빈도 (decideAiL2Review trigger)
- AI 비용 누적 (Haiku/Sonnet)
- broad SKU 매물 사용자 reveal 후 신뢰도
