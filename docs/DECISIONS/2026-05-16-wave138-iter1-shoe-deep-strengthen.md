# Wave 138 (Iter 1) — 신발 깊은 강화: 사이즈 범위 + 7 변형 차단 + 3 신규 SKU + reparse

> 2026-05-16. 사용자 명령: "10번 반복. 파싱강화 + 마이닝 + 카탈로그 강화 + 오염도 보고 + 결정론 끌어올림". Iter 1.

---

## 진단 (Wave 137 직후 80건 sample 분석)

### 발견 1: parser 사이즈 범위 너무 strict
- parser 230~309만 인식. 220/225 = 키즈 차단.
- 실제: 220/225는 여성 일반 사이즈 (특히 NB 327, 호카 본디). 키즈는 130~215.
- 매물 sample: "(그레이/220)", "225사이즈", "990 v6 블랙 225" 다수.

### 발견 2: 변형 모델 7개 narrow에 흡수
- AF1: "녹타"(드레이크) / "할로윈" / "유틸리티" / "플랫폼" / "꼼데가르송"
- 993: "차이브" (그린, 한정 컬러)
- 2976: "모노" / "MIE Made in England" / "버클"
- classic_short: "뉴 하이츠" / "청키 힐"
- chuck70: "다크쉐도우" / "터보다크" / "데님"
- samba broad: "원더 화이트" / "스칼렛" / "그린 스웨이드" / "흰초"
- pegasus: "프리미엄" (이미 차단됨)

### 발견 3: 미매칭 인기 모델 3개
미매칭 raw 매물 50건 sample → 신규 broad 후보:
- **뉴발란스 327** (매물 50+/h, 30-220k, MS327/WS327 코드, variant 가격 stable)
- **아디다스 토바코** (매물 10+/h, 60-80k stable)
- **아디다스 가젤 OG** (매물 5+/h, 50-80k, 인도어와 별도)

### 발견 4: cm 표기 매물
- "26cm", "25.5cm" 형식 사이즈 표기 매물 일부 → mm 변환 필요.

## Fix

### 1. `src/lib/parsers/wave92-fashion-mobility.ts`

**사이즈 범위 230~309 → 220~309** (여성 220/225 인식):
```typescript
/(?:사이즈|size|싸이즈)\s*[:\-]?\s*(2[2-9]\d|30\d)(?!\d)/i,
```

**cm 표기 → mm 변환** 추가:
```typescript
const cmMatch = text.match(/\b(2[2-9](?:\.\d)?|30(?:\.\d)?)\s*cm\b/i);
if (cmMatch) {
  const cm = Number(cmMatch[1]);
  const mm = Math.round(cm * 10);
  if (mm >= 220 && mm <= 309) return mm;
}
```

### 2. `src/lib/generated/catalog-shoe-narrow-wave134.ts` — 6 SKU 변형 차단

| SKU | 추가 차단 |
|---|---|
| `airforce_1_low_white` | 녹타/nocta/할로윈/유틸리티/플랫폼/꼼데가르송/sb/익스페리멘탈/리액트/올검포스 |
| `airforce_1_low_black` | 동일 |
| `993` | 차이브/chive/토프/머쉬룸/msg |
| `2976_chelsea` | 모노/mie/메이드 인 잉글랜드/빈티지/버클 |
| `classic_short` | 뉴 하이츠/청키/힐/쥬얼/지퍼 |
| `chuck70_black` | 다크쉐도우/터보다크/래커드/데님/하이/타일러 |

### 3. `src/lib/generated/catalog-shoe-broad-wave133.ts` — samba 한정 차단 추가
원더 화이트/스칼렛/그린 스웨이드/흰초/messi/anatomy/프링글스/spezial 등.

### 4. `src/lib/generated/catalog-shoe-broad-wave138.ts` (신규)

#### `shoe-newbalance-327-broad` (msrp 139k, 2020)
mustNotContain: 카사블랑카/졸리랜처/ALD/KITH/스투시/Ganni/concepts/언다이드/프라이머리/" x " (콜라보 표시)

#### `shoe-adidas-tobacco-broad` (msrp 159k, 1972)
mustNotContain: Wales Bonner/Kith

#### `shoe-adidas-gazelle-og-broad` (msrp 139k, 1968)
mustNotContain: 인도어 (별도 SKU)/spzl/spezial/bold orange/Wales Bonner/Kith/Pharrell

### 5. `src/lib/catalog.ts`
```typescript
import { SHOE_BROAD_WAVE138_CATALOG } from "@/lib/generated/catalog-shoe-broad-wave138";
// CATALOG:
...SHOE_BROAD_WAVE138_CATALOG,
```

총 신발 SKU: 71 + 3 = **74 SKU**.

### 6. `src/lib/pipeline-config.ts` — 신규 query
```typescript
"아디다스 토바코", "Adidas Tobacco", "토바코 그루엔",
"아디다스 가젤 OG", "Adidas Gazelle",
"뉴발란스 327 ms327", "ws327",
```

### 7. 옛 36건 reparse (SQL DELETE)

```sql
DELETE FROM mvp_listing_parsed
WHERE pid IN (
  SELECT p.pid FROM mvp_listing_parsed p JOIN mvp_raw_listings r ON r.pid = p.pid
  WHERE p.category = 'shoe' AND p.parsed_at < '2026-05-15T22:36:00Z'
    AND (r.name ILIKE '%릭오웬스%' OR ... [22개 collab 키워드])
);
-- 36 rows deleted. 다음 tick에서 ensureParsedRows가 자동 reparse.
```

content_hash 무효화 = DB row DELETE만 가능 (Explore agent 확인). destructive 아님 (다시 분류만).

## 검증

- TypeScript: dev cache + pipeline.ts 기존 에러 외 무에러
- Tests: **195/195 pass** (7개 Wave 138 새 test + Wave 137 1개 수정 — UK3 → 220mm 인식)

## 영향 예측

| 지표 | Before (Wave 137) | After (Wave 138 Iter 1) |
|---|---|---|
| parser 사이즈 인식 범위 | 230~309 | **220~309 + cm 표기** |
| classic_mini unknown_size 41% | unknown | 220/225 인식 ↓ ~25% |
| 1460_cherry unknown_size 46% | unknown | UK + cm 인식 ↓ ~25% |
| AF1 variant 흡수 | 녹타/할로윈/유틸리티 끼어듦 | 차단 |
| 993 차이브 한정 흡수 | 일반 시세 끌어올림 | 차단 |
| 미매칭 신발 매물 | NB 327 등 ~50+/h 누락 | **3 신규 broad 매칭** |
| 옛 36건 collab 매물 | narrow에 박혀 시세 왜곡 | **다음 tick reparse → 정정** |
| parse_ready 비율 (예상) | 78.5% | **85~90%** |

## 다른 세션 알아볼 키 포인트

1. **Wave 138 Iter 1 (2026-05-16)** — 신발 catalog/parser 깊은 강화.
2. **parser 사이즈 범위 220~309** (여성 사이즈 220/225 인식) + **cm 표기** 변환.
3. **신규 broad 3 SKU**: NB 327, 아디다스 토바코, 가젤 OG (catalog-shoe-broad-wave138.ts).
4. AF1/993/2976/classic_short/chuck70 variant 차단 강화 (총 40+ 키워드 추가).
5. **옛 36건 collab 매물 SQL DELETE 완료** — 다음 tick 자동 reparse.
6. **다음 (Iter 2)**: 30분 후 측정 — parse_ready 추이, 3 신규 SKU 매칭 수, 36건 reparse 결과.

## 진행 중 — 사용자 명령

"10번 반복" 중 1/10 완료. Iter 2부터는 reparse 결과 + 신규 매물 흐름 반영해서 다시 측정 → 보강.
