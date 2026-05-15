# 2026-05-16 — Cron watchdog 베타 우선순위 정리 (불필요 2개 제거)

## 트리거
사용자: "4 cron QStash 그거 왜 해야됨? 중요한가? 있을 필요 없으면 빼."

## 베타 단계 우선순위 분석

| Cron | 안 돌면 영향 | 중요도 |
|---|---|---|
| **compliance-retention** | 개인정보 retention 안 됨 → 법 위반 가능 (raw_text 보관기간 초과) | 🔴 필요 |
| **reference-price-refresh** | 다나와 시세 stale (1주 후 부정확) | 🟡 선택 |
| **landing-showcases** | 랜딩 페이지 cached stale (베타 traffic 7명) | 🟢 불필요 |
| **housekeeper-ai-cache-prune** | AI cache 누적 (베타 작은 traffic = 작은 cache) | 🟢 불필요 |

## Fix

`src/lib/cron-watchdog.ts` `WATCHDOG_TARGETS` 에서 2개 제거:
- `landing-showcases`
- `housekeeper-ai-cache-prune`

유지 (법적/시세 정확도):
- `compliance-retention` (alertAfter 2880분 = 48h)
- `reference-price-refresh` (alertAfter 1800분 = 30h)

## 효과
- 텔레그램 false positive alert 차단 (4개 → 2개)
- 진짜 중요한 2개만 모니터
- 베타 traffic 작은 cron은 등록 안 해도 OK

## 사용자 액션 (남음)
1. **compliance-retention QStash 등록** (법적, 1일 1회)
   - URL: `https://minyoi-mvp.vercel.app/api/cron/compliance-retention?wait=1`
   - Cron: `0 18 * * *` (또는 적당히)
   - Auth: `Bearer minyoi-cron-2026`
2. reference-price-refresh: 등록 선택 (1주 stale OK면 미등록 가능)
3. landing-showcases / housekeeper-ai-cache-prune: 등록 안 해도 됨 (watchdog 제거됨)

## 위험 / 다음
- 사용자 100명+ 성장 시 landing-showcases / ai-cache-prune 재추가 필요. 그때 다시 evaluate.
- compliance-retention 미등록 상태 지속하면 법적 risk. 등록까지 watchdog alert이 계속 옴 (cooldown 30분).
