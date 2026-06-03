# 2026-06-04 Wave 1041 — guest preview 5-slot fill and velocity label dedup

## Trigger

비회원 메인 페이지의 "회전 속도 있는 매물 미리보기"가 5개 목표인데 2개만 노출됐고, 한 상품 안에서 `평균 N일 내 판매` 문구가 상단과 하단에 중복 노출됐다.

## Findings

- 운영 DB `mvp_preview_showcases` active row가 실제로 2개뿐이었다.
- 원천 후보는 부족하지 않았다.
  - 최근 14일, 15만원 이하 invalidated 후보: 3,660개
  - 그중 sold/disappeared 후보: 1,168개
  - usable velocity matched key: 216개
- 문제는 cache builder가 최근 후보 중 앞쪽 160개만 보고 selection을 끝내서 5-slot을 채우지 못하는 구조였다.

## Decisions

- `PREVIEW_POOL_SCAN_LIMIT`를 500에서 1200으로, `PREVIEW_MARKET_SCAN_LIMIT`를 160에서 500으로 늘려 velocity/market gate를 통과할 후보를 더 깊게 본다.
- 비회원 preview card는 상단 velocity badge만 남기고, 하단/right-side duplicate signal chip은 제거한다.
- `/api/preview-pool`은 계속 request-time 계산 없이 `mvp_preview_showcases` materialized cache만 읽는다.

## Applied

- 운영 DB preview cache를 새 builder로 즉시 refresh했다.
- refresh 후 active slot은 5개로 회복됐다.

## Deferred

- `<img>` LCP warning은 기존 구조 유지. Next Image 전환은 이미지 도메인/config 검토가 필요해 별도 UI/perf 작업으로 둔다.
