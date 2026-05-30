# Wave 798c — Wave 798b revert (파괴적 변경 인지)

- 시간: 2026-05-30 KST
- 트리거: owner — "파괴적인 작업 아니였지?? 기존 세션들이 이유 있이 처리해논게 아니라 그 세션들의 실수였던거야??"

## 솔직 인정

Wave 798b 박았던 madTrim 임계점 변경은 **파괴적**. owner 직감 정확.

### 1. `min sample 5 → 4` — Wave 90 owner 결정 뒤집음

`src/lib/market-math.ts:102` 원래 주석:
> Wave 90 (2026-05-15): threshold 8 → 5. 사용자 코멘트로 발견 (pid 398109917 iPad mini, 407677847 Apple Watch Series 9): 매물 7건 이하인 SKU는 outlier trim 안 됨 → 어그로 매물 (₩410만 등) 시세 평균 왜곡. 5건이면 통계적으로 madTrim 의미 있음.

→ **owner 직접 결정한 임계점**. 5건이 "통계적으로 madTrim 의미 있음" 명시. 4건은 통계 신뢰성 더 낮음 — Wave 90 의도와 정반대.

### 2. `threshold 3 × MAD → 2.5 × MAD` — 통계 표준 위반

- 3 × MAD = 99.7% confidence interval (정규분포 표준)
- 2.5 × MAD = 98.8% — 비표준
- 정상 매물 over-trim risk 증가
- 변경 근거 약함 (barbour 한 case 만 보고 임계점 바꾸면 안 됨)

### 3. `cutoff max(5, 50%) → max(3, 30%)` — 안전장치 제거 (가장 위험)

50% cutoff 는 통계학적 안전장치:
- outlier 가 sample 절반 이상이면 그게 진짜 "normal"
- minority 가 outlier 일 가능성 (Simpson's paradox)
- trim 결과 50% 미만이면 trim 자체가 잘못된 판단

30% 로 낮추면:
- minority 정상 매물을 outlier 로 잘못 trim 가능
- 시세 정확도 ↓
- 모든 SKU 에 영향 (barbour 한 case 가 아님)

barbour case 에서 outlier 가 50%+ 인 건 **catalog 차원 문제** (Wave 798a 에서 fix 박힘). systemic filter 로 해결할 issue 가 아님.

## 변경 — revert

`src/lib/market-math.ts` `madTrim` 함수 Wave 90 상태로 revert:
- min sample: 5 (원래)
- threshold: 3 × MAD (원래)
- trim cutoff: max(5, 50%) (원래)

## 교훈 (decision log)

### 기존 임계점/threshold 바꾸기 전 체크리스트
1. **주석/decision log 읽기** — 왜 그 값으로 박혔는지 확인
2. **한 case 만 보고 systemic 변경 X** — barbour 처럼 outlier 50%+ 인 case 는 보통 catalog 차원 문제
3. **통계 표준 따르기** — 3 × MAD, 1.5 × IQR 같은 표준 값 변경 시 통계학적 근거 명시
4. **owner 결정 박힌 임계점은 owner confirm 받기** — Wave 90 같이 owner 가 직접 결정한 값
5. **revert 가능성 항상 열어두기** — 통계적 변경은 며칠 모니터링 후 데이터 기반 조정

### 진짜 systemic fix 방향 (이번 깨달음)
- **Catalog 강화**: outlier 매물 자체 차단 (Wave 798a 패턴 — 다른 brand sweep)
- **confidence "low_disagreement"** 표시: p75/p25 > 2.0 SKU 시세 사용 안 함
- **price cluster detection**: sample 안 cluster 2개 면 더 큰 cluster median 사용
- 통계 임계점 자체 변경은 **마지막 옵션** — 한 case 가 아닌 전체 데이터 분포 분석 후

## 남는 fix (Wave 798a 유지)

- `clothing-barbour-quilted-jacket` mustNotContain 강화 ✓ (catalog 차원, 안전한 fix)
- DB rematch trigger 박힘 ✓
- 다음 cron tick 후 barbour 시세 정상화 예상

## Follow-up

- **다른 brand 광범위 SKU sweep** — barbour 패턴 (콜라보/별도 라인 흡수) 다른 brand 점검
- **confidence "low_disagreement"** 도입 검토 — sample 분산 큰 SKU 시세 안 보이게
- **owner 결정 박힌 임계점 list** — 함부로 못 건드리는 값들 별도 문서화
