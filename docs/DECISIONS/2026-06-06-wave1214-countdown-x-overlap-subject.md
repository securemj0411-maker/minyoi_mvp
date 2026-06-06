# Wave 1214 — 입금 모달 카운트다운 X 겹침 + 문구 주어 (owner)

날짜: 2026-06-06
관련: membership-application-client.tsx, Wave 1195(문의버튼 제거)/1198

## owner 지적
1. 입금 방법 선택 화면의 7분 카운트다운 카드가 X(창닫기) 버튼과 겹쳐 글자 안 보임.
2. "시간 내 입금하지 않으면 취소돼요" — 주어 없음. 뭐가 취소되는지 불명확.

## fix
1. 카운트다운 카드(헤더 우측, shrink-0)에 `mr-9` 추가 → X(absolute right-3 top-3) 왼쪽으로 밀어
   수평 분리(카드 우측 ~right-52 vs X right-12~48). Wave 1195에서 문의 pill만 제거하고 X-카드 겹침은 남아있었음.
2. 문구 "취소돼요" → "예약이 취소돼요" (주어 명시). max-w 118→124로 한 줄 여유.

## TS check
clean.
