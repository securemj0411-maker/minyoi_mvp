# 2026-05-17 신규 가입자 welcome 5 매물 화면 미표시 fix

## 사용자 보고

> "근데 나 왜 이메일로 가입했는데 5개 상품 안보여주는거임?? 가입하면 5개 상품 보여주는건데"

가입은 성공, DB에는 5 reveal row 박혔지만 `/me` 화면(나의 상품) 에서 빈 상태.

## 원인 — 3 개 버그 stack

`me-dashboard-client.tsx:200` 의 welcome 성공 dispatch 와 `user-reveal-dashboard.tsx:235` 의 listener 가 어긋남.

1. **이벤트 이름 불일치 (치명)**:
   - dispatch: `"pack-reveals-updated"` (raw)
   - listener: `PACK_REVEALS_UPDATED_EVENT = "minyoi:pack-reveals-updated"` ([pack-events.ts:3](../../src/lib/pack-events.ts:3))
   - → listener 절대 안 잡힘.

2. **빈 reveals 배열**: dispatch 가 `{ reveals: [] }` 보냄. handler 는
   ```ts
   if (!Array.isArray(detail?.reveals) || detail.reveals.length === 0) return;
   ```
   ([user-reveal-dashboard.tsx:194](../../src/components/user-reveal-dashboard.tsx:194)) — early return.

3. **band 누락**: `PackRevealsUpdatedDetail` 은 `band: PackBand` 필수.

## 박은 변경 ([me-dashboard-client.tsx:182-210](../../src/components/me-dashboard-client.tsx:182))

- `dispatchPackRevealsUpdated` canonical 헬퍼 사용 (raw `dispatchEvent` 제거)
- welcome response 를 `PackOpenResult` 로 타입 narrow
- 성공 시 `packResult.reveals` 실제 데이터 + `band: 2` 전달

```ts
// before — 세 버그 다 있음
window.dispatchEvent(new CustomEvent("pack-reveals-updated", { detail: { reveals: [] } }));

// after
const success = data as Extract<PackOpenResult, { result: "success" }>;
const reveals: RevealCard[] = Array.isArray(success.reveals) ? success.reveals : [];
dispatchPackRevealsUpdated({ band: 2 as PackBand, reveals });
```

## 흐름 (fix 후)

1. /me 진입 → user state 로드 → welcome useEffect fire
2. `/api/packs/welcome` POST → DB 에 5 reveal row insert
3. response `{ result: "success", reveals: [...5] }` 받음
4. `dispatchPackRevealsUpdated({ band: 2, reveals })` → `"minyoi:pack-reveals-updated"` event
5. UserRevealDashboard handler 가 잡음 → optimistic 5 cards 추가 + silent reload
6. 사용자 즉시 5 매물 봄

## Trade-off

- band 2 hardcode — welcome 정책상 항상 band 2 (medium). plan tier customization 은 추후 별도 wave.
- 이미 reveal 있는 사용자 (재진입): welcome 라우트가 `already_used` 응답 → `result !== "success"` → dispatch skip (정상).

## Test

타입체크 변경 파일 에러 없음. 런타임 확인: 실제 이메일 가입 → /me 진입 → 5 카드 노출 확인 필요.

## Lesson

raw string event 이름 쓰지 말 것. `dispatchPackRevealsUpdated` 같은 typed 헬퍼가 있는데 우회한 게 원흉. 이벤트 이름 typo 는 컴파일러가 못 잡음.
