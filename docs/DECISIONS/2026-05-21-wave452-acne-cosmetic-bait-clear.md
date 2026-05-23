# 2026-05-21 Wave452 — Acne cosmetic bait clear

## 배경
- Acne broad 잔여 샘플에서 `센카 시나모롤 에디션 퍼펙트휩 아크네케어` 가 `clothing-acne-apparel` 로 들어온 것이 확인됐다.
- 여기서 `아크네` 는 Acne Studios 가 아니라 여드름/아크네 케어 화장품 문맥이다.

## 결정
- Senka/퍼펙트휩/아크네케어 계열은 Acne Studios 카탈로그에 들어오면 안 된다.
- cosmetic bait 는 SKU 보정이 아니라 unknown 으로 격리한다.

## DB 적용
- `pid=406693033` 을 `listing_type=unknown`, `sku_id=null`, `sku_name=null`, `score_dirty=true` 로 변경했다.
- 해당 pid 의 `mvp_listing_parsed`, `mvp_candidate_pool` row 삭제를 시도했다.

## 검증
- product-type priority test 에 Senka acne-care false positive 케이스를 추가했다.

## 보류
- 다른 화장품 브랜드의 `아크네` 일반명 오염은 신규 샘플 발견 시 같은 방식으로 차단한다.
