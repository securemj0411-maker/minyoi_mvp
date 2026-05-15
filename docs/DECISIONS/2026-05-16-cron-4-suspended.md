# 2026-05-16 — 4 cron 등록 보류 결정 (베타 단계)

## 트리거
사용자 결정 (2026-05-16): "일단 4개는 보류로 하자 로그 남기셈".

직전 분석 (`docs/EXPERIMENTS/2026-05-16-bunjang-rate-limit-probe-design.md`, Iteration 2 발견):
- 4 cron이 QStash 미등록 상태 (24h~48h 0회 호출).
- 베타 traffic (사용자 7명) 기준 영향 분석 후 보류 가능 판정.

## 보류 대상 (4개)

| Cron | 주기 | 동작 | 안 돌면 영향 | 재등록 trigger |
|---|---|---|---|---|
| **landing-showcases** | 10분 | 랜딩 페이지 hot 매물 cache 갱신 | 사용자 노출 stale 매물 | 사용자 100명+ 성장 |
| **housekeeper-ai-cache-prune** | 6시간 | `mvp_listing_ai_classifications` retention prune | DB 사이즈 ↑ (베타엔 미미) | DB 사이즈 큰 폭 증가 시 |
| **compliance-retention** | 1일 | `mvp_raw_listings.description` 보관기간 지난 거 삭제 (개인정보) | **법적 risk** (raw_text 보관기간 초과) | **사용자 늘기 전 / compliance audit 요청 시** |
| **reference-price-refresh** | 1일 | 다나와 50 SKU 가격 → `mvp_reference_prices` upsert | 다나와 시세 stale (미개봉 매물 시세 비교 부정확) | 시세 정확도 issue 발견 시 |

## 조치

### 1. `src/lib/cron-watchdog.ts` — 4 cron 추적 제거
```typescript
const WATCHDOG_TARGETS: WatchdogTarget[] = [
  // 7개 active cron만 유지 (lifecycle, tick, detail, market, pool, deep, housekeeper)
  // 4 cron (landing/ai-prune/compliance/ref-price) 베타 보류
];
```

영향:
- 텔레그램 alert spam 차단 (이전: 30분마다 4번 alert)
- 운영자 noise 0
- 4 cron이 실제로 안 돌고 있어도 watchdog가 잡지 않음

### 2. 보류 로그 (영구 기록)
- `docs/SCRATCH/2026-05-15-batch-review-pending.md` 업데이트
- 이 decision log 박음

## 위험 / 잊지 말 것

| 위험 | 대응 |
|---|---|
| compliance-retention 미등록 장기화 → 법적 risk | **사용자 100명 도달 또는 1주일 안에 등록** 권장 |
| 다나와 시세 stale 누적 → 미개봉 매물 시세 부정확 | 시세 정확도 issue 사용자 신고 시 즉시 등록 |
| 랜딩 페이지 stale → 사용자 클릭 시 죽은 매물 | 베타 traffic 작아 발생 빈도 낮음. 사용자 성장 시 monitor |
| 알림 끔 → 진짜 stale 상황 인지 지연 | 운영 dashboard 정기 review (별도 진행) |

## 다음 검토 시점

- **사용자 50명 도달 시**: 4 cron 재평가
- **2주 후 (2026-05-30)**: compliance-retention 등록 여부 결정 (법적 책무)
- **DB 사이즈 50GB 초과 시**: housekeeper-ai-cache-prune 등록

## 재등록 방법 (잊지 말 것)

각 cron 등록 시:
- **URL**: `https://minyoi-mvp.vercel.app/api/cron/<name>?wait=1`
- **Cron expression**: design 문서 참고
- **Auth**: `Bearer minyoi-cron-2026`
- 등록 후 `cron-watchdog.ts`의 `WATCHDOG_TARGETS`에 추가
