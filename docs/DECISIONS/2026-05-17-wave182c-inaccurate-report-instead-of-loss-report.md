# Wave 182c — 손해 신고 → 정보 오류 신고로 pivot (자연 피드백 수집)

## 사용자 피드백

> "잠만 손해봤어요 말고
> 3토큰 받기 부정확 정보 신고하고
> 이런식으로 해서 우리 피드백 자연수집 어떄??? 이게 훨씬 나을듯??
> 매물 손해 신고는 일단 미루고"

## 통찰

### loss_report 의 문제 (Wave 182 박은 거)
- **임계값 높음** — 사용자가 실제 매물 매수 + 손해 본 뒤에야 누름
- **bought 카운트 0 (현재 DB)** — 사용자가 매수 신고 자체를 거의 안 함
- 결과: feedback 수집 sample 매우 적음

### inaccurate_report 의 장점
- **매수 전에도 신고 가능** — "이 시세 이상한데?" 즉시 신고
- 임계값 낮음 + 토큰 +3 보상 → 자연 수집 polling source
- feedback-resolutions 38건 같은 패턴 — 사용자 자발적 알고리즘 보정 input
- **algorithm 보정 데이터** — 시세 부정확/매물 정보 다름/이미 판매됨/가짜 가격 의심 카테고리

## 박은 것

### 1. 새 feedback type — `inaccurate_report`

`src/lib/pack-open.ts` 의 `RevealFeedbackType` 에 추가.
`loss_report` 는 유지 (보류 의미, UI 노출 X, 나중에 활성화 가능).

### 2. 새 API — `/api/packs/reveals/inaccurate-report` (POST)

```
body: { pid, category, note? }
```

**카테고리** (VALID_CATEGORIES):
- `price` — 시세 부정확
- `info` — 매물 정보 다름 (옵션/색상/용량/모델)
- `sold` — 이미 판매됨
- `fake_price` — 가짜 가격 의심
- `other` — 기타

note 는 **optional** (카테고리만 골라도 제출 가능 — 임계값 낮춤).
note 박힐 때는 `[카테고리 라벨] note` 형식으로 prefix 박음 (운영자 보기 쉽게).

rate limit 시간당 10건 (loss_report 의 5건 보다 높음 — 임계값 낮으니까).
중복 (user_ref + pid) 검사 후 토큰 +3 지급.

### 3. UI — 매물 상세 모달 버튼 변경

`pack-reveal-modal.tsx` `RevealCardItem`:
- 이전: `🚨 이 매물 받고 손해 봤어요` (rose)
- 새: `🔍 정보 오류 신고하고 토큰 +3 받기` (amber)
- 이미 신고됨: `✅ 신고 완료 — 검수 중`

### 4. UI — 신고 모달 변경

`user-reveal-dashboard.tsx`:
- 제목: `🔍 정보 오류 신고`
- 카테고리 chip 5개 (single-select, 큰 버튼 2 줄 grid)
- optional 사유 textarea (자유 입력, 비어있어도 OK)
- submit 조건: 카테고리 선택만 (사유 optional)
- 성공 안내: "비슷한 매물의 시세/정보가 자동 보정됩니다"

### 5. 운영자 검수 페이지 일반화

`/cau~~/loss-reports/` 그대로 둠 (path 호환). 내용 일반화:
- 제목: `🔍 사용자 신고 검수` (loss + inaccurate 통합)
- API filter: `feedback_type=in.(loss_report,inaccurate_report)`
- 각 신고 row 에 type chip 표시 (`🔍 정보 오류` amber / `🚨 손해 신고` rose)

## Trade-off

### Pros
- **자연 수집** — 임계값 낮음, 사용자 매수 전 신고 가능
- **algorithm 보정 데이터** — 카테고리별 sample 누적 → AI L2 / 매물 검수 input
- **retention** — "내 신고가 사이트 보정에 반영됨" 메시지 강함

### Cons
- spam risk — rate limit 시간당 10건 + 중복 차단 + 카테고리 선택 강제로 마찰
- "토큰 받기 위한 의미 없는 신고" 가능성 — 운영자 dismissed 시 토큰 회수 로직 없음 (TODO)
- 카테고리 5개 외 신호 놓침 — "기타" 박혀있지만 정밀도 ↓

## 운영 가이드

운영자 검수 페이지 SOP:
1. **price (시세 부정확)** — 매물 시세 vs 표시 시세 확인. 시스템 오류면 `mvp_market_price_daily` 보정 or candidate-pool-builder 의 fallback 로직 점검.
2. **info (정보 다름)** — `mvp_listing_parsed.parsed_json` 확인 + parser regex 보정 wave 또는 catalog SKU 보정.
3. **sold (이미 판매됨)** — `mvp_raw_listings.listing_state` tick-pipeline 동기화 지연. 매물 invalidate.
4. **fake_price (가짜 가격)** — risk_keyword + extreme_discount flag 추가 + AI L2 escrow.
5. **other** — note 보고 분류 추가 가능성 검토.

## 보류 항목

### loss_report (매수 후 손해 신고)
- 코드 유지 (`RevealFeedbackType` 에 남음, endpoint `/api/packs/reveals/loss-report` 도 남음)
- UI 노출 X (PackRevealModal 버튼은 inaccurate_report 로 동작)
- 재개 조건:
  - 사용자 매수 데이터 (`bought` 카운트) 측정 가능한 base 형성
  - 매수 → 손해 funnel 추적 필요성 명확해질 때

## Follow-up

- 운영자 검수 SOP 문서화 (5개 카테고리별)
- 카테고리 누적 sample → AI L2 input (`mvp_listing_ai_classifications`)
- inaccurate_report dismissed 시 토큰 회수 로직 (spam 차단)
- 사용자에게 검수 결과 push (운영자 응답 알림)

## Test

`npm run test:core`: 328/328 pass.

## Linked

- `2026-05-17-wave182-saved-money-counter-loss-report.md` (loss_report 박은 시작)
- `2026-05-17-wave182b-loss-report-button-move-to-modal.md` (카드 list → 모달 이동)
- `2026-05-17-wave182c-inaccurate-report-instead-of-loss-report.md` (← 이 문서)
