# 2026-05-16 코멘트 #110 — AirPods Pro 2 Lightning + USB-C 통합 (이전 분리 revert)

## 발견

- 사용자 코멘트 #110 1차 처리 (이전 turn): catalog `airpods-pro-2-lightning` mustContain 에 connector 명시 추가 → 명시 X 매물 sku=null 박힘 (LAUNCH_PLAN 12b 정합).
- 단 **가격/기능 사실 확인 안 함**. 사용자 인용 + Apple 공식 확인 결과:
  - **정가 동일 359K** (Lightning 2022 vs USB-C 2023)
  - 차이: ① IP54 방진 ② Vision Pro 무손실 (사실상 무의미) ③ 충전 단자
  - 이어폰 본체 동일, 사용 경험 동일
  - → **catalog 분리 무의미**. 시세 sample 갈라져 sample 부족.
- 사용자: "굳이 에어팟 프로2는 구별안해도 되는거 아님?? 가격도 조사 안 하고."

## 변경

- `src/lib/catalog.ts`:
  - `airpods-pro-2-lightning` (132 매물) + `airpods-pro-2-usbc` (217 매물) **두 SKU 삭제**
  - 단일 `airpods-pro-2` 신설:
    - mustContain: `["에어팟", "airpods"] + ["프로", "pro"] + ["2세대", "2 세대", "2nd", " 2 ", "프로 2", "프로2"]`
    - mustNotContain: `["max", "맥스", "3세대", "3 세대", "3rd", "프로 3", "프로3", "1세대", "1 세대", "1st", "프로 1", "프로1"]` (connector 차단 X)
- `src/lib/option-parser.ts`:
  - `defaultAirpodsConnector` 에 airpods_pro_2 분기 — connector default null 박음 (시세 단일 sample).
  - `comparableParts` (line 1160~) earphone 처리 — `model === "airpods_pro_2" || startsWith("airpods_pro_2_")` 면 connector token skip. 결과: comparable_key = `airpods|airpods_pro_2` (이전 `airpods|airpods_pro_2_lightning|lightning` vs `airpods|airpods_pro_2_usbc|usbc`).
- `tests/core-rules.test.ts`:
  - line 163: `airpods-pro-2-usbc` → `airpods-pro-2`
  - line 197: `airpods-pro-2-lightning` → `airpods-pro-2`
  - line 1312, 1352: comparable_key `airpods|airpods_pro_2_usbc|usbc` → `airpods|airpods_pro_2`

## 검증

- `npm run test:core` 172/172 pass.
- 전체 reclassify (21,192 매물, ~5분).
- 분포 fix 후:
  | sku_id | cnt | 의미 |
  |---|---|---|
  | airpods-pro-2 | **540** | 통합 매물 (이전 lightning 132 + usbc 217 + null 591 일부 흡수) |
  | null | 402 | 케이스 단품 / 프로3 / 맥스 등 mustNotContain reject |
  | airpods-pro-3 | 1 | 별도 SKU |
- 이전 분리 (132 + 217 = 349) → 통합 (540) = sample +55%. 시세 정확도 ↑.

## 위험

- comparable_key 형식 변경 (3 token → 2 token) — 다른 코드가 `airpods|airpods_pro_2_lightning` 같은 옛 형식 파싱하면 break 가능. grep 후 확인 필요.
- mvp_market_price_daily 의 옛 cc 별 row (airpods_pro_2_lightning|lightning, airpods_pro_2_usbc|usbc) 는 stale → 자연 turnover 또는 명시 delete (단 이번엔 destructive 작업 사전 confirm 받고 진행).

## 운영 원칙 강조

**가격/기능 사실 확인 먼저** — catalog SKU 분리/통합 결정 전에 Apple 공식 + 시장 가격 조사 필수. 단순 catalog 코드만 보고 fix 박지 X. 사용자 frustrate.
