# 2026-06-04 Wave 1075 - Membership Feed Exact Price

## 결정
- 크레딧/무료 teaser 모델을 버리고, `/api/packs/pool`은 멤버십 승인 사용자에게 실제 피드 매물을 그대로 내려준다.
- 피드에서 매입가와 시세를 직접 보여주며, `필요 예산`, `정확 시세 잠김`, `상세에서 제목·가격 공개`, `판매자 정보 상세 확인` 같은 옛 잠금/크레딧제 문구는 사용하지 않는다.

## 구현
- `/api/packs/pool`의 `buildTeaserFeedItems` synthetic token/masking 응답 경로를 제거하고 `items`를 그대로 응답한다.
- 프론트 피드 카드 가격 라벨을 `매입`에서 `매입가`로 명확히 바꿨다.
- 멤버십 피드에서는 `isFeedTeaserLocked`가 항상 false를 반환하게 해 남은 token/teaser 상태가 화면 잠금으로 번지지 않게 했다.
- 약한 셀러 placeholder인 `판매자 정보 상세 확인` 생성 경로를 제거했다.

## 보류
- `detail-access`의 accessToken backward compatibility는 과거 클라이언트/세션을 위해 당장은 남긴다.
