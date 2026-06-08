# Wave 1230b/c/d — 광고 유입 추적 완성 (봇 제외 + IP/지역 + 관리자 페이지)

날짜: 2026-06-08 (KST)
계기: owner — "기존 봇 확실하면 지우고, cau 관리자에 '광고 유입' 네비 추가해서 내가 거기서 기기·IP·지역 다 볼 수 있게."

## 검증 — 추적 작동 + 진짜 광고 클릭 도달 확인
- 첫 배포 16분간 mvp_ad_visits 20건 중 **18건이 구글 봇**(Googlebot Nexus 5X·AdsBot·Google-Ads-Creatives-Assistant — Final URL 검증 크롤링), **진짜 사람 2명**(owner Mac + **아이폰 실광고클릭 wbraid**).
- → 진짜 생판 남이 광고 눌러 사이트 도달한 게 데이터로 입증. 0가입은 랜딩→가입 이탈 재확인.

## Wave 1230b — 봇 제외
- `ad-tracking.ts`: insert 전 봇 UA 스킵 `/bot|crawl|spider|...|google-|googleother|googleweblight/i`. (초안은 `google-` 없어서 Google-Ads-Creatives-Assistant 누락 → 추가.) → `count(*)` = 진짜 사람.
- 기존 봇 18행 purge(owner 승인): `delete ... where user_agent ~* '<botregex>'` → 18 삭제, 진짜 2건 유지.

## Wave 1230c — IP + 지역
- `mvp_ad_visits` 컬럼 추가(추가형): ip, country, city, region. (마이그레이션 `wave1230c_ad_visits_ip_geo` = 20260608033951.)
- `ad-tracking.ts`: ip(`x-forwarded-for` 첫값/`x-real-ip`) + Vercel edge geo(`x-vercel-ip-country/city/country-region`) 캡처.
- 프라이버시: 1st-party 분석 목적. /privacy 에 분석/IP 수집 고지 권장(PIPA).

## Wave 1230d — 관리자 '광고 유입' 페이지
- 라우트 `OPS_ADMIN_AD_TRAFFIC_PATH = {BASE}/ad-traffic` (admin-routes.ts). nav.ts "분석" 그룹에 `📣 광고 유입` 추가.
- `CAU_DIR/ad-traffic/page.tsx`(server, force-dynamic, _ui 프리미티브): KPI(오늘/7일/전체/확실한광고클릭/고유IP) + 테이블(시각·출처·기기·지역·IP·클릭ID·유입경로). UA→기기/브라우저 라벨, country→한글, referer→호스트.
- auth 는 layout 위임. 미인증 fetch → 307 /login 확인.

## 검증
- tsc --noEmit: 47(=baseline, tests/), 내 파일(ad-traffic/page·nav·admin-routes·ad-tracking) 0.
- dev:3000 새 라우트 컴파일 + 인증 게이트(307) 확인. 봇 스킵 + purge DB 확인(진짜 2건).

## 후속
- 광고 방문 → 가입 attribution(쿠키 source 보존)은 후속.
- 관리자 페이지 자동 새로고침(polling)은 추후(현재 수동 reload).
