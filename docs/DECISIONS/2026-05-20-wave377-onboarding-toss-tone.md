# 2026-05-20 Wave 377 — 가입 직후 모달 토스 톤 + stagger 애니메이션

사용자 영감: 토스 캡쳐 — "외상으로 더 구매할까요?" 모달.
- 다크 모드 + 컬러 액센트
- 큰 emoji/일러스트 (h-16 동그라미 안에)
- text-2xl 임팩트 헤더
- 부제 leading-6
- 큰 액션 버튼 (full width, py-4)
- 하단 "닫기" 텍스트 버튼

## 결정

**Lightweight 모드 (가입 직후) 만** 토스 톤. 다른 모드는 기존 톤 유지.

### 시각 위계 (lightweight 전용)

```
                          [X]
       ┌──────┐
       │  💰  │ (큰 emerald 원형, h-16)
       └──────┘

   환영해요 👋
   예산은 어느 정도세요?

   예산 안에서만 30개 골라드릴게요.
   나중에 수정할 수 있어요.

   ┌─────────┐  ┌─────────┐
   │ 10만 이하│  │ 30만 이하│  (py-4 큰 카드)
   └─────────┘  └─────────┘
   ┌─────────┐  ┌─────────┐
   │ 50만 이하│  │ 제한 없음│
   └─────────┘  └─────────┘

   ┌────────────────────────┐
   │ 이 예산으로 30개 받기   │  (py-4 큰 CTA)
   └────────────────────────┘
              건너뛰기
```

### Stagger 애니메이션

각 element를 `explore-fade-up` (8px → 0, opacity 0 → 1, 360ms ease-out) + delay:
| element | delay |
|---|---|
| emoji 동그라미 | 0ms |
| "환영해요 👋" | 60ms |
| "예산은 어느 정도세요?" | 120ms |
| 부제 | 180ms |
| 예산 chips | 240ms |
| 받기 버튼 | 300ms |
| 건너뛰기 | 360ms |

→ 사용자가 모달 열리는 순간 element들이 순차적으로 등장 = 토스 톤 라이브감.

`@keyframes explore-fade-up` — `src/app/globals.css` 추가.

### 디자인 변경

- 큰 emoji 동그라미 (h-16 w-16 bg-emerald-100, 🌳 inset shadow)
- 헤더 text-2xl bold (이전 text-xl)
- 헤더 2줄로 분할 (환영해요 / 예산 ?) — 임팩트 ↑
- 부제 leading-6 (text-sm)
- 예산 chips `rounded-2xl border-2 py-4` (기존 rounded-xl border py-2.5)
- CTA 버튼 lightweight일 때 `py-4 text-base`
- "건너뛰기" 텍스트 버튼 추가 (CTA 아래)
- X 닫기 우상 absolute (모달 panel `relative` 추가)

### 차이 — Lightweight vs Full form

| 측면 | lightweight | full form |
|---|---|---|
| 헤더 정렬 | 가운데 | 좌측 |
| 큰 emoji | ✅ 동그라미 | ❌ |
| Chips padding | py-4 | py-2.5 |
| Chips border | border-2 | border |
| CTA padding | py-4 | py-3.5 |
| 하단 "건너뛰기" | ✅ | ❌ |
| Stagger animation | ✅ | ❌ |

## 변경 파일

`src/components/explore-client.tsx`:
- modal panel `relative` 추가
- lightweight 헤더 영역 분리 (가운데 정렬 + 큰 emoji)
- 예산 chips className lightweight 분기
- CTA 버튼 lightweight 분기 + stagger style
- "건너뛰기" 버튼 추가

`src/app/globals.css`:
- `@keyframes explore-fade-up` 정의

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

- 가입 직후 첫 인상 = 토스/Linear 톤 (모던, 친근, 라이브감)
- Stagger로 자연스러운 진입 — 모달이 "딱" 등장이 아니라 element들이 부드럽게
- 사용자가 "와 디자인 좋다" 체감 → 신뢰감 ↑
