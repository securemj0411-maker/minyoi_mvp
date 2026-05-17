# 2026-05-17 Master Plan — 보류 항목 (AI Advisor + Pool 부족 alarm)

## 컨텍스트

7-Layer ground truth 보고서 + Retention 6 메커니즘 보고서 + 비판 반박 보고서를 미뇨이 현실에 매핑한 master plan 수립 (방금 위에 정리). 사용자가 그 중 다음 두 항목을 명시적으로 **당분간 보류**.

## 보류 1: AI Advisor Chat

### 무엇이었나
매물 detail에 "살만해?" 버튼 → LLM 챗봇이 매물 데이터 + 사용자 누적 패턴 + 카테고리 시장 상황 결합해서 결정 + 근거 + 개인 history 답변.

예시:
> "이 매물 분석:
> - 가격: 시세 -23% (떡상점수 67)
> - 위험: 배터리 효율% 미공개 (중간)
> - 비슷한 매물 회전: 2.8일
> - 회원님 이전 패턴: 비슷한 가격대 11/13건 성공
> 추천: 매수. 단 셀러에게 배터리% 먼저 확인."

### 보류 이유
- LLM 호출 비용 burn (사용자 1000명 × 일일 3회 = 일일 3,000콜) — 정책 결정 필요
- 사용자 측 "LLM 호출 비용이 뭔지 모르겠음" 응답 → 비용 모델 학습 + 사용자 segment 확정 후 재논의
- Phase 0 (L4 가시화) + Phase 1 다른 항목 (L6 liquidity 곡선, Personalization) 먼저 박은 뒤 PMF 신호 확인하고 들어가기로

### 재개 조건
- (a) 무료/유료 segment 비용 정책 결정
- (b) L4/L6 박힌 뒤 retention 측정 결과
- (c) Phase 0 끝나고 사용자가 명시적으로 박기 요청

## 보류 2: Pool 부족 alarm

### 무엇이었나
- cron + `SELECT COUNT(*) FROM mvp_candidate_pool WHERE status = 'ready'`
- < 100이면 slack/카톡 ping
- < 50이면 긴급 ping + 자동 threshold -5점 (옵션)

### 보류 이유
- 사용자 응답: "당분간 모니터링만"
- 이미 박은 완충 layer로 1000명까지 OK 추정:
  - pool max_exposure 1 → 5 (5배 효율)
  - welcome 5 매물 (신규 이탈 차단)
- 실제 부족 신호 보고 결정 — 선제 alarm 인프라보다 사용자 acquire 신호 먼저

### 재개 조건
- ready 풀 카운트가 사용자 일일 reveal 수요와 비교해서 충분치 않은 신호 확인
- 사용자 base 1000명 근접 or 일일 가입 50명+
- slack/카톡 채널 결정

## 진행 중 (별도 decision log)

- L4 Risk Score chip 가시화 — 5축 점수 + 3화면 wiring (admin-pool + pack-reveal + user-reveal-dashboard)
- 생활가전 sweep wave (report-only) — Wave 90 source 다양화 후보 검증

## 향후 Phase 0 잔여 (이번 달)

L4 끝나면 남은 즉시 가능 항목 (impact 순):
1. Saved Money Counter (loss aversion ×2.5, 데이터 다 있음, UI 1~2일)
2. Loss Recovery 가시화 + feedback 38건 분류
3. Daily Market Brief 봇 (채널 결정 필요)
4. PITR 박기 (시세 historical 보호, 비용 확인)
5. 에러 메시지 보안 audit wave

## Trade-off 명시

- AI Advisor 보류 = 단일 최강 retention 메커니즘 늦어짐. 단 비용 model 모르고 박으면 burn risk.
- Pool alarm 보류 = 풀 부족 사후 인지 risk. 단 이미 5배 + welcome 5로 완충, 1000명 base까진 OK 추정.
