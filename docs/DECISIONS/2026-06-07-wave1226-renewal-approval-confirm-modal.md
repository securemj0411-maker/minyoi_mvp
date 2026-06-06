# Wave 1226 — 멤버십 연장 승인 완료: 자동소멸 토스트 → '확인했습니다' 완료 모달

날짜: 2026-06-07 (KST)
계기: owner — Wave 1225 로 입금→승인 흐름 정상화 확인. 다만 승인 완료가 5.2초 자동소멸 토스트라
"사용자가 한눈 팔면 승인된 줄 모르고 사라질 수 있다" → 확인 버튼 눌러야 닫히는 모달로.

## 변경 (explore-client.tsx `FeedMembershipUpsellCard`, display-only)
1. **자동소멸 effect 제거** (구 583-587): `setTimeout(() => setApprovalToast(null), 5200)` 삭제.
   - approvalToast 는 이제 사용자가 닫기 전까지 유지. 폴링은 approvalToast 가드(:525)로 계속 정지 — 영향 없음.
2. **완료 렌더를 모달로** (구 639-655 → 신 637-665): 중앙 카드만 있던 것 → `bg-black/62` backdrop 으로
   화면 덮고, `확인했습니다` 버튼(`onClick={() => setApprovalToast(null)}`) 추가. ✓ 아이콘/문구 유지·확대.
   - 버튼 누르면 approvalToast=null → 카드 invisible(requestState approved + expired). 다음 화면 진행.
3. **주석 라벨 정정**: Wave 1225 멤버십 fix 의 인라인 주석 2곳이 실수로 "Wave 1224"(=시세 배지, 별 wave)로
   박혀 있던 것 → "Wave 1225"로 수정 (혼동 방지).

## 흐름
입금 → 5:00 유지(Wave 1225) → 텔레그램/5분 승인 → **완료 모달이 backdrop 으로 화면 덮고 유지** →
사용자가 `확인했습니다` 클릭해야 닫힘. 더는 토스트가 혼자 사라지지 않음.

## 검증
- `npx tsc --noEmit`: explore-client.tsx **0 에러**.
- 자동소멸 제거 확인(5200 0건), 확인 버튼/backdrop/ setApprovalToast(null) 확인.
- **실사용 끝단(텔레그램 승인 → 완료 모달 → 확인 클릭)은 owner 검증 권장** (회원계정+텔레그램 필요).

## 위험 / 주의
- display-only. 결제/승인/금액/만료 로직 미변경.
- 모달은 backdrop-click 으로 안 닫힘(버튼만) — 승인 인지를 확실히. 의도된 동작.
- main 기준 커밋(Wave 1225 위). feat/wave1224(시세 배지) 브랜치엔 이 변경 없음 — 나중에 그 브랜치
  머지 시 explore-client 멤버십 영역 충돌 가능 → main 기준 rebase 권장.
