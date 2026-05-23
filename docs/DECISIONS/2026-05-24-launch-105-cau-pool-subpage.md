# launch-105 — /cau../pool sub-page 신설 (AdminPoolBrowser 이전)

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: cau 운영자 디렉토리 안에 운영자 풀 검토 화면 추가

## 배경

`AdminPoolBrowser` 컴포넌트가 `/me` 의 사이드 nav `admin-pool` 분기에만 마운트되어 있었음. 사용자 요청: cau 디렉토리 안에서도 동일하게 보고 싶다 (운영자 페이지에 풀 검토 동선 통합).

## 변경

- `src/lib/admin-routes.ts` — `OPS_ADMIN_POOL_PATH` 상수 박음.
- `src/app/cau../pool/page.tsx` 신설 — admin auth + notFound 가드 + Bloomberg 톤 + `<AdminPoolBrowser />` 마운트.
- cau 메인 sub-nav 에 `POOL` 칩 추가.
- `loss-reports/page.tsx` sub-nav 도 일관성 위해 동일 칩.

## 영향

- 운영자: cau 메인 → POOL 칩 → 매물 카드 + 시세 산정 근거 + 비교 매물 sample 다 보임.
- 컴포넌트 재사용 — 동일 endpoint(`/api/admin/pool-listings`), DB 변경 0.

## 후속

- launch-108 에서 layout.tsx 로 nav/헤더 공유 — 이 페이지의 nav 코드도 layout 으로 위임됨.
