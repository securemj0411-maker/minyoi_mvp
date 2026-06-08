# Wave 1229b / 1230 — 랜딩 CTA 단순화 + 광고 유입 추적 (구글애즈 검증)

날짜: 2026-06-08 (KST)
계기: 구글애즈 5만원 / 46클릭 / **0가입**. owner — "CTA 버튼이 너무 많아 혼란(배너 '내 자리' / 시작하기 / 샘플 / 잠금풀고보기). 그리고 광고가 진짜 우리 사이트로 오는지 추적하고 싶다(Final URL 쿼리 + DB 카운팅)."

## 진단 — 카카오 가입 문은 정상 (직접 검증, 브라우저/계정 없이)
- 카카오 OAuth authorize 체인 fetch 추적:
  - Supabase `/auth/v1/authorize?provider=kakao&redirect_to=…` → **302** → 카카오 authorize (client_id `0f330…` · redirect_uri `…supabase.co/auth/v1/callback` 정상 등록)
  - 카카오 authorize → **302** → `accounts.kakao.com/login` (정상 로그인 페이지, KOE/redirect 에러 **0**)
- 결론: **가입 문 정상.** 0가입은 문 문제 아님 → **funnel(랜딩 혼란)** 에서 카카오 버튼 도달 전 이탈. (우리 auth 로그 신규 OAuth 시도 0건과 일치.)

## Wave 1229b — 랜딩 CTA 과잉 정리 (owner 진단 반영)
대상: `src/app/page.tsx`, `src/components/preview-masked-dashboard-server.tsx`.
- **눌러야 할 것 6개 → 2개**: ① 히어로 "지금 시작하기" ② 잠금 게이트 "잠금 풀고 전체 보기" (둘 다 `/login?next=/plans`).
- 상단 `FeedScarcityBanner`("내 자리 →" 버튼) **제거** → 히어로 안 **"🔥 지금 300명 한정 · N자리 남음" 칩**(비-버튼, 긴급성 정보만). slot은 page.tsx → `PreviewMaskedDashboardServer` prop으로 전달.
- 샘플 카드 **클릭 해제**(`<Link>`→`<div>`, 증거 전용). "서비스 소개" 버튼 → **텍스트 링크** 강등. 하단 중복 CTA 바 **제거**.
- 시선 동선 단일화: 가치(히어로) → 증거(샘플3) → 잠김(게이트) → 가입.

## Wave 1230 — 광고 유입 추적
- 신규 테이블 `mvp_ad_visits` (추가형·무위험, **RLS on · service-role 전용**): created_at / source / medium / campaign / content / term / click_id / click_id_type / landing_path / referer / user_agent. (마이그레이션 `wave1230_ad_visits_tracking`.)
- `src/lib/ad-tracking.ts` — `logAdVisitIfPresent(searchParams)`: 광고 신호(`?src=` / `utm_*` / `gclid`·`gbraid`·`wbraid`) 감지 시 1건 insert. **throw 안 함**(페이지 안 깸). 일반 유기 방문은 no-op(기록 안 함).
- `src/app/page.tsx` — searchParams 읽어 auth 조회와 **병렬(`Promise.all`)** 로깅 → 광고 방문에도 추가 지연 0.
- **Final URL**: `https://minyoi-mvp.vercel.app/?src=gads` (구글 auto-tagging의 gclid도 자동 감지).
- 검증: dev:3000(같은 prod DB)에서 `?src=gads&gclid=…` → **1건 기록** / `?foo=bar` → **미기록** 확인. 테스트 행 정리(잔여 0).
- 카운트 조회: `select date_trunc('day',created_at) d, source, count(*) from mvp_ad_visits group by 1,2 order by 1 desc;`

## 검증
- `tsc --noEmit`: 47(= baseline, 전부 tests/), 내 파일(page.tsx / ad-tracking.ts / preview) 0.
- dev:3000 라이브 확인.

## 후속
- 광고 방문 → **가입 전환 attribution**(쿠키로 source 보존 → 가입 시 연결)은 후속(선택).
- 단순화 후에도 0가입 지속이면 → 오퍼 자체(유료+승인 게이트) 마찰 or 광고-랜딩 메시지 매치 재검토.
