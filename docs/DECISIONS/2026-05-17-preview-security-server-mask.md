# 2026-05-17 preview-masked 보안 강화 — DevTools 우회 차단

## 사용자 critical 지적

> "그냥 제목도 블러로 하자; 다 특정되겠네;;
> 블러만 하면 개발자도구에서 보이는거 아님??
> 지금 사진도 개발자도구로 원본 사진 보이는데; 해결좀 어케안되나..??"

이전 방식 (CSS blur + 단어 노출) DevTools 우회 가능:
- Network 탭: 원본 image URL 그대로 fetch
- Elements 탭: CSS blur 제거 시 원본 보임
- DOM 텍스트: "갤럭시 S** 울트라 ***GB 자급제 풀박스" → 단어로 식별 가능
- 보안 약함, 정책 retract 필요

## 박은 변경 (commit `4e86958`)

### 1. `/api/preview-pool` 응답에서 `thumbnailUrl` 제거
- 원본 image URL 클라이언트 노출 X
- DevTools 봐도 image URL 흔적 없음
- backend 에서 fetch 한 thumbnail_url 자체를 응답 안 함

### 2. 제목 마스킹 강화 (`maskName` 재작성)

```ts
function maskName(name) {
  return name.trim().split(/\s+/).map((w) => {
    if (w.length <= 1) return w;
    return w.charAt(0) + "*".repeat(Math.min(w.length - 1, 4));
  }).join(" ");
}
```

- 단어별 첫 글자만 + ****
- 예: "갤럭시 S24 울트라 512GB 자급제 풀박스" → **"갤** S** 울** 5**** 자** 풀**"**
- 식별 가능성 거의 0 (브랜드/카테고리 느낌만 유지)
- 서버에서만 mask string 생성 (client-side 우회 불가)

### 3. frontend `preview-masked-dashboard`
- `thumbnailUrl` field 제거
- SVG icon + gradient 만 표시 (이미 fallback 박혀있음, 항상 활성)
- next/image Image import 제거 (unused)

## Trade-off

- "진짜 사진 + 약한 blur" 정책 (commit 486a90d) → 보안 우선 retract
- 사용자 신뢰는 다음으로 build:
  - 카테고리별 SVG icon + gradient 색깔 (시각 다양성)
  - condition chip (S급/A급/사용감 등 정확 표시)
  - 가격/시세/차익/수익률 정확 표시 (정확한 데이터 = 신뢰)
- "사기 같다" 우려 — 차익 숫자 정확성으로 mitigation

## 추가 옵션 (보류)

- 서버 사이드 sharp blur — 원본 fetch + blur 처리 + 캐시 후 serve. `next/image` `placeholder="blur"` + dynamic blurDataURL
- 비용: sharp 설치 + 캐시 infra. 별도 wave 검토 필요

## Test

288/288 pass.
