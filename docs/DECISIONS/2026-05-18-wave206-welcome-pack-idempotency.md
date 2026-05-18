# Wave 206 — 신규가입 welcome pack 4장 idempotency 보장

## 배경

- 시간: 2026-05-18 15:36 KST
- 사용자 보고: 첫가입 welcome은 4개만 보여줘야 하는데 `/me`에 같은 시각 `03:06` reveal이 12개 표시됨.
- 확인한 코드상 `WELCOME_CARDS = 4`는 맞다.
- 원인은 `/api/packs/welcome`의 기존 1회성 체크가 `mvp_pack_reveals select existing -> 없으면 openPack()` 구조였기 때문이다.
- 동시에 welcome POST가 2~3개 들어오면 모두 `existing.length = 0`을 보고 각각 4개씩 reveal할 수 있다. 12개는 4장 welcome이 3회 경합한 형태와 일치한다.

## 결정

신규 welcome 지급은 서버에서 DB idempotency lock을 먼저 잡은 요청만 실행한다.

## 변경

### DB

`supabase/migrations/20260518062500_welcome_grants_once.sql`

- `mvp_welcome_grants` 추가.
- `user_ref` primary key로 사용자당 welcome grant 1회를 강제.
- 상태:
  - `pending`
  - `success`
  - `failed`
- anon/authenticated RLS 차단. service role route만 접근.

### API

`src/app/api/packs/welcome/route.ts`

- 기존 reveal 존재 체크 유지.
- `openPack()` 호출 전에 `mvp_welcome_grants`에 `user_ref`를 insert.
- insert 성공 요청만 `openPack({ requestedCards: 4, consumeInventory: false })` 실행.
- conflict이면 `already_used` 반환.
- openPack 성공 시 grant row를 `success`로 patch.
- openPack이 `refunded/unavailable/error`이면 pending grant를 삭제해 재시도 가능하게 함.

## 보류

- stale `pending` lock 자동 회수는 보류. 현재 catch/non-success 경로에서 release하며, 서버 크래시가 실제로 생기면 운영자가 row 삭제로 복구 가능하다.

## Production 보정

- 중복 지급 사용자 확인:
  - `auth:c9cc6394-13f7-4124-89a1-02947edb6b62`
  - `pack_open_id`: 66, 67, 68
  - 세 묶음이 `2026-05-18T06:06:57Z`에 약 0.3초 간격으로 생성됨.
- 보정:
  - 첫 묶음 `pack_open_id=66`의 4개 reveal만 유지.
  - 중복 묶음 `67`, `68`의 reveal 8개 삭제.
  - `mvp_welcome_grants`에 해당 user를 `success`, `pack_open_id=66`, `revealed_count=4`로 기록.
- 결과:
  - 해당 user의 `/me` reveal count는 12개에서 4개로 정리됨.

## 검증

- `npm run build`: pass
- `npm run test:core`: 446/447 pass
  - 기존 실패 1건 유지: `tests/wave159h-condition-fallback.test.ts`
  - 실패 내용: `target sample 부족 → fallback chain 진행`, actual `flawed`, expected `worn`
- production DB migration 직접 적용 확인:
  - `mvp_welcome_grants` table created.
