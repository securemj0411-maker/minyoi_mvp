# 2026-06-04 Wave 1074 - Plans Member Renewal Copy Dedupe

## 결정
- `/plans`에서 이미 상단 멤버십 카드가 활성 상태, 남은 기간, 만료일, 연장 방식을 설명하므로 `MembershipApplicationClient`의 멤버 전용 기본 블록에서는 같은 정보를 다시 렌더링하지 않는다.
- 멤버가 아직 연장 예약을 만들지 않은 상태에서는 `상품 피드 보기`와 `멤버십 연장하기` 액션만 노출한다.

## 구현
- `src/components/membership-application-client.tsx`의 멤버 전용 중복 안내 카드(`멤버십 활성화됨`, 남은 일수, 만료일 문구)를 제거했다.
- 클라이언트 컴포넌트가 더 이상 `memberPlanEndAt`, `memberSource`를 받지 않도록 `/plans` 호출부와 계약 테스트를 정리했다.

## 보류
- 상단 `/plans` 카드 자체의 멤버십 카피 밀도와 디자인 재배치는 별도 UI wave로 남긴다.
