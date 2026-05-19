# 2026-05-19 Wave 318 — stale 배너 + 최악 시나리오 배지 (자율 진행 2차)

Wave 317 후속. 외부인 피드백 중 비파괴적이고 데이터 이미 있는 것만 자율 진행. 큰 신규 기능(ROI/자본/판매 도우미/자동 재검증)은 사용자 논의 대기.

## 결정

### 1. 모달 헤드라인 상단 stale 배너 (`pack-reveal-modal.tsx`)
- `verificationDisplay()`의 `stale` 플래그 (6h 초과) 활용.
- RevealCardItem 좌측 정보 영역 최상단(상품명 위)에 명시적 배너:
  - **6~24h**: amber 배너 `⚠ 재검증 권장 · 시세 변동 가능 · 마지막 검증 N시간 전`
  - **24h+**: rose 배너 `⚠ 데이터 오래됨 · 번개장터에서 직접 확인 · 마지막 검증 N일 전`
- 외부인 의도("큰 노란 배너로 데이터 오래됨, 재검증 중...") 직접 반영. 자동 재검증은 인프라 변경이라 보류, 배너만 박음.

### 2. 최악 시나리오 "최악 시 -X원" 배지 (`pack-reveal-modal.tsx`)
- 신규 헬퍼 `worstCaseProfit(card)` — 시세 -10% + 비용 가정의 보수적 추정.
- RevealCardItem 헤드라인 줄(예상 순익 옆)에 작은 rose 칩으로 표시.
- 임계: worstCase < -5,000원 일 때만 (안전 매물은 노이즈 줄임).
- tooltip: "시세가 10% 떨어지면 어떻게 될지 보수적 시나리오예요. 가품 / 시세 변동 / 사용감 추가 감가 가능성을 흡수한 추정치."
- `profit.ts` 의 `expectedProfitMin = Math.max(0, ...)` 음수 clamp은 그대로 유지 (다른 계산 흐름에 영향 없게). worstCase는 별도 함수로 분리.

### 3. 운영자 풀 카드에 stale 배지 (`admin-pool-browser.tsx`)
- 신규 헬퍼 `verifiedAtStaleness(iso)` — 6h/24h 임계.
- 카드 메타 줄(`relAge` 옆)에 색 칩 추가:
  - 6~24h → amber "재검증 권장"
  - 24h+ → rose "데이터 오래됨"
- 운영자가 stale 매물 빠르게 식별해서 풀에서 무효화 가능.

## 보류 — 동일 변경 사용자 카드 리스트 적용 불가 (다음 wave)

`user-reveal-dashboard.tsx`의 카드 prop 타입 `RevealItem`에 `lastVerifiedAt`/`freshSeconds` 없음. `selectedItem.revealedAt`을 모달 prop으로 매핑할 때만 사용. 카드 단계에서는 노출 자체 없음.

→ 카드에 신선도 강화 적용하려면 `/api/packs/me/route.ts` API 응답에 `lastVerifiedAt` 추가 필요. 다음 wave.

회수 속도 fallback 텍스트도 카드 단계에 표시 자체가 없어 동일 wave에서 보류.

## 보류 — 사용자 논의 필요 (큰 wave)

- 셀러 정보 카드 강화 — 어떤 데이터까지 노출할지 정책 결정 + API 확장 필요.
- 자동 백그라운드 재검증 — 인프라 신규 (cron 외 매물 진입 시 ping).
- 24h 초과 매물 사용자 풀 자동 숨김 — 풀 알고리즘 변경 (사용자 체감 큼).
- 거래 결과 입력 + 개인 ROI 대시보드 — DB 컬럼 추가 + 신규 화면.
- 자본/예산 관리 — DB 필드 + 온보딩 + 매물 필터.
- 첫 거래 보호 모드 — welcome 로직 변경 + 풀 필터.
- 판매 단계 도우미 (자동 판매글, 사진 가이드, 응대 템플릿) — LLM 호출 라우트 신규.
- 카테고리 한정 가품 체크리스트 (에어팟/아이폰/갤럭시) — 정적 데이터 + UI 추가.
- 쿠팡 정가 fetcher (외부인 빠른 fix "정가 대비 %") — 신규 외부 데이터 소스.

## 거절 (wave 317에서 이미 명시)

AI 채팅, 당근마켓, 카테고리 전체 분기, 가품 베이지안, 판매자 분쟁율/사진 역검색.

## 변경 파일

- `src/components/pack-reveal-modal.tsx` — `worstCaseProfit()` 추가, RevealCardItem에 stale 배너 + worst case 배지.
- `src/components/admin-pool-browser.tsx` — `verifiedAtStaleness()` 추가, 카드 메타 줄에 stale 배지.

## 검증

- `tsc --noEmit` — 변경된 두 파일 신규 에러 0.
- 사용자 카드 리스트(`user-reveal-dashboard.tsx`) 미수정.
