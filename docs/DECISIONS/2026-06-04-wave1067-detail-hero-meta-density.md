# Wave 1067 — Detail hero meta density

## Decision

- 상세/쉬운모드 상단에서 `당근마켓`, 상태 chip, `거래 가능 동네: ...`가 세로로 쌓여 모바일 첫 화면을 과하게 차지하는 문제를 정리했다.
- 상단 hero는 빠른 스캔 정보만 남긴다.
  - source badge
  - 대표 상태 chip 1개
  - 당근 direct trade location compact label
- `거래 가능 동네:` 문구는 상단에서 제거했다.
- 위치는 `봉천동 · 서울특별시 관악구 봉천동`처럼 중복될 수 있으므로 hero에서는 `봉천동` 같은 compact label만 보여주고, 원문은 `title`에 유지한다.
- 상세 거래 가능 지역 설명은 기존 안전/거래 정보 영역에 남겨둔다.

## Verification

- `npx eslint src/components/pack-reveal-modal.tsx src/components/condition-chip.tsx tests/condition-tier-display-contract.test.ts tests/detail-modal-density-contract.test.ts`
  - 기존 unused warning만 있고 신규 error 없음.
- `npx tsx --test tests/condition-tier-display-contract.test.ts tests/detail-modal-density-contract.test.ts`
  - 6개 계약 테스트 통과.
- `npm run build`
  - 성공.

## Deferred

- 실제 배포 반영은 Vercel이 `main` 푸시를 배포 완료한 뒤 확인한다.
