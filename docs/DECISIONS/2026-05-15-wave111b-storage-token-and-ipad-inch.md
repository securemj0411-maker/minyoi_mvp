# Wave 111b — storage 단독 숫자 token + iPad 인치 normalize

> Status: **applied (code).** owner 요구 "vertical strengthening 끊지 말고". iPad Pro M4/Air M2 narrow lane audit → "256" 단독 / "13" 단독 명시 매물이 narrow mustContain miss.

CLAUDE.md 6 필드 포맷.

## 1. iPad Pro 13 M4 audit → 57% narrow

- 시간: 2026-05-15
- 발견: `scripts/audit-ipad-pro-13-m4.ts` mining sample 112건 분석:
  - narrow 매칭 64건 (57.1%)
  - broad ipad-pro 매칭 40건
  - null 8건
  - 매물 표기: "아이패드 프로 13 M4 256" / "아이패드프로 13 m4 256 wifi" — **"256" 단독, "13" 단독** (gb/인치 없음)
  - narrow mustContain[storage] = `["256gb", "256 gb", "256기가", "256g"]` — "256" 단독 매칭 X
  - narrow mustContain[screen] = `["13인치", "13 인치", "13형", "13\""]` — "13" 단독 매칭 X
- 변경: 측정만.
- 다음: storage token + inch normalize.

## 2. storage 단독 숫자 token 추가 (17 + 7 SKU)

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)** mustContain storage group 일괄 patch:
  - `["256gb", "256 gb", "256기가", "256g"]` → `["256gb", "256 gb", "256기가", "256g", "256"]`
  - `["128gb", "128 gb", "128기가", "128g"]` → `["128gb", "128 gb", "128기가", "128g", "128"]`
  - 17개 SKU "256" 그룹 + 7개 SKU "128" 그룹
- 안전성: tokenHit가 순수 숫자 token은 양쪽 공백 강제 (` 256 ` 포함만 hit) → false positive 차단.

## 3. iPad 인치 normalize ("아이패드 프로 13" → "13인치")

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts:2899-2902](mvp/src/lib/catalog.ts:2899)** NORMALIZATIONS 4 rule 추가:
  ```typescript
  [/(아이패드\s*(?:프로|에어))\s*13(?!\d|\.|인치)/gi, " $1 13인치 "],
  [/(아이패드\s*(?:프로|에어))\s*11(?!\d|\.|인치)/gi, " $1 11인치 "],
  [/(ipad\s*(?:pro|air))\s*13(?!\d|\.|in)/gi, " $1 13in "],
  [/(ipad\s*(?:pro|air))\s*11(?!\d|\.|in)/gi, " $1 11in "],
  ```
  - mini 8.3인치라 Pro/Air만 적용
  - lookahead로 인치 이미 명시된 경우, 13.X 같은 소수, 13인치 명시 다시 정규화 회피
- 검증:
  - tsc clean, 139/139 test pass
  - `audit-ipad-pro-13-m4.ts`: narrow 57.1% → **74.1%** (+17%p)

## 4. Lane-replay 최종 표 (Wave 108-111b 누적)

| Lane | Baseline (Wave 1.6c) | After 111 | After 111b |
|---|---:|---:|---:|
| iphone_15_pro_128gb_self | sku 30% / complete 30% | 93.5 / 92 | **91.5 / 91.5** A급 |
| iphone_14_pro_128gb_self | 56 / 55.5 | 90.5 / 89.5 | **88.5** B급 |
| iphone_16_pro_128gb_self | 40 / 40 | 48 / 48 | 48 / 48 (sample 25) |
| galaxy_s25_ultra_256_self | 75.5 / 75.5 | 90 / 89 | **87.5** B급 |
| galaxy_s24_ultra_256_self | 59 / 59 | 84.5 / 82.5 | **80.5** B급 |
| galaxy_s23_ultra_256_self | 67 / 67 | 84.5 / 80 | **79** B급 |
| ipad_pro_13_m4_256_wifi (audit) | — | 57.1 | **74.1** |

## 5. 거론 금지

- iPhone 16 Pro sample 25 (mining 부족) — Wave 91-style mining 별도 wave.
- MacBook M2/M3 unknown_ram/ssd 32% — 정책 12b "추정 fallback 금지". AI L2 영역.
- iPad mini "8" 단독 — 같은 패턴 적용 위험 (mini broad와 mini 7 narrow 충돌). 별도 audit.
