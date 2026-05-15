# Wave 117c — Galaxy 일반/Note broad 5 SKU (241건 복구)

## 1. 진단
- 시간: 2026-05-15
- 발견: Galaxy 83% null (10,978건). S23 613건, S24 555건, S21 378, S22 318, Note 20 79. catalog는 S25만 broad + Ultra/Plus/FE/Edge.
- ⚠️ S23/S24는 GENERATED_CATALOG에 이미 있음 (다른 세션이 만든 거) — 처음엔 CORE에도 추가했다가 duplicate 발견 후 제거 (Wave 117e).

## 2. catalog 추가
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - galaxy-s21, galaxy-s22, galaxy-note20 broad
  - GENERATED 점검 후 진짜 누락만 추가 (S23/S24 broad는 GENERATED에 있어 추가 X)
- 검증: 139/139 test pass.

## 3. Production reclassify — 241건
- 실행: scripts/reclassify-wave117c-galaxy.ts (3 iter)
- 결과: 185 + 46 + 10 = **241건 복구**
  - note20 41, s21 37, s22 32, galaxy-s23-fe 36 (이전 누락 매물 흡수)

## 4. 거론 금지
- S20 옛 모델 39건만 — sample 부족, catalog X.
- S Plus 시리즈 (S21+/S22+/S23+) Wave 118로 별도 추가.
