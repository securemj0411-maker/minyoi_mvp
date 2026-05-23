# 2026-05-21 Wave 482 — CDG PVC / 교환 후처리 오인 / 타깃 stale cleanup

## Context
- Wave 481 이후 남은 fashion/bag 타깃 currentDiff를 계속 줄였다.
- `bag-cdg-pvc`는 좁은 SKU가 있음에도 `pvc가방`, `pvc백`처럼 붙어 쓰인 제목에서 `bag-cdg-broad`로 먼저 잡히는 케이스가 있었다.
- `description_preview`를 200자까지만 사용하는 과정에서 정상 판매 후처리 문구가 `교환 `에서 잘리면 실제 교환글로 오인되는 문제가 있었다.

## Decisions
- CDG + PVC가 함께 명시된 경우, Gucci 100주년/Nike/신발 등 명확한 차단 토큰이 없으면 `bag-cdg-pvc`로 직접 매칭하도록 했다.
- `교환` 단독 토큰만으로는 교환글 차단을 하지 않도록 완화했다.
  - `[교환]`, `교환합니다`, `교환해요`, `교환하고 싶`, `교환 구함`, 추가금/화살표 교환은 계속 차단한다.
  - `교환/환불 불가`, `반품 교환 환불 불가`, `교환 / 환불은 안됩니다`, `환불 교환 취소 어렵습니다`, `교환 ❌ 환불 ❌` 같은 정상 판매 후처리 문구는 보존한다.
- DB stale cleanup:
  - BaoBao Lucent에 섞인 Issey Miyake/Camper/Asics 신발 3건 clear.
  - MCM Visetos medium backpack에 섞인 지갑/크로스바디/일반 MCM 가방 3건 clear.
  - Acne sweat에 섞인 후디/점퍼 2건 clear.
  - BAPE tee 중 실제 사이즈 교환 가능 글 2건 clear.
  - Acne knit 1건은 `clothing-acne-knit`로 이동.

## Applied DB Patch
- Cleared `sku_id/sku_name`, `score_dirty=true`:
  - `320836392`, `407309071`, `408255855`
  - `183206698`, `329251699`, `401197414`
  - `157751538`, `392331619`
  - `390864000`, `407176984`
- Moved:
  - `403873088` → `clothing-acne-knit` / `Acne Studios Knit / Cardigan`, `score_dirty=true`

## Verification
- `npx tsx --test tests/core-rules.test.ts` passed.
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed.
- Targeted currentDiff check for the Wave 482 target SKUs returned 0 rows after patch.

## Deferred
- BaoBao `Ring Bag` vs `Lucent` family split is not implemented in this wave. Current catalog treats BaoBao bag family broadly under the Lucent SKU; split only after enough repeated Ring/Prism/Carton-style samples are confirmed.
- MCM detailed backpack size/model split is still conservative: rows without medium/backpack confidence were cleared rather than forced into a new lane.
