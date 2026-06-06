# Wave 1225 — 피드 7만원 업그레이드: 입금 직후 모달 즉시 닫힘 + 승인 토스트 안 뜸 (진짜 근본원인)

날짜: 2026-06-07 (KST)
계기: owner 재보고 — Wave 1223 fix 후에도 동일 증상. "5:00 카운트다운 뜨자마자 모달이 자동으로 닫히고, 텔레그램 승인해도 1년 연장 완료 토스트/모달이 회원에게 안 간다."

## 증상 (재현)
1. 피드 "7만원 1년 업그레이드" 오퍼 → 입금했어요 → 5분 자동승인 카운트다운(5:00) 뜨자마자 **모달 자동 닫힘**.
2. 운영자가 텔레그램으로 승인해도 회원 화면에 **"멤버십 연장 완료" 토스트/모달 안 뜸**.

## Wave 1223 가 왜 못 고쳤나
Wave 1223 은 **카드 내부 close 조건**(`activeApproved` 제거, explore-client `FeedMembershipUpsellCard` 폴링)만 고쳤다. 그런데 모달을 닫는 진짜 주체는 카드 내부가 아니라 **부모(ExploreClient)가 카드를 통째로 언마운트**하는 것이었다. → 잘못된 레이어를 고쳐서 증상 그대로.

## 근본 원인 (확정)
모달·5분 카운트다운·승인 폴러·완료 토스트가 전부 `FeedMembershipUpsellCard` **안**에 산다. 이 카드의 렌더는 두 게이트에 동시에 묶임:
1. **부모 마운트 게이트** — `shouldShowFeedUpsell = … && feedUpsellRemainingSec > 0` (explore-client:3334).
2. **카드 내부 게이트** — `if (!offerPlans.length || expired) return null;` (`expired = feedUpsellRemainingSec <= 0`, :378/660).

그리고 `feedUpsellRemainingSec`(:2851)는 **renewal application 이 "pending" 이어도 0 을 반환**(:2854-2858).

체인:
- 입금했어요 → `/api/membership/apply`(intent renewal)가 **renewal/pending** application 생성 → 카드가 `deposit_sent` 진입.
- 카드의 첫 status 폴링(2초, :548)이 `onMembershipStatusChange(payload)` → 부모 `setMembershipStatus` 로 `application = {kind: renewal, status: pending}` 갱신.
- `feedUpsellRemainingSec` → **0** → `shouldShowFeedUpsell` → **false** + 카드 내부 `expired` → **true**.
- → **카드 통째로 언마운트** → 모달·카운트다운·폴러·토스트 전부 소멸 = 증상1.
- 폴러가 죽어서 진짜 승인(텔레그램/5분 자동)을 카드가 감지 못 함 + 완료 토스트는 카드 안에서 렌더되는데 카드가 없음 = 증상2.

즉 카드가 **자기 폴링으로 자기를 언마운트**하는 self-defeating 루프. (부모의 membership 폴은 마운트 시 1회뿐이라 트리거 아님 — 카드 자신의 deposit_sent 폴이 트리거.)

## 변경 (explore-client.tsx, display/lifecycle-layer only — 결제 API/금액/승인 로직 미변경)
1. **부모 마운트 유지** (:3334): renewal application 이 pending(진행 중) **또는** approved(완료 직후·토스트 표시 구간)면 `feedUpsellRemainingSec` 가 0 이어도 카드를 마운트 유지.
   ```ts
   const feedRenewalFlowActive =
     membershipStatus?.application?.applicationKind === "renewal" &&
     (status === "pending" || status === "approved");
   shouldShowFeedUpsell = … && (feedUpsellRemainingSec > 0 || feedRenewalFlowActive);
   ```
2. **카드 내부 게이트 유지** (:660): 결제 플로우 진행 중(모달 열림/reserved/depositing/deposit_sent)에는 `expired`·`offerPlans` 비어도 `return null` 안 함 → 열린 모달 유지. `approvalToast` 는 그 위에서 먼저 렌더되므로 영향 없음.
   ```ts
   const feedFlowInProgress = offerModalOpen || requestState === "reserved" || "depositing" || "deposit_sent";
   if ((!offerPlans.length || expired) && !feedFlowInProgress) return null;
   ```

## 고쳐진 흐름
- 입금 후 첫 폴링: status=pending → `approved` false(닫지 않음) + feedRenewalFlowActive(pending) → 카드 **유지** → 5:00 카운트다운 정상.
- 텔레그램 승인 후 폴링: status=approved & id 일치 → `approved` true → setApprovalToast + 모달 close. 동시에 feedRenewalFlowActive(approved) → 카드 **유지** → **완료 토스트 렌더**(:642). 5.2초 후 토스트 소멸 → 카드 invisible(expired & flow 종료).
- 승인되자마자 바로 닫히던 것 = 첫 폴링 status 가 pending 이라 `approved` false → 더는 즉시 닫히지 않음.

## 검증
- `npx tsc --noEmit`: explore-client.tsx **0 에러**.
- 코드 추론: apply(renewal→pending) / deposit-notify(scheduled_auto_approve_at=now+5m) / status(latest by created_at, inline auto-approve only when scheduled<=now) 3 라우트 교차 확인 — pending 5분 유지 확정.
- **실사용 검증 권장(owner)**: 회원 계정 → 7만원 오퍼 → 입금했어요 → 5:00 유지 확인 → 텔레그램 승인 → "멤버십 연장 완료" 토스트 확인. (Telegram/회원 계정 필요라 dev-env owner 검증.)

## 위험 / 주의
- lifecycle-layer only. 결제/승인/금액/만료 계산 미변경.
- 승인 완료 후 카드는 mounted-but-null(invisible)로 남았다가 reload 시 정상적으로 안 보임(activePlan=renewal → feedUpsellRemainingSec 0). 시각 artifact 없음.
- 두 번째 `FeedMembershipUpsellCard`(비회원 온보딩 빈 상태, :5435)는 renewal 무관 + 카드 내부 fix 가 모달 보호 → 동일 보호.
- 별 wave(1224 sold-confidence)와 무관한 hotfix. 같은 파일(explore-client.tsx) 다른 영역.
