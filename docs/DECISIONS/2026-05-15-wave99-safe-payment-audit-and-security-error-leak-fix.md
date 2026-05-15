# Wave 99 — 안전결제 audit + 에러 메시지 보안 누출 fix

> Status: **applied (code).** owner 지적 2건 처리. (1) 번개장터 안전결제 수수료는 `SELLING_FEE_RATE = 0.035`로 이미 차감 중. (2) 사용자 facing API 7개에서 raw err.message 노출 → generic 메시지로 변경.

CLAUDE.md 6 필드 포맷.

## 0.1 안전결제 수수료 audit — 이미 적용됨 ✅

- 시간: 2026-05-15 13:00 KST
- 발견: owner 지적 — 번개장터 안전결제 의무화로 셀러가 3.5% 수수료 의무 부과. 미뇨이 수익 계산에 반영 필요.
- 변경: **변경 없음**. `src/lib/profit.ts` 검토 결과:
  ```ts
  export const SELLING_FEE_RATE = 0.035;  // 3.5% 안전결제 수수료
  export const RESELL_SHIPPING_FEE = 3500;
  export const SAFETY_BUFFER = 5000;

  function sellingFee(item) { return Math.round(item.skuMedian * SELLING_FEE_RATE); }

  function expectedProfitMin(item) {
    return Math.max(0,
      item.skuMedian
      - estimatedBuyCostGeneral(item)
      - sellingFee(item)         // ← 안전결제 수수료 차감 OK
      - RESELL_SHIPPING_FEE
      - SAFETY_BUFFER
    );
  }
  ```
  → expected_profit 계산에 이미 3.5% 차감 + 재판매배송비 + 안전마진 모두 차감 중. 사용자 표시 "예상 차익"은 이미 순익.
- 검증: profit.ts 코드 직접 확인.
- 위험: 없음.
- 다음: 안전결제 수수료율 변동 시 SELLING_FEE_RATE 상수 업데이트 필요 (현재 3.5% 정확).

## 0.2 사용자 facing API 7건 raw err.message 노출 fix

- 시간: 2026-05-15 13:15 KST
- 발견: owner 지적 — 에러 메시지에서 DB 내용/파일경로/사이트 구조 노출 가능성. grep 결과 사용자 facing API 7곳에서 raw `err.message`를 NextResponse로 반환 중:
  1. `/api/packs/preview-inventory:93` — `pool query failed: ${status}: ${body.slice(0, 200)}` **PostgREST/Supabase body 노출** 🚨
  2. `/api/packs/preview-inventory:152` — `error: err.message` (catch)
  3. `/api/packs/inventory:36` — `error: err.message`
  4. `/api/packs/open:128` — `message` (err.message 포함)
  5. `/api/packs/reveals/detail:39` — `error: err.message`
  6. `/api/packs/reveals/click:38` — `error: err.message`
  7. `/api/packs/reveals/feedback:52` — `error: err.message`
- 변경: 7개 모두 동일 패턴으로 patch:
  - **Before**: `return NextResponse.json({ error: message }, ...)` (raw err.message)
  - **After**:
    ```ts
    console.error("<context> failed", { err: message, ... });
    return NextResponse.json({ error: "<generic_code>" }, ...);
    ```
  - generic code 예: `pool_query_failed`, `inventory_load_failed`, `pack_open_failed`, `detail_load_failed`, `click_record_failed`, `feedback_record_failed`, `preview_inventory_failed`, `not_found`.
- 검증:
  - `npx tsc --noEmit` clean
  - `npm run test:core` 139/139 pass
- 위험: 매우 낮음.
  - 사용자 경험은 동일 (어차피 에러 시 generic 처리).
  - 서버 사이드 로그 (Vercel 로그)에는 raw 에러 그대로 — 디버깅에 영향 0.
  - DB schema / 테이블명 / 파일경로 / PostgREST 에러 메시지 leak 차단.
- 다음:
  - **Cron 라우트 12개** (`/api/cron/*`)도 raw err.message 노출 중. 단 외부 사용자 접근 X (CRON_SECRET 인증). 일단 보류 — 별도 wave에서 정리 가능 (best practice).
  - `/api/debug/reset-db` — production 가드 (`NODE_ENV=production && ALLOW_DEBUG_RESET!=1` → 403) 박혀 있음. 추가 fix 불필요.

## 1. 보안 audit 결과 요약

| 라우트 | 위험 | 처리 |
|---|---|---|
| `/api/packs/preview-inventory` | 🚨 PostgREST body leak | ✅ fix |
| `/api/packs/inventory` | 🚨 err.message leak | ✅ fix |
| `/api/packs/open` | 🚨 err.message leak | ✅ fix |
| `/api/packs/reveals/{detail,click,feedback}` | 🚨 err.message leak | ✅ fix (3건) |
| `/api/packs/me` | ✅ generic only | OK |
| `/api/cron/*` (12개) | 외부 노출 X (CRON_SECRET 가드) | 보류 (best practice 별도 wave) |
| `/api/debug/reset-db` | production 4중 가드 | OK |

## 2. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- 안전결제 수수료율 ≠ 3.5% 가정 — 현재 정확 (의무화 후 매도자 3.5%).
