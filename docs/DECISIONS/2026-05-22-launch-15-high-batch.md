# 2026-05-22 — Launch HIGH batch (4개 빠른 fix)

런칭 직후 임팩트 큰 HIGH 항목 빠르게 묶음 처리.

## 1. /api/stats/pool err.message 노출 차단
- 위치: `src/app/api/stats/pool/route.ts:46`
- 이전: `error: err.message` 그대로 client 반환 → DB schema / PostgREST 누출
- 변경: `error: "stats_unavailable"` 일반 메시지. 상세는 console.error 로만.

## 2. PORTONE_SKIP_VERIFY prod 우회 차단
- 위치: `src/lib/portone-server.ts:18-19`
- 이전: `process.env.NODE_ENV !== "production" || process.env.PORTONE_SKIP_VERIFY === "1"`
- 변경: prod 에선 env 무시. dev / preview 만 skip 허용.
- ops 실수로 prod 에 SKIP_VERIFY 박혀도 위조 paymentId 막힘.

## 3. `/` page.tsx force-dynamic 제거
- 위치: `src/app/page.tsx`
- 이전: `export const dynamic = "force-dynamic"; export const revalidate = 0;`
- 변경: 두 줄 제거. MeDashboardClient = client component 라 shell 정적 OK.
- 결과: 모바일 첫 paint 빠름 (정적 shell 즉시 → client hydration).

## 4. 미스리딩 카피 정직화
- `explore-client.tsx:1913` "매물 분석 중이에요. 곧 새 풀이 풀려요." →
  "오늘 잡은 매물이 충분치 않아요. 잠시 후 새로고침하면 새 매물이 보일 수 있어요."
- `explore-client.tsx:2159` "다음 라운드 준비 중" → "쿨다운 대기 중"
- 메모리 룰 정직 카피 — 진행감 카피 (분석 중 / 준비 중) 가 실제론 cooldown 대기인 거 fix.

## 영향
- 코드: 4 파일
- DB / env: 변경 X
- UI: explore-client 의 빈 상태 + cooldown 카피만 변경 (사용자 영향 미미)

## 검증
- TypeScript compile clean
- production 동작 영향 X

## 남은 HIGH
- Security Definer Views + RPC anon EXECUTE (SQL — 다음 batch)
- preview-inventory parallel
- user-dashboard 가품 chip + 신규 셀러 차단
- 모바일 첫 fold + 빈 상태 CTA
- refresh modal 뒤로가기
- markOpenedPid race / 환불 자동화
