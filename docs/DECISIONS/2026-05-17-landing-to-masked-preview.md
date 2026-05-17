# 2026-05-17 메인 페이지: 랜딩 → me-dashboard (비로그인 마스킹 매물)

## 사용자 의도

> "그냥 메인페이지가 지금 /me페이지가 되는거임 랜딩페이지는 혹시 나 나중에 back가능하니까 삭제하진 말고
> 마스킹해도 식별가능한건 감안하고 일단 비로그인회원한테는 어차피 마스킹이니까 번개장터 api로 삭제됬는지 판매됐는지 검증 안해도됌
> 로그인해서 볼때 비로소 1인 식별되었을 떄
> SEO는 hidden이나 다르게 해서 seo잡을수있지않음?
> 랜딩 페이지 가치보다 지금 /me를 랜딩 페이지로 했을 때 결국 cta가 더 높지 않나??"

핵심:
- 메인 진입 즉시 매물 보임 → visceral 가치 인식
- 비로그인 = 마스킹 (image blur + 매물명) + curiosity gap CTA
- 가격/차익 정확 표시 (강한 hook)
- 옛 landing 보존 (back 가능)
- 번개 API 검증 skip (비로그인 = 식별 X = 비용 0)
- SEO hidden text 로 키워드 보존

## 박은 변경 (commit `b06e976`)

### 1. `/api/preview-pool` API (새)
- mvp_candidate_pool ready 매물 fetch (band 2~3 우선)
- **카테고리 다양화 5개** — byCategory Map 으로 1개씩 (애플 편향 차단)
- 카테고리 < 5 면 랜덤 fill
- 응답: pid X, 매물명 첫 4자 + `***** *****`, image URL X
- 가격/차익/카테고리/condition_class 정확
- **60초 캐시** (재방문 시 부담 ↓)
- 검증 skip (비로그인 정합)

### 2. `PreviewMaskedDashboard` 컴포넌트 (새)
- 상단 hook: 🔥 LIVE + "지금 차익 나는 매물" + 로그인 CTA
- 매물 5장 카드:
  - image = 자물쇠 🔒 + gradient blur background (실제 image 없음)
  - 매물명 CSS `blur-[3px]` (구글 이미지 검색 우회)
  - 카테고리 emoji + ConditionChip (S급/A급/사용감 등)
  - 가격/차익 정확 표시 (강한 hook)
- 카드 클릭 → `/login`
- 하단 강조 CTA + `/intro` link
- SEO `sr-only` h1/p (옛 landing 키워드 보존)

### 3. me-dashboard-client `!user` 분기 변경
- 옛 "로그인 필요" 정적 페이지 폐기
- `<PreviewMaskedDashboard />` render

### 4. Route 재구성
- `/` (옛 PackShop landing) → `/intro` 로 이동 (back 가능)
- `/` → me-dashboard-client
- 로그인 = 정상 dashboard / 비로그인 = 마스킹 preview

## Trade-off

- **마스킹 reverse-engineer** — 가격 + 카테고리 + 등급 조합으로 식별 가능 (사용자 받아들임). 동기 강한 사용자만 우회
- **SEO 손실** — 옛 landing 페이지 메인 path 잃음. `sr-only` 키워드 + `/intro` 보존으로 mitigation. 시간 두고 검증
- **봇 / scraping** — `/api/preview-pool` rate limit 미박음. 캐시 60초 로 부담 줄임. 별도 wave 검토
- **A/B test 미박음** — 사용자 결정 (가설 강함 + 빠른 적용 우선)

## 다음 가능 작업

- `/api/preview-pool` rate limit 추가 (봇 차단)
- 새/구 landing conversion rate 측정 (analytics)
- 카드 클릭 시 로그인 모달 (페이지 이동 X) — 더 매끄러운 UX
- 신규 가입 자동 5 매물 (Phase 2)
- 5회/일 제한 + 업그레이드 prompt (Phase 3)

## Test

288/288 pass.

## Commit

`b06e976` 메인 페이지: 랜딩 → me-dashboard (비로그인 마스킹 매물 hook)
