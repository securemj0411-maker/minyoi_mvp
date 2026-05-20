# 2026-05-21 Joongna Shadow Source Guard

## 결정

- 중고나라는 즉시 production pool source로 붙이지 않고, `JOONGNA_SOURCE_MODE=off` 기본값의 shadow probe부터 추가한다.
- 차단/레이트리밋/챌린지 신호는 회피 대상이 아니라 즉시 철수 신호로 간주한다.
- `scripts/report-joongna-source-probe.ts`는 robots.txt와 recent product sitemap index만 확인하며 DB write를 하지 않는다.
- transparent User-Agent(`MinyoiSourceProbe/0.1`)를 사용한다. proxy, CAPTCHA 우회, 로그인 자동화, 모바일 앱 reverse path는 사용하지 않는다.

## 구현

- `src/lib/joongna.ts`
  - `getJoongnaSourceMode()`로 `off | shadow | active`를 명시적으로 파싱한다. 알 수 없는 값은 off로 닫힌다.
  - `detectJoongnaBlockSignal()`이 401/403/429/451/503 및 CAPTCHA/비정상 접근 문구를 stop signal로 판정한다.
  - `probeJoongnaPublicSource()`가 robots, `sitemap-recent-product-index.xml.gz`, 일부 child sitemap URL을 no-write로 검사한다.
  - `joongnaInternalPid()`는 기존 `mvp_raw_listings.pid` bigint 단일 PK 충돌을 피하기 위한 내부 pid 범위를 생성한다.
- `tests/joongna-source-guard.test.ts`로 mode parsing, block detection, sitemap parsing, pid mapping contract를 고정했다.

## 보류

- `mvp_raw_listings`에 중고나라 매물을 쓰는 production ingest는 보류했다.
- 검색 HTML 파싱/상세 페이지 파싱은 보류했다. sitemap probe가 정상이고 파트너 응답/법무 위험 판단이 정리된 뒤 최소 필드(title, price, thumbnail, url, observed time)만 붙인다.
- schema를 `(source, external_id)` 중심으로 바꾸는 큰 마이그레이션은 보류했다. 현재는 bigint `pid` 단일 PK라 source 추가 시 내부 id mapping이 필요하다.
