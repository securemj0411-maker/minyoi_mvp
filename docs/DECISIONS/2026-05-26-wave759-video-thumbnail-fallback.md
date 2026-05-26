# Wave 759 — 영상 썸네일 (.mp4 등) 차단 + fallback

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "당근이나 중고나라 썸네일 영상일수도있음, 대비는?"

## 발견

DB 측정:
- **joongna**: 11/21,360 (0.05%) thumbnail_url 이 .mp4 (`img2.joongna.com/.../xxx.mp4`)
- **bunjang**: 0/372,787
- **daangn**: 0/49,697
- 풀 ready: 1건

Next.js `<Image>` 가 영상 못 렌더 → broken image. 사용자가 깨진 이미지 봄.

## 변경

### 신규 utility (`src/lib/thumbnail-utils.ts`)
- `isVideoThumbnailUrl(url)` — `.mp4|.mov|.webm|.m4v|.avi|.mkv|.hevc` 확장자 + `/video/` path 패턴 감지
- `safeThumbnailUrl(url)` — 영상이면 null, 아니면 그대로

### API 응답 9곳 — `safeThumbnailUrl()` wrap
- `src/app/api/packs/pool/route.ts` (피드)
- `src/app/api/packs/pool/detail-access/route.ts` (상세)
- `src/app/api/packs/me/route.ts` (내 매물)
- `src/app/api/packs/me/feedback-activity/route.ts` (피드백 활동)
- `src/app/api/admin/pool-listings/route.ts` (운영자풀)
- `src/app/api/admin/classification-listings/route.ts` (운영자 분류)
- `src/app/api/admin/loss-reports/route.ts` (운영자 손해)
- `src/app/api/admin/reveal-analytics/route.ts` (운영자 reveal)
- `src/app/api/listings/[pid]/market-source/route.ts` (시세 근거)

→ 영상 URL 이 클라이언트로 안 감 → UI `thumbnailUrl=null` → CategoryWatermark fallback 자동 표시.

### 인제스트 fix (`src/lib/joongna.ts:417`)
- `parseJoongnaDetailHtml` 의 `thumbnailUrl` 결정: 첫 image 가 영상이면 다음 image 시도. og:image fallback 도 영상이면 null.
- 신규 매물부터 video URL 안 박힘.

### DB cleanup (Wave 759)
- 기존 .mp4 thumbnail_url 11건 → NULL UPDATE
- 검증: `select count(*) where thumbnail_url ~* '\.(mp4|mov|webm|m4v)$'` → 0

## 검증
- `npx tsc --noEmit` 0 에러 (10개 touched 파일)
- DB 영상 thumb 0건 확인
- 영상 → fallback flow: API null → UI CategoryWatermark 표시

## 위험
- 0. 영상 → null 치환만. 정상 이미지 영향 X.

## 다음
- 추후 (선택): joongna `extractJoongnaImageUrls` 자체에서 영상 필터링 (지금은 첫 사용 시점에서 skip).
- 매물에 정말 영상밖에 없는 케이스 (rare) 는 CategoryWatermark 표시 — 의도된 동작.
