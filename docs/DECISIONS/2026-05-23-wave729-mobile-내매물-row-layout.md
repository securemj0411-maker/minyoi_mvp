## Wave 729 — 비교매물 "내 매물" row 모바일 layout 짤림 fix

- 시간: 2026-05-23 KST
- 발견: 사용자 모바일 스크린샷 보고 — 비교매물 list 최상단 "내 매물" row (주황색 amber 톤) 의 박스 안 콘텐츠가 작은 화면에서 짤림. 좀 이상해 보임.

### 원인 추정

- `<li>` flex layout: `[썸네일 52px] [텍스트 영역 flex-1] [가격 shrink-0]`
- 모바일 360px 폭에서:
  - 가격 영역이 wide (예: "245,000원" 80~90px) + gap × 2 + 썸네일 52px → 텍스트 영역 약 180~200px
  - "내 매물" pill (작은 알약) + 상품명 (긴 텍스트) line — pill 이 압축되거나 상품명 line-clamp 가 wrap → 카드 height 늘어남 → vertical 영역 짤림
  - flex item `min-w-0` 누락 시 truncate 작동 안 함

### 변경

[src/components/pack-reveal-modal.tsx](../../src/components/pack-reveal-modal.tsx) 두 위치 동일 fix (상세 모드 line 2672 + 쉬운 모드 line 4785):

1. **컨테이너**: 모바일 패딩 축소 — `px-3 py-3` → `px-2.5 py-3 sm:px-3` (상세) / `px-4` → `px-3 sm:px-4` (쉬운). gap 도 `gap-3` → `gap-2.5 sm:gap-3`.
2. **썸네일**: 모바일 축소 — `h-[52px] w-[52px]` → `h-11 w-11 sm:h-[52px] sm:w-[52px]` (44px). 쉬운 모드도 `h-12 w-12` → `h-11 w-11 sm:h-12 sm:w-12`. Image `sizes` 도 responsive.
3. **텍스트 영역 line1**: `flex items-center gap-1.5` → `flex min-w-0 items-center gap-1.5` (overflow-hidden flex item 명시).
4. **"내 매물" pill**: `rounded-full ...` → `shrink-0 rounded-full ...` (작은 화면에서 pill 압축 방지).
5. **상품명**: `line-clamp-1 ...` → `min-w-0 flex-1 truncate ...` (truncate 가 single-line guarantee + min-w-0 로 flex item 압축 OK).
6. **"매입가 기준" 라벨**: `text-[10.5px]/[11px] font-bold` → `truncate text-...` (한 줄 보장).

### 검증

- `npx tsc --noEmit` — 0 error.
- 실제 모바일에서 확인 필요 (사용자 spot check). 효과 없으면 다음 wave 에서 layout 단순화 (vertical stack on mobile) 검토.

### 위험

- 모바일 썸네일이 52px → 44px 로 줄어듦 — 사진 인식성 살짝 감소하지만 layout 안정성 우선.
- 다른 비교매물 row (내 매물 아닌 것) 는 미터치 — 일반 row 들은 별도 layout. 일관성 위해 동일 패턴 적용 필요할 수도 (다음 wave).

### 메모

- 다른 세션의 launch-77~85 + Wave 722 emergency rollback 이 main 에 push 됨 (`a5619f1`, `772d3b6`). pack-reveal-modal 충돌 risk 사라짐 — wave 729 안전 진행.
