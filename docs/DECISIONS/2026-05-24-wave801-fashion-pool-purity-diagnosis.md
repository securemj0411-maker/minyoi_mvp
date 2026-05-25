# Wave 801 — 패션 ready pool purity 진단 + generic SKU lock

**날짜**: 2026-05-24
**Wave**: 801
**Owner**: Codex

## 사용자 요청

최근 의류/신발 ready pool sample 비교매물에 이상한 매물이 붙고, 다른 brand 끼리 매칭되는 듯해 정확도가 이상하다는 보고. 약 1만건 deep sweep을 한 번 더 해야 하는지, 아니면 DB/deep sweep 상태를 먼저 진단해야 하는지 확인 요청.

## 진단 결론

문제의 핵심은 raw 데이터 부족만이 아니었다. 추가 broad deep sweep을 바로 늘리기 전에 ready/reserved pool 자체의 purity guard를 먼저 잠그는 것이 우선이다.

확인된 주요 원인:

1. `에센셜` 같은 generic model word가 brand signal 없이 FOG Essentials로 들어갈 수 있었다.
   - 실제 ready/reserved pool에서 Adidas Essentials 후드/풀집 5건이 `clothing-fog-essentials-hoodie`로 붙어 있었다.
   - generic FOG pants 유사 row 1건도 같은 계열로 확인.
2. stale `comparable_key` / parser drift row가 ready/reserved에 남아 sample 비교매물 기준을 흐릴 수 있었다.
3. `발토로 자켓` wording이 일반 `jacket`으로 파싱되어 Supreme TNF Baltoro lane에서 `down_jacket` key를 잃는 케이스가 있었다.
4. cleanup 스크립트가 `bunjang_condition_label` 없이 현재 key를 재계산해서, 상태등급 drift (`b_grade` -> `a_grade`) 일부를 놓치고 있었다.

## 결정

### 1. 지금 당장 또 10k broad deep sweep을 먼저 돌리지 않는다

deep sweep 자체는 필요하지만, 지금 이상 매칭은 "더 많은 데이터"보다 "ready pool로 들어오는 gate/key guard" 문제 비중이 컸다.

다음 sweep은 broad crawl이 아니라 targeted sweep으로 제한한다:

- high-spread lane
- generic word lane (`essential`, `basic`, `classic`, `air`, `max`, `jacket` 등)
- parser/key drift가 반복되는 lane
- sample 비교매물이 cross-brand로 섞인 lane

### 2. FOG Essentials는 explicit brand signal 필수

`에센셜` 단독은 Adidas/Nike/무신사 일반 라인에서도 많이 쓰이는 단어라 FOG로 볼 수 없다.

적용:

- `fog`
- `fear of god`
- `피오갓`
- `피어오브갓`
- `피오지`

위 brand signal 중 하나와 `essentials/에센셜`이 같이 있어야 FOG Essentials lane에 들어간다.

### 3. Baltoro/발토로는 `자켓` wording이어도 `down_jacket`

Supreme x TNF Baltoro는 제목에 `자켓`이 있어도 comparable key는 `down_jacket`으로 유지해야 한다. `발토로|baltoro`를 down jacket product type signal에 추가했다.

### 4. key drift cleanup은 상태 라벨까지 동일 입력으로 계산

purity report는 `bunjang_condition_label`을 사용하지만 cleanup script는 사용하지 않아 상태등급 drift 4건을 놓쳤다. cleanup script도 같은 입력을 쓰도록 수정했다.

## 코드 변경

- `src/lib/catalog.ts`
  - `FOG_ESSENTIALS_BRAND_SIGNAL` 추가
  - FOG Essentials broad/hoodie/crewneck/tee/pants/shorts/jacket `mustContain`에 brand signal 필수화
- `src/lib/parsers/wave92-fashion-mobility.ts`
  - `발토로|baltoro`를 `down_jacket` signal에 추가
  - clothing parser version `wave216-clothing-v51` -> `wave216-clothing-v52`
- `scripts/cleanup-fashion-pool-gate-blocked.ts`
  - raw listing select에 `bunjang_condition_label` 추가
  - key drift 재계산에 `bunjangConditionLabel` 전달
- `tests/fashion-catalog-regression.test.ts`
  - Adidas Essentials가 FOG로 매칭되지 않는 회귀 테스트 추가
  - 정상 FOG Essentials 매칭 회귀 테스트 추가
  - Supreme TNF Baltoro가 `down_jacket` key를 유지하는 회귀 테스트 추가

## DB 작업

### 1차 gate cleanup

```bash
npx tsx --env-file=.env.local scripts/cleanup-fashion-pool-gate-blocked.ts \
  --categories=shoe,clothing,bag --statuses=ready,reserved --apply
```

결과:

- candidateRows: 12
- shoe gate blocked: 6
- clothing lane required/generic FOG Essentials blocked: 6

### stale key drift cleanup + refill/score

```bash
npx tsx --env-file=.env.local scripts/cleanup-fashion-pool-gate-blocked.ts \
  --categories=shoe,clothing,bag --statuses=ready,reserved --include-key-drift --apply

npx tsx --env-file=.env.local scripts/refill-fashion-key-drift-pool.ts \
  --reason=wave410_pool_key_drift --apply --score --score-budget-ms=120000
```

cleanup 결과:

- candidateRows: 85
- `wave410_pool_key_drift`: 81
- clothing lane required: 4

refill/score 결과:

- invalidated reason 대상 rows processed: 123
- reparsedRows: 119
- scored: 159
- upserted: 111
- poolUpserted: 5
- poolSkipped: 154
- non-fatal: `loadFraudGroupHashes` RPC timeout 1회. score pipeline은 계속 진행됨.

### post-refill residue cleanup

refill 후 내부 전용 shoe lane 1건이 ready로 재진입해 즉시 invalidated.

cleanup script 수정 후 condition-label 기반 key drift 4건도 추가 invalidated.

## 최종 검증

### Fashion pool purity

```bash
npx tsx --env-file=.env.local scripts/report-fashion-pool-purity.ts \
  --statuses=ready,reserved --categories=shoe,clothing,bag
```

최종:

- activeFashionPoolRows: 112
- gateBlockedRows: 0
- actionableRows: 0
- flaggedRows: 1
  - `raw_sku_now_clothing-thombrowne-cardigan` 1건. current key와 pool key는 동일하고 gate 통과라 non-actionable.

### Clothing pool purity

```bash
npx tsx --env-file=.env.local scripts/report-clothing-pool-purity.ts
```

최종:

- activeClothingPoolRows: 79
- allowedAfterCurrentGate: 79
- blockedAfterCurrentGate: 0
- actionableAllowedRows: 0

### Regression test

```bash
npx tsx --test tests/fashion-catalog-regression.test.ts
```

결과: 4/4 pass.

## 보류 / 다음 작업

- broad deep sweep 재실행은 보류. 다음은 targeted sweep으로 진행한다.
- high-spread lane 별 sample 비교매물 deep audit 필요.
- generic model word dictionary를 더 넓게 관리해야 한다.
  - 예: `essential`, `basic`, `classic`, `air`, `max`, `jacket`, `runner`, `training`
- `report-fashion-pool-purity`의 `flaggedRows` 중 non-actionable drift를 주기적으로 0에 가깝게 유지하는 patrol/scheduler 연결 필요.
- 기존 대형 회귀 테스트와 `tsc --noEmit`에는 이번 변경과 무관한 pre-existing failure가 남아 있어 별도 정리 필요.
