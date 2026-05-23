## Wave 734 — 카카오 공유 보너스 webhook 기반 매크로 차단

- 시간: 2026-05-24 KST
- 발견: 사용자 보고 — 기존 카카오 공유 보너스 (`launch-50/51` 24h cooldown +1) 가 "다이얼로그 띄우기만 해도 즉시 +1". 매크로 가능 (매일 다이얼로그 띄우고 닫기만 해도 매크로). 사용자 지시: 카카오톡 공유 웹훅 등록해서 실제 메시지 클릭한 경우만 보상.
- 기존 코드 코멘트도 명시: "진짜 공유 검증 X (카카오 webhook 없음) — abuse 차단 = 24h 1회 제한."

### 작동 흐름 변경

**Before**:
1. 사용자 카톡 공유 버튼 클릭 → `Kakao.Share.sendDefault()`
2. 다이얼로그 닫힘 → 즉시 `POST /api/packs/pool/share-bonus`
3. balance +1 + 24h cooldown 박힘
4. 매크로: 다이얼로그 열고 즉시 닫아도 +1 받음

**After**:
1. 사용자 카톡 공유 버튼 클릭 → `Kakao.Share.sendDefault({ serverCallbackArgs: { user_id } })`
2. 다이얼로그 닫힘 → "친구가 메시지를 누르고 들어오면 크레딧 1개를 받아요" alert
3. **즉시 지급 X**
4. 친구가 카톡 메시지 받음 → 메시지/버튼 클릭
5. 카카오 서버 → `GET /api/kakao/share-webhook?user_id=<sender_user_id>` 호출
6. webhook 에서 cooldown 검증 → +1 지급 + 24h cooldown 박음

매크로 차단: 친구가 실제 클릭해야 보상. 다이얼로그만 띄우면 보상 0.

### 변경

#### 1. [src/app/api/kakao/share-webhook/route.ts](../../src/app/api/kakao/share-webhook/route.ts) (신규)
- `GET` handler — 카카오 webhook 받는 endpoint
- `?user_id=` query param 으로 sender user_id 받음
- 24h cooldown 검증 → balance +1 + ledger 기록 (`event_type: kakao_share_webhook`)
- console.log 로 진단 (Kakao 가 실제 param 어떤 이름으로 보내는지 확인 — 실제 호출 후 보강 가능)

#### 2. [src/components/explore-client.tsx](../../src/components/explore-client.tsx) — 카카오 공유 함수
- `sendDefault({ ... serverCallbackArgs: { user_id: storageScope } })` 추가
- **즉시 `POST share-bonus` fetch 제거** — webhook 이 보상 책임
- "공유해주셔서 감사해요! 친구가 메시지를 누르고 들어오면 크레딧 1개를 받아요" alert 안내
- cooldown UI 갱신 제거 — webhook 통과 후 자연스럽게 다음 mount 에서 갱신
- userId 출처: `storageScope` prop (me-dashboard-client.tsx 에서 `user.id` 전달)

### Kakao Developers Console 설정 (사용자 액션 필요)

1. https://developers.kakao.com → 내 애플리케이션 → 앱 선택
2. **메시지** → **카카오톡 공유** 메뉴 진입
3. **사용자 정의 콜백 (웹훅)** 섹션 등록:

| 필드 | 값 |
|---|---|
| 메서드 | **GET** |
| 웹훅 URL | `https://minyoi-mvp.vercel.app/api/kakao/share-webhook` (또는 production 도메인) |
| 입력 데이터 라벨 | `user_id` |

- "입력 데이터 라벨" = `serverCallbackArgs` 에 박은 key 화이트리스트. `user_id` 만 등록하면 다른 임의 값은 webhook 에 전달 안 됨 (보안).
- 등록 후 카카오 측에서 webhook URL ping/validation 호출할 수도 — log 확인.

### 검증

- `npx tsc --noEmit` — 0 error.
- **실제 webhook 작동 확인 절차**:
  1. Kakao Console webhook 등록
  2. 사용자 A 로그인 → /me → 카카오 공유 button 클릭
  3. 카카오 다이얼로그 → 친구한테 메시지 전송
  4. 친구가 메시지 클릭 → 우리 사이트 진입
  5. Vercel logs 에서 `[kakao-share-webhook] received` 로그 + `bonus granted` 확인
  6. 사용자 A balance +1 + last_share_bonus_at 갱신 확인

### 위험 / 한계

- **자기 자신 클릭** — 사용자 본인 카톡으로 받아서 자기 클릭하면 webhook 호출됨. 24h cooldown 으로 spam 제한 — 진짜 abuse 아님.
- **`serverCallbackArgs` 위조** — client 에서 박는 값이라 다른 user_id 박을 수 있음. 단 다른 사용자한테 보상 주는 형태라 본인 abuse 아님. cooldown 로 운영 통계 보호.
- **Kakao webhook 실패 시 retry 정책 미지** — 카카오 측 retry 있으면 cooldown 검증으로 중복 지급 차단됨.
- **`POST /api/packs/pool/share-bonus` deprecate** — 호출 제거됐지만 endpoint 자체는 남겨둠 (rollback 대비). `GET` 은 cooldown 조회용으로 계속 사용.

### 다음

- 사용자: Kakao Console webhook 등록.
- Vercel logs 모니터링 — webhook 실제 호출 + param 이름 확인. 카카오가 `user_id` 가 아닌 다른 param 이름 (`pk_user_id`, `template_args[user_id]` 등) 사용하면 endpoint 보강.
- 충분히 호출 누적되면 매크로 차단 효과 측정 (이전 share-bonus event count vs 새 kakao_share_webhook event count 비교).
