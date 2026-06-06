# Wave 1195 — 입금 모달 문의 버튼 중복 제거

날짜: 2026-06-06
관련: membership-application-client.tsx 입금 모달, site-help-faq.tsx (글로벌 고객센터)

## owner 발견 (모바일 스크린샷)

입금 방법 선택 모달에서:
1. 우측 상단 "🎧 문의" pill 이 카운트다운 카드("자리 예약 만료까지 / 6:55") 위에 겹쳐
   "자리 예약 만료까지" 글자를 가림 (스샷에서 "...지"만 보였던 이유).
2. 우측 하단에 이미 글로벌 고객센터 🎧 가 있는데 **위에 또 문의** = 중복.

owner: "이부분 왜 이렇게 위에 있어?? 우측하단에 문의하기 있는데 왜 또 위에 문의가 있지?"

## 원인

- 모달(membership-application-client.tsx 546~554)에 자체 "문의" pill (`absolute right-14 top-3`).
- 글로벌 SiteHelpFaq (layout.tsx 161, 우측 하단 floating 🎧).
- **둘 다 정확히 같은 동작**: `window.dispatchEvent("minyoi:open-support-chat")`.
  SiteHelpFaq(111~112)가 이 이벤트를 청취 → 같은 support chat 오픈.
- 즉 모달 문의 = 하단 floating, 100% 중복. 게다가 모달 문의 pill 이 카운트다운 카드를 가림.

## fix

모달 자체 문의 버튼 제거 (하단 글로벌로 통일):
- 문의 `<button>` (546~554) 제거 → 자리에 주석.
- `openPaymentSupport()` 함수 (243~245) 제거 (미사용).
- `HeadsetIcon` import (22) 제거 (미사용).

→ X(닫기) 버튼만 우측 상단에 남아 카운트다운 카드 "자리 예약 만료까지" 온전히 표시.

## owner 이전 결정 호환

owner 과거 지시: "결제 페이지에 고객센터 없애면 안 됨".
→ 위배 아님. 하단 글로벌 🎧(z-10020 > 모달 z-9990)가 결제 모달 위에도 떠서
  결제 중 문의 동선 그대로 유지. 모달 안 중복 버튼만 제거.

## 범위

- 단일 컴포넌트 (입금 모달). 매물 카드 3화면 룰 무관.
- TS check: clean.

## Sign-off
중복 + 가림 동시 해소. 결제 문의는 하단 floating 으로 유지.
