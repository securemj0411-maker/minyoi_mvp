# 2026-05-19 — 시세 그래프 정직화 + schema drift fix

## 결정

velocity P0 fix 직후 같은 깊이 감사를 시세 그래프 / `mvp_market_price_daily`에 적용.
결과: **시스템 자체는 정상 (QStash 매시간 cron) but UX 거짓말 위험 + schema drift 발견** → fix.

## 발견 (Audit)

### 시세 그래프 자체는 정상
- cron: QStash가 `/api/cron/market-worker` 매시간 (24/24h 실측). vercel.json 안 거치고 별 인프라
- 데이터 갱신: 마지막 computed_at 2026-05-19 12:22 UTC (현재 시점)
- 코드: median/p25/p75 계산 robust (decay weight, outlier 제외, condition 분리)
- mock/하드코딩 없음, empty state 처리 깔끔
- velocity와 달리 폴백 거짓 라벨 없음

### 진짜 문제 — historical 깊이 4일
- [5/16 incident](2026-05-16-incident-market-price-daily-historical-loss.md): `condition_class='all'` 1559건 DELETE → historical 30일치 영영 손실
- 현재 DB: 4일치만 (5/16~5/19), 10,691 row, 4,765 unique keys, 6 condition_class
- 5/30 즈음 30일 풀 회복 예정 (자연 누적)
- 그동안 [market-history-chart.tsx](../../src/components/market-history-chart.tsx) 가 "**번개장터 시세 30일 추이**" 카피를 박지만 실제 데이터는 4일치 → **거짓 trend로 오인 위험**

### Schema drift 발견
- Wave 130에서 PK `(date, comparable_key)` → `(date, comparable_key, condition_class)` 3-col로 migration
- **단 schema.sql 미반영 + `supabase/migrations/` 파일 자체가 없음**
- 새 환경에서 schema.sql만 깔면 PK 불일치 → upsert가 다른 condition의 row 덮어쓰기 silent corruption
- velocity P0 fix 박을 때 같은 PK 불일치 에러 만남 (v1 → v2 condition_class 박아서 해결)

### Velocity vs Market Price 비교

| | velocity | market price |
|---|---|---|
| cron 자동화 | ❌ 미실행 (방금 fix) | ✅ QStash 매시간 정상 |
| 폴백 거짓 라벨 | ❌ "약 2일 카테고리 평균" → fix | ✅ empty state 깔끔 |
| 데이터 커버 | 5 → 18 카테고리 | 6 condition × 4,765 keys |
| **진짜 문제** | cron 부재 | historical 깊이 4일 (사고 회복 중) |
| schema drift | 동일 | 동일 (이번에 같이 fix) |

## 변경 (What)

### 1. [market-history-chart.tsx](../../src/components/market-history-chart.tsx)
- L209 카피 동적화: `"번개장터 시세 30일 추이"` → ``번개장터 시세 ${daysSpan}일 추이``
  - 5/30 즈음 30일 데이터 회복 시 자동으로 "30일"로 표시 (별도 작업 X)
- L218-225 표본 부족 배너 추가:
  - `data.length < 7 && priceSource !== "reference"` 조건
  - 카피: `📊 시세 데이터 누적 중 (N일째) — 표본이 더 쌓이면 추이가 안정화돼요`
  - amber 톤 (경고 아닌 안내). 7일+ 자연 사라짐
- 사용자 결정 (이번 세션): **라인 임계값은 그대로 (2점+ 라인 그림). 배너 추가로 오인 차단**

### 2. [supabase/schema.sql](../../supabase/schema.sql)
- `mvp_market_price_daily.condition_class` 컬럼 추가 + PK 3-col 반영
- `mvp_market_velocity_daily.condition_class` 동일 처리
- legacy schema.sql과 prod DB drift 해소

### 3. [supabase/migrations/20260515120000_wave130_market_condition_class_pk.sql](../../supabase/migrations/20260515120000_wave130_market_condition_class_pk.sql)
- Wave 130 PK migration의 missing migration 파일 신설
- Idempotent (이미 박혀있으면 skip). prod 영향 X
- 새 환경 setup 시 PK 일치 보장

## 안 건드린 것 (의도적)

- **historical 데이터 복원 시도** — 5/16 incident 결정에서 "받아들임"으로 정리됨. 5/30 자연 회복 대기
- **임계값 2 → 3 변경** — 사용자 추천 옵션은 "라인 유지 + 배너". 정책 결정
- **사용자 1일/7일/4주 평균 rollup 시스템** — 사용자 확인 결과: `mvp_market_price_daily` 자체가 1일 평균. 7일/4주 rollup은 미구현 (P2)
- **confidence 뱃지 UI 노출** — P1로 미룸 (출시 후)

## 후속 (Follow-up)

### P1 (출시 후)
1. **confidence UI 뱃지** — `mvp_market_price_daily.confidence` (high/medium/low) 컬럼 chart에 표시
2. **다나와 reference unopened** — 번개 표본 0건일 때 출처/시점 명시
3. **cron 빈도 카피 일관성** — CLAUDE.md "10분" / cron-watchdog "60분" / wave215 "5분" 실측 hourly. 단일화

### P2 (DB 크기 관리)
4. **7일/4주 평균 rollup** — 사용자 의도. 현재 미구현. daily row가 무한 누적되므로 ~6개월 단위로 weekly/monthly aggregate 테이블 분리 검토. 30일 이상 daily row는 weekly로 압축

### 자연 해소
- 5/30 즈음 historical 30일 풀 회복 → 배너 자동 사라짐. 카피도 "30일 추이" 자동 표시

## 관련

- 외부 검토: 본 세션 agent audit 보고서
- 5/16 incident: docs/DECISIONS/2026-05-16-incident-market-price-daily-historical-loss.md
- Velocity P0 fix: docs/DECISIONS/2026-05-19-velocity-p0-fix.md
- 메모리: "시세 historical 한 번 잃으면 못 돌림" — 5/16 사고의 결정적 학습
- 메모리: "DELETE/DROP 사전 영향 명시 필수" — 5/16 사고가 그 룰의 trigger
