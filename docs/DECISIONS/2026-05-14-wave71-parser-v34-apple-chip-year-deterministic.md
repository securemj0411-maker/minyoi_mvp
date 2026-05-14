## Wave 71 — option-parser v33→v34: Apple silicon chip + (model, screen) → unique year deterministic 매핑

- 시간: 2026-05-14 KST
- 발견: User 지적 — §12b "chip → year 추정 금지"는 **chip이 여러 연식에 걸쳐 있을 때만** 적용. (model, chip, screen) tuple이 unique하면 추론 가능.
  - "M1 맥북에어" → 2020만 존재 (deterministic) ✅
  - "M2 맥북에어 13" → 2022만 ✅
  - "M3 맥북프로 14" → 2023~2024 (ambiguous) → unknown 유지 ❌
- 변경:
  - `src/lib/option-parser.ts` PARSER_VERSION v33→v34
  - `appleChipToReleaseYear(family, model, chip, screenSizeIn)` 신규 함수 추가:
    - MacBook Air: M1→2020, M2+13→2022, M2+15→2023, M3→2024, M4→2025
    - MacBook Pro: M1+13→2020, M1 Pro/Max→2021 (14"/16"), M2+13→2022, M2 Pro/Max→2023
    - 다년식 chip (M3 Pro/Max) → null (leave unknown)
  - parseListingOptions: chip + screenSizeIn 결정 후 releaseYear chip-based fallback 적용
- 검증:
  - 14건 테스트 13/14 pass (1 fail은 default 13" fallback으로 인한 정상 동작)
  - npm run test:core 139/139 pass (기존 m2_gen / m1_pro_gen → 2022y / 2021y로 정밀화)
  - npx tsc --noEmit clean
- 위험:
  - LOW: (model, chip, screen) unique한 조합만 매핑. silent estimation 아님.
  - 다년식 chip (M3 Pro/Max)은 leave unknown 유지로 정확성 보장.
- 다음:
  - production audit 재측정으로 macbook unknown_generation 추가 감소 확인
  - 옛 매물 reparse 시 needs_review_flip 추가 감소 예상

## 관련 — thin lane 재마이닝 시도

- camera_sony_a6400: query 5→8 확장, pages 6→8 → **변화 없음 (33 parse_ready)**
  - 원인: Bunjang 매물 ~180건 중 90%가 lens kit. body_only 정책 (§12b 옵션 A)으로 다수 reject. 정책 영역, parser/mining 무관.
- watch_seiko_5_sports_srpd: query 7→10 확장 → **변화 없음 (4 parse_ready)**
  - 원인: Bunjang Korea SRPD 모델 자체 supply 적음. query 확장 한계.

→ 둘 다 supply-side 제약. parser/mining patch로 해결 불가. 사업 결정 (lens kit 정책 완화 / Seiko 5 폐기) 필요.
