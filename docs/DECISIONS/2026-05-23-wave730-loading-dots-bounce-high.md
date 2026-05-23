## Wave 730 — 로딩 점 3개 더 높이 튀기 + 안내 메시지 + 다크모드 가시성

- 시간: 2026-05-23 KST
- 발견: 사용자 보고 3건:
  1. 매물 클릭 시 dots 가 너무 낮게 튐 — "더 높이 진짜 애니메이션으로"
  2. 뭐하는 중인지 안내 없음 — "상품을 확인 중입니다 뭐 어쩌구"
  3. 다크모드에서 dots 가 안 보임 — "검정색이라 눈에 띄지도 않는다"

### 변경

#### 1. 새 keyframe `bounce-high` ([src/app/globals.css](../../src/app/globals.css))
- Tailwind `animate-bounce` 는 `-25%` 만 튐 — 약함.
- 새 `bounce-high`: 50% 시점에 `translateY(-100%)` (점 자기 높이 만큼) + cubic-bezier hop 느낌.
- 0.9s loop. `prefers-reduced-motion` 시 disabled.
- utility class `.animate-bounce-high` 박음.

#### 2. 매물 클릭 시 overlay 강화 ([src/components/explore-client.tsx:2957-2980](../../src/components/explore-client.tsx#L2957))
- `animate-bounce` → `animate-bounce-high`
- 점 크기 `h-3 w-3` → `h-3.5 w-3.5` + `drop-shadow` 글로우 (다크 배경에서 또렷)
- flex 컨테이너 `items-center` → `items-end` (튀는 dots base 아래 정렬)
- **신규 안내 텍스트**:
  - 메인: "상품을 확인 중이에요" (15px font-black)
  - 서브: "시세·재고·셀러 정보를 가져오는 중..." (12px font-bold, white/70)
- 사용자 stuck 인지 해소 ("렉걸린 거 아냐?" → "아 처리 중이구나")

#### 3. 통계 dots 다크모드 가시성 ([src/components/explore-client.tsx:1119-1124](../../src/components/explore-client.tsx#L1119))
- `bg-[#0a9f69]/50 dark:bg-emerald-300/50` → `bg-[#3182f6] dark:bg-blue-300` (토스 블루 통일 + opacity 제거 = 다크에서 또렷)
- `animate-bounce` → `animate-bounce-high`
- `items-center` → `items-end` (튀는 dots base 정렬)

#### 4. FAQ 답변 로딩 dots ([src/components/site-help-faq.tsx:198-200](../../src/components/site-help-faq.tsx#L198))
- `bg-[#6f856e]` (회색-녹색, 다크모드 분기 없음) → `bg-[#3182f6] dark:bg-blue-300` (토스 블루 통일 + 다크 가시성)
- `animate-bounce` → `animate-bounce-high`

### 미터치 (의도적)

- `manual-deposit-client.tsx:212-214` (입금 처리중 dots, `bg-white`) — 사용자가 자주 보는 곳 아님 + 흰색이라 가시성 OK. 일관성 위해 향후 wave 에서 정리 가능.

### 검증

- `npx tsc --noEmit` — 0 error.
- 실제 모바일/다크모드 확인 필요 (사용자 spot check). dots 높이 + 안내 메시지 + 다크 가시성 셋 다 OK 인지.

### 위험

- `bounce-high` keyframe 모든 모던 브라우저 지원 (CSS transform animation). prefers-reduced-motion 처리 박혀있음.
- "상품을 확인 중이에요" 카피가 실제 처리 작업과 일치 — `/api/packs/pool/analysis` 가 마켓 시세 + 셀러 정보 + 재고 가져옴. 거짓 안내 X.

### 다음

- 다른 dots 위치 (manual-deposit) 도 통일 검토 (별도 wave 가능).
- "5초+ 지나면 메시지 변경" 같은 progressive disclosure 는 별도 wave (이번엔 static 메시지).

### 후속 정정 (2026-05-24)

#### 1. `.animate-bounce-high` Tailwind 4 JIT 인식 실패

- 사용자 보고: 점이 안 튐 (가만히 있음).
- 원인: 일반 CSS class `.animate-bounce-high` 박았는데 Tailwind 4 JIT 가 utility 등록 안 함.
- 해결: [globals.css](../../src/app/globals.css) `@theme inline` 블록에 `--animate-bounce-high: bounce-high 0.9s infinite;` 추가 → Tailwind 4 가 `animate-bounce-high` utility 자동 등록.
- 기존 `.animate-bounce-high` plain class 정의는 제거 (중복).

#### 2. JSX comment 위치 syntax error

- ternary `) : (` 안에 `{/* JSX comment */}` 박으면 invalid (Wave 729 와 동일 패턴 반복).
- `// line comment` 로 수정. 패턴 학습 박음.

#### 3. 다크모드 dots 가 검정 — `.dark .bg-white` override

- 사용자 보고: 다크모드에서 점이 검정, 테두리(shadow)만 흰색.
- 원인: [globals.css:304-307](../../src/app/globals.css#L304) `.dark .bg-white, .dark .bg-zinc-50 { background-color: #18181b !important; }` — 다크 panel 배경용 강제 override 인데 dots `bg-white` 도 같이 잡힘.
- 해결: dots 9곳 (매물 overlay 3 + 통계 3 + FAQ 3) `bg-white` → `bg-[#ffffff]` arbitrary value 로 변경. 같은 흰색이지만 CSS selector 가 달라 override 미적용.
- 다른 panel/card 의 `bg-white` 는 영향 0 (의도 유지).

### 검증 (final)

- `npx tsc --noEmit` — 0 error.
- Tailwind 4 utility 등록 확인 + 다크모드 가시성 확인 필요 (사용자 spot check).
