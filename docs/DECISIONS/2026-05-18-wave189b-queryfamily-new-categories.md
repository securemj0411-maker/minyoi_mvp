# Wave 189b — queryFamily 신규 카테고리 매핑 + DB backfill (2026-05-18)

## 사용자 질문

> "왜 ready에 새 카테고리 없음??? 크론에서 안가져옴>??"

## 진단

신규 카테고리 (drone/lego/kickboard/perfume) 가 사용자 풀에 안 보이는 원인 5층 분리:

| 단계 | 상태 |
|------|------|
| cron search | ✓ 돌고 있음 — raw_listings 매물 들어옴 (garmin 76 / lego 57 / gopro 62 / 킥보드 119) |
| `queryFamily()` 분류 | ✗ **신규 카테고리 query 1,054건이 "unknown"으로 매핑** |
| DB `mvp_category_readiness` | drone/lego/kickboard/perfume **internal_only** |
| 카테고리 게이트 (pack-open) | ✓ 2026-05-15에 제거됨 (lane_readiness=ready면 풀 진입 OK) |
| **detail_queue 진입** | ✗ **여기서 막힘** — title-only ruleMatch fail (Wave 189에서 normalize fix 박음) |
| `mvp_candidate_pool` | drone/lego/kickboard/perfume **0건** → 사용자 화면 0 |

**진짜 병목**: detail_queue 진입 fail (Wave 189 normalize로 24h 후 측정 예정).

**보너스 fix (이 wave)**: queryFamily()가 신규 카테고리 매핑 없어서 → `mvp_search_queries.category='unknown'` → cadence 최적화 + 어드민 대시보드 분류 부정확.

## 결정

### 1. `queryFamily()` 코드 매핑 추가

`src/lib/search-query-cadence.ts:49`:

- **drone** (DJI 드론 + GoPro + DJI Osmo):
  `dji / 디제이아이 / 매빅 / 미니 / 아바타 / osmo / 오즈모 / 고프로 / gopro / hero / 히어로 / 드론`
- **lego**: `lego / 레고 / ucs`
- **kickboard**: `샤오미 미 스쿠터 / mi scooter / ninebot / 닌봇 / 세그웨이 / segway / 킥보드`
- **perfume**: `조 말론 / jo malone / 르 라보 / le labo / 딥디크 / diptyque / 톰 포드 / tom ford / replica / 리플리카 / memo / 메모 파리 / 향수`
- **home_appliance** (Dyson/Panasonic 등): `다이슨 / dyson / 에어랩 / airwrap / 슈퍼소닉 / supersonic / 코랄 / corrale / 파나소닉 / panasonic / babyliss / cyaars`
- **smartwatch** (Garmin 보강): `가민 / garmin / 페닉스 / 피닉스 / fenix / 포러너 / forerunner / 인스팅트 / instinct / 비누 / venu / 에픽스 / epix` (기존 "워치" 매칭 보존)
- **laptop** (Galaxy Book): `갤럭시 북 / 갤럭시북 / galaxy book`

### 2. DB 'unknown' query backfill (production)

기존 등록된 1,054 unknown query 중 패턴 매칭되는 row 229건 UPDATE:

| category | row 추가 |
|----------|---------|
| smartwatch | +33 (가민) |
| drone | +59 (DJI/GoPro/Osmo) |
| home_appliance | +38 (Dyson 등) |
| perfume | +32 |
| lego | +27 |
| kickboard | +25 |
| laptop | +15 (갤럭시 북) |

unknown 1054 → 825.

destructive 아님 (UPDATE, code의 queryFamily()로 재계산 가능). PITR 미박힘이지만 reversible.

## 영향

- 신규 query는 자동으로 정확한 category 박힘 (앞으로)
- cadence 최적화 — drone/lego/kickboard 등 family 기반 fallback 동작
- 어드민 대시보드 정확도 개선

**사용자 풀 노출에는 직접 영향 X** — 그건 Wave 189 normalize (detail_queue 진입) 가 24h 후 측정.

## verify / commit

- typecheck clean
- test:core 446/447 (실패 1건 사전 wave159h 무관)
- commit `3c9941c` Wave 189b

## 정책 정합성

§12b 정확성 우선 충족 — false positive risk 0 (분류만 정정, 풀 진입 조건 그대로).
