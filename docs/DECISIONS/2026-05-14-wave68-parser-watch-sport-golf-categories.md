# Wave 68 — option-parser v32→v33: watch + sport_golf 카테고리 옵션 추출 추가

> Status: **applied (parser version v32→v33).** code 변경 1 파일, DDL 0, candidate_pool 0, public 0.

CLAUDE.md 6 필드 포맷.

## 0. 발견

- 시간: 2026-05-14 KST
- 발견: Wave 67 mining 후 테스트에서 watch/sport_golf catalog 매칭은 OK인데 `comparableParts` 함수가 두 카테고리를 명시적으로 처리 안 함 (default `[family, model]`로 fallthrough). 또 `confidence` 함수에 watch/sport_golf 가중치 없어서 score=0.45 → needs_review=true (0.65 미만). 결과: 사용자 풀 진입 0건.
- 변경:
  - `src/lib/option-parser.ts:38` PARSER_VERSION v32→v33
  - `comparableParts`에 watch + sport_golf 분기 추가 — `[family, model]` 명시 (모델 코드 strict 매칭으로 충분)
  - `confidence`에 watch + sport_golf 추가 — score +0.35 (camera/speaker/desktop/home_appliance 동일 패턴)
- 검증:
  - 8 매물 테스트 (6 positive + 2 negative):
    - G-Shock GA-2100/DW-5600, TSR2/TSR3, Sony a6400, Seiko 5: 모두 needs_review=false, conf 0.80
    - 줄만/풀세트: 모두 reject (mustNotContain 작동)
  - npm run test:core 139/139 pass
  - npx tsc --noEmit clean
- 위험:
  - LOW: 모델 코드 strict 매칭 (catalog mustContain[0])이 이미 정확성 보장. confidence +0.35는 기존 closed-set 카테고리 동일 정책.
  - 색상/무브먼트/플렉스/로프트 같은 sub-axis는 동일 모델 내 시세 영향 작아 불필요.
- 다음:
  - production audit 재측정으로 watch/sport_golf 매물 풀 진입 확인
  - Seiko 5 SRPD/SBSA inventory thin 대응 (lane 폐기 vs query 대폭 확장) 별도 wave
  - 카테고리 readiness ramp-up (internal_only → ready) 측정 후 결정
