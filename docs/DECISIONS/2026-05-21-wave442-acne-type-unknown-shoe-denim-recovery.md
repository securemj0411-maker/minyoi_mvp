# 2026-05-21 Wave442 — Acne type_unknown shoe/denim recovery

## 배경
- Wave441 이후 `clothing|acne_apparel|type_unknown` residue 가 남아 있었고, 그중 반복 샘플이 두 갈래로 보였다.
  - Acne Studios 맨하탄/락어웨이 신발이 broad apparel 비교군에 섞임.
  - Acne denim 모델명(`2021M`, `리버진`, `플레어진`, `블라콘스트 노스`, `맥스 로우`)이 broad/type_unknown 에 남음.
- 동시에 베이커백/마이크로백/라펠 핀/화장품/쪼리 같은 명시적 cross-category bait 가 일부 broad apparel 에 남아 있었다.

## 결정
- `shoe-acne-manhattan`, `shoe-acne-rockaway` narrow SKU 를 추가하고 `acne_manhattan`, `acne_rockaway` lane 을 ready 로 등록했다.
- 맨하탄+락어웨이 혼합 제목은 `Rockaway` 쪽에 `맨하탄/맨해튼/manhattan` must-not 을 넣어 `Manhattan` 으로만 수렴하게 했다.
- Acne denim rule 을 보강했다.
  - `2021M`, `1992M`, `플레어진`, `리버진`, `워싱진`, `그레이 진` 을 denim 신호로 추가.
  - `Max Low` 는 `로우/low` 포함 제목을 max denim 으로 받을 수 있게 했다.
  - `Bla Konst North` 는 `노스/north`, `30x32/32x32/스키니/피트` 신호를 허용했다.
- Acne broad apparel 은 명확한 narrow/타 카테고리 토큰을 더 차단했다.
  - 신발: 맨하탄/락어웨이/스테피/레이스업/플립플랍/쪼리 등.
  - 가방/액세서리/화장품: 베이커/카메로/멀티 포켓/마이크로백/라펠 핀/파우치/올리브영/기초/비비 등.
  - 티셔츠/롱슬리브도 broad catch-all 에서 제외했다. 단, DB 대량 tee 이동은 이번 wave 에 적용하지 않았다.
- `블러링` 단독 토큰은 화장품 bait 로 쓰지 않기로 했다.
  - `폰즈 파우더 비비 블러링...` 은 `폰즈/비비` 로 차단.
  - `아크네 스튜디오 블러링 로고 티셔츠` 는 apparel 로 살릴 수 있게 유지.
- Denim lane 은 `기프트/패키지/쇼핑백/스카프/머플러/목도리` 를 must-not 처리했다.
  - `정품 아크네 스튜디오 기프트 박스 패키지 스카프 머플러 니트 데님 쇼핑백` 같은 구성품/액세서리 묶음이 `데님` 단어 하나로 들어오는 문제 차단.

## DB 적용
- Acne 이름/기존 Acne SKU scope 904개를 dry-run 후 적용했다.
- 실제 raw SKU 이동은 Wave442 target recovery SKU 로만 제한했다.
  - `shoe-acne-manhattan`: 6건
  - `shoe-acne-rockaway`: 7건
  - `clothing-acne-denim`: 7건
  - `clothing-acne-bla-konst-denim`: 2건
  - `clothing-acne-max-denim`: 1건
- 명시 오염 11건은 raw `sku_id=null`, `listing_type=unknown` 으로 내리고 stale parsed/pool row 를 제거했다.
  - 예: 스테피 레이스업, 플립플랍/쪼리, 라펠 핀, 폰즈/비욘드 화장품, 베이커백, 멀티 포켓 마이크로백, 카메로백, 고라파덕 파우치.
- 같은 Acne SKU 유지 row 429건은 최신 parser 로 reparse 했다.

## 검증
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail
- DB 후검증:
  - Acne SKU 내 `멀티 포켓`, `마이크로백`, `라펠`, `파우치`, `폰즈`, `비욘드`, `플립플랍`, `쪼리`, `스테피`, `기프트`, `쇼핑백` sample count 0.
  - `베이커`는 `bag-acne-pvc-tote` 실제 가방 row 만 남음.
  - 맨하탄/락어웨이 target row 는 `shoe-acne-manhattan` / `shoe-acne-rockaway` 로 이동.
  - `2021M`, `리버진`, `플레어진`, `블라콘스트 노스`, `맥스 로우` target row 는 denim narrow 로 이동.
  - `clothing|acne_apparel|type_unknown*` residue sample 은 8건까지 축소.

## 보류
- Acne tee 대량 이동은 별도 wave 로 보류.
  - 이번 catalog 에서는 broad catch-all 보다 tee lane 이 우선되도록 고쳤지만, DB write 는 맨하탄/락어웨이/데님 recovery SKU 로만 제한했다.
  - 이유: `모스키노 아크네...티셔츠`, `시스템 티셔츠 ... 아크네...` 같은 브랜드 나열형 오염 가능성이 있어 샘플 검수 후 적용 필요.
- `찰스`, `T52`, `셋업`, `핀트페이스`, `페이스 야상` type_unknown residue 는 별도 샘플링 후 product type/SKU 를 판단한다.
- `2021M 트라팔가`는 현재 global designer/collab noise 에 의해 null 로 남았다. Trafalgar 를 Acne denim model 로 복구할지는 별도 검수한다.
- 사이즈별 회전률/평균 사이즈 외 size bucket 보정은 별도 wave 로 진행한다.
