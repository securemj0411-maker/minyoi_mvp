# 2026-05-22 — Launch CRITICAL #2: Rate limit (이미 처리됨 — audit false positive)

## audit 발견
런칭 보안/성능 audit 가 `src/lib/rate-limit.ts:38` + `.env.local.example:108` 보고
"Rate limit OFF 디폴트 — 비용 폭주 risk" 라고 짚음. 사용자에게 Vercel env 토글
권유했음.

## 사용자 짚음 (정정)
> "rate limit 환경변수 지금 있는데? 값이 뭔진 모르겟음... 난 env.local 에
>  있는거 그냥 버셀에 업로드한건데?? 확인도 안해보고 설정하라고 한건가"

→ **내 잘못**. agent 가 `.env.local.example` (예시 파일, =0) 만 봤고
실제 `.env.local` (gitignored) 안 확인.

## 실제 상태 (`.env.local` 직접 확인)
```
RATE_LIMIT_ENABLED=1                            ← ON
PACKS_OPEN_RATE_LIMIT_MAX=5 / window 10s        ← 코드 디폴트 60/min 보다 빡빡
PACKS_INVENTORY_RATE_LIMIT_MAX=30 / window 10s
PACKS_ME_RATE_LIMIT_MAX=10 / window 10s
CREDITS_ME_RATE_LIMIT_MAX=30 / window 10s
```

사용자가 `.env.local` 그대로 Vercel 업로드한 상태 → **production 도 ON**.

## 추가 액션
- 코드 변경 X
- DB 변경 X
- env 변경 X (이미 적용됨)
- 단 사용자가 Vercel dashboard 에서 한 번 확인 권장 (Settings → Environment
  Variables → `RATE_LIMIT_ENABLED=1` 인지)
- 검증 = 시크릿 창에서 `/api/packs/preview-inventory` 30회 빠르게 → 429 떨어지나

## 교훈 (audit 룰 보강)
- agent 가 `.env.local` 직접 못 보면 결론을 가설로 표시. "디폴트는 OFF"
  같은 표현 X, "확인 필요" 톤.
- launch audit summary 에 이 항목 **false positive** 로 정정.

## 관련
- Wave launch-1 (mvp_incident_log RLS) = TRUE positive, 진짜 fix 함
- Wave launch-2 (rate limit) = FALSE positive, 이미 처리됨
