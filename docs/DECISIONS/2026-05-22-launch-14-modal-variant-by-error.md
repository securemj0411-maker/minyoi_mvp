# 2026-05-22 — Launch additional: detail-access error 별 모달 variant 분기

## 사용자 짚음
> "만약 사용자화면엔 검증하고 나왔는데 그 사이에 invalidate됬다거나 하면 크레딧 충전하고
>  더보기 이 모달이 아니라; 해당 상품은 방금 거래되었어요 죄송해요 나 다른 모달이 나와야
>  되는거 아님..?? 지금은 이 상품은 상세보기가 안된다 이렇게 나오는데"

정확. 같은 모달이 매물 거래완료 / 크레딧 부족 / 통신 실패 모두 동일 톤. 사용자 헷갈림.

## 변경 (3 variant 분기)
```ts
type DetailAccessLimitVariant = "paywall" | "sold" | "verify_fail";
```

| Error code | Variant | 모달 톤 |
|---|---|---|
| `insufficient_credits` | `paywall` | 크레딧 충전 안내 (현재 UI) |
| `not_ready` (sold/disappeared/invalidate) | `sold` | "방금 거래된 상품이에요" + 새로고침 버튼 |
| `live_verify_unavailable` | `verify_fail` | "잠시 통신 불안정" + 재시도 버튼 |
| `detail_access_required` (보관함 race) | `paywall` fallback | 크레딧 안내 |
| network error (catch) | `verify_fail` | 재시도 |

## UI 변경
- **icon**: paywall=CreditIcon (blue), sold=X-circle (rose), verify_fail=clock (amber)
- **eyebrow**: "크레딧 상세보기" / "방금 거래된 상품" / "잠시 후 다시 시도"
- **크레딧 정보 박스**: paywall variant 일 때만 표시. sold / verify_fail = hide
- **action button**:
  - paywall = 기존 (크레딧 충전 + 가치 summary)
  - sold = "새로고침해서 다른 매물 보기" (window.reload)
  - verify_fail = "다시 시도하기"

## 메모리 룰 합치
- 일반인 친화: 사용자가 매물 거래완료 ≠ 크레딧 부족 ≠ 통신 실패 명확히 구분
- 정직 카피: 매물 거래완료 = "방금 거래된 상품" (이전 wave launch-5 sold_out 카드와 동일 카피)
- decision log: 이 파일

## 검증
- TypeScript compile clean
- production deploy 후 LEGO 매물처럼 invalidate 됐을 때 sold variant 모달 뜨는지 확인
- 크레딧 0 사용자 매물 클릭 → paywall variant
- 네트워크 끊김 → verify_fail variant
