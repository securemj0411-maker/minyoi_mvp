# Wave 1199 (audit) — 사이트 전반 흐름 audit (온보딩/결제/뒤로가기 dead-end)

날짜: 2026-06-06
상태: 발견 기록 (fix 전). owner 분석 요청 → 4개 흐름 병렬 audit (general-purpose agent ×4).
규칙: 모든 발견 파일:라인 근거. 추측 "확인 필요" 표기.

## 🔴 P0 — 실제 사용자 갇힘 / 돈 묶임

### 1. 비멤버 /plans 영구 갇힘 (owner "영원히 나갈 틈 없다"의 실체) — 2개 agent 독립 확인
- `/`(page.tsx:60), `/me`(me/page.tsx:22), `/lookup`(lookup/page.tsx:25) 모두 비멤버 → `/plans` redirect.
- `/plans` 전체화면 오버레이 `fixed inset-0 z-[75]`(plans-application-flow.tsx:1738)가 AppNav(z-40)·모바일드로어(z-50)·계정시트(z-60) = **로그아웃 포함 전역 nav를 전부 덮음** → 클릭 불가.
- 뒤로가기 → 서버 컴포넌트가 다시 `/plans`로 redirect → 도로 갇힘.
- 플로우 내부에 로그아웃/홈/나가기 링크 0 (step 0~3 위저드 이동만).
- **주의**: 비멤버 피드 차단은 owner 정책(유료회원만 피드, 의도). 하지만 **탈출구 0(로그아웃조차 불가)은 버그**. 구분 필요.
- 수정: PlansApplicationFlow에 authed 비멤버에게도 보이는 "로그아웃/처음으로" 탈출 버튼, 또는 z-index를 nav 아래로, 또는 /plans에서 최소 nav(로그아웃) 렌더.

### 2. 송금 후 7분 만료 뒤 "입금했어요" → 영구 404 실패 루프 (돈 위험)
- 신규 예약은 생성 7분 후 서버 자동 rejected(expireUnpaidReservationsForUser). 토스 송금 완료 후 모달에서 "입금했어요"를 7분+ 지나 누르면 deposit-notify 404(no_pending_application, route.ts:93) → 클라 "잠시 후 다시 눌러주세요"(membership-application-client.tsx:322-326)인데 row가 영구 rejected라 **재시도 무한 실패**. 돈 나갔는데 탈출 안내 없음.
- 클라 카운트다운(reservationMsLeft, :448-454)은 표시만, 0:00 핸들러 없음.
- 수정: 404 시 "예약 만료됐어요, 다시 예약 후 입금" + openSelector 버튼. 송금만 하고 버튼 전 7분 경과 위험구간 — 만료 임박 경고 or 유예.

### 3. 거주지 "지도 탭만" 하면 미저장 → 승인 후 중복 온보딩
- /plans step 0 지도 지역 탭은 setHomeRegionDraft(null)(:1453)로 draft 비움. footer "계속"은 mapZoomed만 보고 진행 허용(:2323). saveHomeRegionDraft가 draft 없으면 그냥 통과(:1561) → 거주지 미저장 → 승인 후 /me가 /onboarding/home-region로 또 redirect(중복).
- 수정: draft 없으면 저장 차단 + 안내, 또는 footer를 homeRegionDraft!=null일 때만 활성. 근본: /plans 내부 거주지설정과 /onboarding/home-region 통합.

## 🟡 P1

### 4. 홈동네 조회 DB 일시실패 → 정상멤버 온보딩 튕김 (2개 agent 확인)
- user-home-region-loader.ts:20-25가 에러와 "미설정"을 둘 다 null 반환. page.tsx:66/me:25가 null=미설정으로 redirect. Supabase blip 시 정상멤버가 온보딩으로(다음 성공 로드 시 복귀, 하드루프 아님).
- 수정: 로더가 에러/없음 구분(throw or sentinel), 에러 시 redirect 대신 렌더.

### 5. 멤버십 연장 업그레이드 "이미 충분" → 무한 "입금 확인 중"
- membership-application-approval.ts:115-123 upgrade_target_already_met → activated:false → 폴링 종료조건(status==="approved") 영영 미충족 → 모달 무한대기. 확인 필요: RENEWAL_UPGRADE 플랜 노출 빈도.

### 6. 이메일 가입 인증메일 대기 dead-end
- auth-form.tsx:191-199 confirm 대기 시 안내텍스트만, 재전송 버튼/타이머 없음. 메일 미수신 시 멈춤. (카카오는 무관 — 즉시 세션.)

## 🧹 죽은 코드 (실害 낮음, 함정)
- /billing/checkout|manual|processing 3페이지 무조건 redirect /plans + API 4개(manual-deposit, [id], subscribe, history) 전부 410. 크레딧→멤버십 pivot 잔재.
- manual-deposit-client.tsx waiting stage(:399-426): 닫기/ESC/문의 0 + secondsLeft 0 핸들러 없는 무한대기 모달 — **하지만 진입 불가(dead)**라 사용자엔 안 닿음.
- 수정: 삭제 or 가맹승인 후 복원계획 확정. (robots.ts:14는 checkout만 차단, manual/processing 누락.)

## ❓ 확인 필요 (정책)
- 가입폼 "가입하면 매물 2개 무료"(auth-form.tsx:237) vs 실제 유료 멤버십 없이 피드 0개. owner 정책(유료회원만)이 맞으면 **카피 수정 필요**(약속 위반 + 첫 이탈).

## 🟢 P2
- /signup 고아 라우트(어디서도 미링크), explore refresh 모달 history 유령엔트리(:2692 회수 안 함), 중첩 모달 뒤로가기 전체 닫힘, 모바일 필터시트 popstate 없음, /lookup next=/plans(원위치 복귀 안 함), MarketHistoryChart onState 의존성(latent, 현재 호출처 안전).

## ✅ 양호 (안심)
- beforeunload 이탈트랩 0건. 대부분 모달 닫기/ESC/backdrop 정상. fetch 거의 finally로 스피너 해제. error.tsx/global-error/not-found 친절. 무한 리다이렉트 루프 없음(/plans가 escape hatch라 루프 끊김). 빈상태 CTA 대부분 박힘.

## 다음
owner에게 P0 3개 우선 추천. fix 착수 시 각 wave 부여.
