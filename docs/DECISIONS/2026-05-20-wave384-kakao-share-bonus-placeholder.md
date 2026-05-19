# 2026-05-20 Wave 384 — 카카오톡 공유 보너스 (placeholder UI)

사용자 제안:
- 카카오톡 공유 1번 → 30개 매물 즉시 받기 (cooldown 우회)
- 초반: 공유 클릭만으로 reward (가입 검증 X)
- 후반: 친구가 그 링크로 가입해야 reward (referral, 보류)

## Phase 분할

### Phase 1 — 공유 클릭 reward (이번 wave: placeholder만)

- 카카오 JS SDK + App Key 필요 (`NEXT_PUBLIC_KAKAO_APP_KEY`)
- 사용자가 클릭 → `Kakao.Share.sendDefault()` → success 콜백
- success 시 → POST `/api/packs/pool/share-bonus`
- 서버: lifetime 1회 검증 (`mvp_user_credits.share_bonus_used_at`)
- 통과 시 즉시 새 30개 fetch + cooldown 우회

**이번 wave는 placeholder UI만** — App Key 미발급. 사용자가 추후 발급 시 연결.

### Phase 2 — Referral (보류, 별 wave)

친구가 공유 링크로 실제 가입해야 reward.
- 가입 시점 referral_code 추적 → 추천인에게 reward
- 더 강한 viral 효과 (실제 신규 사용자 유입)
- abuse 방지 강함
- **구현 필요 시점에 별도 wave** — 사용자 결정 대기

## 변경 파일 (Phase 1 placeholder)

`src/components/explore-client.tsx`:
- cooldown 모드 안 노란 카드 추가 (paywall 위)
- 라벨: "💬 카톡 공유하고 30개 받기"
- 부제: "공유 1번 → 즉시 새 30개 (곧 출시)"
- 무료 chip
- onClick: alert "곧 출시예요!"
- TODO 주석: Phase 2 — Kakao.Share + share-bonus API
- paywall 부제 fix: "6시간 미만 fresh 매물" → "알림 즉시 받기" (wave 383 lag 제거 잔재)

## 추후 구현 작업 (App Key 박을 때)

1. **DB migration**:
   ```sql
   ALTER TABLE mvp_user_credits ADD COLUMN share_bonus_used_at timestamptz;
   ```
2. **새 API endpoint** `/api/packs/pool/share-bonus`:
   - 인증
   - share_bonus_used_at 있으면 거부 (`{ ok: false, reason: "already_used" }`)
   - 없으면 갱신 + 새 30개 fetch (loadPool) + 응답
3. **Kakao SDK 로드** — `src/app/layout.tsx`에 `<Script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js" />`
4. **Kakao init** — first mount에서 `window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_APP_KEY)`
5. **Kakao 공유 데이터 구성**:
   ```ts
   Kakao.Share.sendDefault({
     objectType: "feed",
     content: {
       title: "득템잡이",
       description: "AI가 시세 분석 + 차익 매물 자동 추천",
       imageUrl: "https://...og.png",
       link: { mobileWebUrl: "https://minyoi.kr", webUrl: "https://minyoi.kr" },
     },
     buttons: [{ title: "득템 시작", link: { ... } }],
   });
   ```
6. **버튼 onClick**:
   ```ts
   Kakao.Share.sendDefault({...});
   // success 콜백 (또는 immediate POST):
   const res = await fetch("/api/packs/pool/share-bonus", { method: "POST" });
   if (res.ok) {
     const data = await res.json();
     setItems(prev => mergeWithDedupe(prev, data.items));
   }
   ```
7. **abuse 검증** — lifetime 1회 (DB 확인). Phase 2 referral 박힐 때 정책 재검토.

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

- 사용자가 cooldown 모드에서 카톡 공유 옵션 보고 미래 가치 인지
- "곧 출시" 톤으로 placeholder 정직성 유지
- App Key 발급되면 즉시 연결 (TODO 주석 + 위 작업 list 따라)
