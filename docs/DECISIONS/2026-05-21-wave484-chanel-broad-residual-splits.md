# 2026-05-21 Wave 484 — Chanel broad residual splits

## Context
- 첫 5000개 fashion audit에서 `bag-chanel-broad`가 상위 currentDiff 6건으로 남았다.
- 확인 결과 단순 종이 쇼핑백이 아니라 실제 고가 샤넬 가방이었다.
  - 코스메틱 박스/체인백
  - WOC/참월렛/체인월렛
  - 쇼퍼백/뉴서프

## Decisions
- `bag-chanel-broad`에 계속 섞지 않고 반복되는 세부 family로 분리했다.
- 새 narrow SKU:
  - `bag-chanel-cosmetic-box` / `chanel_cosmetic_box`
  - `bag-chanel-woc-charm-wallet` / `chanel_woc_charm_wallet`
  - `bag-chanel-shopper-new-surf` / `chanel_shopper_new_surf`
- 종이 쇼핑백 단품은 계속 null 유지한다.

## Applied DB Patch
- Moved to `bag-chanel-cosmetic-box`, `score_dirty=true`:
  - `254905137`, `314694092`, `374979948`
- Moved to `bag-chanel-woc-charm-wallet`, `score_dirty=true`:
  - `305561784`
  - 추가 sweep 발견 WOC broad 잔여: `346436312`, `377711568`, `404727890`, `408791065`, `409150138`, `409150140`
- Moved to `bag-chanel-shopper-new-surf`, `score_dirty=true`:
  - `399863448`, `407746837`

## Verification
- `npx tsx --test tests/wave254-6-product-type-priority.test.ts` passed.
- `npx tsx --test tests/core-rules.test.ts` passed.
- Targeted currentDiff check for `bag-chanel-broad`, `bag-chanel-cosmetic-box`, `bag-chanel-woc-charm-wallet`, `bag-chanel-shopper-new-surf` returned 0 rows.

## Deferred
- Chanel Classic Flap/Boy/19/Gabrielle style sublanes remain deferred. This wave only separated repeated residuals that were already causing broad-currentDiff.
- Public readiness quality should still rely on existing bag risk gates and counterfeit floor; Chanel is high-value/high-risk.
