# Wave 801 — 텔레그램 inline button 입금 승인 (운영자 세션 불필요, 4-layer 보안)

## 사용자 결정

> "입금 승인 거절 그거 나 텔레그램 왔을때 누르는거 있잖아 그거 그냥 나 카카오 로그인 운영자 세션 없어도 되게 하면 안됌?? 위험함?? 너가 나한테 텔레알림을 보내면 그 텔레그램을 통해서 눌러야만 가능하게 하는 식으로 하면 보안도 잡지않나?"

→ 정석 4 layer 박음. 카카오 세션 layer 와 동급 안전.

## 배경

기존 (`/api/admin/manual-deposit/decide` GET):
- 텔레그램 알림 [✅ 승인] 텍스트 링크 클릭 → 새 브라우저 → `requireSupabaseUser` 가 카카오 세션 요구 → 세션 없으면 로그인 안내
- 운영자가 모바일 → 카카오 로그인 → 다시 링크 클릭 → 처리 (UX 마찰)

사용자 인사이트:
- 텔레그램 알림이 운영자 chat 에만 가는 보안 신호 자체로 활용
- 인라인 버튼으로 1-tap 처리 = UX 깔끔
- 다중 layer 박으면 카카오 세션과 동급 안전

## 변경

### 신규: `src/lib/telegram-callback-token.ts`
- HMAC-SHA256 sign/verify + expiry (Unix epoch seconds)
- Callback data 64 byte 한도 (텔레그램 사양): `v1|md|<id>|<approve|reject>|<expSec>|<sig12>` (sig 96-bit prefix)
- `TELEGRAM_CALLBACK_TOKEN_SECRET` env (또는 ADMIN_ACTION_TOKEN_SECRET fallback)

### 보강: `src/lib/telegram-notify.ts`
- `notifyAdminTelegram(msg, { replyMarkup })` — inline keyboard 지원
- `answerCallbackQuery(id, text)` — 운영자 토스트 (✅ 승인 완료)
- `editAdminMessageText(chatId, msgId, newText)` — 처리 후 메시지 갱신 (버튼 사라짐 + 결과 표시)

### 신규: `src/app/api/telegram/admin-webhook/route.ts`
운영자 봇 webhook — callback_query 전용. 4 layer:

| Layer | 검증 |
|---|---|
| **L1: Webhook secret** | `X-Telegram-Bot-Api-Secret-Token` header == `ADMIN_TELEGRAM_WEBHOOK_SECRET` |
| **L2: Admin user ID** | `callback_query.from.id` == `ADMIN_TELEGRAM_USER_ID` (env) |
| **L3: HMAC + expiry** | `verifyTelegramCallback` — sig 매칭 + `expSec >= now` |
| **L4: DB status** | `mvp_manual_deposit_requests.status == 'pending'` (double-click / replay 방지) |

통과 → `grantManualDeposit` / `rejectManualDeposit` 호출 → 토스트 + 메시지 갱신.

### 변경: `src/app/api/billing/manual-deposit/route.ts`
- 텔레그램 알림에 inline keyboard 박음 (TTL 30분, auto-approve 3분 보다 길게)
- 텍스트 백업 링크 유지 (`signAdminAction` URL) — secret 미박힘 / 옛 메시지 호환

## 보안 비교 (vs 카카오 세션 layer)

| 위험 | 카카오 세션 (지금) | 텔레그램 callback (Wave 801) |
|---|---|---|
| 위변조 (텔레그램 → 우리 서버) | n/a | webhook secret header ✓ |
| 1차 인증 | 카카오 OAuth | 텔레그램 from.id 매칭 ✓ |
| Replay (오래된 링크 재사용) | request status 'pending' | HMAC expiry (30분) + status ✓ |
| Token URL leak (text 복사) | HMAC URL | callback_data leak 도 admin from.id 검증 필요 |
| Bot token leak | n/a | 봇으로 메시지 보낼 수 있어도 callback 처리는 from.id 검증 통과 못 함 |
| 디바이스 hijack | 카카오 PC/모바일 어디서나 | 텔레그램 본인 디바이스 + 잠금 (보통 더 어려움) |

→ **텔레그램 layer 가 카카오와 동급 또는 약간 우위** (디바이스 제약 + 4-layer).

## 운영자 박을 env (배포 전 필수)

Vercel:
```
ADMIN_TELEGRAM_WEBHOOK_SECRET=<임의 32+ char strong secret>
ADMIN_TELEGRAM_USER_ID=<운영자 텔레그램 user.id 숫자>
TELEGRAM_CALLBACK_TOKEN_SECRET=<임의 32+ char strong secret>  # optional, fallback 으로 ADMIN_ACTION_TOKEN_SECRET 사용
```

운영자 텔레그램 user.id 알아내는 법:
1. 운영자 봇 (@minyoi_alert_bot) 에 아무 메시지 보냄
2. `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getUpdates` 호출 → `message.from.id` 확인

## setWebhook (한 번)

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://minyoi-mvp.vercel.app/api/telegram/admin-webhook",
    "secret_token": "<ADMIN_TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["callback_query"]
  }'
```

확인:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## 효과

- 운영자가 텔레그램 inline button [✅ 승인] / [❌ 거절] 1-tap → 즉시 처리
- 카카오 세션 / 모바일 로그인 마찰 제거
- 텍스트 백업 링크 유지 (secret 미박힘 시 fallback)
- 처리 후 텔레그램 메시지 자동 갱신 (버튼 사라짐 + 결과 표시) → 중복 클릭 방지 UX

## 비파괴 보장

- 기존 `/api/admin/manual-deposit/decide` GET endpoint 그대로 (텍스트 링크 작동)
- 기존 카카오 세션 flow 유지 — 운영자 선택 가능
- inline keyboard secret 미박힘 시 = 버튼 누르면 reject (webhook 401), 텍스트 링크는 그대로 작동
- `grantManualDeposit` / `rejectManualDeposit` 로직 변경 X — 같은 RPC 호출

## Trade-off

- ✅ 거의 없음 (carefully designed)
- ⚠️ 운영자 텔레그램 hijack 위험 — 카카오 hijack 과 동급 (현실적으로 더 어려움)
- ⚠️ Bot token leak 시 부정 알림 가능하지만 callback 처리는 from.id 검증으로 차단
- ⚠️ env 셋업 (3개) 한 번 박아야 됨 — 미박힘 = inline button 무력화 (텍스트 링크 작동)

## 검증

배포 후:
1. env 3개 박음 + setWebhook 박음 → `getWebhookInfo` 확인
2. /me → 충전 신청 → 텔레그램 알림 도착 + 버튼 보임
3. [✅ 승인] 누름 → "✅ 승인 완료" 토스트 + 메시지 갱신 + 사용자 크레딧 잔액 확인
4. 같은 알림 한 번 더 누름 → "이미 처리됨" 토스트 (L4 방어)
5. (테스트) 운영자 아닌 텔레그램 계정으로 같은 봇 메시지 forward → 버튼 못 누름 (L2 방어)
6. (테스트) 30분 후 옛 버튼 누름 → "만료된 버튼" 토스트 (L3 방어)

## 복원 가이드 (위험 신호 시)

**위험 신호**:
- 비정상 승인 (운영자 아닌 곳에서 처리됨)
- callback_query 401/403 폭증 → secret 누설 의심
- env 변경 후 inline button 작동 안 함

**즉시 fallback** (3 단계):

1. setWebhook 해제 (Telegram → 우리 서버 callback 끊김):
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
   ```
   → 텔레그램 버튼 무력화, 텍스트 백업 링크는 그대로 작동.

2. 또는 manual-deposit/route.ts 의 inline keyboard 제거 (text-only):
   ```diff
   - await notifyAdminTelegram(msg, { replyMarkup: inlineKeyboard });
   + await notifyAdminTelegram(msg);
   ```

3. env 회전:
   - `ADMIN_TELEGRAM_WEBHOOK_SECRET` 새 값 박음 + setWebhook 재호출
   - `TELEGRAM_CALLBACK_TOKEN_SECRET` 새 값 박음 → 옛 callback URL 자동 무효

## What Not To Do

- L2 (from.id 매칭) 만 박지 X — webhook secret 없으면 누구나 callback 위조 가능
- L3 (HMAC) 없이 박지 X — admin chat ID leak 시 부정 클릭 가능
- L4 (DB pending check) 없이 박지 X — replay / double-click 으로 중복 grant
- expiry 무한으로 박지 X — leak 된 callback 평생 사용 가능. 30분 = 합리적 (auto-approve 3분 + 운영자 늦게 봐도 OK)
- 버튼 누른 후 editMessageText 박지 않으면 X — 중복 클릭 → "이미 처리됨" 토스트 박지만 메시지 그대로 → 운영자 confuse

## 관련 commits / PRs

- 새 PR — Wave 801 telegram inline approval

## Related Waves

- Wave launch-96 — 입금 신청·승인 모델 (3분 auto-approve)
- Wave launch-96 — admin-action-token (HMAC text URL)
- Wave 199 — `notifyAdminTelegram` 도입
- Wave 800 — 카카오 OAuth 가입 telegram 알림 fix (ConsentFlusher)
- **Wave 801 (now)** — 텔레그램 inline button 승인 (4-layer)
