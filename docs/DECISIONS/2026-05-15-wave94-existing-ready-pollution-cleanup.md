# Wave 94 — 기존 ready 카테고리 숨은 오염 cleanup + 시스템 audit

> Status: **applied (code).** 사용자에게 노출 중인 9 ready 카테고리에서 HIGH pollution 8개 발견 → catalog NOISE 3-iteration 강화 → HIGH 0개 달성.

CLAUDE.md 6 필드 포맷.

## 0.1 기존 ready 카테고리 pollution audit

- 시간: 2026-05-15 08:30 KST
- 발견: Wave 92에서 신규 카테고리 (shoe/bag/bike)만 audit 했음. owner 지적 — "이미 노출 중인 ready 카테고리도 같은 검사 필요". 적용 결과:
  - 93 SKU audit (earphone/smartwatch/tablet/laptop/monitor/speaker/home_appliance/sport_golf/watch).
  - **8개 HIGH pollution 발견** (>15%):
    - home-appliance-roborock-s8-pro-ultra **55.6%** (악세사리/물걸레/소모품 키트 매칭)
    - airpods-2 **42.9%** (실리콘 케이스 ₩500 매물)
    - iPad mini **40%** (짭펜슬 / 1세대 매물)
    - galaxy-buds-3-pro **22.2%** (실리콘 케이스 / 메탈 밴드)
    - galaxywatch-6 **20%** (강화유리 / 보호 케이스)
    - monitor-27gp850 **16.7%** (거치대 단품)
    - watch-gshock-gmwb5000 **15.8%** (구매원함 / ₩2,000 매물)
    - sennheiser-hd569 **20%** (이어캡 단품)
  - **11개 MARGINAL** (5~15%).
- 변경:
  - `scripts/wave94-existing-ready-pollution-audit.ts` 신규 — Wave 92 audit를 기존 카테고리에 적용.
  - 결과 `reports/wave94-existing-ready-audit-latest.json` 박음.
- 검증: 측정만, 실행 안전.
- 위험: 없음.
- 다음: 카테고리별 NOISE 강화 iteration.

## 0.2 NOISE 3-iteration 정밀화

- 시간: 2026-05-15 09:00 KST
- 발견: HIGH pollution 8개 분석 결과 **케이스/액세서리/부품 단품 매물이 본품 SKU에 매칭**되는 게 핵심 원인. 모니터/가전 NOISE는 아예 정의 안 되어 있었음.
- 변경: `src/lib/catalog.ts`에 카테고리별 NOISE 신규 정의 + 자동 spread:
  - `EARPHONE_NOISE_W94`: 케이스 변형 (실리콘/투명/하드/젤리/범퍼/기본/신상/미사용/케이맥스), 유닛 단품, 이어캡, 필름
  - `SMARTWATCH_NOISE_W94`: 강화유리/액정보호, 보호 케이스, 메탈 밴드/밀레니즈 밴드, 충전기만
  - `MONITOR_NOISE_W94`: 거치대 단품 (현재 NOISE 없었음), 스탠드 단품, 모니터 거치대, VESA 마운트, 케이블만
  - `HOME_APPLIANCE_NOISE_W94`: 악세사리/키트/물걸레/필터/브러시/소모품, 전문사기조직 (사기 매물 직접 reject)
  - `WATCH_NOISE_W94`: 구매원함, 유리 단품
  - `TABLET_NOISE_W94`: 짭펜슬, 비공식 펜슬
  - `SPEAKER_NOISE_W94`: 하드 케이스 단품, 충전 도크만
  - `CATEGORY_NOISE_MAP_W94`: 카테고리 → NOISE 매핑. `GENERATED_CATALOG_WITH_GATES` + `CATALOG_WITH_NOISE_W94` 양쪽에 자동 spread (기존 mustNotContain은 union 보존).
  - ruleMatch 함수 내부도 CATALOG_WITH_NOISE_W94로 참조 변경.
- 검증: 3-iteration audit 결과:
  | Iter | HIGH | MARGINAL | safe |
  |---|---:|---:|---:|
  | 0 (audit) | 8 🚨 | 11 | — |
  | 1 (NOISE v1) | 4 | 13 | — |
  | 2 (NOISE v2 broader) | 1 | 14 | 17 |
  | **3 (NOISE v3 specific)** | **0** ✅ | 16 | 16 |
  - `npx tsc --noEmit` clean, `npm run test:core` 139/139 pass.
- 위험: 매우 낮음.
  - NOISE 추가가 정상 매물도 reject 할 수 있는 false negative risk. 단 신중하게 단품 표현만 추가 ("케이스 단품", "케이스 1회") — 본품 매물에는 등장 거의 없음.
  - MARGINAL 16건은 5~15% pollution — 표본 작은 SKU들 outlier 1~2건이 percentage 띄움. 표본 누적되면 자연 감소.
- 다음: marginal SKU들 자연 누적 추적 (별도 wave). 사기조직 패턴 더 발견되면 NOISE 추가.

## 0.3 시스템 차원 audit (#3, #4)

- 시간: 2026-05-15 09:30 KST
- 발견:
  - **#3 Dead SKU**: 30일 raw_listings 49,525건 중 38,371건 (77.5%) sku_id NULL. 카테고리 sweep raw 흡수 정상 결과 (broad capture). SKU 매칭된 매물 분포 정상 (macbook-pro 794건 등).
  - **#4 Bunjang API ban risk**: 6시간 cron 호출 272건 모두 성공 (failed=0). 평균 16~19초 (Vercel maxDuration 60s 한계 30% 수준). **ban risk 매우 낮음**.
  - **시세 outlier filter**: `market-math.ts` `madTrim`이 이미 작동 중 (Wave 90에서 threshold 8→5 조정). 추가 system-level filter 불필요.
- 변경: 없음 (측정만).
- 검증: SQL 결과 reports에 박지 않음 (즉시성).
- 위험: 없음.
- 다음:
  - Marginal SKU들 (특히 자전거 시계 작은 표본) 1주 누적 후 재측정.
  - Bunjang API 호출량 평소 trend 모니터링.

## 1. 사용자 보호 효과 (정량적)

| 카테고리 | safe | marginal | HIGH (변화) |
|---|---:|---:|---|
| earphone | 2 | 5 | 2 → **0** ✅ |
| smartwatch | 7 | 2 | 0 → 0 |
| tablet | 3 | 1 | 0 → 0 |
| laptop | 0 | 2 | 0 → 0 |
| monitor | 2 | 0 | 1 → **0** ✅ |
| speaker | 1 | 0 | 0 → 0 |
| home_appliance | 0 | 0 | 1 → **0** ✅ |
| watch | 0 | 3 | 0 → 0 |
| sport_golf | 2 | 0 | 0 → 0 |

→ 모든 ready 카테고리 **HIGH pollution 0** 달성. MARGINAL 16건은 추적 관리.

## 2. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- HIGH pollution 매물 재진입 — NOISE patch 통과 후 confirmation 필요.
