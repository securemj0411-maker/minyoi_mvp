# 2026-05-25 — guest preview sample parity correction

## Decision

비로그인 메인 preview 는 `/me` 잠금 피드가 아니라 acquisition hook 용 샘플 카드로 유지한다.

- 실제 사진, 실제 제목, 매입가, 시세, 예상 차익은 보여준다.
- `거래 완료`, 빨간 sold 문구, sold 시각 같은 표현은 노출하지 않는다.
- 진행 중인 매물 접근, 원본 링크, source 식별은 로그인 후 플로우로 남긴다.
- 서버 사이드 blur/카테고리 후보명/`정확 시세 잠김`으로 바꾸는 정책은 폐기한다.

## Why

비로그인 메인의 역할은 사용자가 “이런 매물을 이렇게 계산해 주는구나”를 즉시 느끼는 것이다. `/me` locked teaser 와 같은 방식으로 사진·시세·제목을 잠그면 후크가 죽고, 사용자가 상품 감각을 확인할 수 없다.

## Deferred

- 비로그인 preview 에 사용할 샘플 데이터가 sold 표본이어야 하는지, curated active snapshot 을 별도 저장할지는 다음 wave 에서 논의한다.
- 이미지 URL 노출/역검색 리스크는 별도 anti-scrape 설계에서 다룬다. 지금은 메인 hook 회복이 우선이다.
