# 2026-06-05 Wave 1111 - Plans 신청 flow 지역 티오 지도

## 결정
- `/plans` 비회원/미승인 화면을 스크롤 페이지가 아니라 fixed full-screen 신청 flow로 바꿨다.
- flow는 `지역 티오 확인 → 제한 이유 → 승인 후 공개 정보 → 신청` 4단계로 한 chunk씩 넘긴다.
- 대한민국 남한 지도 SVG를 다시 만들고, 17개 광역시도 전체를 지도 marker와 선택 chip에 넣었다.
- 지역을 누르면 선택 지역의 티오/예약률/대표 지역 요약이 바뀐다.
- 모바일/데스크톱 모두 body scroll을 막고, 4단계를 footer CTA로만 넘기도록 검증했다.
- flow 집중을 위해 비회원 신청 화면에서는 사회적 증명 toast를 숨겼다.
- flow 안에서 기존 MembershipApplicationClient의 모바일 fixed CTA는 끄도록 옵션을 추가했다.

## 보류
- 실제 지역별 신청자 DB 집계 연동은 보류했다. 현재는 선공개 멤버십 전환용 mock 티오 데이터로 UI 위계를 먼저 정리했다.
- GIS 수준의 행정구역 polygon은 보류하고, 가입 페이지용 경량 SVG outline + 17개 지역 marker로 처리했다.
