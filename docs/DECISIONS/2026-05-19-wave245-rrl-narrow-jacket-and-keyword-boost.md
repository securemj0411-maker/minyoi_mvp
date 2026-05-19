# Wave 245.1 — RRL narrow split (jacket-coat 신설 + denim/shirt-pants 모델명 보강)

날짜: 2026-05-19
컨텍스트: broad SKU narrow split — 사용자 plan Wave 245. RRL ROI 1순위.

## 측정 결과

### Production sample (60 days, `sku_id = 'clothing-polo-rrl'`)

- 총 112건 broad 매칭 매물
- 자켓 47건 (42%) — **가장 큰 누락 product-type**
- 니트/카디건/스웨터 4건
- 베스트 1건 / 오버롤 1건
- 가방 2건

### 자켓 가격 분포 (47건)

- min 31.9만 / p25 82만 / **median 150만** / p75 264만 / max 410만
- 평균 169만
- CV 큰 편 — 가죽/스웨이드/봄버/피코트/트러커/카코트 등 product-sub-type 다양
- 단 brand 동일 (RRL) 이므로 narrow split 시 broad 분리만으로도 CV ↓ 효과 큼

### narrow 키워드 누락 (broad 가 잘못 catch 한 이유)

production sample 에서 narrow 가 못 잡은 매물 다수 발견:

- **denim 모델명**: 빈파포 / 파이브포켓 / 기빈스 / 미드랜드 / 이스트웨스트 / 에이버리 / 브룸필드 / 힐스뷰 / 벤튼 / 클리어빌 → denim 키워드 (데님/청바지/jean) 없는 매물명에서 매우 빈번
- **shirt-pants 모델명**: 오피서치노 / 필드치노 / 카고 / 트라우저 / 카펜터 / 슬림핏 / 스트레이트핏 / 헤링본 → 기존 mustContain 누락

### broad mustNotContain Wave 237 실패

"팔찌"/"커프" 박혔는데 production 에 여전히 broad 매칭 (parser_version drift). detail_status='pending' rematch trigger 로 해결.

## 변경 내용 (additive only)

### `src/lib/catalog.ts`

1. **`clothing-polo-rrl-jacket-coat` 신설** — narrow lane (msrp 150만)
   - mustContain: RRL + 자켓/jacket/코트/coat/재킷/블레이저/점퍼/봄버/트러커/카코트/피코트/필드자켓/덱자켓/초어/그리즐리
   - mustNotContain: 키즈/rrl 무드/스니커즈/벨트/지갑/모자/팔찌/반지/목걸이
   - laneKey: `polo_rrl_jacket_coat`
   - defaultProductType 안 박음 (jacket + coat 둘 다 — text 추출 의존)

2. **`clothing-polo-rrl-denim` 키워드 보강** — mustContain 에 모델명 추가
   - 빈파포 / 파이브포켓 / 5포켓 / 기빈스 / 미드랜드 / 이스트웨스트 / 에크루 / 에이버리 / 브룸필드 / 힐스뷰 / 벤튼 / 클리어빌

3. **`clothing-polo-rrl-shirt-pants` 키워드 보강** — mustContain 에 모델명 추가 + mustNotContain 강화
   - mustContain: 치노 / chino / 오피서 / 필드 치노 / 카고 / 트라우저 / 카펜터 / 슬림핏 / 스트레이트핏 / 헤링본
   - mustNotContain: denim 모델명 (빈파포/파이브포켓/기빈스 등) — denim lane 으로 가게

4. **`clothing-polo-rrl` broad mustNotContain 강화** — narrow lane 키워드 + 자켓/coat/덱자켓/봄버/카코트/피코트 + denim 모델명 전체 + shirt-pants 모델명 전체 + knit 차단
   - Wave 218 의 catch-all 정책 유지 — narrow 매칭 우선, broad fallback only
   - knit 키워드 차단 (4건 매물만, narrow lane 신설 보류 — 다음 wave)

### `src/lib/category-readiness.ts`

`polo_rrl_jacket_coat` LANE_READINESS=ready 등록.

## production rematch trigger

```sql
UPDATE mvp_raw_listings
SET detail_status = 'pending'
WHERE sku_id = 'clothing-polo-rrl'
  AND first_seen_at >= NOW() - INTERVAL '60 days'
  AND (
    name ~* '자켓|jacket|코트|coat|재킷|블레이저|점퍼|봄버|트러커|카코트|피코트|덱자켓|초어'
    OR name ~* '빈파포|파이브포켓|5포켓|기빈스|미드랜드|이스트웨스트|에이버리|브룸필드|힐스뷰|벤튼|클리어빌|그리즐리'
    OR name ~* '치노|chino|오피서|필드치노|카고|trouser|카펜터|슬림핏|스트레이트핏|헤링본'
    OR name ~* '팔찌|반지|커프|나바호'
    OR name ~* '니트|knit|카디건|스웨터|풀오버'
  )
```

**영향**: 89건 detail_status='pending' set. 다음 cron tick 에서 parser 재실행 → narrow lane 자동 promote 또는 차단 (additive — sku_id 자체 update X).

## 비파괴 정책 준수

- 기존 broad SKU `clothing-polo-rrl` 폐지 X — fallback catch-all 유지
- 새 narrow `clothing-polo-rrl-jacket-coat` additive 추가
- 기존 narrow (tee/denim/shirt-pants/accessory/sneaker) mustContain 보강만
- DELETE/DROP 없음, sku_id rewrite 없음
- detail_status='pending' = additive (cron 자연 처리)

## 측정 예정 (다음 cron tick 후)

1. `clothing-polo-rrl-jacket-coat` 매물 수 (예상: 47건 → 40건+ promote)
2. `clothing-polo-rrl-denim` 매물 수 증가 (모델명 보강 효과)
3. `clothing-polo-rrl-shirt-pants` 매물 수 증가
4. `clothing-polo-rrl` broad 매물 수 감소 (catch-all 만 남음)
5. 시세 daily 자동 재계산 (parser_version drift → market-stats cron 처리)

## 후속 wave

- Wave 245.2 — FOG Essentials narrow split
- Wave 245.3 — TNF Supreme collab 의류 narrow split
- Wave 245.4 — Acne PVC tote 추가 narrow 검토
- RRL knit narrow lane 신설 (현재 broad 차단만, 매물 늘면 별도 lane)
