# Wave 120 — narrow self lane 확장 + PHONE_NOISE 강화 + S25 Edge 차단

> 사용자 결정: "narrow lane으로 가자. 정확한거 확실?"

## 1. narrow self lane 30건 audit — 97% 정확
- 시간: 2026-05-15
- 발견:
  - 정상 자급제 본품 29건 (97%)
  - 가격 outlier 1건: pid 408 "아이폰 16 프로맥스 256 데저트팝니다" 13,500,000원 (정상 ~135만원의 10배 — 셀러 오타)
  - S25 Edge 1건 잘못 흡수: pid 403430435 → galaxy-s25-256-self
- LAUNCH_PLAN 12b 정책 부합 (precision 80%+).

## 2. catalog 추가 — 4 narrow self lane
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - galaxy-s21-256-self (매물 14일 277건 대상, msrp 999k)
  - galaxy-s22-256-self (300건, 999k)
  - iphone-13-256-self (23건, 1,090k)
  - iphone-14-256-self (36건, 1,250k)
  - 자급제 동일 표현 mustContain group 강화: 정상해지/확정기변/전 통신사/타통신사/유심꽂고/무약정
- LANE_READINESS 4개 ready 등록.

## 3. S25 Edge 차단
- 시간: 2026-05-15
- 변경: galaxy-s25-256-self mustNotContain에 "엣지", "edge" 추가
- 즉시 효과: 8건 reclassify → galaxy-s25-edge

## 4. PHONE_NOISE 강화
- 시간: 2026-05-15
- 변경: 추가 token:
  - "교환원함", "교환원합니다", "교환해요", "교환해주실분"
  - "빈박스", "박스만"
- 위험: 매우 낮음. 정상 매물에 사용 없음.

## 5. 검증
- 139/139 test pass.
- audit-precision-wave114.ts 37/39 (정책 의도 2 fail).

## 6. 거론 금지
- iPhone 13/14/15/16 Plus 256 self — sample 1~2건만, 보류.
- Galaxy Z Flip 6/Fold 7 256 self — sample 2~3건, 보류.
- iPhone 15/16 Pro 512/1TB self — 별도 wave.
