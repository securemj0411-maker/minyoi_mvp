# Wave 721 — launch-79/80 후속 빈티지 매장 boilerplate strip + single-signal demote

**Date**: 2026-05-23
**Trigger**: 사용자 "다음 너가 계속 하셈" 자율 진행. launch-79/80에서 발견한 "D-tier 의류 401건 중 vintage 단독 매칭" 잔여 issue follow-up.

## 다른 세션 작업 확인

검토한 decision logs (uncommitted 변경 파일 5개 — 건드리지 않음):
- launch-76 detailed mode persist (pack-reveal-modal)
- launch-77 detail-market-graph restore
- launch-78 신발/의류 tier label mismatch fix (pack-reveal-modal, market-source, clothing-axes)
- launch-79 빈티지 색감 false positive (text-sanitize 적용됨)
- launch-80 single-keyword negation 강화 (clothing-axes, shoe-axes)
- launch-81 비교 매물 UI 3 화면 통일 (pack-reveal-modal)
- wave718-nav-logo-toss-blue-d (app-nav, 이름 conflict)

## Phase 0 — sample audit (30건)

`positive=["빈티지"]` 단독 D-tier 의류 매물 random sample 30건 description 검토:

### 가짜 신호 / 매장 boilerplate (60-70%)
- "빈티지 특성상 교환/반품 불가능합니다" (다수)
- "빈티지의 특성상 사용감 있을 수 있습니다"
- "판매되는 모든 제품은 빈티지/세컨핸드 제품들입니다"
- "🍎빈티지 특성상 교환 및 환불이 어려워요" (이모지 매장 boilerplate)
- "👗빈티지 특성상 사용감 있을 수 있습니다 예민하신분은 피해주세요🙏"
- "📍빈티지 특성상 교환,반품 어렵습니다"
- "#빈티지만냥" (해시태그 매장명)
- "일본 빈티지 샵에서 구매했으며" (출처 묘사 — 실제 상태와 무관)
- "정품 빈티지 구매 후 시착조차 x" (vintage 출처지만 미시착 = S)
- "(빈티지박스)" 매장 표시 (자체 매물은 멀쩡)

### 진짜 빈티지 (30-40%)
- "(빈티지박스)아디다스 정품 오렌지색 트랙수트" (실제 vintage 트랙수트)
- "베이프 06's 바시티 ... 2006년도 제품으로 희소성 있어요"
- "빈티지 챔피온 리버스위브 블루택 ... 컨디션 좋지 않아 저렴하게 판매"
- "90s 폴로 랄프로렌 클래식 핏 옥스포드 반팔 셔츠"
- "더블알엘 빈티지 진 ... 워싱이 정말 예쁘게 들어간"
- "파타고니아 90s 신칠라" (연도 + 진짜 vintage)
- "스타베이프 초기모델로 한국에서 생산되었던 제품"

## Phase 1 — Fix 적용 (commit pending)

### 1. `text-sanitize.ts` 매장 boilerplate strip 강화 (12 패턴 추가)

```ts
const RESELLER_BOILERPLATE_PATTERNS: RegExp[] = [
  // ... Wave 720 기존 (쇼룸/수도권 퀵/매장가/컨디션 기준표 등) ...
  // Wave 721 추가:
  /빈티지\s*(?:제품)?\s*특성상.{0,80}/g,
  /빈티지\s*\/\s*세컨핸드/g,
  /빈티지의류\s*예민\s*하신/g,
  /빈티지\s*나\s*중고에\s*민감/g,
  /빈티지\s*샵에서\s*구매/g,
  /정품\s*빈티지\s*구매\s*후/g,
  /빈티지\s*박스(?:입니다|예요)?/g,
  /#\s*빈티지\w*/g,
  /빈티지의?\s*특성/g,
  /빈티지\s*컨디션\s*사진\s*참고/g,
  /최저가로\s*주\s*\d\s*일\s*업데이트/g,
  /낱개\s*구매시\s*바로\s*안전결제/g,
];
```

### 2. `clothing-condition.ts` single-signal vintage demote

```ts
if (
  tier === "D"
  && labels.wear === "vintage"
  && positiveMatches.length === 1
  && positiveMatches[0] === "빈티지"
  && negativeMatches.length === 0
) {
  finalTier = "B";
  confidence = Math.min(confidence, 0.5);
  finalReason = "wear=vintage 단독 매칭 → B로 demote (Wave 721 — 매장 boilerplate 가능성 ↑)";
}
```

## Phase 2 — 영향 예상

### reparse 후 예상
- D-tier 매물 ~371건 중:
  - **매장 boilerplate 매물 (~60%, 222건)**: text-sanitize strip → 매칭 fail → other axis로 분류
  - **잔여 단독 "빈티지" 매물 (~40%, 149건)**: single-signal demote → B + confidence 0.5
  - **진짜 vintage (연도 명시 + 동반 wear)**: 그대로 D 유지

### 진짜 vintage 보존 신호
- 연도/decade 명시 ("90s", "2006년도", "1990") + wear keyword ("컨디션 좋지 않아", "색바램", "사용감")
- 매장 매물 아닌 개인 c2c (해시태그, 매장명, 단가 표기 없음)

## 정책 trade-off

- 거짓 양성 감소: 매장 boilerplate 매물 D → 더 정확한 tier (대부분 A/B)
- 거짓 음성 risk: 진짜 vintage이지만 단독 "빈티지" 만 박힌 매물 → B (이전 D)
  - mitigation: 연도/decade 명시 매물은 보존 (별 axis E 또는 다른 신호 동반)
  - 진짜 vintage가 B로 분류돼도 시세 영향 적음 (B = default tier)

## 안전 가드

- `wear === "gunje"`, `wear === "heavily_used"`, `damage === "major"` → D 유지 (강한 신호)
- positive 매칭이 ≥2 (빈티지 + 다른 신호) → D 유지
- negative 매칭 ≥1 (실제 하자 신호 동반) → D 유지

## 관련 commit (pending)
- Wave 721 commit — text-sanitize.ts + clothing-condition.ts

## 다음 단계 (defer / 별도 wave)

- **Wave 722 / Stage 5**: `band-aware-median.ts` tier-aware 시세 query
  - `mvp_market_price_daily.condition_tier` 컬럼 추가 (schema migration)
  - 의류/신발 매물은 같은 tier 시세 우선
  - `weightedNeighborPrice` 인접 tier 가중평균
  - **시급도 높음** — launch-78에서 라벨/UI fix 됐으나 시세 자체는 옛 conditionClass

- **신발 빈티지 단독 매칭 151건** — 동일 패턴 (clothing보다 적지만 audit 필요)

## 진행 상황

- [x] Phase 0 — 30 sample audit
- [x] Phase 1 — text-sanitize.ts + clothing-condition.ts fix
- [x] Phase 2 — 영향 예상 + 정책 정리
- [ ] Phase 3 — production deploy + 자연 reparse cron 후 D-tier 분포 측정

## Agent / SQL 추적

- SQL sample query: `mvp_listing_parsed.parsed_json->'condition_grade'->'evidence'->>'positive' = '["빈티지"]'`
- 검토 sample: pid 30개 (`394728006`, `409647615`, `386557131`, `371235229`, `383893907`, ...)
