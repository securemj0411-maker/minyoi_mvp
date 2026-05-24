# Wave 762 — Hoka × Satisfy Mafate SKU catalog leak fix

**날짜**: 2026-05-24
**Wave**: 762 (사용자 #2 reveal 매물 발견)
**Owner**: Claude

## 사용자 보고

사용자가 본 두 매물:
1. **운영자 풀** (pid 추적 불가): "호카 새티스파이 마파테 스피드 4 라이트 러버 250" — 매입 450K / 시세 600K — 비교 매물 **9건**
2. **사용자 reveal** (pid 402358802): "호카 x 새티스파이 클리프톤 LS 265 블랙" — 매입 430K / 시세 465K — 비교 매물 **1건**

사용자 질문: "같은 sku 같은데 왜 비교매물이 다른거지??"

## 진단

같은 SKU `shoe-hoka-mafate-satisfy-collab` 인데 두 가지 fragmentation:

### 1. Catalog mustNotContain 누락 — "클리프톤" 받침 변형
- 기존: `"clifton", "클리프턴"` 박혀있음
- 사용자 매물: "**클리프톤**" (받침 ㄴ → ㅗ)
- 결과: 클리프톤 매물 (Hoka × Satisfy **Clifton LS** — 마파테와 완전 다른 모델) 가 Mafate SKU 흡수
- 비교 매물 풀에 클리프톤 매물 섞임 → 시세 평균 왜곡

### 2. Parser product_type fragmentation
- 마파테 매물 다수 → `product_type=sneaker` → `comparable_key: shoe|hoka_mafate_satisfy_collab|sneaker|a_grade`
- 클리프톤 매물 → `product_type=boot` (잘못 추출) → `comparable_key: shoe|hoka_mafate_satisfy_collab|boot|b_grade`
- 같은 SKU 인데 product_type 다름 → comparable_key 두 종류로 갈라짐 → 비교 매물 풀 분리

결과: 사용자가 본 reveal 매물은 `boot|b_grade` 시세 (1건만 있는 작은 sample) 와 비교 → 잘못된 가격 추정.

### 3. mustContain 너무 관대 — broad "콜라보" 매물 흡수
- "호카 새티스파이 콜라보 270사이즈" 같이 모델명 (마파테/클리프톤/본디 등) 명시 안 한 broad 매물도 마파테 SKU 매칭
- broad 매물 평균이 마파테 시세에 섞이면서 fragmentation 가중

## Fix

### 1. `catalog-712c-shoe-bulk.ts` — Mafate Satisfy SKU 강화

```typescript
mustContain: [
  ["hoka", "호카"],
  ["새티스파이", "세티스파이", "satisfy"],
  ["마파테", "mafate"],  // ← Wave 762 추가: 모델명 명시 매물만 매칭
],
mustNotContain: [
  ...COMMON_NOISE,
  "bondi", "본디",
  "clifton", "클리프턴", "클리프톤",  // ← Wave 762 추가: 받침 변형 (ㄴ→ㅗ)
  "엑슬림", "xlim",
],
```

### 2. Parser version bump

`wave92-shoe-v39` → `wave92-shoe-v40`. drift gate 신발 매물 reparse 큐 진입. 잘못 매칭된 클리프톤/broad 매물 자동 SKU 해제.

### 3. DB 즉시 정리

```sql
WITH bad_matches AS (
  SELECT cp.pid FROM mvp_candidate_pool cp JOIN mvp_listings l ON l.pid = cp.pid
  WHERE cp.comparable_key LIKE '%hoka_mafate_satisfy_collab%'
    AND cp.status = 'ready'
    AND (l.name ILIKE '%클리프톤%' OR l.name ILIKE '%clifton%'
         OR (l.name NOT ILIKE '%마파테%' AND l.name NOT ILIKE '%mafate%'))
)
UPDATE mvp_candidate_pool SET status='invalidated', invalidated_reason='wave762_hoka_mafate_catalog_leak';
```

결과: 2건 invalidate (사용자 본 reveal 매물 pid 402358802 포함). 

## 영향

- 클리프톤 매물이 마파테 시세에서 빠짐 → 마파테 SKU 비교 풀 깨끗
- broad "콜라보" 명시 매물도 매칭 차단 (마파테 강제)
- 사용자가 잘못된 시세 보고 매입할 위험 제거 (reveal 매물 차익 +35K → 실제 클리프톤 시세 와 다름)

## 남은 작업 (별도 wave)

- **Hoka × Satisfy Clifton LS SKU 신설** (별도 SKU 로 정상 시세 추적 — 매물 다수 발견)
- **Parser product_type=boot 잘못 추출 원인 파악** — 클리프톤 매물에서 어떤 keyword 가 boot 매칭 시켰는지 (지금은 catalog 차단으로 회피)
- **condition_class / condition_tier / comparable_key tier 일관성 audit** — pid 402358802 의 class=clean / tier=A / comparable_key b_grade 미스매치 발견

## 관련 commit

- `d710651`: Wave 761 — AI hold 매물 invalidate 차단
- 본 commit: Wave 762 — Hoka Mafate catalog mustNotContain 클리프톤 추가 + mustContain 마파테 강제
