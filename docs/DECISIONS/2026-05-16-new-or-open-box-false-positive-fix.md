# 2026-05-16 — new_or_open_box 라벨 false positive 차단

## 트리거
Iteration 5 condition_notes 라벨 감사 중 발견:
- `new_or_open_box` 5,068건 = 전체 매물의 43%. 비정상으로 높음.
- DB sample 15건 분석 결과 **4건 (27%) false positive**.

## False positive 패턴 (sample)

| pid | description 발췌 | 진단 |
|---|---|---|
| 355765607 | "운동 2번했을까요...베터리 성능 100" | 실사용. battery=100 단독 trigger |
| 398988270 | "긁힘 하나 없이 깨끗합니다(새상품과 같은 상태)" | "새상품과 같은 상태" — 실사용 비교 표현 |
| 384072019 | "사용얼마안해서 거의새거구요" | "사용 얼마 안" + "거의새거" — 실사용 |
| 402737077 | "실사용 6-7번정도 입니다" | "실사용 X번" — 실사용 명시 |

근본 원인: regex가 "새상품/새거/새 것" 같은 token을 단독 매칭. "X 같은 상태" / "거의 X" / "실사용 X번" 같은 부정 문맥 무시.

## Fix

### `src/lib/option-parser.ts:921` regex 정밀화

이전:
```typescript
const explicitNewSignal = /미개봉|...|새상품|...|새 것|새거|.../.test(lower);
```

이후:
```typescript
const newSignalNegativePattern = /새\s*(?:상품|제품|것|거)\s*(?:과\s*)?(?:같은|처럼|급|레벨|수준|상태)/i.test(lower) ||
  /거의\s*새/i.test(lower) ||
  /실사용\s*\d+\s*번/i.test(lower) ||
  /사용\s*얼마\s*(?:안|않)/i.test(lower);
const explicitNewSignal = !newSignalNegativePattern && /미개봉|.../.test(lower);
```

차단 패턴:
1. "새상품과 같은 상태" / "새상품 같은" / "새상품처럼" / "새상품급"
2. "거의 새X" / "거의새X"
3. "실사용 X번" (X = 숫자)
4. "사용 얼마 안" / "사용 얼마 않"

## 영향 예측
- 즉시: 신규 parse는 fix 적용. 옛 매물은 score_dirty 또는 lifecycle worker reparse 시 자동 갱신.
- 추정: 5,068 × 27% ≈ 1,368건이 false positive로 의심 → 점진적으로 라벨 제거.
- 시세 정확도 향상: reference_price와 잘못 매핑되던 매물이 정상 중고 시세로 fallback.

## 검증
- TypeScript: validator.ts(`/plans` dev cache) 외 무에러.
- ESLint: 무에러.
- `npm run test:core` 139/139 pass.

## 보류 / 다음
- battery=100 단독 trigger (line 927): 사용자 요청 (pid 406747021)이라 유지. 다만 위 negative pattern과 결합되면 자동 차단됨.
- 추가 false positive 패턴 가능성: 후속 sampling 필요. 예) "박스만 뜯음", "한번 차봄" 등 애매한 표현.
- mvp_listings의 잘못 라벨된 ~1,368건 재파싱 batch 필요 — 다음 wave에서 measured fix.
