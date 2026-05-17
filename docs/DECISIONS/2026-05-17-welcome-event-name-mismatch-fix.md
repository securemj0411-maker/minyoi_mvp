# 2026-05-17 신규 가입자 welcome 5 매물 화면 미표시 fix

## 버그 보고

- 시간: 2026-05-17 (사용자 직접 보고)
- 보고: "이메일로 가입했는데 5개 상품 안보여줌. 가입하면 5개 상품 보여주는건데"
- 증상: 가입 성공 + `mvp_pack_reveals` DB row 5개 박힘. 그런데 `/me` "나의 상품" 화면 빈 상태.
- 발견: `.next/dev/logs/next-development.log` 에는 welcome 호출 흔적 없음 (compile error 만 다수). 코드 정독 → 이벤트 이름/payload mismatch 발견.

## 원인 — 3 개 버그 stack

- 시간: 코드 정독 단계
- 발견:
  1. `me-dashboard-client.tsx:200` dispatch 이름 `"pack-reveals-updated"` (raw)
  2. `user-reveal-dashboard.tsx:235` listener 이름 `PACK_REVEALS_UPDATED_EVENT` = `"minyoi:pack-reveals-updated"` ([pack-events.ts:3](../../src/lib/pack-events.ts:3))
  3. → 이름 불일치, listener 가 절대 못 잡음
  4. dispatch payload `{ reveals: [] }` 빈 배열, handler `length === 0` 면 early return ([user-reveal-dashboard.tsx:194](../../src/components/user-reveal-dashboard.tsx:194))
  5. `band` 필드 누락 (`PackRevealsUpdatedDetail` 타입 위반)

3 개 버그가 stack 돼서 DB엔 박혔지만 화면 dispatch refresh 신호 못 갔음. + 초기 `loadItems` 가 welcome POST 끝나기 전에 fetch 끝나서 빈 결과 캐싱.

## 변경

- 시간: 2026-05-17
- 파일: [src/components/me-dashboard-client.tsx](../../src/components/me-dashboard-client.tsx)
- 정확한 위치:
  - L15-21: import 에 `dispatchPackRevealsUpdated`, `PackBand`, `PackOpenResult`, `RevealCard` 추가
  - L197-205: raw `window.dispatchEvent(new CustomEvent(...))` → typed 헬퍼 `dispatchPackRevealsUpdated({ band: 2 as PackBand, reveals })` 로 교체
  - response 를 `PackOpenResult` 로 narrow, `success.reveals` 실제 데이터 전달
- 변경 전:
  ```ts
  const data = await res.json() as { result?: string };
  if (data.result === "success") {
    window.dispatchEvent(new CustomEvent("pack-reveals-updated", { detail: { reveals: [] } }));
  }
  ```
- 변경 후:
  ```ts
  const data = (await res.json()) as PackOpenResult | { result?: string; error?: string };
  if (data && (data as PackOpenResult).result === "success") {
    const success = data as Extract<PackOpenResult, { result: "success" }>;
    const reveals: RevealCard[] = Array.isArray(success.reveals) ? success.reveals : [];
    dispatchPackRevealsUpdated({ band: 2 as PackBand, reveals });
  }
  ```

## 검증

- `npx tsc --noEmit` — 변경 파일 에러 0. 사전 존재한 test 파일 에러 (wave141/145/148/151) 는 unrelated, 회귀 아님.
- runtime: 실제 신규 이메일 가입 → /me 진입 → 5 카드 노출 시나리오 미테스트 (사용자 측 확인 필요).
- commit: `7596ba6` main 에 push (`770c87a..7596ba6`, origin/main 반영 완료).

## 위험

- band = 2 hardcode. 추후 plan tier customize 시 별도 wave.
- 기존 가입자 (이미 reveal row 보유) 는 welcome 라우트가 `already_used` 응답 → fix 효과 없음. 새 이메일 가입자만 즉시 효과.
- prod Vercel 자동 배포 대기. 배포 전엔 prod 사용자 동일 증상 유지.
- raw `window.dispatchEvent` 다른 곳에 또 있을 수 있음 — 본 wave 에선 1 곳만 확인됨 (`grep "pack-reveals-updated"` 전수).

## 다음

- prod 배포 후 신규 이메일 가입 1 회 → 5 카드 노출 확인.
- 본인(사용자) 계정 이미 reveal 있어 안 보임 — 5 매물 받고 싶으면 `mvp_pack_reveals where user_ref = 'auth:<userId>'` row 삭제 (destructive, 사용자 명시 확인 필요).
- (선택) lint rule / typed event bus 도입 검토 — raw string event 이름 컴파일러가 못 잡음. 이번 같은 silent failure 재발 위험.

## Lesson

`dispatchPackRevealsUpdated` typed 헬퍼 이미 존재. 우회해서 raw `dispatchEvent("pack-reveals-updated", ...)` 박은 게 화근. typed 헬퍼 있으면 우회 금지 — 컴파일러가 잡을 수 있는 실수를 silent runtime bug 로 만듦.
