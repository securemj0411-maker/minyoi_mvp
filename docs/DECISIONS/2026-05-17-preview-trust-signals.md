# 2026-05-17 preview-masked: 신뢰 시그널 chips (신규/무료배송/시세 신뢰)

## 사용자 요청

> "대시보드에서 클릭하면 나오는 정보 (신규팜내자, 상태좋음, 무료배송, 시세 신뢰높음)
> 그냥 메인페이지에 5개 상품에 같이 놔주면 더 신뢰도 높아질거 같은데"

## 박은 변경 (commit `bb60a40`)

### API (/api/preview-pool)
- `PoolRow` 에 `confidence` 추가 (mvp_candidate_pool.confidence 0~1)
- `RawListingMeta` 에 `free_shipping`, `last_seen_at` 추가 (mvp_raw_listings)
- 응답 fields:
  - `confidence`: "high" (>=0.8) / "medium" (>=0.6) / "low"
  - `freeShipping`: boolean
  - `isFresh`: boolean (last_seen_at 24h 이내)

### UI (preview-masked-dashboard)
- 카드 차익 아래 chip 줄:
  - 🆕 **신규** (blue) — last_seen 24h 이내
  - **무료배송** (sky) — free_shipping=true
  - **시세 신뢰 높음** (emerald, confidence high)
  - **시세 신뢰 보통** (yellow, confidence medium)
- 등급 chip (S급/A급/사용감/...) 이미 박혀있음 (ConditionChip)

### 정책

- **low confidence 표시 X** — negative signal 노출 차단 (사용자 진입장벽 ↑ 위험)
- 시그널 없는 매물 = 해당 chip 안 보임 (clutter X)

## Trade-off

- chip 4-5개 (등급 + 신규 + 무료배송 + 신뢰) — 카드 빽빽
- 모든 매물이 chip 있는 게 아니라 conditional — 빈 매물도 자연
- 신뢰 build > 깔끔 loss

## Test

288/288 pass.
