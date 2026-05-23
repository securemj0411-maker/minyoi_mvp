# 2026-05-21 Wave438 — Supreme x TNF 의류 세부 모델 split 및 오탐 복구

## 배경

- `clothing-tnf-supreme-collab` broad lane에 히말라야, 아크로고, 테이프심, 트레킹 컨버터블, 스팁테크, 스플릿 쉘, 반다나, 레더 마운틴 등 가격대가 다른 반복 모델이 섞여 있었다.
- `슈프림 노스페이스 카고 자켓`이 bare `카고` 토큰 때문에 pants로 파싱되는 문제가 있었다.
- 1차 DB sync 후 더 구체적인 모델과 기존 `mountain jacket/parka/denali` 룰이 동시에 맞아 null 처리되는 충돌이 발견되었다.
- `구매희망시 내부라벨` 같은 판매자 안내 문구가 buy-request noise로 오인되어 실제 발토로 매물이 null 처리되었다.

## 결정

- Supreme x TNF 반복 의류 모델을 별도 SKU로 분리했다.
  - `clothing-tnf-supreme-himalaya-parka`
  - `clothing-tnf-supreme-arc-logo-jacket`
  - `clothing-tnf-supreme-tape-seam-jacket`
  - `clothing-tnf-supreme-trekking-convertible-jacket`
  - `clothing-tnf-supreme-steep-tech-jacket`
  - `clothing-tnf-supreme-split-shell-jacket`
  - `clothing-tnf-supreme-bandana-jacket`
  - `clothing-tnf-supreme-leather-mountain-jacket`
- `clothing-tnf-supreme-collab` broad lane에는 위 모델 토큰과 `샌달`을 must-not으로 추가해 broad fallback 흡수를 차단했다.
- `split-shell`은 bare `스플릿/split`이 아니라 `스플릿 쉘/split shell`일 때만 매칭하도록 좁혔다. 이로써 `스플릿 6패널` 캡과 `스플릿 눕시`가 split-shell로 오염되지 않게 했다.
- 기존 `mountain jacket/parka/denali` narrow에는 `arc logo`, `bandana`, `leather mountain` 계열 must-not을 추가해 더 구체적인 신규 SKU와 충돌하지 않게 했다.
- buy-request 필터는 `구매희망시`, `구매 희망 시`, `구매희망하시면` 같은 판매자 CTA 문구를 예외 처리했다. 실제 `구매희망`, `구매원함`, `삽니다` 류는 계속 차단한다.
- 의류 product type parser는 `카고 팬츠/바지` 또는 `cargo pants/trouser`일 때만 pants로 보고, `카고 자켓`은 jacket으로 유지하도록 수정했다.

## DB sync 결과

- 대상 Supreme x TNF scope 2차 sync:
  - scoped rows: 273
  - parsed upserts: 256
  - parsed deleted: 2
  - raw patched: 15
  - pool deleted: 15
- 복구/재분류:
  - `null -> clothing-tnf-supreme-arc-logo-jacket`: 5
  - `null -> clothing-tnf-supreme-leather-mountain-jacket`: 3
  - `null -> clothing-tnf-supreme-nuptse`: 3
  - `null -> clothing-tnf-supreme-baltoro`: 1
  - `null -> clothing-tnf-supreme-bandana-jacket`: 1
  - `clothing-tnf-supreme-split-shell-jacket -> null`: 2 (`스플릿 6패널` 캡류)

## 검증

- Parser/catalog regression:
  - `슈프림 노스페이스 카고 자켓 블랙 XL` → jacket
  - `슈프림 노스페이스 카고 팬츠 블랙 XL` → pants
  - `스플릿 눕시` → `clothing-tnf-supreme-nuptse`
  - `아크로고 마운틴 파카` → `clothing-tnf-supreme-arc-logo-jacket`
  - `레더 마운틴 파카` → `clothing-tnf-supreme-leather-mountain-jacket`
  - `반다나 마운틴 자켓` → `clothing-tnf-supreme-bandana-jacket`
  - `구매희망시 내부라벨` 포함 발토로 → `clothing-tnf-supreme-baltoro`
- DB verification:
  - `clothing-tnf-supreme-collab`의 분리 대상 토큰 오염: 0
  - `mountain-jacket/parka/denali`의 arc-logo/bandana/leather-mountain 누수: 0
  - `split-shell`의 bare split 오인: 0

## 보류

- `노스페이스드라이로프 ... 슈프림노스페이스발토로원판`류는 bait/원판 표현이 섞여 있어 별도 wave에서 정교하게 판단한다.
- `G-SHOCK`은 현재 기존 clothing lane에 남아 있으나, 카테고리 모델링을 watch/accessory로 옮길지는 별도 wave에서 검토한다.
- `하이 파일 플리스 쇼츠`, `트레킹 패커블 벨트 쇼츠`, `숏슬리브 셔츠` 등 TNF Supreme 의류의 non-jacket product type split은 별도 wave로 넘긴다.
- 사이즈별 회전률 보정은 가격 비교군과 별도 지표로 설계해야 하므로 추후 wave에서 로그 기반으로 진행한다.
