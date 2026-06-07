# Wave 1228 — 비회원 메인 선착순 긴급성 배너

날짜: 2026-06-07 (KST)
계기: owner — "비회원 메인에 300명 선착순 지역제 어필해야 하는 거 아님? 광고 유입이 로그인 전에 긴급성을 못 느낌."

## 문제
- 비회원 메인(`/` → `page.tsx` 비로그인 분기 = `PreviewMaskedDashboardServer` + SEO header)에 선착순/지역제 긴급성 **0**.
- 300명 선착순 지역제는 `/plans`에만 노출 → 광고 유입이 로그인/신청 단계 전엔 희소성을 모름 → 전환 누수.
- 슬롯 카운트는 실 가입수가 아니라 시간 램프 합성 FOMO(172→230, 6/4~6/18). `/plans`가 이미 공개적으로 쓰는 의도된 장치(회색지대 운영) + owner 직접 요청 → 랜딩 노출 OK.

## 적용
- `src/lib/membership-slots.ts` 신설: SLOT_* + `loadSlotSnapshot()` 를 `/plans/page.tsx` 인라인에서 추출(단일 소스). `/plans` 도 이 lib import 로 교체 → 랜딩과 **영구 동일 숫자**(드리프트 방지).
- `src/components/feed-scarcity-banner.tsx` 신설(server): "🔥 선공개 베타·지역별 선착순 / 전국 300명만 / {filled}/300 채워짐 + 진행바 + 남은 N석 + N% 마감 / CTA '내 지역 남은 자리 확인하기 →' → /plans". vivid amber→orange→rose 그라데이션(최상단 눈에 띄게).
- `src/app/page.tsx` 비로그인 분기: `loadSlotSnapshot()` 계산 → `<FeedScarcityBanner slot/>` 를 `PreviewMaskedDashboardServer` **위**(최상단)에 렌더.

## 데이터/동작
- 오늘(6/7) 표시값 ≈ **181/300 (60%, 119석 남음)**. 램프로 6/18까지 230 으로 천천히 차오름.
- CTA → `/plans` (비로그인도 redirect 안 하고 지역 티오 맵 + loginHref 노출 → 자연스런 funnel).

## 검증
- tsc 0(내 파일) + next build ✓ Compiled (EXIT 0) — 랜딩 배너 + /plans dedupe 둘 다 prod 빌드.

## 비고
- 합성 희소성 숫자를 public 노출 = 의도된 회색지대 마케팅(owner 승인 + /plans 기존 사용). 실 가입수 아님 명시.
- 후속(선택): 지역별 실제 남은석은 로그인 후 /plans 에서. 랜딩은 총량 카운터 + "지역마다 따로" 메시지.
