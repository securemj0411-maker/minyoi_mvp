# 2026-05-23 — launch-51: 카카오 공유 보너스 진짜 박음 (Kakao SDK + 24h limit + +1 크레딧)

## 사용자 짚음
> "REST API 키, JavaScript 키, ... 여기서 뭐 알려줌? 어디꺼"
> "https://minyoi-mvp.vercel.app/ 이걸로 등록"

JavaScript 키 받음 (`a8fa6f737020f398a73f0c05cfd7f7ab`) + web 도메인 등록 완료 → 진짜 카카오 공유 박을 준비됨.

## fix (5 단계)

### Step 1: DB migration
```sql
ALTER TABLE mvp_user_credits
  ADD COLUMN IF NOT EXISTS last_share_bonus_at timestamptz;
CREATE INDEX mvp_user_credits_last_share_bonus_idx
  ON mvp_user_credits (last_share_bonus_at DESC NULLS LAST)
  WHERE last_share_bonus_at IS NOT NULL;
```

### Step 2: API endpoint
`src/app/api/packs/pool/share-bonus/route.ts` (신규):
- POST 만 지원
- 인증 필수 (`requireSupabaseUser`)
- `last_share_bonus_at` 검증 — 24h 안 박혔으면 reject (429 + remainingHours)
- 통과 시 `balance += 1` + `last_share_bonus_at = NOW()` upsert
- 응답: `{ ok: true, bonus: 1, balance: N }`

### Step 3: Kakao SDK 로드 (`src/app/layout.tsx`)
```html
<script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
  integrity="sha384-..." crossorigin="anonymous" async />
```

### Step 4: Frontend handler (`src/components/explore-client.tsx`)
- `kakaoShareReady` state — SDK 로드 + init 완료 시 true
- mount 시 polling (100ms × 50 = 5s timeout) 으로 `window.Kakao` 확인 + `Kakao.init(NEXT_PUBLIC_KAKAO_JS_KEY)` 호출
- `handleKakaoShare` callback:
  - `Kakao.Share.sendDefault({ objectType: "feed", content: {...}, buttons: [...] })` — 다이얼로그 표시
  - 직후 `POST /api/packs/pool/share-bonus` 호출
  - 성공 시 `setRefreshModalOpen(false) + window.location.reload()` — 새 credits 반영
- button 의 `disabled={!kakaoShareReady || kakaoShareLoading}` + 톤 차이 (yellow 활성 vs 흐림 disabled)

### Step 5: env
```
# .env.local + Vercel env
NEXT_PUBLIC_KAKAO_JS_KEY=a8fa6f737020f398a73f0c05cfd7f7ab
```

## 진짜 공유 검증 = **불가능 (카카오 webhook 없음)**

선택: callback 호출 직후 보너스 API 호출 + **24h 1회 제한 + auth 필수**:
- 카카오 callback = 다이얼로그 닫혔을 때 호출. 진짜 공유 검증 X.
- 사용자가 button 만 누르고 안 보내도 보너스 가능 — 단 24h 제한 으로 abuse 차단.
- 진짜 검증 = referral URL 통해 다른 사람 가입 시 (별 wave).

## 영향
- DB: mvp_user_credits.last_share_bonus_at 컬럼 + index
- 신규 API: /api/packs/pool/share-bonus
- 코드: layout.tsx (SDK script) + explore-client.tsx (state + handler + button)
- env: NEXT_PUBLIC_KAKAO_JS_KEY
- 사용자: 카톡 공유 button 진짜 작동. 24h 1회 +1 크레딧.

## 사용자 액션 (Vercel)
Vercel env 박기: `NEXT_PUBLIC_KAKAO_JS_KEY=a8fa6f737020f398a73f0c05cfd7f7ab`

## 향후 (별 wave)
- 진짜 referral 시스템 — share URL ?ref=USER_ID&t=TOKEN, 다른 사람 가입 시 referrer 보너스
- 카카오 공유 다이얼로그 추가 옵션 (sticker, mission 등)
- 보너스 결과 toast UI (현재 `window.location.reload()` 로 단순화)

## 메모리 룰
- 외부 SDK 통합: script tag + polling init + env-driven enable
- decision log: 이 파일
