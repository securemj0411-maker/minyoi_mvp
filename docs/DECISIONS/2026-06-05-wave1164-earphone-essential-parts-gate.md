# Wave 1164 — 이어폰 필수 구성품 누락 hard gate

- 결정: `갤럭시 버즈3 실버 (이어폰만)`처럼 양쪽 이어버드는 있어도 충전 케이스/필수 구성품이 빠진 TWS 매물은 완제품 비교군과 피드 후보에서 hard block 한다.
- 이유: 기존 파서는 `한쪽만`, `케이스만`은 부품 단품으로 막았지만 `이어폰만`, `충전케이스 없음/분실/미포함` 표현은 완제품 Buds/AirPods 시세와 비교될 수 있었다. 이 경우 매입가와 시세가 정상 완제품 기준으로 잡혀 사용자 신뢰를 크게 깬다.
- 구현:
  - `earphone-condition-evidence-v3`에 `essential_parts_missing` 신호를 추가했다.
  - `option-parser-v73`에서 해당 신호를 `parts_only`, `earphone_missing_parts` note로 내려 `flawed`/review 대상으로 만든다.
  - candidate pool promotion gate에 `essential_parts_missing`을 추가해 신규 ready 진입을 차단한다.
  - worker 재파싱 전 stale ready row가 피드/상세에 남지 않도록 pool API와 market-source API 응답 직전에도 동일 신호를 재검사한다.
- 검증:
  - `갤럭시 버즈3 실버 (이어폰만)` → `conditionClass=flawed`, `parts_only`, `earphone_missing_parts`, `needsReview`.
  - `충전케이스 분실해서 이어폰만 판매` → `essential_parts_missing` hard block.
  - `에어팟4 노캔 없음` 같은 일반 no-ANC 모델은 결함으로 오판하지 않도록 no-ANC variant branch를 분리했다.
  - `npx tsx --test tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts tests/condition-policy-pool-gate.test.ts` 통과.
  - targeted eslint 통과, `npm run build` 성공.
- 보류:
  - 기존 DB의 v72 ready row는 parser version bump로 worker 재파싱 대상이 된다. 즉시 화면 노출은 API guard로 막았고, 대량 DB invalidation은 별도 운영 sweep에서 필요할 때 실행한다.
