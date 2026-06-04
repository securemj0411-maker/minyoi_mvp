# 2026-06-04 Wave 1094 - Membership Offer Server Token

## 확인

- 최초 멤버십 신청의 10분 업셀 카운트다운은 클라이언트 state 기준이었다.
- `/api/membership/apply`도 업셀 `productKey`를 별도 만료 검증 없이 받아주고 있었다.

## 결정

- 최초 신청 업셀은 서버가 10분짜리 signed offer token을 발급한다.
- `/api/membership/apply`는 업셀 상품 예약 시 다음 중 하나가 아니면 거절한다.
  - 최초 신청: 서버가 발급한 유효한 offer token
  - 멤버 연장: DB의 최신 승인 신청 시각 기준 1시간 내이고, 현재 플랜에서 허용된 연장 특가
- 프론트는 업셀 모달을 열기 전에 `/api/membership/offer-token`에서 서버 토큰과 만료시각을 받아 카운트다운에 사용한다.

## 보류

- 별도 offer history DB 테이블은 만들지 않았다. 최초 신청은 예약 전 DB row가 없으므로 signed token으로 서버 검증을 강제하고, 실제 예약이 생성되는 순간 `mvp_membership_applications`에 저장한다.
