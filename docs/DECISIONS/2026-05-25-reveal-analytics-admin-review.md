# 2026-05-25 Reveal Analytics Admin Review

## Context

운영자가 회원별로 어떤 카드를 reveal 했는지 보고, 별도 운영자 화면에서 가격대/카테고리/제품별 reveal 통계를 보고 싶다는 요청.

## Findings

- `mvp_pack_reveals`가 이미 사용자별 reveal 원장 역할을 한다.
  - `user_ref`, `pid`, `pack_open_id`, `expected_profit_min/max`, `current_profit_min/max`, `confidence`, `link_clicked_at`, `revealed_at`, `hidden_at` 기반으로 “누가 어떤 상품을 열었는지” 추적 가능.
- `mvp_pack_opens`는 reveal 묶음/차감 단위다.
  - `tokens_spent`, `revealed_pids`, `opened_at`으로 reveal 묶음/차감 단위 분석 가능.
  - `band_requested`는 구 pack 모델 잔재이므로 신규 운영자 통계의 주요 축으로 쓰지 않는다.
- `mvp_detail_events`는 reveal 이후 행동 로그다.
  - 상세 열람, 쉬운모드, 숫자 리포트, 원본 클릭, 관련 매물 클릭, 스크랩 저장/해제 등 funnel 분석 가능.
- `/api/packs/me`는 이미 reveal row를 listing/raw/parsed/feedback/pack_open과 join하는 패턴을 가지고 있어 admin reveal view 구현에 재사용 가능하다.
- 기존 운영자 화면에는 `detail-events` 페이지가 이미 있지만, 이것은 이벤트 로그 중심이고 “reveal 원장 + 상품/회원/통계” 화면은 아직 없다.

## Decision

가능하다. 구현 시 `mvp_pack_reveals`를 source of truth로 두고, 통계/운영자 UX에서는 아래 데이터를 join한다.

- 상품: `mvp_raw_listings`, `mvp_listings`, `mvp_listing_parsed`
- 사용자: `auth.users`, `mvp_user_credits`, `mvp_user_plans`
- 행동: `mvp_detail_events`, `mvp_reveal_feedback`
- pack: `mvp_pack_opens`

## Recommended Scope

1. 회원 테이블 drawer 또는 row action에 “Reveal 내역” 진입점 추가.
2. 운영자 하위 React 페이지 추가: reveal analytics.
3. API 추가:
   - 회원별 reveal list
   - 전체 reveal aggregate
   - product/category/price/source/time/funnel breakdown
   - `band` 축은 제외하고 현재 모델에 맞는 가격대/카테고리/SKU/source/수익구간 중심으로 본다.
4. 장기 안정성을 위해 reveal 시점 스냅샷 컬럼 또는 집계 테이블 검토.

## Implemented

- 운영자 상단 nav에 `REVEALS` 탭을 추가했다.
- 회원 drawer에 해당 회원의 reveal 내역으로 바로 들어가는 링크를 추가했다.
- `/api/admin/reveal-analytics`를 추가해 `mvp_pack_reveals` 기반으로 가격대/수익구간/category/SKU/source/user/funnel 집계를 반환한다.
- 운영자 하위 React 페이지 `/caule.../reveal-analytics`를 추가했다.
- detail event는 reveal row의 `user_ref + pid` 기준으로 묶어 다른 사용자의 동일 상품 이벤트가 섞이지 않게 했다.

## Hold

- feed impression 대비 reveal 전환율은 현재 원장만으로는 정확하지 않다. 필요하면 `feed_impression`, `feed_card_clicked`, `paywall_seen` 계열 이벤트를 추가해야 한다.
- historical category/title/source를 완전 고정하려면 reveal 시점 snapshot 저장이 필요하다. 현재는 join 기반이라 원본 row 변화의 영향을 받을 수 있다.
