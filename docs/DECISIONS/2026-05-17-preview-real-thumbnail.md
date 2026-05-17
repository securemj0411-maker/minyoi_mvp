# 2026-05-17 preview-masked: 진짜 thumbnail + CSS blur

## 사용자 지적

> "지금 장난하는거야?? 왜 사진을 svg인가 이거로 했냐?? fallback인거야??
> 진짜 사진을 보여주되 20%정도 블러만 해야지; 뭐하는거지?"

이전 polish (commit 1c4d6d3) 가 emoji + gradient 만 박음 — 사용자 의도 ("진짜 사진 + 약한 블러") 와 정반대.

## 박은 변경 (commit `486a90d`)

### `/api/preview-pool`
- `thumbnail_url` column 추가 (mvp_listings 에서 fetch)
- 응답에 `thumbnailUrl` field 박음

### `preview-masked-dashboard`
- Next `<Image>` 컴포넌트 사용 (next.config 에 media.bunjang.co.kr 이미 허용)
- `blur-[4px]` CSS 적용 — 약한 블러 (사용자 인식 OK + 구글 reverse 검색 방해)
- 카테고리별 gradient background 유지 — blur 가장자리 자연
- emoji 는 thumbnail 없을 때 fallback 만

## Trade-off

- thumbnail URL 자체는 노출됨 (CSS blur 만이라 원본 URL fetch 가능)
- 봇/scraper 가 원본 URL → 구글 reverse 검색 가능
- 사용자 명시 "마스킹해도 식별가능한건 감안" — 받아들임
- 동기 강한 사용자만 우회 가능 (대다수 사용자에겐 호기심 trigger)

## Test

288/288 pass.
