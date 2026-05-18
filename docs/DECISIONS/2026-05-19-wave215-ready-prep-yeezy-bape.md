# Wave 215 — Yeezy/BAPE STA + clothing ready 승격 + 풀 진입 준비 완성 (2026-05-19)

## 사용자 명시

> "ㅇㅇ 다 하고 ready 바로 되게 다 준비하셈 다른 mining 다 하고 제발 카탈로그랑 다 마이닝이랑 다 준비 파싱 준비 ready로 만들을 작업 ㄱㄱ"

→ 모든 mining 마무리 + ready 준비 + 파싱 준비.

## production sweep 추가 발견 (Wave 215 mining)

| brand / 모델 | 매물 14d | 비고 |
|--------------|---------|------|
| **Yeezy (전체)** | **521건!** ⭐⭐⭐ | 단일 검색 최고 |
| - Yeezy Boost 350 | 21 | V1/V2 시그니처 |
| - Yeezy Slide | 8 | 슬리퍼 |
| - Yeezy Foam Runner | 8 | 슬리퍼 |
| - Yeezy Boost 500/700 | 4+3 | |
| BAPE STA | 6 | Bapesta 신발 |
| Stussy 8 Ball Knit | 5 | 한정 |

## 신규 6 SKU

```
shoe-yeezy-boost-350      // V1/V2 시그니처
shoe-yeezy-boost-500-700  // Boost 500 + 700
shoe-yeezy-slide          // 슬라이드
shoe-yeezy-foam-runner    // 폼 러너
shoe-bape-sta             // Bapesta 신발
clothing-stussy-8ball-knit // 한정 니트
```

## clothing 카테고리 ready 승격 ⭐

```ts
clothing: {
  status: "ready",  // ← internal_only → ready (사용자 명시)
  label: "Clothing",
  note: "Wave 215 ready 승격 (2026-05-19): 의류 27 SKU + lane 다 ready. 
         Polo/TNF/Stüssy/Supreme/Margiela/CDG/Lacoste/Acne/Carhartt/Lululemon/
         Kitsuné/BAPE/마뗑킴/Reebok/Arcteryx/Fila/Patagonia/MLB/Discovery 박음. 
         broad 사이즈 무관, collab narrow 분리. 가품 floor 0.30 + AD 14종.",
}
```

→ **풀 진입 즉시 가능** (lane ready + category ready).

## reparse 재실행 결과 (Wave 198~215 brand 70+ keyword)

Top SKU 매칭 (reparse):
| SKU | 매칭 건수 |
|-----|----------|
| clothing-bape-tee | 113 ⭐ |
| clothing-arcteryx | 101 |
| clothing-patagonia | 81 |
| shoe-asics-novablast | 49 |
| shoe-bape-sta | 47 |
| clothing-polo-pony-tee | 43 |
| shoe-adidas-adizero | 37 |
| clothing-bape-shark-hoodie | 35 |
| shoe-puma-football | 33 |
| shoe-asics-jog-100 | 29 |
| shoe-yeezy-boost-350 | 19 |
| 외 30+ SKU |

## market_invalidation 강제 trigger

170+ comparable_keys `mvp_market_key_invalidation` 에 enqueue (priority 10):
- 다음 market-worker cron (5분)에 시세 daily 계산
- catalog reparse + market_invalidation 동시 → 풀 진입 자연 trigger

## 매칭률 측정 추이

| 단계 | 매칭률 | 변화 |
|------|--------|------|
| Wave 198 이전 | 37.3% | baseline |
| Wave 198~212 reparse | 47.5% | +10.2%p |
| **Wave 215 reparse** | **48.2%** | +0.7%p |

48.2%가 mainstream catalog 한계 추정.

## 누적 catalog 144 SKU (Wave 198~215)

| 카테고리 | SKU | 상태 |
|---------|-----|------|
| **clothing** | **27** | **ready ⭐** (Wave 215 승격) |
| bag | 20 | (ready lane 별도) |
| shoe | 97 | (ready lane 별도) |

| brand 추가 (Wave 215) | SKU |
|----------------------|-----|
| Yeezy | 4 (Boost 350/500-700/Slide/Foam) |
| BAPE | 2 누적 (tee + Shark Hoodie + STA 추가) |
| Stussy | 1 추가 (8 Ball Knit) |

## verify
- test:core **550/550 pass** ✅
- commit `351862b`

## 사용자 정책 충족 ✅

- ✅ "다 mining" — 의류 mainstream + Yeezy/BAPE STA + 한정 니트
- ✅ "ready 바로 되게" — clothing category ready 승격 + lane 다 ready
- ✅ "카탈로그 다 마이닝" — 144 SKU + production sweep 검증
- ✅ "파싱 준비 ready" — reparse 재실행 + market_invalidation enqueue → 다음 cron 풀 진입

## 다음 자동 진행 (cron 자연 처리)

1. **5분 cron**: market-worker가 170+ keys 시세 daily 계산
2. **그 다음 score-stage**: 매물 reparse 후 새 sku_id 박힘 → candidate-pool-builder 진입 시도
3. **자연 누적**: 새 매물 들어올 때 자동 catalog 매칭 (search-stage)
4. **24h+ 후 정식 측정** — 사용자 풀 노출 + 시세 정확도

## decision log

commit `351862b` Wave 215 (catalog 코드)
decision log: 이 파일 push 후 사용자에게 진척 보고.
