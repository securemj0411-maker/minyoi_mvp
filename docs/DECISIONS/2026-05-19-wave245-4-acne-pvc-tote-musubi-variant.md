# Wave 245.4 — Acne PVC tote 추가 narrow 검토 + Musubi 변형 차단

날짜: 2026-05-19
컨텍스트: broad SKU narrow split — Wave 245 plan. Acne PVC tote.

## 측정 결과 (production sample, 60 days)

총 26건 broad 매칭 (Wave 243 차단 작동으로 매물 적음).

- min 45k / **median 198.5k** / max 2.2M
- Teddy 매물 2건 (Wave 243 차단 박혔지만 parser_version drift 로 잔존)
- "무스비 토트백" 220만 매물 1건 — `bag-acne-musubi` 가 잡아야 하는데 broad PVC 로 잘못 매칭 ("musubi"/"무수비" 키워드 mustNotContain 있는데 "무스비" 변형이라 우회)
- 베이커 라인 4건 (130k~207k) — 별도 narrow 가능성 있으나 매물 수 적어 보류
- 클러치/숄더/크로스 등 cross-product-type 5건

## 핵심 발견

**"무스비" — Musubi 한국 표기 변형 (기존 "무수비" 만 박혀있던 mustNotContain/mustContain 우회)**

매물 텍스트: "아크네 스튜디오 무스비 토트백 미디사이즈 블랙" → broad PVC tote 매칭됨. msrp 650k Musubi 라인 매물이지만 broad 에 잘못 들어감.

## 변경 (additive only)

### `src/lib/catalog.ts`

1. **`bag-acne-pvc-tote` mustNotContain** 에 `"무스비"` 추가
2. **`bag-acne-musubi` mustContain** 에 `"무스비"` 추가 (Musubi 한국 표기 변형 catch)

### 추가 narrow 신설 — 보류

- 베이커 라인 4건 / 클러치/숄더/크로스 5건 — 매물 수 적어 narrow 신설 ROI 낮음
- broad 가 catch-all 잘 작동 (Wave 243 차단 + Wave 245.4 무스비 추가로 충분)
- 매물 충분히 모이면 Wave 246+ 검토

## production rematch

```sql
UPDATE mvp_raw_listings SET detail_status = 'pending'
WHERE sku_id = 'bag-acne-pvc-tote'
  AND first_seen_at >= NOW() - INTERVAL '60 days'
  AND (name ~* '테디 쇼퍼|teddy shopper|테디 데님|teddy denim'
    OR name ~* 'musubi|무수비|무스비'
    OR name ~* '클러치');
```

**3건 detail_status='pending' set** (Musubi 1건 + Teddy 2건). 다음 cron tick 에서 Musubi 매물은 `bag-acne-musubi` narrow 매칭, Teddy 는 차단.

## 비파괴 정책 준수

- broad/narrow SKU 폐지 X
- mustContain/mustNotContain 키워드 additive 추가만
- DELETE/DROP 없음

## 검증

- TypeScript src/ 깨끗
- rematch 3건 만 영향 (broad 매물 26건 중 3건)

## 후속

- Acne 베이커 라인 narrow 신설 (매물 모이면)
- Wave 245 RRL/FOG/TNF Supreme 완료. Wave 245 종료.
