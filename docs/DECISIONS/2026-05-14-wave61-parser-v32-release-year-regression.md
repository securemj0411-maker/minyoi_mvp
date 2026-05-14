## Wave 61 — option-parser v31 → v32: laptop release year regression 복구

- 시간: 2026-05-14
- 발견:
  - Wave 50 stale reparse scope 측정에서 v24~v30 매물 15,294건 중 365건이 v31 재파싱 시 needs_review로 깨지는 regression 확인.
  - 샘플 패턴: "맥북프로 2019 13인치", "맥북에어 m1 2020 256" 등이 v26에선 release year 추출 성공 → v31에선 unknown_generation으로 떨어짐.
  - 원인: `parseLaptopReleaseYear` regex가 "2019 맥북" (year-first) 순서만 잡고 "맥북프로 2019" (brand-first) 순서를 못 잡음. \b가 한글 boundary 처리 안 되는 것도 보조 원인.
- 변경:
  - `src/lib/option-parser.ts:38` PARSER_VERSION "option-parser-v31" → "option-parser-v32"
  - `src/lib/option-parser.ts:150` `parseLaptopReleaseYear` fullYear 패턴 1개 추가:
    `(?:맥북|macbook|에어|프로|air|pro|gram|그램)[a-z0-9\s./()\-인치]{0,15}?(20XX)(?:[^0-9]|$)`
  - shortYear 패턴 1개 추가: `(?:^|[^0-9])([0-2][0-9])\s*년(?:[^0-9형식]|$)` — "19년" 형식
  - 표준 release year만 잡기. silent estimation 금지 (LAUNCH_PLAN §12b 준수).
  - "2025년 2월 구매" 같은 purchase year context는 brand에서 15자 이상 떨어져 있어 자동 회피.
- 검증:
  - 새 regex test 8/8 pass (맥북프로 2019, 맥북에어 m1 2020, 맥북프로2017, 19년형 맥북에어 등)
  - `npm run test:core` 139/139 pass (regression 없음, "MacBook purchase year does not fragment Apple Silicon generation" 테스트 통과)
  - `npx tsc --noEmit` clean
  - `npx eslint src/lib/option-parser.ts --max-warnings=0` clean
- 위험:
  - 새 regex는 brand keyword 근접 (15자 이내)인 year만 잡으므로 false-positive risk LOW.
  - chip → year 자동 매핑 (예: m1 → 2020) 같은 silent estimation은 도입 안 함 (§12b 위반).
- 다음:
  - v32 적용 후 production raw 매물의 unknown_generation 비율 재측정 (recent-cron-parser-audit 다시 돌리기).
  - Wave 50 dry-run의 365 needs_review_flip 건수가 v32에서 줄어드는지 확인.
  - macbook lane들의 풀 진입률 추적.
