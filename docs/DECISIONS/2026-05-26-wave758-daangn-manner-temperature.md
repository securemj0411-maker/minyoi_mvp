# Wave 758 — 당근 매너온도 (Manner Temperature) 신뢰 신호 통합

- 시간: 2026-05-26 KST
- 트리거: 사용자 보고 — "당근은 매너온도인데 왜 '후기와 평점이 없어요' 라고 나오는거임? 매너온도 43.9°C 만 보여줘도 됨".

## 발견

당근 매물 신뢰 신호 흐름:
1. 당근 search API → DaangnSearchArticle (score 없음)
2. 당근 detail HTML parse → DaangnDetailArticle.user.score (= 매너온도) ✅ 추출됨
3. **buildRawListingRow 가 user.score 무시** ❌
4. DB 저장 X → UI "후기 없음"

당근은 bunjang/joongna 와 다른 신뢰 모델:
- 안전결제 X (직거래만)
- 평점/리뷰 노출 미세 → 셀러 프로필에서만 확인 가능
- **매너온도 (0~99.9°C, 36.5 = 평균)** 가 위조 어려운 누적 평가 → 주신호

## 변경

### DB 마이그레이션 (`wave758_daangn_manner_temperature`)
- `mvp_raw_listings` 에 `daangn_manner_temperature numeric NULL` + `daangn_review_count integer NULL` 추가
- `daangn_bulk_upsert_raw_listings` RPC 갱신 (COALESCE 로 NULL upsert 시 옛 값 유지)

### 인제스트 (`src/lib/daangn-ingest.ts`)
1. `buildRawListingRow` — DaangnDetailArticle.user.score / reviewCount 추출해서 raw row 에 박음.
2. `upsertDaangnRawListings` — detail article 우선 (manner temp 포함 article 로 buildRawListingRow 호출).

### Safety/Facts 레이어 (`src/lib/marketplace-safety.ts`)
- `MarketplaceSafetyFacts` 에 `daangnMannerTemperature` + `daangnReviewCount` 추가.
- `MarketplaceSafetyDisplay.sellerTrust.kind` 에 `"daangn_manner_temperature"` 추가.
- `sellerTrust.mannerTemperature?: number | null` 새 필드.
- `buildMarketplaceSafetyDisplay` daangn branch:
  - manner temp 있음 → 매너온도 + tier (`high`/`neutral`/`low_avg`/`below_avg`) 표시 (36.5/40 임계)
  - manner temp 없음 → "당근 앱에서 확인" fallback
- `marketplaceFactsFromRawJson` 에 manner temp/review count 입력 받음.

### Pool API (`src/app/api/packs/pool/route.ts`)
- meta SELECT 에 `daangn_manner_temperature`, `daangn_review_count` 추가.
- `marketplaceFactsFromRawJson` 호출에 둘 다 전달.

### Pack-open (`src/lib/pack-open.ts`)
- `RevealCardMeta.savedDetail` 타입에 `daangnMannerTemperature`, `daangnReviewCount` 추가.
- `RevealDetailSourceMeta` SELECT + 타입에 두 column 추가.
- 3개 `marketplaceFactsFromRawJson` 콜에 manner temp 전달.

### Modal UI (`src/components/pack-reveal-modal.tsx`)
- `marketplaceSafetyFactsForCard` — savedDetail 에서 manner temp 전달.
- `sellerTrustGuideStep` — `safety.isDaangn` branch 추가 (joongna 보다 먼저, 매너온도 위주).
- `BeginnerGuideTrustMetric` — daangn 카드 manner temp 큰 °C 숫자 + tier 라벨 표시. manner temp 없으면 "당근 앱에서 확인" fallback.

### 백필 스크립트 (`scripts/backfill-daangn-manner-temperature.ts`)
- 풀 ready ∩ source=daangn ∩ manner_temp NULL pids fetch (~40개)
- 각 url 의 detail HTML scrape → parseDaangnDetailHtml → user.score
- PATCH 로 column 박음
- 800ms rate limit / `--dry-run` / `--limit=N` 옵션

## 검증
- `npx tsc --noEmit` 0 에러 (5개 touched 파일)
- DB 마이그레이션 success 응답

## 위험
- 0 — 신규 column NULL default, 기존 동작 영향 X.
- Daangn ingest 이미 detail fetch 하는 매물 일부에만 score 박힘. 나머지는 backfill 스크립트 또는 다음 cron tick 으로 자연 채워짐.

## 다음 (사용자 액션)
1. **백필 실행**:
   ```bash
   cd mvp && tsx scripts/backfill-daangn-manner-temperature.ts
   ```
   (또는 `--dry-run` 먼저로 sample 확인)
2. **검증**: `select count(*) from mvp_raw_listings where source='daangn' and daangn_manner_temperature is not null;` → 40개 이상 박혀야 OK
3. **UI 확인**: 운영자풀 → daangn 매물 → 상세 reveal modal → "당근 매너온도 43.9°C · 신뢰 강함" 표시

## 다음 (코드 추가 작업)
- Daangn 인제스트 cron 의 detail fetch 커버리지 증대 (현재 sample 만 detail) — 풀 entry 매물은 우선 detail 가져오게 변경 (별도 wave).
- Feed 카드에도 매너온도 chip 표시 (지금은 modal 만) — 별도 wave.
