## Wave 64 — parser: iPad Air 4 → A14 chip 매핑

- 시간: 2026-05-14
- 발견: Wave 63 audit 결과 v32_parser_gap 3건 모두 iPad Air 4세대 (A14 Bionic) 매물에서 unknown_chip 발생.
- 변경:
  - `src/lib/option-parser.ts` `parseTabletGenerationChip` ipad_air 분기에 `generation === 4` → "a14" 매핑 추가
- 검증:
  - 6/6 테스트 pass (Air 4세대 → a14, Air 5/6/7세대 → m1/m2/m3 회귀 없음)
  - npm run test:core 139/139 pass
- 위험:
  - LOW: iPad Air 4는 단일 chip(A14 Bionic) 모델 → deterministic 매핑. silent estimation 아님.
- 다음:
  - production audit에서 unknown_chip 추가 감소 확인
  - iPad Pro 10.5 (A10X) 같은 구형 single-chip 모델도 동일 패턴으로 patch 가능 (필요 시)
