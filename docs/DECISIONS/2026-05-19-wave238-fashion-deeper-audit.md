# Wave 238 (2026-05-19) — fashion 추가 audit (안 본 broad/narrow SKU)

## 발단

사용자: "일단 우리 fashion쪽 완벽한거맞음??"

정직 답: 완벽 X. Wave 237 도 fashion (RRL 팔찌 / TNF Supreme 데이팩) 발견. 추가 sample 검증 진행.

## 발견 mismatch (4건)

| SKU | mismatch | 사례 |
|---|---|---|
| `clothing-acne-apparel` | **신발 매물** 의류 SKU 매칭 | "아크네 바틸다 삭스슈즈 러너" 300k / "네오프렌 스틸레토 부티" 249k |
| `clothing-mm6-margiela` | **다른 brand** | "준지 롱셔츠 롱야상 MM67" 150k (Juun.J — MM6 X) |
| `clothing-mlb-cap` | broad SKU (의류 + cap) | "뉴에라 LA다저스 반팔 티셔츠" 35k — 정책 적정 (parser 분리) |
| `bag-lululemon-backpack` | broad SKU (백팩 + 토트 + 슬링) | "데일리 토트백 20L" 70k — 정책 적정 (parser 분리) |

처음 2건만 catalog fix. 후속 2건은 SKU broad 정책 그대로 (parser product-type 추출이 시세 자동 분리).

## fix

### 1. CATEGORY_FASHION_NOISE.clothing 추가 (cross-category 신발 패턴)
```ts
"부티", "booties", "삭스슈즈", "삭스 슈즈", "sock shoes",
"러너 슈즈", "runner shoe", "러닝화", "트레이너", "trainer",
"슈즈", "shoes",
```
근거: Wave 230 에 운동화/스니커즈/부츠/샌들/슬리퍼/뮬 박혀있지만 **"부티" (ankle boot) / "삭스슈즈" / "러너 슈즈" / "트레이너"** 누락. Acne Studios 의 신발 매물 통과.

### 2. clothing-mm6-margiela mustNotContain 강화
```ts
"준지", "juun", "juun.j", "juun j",
```
근거: Juun.J 의 모델명 "MM67" 같은 변형이 mustContain "mm6" 통과. brand 명시 차단.

## 검토 결과 정상 SKU (mismatch 없음)

- `bag-acne-musubi` — 무수비 매물만 정상
- `bag-adidas-cross-mini` — 피오루치 collab 등 cross-mini 매물 정상
- `bag-kitsune-tote` — 폭스헤드 토트백/에코백 정상 (에코백 ≈ tote)
- `bag-margiela-glam-slam` — 글램슬램 multi (미디움/웨이스트/크로스/호보) 정상
- `bag-stussy-waist-bag` — 웨이스트백/힙색 정상
- `clothing-discovery-expedition` — 패딩/후드집업/바람막이/맨투맨 broad 정상
- `clothing-stussy-dior-collab` — 디올 × 스투시 정상
- `clothing-stussy-nike-collab` — 나이키 × 스투시 정상
- `clothing-lacoste-pique-polo` — 라코스테 폴로 정상
- `shoe-stussy-nike-collab` — 나이키 × 스투시 신발 정상

## 파일 변경

- `src/lib/catalog.ts` — CATEGORY_FASHION_NOISE.clothing 부티/삭스슈즈/슈즈 추가 + clothing-mm6-margiela mustNotContain 준지

## 미완

- DJI 본품 매물 sample (Wave 237 강화 후 false positive 없는지 검증)
- 다른 카테고리: perfume / kickboard / lego / 헤어 기기 / 소형 가전
- broad SKU narrow split 검토 (Stussy Hoodie / RRL 등 — 시세 정확성 더 향상 가능)
