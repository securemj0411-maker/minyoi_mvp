# Wave 251.1 — Polo Pique 내셔널지오그래픽 차단

- date: 2026-05-19
- type: catalog mustNotContain 보강 (additive — false positive brand 차단)
- scope:
  - `clothing-polo-pique-classic` mustNotContain 보강
- branch: `fix/market-chart-honesty-2026-05-19`
- 관련 사용자 코멘트: `mvp_reveal_feedback` id 195, 196

## 배경

사용자 코멘트 (id 195, 196 — Polo Pique 분류) 에서 비교 매물 list 안에 **"내셔널지오그래픽 반팔 피케 폴로 셔츠" (₩16k)** 가 섞여 있는 패턴 재발견.

### 사용자 명시 코멘트

> "아직도 이러네" — id 196 (pid 409066831)
> "비교군에 내셔널지오그래픽 16k 매물이 있어" — 요약 (id 195 pid 409058862)

### 매칭 흔적

- National Geographic 자체 라인:
  - "내셔널지오그래픽 폴로 셔츠" — `폴로` ∩ `피케`/`pk` 모두 hit (Polo Pique mustContain 통과)
  - 셀러가 "polo" 단어를 일반명사로 사용 (카라티 = polo 셔츠) → mustContain 만으론 통과
  - 가격대 ₩10~30k (NatGeo 라인) ≠ Polo Ralph Lauren Pique (₩60~100k) → 시세 왜곡

### Wave 238 기존 13 brand mustNotContain

```
바나나리퍼블릭/타미힐피거/유니클로/나이키 골프/아디다스 골프/아디다스 스쿼드라/
DKNY/무스너클/라코스테/헤지스/빌보콰/폴스미스/세터/렉토/캐피탈/마뗑킴/마크 제이콥스/베이프/스투시
```

→ 내셔널지오그래픽 미포함.

## 결정

### `clothing-polo-pique-classic` mustNotContain 추가 (additive)

```typescript
// Wave 251.1 (2026-05-19): 사용자 코멘트 (id 195, 196) — "내셔널지오그래픽 반팔 피케 폴로 셔츠" 16k 가 polo-pique-classic 비교군에 섞임.
//   National Geographic 은 폴로 카라티 자체 라인이 있어 "폴로/pique" 둘 다 만족 → 폴로 SKU 차단 필요.
"내셔널지오그래픽", "내셔널 지오그래픽", "national geographic", "natgeo", "nat geo",
```

5 가지 표기 변형:
- `내셔널지오그래픽` (붙임)
- `내셔널 지오그래픽` (공백)
- `national geographic`
- `natgeo` (브랜드 SNS 약칭)
- `nat geo` (공백 약칭)

## 영향 (additive only)

- false positive 차단:
  - "내셔널지오그래픽 폴로 PK 반팔 ₩16k" → polo-pique-classic 매칭 X → broad fallback (broad 도 동일 brand mustNotContain 동기화 필요 — 별도 follow-up wave 검토)
- 정상 Polo Ralph Lauren Pique 매물 영향 X (브랜드명 단독 차단).
- catch-all broad SKU `clothing-polo-pique` 가 있다면 동일 추가 검토 — 본 코멘트는 polo-pique-classic narrow 한정 확인.

## 검증

- `npm run test:core` → 581 pass / 9 fail (failing 9건은 모두 me-page-contract UI layout 테스트, catalog 무관 pre-existing).
- 코드 변경은 catalog.ts 의 mustNotContain 배열 5건 추가만 (mustContain 손 X, 다른 SKU 영향 X).

## 후속 작업

1. **production rematch trigger** (별도 wave 또는 사용자 결정 후):
   ```sql
   UPDATE mvp_raw_listings
   SET detail_status = 'pending'
   WHERE sku_id = 'clothing-polo-pique-classic'
     AND name ILIKE ANY (ARRAY['%내셔널지오그래픽%', '%national geographic%', '%natgeo%']);
   ```
   다음 cron 자동 reparse 시 mustNotContain 적용 → sku_id NULL 또는 다른 SKU 로 재할당.

2. Wave 251.2 — Patagonia Synchilla 모델 분리 (다음 단계).
3. Wave 251.3 — BAPE rematch trigger (Wave 242 collab noise 적용 검증).
4. Wave 251.4 — 비교 매물 list product_type 필터 (Wave 248 미해결 근본 fix).

## 사용자 정책 준수

- additive only (mustNotContain 확장만, mustContain 변경 X) → 비파괴 ✓
- decision log 필수 (memory feedback_decision_log_required) ✓
- 사용자 친화 (memory project_core_principle_consumer_friendly) — false positive 줄여 시세 정확도 ↑ ✓
- narrow=fallback / broad=차단 (Wave 236d Goldilocks) — narrow 정확도 ↑ ✓
