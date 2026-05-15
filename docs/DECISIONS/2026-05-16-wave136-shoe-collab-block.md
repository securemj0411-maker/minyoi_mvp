# Wave 136 — 신발 narrow SKU collab/한정판 차단

> 2026-05-16. 2시간 측정 후 발견된 오염도 fix. LAUNCH_PLAN 12b (Precision > Recall) 적용.

---

## 발견 (2시간 후 측정, 2026-05-16 07:30 KST)

Wave 134 narrow 30 SKU 측정 결과 (raw 2,217 / parsed 1,110 / match_rate 100%):

**오염도 검출** — 한정판 collab이 일반 narrow SKU에 끼어들어 시세 왜곡:

| Narrow SKU | Total | Collab | Collab 예시 | 가격 영향 |
|---|---:|---:|---|---|
| `gel_1130` | 6 | 5 (83%) | 아트모스/오호스/I4P/할스튜디오 | 일반 7만 → collab 25만+ |
| `airforce_1_low_black` | 45 | 5 (11%) | 스투시 트리플 블랙 | 일반 15만 → 스투시 45만 |
| `992` | 46 | 5 (11%) | 패커/자운드/DTLR | 일반 30만 → collab 100만+ |
| `993` | 65 | 5 (8%) | 자운드/JJJ자운드/키스/에임레온도르 | 일반 25만 → collab 55만+ |
| `1460_black` | 68 | 4 (6%) | 릭오웬스/어콜드월 | 일반 20만 → collab 100만 |
| `990v6` | 28 | 3 (11%) | 칼하트/더블탭스 | 일반 28만 → collab 46만 |
| `990v5` | 68 | 2 (3%) | 에임레온도르/아키오 하세가와 | 일반 16만 → collab 80만 |

총 36건 collab 매물이 narrow에 흡수됨 → 일반 매물 시세 평균 끌어올림.

## 원인

Wave 134 catalog mustNotContain에 collab 키워드 부족:
- 모델별 특화 collab만 차단 (예: AF1에 Travis Scott, Supreme만)
- 범용 collab/일본 셀렉트샵/디자이너 collab 빠짐

## Fix — `src/lib/generated/catalog-shoe-narrow-wave134.ts`

### 1. `COLLAB_BLOCK` 공통 상수 추가

```typescript
const COLLAB_BLOCK = [
  // 디자이너/스트릿
  "off-white", "오프화이트", "travis", "트래비스", "supreme", "슈프림",
  "stussy", "스투시", "louis vuitton", "루이비통", "balenciaga", "발렌시아가",
  "comme des garcons", "꼼데", "cdg", "sacai", "사카이",
  // 일본 셀렉트샵
  "wtaps", "더블탭스", "atmos", "아트모스", "ojos", "오호스",
  // NB collab
  "aimé leon dore", "aime leon dore", "ald ", "에임레온도르",
  "jjjjound", "자운드", "kith", "packer", "패커", "dtlr",
  "ssz", "아키오", "하세가와", "carhartt", "칼하트",
  // 닥마 collab
  "rick owens", "릭오웬스", "a-cold-wall", "어콜드월",
  // 어그 collab
  "palace", "팔라스",
  // 호카/아식스 collab
  "i4p", "할스튜디오", "kiko kostadinov", "wales bonner", "웨일스 보너",
  // 일반
  "한정", "한정판", "콜라보", "collaboration", "limited edition",
];
```

### 2. 모든 30 narrow SKU mustNotContain에 `...COLLAB_BLOCK` 추가

`replace_all: true` 로 일괄 적용.

### 3. 한정판 catalog (`catalog-shoe-wave91.ts`) 미변경

이건 collab/한정판을 의도적으로 별도 SKU로 매칭 (Travis Scott Jordan, Off-White Dunk, Yeezy 등) — 차단하면 안 됨.

### 4. broad catalog (`catalog-shoe-broad-wave133.ts`) 미변경

NB 530 + 삼바 OG는 이미 자체 mustNotContain에 ALD/Pharrell/Wales Bonner 등 박힘. variant 가격 차이 작은 broad이므로 일반 컬러 흡수 의도.

## 검증

- TypeScript: 기존 `pipeline.ts:1270` 에러 + `.next/dev/types/validator.ts` dev cache 외 무에러 (Wave 136 변경 무관)
- Tests: **177/177 pass** (test:core)

## 영향 예측

| 지표 | Before (Wave 134) | After (Wave 136) |
|---|---|---|
| 오염 collab 매물 | 36건 narrow에 흡수 | reject 처리 (다음 tick부터) |
| 일반 narrow 시세 정확도 | collab 가격 끌어올림 | 일반 매물만 |
| 한정판 SKU 매칭 | 한정판 narrow에 들어감 (오류) | 한정판 catalog로 분리 매칭 |
| 매칭율 (narrow) | 100% | 95~97% 예상 (3~5% recall 손해) |
| 시세 정확도 | 부정확 | 정확 |

LAUNCH_PLAN 12b 원칙: **recall 손해 받아들이고 precision 우선.** 명시 collab 매물은 narrow에 안 들어감 = 정확. 사용자가 "에어포스 1 트리플 블랙"이라고 명시했는데 시세에 스투시 가격이 끼어들면 오해 유발.

## 다음 (사용자 결정)

1. **이미 들어간 36건 오염 매물**: 
   - 옵션 A — 자연 expire 기다림 (1주 내 사라짐)
   - 옵션 B — `mvp_listing_parsed`에서 36건 row 삭제 → 다음 tick에서 재파싱 (즉시 정정, destructive 아님)
   - 옵션 C — `parser_version` 옛 값으로 박아 자동 reparse 유도
   
   **추천**: 옵션 B (가장 빠르고 안전).

2. **시세 daily recompute**: 오염 36건 빠진 후 `mvp_market_price_daily` 신발 row 재집계 (market-worker 자동 돌아감, 또는 수동 trigger)

3. **마이닝 학습**: 발견된 collab 키워드들을 mining tooling에도 transfer (다른 신발 카테고리 발견 시 자동 차단)

## 다른 세션 알아볼 키 포인트

1. **Wave 136 (2026-05-16) 신발 narrow 30 SKU collab 일괄 차단**.
2. 파일: `src/lib/generated/catalog-shoe-narrow-wave134.ts` (COLLAB_BLOCK 상수 + 30 SKU mustNotContain 보강)
3. **한정판 catalog (wave91)는 collab 매칭이 의도** — Wave 136 차단 대상 아님.
4. broad catalog (wave133)는 일반 컬러 흡수 의도 — 변경 없음.
5. LAUNCH_PLAN §12b 원칙 적용: Precision > Recall. recall 3~5% 손해, 정확도 ↑.
6. **다음 액션**: 이미 들어간 36건 reparse 결정 + market-worker로 시세 재집계.
