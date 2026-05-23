## Wave 735 — 카카오 webhook 공식 spec 준수 보강

- 시간: 2026-05-24 KST
- 발견: Wave 734 webhook endpoint 기본 동작 박았지만 카카오 공식 docs spec 미준수:
  - GET 만 지원 (POST 도 카카오 지원)
  - Authorization header 검증 없음 (위조 webhook 차단 불가)
  - CHAT_TYPE === "MemoChat" 차단 없음 (본인 나에게 보내기 매크로 risk)
  - 3초 응답 시간 명시 없음
- 사용자가 본 카카오 Console 안내: "사용자 정의 파라미터 설정을 완료해야 수신할 수 있습니다."
  → 별도 Console 메뉴 X. `serverCallbackArgs` 코드에 박은 것 자체가 설정 (공식 docs 확인).

### Kakao 공식 webhook payload

GET (query) 또는 POST (JSON body) 로 보내짐:

| 필드 | 의미 | 값 예시 |
|---|---|---|
| `CHAT_TYPE` | 채팅방 타입 | `MemoChat` / `DirectChat` / `MultiChat` / `OpenDirectChat` / `OpenMultiChat` |
| `HASH_CHAT_ID` | 채팅방 hash 고유 ID | 임의 hash |
| `TEMPLATE_ID` | 메시지 템플릿 ID | 우리는 SDK 직접 호출이라 없을 수도 |
| `<serverCallbackArgs keys>` | 우리가 박은 사용자 정의 키 | `user_id=<auth_user_id>` |

요청 헤더:
- `Authorization: KakaoAK <admin_key>` — 검증해야 위조 차단
- `X-Kakao-Resource-ID`: 중복 호출 차단용 (멱등성 token)
- `User-Agent`: Kakao 식별

### 변경 [src/app/api/kakao/share-webhook/route.ts](../../src/app/api/kakao/share-webhook/route.ts)

#### 1. GET + POST 둘 다 지원
- `handleWebhook(req, payload)` 공통 함수
- GET: `url.searchParams` → payload
- POST: `await req.json()` → payload

#### 2. Authorization 검증
- `process.env.KAKAO_ADMIN_KEY` 박혀있으면 `Authorization: KakaoAK <key>` 일치 검증
- env 없으면 검증 skip (초기 셋업 / dev 환경)
- 사용자 액션: Vercel env 에 `KAKAO_ADMIN_KEY` 추가 (Kakao Console 앱 키 페이지에서 복사)

#### 3. CHAT_TYPE === "MemoChat" 차단
- "MemoChat" = 본인 "나에게 보내기" 카톡 — 매크로 위조 위험
- DirectChat / MultiChat / OpenChat 만 보상

#### 4. maxDuration = 5s 명시
- Kakao docs: "HTTP 2xx 3초 이내 응답"
- Vercel default 10s 충분하지만 명시로 명확

#### 5. ledger metadata 강화
- `chat_type`, `hash_chat_id` 박아서 운영 통계 분석 가능

### 사용자 액션 필요

#### 1. Kakao Admin Key env 추가 (Vercel)
- https://developers.kakao.com → 내 애플리케이션 → 앱 키
- "Admin 키" 복사
- Vercel 대시보드 → 프로젝트 → Settings → Environment Variables
- 추가: `KAKAO_ADMIN_KEY=<복사한 키>` (Production / Preview 둘 다)
- redeploy 필요

#### 2. (선택) Vercel logs 모니터링
- webhook 호출 시 `[kakao-share-webhook] received` 로그 + payload 확인
- 카카오가 실제 어떤 param 으로 보내는지 검증 (`user_id`, `CHAT_TYPE` 등이 정확한지)

### 검증

- `npx tsc --noEmit` — 0 error.
- **실제 webhook 작동 확인**:
  1. KAKAO_ADMIN_KEY env 박은 후 redeploy
  2. 사용자 A → 카톡 공유 → 친구 B 에게 메시지 발송 성공
  3. Vercel logs: `[kakao-share-webhook] received { userId, chatType: "DirectChat", ... }`
  4. `bonus granted { userId, newBalance }` 확인
  5. 사용자 A balance +1, last_share_bonus_at 갱신

### 위험 / 한계

- **KAKAO_ADMIN_KEY env 없으면 Authorization 검증 skip** — 누구나 webhook URL 직접 호출 시 user_id 박아 보상 받기 가능. **반드시 env 박아야 production 안전**.
- **MemoChat 차단**으로 본인 셀프 매크로 막힘. 단 친구에게 매크로 부탁할 수도 — abuse 못 잡음. cooldown 24h 로 spam 제한.
- **X-Kakao-Resource-ID** 중복 차단 미구현 — 카카오가 같은 webhook 재시도 시 중복 지급 risk. 단 cooldown 24h 가 자연스럽게 막음.

### 다음

- Vercel env 박은 후 실제 테스트
- 첫 호출 후 Vercel logs 로 정확한 param 이름 검증 (혹시 `user_id` 아닌 다른 이름이면 endpoint 보강)
