# 2026-05-19 Wave 367 — 상세 모달 모바일 박스 평탄화 (카드 안 카드 정리)

사용자 지적: "상세페이지 디자인 좀 일관되게 바꾸면 안돼?? 왜 이렇게 카드 안에 카드 형태가 많음?? 가뜩이나 화면 좁은 모바일인데"

## 원인

모달 안 각 panel이 자체 박스 (`rounded-xl border bg-white p-3 shadow`):
- UpperFoldFearReducers (3 tiles)
- CostAssurancePanel
- SellerTrustPanel (border-l-4 accent)
- CounterfeitChecklistPanel
- SellHelperPanel
- RecommendationReasonPanel
- 모달 우측 column (시세 그래프) — 가장 큰 cream gradient 박스

→ 모바일 좁은 화면에서 박스 padding/border가 컨텐츠 공간 갉아먹음. 박스 안 박스 안 박스.

## 결정

**모바일에서 박스 → divider만, sm+ 데스크탑은 박스 유지** (당근/네이버 톤):

### 변경 패턴
```diff
- <section className="mt-3 rounded-xl border border-zinc-200 bg-white p-3 dark:...">
+ <section className="mt-3 border-t border-zinc-200 bg-white/0 py-3 dark:border-zinc-800 sm:rounded-xl sm:border sm:bg-white sm:p-3 sm:dark:bg-zinc-900/40">
```

- 모바일: `border-t` (구분선만) + `py-3` (수직 padding) + 배경 X
- sm+: `rounded-xl border bg-white p-3 shadow` 유지

### 색 accent panel (border-l-4)
```diff
- <section className="mt-3 rounded-xl border border-zinc-200 border-l-4 border-l-emerald-500 bg-white p-3 ...">
+ <section className="mt-3 border-t border-zinc-200 border-l-4 border-l-emerald-500 bg-white/0 py-3 pl-3 sm:rounded-xl sm:border sm:bg-white sm:p-3 ...">
```

- border-l-4 색 accent **유지** (verdict 시각 강조)
- 모바일 `py-3 pl-3` (좌측 색 라인 + 컨텐츠 여백)
- sm+ 박스 유지

### 모달 우측 column (시세 그래프) — 가장 큰 박스
```diff
- <div className="order-2 mx-3 space-y-2 rounded-2xl border border-[#dfd6c9] bg-[linear-gradient(...)] p-3 shadow-... ring-1 ring-white/70 ...">
+ <div className="order-2 space-y-2 px-3 sm:mx-0 sm:rounded-2xl sm:border sm:border-[#dfd6c9] sm:bg-[linear-gradient(...)] sm:p-3 sm:shadow-... sm:ring-1 sm:ring-white/70 ...">
```

- 모바일: `px-3` (좌우 padding만) — 박스/그라데이션/shadow/ring **다 제거**
- sm+: 기존 cream 그라데이션 박스 그대로

## 변경 panel (총 6개)

`src/components/pack-reveal-modal.tsx`:
1. `UpperFoldFearReducers` (line 1321) — 3 tile 컨테이너 박스
2. `SellerTrustPanel` (line 1690) — `border-l-4` 컬러 accent
3. `CounterfeitChecklistPanel` (line 1749) — `border-l-rose-500`
4. `SellHelperPanel` (line 1869) — `border-l-emerald-500`
5. `PlatformProfitCompare` (line 2056) — 일반 박스
6. `RecommendationReasonPanel` 내부 박스 (line 2167) — 일반 박스
7. 모달 우측 column (line 2535) — 가장 큰 cream 박스

## 미수정 (의도적)

- `RevealResultSkeleton` (line 488, 509) — 로딩 잠깐 표시. 그대로.
- `DealEvidencePanel` (line 918) — 작은 inline expand. 그대로 (작아서 OK).
- `RelatedRevealStrip` (line 2840) — Wave 366에서 이미 박스 제거.

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

모바일 한 카드 내부:
```
[이전]              [이후]
┌─────────┐          ─────────────
│ 박스 안 │          panel A
│ ┌─────┐ │          ─────────────
│ │박스 │ │          panel B (color)
│ └─────┘ │          ─────────────
└─────────┘          panel C
```

좁은 모바일에서 컨텐츠 폭 ↑, 시각 일관성 ↑ (/me 피드와 동일 톤).
