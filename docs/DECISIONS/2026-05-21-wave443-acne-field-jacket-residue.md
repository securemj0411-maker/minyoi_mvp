# 2026-05-21 Wave443 — Acne field-jacket residue cleanup

## 배경
- Wave442 적용 후 `clothing|acne_apparel|type_unknown*` residue 는 8건까지 줄었다.
- 남은 샘플 중 2건은 SKU/model 은 broad apparel 유지가 맞지만 product type 이 명확했다.
  - `실사이즈 77~88 명품 대장급 끝판왕 아크네 웰론 안감 탈론 지퍼 야상`
  - `아크네 스튜디오의 페이스 야상 점퍼`

## 결정
- clothing parser 를 `wave216-clothing-v16` 으로 올리고, jacket regex 에 `야상`, `점퍼`, `필드 점퍼` 를 추가했다.
- Acne broad SKU 를 새 narrow SKU 로 억지 승격하지는 않았다.
  - 이 2건은 `clothing-acne-apparel` 유지 + `jacket` product type 으로 comparable key 만 안정화.

## DB 적용
- 기존 Acne `type_unknown` residue 8건을 최신 parser 로 reparse 했다.
- 이 중 2건이 `clothing|acne_apparel|jacket|...` 으로 이동했다.
- 최종 `clothing|acne_apparel|type_unknown*` residue 는 6건이다.

## 검증
- 테스트:
  - `npx tsx --test tests/wave254-6-product-type-priority.test.ts tests/wave254-5-fashion-condition.test.ts`
  - 결과: 192 pass / 0 fail
- DB residue 6건:
  - `아크네스튜디오/ 찰스 올리브그린/ 48`
  - `아크네스튜디오 A00309863`
  - `아크네 셋업`
  - `아크네 핀트페이스 화이트 m사이즈 묻지마 판매( 옷사이즈 줄음 )`
  - `아크네스튜디오`
  - `아크네스튜디오 T52`

## 보류
- 찰스/T52/A00309863 은 모델명 또는 product code 검수가 필요하다.
- 셋업은 상하의 세트/수트 계열 분리 기준이 필요하다.
- 핀트페이스는 face-logo 계열일 가능성이 있지만 `옷사이즈 줄음` alter signal 이 있어 시세군 투입 전 별도 판단한다.
