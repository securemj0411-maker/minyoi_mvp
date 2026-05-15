# Wave 117b — Switch v1/Lite catalog 추가 (428건 복구)

## 1. 진단
- 시간: 2026-05-15
- 발견: Switch 97% null (1,039/1,077건). 매물 빈도: Switch v1 339건, Lite 19건. catalog는 OLED + Switch 2만.
- 변경: 측정만. 다음: v1/Lite 추가.

## 2. catalog 추가
- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts](mvp/src/lib/catalog.ts)**
  - switch-v1 (Nintendo Switch 1세대 2017, msrp 360k)
  - switch-lite (2019, msrp 270k)
  - 격리: 3DS/2DS/DS (옛 휴대용), Dell/Cisco 네트워크 스위치, 게임팩/조이콘 단품
- 검증: 139/139 test pass.

## 3. Production reclassify — 428건
- 실행: scripts/reclassify-wave117b-switch.ts
- 결과: switch-v1 312, switch-oled 60, switch-2 36, switch-lite 20 = **428건 복구**

## 4. 거론 금지
- Switch는 game_console 카테고리 internal_only → narrow lane만 사용자 노출 (현재 narrow 없음).
- bundle policy (full_set vs body_only) 미정 (owner decision).
