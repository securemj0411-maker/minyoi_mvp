# Wave 766 — Audit Phase 2: Apple 세대 분리 + airpods-max stale 5건 재분류

- 시간: 2026-05-27 KST
- 트리거: 사용자 "1,2 다 하면 안되냐?" — Wave 765 마무리 + 다른 audit 후보 추가 스캔.

## 발견 (audit phase 2)

2-day ready pool 비 신발 SKU spread 스캔 (`max/min > 2.5`):

| SKU | ready | spread | 진단 |
|---|---|---|---|
| airpods-max | 6건 | 3.00x | **stale 5건이 "맥스2"/2세대 컬러/2026 매물** — Wave 765 mustNotContain 이전 분류 |
| ipad-pro | 5건 | 2.80x | **M5 narrow 누락** — "아이패드프로13 M5" / "프로 11(M5 모델)" 매물 broad으로 떨어짐 |
| ipad-air | 4건 | 2.80x | **M4 narrow 누락** — "에어 11 M4 128GB" 매물 broad으로 떨어짐 |
| macbook-air | 3건 | 2.50x | M1/M2/M3/M4 narrow 이미 존재하지만 storage 명시 안 한 매물이 broad으로. **별도 wave에서 mustContain 완화 검토** (이번엔 skip) |
| applewatch-se2, polo-knit, polo-chino, thombrowne-shirt, moncler-tricot, acne-knit | — | — | condition/style variance, sub-line 분리 불필요 — skip |

## 변경

### `src/lib/catalog.ts`
1. **`airpods-max-usbc` mustContain 확장** — group 3에 소비자 명칭 추가: "맥스2", "맥스 2", "max2", "max 2", "2세대", "2 세대", 2세대 전용 컬러 ("미드나이트", "스타라이트", "퍼플", "오렌지"), model 번호 "a3184". 미래 매물이 USB-C 키워드 없이도 USB-C narrow에 흡수됨. mustNotContain에 "8핀", " 1세대 ", "맥스 1세대" 추가 (1세대 1세대 매물 분리 안전망).
2. **신규 `ipad-pro-11-m5-256-wifi`** (msrp 1,899,000, 출시 2025) — M5 11" 256GB Wi-Fi.
3. **신규 `ipad-pro-13-m5-256-wifi`** (msrp 2,399,000, 출시 2025) — M5 13" 256GB Wi-Fi.
4. **신규 `ipad-air-m4-11-128-wifi`** (msrp 899,000, 출시 2026) — M4 11" 128GB Wi-Fi.

### DB
5. **stale 5건 sku_id 재할당** — `mvp_raw_listings` UPDATE:
   - pid 7002160474035 (720k 에어팟 맥스 2 미드나이트 미개봉)
   - pid 7003881360976 (680k 2026에어팟맥스 스타라이트)
   - pid 409956827 (660k 2026에어팟맥스2 단순개봉급)
   - pid 7003881424606 (540k [미개봉]에어팟 맥스2 미드나이트 2026)
   - pid 7001695805101 (420k 에어팟 맥스2 미드나이트)
   - `sku_id` `airpods-max` → `airpods-max-usbc`, `sku_name` 동기, `score_dirty=true` (다음 tick에 재계산)
6. **`mvp_listings.sku_name` 동기 UPDATE** — 동일 5건의 sku_name `AirPods Max (Lightning)` → `AirPods Max (USB-C, 2024)`.

## 검증
- `npx tsc --noEmit` src/ 깨끗 (tests/* 사전 존재 type 에러 8건은 Wave 766과 무관).
- catalog 신규 SKU: 3개 (M5 11/13, M4 air 11).
- DB UPDATE: 5/5 rows affected (airpods-max → airpods-max-usbc) + 5/5 mvp_listings sku_name 동기.

## 위험
- M5 narrow msrp는 M4 동일 가격 정책 추정 (Apple 가격 정책 일관성, 시판 추적 없음). 시세 수집되면 narrow median이 msrp 대체할 거라 큰 위험 X.
- iPad Air M4 narrow는 2026 spring refresh 가정. 매물 1건 발견 (840k 새제품), 시세 수집 후 median 박힘 예상.
- airpods-max-usbc mustContain에 컬러명 (미드나이트/스타라이트/퍼플/오렌지) 추가 — 이 컬러는 2세대 전용이지만 미래 1세대 보강 재고나 community fake titling 가능성은 매우 낮음.
- 1세대 mustNotContain에 동일 키워드 이미 있어 (Wave 765) 이중 안전망.

## 다음
- production replay 측정 (수 시간 후 M5/M4 narrow 매물 inflow + airpods-max-usbc 재분류 효과).
- macbook-air narrow storage 명시 완화 (M2 narrow가 "256gb" 강제하는데 매물 다수가 storage 생략) → 별도 wave.
- 다른 high-spread broad SKU (clothing-acne-knit, polo-knit-sweater, thombrowne-shirt) 는 sub-style variance 이지만 sub-line 명확하게 분리되지 않는 케이스 → 의도적 skip 유지.
