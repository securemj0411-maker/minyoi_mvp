# 2026-05-16 사용자 코멘트 v45 — mint/unopened 오분류 root cause fix

## 사용자 의심 (확정)

- pid 334814973 ("(가격내림없음)애플워치9 41mm GPS 실버"): 사용자 의도 = mint (배터리 93%, 23.11.16 구매) — 시스템 unopened
- pid 334403685 ("애플워치se2 40mm gps (배터리성능100)"): 사용자 명시 "미개봉/새재품 아니기 때문에 mint" — 시스템 unopened
- pid 403851792 ("애플워치se2 44mm 성능 100%"): 사용자 의도 mint — 시스템 unopened
- pid 352131281 (아이폰16프로맥스): 사용자 "한 단계 다운그래이드" worn — 시스템 clean (텍스트 vs 사진 mismatch, AI 영역)

## Root cause (option-parser.ts)

### Issue A — explicitNewSignal regex false positive (Wave 91 단독 매칭 잔재)

이전 regex: `미개봉|미\s*개봉|새상품|새 제품|새제품|단순개봉|...`
- "**새상품/새 제품/새제품**" 단독 매칭 = **액세서리 context false positive 다수**
- 예: pid 334814973 "정품 스트랩... 한 번도 안 쓴 새제품" → 스트랩이 새제품인데 본체 unopened 분류
- 예: pid 403851792 "새 제품입니다 최상급 s급" → 셀러 인플레

#121 fix 가 "새것/새거" 단독 매칭만 제거. "새상품/새제품" 도 같은 패턴인데 누락.

### Issue B — batteryHealth=100 단독 unopened 마킹 (Wave 91 정책)

이전 정책: Apple 기기 100% = 새제품 가정 (시세 sample 평균 끌어올림 차단).
- 문제: pid 334403685 "**풀박스 아니에요(밴드없음)**" 명시 + 배터리 100 → unopened (false positive)
- 사용자 의도: 명시적 unopened 키워드 없으면 clean (mint) 까지만.

## Fix

### option-parser.ts:1032 — explicitNewSignal 단독 매칭 제거

```diff
-  const explicitNewSignal = ... /미개봉|...|새상품|새 제품|새제품|단순개봉|.../
+  const explicitNewSignal = ... /미개봉|...|단순개봉|미사용\s*(?:신|새|상품|제품)|박스\s*(?:미개봉|새상품)|.../
```

"새상품/새 제품/새제품" 단독 매칭 제거. **"박스 새상품" 같은 명시 표현만 유지**.

### option-parser.ts:1038 — batteryHealth=100 unopened 정책 폐기

```diff
-  if (!explicitNewSignal && batteryHealth >= 100) {
-    add("new_or_open_box", 0.1);  // unopened 마킹
-  }
+  if (!explicitNewSignal && batteryHealth >= 100) {
+    add("battery_perfect", 0.05);  // clean 마킹 (CLEAN_NOTES 추가)
+  }
```

### PARSER_VERSION v44 → v45

- 옛 매물 legacy reparse 트리거용
- reparse-listings/route.ts CURRENT_PARSER_VERSION 같이 v45

## 검증 (4건 의심 매물 reparse 결과)

| pid | 옛 cc | 새 cc | 사용자 의도 | 결과 |
|---|---|---|---|---|
| 334403685 | unopened | clean | mint | ✅ |
| 334814973 | unopened | clean | mint | ✅ |
| 403851792 | unopened | clean | mint | ✅ |
| 352131281 | clean | clean | worn | ⚠️ AI 영역 (텍스트 모순) |

## 미해결 (Layer B AI 영역)

- pid 352131281: description "찍힘 하자 전혀없고" 명시인데 사용자 사진 검토 결과 "측면 미세 점 까짐". 텍스트만으론 worn 못 잡음. Wave 141 Layer B AI 강화 필요.
- pid 403616114 (id 124): 사용자 "미세 기스니까 flawed 아니고 거의 clean". v45 = flawed (display_defect 너무 aggressive?). 검토 필요.

## Trade-offs

- battery_perfect note → clean 분류 → 시세 sample 에서 normal/clean grouping. 옛 정책 (sample 제외) 폐기. 시세 평균 영향 미미 (Wave 130 condition_class grouping 으로 분리됨).
- "새상품" 단독 키워드 제거: 본체 unopened 신호인 케이스 일부 lose. 액세서리/인플레 false positive 비율 더 큼.

## 마킹된 resolution (7건)

- 334403685, 334814973, 403851792 (mint fix)
- 399098831 (POSITIVE — 상태 필터 작동 인정)
- 389833231 (cc=worn → mint와 분리)
- 377887597 (cc=worn — 외부 손상)
- 398116411 (cc=worn — description 분류 OK)
