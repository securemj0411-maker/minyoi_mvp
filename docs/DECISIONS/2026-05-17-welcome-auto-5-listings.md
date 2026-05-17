# 2026-05-17 신규 가입자 welcome 자동 5 매물 (Phase 2)

## 사용자 의도

> "신규가입자는 일단 5개 보여줘야하는데 가치를 확실히 인식시켜야하는데"

핵심: 가입 직후 빈 dashboard 보면 사용자 "이게 뭐 하는 곳?" 학습 비용 ↑. 자동 5 매물 = 즉시 가치 인식.

## 박은 변경 (commit `8aceffd`)

### 1. `/api/packs/welcome` POST 새 endpoint

```ts
// 흐름:
// 1. requireSupabaseUser
// 2. mvp_pack_reveals 에 user_ref row 있나? (이미 매물 받음 — skip)
// 3. 없으면 openPack 호출:
//    - band 2 (중간)
//    - requestedCards 5
//    - isInfiniteCredits: true (welcome 무료)
//    - consumeInventory: false (인벤토리 deduct X)
//    - tokensSpent: 0
// 4. response: success / already_used
```

once-only — DB row 기준 (refresh 해도 중복 reserve X).

### 2. me-dashboard-client useEffect

- user state 로드되면 자동 `/api/packs/welcome` 호출
- 응답 success 면 dashboard refresh event 발행
- 응답 already_used 면 skip (기존 사용자)

## 흐름

1. 가입 → /me 진입
2. user 로드되면 welcome 자동 trigger
3. **신규**: 5 매물 자동 reserve → 즉시 보임 ("와 매물 있네 차익도 있네")
4. **기존**: skip (이미 매물 있음)

## Trade-off

- **무료** — credit/token deduct X. 사용자 1인당 5 매물 cost (서버 부담 작음, 신규 가입은 적음)
- **band 2 default** — 사용자 plan tier 추후 customize 가능
- **once-only** — 사용자가 매물 다 지우고 다시 받으려 해도 안 됨. 의도된 — "더 찾아보기" 버튼 사용

## Test

288/288 pass.
