# launch-104 — 신규유저 카피 정정 + 피드백 리뷰 /loss-reports 이전

**Date**: 2026-05-23
**Owner**: caulee
**Scope**: ExploreClient onboarding copy + cau admin feedback-panel brief + /loss-reports 풀 리뷰 + Bloomberg 톤

## 배경

launch-103에서 매물 신고 → cau 운영자 페이지(feedback-panel)에서 승인/거절하는 플로우를 박았는데, 사용자 피드백:

1. "오늘 볼 만한 **후보**만 남겼어요" — 가입 직후 신규유저한테 "후보"는 내부 용어. "중고 상품"이 자연스러움.
2. "**감당 가능한** 금액?" — 어색한 어투. "중고 상품 금액대는 어떤 게 좋아요?" 등으로 정정.
3. 피드백 검수 페이지 위치: cau 메인 패널은 **간단한 브리핑**만 보여주고 — 진짜 풀 리뷰(승인/거절 + 필터 + 상세)는 기존 `/loss-reports` 페이지(URL obfuscated cau 디렉토리 안)에서. cau 메인이 너무 빽빽해짐.
4. `/loss-reports` 페이지가 cau 메인은 Bloomberg 톤(검은 + amber)인데 혼자 light theme(`bg-[#f6f1e8]`) — 일관성 깨짐.

## 변경

### 1. ExploreClient 카피 정정 (신규유저 친화)

`src/components/explore-client.tsx` — 가입 직후 onboarding 4단계 문구:

- "후보" → "중고 상품" (전부)
- "추천 풀" → "중고 상품"
- "감당 가능한 금액" → "중고 상품 금액대는 어떤 게 좋아요?"

핵심 원칙(`project_core_principle_consumer_friendly`): 일반인 친화. 내부 용어(후보/풀) 노출 금지.

### 2. cau 메인 feedback-panel — brief 화

`src/app/cauleexxyz.../feedback-panel.tsx`:

- 기존: 전체 row 테이블 + 승인/거절 버튼
- 변경: **3-cell KPI 그리드** (PENDING / APPROVED 7d / REJECTED 7d) + **최근 3건 미리보기** + **"REVIEW ALL →" 링크** → `/loss-reports`

cau 메인은 "지금 뭐 처리해야 되는지" 한눈 파악만. 실제 처리 액션은 별도 페이지에서.

### 3. `/loss-reports`에 `FeedbackReviewFull` 마운트

신규 컴포넌트 `src/app/cauleexxyz.../loss-reports/feedback-review-full.tsx`:

- `/api/admin/feedback/list` + `/api/admin/feedback/decide` 그대로 사용 (launch-103과 동일 endpoint)
- 필터 칩: PENDING(default) / ALL / APPROVED / REJECTED
- row 클릭 → 확장 (user_ref, auth_user_id, item context, full message, decided_by, reward 정보)
- pending row 우측: APPROVE +20 / REJECT 버튼
- 10초 polling refresh

### 4. `/loss-reports` 페이지 Bloomberg 톤

`src/app/cauleexxyz.../loss-reports/page.tsx`:

- main: `bg-zinc-950 pt-12 font-mono text-zinc-200` (cau 메인과 통일)
- nav: 알록달록 pill → mono terminal 칩 (border-zinc-800 bg-zinc-900 amber-400)
- header: ▌ADMIN · feedback_reports eyebrow + amber
- `<FeedbackReviewFull />` 먼저 마운트 → 그 아래 legacy `<LossReportsClient />` (Wave 182 손해 신고 시스템 유지)

## 영향

- 신규 사용자: 첫 모달부터 "중고 상품" 용어로 친근감 ↑.
- 운영자: cau 메인 빽빽함 ↓ + 실제 검수는 `/loss-reports`에서 풀 컨텍스트로 처리.
- 기존 `/api/admin/feedback/*` endpoint 그대로 — DB 변경 없음.

## 검증

- TS check: pre-existing test errors만 (launch-104 파일 0 error).
- 로컬에서 신규 가입 → onboarding 카피 확인 + cau brief panel + /loss-reports 풀 리뷰 동선 확인 예정.

## 미해결

- legacy `LossReportsClient` (Wave 182 손해 신고 / feedback_reports table)는 light theme styling 일부 남아 있음 — 별도 wave에서 마이그레이션 결정 필요 (지금은 이미 mvp 단계라 손해 신고는 거의 안 들어옴, user_feedback 쪽이 메인).
