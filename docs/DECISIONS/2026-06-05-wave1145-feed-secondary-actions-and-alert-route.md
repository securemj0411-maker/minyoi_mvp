# 2026-06-05 Wave 1145 — 피드 보조 액션 배치와 새매물 알림 라우팅 수정

## 결정
- 피드 하단 sticky 영역에는 `더 찾아보기`만 남긴다.
- `중고나라·번개장터까지 보기`와 `새매물 알림 받기`는 sticky가 아닌 일반 보조 액션으로 노출한다.
- 매물이 0개인 빈 상태 카드에도 같은 보조 액션을 보여서, 사용자가 바로 마켓 확장이나 알림 설정으로 빠질 수 있게 한다.
- 알림 메뉴 명칭은 `실시간 매물 알림` 대신 `새매물 알림`으로 통일한다.

## 구현
- `src/components/explore-client.tsx`
  - 보조 액션 렌더러를 공통 함수로 분리했다.
  - 빈 결과 상태, 필터 결과 0개 상태, 피드 하단 정보 카드에 보조 액션을 추가했다.
  - 기존 sticky 영역에서 보조 액션 2개를 제거했다.
- `src/components/me-dashboard-client.tsx`
  - `/me?view=hotdeal-alerts`처럼 query가 바뀌면 `activeView`도 같이 갱신되도록 `useSearchParams`를 연결했다.
- `src/components/hotdeal-alerts-view.tsx`
  - 페이지 제목과 설명을 `새매물 알림` 톤으로 정리했다.

## 원인
- 피드에서 `href="/me?view=hotdeal-alerts"`를 눌러도 `MeDashboardClient`가 URL query를 초기 렌더에서 한 번만 읽었다.
- 그래서 URL은 바뀌지만 내부 `activeView`가 그대로라 알림 페이지가 열리지 않는 것처럼 보였다.
- 또한 보조 액션이 sticky 내부에 묶여 있어 화면을 가리고, `items.length > 0`일 때만 렌더되어 빈 결과에서는 사라졌다.

## 보류
- 새 당근 매물 알림의 지역 기반 큐/발송 조건 자체는 기존 알림 화면 진입을 복구한 뒤 별도 작업으로 다룬다.
