# 테크 기기 옵션 audit (2026-05-17)

> Phase 3 base option fallback 박기 전 사전 작업. Apple/Samsung 공식 spec 기반.
> shoe / earphone / monitor / speaker / camera / game_console / desktop accessory / watch (analog) / sport_golf / bag / bike = 단일 옵션 → base fallback 불필요.

---

## 1. smartphone (storage axis, 80 SKU)

### iPhone (Apple 공식 spec)

| SKU | storage 옵션 | base |
|---|---|---|
| iphone-se2 (2020) | 64 / 128 / 256GB | 64 |
| iphone-se3 (2022) | 64 / 128 / 256GB | 64 |
| iphone-11 (2019) | 64 / 128 / 256GB | 64 |
| iphone-11-pro / pro-max (2019) | 64 / 256 / 512GB | 64 |
| iphone-12 (2020) | 64 / 128 / 256GB | 64 |
| iphone-12-pro / pro-max (2020) | 128 / 256 / 512GB | 128 |
| iphone-12-mini (2020) | 64 / 128 / 256GB | 64 |
| iphone-13 (2021) | 128 / 256 / 512GB | 128 |
| iphone-13-pro / pro-max (2021) | 128 / 256 / 512 / 1TB | 128 |
| iphone-13-mini (2021) | 128 / 256 / 512GB | 128 |
| iphone-14 (2022) | 128 / 256 / 512GB | 128 |
| iphone-14-pro / pro-max (2022) | 128 / 256 / 512 / 1TB | 128 |
| iphone-14-plus (2022) | 128 / 256 / 512GB | 128 |
| iphone-15 (2023) | 128 / 256 / 512GB | 128 |
| iphone-15-pro (2023) | 128 / 256 / 512 / 1TB | 128 |
| iphone-15-pro-max (2023) | 256 / 512 / 1TB | 256 (128GB 없음!) |
| iphone-15-plus (2023) | 128 / 256 / 512GB | 128 |
| iphone-16 (2024) | 128 / 256 / 512GB | 128 |
| iphone-16-pro (2024) | 128 / 256 / 512 / 1TB | 128 |
| iphone-16-pro-max (2024) | 256 / 512 / 1TB | 256 (128GB 없음) |
| iphone-16-plus (2024) | 128 / 256 / 512GB | 128 |
| iphone-16e (2025) | 128 / 256 / 512GB | 128 |
| iphone-air (2025) | 256 / 512GB / 1TB | 256 |
| iphone-17 (2025) | 256 / 512GB / 1TB | 256 |
| iphone-17-pro (2025) | 256 / 512 / 1TB | 256 |
| iphone-17-pro-max (2025) | 256 / 512 / 1TB / 2TB | 256 |
| iphone-17-plus (2025) | 256 / 512 / 1TB | 256 |
| iphone-17e (2026, 추정) | 128 / 256 / 512GB | 128 |

자급제 SKU (-128-self, -256-self 등): storage 명시 박힘 → base fallback 불필요.

### Galaxy (Samsung 공식 spec)

| SKU | storage 옵션 | base |
|---|---|---|
| galaxy-note10 / note10-plus (2019) | 256 / 512GB | 256 |
| galaxy-note20 (2020) | 256GB only | 256 (단일) |
| galaxy-note20-ultra (2020) | 256 / 512GB | 256 |
| galaxy-s20 (2020) | 128 / 256 / 512GB | 128 |
| galaxy-s20-plus (2020) | 128 / 256 / 512GB | 128 |
| galaxy-s20-ultra (2020) | 128 / 256 / 512GB | 128 |
| galaxy-s21 (2021) | 128 / 256GB | 128 |
| galaxy-s21-plus (2021) | 128 / 256GB | 128 |
| galaxy-s22 (2022) | 128 / 256GB | 128 |
| galaxy-s22-plus (2022) | 128 / 256GB | 128 |
| galaxy-s23 (2023) | 128 / 256 / 512GB | 128 |
| galaxy-s23-plus (2023) | 256 / 512GB | 256 |
| galaxy-s23-ultra (2023) | 256 / 512 / 1TB | 256 |
| galaxy-s23-fe (2023) | 128 / 256GB | 128 |
| galaxy-s24 (2024) | 256 / 512GB | 256 |
| galaxy-s24-plus (2024) | 256 / 512GB | 256 |
| galaxy-s24-ultra (2024) | 256 / 512 / 1TB | 256 |
| galaxy-s24-fe (2024) | 128 / 256 / 512GB | 128 |
| galaxy-s25 (2025) | 128 / 256 / 512GB | 128 |
| galaxy-s25-plus (2025) | 256 / 512GB | 256 |
| galaxy-s25-ultra (2025) | 256 / 512 / 1TB | 256 |
| galaxy-s25-edge (2025) | 256 / 512GB | 256 |
| galaxy-s25-fe (2025) | 128 / 256 / 512GB | 128 |
| galaxy-s26 / plus / ultra (2026) | 256+ | 256 |
| galaxy-z-flip-3 (2021) | 128 / 256GB | 128 |
| galaxy-z-flip-4 (2022) | 128 / 256 / 512GB | 128 |
| galaxy-z-flip-5 (2023) | 256 / 512GB | 256 |
| galaxy-z-flip-6 (2024) | 256 / 512 / 1TB | 256 |
| galaxy-z-flip-7 (2025) | 256 / 512GB | 256 |
| galaxy-z-fold-3 (2021) | 256 / 512GB | 256 |
| galaxy-z-fold-4 (2022) | 256 / 512 / 1TB | 256 |
| galaxy-z-fold-5 (2023) | 256 / 512 / 1TB | 256 |
| galaxy-z-fold-6 (2024) | 256 / 512 / 1TB | 256 |
| galaxy-z-fold-7 (2025) | 256 / 512 / 1TB | 256 |

자급제 (-256-self 등): storage 명시 박힘 → base fallback 불필요.

---

## 2. tablet (storage + connectivity, 40 SKU)

### iPad (Apple 공식 spec)

| SKU | storage 옵션 | connectivity | base |
|---|---|---|---|
| ipad-7 (2019, 10.2") | 32 / 128GB | Wi-Fi / Cellular | 32GB + Wi-Fi |
| ipad-8 (2020, 10.2") | 32 / 128GB | Wi-Fi / Cellular | 32GB + Wi-Fi |
| ipad-9 (2021, 10.2") | 64 / 256GB | Wi-Fi / Cellular | 64GB + Wi-Fi |
| ipad-10 (2022, 10.9") | 64 / 256GB | Wi-Fi / Cellular | 64GB + Wi-Fi |
| ipad-11 (2024, A16, 11") | 128 / 256 / 512GB | Wi-Fi / Cellular | 128GB + Wi-Fi |
| ipad-pro (broad) | 모든 narrow 별도 lane | — | (narrow 우선) |
| ipad-pro-11-m1 (2021) | 128 / 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-pro-11-m2 (2022) | 128 / 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-pro-11-m4 (2024) | 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 256GB + Wi-Fi |
| ipad-pro-12-9-m1 (2021) | 128 / 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-pro-13-m2 (2022) | 128 / 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-pro-13-m4 (2024) | 256 / 512 / 1TB / 2TB | Wi-Fi / 5G | 256GB + Wi-Fi |
| ipad-air (broad) | — | — | (narrow 우선) |
| ipad-air-4 (2020, A14) | 64 / 256GB | Wi-Fi / Cellular | 64GB + Wi-Fi |
| ipad-air-5-m1 (2022) | 64 / 256GB | Wi-Fi / 5G | 64GB + Wi-Fi |
| ipad-air-m2 11" / 13" (2024) | 128 / 256 / 512 / 1TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-air-m3 11" / 13" (2025) | 128 / 256 / 512 / 1TB | Wi-Fi / 5G | 128GB + Wi-Fi |
| ipad-mini (broad) | — | — | (narrow 우선) |
| ipad-mini-5 (2019, A12) | 64 / 256GB | Wi-Fi / Cellular | 64GB + Wi-Fi |
| ipad-mini-6 (2021, A15) | 64 / 256GB | Wi-Fi / 5G | 64GB + Wi-Fi |
| ipad-mini-7 (2024, A17 Pro) | 128 / 256 / 512GB | Wi-Fi / 5G | 128GB + Wi-Fi |

### Galaxy Tab (Samsung 공식)

| SKU | storage 옵션 | connectivity | base |
|---|---|---|---|
| galaxy-tab-s6 (2019) | 128 / 256GB | Wi-Fi / LTE | 128GB + Wi-Fi |
| galaxy-tab-s6-lite (2020) | 64 / 128GB | Wi-Fi / LTE | 64GB + Wi-Fi |
| galaxy-tab-s7 (2020) | 128 / 256 / 512GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s7-plus (2020) | 128 / 256 / 512GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s7-fe (2021) | 64 / 128 / 256GB | Wi-Fi / 5G | 64GB + Wi-Fi |
| galaxy-tab-s8 (2022) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s8-plus (2022) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s8-ultra (2022) | 128 / 256 / 512GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s9 (2023) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s9-plus (2023) | 256 / 512GB | Wi-Fi / 5G | 256GB + Wi-Fi |
| galaxy-tab-s9-ultra (2023) | 256 / 512GB / 1TB | Wi-Fi / 5G | 256GB + Wi-Fi |
| galaxy-tab-s9-fe (2023) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s9-fe-plus (2023) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |
| galaxy-tab-s10-plus (2024) | 256 / 512GB | Wi-Fi / 5G | 256GB + Wi-Fi |
| galaxy-tab-s10-ultra (2024) | 256 / 512GB / 1TB | Wi-Fi / 5G | 256GB + Wi-Fi |
| galaxy-tab-s10-fe-plus (2024) | 128 / 256GB | Wi-Fi / 5G | 128GB + Wi-Fi |

---

## 3. laptop (chip/screen 명시 필수, RAM/SSD base fallback, 37 SKU)

### MacBook Air (Apple 공식)

| SKU | RAM 옵션 | SSD 옵션 | base |
|---|---|---|---|
| macbook-air-m1-13 (2020) | 8 / 16GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| macbook-air-m2-13 (2022) | 8 / 16 / 24GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| macbook-air-m2-15 (2023) | 8 / 16 / 24GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| macbook-air-m3-13 (2024) | 8 / 16 / 24GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| macbook-air-m3-15 (2024) | 8 / 16 / 24GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| macbook-air-m4-13 (2025) | 16 / 24 / 32GB | 256 / 512GB / 1TB / 2TB | **16GB** + 256GB (M4부터 base 변경) |
| macbook-air-m4-15 (2025) | 16 / 24 / 32GB | 256 / 512GB / 1TB / 2TB | **16GB** + 256GB |

### MacBook Pro 14"

| SKU | RAM 옵션 | SSD 옵션 | base |
|---|---|---|---|
| macbook-pro-14-m1-pro (2021) | 16 / 32GB | 512 / 1TB / 2TB / 4TB / 8TB | 16GB + 512GB |
| macbook-pro-14-m1-max (2021) | 32 / 64GB | 512 / 1TB / 2TB / 4TB / 8TB | 32GB + 1TB |
| macbook-pro-14-m2-pro (2023) | 16 / 32GB | 512 / 1TB / 2TB / 4TB / 8TB | 16GB + 512GB |
| macbook-pro-14-m2-max (2023) | 32 / 64 / 96GB | 1 / 2 / 4 / 8TB | 32GB + 1TB |
| macbook-pro-14-m3 (2023, vanilla) | 8 / 16 / 24GB | 512GB / 1TB / 2TB | 8GB + 512GB |
| macbook-pro-14-m3-pro (2023) | 18 / 36GB | 512 / 1TB / 2TB / 4TB | 18GB + 512GB |
| macbook-pro-14-m3-max (2023) | 36 / 48 / 64 / 96 / 128GB | 1 / 2 / 4 / 8TB | 36GB + 1TB |
| macbook-pro-14-m4 (2024, vanilla) | 16 / 24 / 32GB | 512 / 1TB / 2TB | 16GB + 512GB |
| macbook-pro-14-m4-pro (2024) | 24 / 48GB | 512 / 1TB / 2TB / 4TB | 24GB + 512GB |
| macbook-pro-14-m4-max (2024) | 36 / 48 / 64 / 128GB | 1 / 2 / 4 / 8TB | 36GB + 1TB |

### MacBook Pro 16"

| SKU | RAM 옵션 | SSD 옵션 | base |
|---|---|---|---|
| macbook-pro-16-m1-pro (2021) | 16 / 32GB | 512 / 1TB / 2TB / 4TB / 8TB | 16GB + 512GB |
| macbook-pro-16-m1-max (2021) | 32 / 64GB | 512 / 1TB / 2TB / 4TB / 8TB | 32GB + 1TB |
| macbook-pro-16-m3-pro (2023) | 18 / 36GB | 512 / 1TB / 2TB / 4TB | 18GB + 512GB |
| macbook-pro-16-m3-max (2023) | 36 / 48 / 64 / 96 / 128GB | 1 / 2 / 4 / 8TB | 36GB + 1TB |
| macbook-pro-16-m4-pro (2024) | 24 / 48GB | 512 / 1TB / 2TB / 4TB | 24GB + 512GB |
| macbook-pro-16-m4-max (2024) | 36 / 48 / 64 / 128GB | 1 / 2 / 4 / 8TB | 36GB + 1TB |

### MacBook 옛 (Intel)

| SKU | base note |
|---|---|
| macbook-air-13-2017 (Intel) | RAM 8GB, SSD 128/256/512GB. Intel only — base fallback 안전 X (옛). |
| macbook-air-13-2018 (Intel) | RAM 8/16GB, SSD 128/256/512GB / 1.5TB | 8GB + 128GB |
| macbook-pro-13-2017/2019 / 15-2017/2018/2019 / 16-2019 (Intel) | RAM/SSD 다양 | (옛 — base fallback 보류) |

### LG Gram

| SKU | RAM 옵션 | SSD 옵션 | base |
|---|---|---|---|
| lg-gram-17-2024 | 16 / 32GB | 512GB / 1TB | 16GB + 512GB |

---

## 4. smartwatch (size + connectivity, 24 SKU)

### Apple Watch

| SKU | size 옵션 | connectivity | base |
|---|---|---|---|
| applewatch-series5 (2019) | 40 / 44mm | GPS / Cellular | 40mm + GPS |
| applewatch-series6 (2020) | 40 / 44mm | GPS / Cellular | 40mm + GPS |
| applewatch-series7 (2021) | 41 / 45mm | GPS / Cellular | 41mm + GPS |
| applewatch-series8 (2022) | 41 / 45mm | GPS / Cellular | 41mm + GPS |
| applewatch-series9 (2023) | 41 / 45mm | GPS / Cellular | 41mm + GPS |
| applewatch-series10 (2024) | **42 / 46mm** (size 변경) | GPS / Cellular | 42mm + GPS |
| applewatch-series11 (2025) | 42 / 46mm | GPS / Cellular | 42mm + GPS |
| applewatch-se1 (2020) | 40 / 44mm | GPS / Cellular | 40mm + GPS |
| applewatch-se2 (2022) | 40 / 44mm | GPS / Cellular | 40mm + GPS |
| applewatch-se3 (2025) | 40 / 44mm | GPS / Cellular | 40mm + GPS |
| applewatch-ultra (2022) | 49mm only | Cellular only | 49mm (단일) |
| applewatch-ultra2 (2023) | 49mm only | Cellular only | 49mm (단일) |
| applewatch-ultra3 (2025) | 49mm only | Cellular only | 49mm (단일) |
| applewatch-series8-hermes (2022) | 41 / 45mm | Cellular only (Hermès) | 41mm + Cellular |
| applewatch-series10-hermes (2024) | 42 / 46mm | Cellular only | 42mm + Cellular |

### Galaxy Watch

| SKU | size 옵션 | connectivity | base |
|---|---|---|---|
| galaxywatch-active-2 (2019) | 40 / 44mm | Bluetooth / LTE | 40mm + Bluetooth |
| galaxywatch-3 (2020) | 41 / 45mm | Bluetooth / LTE | 41mm + Bluetooth |
| galaxywatch-4 (2021) | 40 / 44mm | Bluetooth / LTE | 40mm + Bluetooth |
| galaxywatch-5 (2022) | 40 / 44mm | Bluetooth / LTE | 40mm + Bluetooth |
| galaxywatch-6 (2023) | 40 / 44mm | Bluetooth / LTE | 40mm + Bluetooth |
| galaxywatch-7 (2024) | 40 / 44mm | Bluetooth / LTE | 40mm + Bluetooth |
| galaxywatch-ultra (2024) | 47mm only | LTE only | 47mm (단일) |

---

## 5. desktop (RAM + SSD, 6 SKU)

| SKU | RAM 옵션 | SSD 옵션 | base |
|---|---|---|---|
| desktop-mac-mini-m2 (2023) | 8 / 16 / 24 / 32GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| desktop-mac-mini-m4 (2024) | 16 / 24 / 32 / 64GB | 256 / 512GB / 1TB / 2TB | 16GB + 256GB |
| desktop-imac-m1-24 (2021) | 8 / 16GB | 256 / 512GB / 1TB | 8GB + 256GB |
| desktop-imac-m3-24 (2023) | 8 / 16 / 24GB | 256 / 512GB / 1TB / 2TB | 8GB + 256GB |
| desktop-imac-m4-24 (2024) | 16 / 24 / 32GB | 256 / 512GB / 1TB / 2TB | 16GB + 256GB |
| desktop-mac-studio-m4-max-512 (2025) | 36 / 48 / 64 / 128GB | 512GB / 1TB / 2TB / 4TB / 8TB | 36GB + 512GB |

---

## 6. 단일 옵션 — base fallback 불필요

### earphone (38 SKU)
- AirPods 2/3/4/4 ANC / Pro 1/2/3 / Max Lightning / Max USB-C
- Sony WH-1000XM3~6, ULT900N, CH720N, CH520, LinkBuds 3변형
- Bose QC Ultra Earbuds / Headphones, QC45, 700 헤드폰, QC Earbuds II
- Beats Studio Pro, Solo 4, Solo 4 Jennie
- Galaxy Buds 2/2 Pro/3/3 Pro/4 Pro / Live
- Sennheiser Accentum, HD569

→ 각 모델 단일 옵션. catalog ruleMatch 매칭 + 매물 텍스트에 모델명 명시되면 풀 진입.

### monitor / speaker / camera / game_console / home_appliance / watch (analog) / sport_golf
모두 단일 모델 spec. base fallback 불필요.

---

## 7. 사용자 검증 필요 사항

### ⚠️ 의문 케이스

1. **iPhone 15 Pro Max base = 256GB (128GB 없음)** — Apple 공식. 매물에 "iPhone 15 Pro Max" 만 박혀있고 storage 명시 X면 base 256? 또는 128 (옛 base) 가정?
   - 권장: 256GB base (Apple 공식)
2. **iPhone 16 Pro Max base = 256GB** — 동일.
3. **MacBook Air M4 base = 16GB** (M3까지 8GB, M4부터 16GB) — Apple 변경
4. **MacBook Pro 14/16 M-series**:
   - vanilla (M3/M4 일반): 8 / 16GB base — 별도 SKU 박혀있나? macbook-pro-14-m3 (vanilla) 박혀있는데 (M3 base 8GB) M3 Pro/Max랑 분리되어야
   - M-series chip variant (Pro/Max) base 별도
5. **iPad Pro M4 (2024) base = 256GB** — 128GB 없음
6. **iPad mini 7 base = 128GB** — 64GB 없음
7. **Galaxy S25 Edge base = 256GB**
8. **Apple Watch Ultra 시리즈** = 49mm Cellular only (단일) → base fallback 안전

---

## 8. 다음 단계 (Phase 3)

사용자 검증 후:
1. catalog.ts 각 SKU에 `baseOptions: { storageGb?, ramGb?, ssdGb?, watchSizeMm?, connectivity?, carrier? }` 필드 추가
2. option-parser에서 옵션 명시 X + baseOptions 박힌 SKU → base 가정 + `parsed_json.option_base_assumed` 박기
3. UI 3화면 "기본 옵션 가정" 표시
4. LAUNCH_PLAN §12b update

### 안전성 (§12b 부합)
- base option은 항상 가장 낮은 옵션 → 시세 underestimate → priceGap 보수적 → **false positive 0**
- recall loss만 (진짜 고옵션 매물이 base 시세로 비교돼 안 추천됨) — OK
