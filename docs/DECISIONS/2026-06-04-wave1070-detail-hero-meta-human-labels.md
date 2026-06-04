# 2026-06-04 Wave 1070 - 상세 헤더 메타 한 줄화와 등급 라벨 정규화

## 결정

- 상세/쉬운모드 상단의 source, 상태, 당근 동네 정보는 큰 pill 여러 개가 아니라 한 줄 텍스트 메타로 보여준다.
- `거래 가능 동네:` 같은 설명 prefix는 제거하고, 당근 위치는 `은천동`처럼 짧은 동네명만 노출한다.
- `a_grade`, `s_grade` 같은 parser/storage 내부값은 사용자 화면에 직접 노출하지 않는다.

## 구현

- `src/components/pack-reveal-modal.tsx`
  - 상세 헤더 메타를 `당근마켓 · A급 · 은천동` 형태의 한 줄 텍스트로 변경했다.
  - 상태 메타 우선순위를 `conditionTier 한글 라벨 -> conditionChip 한글 라벨 -> conditionClass 한글 라벨`로 정리했다.

- `src/components/condition-chip.tsx`
  - `normalizeConditionTier()`를 추가해 `s_grade/a_grade/b_grade/c_grade/d_grade/reject/unknown_condition`을 표시용 tier로 변환한다.
  - `ConditionTierChip`, `ConditionTierPhotoBadge` 모두 정규화된 tier만 사용한다.

- `tests/condition-tier-display-contract.test.ts`
  - storage tier key가 UI tier key로 변환되는 계약 테스트를 추가했다.

## 검증

- `npx eslint src/components/pack-reveal-modal.tsx src/components/condition-chip.tsx tests/condition-tier-display-contract.test.ts tests/detail-modal-density-contract.test.ts`
  - 기존 unused warning만 있고 신규 error 없음.
- `npx tsx --test tests/condition-tier-display-contract.test.ts tests/detail-modal-density-contract.test.ts`
  - 6개 계약 테스트 통과.
- `rg -n "거래 가능 동네:|MarketplaceSourceBadge source=\\{card\\.marketplaceSource\\}|<ConditionTierChip\\s+([\\s\\S]*?)tier=\\{card\\.conditionTier\\}|a_grade" src/components/pack-reveal-modal.tsx src/components/condition-chip.tsx`
  - `a_grade -> A` 변환 매핑 외 source/detail hero 노출 없음.
- `npm run build`
  - 성공.

## 보류

- pack modal에 남아 있는 오래된 unused warning 9개는 이번 UI 문제의 직접 원인이 아니라서 별도 정리 대상으로 남겼다.
