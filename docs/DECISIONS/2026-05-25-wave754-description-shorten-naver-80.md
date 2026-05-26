# Wave 754 — 사이트 description 80자 이내로 단축 (네이버 권장)

- 시간: 2026-05-25 KST
- 트리거: 네이버 서치어드바이저 진단 — "사용자가 쉽게 사이트를 파악할 수 있도록 80자 이내로 설명문을 작성해주세요". 현재 ~140자.

## 변경

`src/app/layout.tsx` `DESCRIPTION` 상수:

before (~140자):
> "공개된 중고 매물의 시세를 AI가 비교해서, 시세보다 저렴한 매물 정보를 알려드립니다. 옵션 같은 본품끼리만 비교하고, 공개 직전 판매 상태를 다시 확인합니다. 매물 진위·거래 결과는 보장하지 않으며, 최종 판단은 이용자가 합니다."

after (49자):
> "AI가 매일 분석한 중고 매물 시세 비교. 시세보다 저렴한 알뜰 득템 정보를 알려드려요."

면책 ("매물 진위·거래 결과 보장 X, 최종 판단 이용자") 은 `/terms` 및 footer 에 박혀 있어서 description 자리엔 분리.

`metadata.description` + `openGraph.description` + `twitter.description` 모두 같은 상수 참조 → 한 번 변경에 3곳 동시 적용.

## 검증
- 49자 ≤ 80자 (네이버 권장) ✅
- `npx tsc --noEmit` 0 에러
- 검색 키워드 (AI, 중고, 매물, 시세 비교, 알뜰, 득템) 다 포함

## 위험
- 면책 disclaimer 가 OG 미리보기에서 사라짐 — 카톡 공유 시 사용자가 면책 못 봄. 단 사이트 진입 후 footer/terms 에서 확인 가능 → 법적 위험 X.
- description 짧아져 SEO 키워드 dense 감소 — 단 80자 권장은 사용자 가독성 우선이라 trade-off 정상.

## 다음
- Vercel 재배포 (자동) 후 https://minyoi-mvp.vercel.app/ 페이지 소스에서 `<meta name="description">` 갱신 확인.
- 네이버 서치어드바이저 → "사이트 설명" 항목 새로고침 (자동 재크롤 또는 수동 "수집 요청").
