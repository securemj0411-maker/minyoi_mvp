# monitor_discovered — Parser/Gate Design Draft

- 작성일: 2026-05-11 KST
- 상태: internal design only
- 공개/승격: 금지

## 왜 지금 모니터인가

- `category-expansion-latest` 기준 normal 비율이 78.8%로, 게임콘솔 28.1%보다 본품 신호가 훨씬 높다.
- pending SKU가 7개 있어 모델/옵션 파서 설계를 시작할 표본이 있다.
- 단, runtime category는 internal_only parser skeleton까지만 열었고 catalog promotion은 blocked 상태로 유지한다.

## 핵심 비교 기준

모니터는 제품명만으로 가격차가 크게 갈리므로 아래 옵션을 comparable key에 넣어야 한다.

1. `brand`
   - LG, Samsung, BenQ, MSI, ASUS/ROG, Gigabyte, Dell/Alienware, ViewSonic, 한성, 주연테크, 래안텍 등.
2. `model_code`
   - 예: `27GL650F`, `XL2540K`, `275QF`, `PG27AQDP`, `AW2525HM`.
   - 모델 코드가 있으면 brand/model_code를 최우선 key로 사용한다.
3. `size_inch`
   - 24, 25, 27, 32, 34, 49 등.
   - 크기가 섞인 SKU 후보는 broad로 보류한다.
4. `resolution`
   - FHD, QHD, WQHD, UHD/4K, 2.1K 등.
5. `refresh_rate`
   - 60, 75, 100, 120, 144, 165, 180, 200, 240, 360, 540Hz 등.
   - 주사율은 가격 영향이 커서 가능한 한 key에 포함한다.
6. `panel_type`
   - IPS, VA, TN, OLED.
   - 누락 시 unknown으로 두되 high-confidence 비교에서는 제외한다.
7. `shape`
   - flat/curved/ultrawide.
   - 커브드/울트라와이드는 같은 인치라도 가격군이 다르다.

## comparable key 초안

모델 코드가 있을 때:

```text
monitor|{brand}|{model_code}|{size_inch}in|{resolution}|{refresh_rate}hz|{panel_type}|{shape}
```

모델 코드가 없을 때:

```text
monitor|generic|{size_inch}in|{resolution}|{refresh_rate}hz|{panel_type}|{shape}
```

단, generic key는 `needs_review=true` 또는 internal market learning에만 쓴다.

## gate 후보

아래는 normal 본품 풀에서 제외한다.

- 액세서리 단독:
  - 모니터암, 스탠드 단독, 거치대, 어댑터/아답터, 케이블, 전원선, 받침대.
- 부품/손상:
  - 액정파손, 패널파손, 줄감, 멍, 번인, 불량화소, 화면 안나옴, 백라이트, 보드, 부품용.
- 다중/풀세트:
  - 본체+모니터, PC 풀세트, 키보드/마우스 포함 세트, 사무용 견적, 원컴방송 세트.
- 업자성/대량:
  - 대량, 재고, 도매, 카드/세금계산서, 매장 운영, 전국배송/설치.
  - 단, 업자성이라도 단일 모델 본품 매물은 internal price sample로만 보류한다.

## promotion risk 후보

- `monitor_size_mixed`: 한 SKU 후보에 여러 인치가 섞임.
- `monitor_model_mixed`: 한 SKU 후보에 모델 코드가 2개 이상 섞임.
- `monitor_resolution_mixed`: FHD/QHD/UHD가 한 후보에 섞임.
- `monitor_refresh_rate_mixed`: 144/180/240Hz 등 서로 다른 주사율이 한 후보에 섞임.
- `monitor_bundle_or_pc_set`: 본체/키보드/마우스/풀세트/견적 문맥이 SKU alias에 섞임.
- `monitor_accessory_or_part`: 모니터암/스탠드/어댑터/케이블/패널/액정파손 문맥.

## 초기 테스트 케이스

정상:

- `LG 울트라기어 27GL650F 144Hz 게이밍 모니터`
- `벤큐 XL2540K 240Hz`
- `AW2525HM`
- `MSI 275QF QHD 200HZ 게이밍모니터`

제외:

- `삼성 모니터 스탠드 판매`
- `lg 4k 모니터 아답타 어뎁터`
- `게임용 본체 / 게이밍 모니터 / 컴퓨터 풀세트`
- `액정 파손 모니터`

## 보류

- `Sku["category"]`의 `monitor`는 internal_only parser skeleton 범위로만 사용한다.
- DB parsed category/readiness와 pool policy가 공개 monitor를 알기 전까지 공개 후보팩에 넣지 않는다.
- 모델 코드 없는 generic monitor key는 public candidate pack에 쓰지 않는다.

## 다음 구현 순서

1. `src/lib/catalog.ts`의 category type 확장 여부를 별도 브랜치성 작업으로 검토한다.
2. `option-parser`에 monitor parser를 추가하되 unknown 옵션은 `critical_unknown`으로 보낸다. (v1.33 skeleton 완료)
3. `pool-policy`에서 monitor는 high-confidence + model_code key만 통과시킨다.
4. core tests에 정상/제외 케이스를 먼저 추가한다.
