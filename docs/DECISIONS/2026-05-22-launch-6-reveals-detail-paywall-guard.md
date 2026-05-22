# 2026-05-22 — Launch CRITICAL #5: /api/packs/reveals/detail paywall 가드

## audit 발견 (TRUE positive)
`/api/packs/reveals/detail` POST 가 `loadRevealListingDetail` 내부 `assertRevealAccess`
만 거침. 그건 `mvp_pack_reveals` row 존재만 확인. **detail 비용 가드 없음**.

해커 시나리오:
1. 가입 → welcome pack 받음 → `mvp_pack_reveals` row 박힘 (무료)
2. 정상 흐름은 매물 클릭 시 `/api/packs/pool/detail-access` POST → credit 차감
3. **우회**: 직접 `/api/packs/reveals/detail` POST 호출 (curl) → credit 안 깎고 detail
   (description / 이미지 / 셀러 정보) 받음 무한

## fix
`/api/packs/reveals/detail/route.ts` POST 에 `hasDetailAccess` 가드 추가.
admin / beta tester 제외. 통과 X 면 402 응답.

```ts
const unlimitedAccess = isAdminUser(auth.user) || (await isBetaTesterAuthId(auth.user.id));
if (!unlimitedAccess) {
  const hasAccess = await hasDetailAccess({ user: auth.user, userRef, pid, unlimited: false });
  if (!hasAccess) {
    return NextResponse.json(
      { error: "detail_access_required", message: "..." },
      { status: 402 }
    );
  }
}
```

## UI flow 검증 (false positive 우려 해소)
사용자 짚음: "보관함 = 스크랩 한 매물만. 스크랩 하려면 detail 봐야 함."

확인:
- 스크랩 = `mvp_reveal_feedback` 의 watching row (`/api/packs/reveals/save`)
- 모달 안에서 "보관" 눌러야 박힘 → detail 모달 열어야 함
- detail 모달 열려면 → `/api/packs/pool/detail-access` 거침 → `markOpenedPid` 박힘
- → 보관함 매물 = 100% `markOpenedPid` 있음
- → 새 가드 통과 OK ✓

따라서 보관함 (user-reveal-dashboard) flow 깨질 우려 X.

## 정상 사용자 흐름
1. explore feed 카드 클릭 → `/api/packs/pool/detail-access` POST (credit 차감)
2. 모달 open → 모달 내부 추가 fetch → `/api/packs/reveals/detail` POST → **새 가드 통과**
3. 사용자가 "보관" 누름 → `mvp_reveal_feedback` watching row
4. 보관함 다시 보러 들어감 → 카드 클릭 → 같은 흐름 → **새 가드 통과**

## 영향
- 코드 변경: `/api/packs/reveals/detail/route.ts` 1 파일
- DB 변경 X
- UI 변경 X
- 정상 사용자 영향 X
- 우회 시도 시 402 응답 + console.warn 로그

## 검증
- TypeScript compile clean
- 정상 흐름: explore → detail-access → modal → reveals/detail → 통과 ✓
- 우회: 직접 reveals/detail POST → 402 ✓ (수동 테스트 권장)
