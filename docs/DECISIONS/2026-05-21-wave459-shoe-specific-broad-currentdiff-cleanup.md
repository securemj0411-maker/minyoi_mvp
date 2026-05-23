# 2026-05-21 Wave 459 — shoe specific/broad collision + currentDiff cleanup

## 배경

Wave 458에서 shoe broad는 clean 상태가 되었지만, shoe 전체 active SKU를 현재 `ruleMatch` 기준으로 재감사하니 예전 룰로 박힌 narrow/currentDiff rows가 남아 있었다.

## 결정

- `specific lane + broad sibling`이 동시에 잡히는 경우, fashion 카테고리에서는 broad sibling만 같이 잡힌 상황이면 specific lane을 우선한다.
  - 적용 예: Nike Cortez, NB 2002R, Yeezy 350, Salomon ACS Pro.
  - true multi-lane 충돌은 계속 null 처리한다.
- intended collab SKU의 짧은 한글 brand token도 designer bait 차단에서 skip한다.
  - 예: `꼼데` mustContain을 가진 Nike × CDG SKU는 `꼼데가르송` 문구 때문에 차단하지 않는다.
- Wales Bonner Samba는 붙임 표기(`웨일즈보너`, `웨일스보너`)를 broad collab lane에서 허용한다.
- Nike Dunk Low Seoul은 설명의 직거래 지역명 `서울`만으로 승격하지 않는다. 제목에 `서울/Seoul/South Korea`가 있을 때만 Seoul lane으로 간다.

## DB 적용

- stale / variant pollution 55건을 `sku_id = null`, `sku_name = null`, `listing_type = unknown`, `pool_eligible = false`, `score_dirty = true`로 정리했다.
  - Nike Dunk Low black-white lane에 있던 Kasina/Syracuse/By You/Denim 변형
  - Nike Blazer Low에 있던 Off-White Blazer Low
  - Adidas Samba OG black에 있던 Rose/white/scarlet/oat/green variants
  - Adidas Spezial에 있던 Sporty & Rich / Italia denim variants
  - Nike AF1 black에 있던 Stussy/Tiffany/Louis Vuitton collab variants
- 잘못 박힌 15건은 현재 룰의 target SKU로 이동했다.
  - `shoe-adidas-samba-wales-bonner-black-green` → `shoe-adidas-samba-wales-bonner`: 13건
  - `shoe-nike-dunk-low-seoul` → `shoe-nike-dunk-low-black-white`: 2건
- 변경 rows의 `mvp_listing_parsed`, `mvp_candidate_pool` artifacts는 삭제했다.

## 검증

- `npx tsx --test tests/wave254-6-product-type-priority.test.ts`
  - 163 pass / 0 fail
- `npx tsx scripts/wave459-shoe-all-currentdiff-audit.ts`
  - Wave459 처리 대상은 제거됨.
  - 남은 상위 currentDiff는 자동 삭제하지 않고 다음 wave 대상으로 보류.

## 보류

- 다음 wave 후보:
  - `shoe-adidas-football`: 실제 축구화/의류/가젤 혼입이 같이 있어 분리 검토 필요.
  - `shoe-supreme-nike-sb-collab`: Supreme SB Dunk가 현 룰에서 null 처리되는 이유 검토 필요.
  - `shoe-ugg-classic-mini`: 정상 Classic Mini II/미국어그 row가 섞여 있어 룰 보정 가능성 있음.
  - `shoe-asics-cecilie-bahnsen-collab`: intended collab인데 designer noise로 막히는지 확인 필요.
  - `shoe-adidas-balenciaga-collab`: Offwhite color명과 Off-White brand bait를 구분해야 해서 자동 clear 보류.
