# 2026-05-21 Wave454 — Acne small lanes split

## 배경
- Acne broad 잔여에 폴로/럭비티, 모자, 블라우스, 롱슬리브가 섞여 있었다.
- 스카프는 의류 본품 비교군이 아니므로 clear 대상이었다.

## 결정
- `clothing-acne-polo` lane 을 추가하고 `acne_polo` 를 ready 로 등록했다.
- `clothing-acne-cap` lane 을 추가하고 `acne_cap` 을 ready 로 등록했다.
- 기존 `clothing-acne-shirt` 에 blouse token 을 포함했다.
- `clothing-acne-tee` 에 `롱 슬리브` token 을 보강했다.
- 스카프/머플러/목도리는 Acne apparel 이 아니라 accessory bait 로 unknown 격리한다.

## DB 적용
- active `clothing-acne-apparel` 17건 기준:
  - 스카프 1건 clear: `[os] 아크네스크튜디오 체크 스카프`.
  - 6건 이동:
    - 폴로/럭비티 2건 → `clothing-acne-polo`.
    - 모자 2건 → `clothing-acne-cap`.
    - 블라우스 1건 → `clothing-acne-shirt`.
    - 롱슬리브 1건 → `clothing-acne-tee`.

## 검증
- 적용 후 active `clothing-acne-apparel` 잔여는 10건, 추가 small-lane candidate 는 0건.
- 테스트:
  - `npx tsx --test tests/wave254-5-fashion-condition.test.ts tests/wave254-6-product-type-priority.test.ts`
  - 결과: 192 pass / 0 fail.

## 보류
- `크루넥 긴팔 티셔츠`, `반집업 긴팔` 은 제품군 해석이 애매해 다음 wave 에서 broad hold 정책으로 처리했다.
