# 2026-05-17 손해 신고 → 부정확 정보 신고 framing pivot

## 사용자 보고 & 의도

- 시간: 2026-05-17
- 보고: "야 손해봤어요 너무 모든 카드에 있으니까 좀 그렇잖아; 좀 한곳에 한개만 만들던가; 좀"
- 추가: "잠만 손해봤어요 말고 3토큰 받기 부정확 정보 신고하고 이런식으로 해서 우리 피드백 자연수집 어떄???이게 훨씬 나을듯?? 매물 손해 신고는 일단 미루고"
- 의도:
  1. 카드별 신고 진입점 분산 → 한 자리만
  2. 매물 손해 신고 (사후 "손해봤다") 보류
  3. **인센티브 framing**: "3토큰 받기 · 부정확 정보 신고" 카피로 자연 피드백 수집

## 사전 상태 (다른 세션 작업)

이미 진행된 변경 (commit `4bc259a` Wave 182 → Wave 182b/c):
- 카드 list 신고 버튼 제거 (Wave 182b — [user-reveal-dashboard.tsx:519](../../src/components/user-reveal-dashboard.tsx:519))
- 매물 상세 모달 (PackRevealModal) 안 1자리에만 박음
- API endpoint `loss-report` → `inaccurate-report` 로 전환 (Wave 182c)
- `loss_report` (매수 후 손해) 보류, `inaccurate_report` (정보 오류) 만 활성

## 변경

- 시간: 2026-05-17
- 파일 + 위치:

### 1. `src/components/pack-reveal-modal.tsx` (모달 안 CTA)

- L797 title 속성: `"정보 오류 신고하고 토큰 +3 받기 (24h 검수)"` → `"부정확 정보 신고하고 토큰 +3 받기 (24h 검수)"`
- L804 버튼 텍스트: `"🔍 정보 오류 신고하고 토큰 +3 받기"` → `"🎁 토큰 +3 받기 · 부정확 정보 신고"`
  - 아이콘 🔍 (검색) → 🎁 (선물) — 인센티브 강조
  - 어순 "토큰 +3 받기" 앞으로 빼서 보상 가시화

### 2. `src/components/user-reveal-dashboard.tsx` (신고 모달 안 헤더)

- L621 헤더: `"🔍 정보 오류 신고"` → `"🎁 토큰 +3 받기 · 부정확 정보 신고"`
- L627 본문: `"어떤 오류를 발견했나요?"` → `"어떤 부정확 정보를 발견했나요?"` (사용자 표현 매치)

## 검증

- `npx tsc --noEmit` — 변경 파일 에러 0.
- 카드별 잔재 재확인 — Wave 182b 가 이미 제거, "🎁" 모달 CTA 1자리만.

## 위험

- prod 배포가 Wave 182 (카드별 버튼) 시점에 사용자가 봤다면, 자동배포 (Vercel) 완료 후 자동 정리됨.
- `loss_report` 시스템 자체는 보류 — API ([loss-report/route.ts](../../src/app/api/packs/reveals/loss-report/route.ts)) + admin 페이지는 코드에 남아있음. 사용자 진입점만 차단. 향후 재도입 시 코드 활용 가능.
- API `inaccurate-report` 는 `pid` required — 매물 단위 신고만 가능. 매물 무관 일반 피드백은 별도 wave 필요.

## 다음

- prod 배포 후 사용자 확인 — 카드 list 깨끗, 매물 모달 안 1자리 "🎁 토큰 +3 받기 · 부정확 정보 신고" CTA 노출.
- (선택) 매물 무관 일반 피드백 채널 (`general_feedback`) 도입 — 현재는 매물 단위만.
- (선택) loss_report 시스템 재도입 시점 결정 (별도 wave).

## Lesson

피드백 수집 UI 는 "사용자가 손해 봤다고 신고하시오" 같은 negative framing → 인지 부담. "토큰 받기" positive framing + 인센티브 가시화 (보상 금액 먼저 노출) 가 자연 수집 트리거. 카피 한 줄 차이가 클릭률 큰 영향.

또 "한 곳에 한 개" 원칙 — 같은 액션 진입점이 카드별 / 모달 / 헤더 분산되면 인지 비용 ↑. 컨텍스트 자연스러운 위치 (매물 상세 = 매물 정보 의심 신고) 1자리 가 가장 깔끔.
