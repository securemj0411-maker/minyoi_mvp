# 2026-05-19 Wave 320 — 카테고리별 가품 체크리스트 + 판매 단계 도우미

사용자 결정 (B3 + A1) 진행. 12개 위험 카테고리 모두 깊이 있게 박음 — 한국 중고시장 실제 가품 패턴 + 카테고리별 거래 노하우 반영.

## B3 — 카테고리별 가품 체크리스트 (`counterfeit-checklist.ts`)

### 데이터 구조
- 신규 lib `src/lib/counterfeit-checklist.ts`.
- 12개 위험 카테고리: shoe / smartphone / earphone / bag / perfume / watch / tablet / smartwatch / clothing / laptop / drone / camera.
- 안전 카테고리(monitor/desktop/lego/speaker/kickboard/game_console/home_appliance/sport_golf)는 의도적 미포함 — 카드 노이즈 안 박음.

### 카테고리당 체크 항목
- 평균 6~7개 항목 (총 ~75개 체크).
- 3단계 우선순위:
  - **필수 (must)**: 안 하면 거래 안 됨 (영수증, 시리얼, Find My 해제, 무브먼트 등)
  - **권장 (recommended)**: 가능하면 추가 신뢰
  - **참고 (extra)**: 추가 신뢰 신호 (가죽 냄새, 사용감 영상 등)
- 각 체크: 제목 + 디테일 설명 (왜 중요한지 + 어떻게 확인하는지).

### 카테고리별 핵심 (예시)
- **shoe (115 SKU)**: KREAM 검수, 박스 사이드 라벨, 솔 패턴, 로고 디테일, 안창 폰트, 봉제선
- **smartphone (87 SKU)**: IMEI 조회 (apple.com/checkcoverage), Find My 해제, 통신사 잠금, 배터리 효율, 부품 갈이, AppleCare+
- **earphone (36 SKU)**: 충전 케이스 안쪽 시리얼, 노캔 시연 영상, 공간 음향, 페어링
- **bag (25 SKU)**: 브랜드별 시리얼 위치 (LV 핀스탬프 / 샤넬 미니북릿), 봉제선, 패턴 매칭, 금속 부품 무게
- **watch (5 SKU)**: 무브먼트 사진, 무게 (저울), 케이스백 시리얼, 워런티 카드, 초침 작동
- **drone (25 SKU)**: DJI Assistant 활성 기록, 배터리 사이클, 짐벌 카메라, 펌웨어 위변조 (해킹 모델)
- **camera (9 SKU)**: 셔터 카운트 (Imaging Edge), 렌즈 곰팡이 (백라이트 검사), 펌웨어 정품, 한국 정품 vs 병행수입

### UI 컴포넌트
- `CounterfeitChecklistPanel` (pack-reveal-modal.tsx 내부) — CostAssurancePanel 다음 자리.
- 접힌 상태: 필수 체크 4개를 칩으로 미리 보기 + "필수 N개 보기" 버튼.
- 펼친 상태: 필수(rose) → 권장(amber) → 참고(zinc) 순으로 박스 리스트. 각 항목에 priority 배지.
- 풋터: "필수 항목 하나라도 셀러 거절 시 거래 보류 + 안전결제 필수" 경고.

## A1 — 카테고리별 판매 단계 도우미 (`sell-helper.ts`)

### 데이터 구조
- 신규 lib `src/lib/sell-helper.ts`.
- 12개 카테고리 (가품 체크리스트와 동일 범위).
- 카테고리당 5가지 묶음:
  1. **제목 패턴** — placeholder ({brand}/{model}/{size}/{color}/{capacity}/{network}/{status}) 명시
  2. **본문 템플릿** — 카테고리별 5~8개 항목 (label + hint)
  3. **사진 가이드** — 카테고리별 5~7장 (필수 vs 선택)
  4. **호가 룰** — `askingPriceMarkupPct` (3~7% 카테고리별 협상 폭)
  5. **카테고리 팁** — 가격 +α 받는 핵심 (`proTip`)

### 카테고리별 호가 협상 폭 (한국 중고시장 평균)
| 카테고리 | 시세 markup | 근거 |
|---------|------------|------|
| 명품 가방 | +3% | 정품 인증이 가격 결정, 협상 폭 좁음 |
| 명품 시계 | +3% | 워런티 카드 풀세트가 가격 결정 |
| 명품 의류 | +4% | 미사용 + 택 + DPP 인증이 결정 |
| 스니커즈 | +5% | KREAM 검수 거치면 +α |
| 향수 | +5% | 미개봉 vs 사용감 차이 큼 |
| 이어폰 | +5% | 가품 의심 많아 협상 폭 좁음 |
| 드론 | +5% | 배터리 개수 + 사이클이 결정 |
| 태블릿 | +6% | 풀박 + 사이클 낮음 = +α |
| 스마트워치 | +6% | 정품 줄 + AppleCare = +α |
| 노트북 | +6% | 풀박 + 사이클 + AppleCare = +α |
| 카메라 | +6% | 셔터 카운트 + 렌즈 곰팡이 결정 |
| 스마트폰 | +7% | 자급제 + 풀박 + 배터리 = +α |

### 카테고리별 사진 가이드 (예시)
- **shoe**: 정면+측면 / 솔 / 박스 사이드 라벨 / 안창 사이즈 라벨 / KREAM 검수 카드 (선택) / 사용감 클로즈업 (선택)
- **smartphone**: 정면(액정 켜진) / 후면 / 옆면 4면 / 박스 라벨 / 설정 정보 화면 (IMEI) / 배터리 효율 화면 / 부품 정품 화면 (선택) / 구성품 (선택)
- **bag**: 정면+후면 / 측면+바닥 / 안감 시리얼 / 손잡이 금속 부품 / 더스트백+박스 / 영수증 / 봉제 디테일 (선택)
- **drone**: 정면+짐벌 / 후면+측면 / 리모트+시리얼 / 배터리+사이클 화면 (DJI Fly) / 박스+케이스 / 비행 시연 영상 (선택)

### UI 컴포넌트
- `SellHelperPanel` (pack-reveal-modal.tsx 내부) — CounterfeitChecklistPanel 다음.
- 접힌 상태 기본. **매수 후(bought/inspected/listed/resold feedback) 자동 펼침**.
- 펼친 상태 4섹션:
  1. 호가/거래가 박스 (시세 +α% 추천 호가 + 목표 거래가)
  2. 추천 제목 + 복사 버튼
  3. 본문 템플릿 (pre + 복사 버튼)
  4. 필수 사진 N장 (번호 매김 박스) + 선택 사진
  5. 카테고리 팁 (💡 emerald 박스)

### Props 변경
- `RevealCardItem`에 `currentFeedbackType?: string | null` 추가.
- 모달 호출자에서 `currentFeedbackType` 전달 (이미 모달 prop으로 받음).

## 변경 파일

- 신규: `src/lib/counterfeit-checklist.ts` (~280 lines)
- 신규: `src/lib/sell-helper.ts` (~450 lines)
- 수정: `src/components/pack-reveal-modal.tsx`
  - import 추가 (`categoryFromComparableKey`, `counterfeit-checklist`, `sell-helper`)
  - `CounterfeitChecklistPanel` 컴포넌트
  - `SellHelperPanel` 컴포넌트
  - `RevealCardItem` props에 `currentFeedbackType` 추가
  - 호출자에서 prop 전달
  - RevealCardItem 좌측 정보 컬럼에 두 패널 삽입

## 검증

- `tsc --noEmit` — 신규 6개 파일 모두 에러 0.

## 핵심 설계 결정

1. **LLM 호출 없음** — 정적 룰만으로 충분. 비용 + 모더레이션 책임 회피 + 일반인 정체성 부합.
2. **카테고리 매핑은 `categoryFromComparableKey`** 재사용 — 기존 시스템 일관성.
3. **사용자 체크박스 진행 X** — 단순 안내. 작업 폭증 막음. 메모리/state 안 더해도 됨.
4. **카드 리스트 비표시** — 모달에서만 (카드는 공간 부족, 정보 충돌).
5. **매수 후 자동 펼침** — `bought`/`inspected`/`listed`/`resold` feedback 받은 매물엔 SellHelperPanel 자동 expanded=true.

## 보류 (다음 wave)

- 사진 업로드 인터페이스 (현재는 가이드만, 실제 업로드는 사용자 직접) — 별도 UX 검토.
- 판매 타이밍 푸시 알림 (외부인 의견) — 인프라 신규.
- 응대 템플릿 (사는 쪽 3개 처럼 파는 쪽 3개) — 다음 wave 가능.
- 자본/예산 관리, 첫 거래 보호 모드, 자동 백그라운드 재검증 — 사용자 결정 대기.

## 거절 (영구)

- AI 채팅 어시스턴트 (MVP 범위 밖).
- 거래 결과 입력 + ROI 대시보드 (사용자 의견: "거래 결과는 너무 믿을 수 없어서 안됨" — wave 319).
- 당근마켓 통합 (P2).
- 카테고리 전체 분기 시스템 (정책 충돌 — 단 가품/판매 도우미는 이번 wave에서 카테고리별 분기 OK, 정체성 부합 영역).
- 판매자 분쟁율/사진 역검색 (신용 스코어링 = 전업 도구).
