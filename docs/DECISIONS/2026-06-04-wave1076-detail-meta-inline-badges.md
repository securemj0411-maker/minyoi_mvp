# 2026-06-04 Wave 1076 - 상세 헤더 한 줄 뱃지 복구

## 결정

- 상세/쉬운모드 상단의 `당근마켓`, 상태, 위치는 세로로 쌓지 않는다.
- 다만 단순 텍스트 한 줄로 만들면 마켓 아이콘과 상태/위치의 가시성이 사라지므로, 한 줄 안에서 작은 pill/badge로 유지한다.
- 마켓은 기존 `MarketplaceSourceBadge`를 써서 당근 아이콘을 유지한다.
- 상태는 `A급`, `깨끗한 편` 같은 한글 라벨만 보여주고, `a_grade` 같은 내부값은 노출하지 않는다.
- 당근 위치는 `거래 가능 동네:` prefix 없이 `상도동` 같은 compact pill로 보여준다.

## 구현

- `src/components/pack-reveal-modal.tsx`
  - 상세 헤더 메타 row를 `flex-nowrap` 한 줄 badge row로 변경했다.
  - source는 아이콘 포함 marketplace badge로 복구했다.
  - 상태/위치는 compact badge로 유지했다.

- `tests/detail-modal-density-contract.test.ts`
  - 상세 헤더가 한 줄 badge row이고, source badge/상태 badge/위치 badge를 유지하는지 검사한다.
  - `거래 가능 동네:`와 hero의 `ConditionTierChip` stack 재등장을 막는다.

## 보류

- 실제 배포 화면 확인은 Vercel `main` 배포 완료 뒤 진행한다.
