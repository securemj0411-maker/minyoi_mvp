# Wave 1220 — 화면 비교매물 = 시세 근거 일치 (A안: 낮은 실거래 노출 + 근거 요약)

날짜: 2026-06-07 (KST)
상태: **적용 완료 (display-layer only, TS clean). 배포 필요.**
계기: owner — "판매완료 sample은 ~15만인데 시세는 13만, 둘이 따로 논다. sample은 잘 분류됐는데 시세가 sample 내에서 안 하고 따로 노는 듯." (세션 최초 문제로 회귀)

## 근본 원인 (코드로 확정)
`listings/[pid]/market-source/route.ts` `trimComparableDisplayRows`:
- 시세(13만) = 배치가 **전체 실거래 154건 중앙값**으로 계산 (낮은 11~12만 포함). 숫자 정확.
- 화면 비교매물 = 거기서 **가운데-띠 `[중앙값×0.9 ~ 중앙값×1.15]`만 남기고 낮은 실거래를 화면에서 제거** + 가격 높은 순 정렬(`b.price-a.price`).
- → 화면 맨 위 = 15만짜리 sold, 시세 = 13만 → "낮은 절반이 안 보여서 따로 노는 것처럼" 보임. **계산은 맞고 표시가 근거를 왜곡.**

핵심: 화면 set(가운데 띠) ≠ 시세 계산 set(전체 실거래). owner의 "sample 내에서 계산 안 한다"는 직감이 정확.

## 적용 (A안, display-layer만 — 시세 공식/숫자 무관)
1. **`trimComparableDisplayRows` 하한 제거** (market-source/route.ts ~127). `anchorLower` 삭제 → 낮은 실거래도 화면 표시. 상한(`anchorUpper = max(p75, median×1.15)`) 유지 = 비현실적 고가 호가만 위로 안 튀게. madTrim(극단 outlier 제거)도 유지.
2. **시세 근거 요약 한 줄** (market-source-debug.tsx, 비교매물 섹션 상단): `💡 시세 근거: 실거래 N건 · 중앙값 X · 대부분 p25~p75` + "낮은 실거래도 포함" 안내. marketDailyStats 기존 필드 사용(추가 쿼리 X).
3. 잘못된 라벨 수정: "(가격 낮은 순)" → 실제 정렬은 판매완료 우선·가격 높은 순이었음 → "(판매완료 우선 · 같은 상태 기준)".

## 영향 / 안전
- **시세 숫자/공식 안 건드림** (Wave 798c 준수). display set 필터만 완화 → 최악의 경우 비교매물에 낮은 실거래가 더 보일 뿐(=의도).
- `MarketSourceDebug`는 공유 컴포넌트 → admin-pool-browser / pack-reveal-modal / lookup 등 소비처 자동 반영. 백엔드 trim 변경은 엔드포인트 모든 소비처 적용.
- 사용자 reveal(pack-reveal-modal)은 비교매물 **리스트를 인라인에 안 깔고** 시세 숫자+문구만 → 리스트는 이미 모달(X/Esc)이라 스크롤 압박 없음(owner 우려 해소).

## 검증
- tsc: 내 파일 0 에러.
- 배포 후: 버즈3프로 모달에서 낮은 실거래(11~12만) 노출 + "실거래 154건·중앙값 13만·대부분 12~15만" 요약 확인 예정.

## 연관
- Wave 1218(FE 오염 제거), Wave 1219(재계산 큐 freshness)와 함께 "시세 신뢰" 3종. 1218/1219/1220 모두 미배포 — 같이 배포 필요.
