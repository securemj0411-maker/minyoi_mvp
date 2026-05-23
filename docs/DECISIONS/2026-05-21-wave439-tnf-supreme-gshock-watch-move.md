# 2026-05-21 Wave439 — Supreme x TNF x G-Shock watch 카테고리 이동

## 배경

- Wave438 후속 검토에서 `clothing-tnf-supreme-gshock`가 명확한 시계 매물인데 clothing 카테고리에 남아 있었다.
- 같은 Supreme x TNF scope에서 non-jacket 의류를 확인했지만, 쇼츠/셔츠는 표본이 1~2건 수준이라 즉시 ready SKU로 늘리기엔 과적합 위험이 컸다.
- G-Shock은 11건이 동일한 한정 콜라보 라인으로 확인되어 카테고리 정정 효과가 명확했다.

## 결정

- 기존 `clothing-tnf-supreme-gshock`를 `watch-tnf-supreme-gshock-dw6900`로 이동했다.
- category를 `watch`로 바꾸고, laneKey는 기존 readiness를 유지하기 위해 `tnf_supreme_gshock`를 유지했다.
- must-contain에 `노스페이스/north face/tnf`를 추가해 일반 Supreme G-Shock 또는 일반 Casio DW-6900이 이 콜라보 SKU로 들어오지 않게 했다.
- `option-parser`에 `watch-tnf-supreme-gshock-dw6900` 모델 매핑을 추가하고 watch family에서 `gshock` 포함 모델을 Casio family로 묶었다.
- category readiness note는 watch 이동 사실을 반영했다.

## DB sync 결과

- `clothing-tnf-supreme-gshock -> watch-tnf-supreme-gshock-dw6900`: 11건
- parsed comparable key:
  - `casio|tnf_supreme_gshock_dw6900`

## 검증

- old raw SKU 잔존: 0
- new raw SKU: 11
- parsed category/family/comparable mismatch: 0
- regression:
  - `슈프림X노스페이스X카시오 지샥 DW-6900 블랙` → `watch-tnf-supreme-gshock-dw6900`
  - `슈프림 카시오 지샥 DW-6900 블랙` → null

## 보류

- `하이 파일 플리스 쇼츠`, `트레킹 패커블 벨트 쇼츠`, `트레킹 숏슬리브 셔츠`는 현재 표본이 부족해 별도 ready SKU로 만들지 않았다.
- 특히 `삽니다`/구매 문구가 섞인 row는 buy-request 차단을 유지한다.
