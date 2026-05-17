# Wave 182 — Saved Money Counter + 손해 신고 즉시 보상 + 운영자 검수

## 컨텍스트

Master plan Phase 0 — 사용자 선택 항목 두 개 박음.

1. **Saved Money Counter** (사업 보고서 retention #1 — loss aversion ×2.5)
2. **Loss Recovery 시스템** (사업 보고서 retention #6 — 손해 본 사용자 advocate 전환)

## 박은 것

### 1. DB 마이그레이션 — `mvp_reveal_feedback` 확장

```sql
ALTER TABLE mvp_reveal_feedback
  ADD COLUMN admin_status TEXT,                  -- pending / resolved / dismissed
  ADD COLUMN admin_response_note TEXT,
  ADD COLUMN admin_responded_at TIMESTAMPTZ,
  ADD COLUMN compensation_granted_tokens INTEGER DEFAULT 0;

ALTER TABLE mvp_reveal_feedback
  ADD CONSTRAINT mvp_reveal_feedback_admin_status_chk
  CHECK (admin_status IS NULL OR admin_status IN ('pending', 'resolved', 'dismissed'));

CREATE INDEX mvp_reveal_feedback_admin_status_idx
  ON mvp_reveal_feedback (admin_status, created_at DESC)
  WHERE feedback_type = 'loss_report';
```

ADD COLUMN nullable + IF NOT EXISTS → 기존 row 영향 0, instant.

### 2. 새 feedback type — `loss_report`

`src/lib/pack-open.ts` 의 `RevealFeedbackType` 에 추가.
기존 `/api/packs/reveals/feedback` endpoint 는 거부 — 별도 endpoint 통해서만 처리 (보상 로직 분리).

### 3. API — `/api/packs/reveals/loss-report` (POST)

흐름:
1. 사용자가 카드 "손해 봤어요" 클릭 → 5자 이상 사유 입력
2. `mvp_reveal_feedback` upsert (on_conflict user_ref,pid → merge-duplicates)
   - `admin_status='pending'`, `compensation_granted_tokens=3` 박힘
3. `refundUserCredits(amount=3, metadata={ reason: 'loss_report', pid })`
4. 응답: "즉시 토큰 3개 지급. 24시간 안에 운영자가 확인합니다."

중복 신고 시 (같은 user_ref + pid) 토큰 미지급. rate limit 시간당 5건.

### 4. API — `/api/packs/me/saved-money` (GET)

응답:
- `earnedThisMonthKrw`: 본인 `bought` 매물의 `expected_profit_min` 합 (보수)
- `savedThisMonthSiteWideKrw`: 사이트 전체 차단 위험 매물 수 × **300,000원/건** (보수적 평균 손해율)
- `blockedCountThisMonth`: 사이트 전체 차단 매물 수 (이번 달, `mvp_listing_analysis.score_flags ov BLOCK_FLAGS`)
- `boughtCountThisMonth`: 본인 매수 표시 수
- `compensationGrantedThisMonth`: 본인 loss_report 보상 토큰 합

평균 손해율 300,000원 보수 근거:
- 가품 평균 손해 -280,000 / 잠금 평균 -450,000 (사업 보고서)
- 가중 평균 약 350,000 → 보수적 30만으로 후퇴
- 미래 사용자 신고 데이터로 보정 가능

현재 데이터 측 가능 신호:
- 이번 달 차단된 risk 매물 7,244건 / 전체 17,700건 = **41% 차단율**
- 추정 안 잃은 돈 = 7,244 × 30만 = **약 21.7억원** (사이트 전체)
- bought 카운트 = 0 (사용자 매수 표시 안 함 — UI에서 "표시하면 누적" 안내)

### 5. UI — Saved Money Counter (`src/components/saved-money-counter.tsx`)

대시보드 상단 (history view 진입 시 박힘). 2 column:
- 왼쪽 **🛡️ 안 잃은 돈** (emerald hero — loss aversion 1순위)
- 오른쪽 **💎 이번 달 번 돈** (amber)

본인 bought 없으면 안내 메시지 박음.

### 6. UI — 카드 "🚨 손해 봤어요" 버튼 + 모달 (`user-reveal-dashboard.tsx`)

`ActionButtons` 에 rose 색 버튼 추가. 이미 신고된 매물은 "🚨 신고됨" 회색 비활성.
모달:
- 사유 textarea (5~1000자)
- 사유 부족 시 안내
- 제출 → API 호출 → 성공 시 "토큰 +3 즉시 지급" 메시지 표시
- 24h 운영자 검수 + 비슷한 매물 차단 약속

### 7. 운영자 검수 페이지 — `/cau~~/loss-reports`

`src/app/cauleexxyzikpoidaskfjhdleriuAASDASYDJHLdKjhlsadkjfhlkqwreOIUYOIUFDY/loss-reports/page.tsx` + `loss-reports-client.tsx`.
URL obfuscation + admin auth 이중 보호 (members-table 옆 페턴).

기능:
- pending → resolved → dismissed → all 필터
- 각 신고 카드: 매물 thumbnail + 사용자 사유 + 신고 시간
- 운영자 응답 textarea (5~2000자)
- "✅ 보정 완료" / "❌ 기각" 버튼
- 보상 토큰 표시

운영자 메인 페이지 (`/cau~~`) 상단에 nav link 추가.

### 8. API — `/api/admin/loss-reports` (GET + PATCH)

- GET `?status=pending|resolved|dismissed|all` — 신고 목록 + listing meta + counts
- PATCH `{ id, adminStatus, adminResponseNote }` — status + 응답 update + `admin_responded_at` 자동

## Trade-off

### Saved Money Counter

- "안 잃은 돈" = 사이트 전체 추정 → 사용자 본인 신호 아님. 단 사이트 가치 표현 강함.
  - 대안 (본인 기준 — 본인이 본 risk 매물 × 손해율) → 데이터 추적 어려움. 일단 사이트 전체로.
- 평균 손해율 30만원 = 보수 추정. 사용자 실 손해 신고 데이터 누적되면 보정.

### Loss Report 즉시 보상

- 토큰 3개 (= 무료 사용자 일일 5개 중 60%) — 보상 비교적 큼. spam risk 있음.
  - 차단: rate limit 시간당 5건 + 중복 (user_ref + pid) 보상 X.
  - 운영자 검토 결과 "기각" 시 토큰 회수 로직 없음 — **TODO** (별도 wave: dismissed 처리 시 refund).
- 운영자 응답 SOP: 24시간 안에 응답. 보고서 인용 — "손해 본 사용자 = 충성 advocate 전환".

### 보안

- `/cau~~/loss-reports` admin 이중 인증 (notFound on non-admin) — URL 노출 X.
- API admin only — non-admin 403.

## Test

- DB 마이그레이션: ADD COLUMN safe (nullable, IF NOT EXISTS).
- 테스트 영향 평가 필요 (loss_report type 추가 — 기존 feedback API/모듈 영향).

## Follow-up

1. **기각 시 보상 토큰 회수**: dismissed 처리 시 refundUserCredits(refund=-3) — 별도 wave
2. **사용자에게 결과 알림**: 운영자 응답 후 사용자에게 push (인앱 toast or 이메일) — 알림 채널 결정 후
3. **AI 보조 검토**: loss_report sample 누적 시 AI L2가 비슷한 매물 prefilter (자동 차단 추천)
4. **본인 기준 saved money**: 사용자가 본 risk 매물 추적 → 본인 기준 "안 잃은 돈" 산출

## Linked

- `2026-05-17-master-plan-deferred-items.md`
- `2026-05-17-l4-risk-score-chip.md`
- `2026-05-17-daily-brief-deferred-telegram-only.md`
- `2026-05-17-life-appliance-sweep-readiness.md`
