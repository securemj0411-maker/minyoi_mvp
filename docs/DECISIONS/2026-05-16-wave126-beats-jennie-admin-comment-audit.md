# Wave 126 — Beats Solo 4 Jennie Edition 차단 + 운영자 코멘트 50건 audit

> 사용자 지적: "디버깅 코멘트 너가 해결한거말고 표시 안된거 처리해". 운영자 풀 코멘트 DB 조회.

## 1. 운영자 코멘트 50건 audit
- 시간: 2026-05-16
- 발견: mvp_reveal_feedback 테이블 note 50건 조회
- **이미 처리된 패턴** (코드에 "사용자 코멘트 pid XXX" 표시 박힘, Wave 90~124에서):
  - 모스키노 케이스, 충전 케이스, 사라진 매물, 액정 깨진
  - 200만원 상한, 애플펜슬+키보드 세트, iPhone+Watch 묶음
  - 다이슨 V12, 배터리 75%, 풀세트+매직마우스
  - 노캔X vs ANC, 제품사요/구매희망, iMac 용량 분리 등 ~30건

## 2. 새 fix — Beats Solo 4 Jennie Edition (pid 318408095, 406096153)
- 시간: 2026-05-16
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** beats-solo4 mustNotContain 추가:
  - "제니", "jennie", "제니 에디션", "스페셜 에디션", "special edition"
- 이유: 일반 ~₩170K vs Jennie Edition ~₩600K (3.5배). 시세 왜곡 심각.
- 검증: 139/139 test pass.

## 3. 진짜 미해결 (owner decision 필요)
시세 산정 로직 복잡 변경:
- 거래일 cadence + 게시일자 세부 가중 (pid 406614375, 406706245, 404852805)
- Apple Watch SE2/SE3 시세 358K~369K 너무 높음 — 시세 산정 로직 버그 가능성 ⚠️
- 아웃라이어 trim 미작동 (pid 407950240 60K, 408178451 5K)
- 색상별 시세 분리 (미드나이트 vs 스타라이트)
- 신뢰도 100% 계산 로직 (pid 405627929)
- 골프 드라이버 loft 옵션 (pid 398736849)

## 4. 너 의문 답
- Apple Watch Nike Edition: HW 동일, 밴드만 다름 → 시세 lane 동일 (별도 SKU X)
- AirPods Max 2 = Max USB-C: 같음 (Apple 명칭만 다름)
- G-Shock: watch category blocked로 자동 차단됨

## 5. 거론 금지
- 시세 산정 로직 fix는 별도 wave (Wave 127+)에서 진행. owner decision 필요.
- 코멘트 표시 패턴 학습: "사용자 코멘트 pid XXX" 코드 코멘트로 박는다.
