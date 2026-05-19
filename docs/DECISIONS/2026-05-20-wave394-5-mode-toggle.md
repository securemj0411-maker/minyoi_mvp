# Wave 394.5 — #23 초보/상세 모드 토글

날짜: 2026-05-20
영역: pack-reveal-modal RevealCardItem + ComparableListingsPanel

## 배경

외부 review #23: "리셀 초보자용 설명도 있고 수수료/차익/시세 그래프 같은 전문가형 정보도 있음. 타깃이 약간 섞여 있음."

사용자 명시 채택. 디자인 결정 후 진행:

> "디테일 펼침 + 일부 고급 기능. 기댓값 계산 같은 통계 도구 X (별 wave 또는 보류)"

## 본질 vs 전문가 모드 논의

미뇨이 메모리 룰 `project_core_principle_consumer_friendly`:
> "전문 리셀러 pivot 금지"

전문 모드 (기댓값 / 회전율 advanced 그래프 / 표준편차 통계) 가치 ↓:
- 미뇨이 본질과 충돌
- 전문 리셀러는 자체 도구 (KREAM, Stockx, Excel) 보유
- 일반인 = 미뇨이 타깃 — 통계 도구 X 일반인 이탈

외부 review #23 원문도 "상세 모드 = 계산식, 수수료, 채널별 순익, 근거 매물" — **이미 있는 정보 펼침**. 새 통계 도구 X.

## 변경 (단계별)

### Wave 394.5.a — 토글 자체 + DealEvidence 자동 펼침

`RevealCardItem` 안:
- `mode` state ("simple" | "detailed"), 디폴트 = simple
- `localStorage.minyoi_modal_mode` 기억 (mount 시 sync, toggle 시 store)
- mode === "detailed" 시 `dealExpanded = true` 자동 (useEffect)
- 메타 line (매입/시세/신선도) 안 우측 토글 chip:
  - simple: "🔍 상세 보기"
  - detailed: "← 간단 보기"
- title hint: "더 자세한 정보 보기 (계산식, 비용 분해 등)"

### Wave 394.5.b — ComparableListingsPanel limit 6 → 12

`ComparableListingsPanel`:
- `mode` prop 추가 (default = "simple")
- `limit = mode === "detailed" ? 12 : 6`
- fetch 항상 16 까지 보관 (re-fetch X). render 시 `listings.slice(0, limit)`
- 호출 위치 `<ComparableListingsPanel card={card} mode={mode} />`

### Wave 394.5.c — 신뢰도 분해 자동 펼침

`<details>` (신뢰도 X% 분해 카드):
- `open={mode === "detailed"}` 자동 펼침
- 사용자 재닫음 가능 (native details 동작)

## 의도적 미수용 (별 wave)

- **회전율 그래프** — 이미 `marketActivityDisplay` + 회전 타일. advanced 추이 그래프 = 미뇨이 본질 흔듦
- **수요-공급 그래프** — 일반인 해석 어려움. 차트 보고도 결정 X
- **기댓값 / 표준편차 통계** — 주식 도구 (TradingView) 수준. 미뇨이 갈 길 X
- **분포 분석** — 통계 전공자 톤
- **모든 panel 자동 펼침** — DealEvidence + 신뢰도만. WhyTrust / Counterfeit / SellHelper 등은 그대로 (사용자 클릭 가치 있음)

## 후속

- **Wave 394.5.d** (선택): 비용 row 안 % 표시 (매입가 기준) — detailed 시. 비용 분해 시각 강화
- **Wave 394.5.e** (선택): RecommendationReasonPanel detailed 자동 펼침 — 추천 이유 깊이
- **별 wave**: 전문가 도구 (Pro tier 결제 후 접근 영역으로 보류)

## 검증

- TypeScript: 우리 변경 0 에러
- localStorage SSR-safe (try/catch + typeof window check via try)
- mode 변경 시 fetch re-run X (limit 16 보관 + render slice)

## 원칙

- 일반인 친화 단일 톤 유지 (메모리 룰)
- 디테일 펼침 = 이미 있는 정보 (새 정보 X)
- 사용자 결정 권한 유지 (toggle, 재닫음 가능)
- 미뇨이 본질 = 일반인 부수입. 전문가 도구 본질 흔들면 안 됨
