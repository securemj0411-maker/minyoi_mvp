# 2026-05-19 Wave 323 — /me 상세 모달 디자인 시스템 통일

사용자 피드백(2026-05-19): "전체적으로 다 병신임 한눈에 안 들어오고 위계 폰트 다 섞인 거 더럽다". 전면 재디자인.

## 디자인 토큰 (이번 wave에서 정함)

### 색 (의미별 3색 + neutral)
- **emerald** = 좋음 / 안전 / 권장
- **amber** = 주의 / 협상
- **rose** = 위험 / 패스
- **zinc** = neutral / 정보

각 색 사용:
- text: 600/700 (light) / 200/300 (dark)
- bg: 50 (light) / 950 (dark)
- bg 강조: 100 (light)
- 칩/배지: bg-50 + text-700

### 폰트 (4단계만)
- `text-base` (16px) — 상품명
- `text-2xl` (24px) — 예상 순익 (가장 큰 강조)
- `text-sm` (14px) — 패널 제목, 강조 값
- `text-xs` (12px) — 본문
- `text-[10px]` — 라벨 (uppercase + tracking-wide) / 메타

Weight: `font-bold` (강조) + `font-medium` (본문). `font-black` 제거.

### 모서리
- `rounded-xl` — 패널 (12px)
- `rounded-md` — 내부 박스 (6px)
- `rounded-full` — 칩/배지

### Spacing
- 패널 padding: `p-3`
- 패널 간격: `mt-3`
- 칩: `px-2 py-0.5`
- 패널 내부 섹션 구분: `border-t border-zinc-100 pt-3` (박스 X)

### 패널 base 스타일
모든 패널 같은 base:
```
rounded-xl border border-zinc-200 bg-white p-3
dark: border-zinc-800 bg-zinc-900/40
```

색 의미는 **좌측 4px accent border**로만 표현:
- `border-l-emerald-500` (셀러 우수)
- `border-l-rose-500` (가품 체크)
- `border-l-emerald-500` (판매 도우미)

## 변경

### 1. 헤드라인 2-tier
기존: 상품명(17px) + 라벨(13px) + 가격(lg) + 퍼센트(13px chip) — 4사이즈 섞임
변경:
- 상품명: `text-base font-bold`
- 라벨 "예상 순익": `text-[10px] uppercase tracking-wide`
- 가격: `text-2xl font-bold` (강조)
- 퍼센트 칩: `text-xs font-bold` (emerald bg)

### 2. UpperFold 3타일 단일 디자인
- 모든 타일: `rounded-xl border p-3`
- 라벨: `text-[10px] uppercase tracking-wide`
- 값: `text-sm font-bold tabular-nums`
- sub: `text-[11px] font-medium`
- 그림자 제거, 호버에만 미세 transition

### 3. CostAssurancePanel 완전 평탄화
기존: 박스 안 4겹 (panel → 비용 분해 표 → 순익 식 박스 → 매입가 가이드 박스 → verdict 박스 → 문의 details 박스)
변경: **단일 패널 + `border-t` 섹션 구분**. 박스 안 박스 0개.
- 비용 분해: flex justify-between (left label / right value)
- 순익 식: 한 줄 텍스트 (강조 색 없음)
- 매입가 가이드: border-t 섹션 안 평탄 리스트 + verdict 한 줄 (bg-50)
- 문의 details: border-t 섹션 안 ol (rounded-md 박스 1개만)

### 4. 셀러/가품/판매 도우미 패널 통일
공통:
- 흰 카드 + 좌측 4px accent
- 헤더: 라벨(uppercase) + heading(text-sm)
- 본문 평탄 (박스 안 박스 없음)
- 펼침/접힘 칩 zinc-50 (강조 색 X)

차이:
- **셀러**: left-emerald/amber/rose (등급별)
- **가품**: left-rose (위험 신호)
- **판매 도우미**: left-emerald (행동)

### 5. 단어/폰트 일관성
- `font-black` → `font-bold` 전체 치환 (5단계 → 2단계)
- "복붙 가능" 등 군더더기 라벨 제거 → 버튼 "복사"만
- 이모지 최소화 (💡 팁만 유지)

## 변경 파일

- 수정: `src/components/pack-reveal-modal.tsx` 단일 파일
  - 헤드라인 재구성
  - `UpperFoldFearReducers` 디자인 토큰 적용
  - `CostAssurancePanel` 완전 평탄화
  - `SellerTrustPanel` 좌측 accent + 평탄
  - `CounterfeitChecklistPanel` 좌측 accent + 평탄
  - `SellHelperPanel` 좌측 accent + 4섹션 평탄화

## 검증

- `tsc --noEmit` — 깨끗.
- `eslint` — 깨끗.

## 보류 (사용자 명시 + 인프라)

- 자본/예산 관리 / 첫 거래 보호 모드 / 응대 템플릿 (사용자 명시)
- 자동 백그라운드 재검증 (인프라)
- 24h 매물 풀 자동 숨김 (풀 알고리즘)
- 셀러 추가 데이터 (`is_proshop`, `last_seen_at`) — API 확장
