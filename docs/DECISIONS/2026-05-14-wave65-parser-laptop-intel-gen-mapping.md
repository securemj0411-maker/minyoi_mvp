## Wave 65 — parser: laptop "N세대" Intel generation → release year 매핑

- 시간: 2026-05-14
- 발견: audit에서 "LG 그램 17인치 노트북 (13세대...)" 같은 매물이 unknown_generation으로 빠짐. Intel "N세대" 토큰을 release year로 매핑 필요.
- 변경:
  - `src/lib/option-parser.ts` `parseLaptopReleaseYear`에 Intel gen → year 매핑 추가:
    Gen 8→2018, 9→2019, 10→2020, 11→2021, 12→2022, 13→2023, 14→2024 (Intel 공식 launch year).
  - laptop 카테고리에서만 호출되므로 iPad "5세대" 같은 다른 카테고리 충돌 없음.
- 검증:
  - 7/7 테스트 pass (Intel 11/12/13세대 → 연도 매핑, macbook 회귀 없음, purchase year 회피 유지)
  - npm run test:core 139/139 pass
- 위험:
  - LOW: Intel gen → year는 공식 launch year 매핑, deterministic. silent estimation 아님 (§12b 준수).
- 다음:
  - production audit에서 LG/Samsung 노트북 unknown_generation 추가 감소 확인
