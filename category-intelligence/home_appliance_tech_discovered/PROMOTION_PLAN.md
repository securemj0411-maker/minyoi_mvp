# home_appliance_tech_discovered — Promotion Plan (v3)

- generated_at: 2026-05-10T18:54:44.194Z
- 기본 원칙: 이 파일은 production 자동 반영이 아니라 promote-catalog.mjs 입력 전 검수용이다.

## 다음 명령

```bash
node scripts/promote-catalog.mjs --category=home_appliance_tech_discovered --dry-run
node scripts/promote-catalog.mjs --category=home_appliance_tech_discovered --apply
```

## 반영 후보 요약

- noise rules: 18개 (0개 고신뢰)
- sku candidates: 9개 (3개 promotion 후보, 6개 risk 차단)

## pipeline.ts 후보


## catalog.ts 후보

- 침구청소기: 침구청소기 / aliases=침구청소기, 본체, 필터, 먼지통, 화이트
- 쿠쿠-3구-하이브리드-인덕션-하이라이트-전기레인지-cihr-d304fb: 쿠쿠 3구 하이브리드 인덕션 하이라이트 전기레인지 CIHR-D304FB / aliases=쿠쿠 3구 하이브리드 인덕션 하이라이트 전기레인지 CIHR-D304FB, 인덕션, 전기레인지, 진공청소기, 새제품
- lg-코드제로-a9-무선청소기: LG 코드제로 A9 무선청소기 / aliases=LG 코드제로 A9 무선청소기, LG 코드제로 A9, 무선청소기, 스마트 인버터 모터, 스탠드

## 차단된 SKU 후보 (검수 필요)

- 다이슨-v7-v8-무선-청소기-lg-코드제로-무선-청소기: 다이슨 V7/V8 무선 청소기, LG 코드제로 무선 청소기 / risk=many_separators_in_sku_hint
- 레비오사두유제조기-파벡스에어프라이기-칼만-에어-플렉스-무선청소기-dk-4012-이녹스프랑-에어프라이기: 레비오사두유제조기, 파벡스에어프라이기, 칼만 에어 플렉스 무선청소기 DK-4012, 이녹스프랑 에어프라이기 / risk=many_separators_in_sku_hint
- 메디큐브-하이포커스샷-부스터젤-에이블미-페이스-갈바닉-마사지기-쿠쿠-6인용-ih압력밥솥: 메디큐브 하이포커스샷+부스터젤, 에이블미 페이스 갈바닉 마사지기, 쿠쿠 6인용 IH압력밥솥 / risk=many_separators_in_sku_hint
- 월홈-wpm-kd-310-돌체구스토-캡슐커피머신-네스프레소-픽시-보쉬-타시모-t20-씨메-시그니처-토탈-피오렌자또-: 월홈 WPM KD-310, 돌체구스토 캡슐커피머신, 네스프레소 픽시, 보쉬 타시모 T20, 씨메 시그니처 토탈 피오렌자또 f64e / risk=many_separators_in_sku_hint
- 클리벤-4in1-무선청소기-클리엔-r9-로봇청소기-다이슨-v10-카본파이버-무선청소기-샤오미-미지아-프로-물걸레-로: 클리벤 4in1 무선청소기, 클리엔 R9 로봇청소기, 다이슨 V10 카본파이버 무선청소기, 샤오미 미지아 프로 물걸레 로봇청소기, 한경희 건강식마스터 HFM-1000 / risk=many_separators_in_sku_hint
- ems-고주파-마사지기-및-바디관리기: EMS 고주파 마사지기 및 바디관리기 / risk=broad_bundle_or_usecase_sku_hint
