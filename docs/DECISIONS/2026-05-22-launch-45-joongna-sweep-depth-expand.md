# 2026-05-22 — launch-45: joongna sweep depth 확장 (capture 4% → 20%)

## 사용자 짚음
> "중고나라가 번개장터처럼 같은 비율로 하는게 아닌 이유는 일단 api형태가 아니기도 하고... 지금 그걸 고려해도 적은건지?"
> "env.local 업데이트해주셈 나 버셀에 그대로 import할거라서"

## 실측 진단

### joongna search page 1 (실험: bash curl)
| 키워드 | search page 1 매물 | 우리 ingest | capture rate |
|---|---|---|---|
| 에어팟맥스 | 50 | 2 | 4% |
| 아이폰 | 50 | 2 | 4% |
| 맥북 | 50 | 2 | 4% |
| 아크네 | 50 | 2 | 4% |

→ **96% 누락** in page 1 (depth=2). 페이지 2 이후 매물도 다 누락.

### joongna 측 daily upload rate
- 최근 24h: 시간당 ~80-100 upload (source_uploaded_at 기준, 우리가 잡은 매물만)
- 카테고리별 joongna 비율 (전체 raw 의 joongna pct):
  - smartwatch 19.3% / smartphone 17.1% / desktop 19.5% / drone 21% (전자기기 강함)
  - shoe 3.9% / clothing 1.2% / bag 2.6% / watch 0% (패션 약함 — bunjang 압도)

→ 전자기기 = bunjang 의 5-7배 적음, 패션 = 25-100배 적음 (사용자 보고 일치).
   단 우리 capture 4% 는 joongna 자체 매물 부족과 무관 — depth 박은 키워드별 한도.

## fix (env + 코드 둘 다)

### 1) 코드 cap 풀기 (`src/lib/joongna-ingest.ts`)
boundedInt cap 발견:
```ts
// Before
detailsPerQuery max = explicitDetailsPerQuery ? 20 : 2  // env override X 면 cap 2
maxDetails max = 80                                     // 항상 cap 80

// After
detailsPerQuery max = 20  // env 박으면 바로 적용
maxDetails max = 300      // env 박으면 1 run 처리량 ↑
```

### 2) `.env.local` 업데이트 (Vercel 같이 박을 값)
```
JOONGNA_INGEST_DETAILS_PER_QUERY=10  (2 → 10)
JOONGNA_INGEST_MAX_DETAILS=160       (80 → 160)
```

다른 설정 그대로:
- `JOONGNA_INGEST_DELAY_MS=200` — API 부담 안전
- `JOONGNA_INGEST_DETAIL_CONCURRENCY` 미설정 (default 2)
- `JOONGNA_INGEST_QUERY_LIMIT=80`

## 예상 효과

| 지표 | 현재 (2/80) | 변경 (10/160) | 배수 |
|---|---|---|---|
| 매 run detail (이론 max) | 80 | 160 | 2x |
| 매 run detail (실측 추정) | 6-13 | 30-50 | 4x |
| 시간당 detail | ~100-200 | ~600-1000 | 5x |
| 일일 raw ingest | ~2,400 | ~14,000-24,000 | 6-10x |
| joongna API req/s (delay 200ms) | 0.05 | 0.3 | 6x (여전히 안전 — 보통 한계 5+ req/s) |
| capture (page 1 의 %) | 4% | 20% | 5x |

## Trade-off

**장점**:
- 다양한 셀러/sub-variant 잡음
- 패션 카테고리 (shoe/clothing/bag) 도 같은 비율 향상
- SKU 매칭 후보 ↑ → ready 풀 ↑

**단점 / risk**:
- 큐 backlog 일시적 생성 가능 (ingest > 처리). 결국 다 처리됨.
- joongna API 부담 ↑ but transparent crawl (delay 200ms) 유지
- run 시간 ↑ (budget_stopped 더 자주). 이미 매 run budget_stopped 상태라 추가 악화 작음.

## 사용자 액션
1. Vercel env 에 `.env.local` 의 새 값 박기:
   - `JOONGNA_INGEST_DETAILS_PER_QUERY=10`
   - `JOONGNA_INGEST_MAX_DETAILS=160`
2. 코드 변경은 자동 deploy (이 commit 후 ~2분)
3. 24h 후 측정:
   - raw_listings.joongna 일일 증가 추세
   - mvp_joongna_detail_queue backlog
   - joongna API 4xx/5xx rate

## 향후 (별 wave)
- detailsPerQuery 10 → 20 으로 추가 확장 (capture 40%) — 24h 측정 후 효과 확인하면
- bunjang sweep depth 도 같은 진단 — 297k raw 가 충분 capture 인지 검증
- 새 source 추가 (당근/헬로마켓) — joongna 자체 매물 적은 패션 카테고리 cover

## 메모리 룰
- 측정 우선 — 가설 ("ingest depth 부족") 실측으로 검증 후 fix
- transparent crawl — delay 200ms 유지
- decision log: 이 파일
