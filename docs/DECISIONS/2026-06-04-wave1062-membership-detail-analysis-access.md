# Wave 1062 — Membership detail analysis access

## Decision

- `애플 에어팟 맥스 퍼플 미개봉 새제품` (`pid=9003122823588`)의 상세/쉬운모드에서 판매 속도와 비교 매물이 비는 문제를 재조사했다.
- DB에는 `airpods|airpods_max_usbc|usbc` / `unopened` 기준 velocity와 당근 비교 매물이 충분했다.
  - `2026-06-04` velocity: `unopened` observed sold 16건, sold 7d 11건, median hours 201.7h, confidence medium.
  - 같은 key의 당근 미개봉 normal 비교 매물은 50건 이상 확인했다.
- 원인은 데이터 결손이 아니라 권한 흐름 불일치였다.
  - `explore-client`가 local opened pid cache를 믿고 서버 `/api/packs/pool/detail-access` 호출을 건너뛰면, 서버 pid별 detail access bucket이 없어서 lazy analysis/comparable API가 403으로 막힐 수 있었다.
  - `/api/packs/pool/analysis`, `/api/listings/[pid]/market-source`, `/api/packs/reveals/detail`은 admin/beta만 bypass하고 pro membership bypass를 반영하지 않아, 멤버십 회원도 bucket mismatch 시 분석/비교 호출이 막혔다.
- local opened pid early return을 제거해 서버 detail-access를 항상 타게 했다.
- 세 API의 authorization gate에 `getProStatus()` 기반 membership access를 추가했다.

## Deferred

- `/api/packs/pool/direct-location` 같은 부가 상세 API도 같은 membership bypass가 필요한지 별도 audit이 필요하다.
- 비교매물 fetch 실패 시 쉬운모드에서 "표시 가능 비교 매물이 없음"과 "권한/네트워크 실패"를 분리하는 UX 개선은 후속으로 남긴다.
