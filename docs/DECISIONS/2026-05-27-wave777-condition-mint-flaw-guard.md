# Wave 777 — Condition mint + flaw keyword pool guard (사용자 신뢰 fix)

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "나이키 에어맥스 90 테라스케이프 (이염있는데 A급 분류). 이거 왜 이염있다는데 A급으로 분류된거임??"

## 발견

pid 9002566589675 (나이키 에어맥스 90 테라스케이프):
- description: "...실제로보시면 새상품급 컨디션인데 보관하고 보니 사진에 나와있는 약간의 이염있어서 저렴하게 판매..."
- **condition_class: mint, condition_tier: A** (잘못)

DB 진단: 동일 패턴 ready 매물 **15건** (14 SKU). 
Sample 검증 (5건 중):
- 진짜 본체 flaw: 2건 (파타고니아 "미세 오염", 푸마 "가죽 변색")
- 박스만 flaw: 2건 (이지 500/이지 퀀텀 "박스 얼룩")
- 확인 불가 (desc 잘림): 1건

근본 원인: `wave92-fashion-mobility.ts` line 84-110 에 `이염`/`오염` 키워드 박혀있음에도 a_grade decision logic 이 일부 매물에서 negative signal 무시. parser bug — root fix는 별도 wave.

## 변경 — Safety net (parser root fix는 별도 wave)

### `src/lib/candidate-pool-builder.ts` (line 624 후 guard 추가)
```ts
const parsedRow = input.parsedByPid.get(pid);
const conditionClass = parsedRow?.condition_class;
if (conditionClass === "mint" || conditionClass === "unopened") {
  const descTxt = row.descriptionPreview || "";
  const flawWithoutNegation = /(?<!\s)(이염|얼룩|오염|변색|찍힘|흠집|스크래치|기스|마모)(?!\s*(?:없|x|X|아닙|아니|제로))/u;
  if (flawWithoutNegation.test(descTxt)) {
    skipped += 1;
    invalidations.push({ pid, reason: "mint_with_flaw_keyword_wave777" });
    continue;
  }
}
```

### DB UPDATE — 현재 ready 15건 즉시 invalidate
```sql
update mvp_candidate_pool set status='invalidated',
  invalidated_reason='Wave 777: mint/unopened with flaw keyword in description'
where status='ready' and pid in (15 pids found by query);
```

15건 PIDs: 395811772, 324259843, 364435809, 347271826, 7001644044132, 373759670, 9002566589675, 322531328, 324943190, 410551038, 318195326, 9002469060556, 332929692, 399463764, 397398210

## Trade-off

- ✅ **사용자 신뢰 보호** — 본체 flaw 매물 추천 차단
- ⚠️ **Recall loss** — 박스만 flaw 매물 (본체 OK) 도 차단됨 (precision 우선 원칙, LAUNCH_PLAN §12b)
- ⚠️ **Root fix 아님** — wave92 parser bug 그대로. 다른 매물 잘못 분류 시 같은 guard 가 catch

## 검증

- `npx tsc --noEmit` 0 에러
- DB UPDATE: 15/15 row affected

## 다음 — Wave 778 후보 (parser root fix)

- `wave92-fashion-mobility.ts` hasASignal logic 보강:
  - body vs box context-aware (예: "박스에 얼룩" → keep a_grade, "본체에 변색" → c_grade)
  - 또는 단순 conservative: flaw 키워드 발견 시 무조건 c_grade 강제
- parser version bump → 전 매물 재파싱 (큰 작업)
