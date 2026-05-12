# speaker_audio_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T18:41:29.284Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=speaker_audio_discovered --dry-run
node scripts/promote-catalog.mjs --category=speaker_audio_discovered --apply
```

## 반영 후보 요약

- noise rules: 0개 (0개 고신뢰)
- sku candidates: 12개 (5개 promotion 후보, 7개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- 무니-무선-블루투스-스피커-minieye-01-b: 무니 무선 블루투스 스피커 MINIEYE_01_B / aliases=무니 무선 블루투스 스피커 MINIEYE_01_B, 블루투스 스피커, 무선, 스피커 본체, 모델명
- 브리츠-bz-jb9600: 브리츠 BZ-JB9600 / aliases=브리츠 BZ-JB9600, 블루투스 스피커, TWS, IPX4 방수, 배터리 사용시간
- 블루투스-스피커-단품: 블루투스 스피커 단품 / aliases=블루투스 스피커 단품, 블루투스 스피커, 본체, 풀박스, 신동품급
- 블루투스-스피커-앰프-본체-단품: 블루투스 스피커/앰프 본체 단품 / aliases=블루투스 스피커/앰프 본체 단품, 블루투스 스피커, 앰프, 본체, 가성비
- 에릭-파티박스-bp-810: 에릭 파티박스 BP-810 / aliases=에릭 파티박스 BP-810, 블루투스 스피커, 노래방 스피커, 휴대용 스피커, 마이크 세트

## 차단된 SKU 후보 (검수 필요)

- 브리츠-ba-c1-브리츠-ba-rbt1-아이리버-iab40-플레오맥스-pbs-m5-에릭-bp-610: 브리츠 BA-C1, 브리츠 BA-RBT1, 아이리버 IAB40, 플레오맥스 PBS-M5, 에릭 BP-610 / risk=many_separators_in_sku_hint
- 브리츠-br-st202-sharp-cp-200a-브리츠-br-1100-v2-yfczpeak-블루투스-스피커: 브리츠 BR-ST202, Sharp CP-200a, 브리츠 br-1100(v2), YFCZPEAK 블루투스 스피커 / risk=many_separators_in_sku_hint
- 오디오테크니카-at-sp105-퀄리티캐스트-coco-5i-microlab-fc-10-krk-rokit5-g3-오디오: 오디오테크니카 AT-SP105, 퀄리티캐스트 COCO 5i, Microlab FC-10, krk rokit5 g3, 오디오엔진 HD3 / risk=many_separators_in_sku_hint
- jbl-go3-jbl-go4-jbl-tune-520bt-jbl-tune-510: JBL GO3 / JBL GO4 / JBL TUNE 520BT / JBL TUNE 510 / risk=many_separators_in_sku_hint
- lg-블루투스-스피커-pk5-pk7w-홈보이-스테이션-nd070a: LG 블루투스 스피커 PK5 / PK7W / 홈보이 스테이션 ND070A / risk=many_separators_in_sku_hint
- marantz-sr-7000g-marantz-2385-mackie-showbox-레이니-cub-super-10-야마: MARANTZ SR-7000G, MARANTZ 2385, MACKIE ShowBox, 레이니 CUB SUPER 10, 야마하 HS4 / risk=many_separators_in_sku_hint
- marshall-stanmore-3-acton-3-woburn-3-bluetooth-speaker: Marshall Stanmore 3 / Acton 3 / Woburn 3 Bluetooth Speaker / risk=many_separators_in_sku_hint, generic_alias_heavy
