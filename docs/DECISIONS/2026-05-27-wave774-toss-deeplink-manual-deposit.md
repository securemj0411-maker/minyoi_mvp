# Wave 774 — 토스 송금 deep link manual deposit prefill

- 시간: 2026-05-27 KST
- 트리거: owner — "우리 사이트 그냥 계좌번호 치고 입금하라고해서 별로임. supertoss:// deep link 참고해서 간편하게 할 수 있을 거 같은데?"

## 발견 — 토스 송금 deep link 작동 spec

```
supertoss://send?bank={한글은행명}&accountNo={숫자}&amount={원}&origin=qr
```

폭넓은 조사 결과:
- **외부 사이트에서 송금 화면 prefill 가능한 건 토스 하나뿐** (카뱅/시중은행/네이버페이/카카오페이 모두 spec 비공개 or 미지원).
- `bank=우리`, `accountNo=1002367160511`, `amount=29900` 박으면 토스 앱에서 우리은행 미뇨이 계좌 + 금액 자동 채워짐. 미뇨이가 토스뱅크 안 써도 OK.
- iOS · Android 양쪽 작동 (커뮤니티 검증).
- **공식 spec 비공개 — reverse-engineered.** 토스 앱 업데이트로 깨질 risk.
- 입금자명 prefill 파라미터 없음 (토스가 본인 명의 자동 처리).

## 변경

### `src/app/billing/manual/manual-deposit-client.tsx`

**Constants 추가** (line 14~22):
```ts
const TOSS_BANK_PARAM = "우리";
const TOSS_APP_STORE_URL = "https://apps.apple.com/kr/app/id839333328";
const TOSS_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=viva.republica.toss";

function buildTossDeepLink(amount: number): string { ... }
function buildAndroidTossIntent(amount: number): string { ... }
```

**UI** (계좌 카드 아래):
- `<a href={buildTossDeepLink(plan.priceKrw)}>` — "토스 앱으로 송금하기" 큰 CTA (입금 완료 button 과 같은 크기)
- `onClick`: UA sniff
  - Android: `e.preventDefault()` + `window.location.href = intent://...` (Chrome 이 Play Store fallback 자동 처리)
  - iOS: `<a href>` 그대로 작동 + 1.5s setTimeout 휴리스틱 (앱 안 떠 있으면 App Store redirect)
  - Desktop: `<a href>` 그대로 (대부분 안 됨, 사용자가 모바일 사용 가정)
- 보조 텍스트: "토스 앱이 송금 화면을 자동으로 채워줘요. 다른 은행은 위 계좌번호 복사 후 본인 은행 앱에서 송금해주세요."
- `tossOpened` state — 클릭 시 안내 메시지 노출 ("송금 완료 후 입금자 성명 입력 + '입금 완료' 클릭")

### UX 흐름

Before (8 step):
1. 계좌 복사 → 2. 은행 앱 열기 → 3. 계좌 붙여넣기 → 4. 금액 입력 → 5. 송금 → 6. 미뇨이 돌아오기 → 7. 입금자명 입력 → 8. 입금 완료

After (3 step):
1. **"토스로 송금하기" 클릭** (계좌 + 금액 자동 prefill) → 2. 토스 앱에서 송금 + 돌아옴 → 3. 입금자명 입력 + 입금 완료

## 보안 / 리스크

- **토스 비공식 spec** — 토스 앱 업데이트로 깨질 가능성. 카나리아 모니터링 (deep link 클릭 → 입금완료 도달률) 별도 wave 권장.
- **앱 내 브라우저 (카톡, 인스타) deep link 거부 가능** — 사용자가 카톡 링크 통해 들어오면 토스 안 열림. fallback 으로 계좌 복사 path 유지됨.
- **타 은행 사용자** — "왜 카뱅 버튼은 없나요?" 가능. 보조 텍스트로 명시 ("다른 은행은 계좌번호 복사").
- **입금자명 prefill 불가** — 토스 본인 명의 자동 처리. 미뇨이 "입금자 성명" 필드 유지 필요 (자동 매칭).
- **상표권** — "토스" 로고/이미지 사용 안 함. 텍스트만 ("토스 앱으로 송금하기").
- **사기 패턴 (대포통장 + supertoss:// 악용)** — 한국 PG 가맹 우회 사기에 같은 도구가 쓰임. 미뇨이는 실명 사업자 + PortOne PG 심사 중 + 환불 정책 → 본질적으로 다름. 사용자한테 deep link 도착 후 토스 송금 확인 화면에서 "우리은행 1002... 이민제" 명시 노출됨 → 정상 사업자 인지 가능.

## PG 가맹 통과 후

PortOne 통합 PG 가맹 승인되면:
- `/billing/manual` 흐름 → `/billing/checkout` 카드결제 흐름으로 전환
- 토스 deep link 는 보조 path 로 유지 (구독자 등 일부 사용자에게 유용)
- 또는 토스페이 정식 결제 (`pay.toss.im`) 으로 업그레이드 (PortOne 가맹 후 활성화 가능)

## Testing — owner action 필요

배포 후 owner 가:
1. **iOS Safari** — plans → 패키지 선택 → 입금 페이지 → "토스 앱으로 송금하기" 클릭
   - 토스 앱 자동 열림 + 우리은행 + 1002-367-160511 + 금액 prefill 확인
   - 토스 미설치 디바이스에서 App Store redirect 확인
2. **Android Chrome** — 동일 시나리오 + Play Store fallback 확인
3. **카톡 in-app 브라우저** — 작동 여부 확인 (안 되면 "외부 브라우저로 열기" 안내 별도 wave)
