# 2026-05-19 Wave 363 — 득템 점수 색 톤: 빨강 → 초록 그라데이션

사용자 지적: "득템 점수도 높아질수록 색이 초록색으로 되면 좋을거 같은데?"

## 원인 분석

Wave 362에서 박은 색 위계가 의미론 안 맞음:
- 90+ : **rose** (빨강) "핫"
- 80+ : orange "강추"
- 70+ : emerald (초록) "좋음"
- <70 : zinc "보통"

빨강은 한국 + 일반 UX에서 **위험/경고** 시그널. 좋은 점수에 빨강 = 의미 충돌. "핫" 단어가 영어 hot의 빨강 연관이지만 미뇨이 사용자(일반인 차익 추구)에겐 점수 ↑ = 안전한 좋은 매물 = 초록이 자연.

## 결정

**점수 ↑ = 초록 진해짐** (단일 색조 위계, 빨강/오렌지 제거):

| score | 라벨 | 색 (light) | 색 (dark) |
|---|---|---|---|
| 90+ | **최고** | text-emerald-700 | text-emerald-300 |
| 80+ | **강추** | text-emerald-600 | text-emerald-400 |
| 70+ | **좋음** | text-emerald-500 | text-emerald-400 |
| <70 | 보통 | text-zinc-500 | text-zinc-400 |

라벨 "핫" → "**최고**" — 색 의미와 일치 ("hot" 빨강 연관 회피).

## 변경 파일

`src/components/pack-reveal-modal.tsx`:
- `calculateDealScore` return 안 label/toneClass mapping 4단계 다 emerald 그라데이션으로 교체
- "핫" → "최고", rose → emerald-700, orange → emerald-600

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 디자인 노트

- 단일 색조 (emerald) + shade 차이로 강도 표현
- emerald-700 (90+) → emerald-300 (dark mode 90+) — 점진적 변화
- 70+ 이상은 모두 초록 (양호 zone)
- <70은 회색 (중립 zone)
- 사이트 톤 (`var(--brand-accent-strong)` = emerald 계열)과 일관
