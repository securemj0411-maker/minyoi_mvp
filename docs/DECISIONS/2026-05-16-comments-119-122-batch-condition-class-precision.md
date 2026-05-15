# 2026-05-16 코멘트 #119~#122 batch — condition_class 정확도 강화

## #119 — lifecycle 병목 (다른 세션 처리)

- pid 407402894: SELLING active **last_seen 497분 전 (8시간!)** = lifecycle worker backlog 15k stale.
- 다른 세션 진행 중 (commit `be998ca` lifecycle throughput 5x 박혔어도 backlog 큼).
- 이번 turn 처리 X.

## #120 — 운영자풀 시세 출처 표시

- pid 408304384, 사용자: "운영자페이지에서 시세 다나와 새상품 시세라고 안 바뀌는데 뭐함?? 자꾸 /me 운영자 풀 여기는 관리 안 함??"
- 진단:
  - `pack-reveal-modal.tsx:261-275` 시세 출처 표시 박힘 ("📍 다나와 새 가격 기준 (이 매물 미개봉)" / "📍 번개 S급 매물 N건 median" / "📍 번개 중고 매물 N건 median")
  - `admin-pool-browser.tsx` 안 박힘
- 변경:
  - `src/app/api/admin/pool-listings/route.ts:123/162` — parsed select 에 `condition_class` 추가, items.map 에 `conditionClass` 박음
  - `src/components/admin-pool-browser.tsx:23` — PoolItem type 에 `conditionClass: string | null` 추가
  - `src/components/admin-pool-browser.tsx:295` — 시세 출처 표시 (pack-reveal-modal 동일 패턴)

## #121 — "스트랩(새거)" false positive 차단

- pid 350167397 (애플워치9), 사용자: "비교매물 없이 시세 있는 거 보니까 또 mint랑 unopened reparsing 되기 전인가?"
- 진단:
  - 매물 description: "왔던 그대로 드려요: 박스+애플 정품 충전기+애플 정품 파란색 스트랩**(새거)**"
  - parser regex `/.../새거|새것/` 단독 매칭 → `new_or_open_box` false positive → condition_class = unopened (잘못)
  - 사용자 의도 = mint (배터리 94%, 사용감 있음, 박스 함). 본체 unopened 아님.
- 변경:
  - `src/lib/option-parser.ts:1013` `explicitNewSignal` regex 에서 "새것/새거/새 것/새 거" 단독 매칭 제거
  - 명확한 키워드만 유지 (미개봉/새상품/박스 미개봉/포장 안 뜯음/brand new/뜯지 않은 등)
- 검증:
  - pid 350167397 condition_class = unopened → **worn** ✅
  - 전체 unopened 3,705 → **3,480** (-225)

## #122 — bunjang detail product.condition (셀러 metadata) 활용

- pid 399177378 (에어팟 4세대 노캔), 사용자: "왜 다른거랑 같이 비교?? 사람이 일반적으로 하자나 이런거 명시 안했으면 false positive 분류? 옵션에 사용감 많음이라고 적혀있는데"
- 본 매물: "본체 안 닫히고 떨어트림 많음" + 옵션 "사용감 많음"
- 비교군: "사용감 없음" 매물
- 진단:
  - bunjang detail API 가 product.condition (셀러 직접 선택, "사용감 많음/적음/없음" 등) metadata 보냄
  - `src/lib/bunjang.ts:217` `conditionLabel` 로 fetch ✅
  - **but mvp_raw_listings / mvp_listing_parsed 에 저장 안 됨** ❌
  - parser 가 description 자연어만 보고 condition_class 결정 → 셀러 metadata 무시 → false positive
- 변경:
  - **DDL migration**: `mvp_raw_listings` 에 `bunjang_condition_label TEXT` 컬럼 추가 (NULL default, 비파괴)
  - `src/lib/tick-pipeline.ts:1639` (normal path) + `:1567` (sold-out path) — `detail.conditionLabel` 저장
  - `src/lib/option-parser.ts:102~117` — `ParseInput.bunjangConditionLabel` 추가
  - `src/lib/option-parser.ts:115~127` — `bunjangLabelToConditionClass()` 함수 신설:
    | bunjang label | condition_class |
    |---|---|
    | "사용감 많음" / "많이 사용" | worn |
    | "사용감 없음" / "거의 새것" / "새상품급" | clean |
    | "사용감 적음" / "상태 좋음" | normal |
    | "새상품" / "미개봉" | unopened |
  - `src/lib/option-parser.ts:1495+` — `bunjangOverride ?? extractConditionClass(notes)` strong override
  - `src/lib/tick-pipeline.ts:1610` — parseListingOptions 에 `bunjangConditionLabel: detail.conditionLabel` 전달
  - `src/app/api/debug/reparse-listings/route.ts` — RawRow 에 `bunjang_condition_label` 추가, 호출 시 전달
  - **PARSER_VERSION v43 → v44** bump
- 검증:
  - mass reparse v43 → v44 (20,938 매물)
  - 옛 매물의 `bunjang_condition_label` = NULL → override 효과 X (extractConditionClass fallback)
  - 새 매물 (다음 detail-worker fetch 부터) 자연 누적 → bunjang label override 작동
- 위험:
  - 옛 매물 (detail 옛이 fetch 됨) 은 bunjang label = NULL 이라 효과 X. 새 매물부터.
  - bunjang label string 정확한 종류 (미개봉/새상품 외) 확인 필요. 새 매물 누적 후 분포 측정.
- 다음:
  - 새 매물 누적 후 bunjang_condition_label 분포 측정 (string 종류 + 분류 정확도)
  - 옛 매물 detail re-fetch 옵션 (lifecycle worker 또는 별 batch — 큰 외부 API 호출, 보류)

## 운영 원칙 강조

- **destructive 작업 사전 영향 명시**: DDL ALTER TABLE = NULL default 비파괴. 단 PARSER_VERSION bump = 옛 매물 reparse trigger. 사용자에게 영향 명시 했음.
- **운영자풀 = 사용자 화면과 같이 작업** (memory 박힘): #120 fix 정확히 이 원칙 적용. 항상 admin-pool-browser + pack-reveal-modal + user-reveal-dashboard 다 같이 검토.
