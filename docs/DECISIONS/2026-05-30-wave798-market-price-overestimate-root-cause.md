# Wave 798 — 시세 과대평가 버그 근본 원인 + fix

- 시간: 2026-05-30 KST
- 트리거: owner 발견 — 바버 퀼팅자켓 매물 매입가 ₩80K / 시세 ₩322K (3배 차이). 화면 비교 매물은 ₩144~200K 인데 실제 시세 산정은 ₩322K.

## 근본 원인 — DB 추적

매물 sku_id: `clothing-barbour-quilted-jacket`
B급 + condition_class `clean` market_stats:
- active_median_price: ₩350,000
- blended_median_price: ₩322,000 ← owner 본 시세
- sample_count: 6
- p25: ₩165K, p75: ₩350K (IQR 매우 큼)

clean sample 6건 sweep:

| 매물 | 가격 | 분류 문제 |
|---|---|---|
| BARBOUR x A BATHING APE | ₩458K | 🔴 콜라보 |
| 바버 비데일 베이지 XL | ₩380K | 정상 high (premium colorway) |
| 바버 퀼팅 자켓 L 영국런던 | ₩350K | 정상 |
| 바버 **화이트라벨 헤이든** | ₩319K | 🔴 다른 라인업 |
| 여성 바버 인터내셔널 **왁스** | ₩200K | 🔴 왁스 자켓 (퀼팅과 별도) |
| 바버 리데스데일 퀼팅 | ₩165K | ✓ 진짜 퀼팅 |
| Barbour International 퀼팅 | ₩144K | ✓ |
| Barbour International 국내정품 | ₩132K | ✓ |
| 바버 인터내셔널 **왁스** | ₩128K | 🔴 왁스 |
| **Rouje** 퀼팅 바버 | ₩125K | 🔴 콜라보 |

**진짜 퀼팅 자켓 시세 = ₩130~165K. 시세를 ₩322K 로 끌어올린 outlier 4건**:
- BAPE 콜라보 (₩458K)
- 화이트라벨 헤이든 (₩319K)
- 왁스 자켓 2건 (₩200K, ₩128K)
- Rouje 콜라보 (₩125K)

## 근본 원인 2가지

### 1. Catalog SKU 너무 광범위 (이번 wave fix 대상)
`clothing-barbour-quilted-jacket` mustNotContain 에 콜라보/다른 라인/왁스 자켓 차단 없어서:
- BAPE 콜라보 자켓 흡수
- 화이트라벨 / 헤이든 (별도 라인) 흡수
- 왁스 자켓 (퀼팅 자켓과 별도 제품) 흡수
- Rouje 같은 디자이너 콜라보 흡수

### 2. 시세 산정 outlier filter 미흡 (Wave 798b 별도)
- `madTrim` 함수는 5건 미만 sample 은 trim 안 함
- 6건 중 4건이 outlier 인 경우 trim 효과 부족
- p25 (₩165K) ↔ p75 (₩350K) 격차 2배 인데 outlier 안 거름
- Tukey IQR fence (p75 + 1.5×IQR) 또는 p25 × 2.0 cutoff 같은 boundary 미적용

## 변경

### Wave 798a — Barbour catalog patch (이번 wave)

`src/lib/generated/catalog-732-multi-brand.ts` `clothing-barbour-quilted-jacket` mustNotContain 추가:
- 콜라보: 베이프/bape/a bathing ape/rouje/콜라보/collab/x
- 다른 라인: 화이트라벨/화이트 라벨/white label/헤이든/hayden/어드밴스드/advanced
- 별도 제품: 왁스 자켓/wax jacket/왁스드 자켓/왁스 코튼/waxed cotton

DB rematch trigger — 흡수된 매물 sku_id NULL → cron 재매핑.

### Wave 798b — Systemic outlier filter (follow-up)

별도 wave 에서 진행:
- `madTrim` 임계점 5건 → 4건으로 낮춤
- 또는 Tukey IQR fence 추가: p75 + 1.5×(p75-p25) 초과 매물 제외
- 또는 p25 × 2.5 초과 매물 제외 (simpler)

모든 SKU 적용 → systemic 정확도 ↑.

## 예상 결과 (Wave 798a 만)

다음 cron tick 후:
- 바버 퀼팅 clean 매물 6건 → 3건 (진짜 퀼팅만)
- median ₩350K → ~₩150K (실제 시세 반영)
- 사용자가 본 매물 차익 표시 정상화 (₩220K → ~₩50K)

## 다른 brand 도 동일 패턴 의심

barbour 처럼 광범위한 SKU 들 — 추후 sweep 권장:
- 다른 outdoor brand (벨스타프/캐나다구스 등) 콜라보 흡수 여부
- 다른 패션 brand 별도 라인업 (예: Stone Island Shadow Project vs Main) 점검

## Follow-up

- **Wave 798b — systemic outlier filter** (mvp_market_price_daily 계산 로직 강화)
- 다른 brand 광범위 SKU sweep (Stone Island, Belstaff, Patagonia, Arc'teryx 등)
- p75/p25 비율 > 2.0 인 SKU 자동 audit alert
