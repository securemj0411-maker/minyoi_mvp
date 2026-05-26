# Wave 775 — Mock PG processing 페이지 + 카톡 닉네임 자동

- 시간: 2026-05-27 KST
- 트리거: owner — "입금자 성명 쓰는게 이상한데; 사람들이 이상하게 볼듯. PG 된 느낌 주기위해 mock 페이지 이동 후 토스 띄워주자. 입금 확인 버튼 누르면 예전처럼 3분 그거. 카톡 로그인이니까 80%는 카톡 닉네임으로 실명 하니까 1번 (자동 prefill) 으로 가자."

## 발견 + 결정

### 1. 입금자명 input UX 문제
사용자가 직접 "입금자 성명" 입력하는 게 부담스러움 + PG 같은 인상 X. 일반인 친화 X.

### 2. 카톡 로그인 분석
- 미뇨이는 카카오 OAuth 로그인이 주력
- 90% 카톡 사용자가 카톡 닉네임 = 본명/별명으로 등록
- `displayNameForUser()` 가 이미 user_metadata.nickname / name / full_name 에서 추출 (auth-users.ts:60)
- → 카톡 닉네임 자동 박으면 충분, input 불필요

### 3. PG 느낌 UX
- "토스로 송금하기" 클릭 → `/billing/processing` mock 페이지 navigate
- 페이지 로드 → 토스 deep link 자동 호출 + "결제 처리 중" 로딩 UI
- 정식 PG 통과한 듯한 인상

## 변경

### A. `src/lib/toss-deeplink.ts` (신규)
- toss deep link helper 추출 (manual + processing 공용)
- `buildTossDeepLink(amount)`, `buildAndroidTossIntent(amount)`, `openTossSend(amount)`
- UA sniff 분기 (iOS / Android / Desktop)
- iOS fallback (setTimeout 휴리스틱) + Android intent:// fallback

### B. `manual-deposit-client.tsx`
- 입금자명 input 제거
- user state 추가 (User | null) + `autoDepositorName = displayNameForUser(user)` 자동 사용
- 카톡 닉네임 표시 box ("입금자명 (자동)") + "받는 분에게 표시" 안내
- `handleConfirm` 에서 depositorName 자동 사용 (input 제거)
- 토스 버튼: `<a href={supertoss://}>` → `<button onClick={router.push("/billing/processing")}>` 변경
- toss helper 함수 src/lib/toss-deeplink.ts 로 이동 (코드 중복 제거)

### C. `/billing/processing` (신규)
- `page.tsx` (server component) + `processing-client.tsx` (client)
- 페이지 로드 시 토스 deep link 자동 호출 (300ms transition delay)
- "결제 처리 중" 헤더 + 스피너
- "토스 앱 다시 열기" 보조 버튼 (자동 호출 실패 시 fallback)
- 카톡 닉네임 자동 표시 ("입금자명 (자동 — 카톡 닉네임)")
- **"송금 완료 — 입금 확인하기"** 큰 CTA 버튼
- submit + 3분 카운트다운 + realtime channel + polling logic (manual-deposit-client.tsx 와 동일 — copy. 추후 hook 으로 refactor 권장)
- waiting / approved / error stage UI

### D. 관리자 페이지 + 텔레그램 알림 (변경 X)
- 이미 `depositor_name` 박혀있음 (`manual-deposit-panel.tsx:173`, `submit/route.ts:125`)
- 카톡 닉네임이 `depositorName` 으로 자동 전달 → 관리자 페이지 / 텔레그램 자동 노출

## UX 흐름

**Before (Wave 774):**
1. plans → 패키지 선택
2. /billing/manual 진입
3. **계좌 복사** 또는 **토스로 송금하기** (deep link 직접)
4. 토스 앱에서 송금
5. /billing/manual 로 돌아옴
6. **입금자 성명 직접 입력** ← 사용자 부담
7. "입금 완료" 클릭 → 3분 대기

**After (Wave 775):**
1. plans → 패키지 선택
2. /billing/manual 진입
3. **"토스 앱으로 송금하기"** 클릭 → **/billing/processing 으로 navigate**
4. mock PG 페이지: 토스 deep link 자동 호출 + "결제 처리 중" UI
5. 토스 앱에서 송금 (사용자가 "받는 분에게 표시" 를 카톡 닉네임으로 박는 안내 노출)
6. 미뇨이로 돌아옴 → mock 페이지에 머무름
7. **"송금 완료 — 입금 확인하기"** 클릭 (카톡 닉네임 자동 — 입력 X)
8. 3분 대기 → 자동 grant

다른 은행 사용자 (manual page 에 머무름):
- 계좌 복사 + 본인 은행 앱에서 송금 ("받는 분에게 표시" 에 카톡 닉네임)
- /billing/manual 의 "입금 완료" 버튼 클릭 (카톡 닉네임 자동)

## 위험 요소

1. **iOS Safari user gesture 차단** — /billing/processing 진입 후 자동 토스 호출이 user gesture 없어서 일부 iOS Safari 가 차단 가능. fallback 으로 "토스 다시 열기" 버튼 제공. 사용자가 한 번 클릭하면 작동.
2. **카톡 닉네임 ≠ 통장 입금자명** — 사용자가 "받는 분에게 표시" 안 바꾸면 본인 은행 실명으로 송금됨 → 카톡 닉네임 ≠ 통장 표시 → 자동 매칭 실패 → 운영자 수동 확인 필요. 운영자 페이지에 사용자 카톡 닉네임 + 금액 표시되어 매칭 가능.
3. **logic 중복** — manual-deposit-client.tsx 와 processing-client.tsx 가 handleConfirm + realtime + polling 동일. 추후 `useManualDeposit` hook 으로 추출 권장.
4. **카톡 OAuth 외 사용자** — email 만 가입한 사용자 (이메일 OAuth 등) 는 카톡 닉네임 없음. `displayNameForUser` fallback 이 email split 으로 처리 → 작동.

## 사용자 테스트 필요

배포 후:
1. iOS Safari — /billing/processing 진입 → 토스 자동 호출 작동 확인
2. Android Chrome — 동일
3. 카톡 닉네임이 자동으로 박히는지 확인 (운영자 페이지 + 텔레그램)
4. 입금자명 다른 이름 (별명) 필요한 사용자 — 사용자가 "받는 분에게 표시" 변경하는 path 검증

## Follow-up

- `useManualDeposit` hook 추출 (logic 중복 제거)
- 관리자 페이지에 사용자 email 표시 (매칭 정확도 ↑)
- 텔레그램 알림에 카톡 닉네임 + email 둘 다 박기 (운영자 매칭 강화)
- iOS Safari 자동 호출 차단 case 모니터링 — 실패율 측정 후 별도 wave
