# Wave 1207 — 시세조회 무한로딩 + 중나 500 fix (audit P0 #2,#3)

날짜: 2026-06-06
관련: Wave 1205 audit, /lookup

## #2 무한 로딩 — maxDuration 미설정

- 문제: `api/lookup/by-url/route.ts`에 `maxDuration` export 없음. `restFetch`는 호출당 90초(30s×3 retry)인데
  runLookup이 8회 다단계 순차 호출 → DB 부하 시 함수가 길게 매달려 SSE 무한 로딩/플랫폼 강제종료.
- fix: `export const maxDuration = 60;` 추가. 60초 상한으로 끊어 SSE 종료 → 클라가 에러 안내 받음.

## #3 중고나라 URL 조회 실패 시 500 (소스 비일관)

- 문제: `live-ingest.ts` `ingestJoongna`(155)가 `fetchJoongnaDetail`을 try/catch 없이 호출.
  중나 서버 timeout/네트워크 시 throw → runLookup 바깥 try의 500으로 샘.
  (번개 `bunjang.ts` try/catch, 당근 `daangn.ts` `.catch(null)`은 null 반환하는데 중나만 누락.)
- fix: `fetchJoongnaDetail(url).catch(() => null)` → null이면 `fetch_failed` 반환 (번개/당근과 동일 계약).
  → 깔끔한 404 "매물 페이지를 불러오지 못했어요"로 끝남.

## 남은 lookup 항목 (P1, 후속)
- 클라 AbortController 부재 (연속 조회 race + 서버 SSE/DB 작업 누수) — lookup-client.tsx.
- done body 빈 객체 시 "응답 처리 실패" 안내 — 가드 추가.
- (P0였던 "0.2 크레딧 paywall"은 해당 없음 — 멤버십 전용 전환으로 차감 로직 자체 없음.)

## TS check
clean.
