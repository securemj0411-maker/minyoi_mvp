# 2026-05-19 Wave 324 — 수요 > 공급 정보 우선순위

사용자 강조 (외부 감사 + 외부인 피드백 #5 재인용): "공급보단 수요가 중요. raw 매물 건수가 헤드라인이 아니라 평가가 헤드라인."

## 문제 진단

이전 wave321~323에서 UpperFold 3타일을 디자인 통일했지만 **정보 우선순위는 안 잡음**:

| 타일 | value (헤드라인) | sub | 문제 |
|------|----------------|-----|------|
| 오늘 물량 | "110건" (raw 매물 등록 수) | "7일 평균 16건/일 · 평소보다 많음" | 일반인은 110건 의미 모름. **공급 raw 숫자가 헤드라인** |
| 회수 속도 | "2일" (raw 시간) | 표본 텍스트 | raw 시간이 헤드라인 |

외부인 #5: "오늘 물량 13건 · 평균 17.9건/일 · 평소 수준 = 공급. 거래 22건 / 30일 = 수요 흔적 있긴 한데 빈약." → 수요 측 지표 강조 필요.

## 결정

### 1. marketActivityDisplay 재작성 — 수요/공급 복합 평가
입력 데이터:
- `flow.count24h` / `flow.avgPerDay7d` = 공급 (매물 등록)
- `velocity.sold7dCount` / `marketBasis.soldSampleCount` = 수요 (거래완료)
- `marketBasis.activeSampleCount` = 현재 매물

공급 평가: `supplyRatio = count24h / avgPerDay7d`
- 1.25+ → high (공급 많음)
- 0.55 이하 → low (공급 부족)

수요 평가: `demandRatio = soldRecent / active`
- 0.5+ → active (거래 활발)
- 0.2~0.5 → ok
- <0.2 → weak (수요 약함)

복합 평가 (수요 우선):
- 수요 active + 공급 low → **"수요 활발 · 공급 부족"** (good) — 빨리 사야 함
- 수요 active → **"수요 활발"** (good)
- 수요 weak → **"수요 약함"** (warn) — 패스
- 수요 ok + 공급 high → **"수요 보통 · 공급 많음"** (info)
- 데이터 부족 → "데이터 부족" (warn)
- 그 외 → "평소 수준" (info)

타일 라벨 `"오늘 물량"` → `"수요 · 공급"`.

sub에 raw 디테일: `오늘 매물 N건 · 평균 M건/일 · 최근 거래 X건`

### 2. 회수 속도 타일 — 평가 헤드라인
- value: `speed.label` (예: "2일") → **"빠름 / 보통 / 느림"**
- sub: raw 시간 + 표본 (`약 2일 · 최근 판매 N건`)
- 라벨: `"보통 며칠에 팔림"` → `"팔리는 속도"`

### 3. 메모리 정책 박음
`~/.claude/.../memory/project_supply_vs_demand_priority.md` 신규:
- 미뇨이 매물 카드 정보 표시 시 raw 숫자보다 평가 우선
- 미래 wave에서 이 정책 까먹지 않게

## 영향

- 사용자 화면: "110건" 같은 raw 매물 건수가 헤드라인에서 사라짐. 평가("수요 활발 · 공급 부족" 등)가 헤드라인.
- 회수 속도 타일: "2일" → "빠름" (평가가 먼저, 시간은 sub).
- 일반인 친화 정체성 + 외부 감사 권고 부합.

## 변경 파일

- 수정: `src/components/pack-reveal-modal.tsx` (`marketActivityDisplay` 재작성 + 회수 속도 타일 라벨/value)
- 신규: `~/.claude/.../memory/project_supply_vs_demand_priority.md` (자동 메모리 — 미래 wave 가이드)
- 수정: `~/.claude/.../memory/MEMORY.md` (인덱스 1줄 추가)

## 검증

- `tsc --noEmit` — 깨끗.
- `eslint` — 깨끗.

## 보류 (이전 wave 그대로)

- 자본/예산 관리, 첫 거래 보호 모드, 응대 템플릿 (사용자 명시)
- 자동 백그라운드 재검증, 24h 풀 숨김 (인프라)
- 셀러 추가 데이터 (`is_proshop`, `last_seen_at`) — API 확장 필요
