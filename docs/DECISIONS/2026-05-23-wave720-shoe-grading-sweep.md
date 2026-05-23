# Wave 720 — 신발 grading 17K deep sweep + keyword 확장

**Date**: 2026-05-23
**Trigger**: Wave 714 신발 grading 시스템 정밀도 향상 (Task #49).
**Agent**: `ada0dfaf953be7a9b` (background, 297s)

## Sample size
- 17,107 신발 매물 (sku_id LIKE 'shoe-%', 14일, price > 50K)
- 설명 50자 이상: 11,949 (70%)
- 분석: 서버측 regex 집계 + sample 검증

## 발견 + 적용 (5 axis)

### Axis A — 사용감 (S/A 신호 216건 uncovered)
**추가 키워드** (A_WORN_1TO2):
- `시착만`, `시착 만` — 148건
- `한번도 안 신`, `한 번도 안 신`, `한번도안신` — 70건
- `신어보기만`, `신어보기만 함`, `신어 보기만` — 8건
- `집에서 시착만`, `집에서시착만` — 21건

**효과**: 13% S-cover 확장. pid 221667421 "시착만 한 제품" 40만원 → B에서 A로 정정.

### Axis B — 박스/구성품
**B_FULL 추가** (276건 박스+더스트백 결합):
- `더스트백`, `더스트 백`, `dust bag` — 388건

**B_BOX_INCLUDED 추가** (단독 신호):
- `영수증`, `인보이스`, `보증서`, `개런티 카드`, `개런티카드` — 306~102건

### Axis C — kream 신호
**C_KREAM 추가** (72건 단독 강력 S 신호):
- `크림택`, `크림 택`, `kream 택`, `kream택`

**효과**: pid 347553600 "구매후 한번도 안신은 새상품(크림택 달려있음)" → A에서 S로 정정.

### Axis D — 하자 (24~15건 새 패턴)
**D_MAJOR 추가**:
- `솔 갈림`, `솔갈림`, `솔 마모`, `솔마모`
- `밑창 닳음`, `밑창닳음`, `밑창 떨어짐`, `밑창떨어짐`
- `뒷굽닳음`, `뒷굽 닳음`
- `갑피 찢어짐`, `갑피찢어짐`

negation matcher가 "없고" 자동 처리 → "밑창 닳음 없고" 같은 표현은 차단.

### Axis E — 신발 특화
**No change** — n ≤ 7 추가 패턴 ("런 N km", "트레드밀만", "스튜디오만") 가치 미미.

## ⚠️ 추가하지 않은 키워드 (가짜 신호)

- **"쇼룸"** — 44건 중 36건 (82%)이 명품 reseller boilerplate ("쇼룸방문구매"). 실제 쇼룸 진열품 0건. **추가 시 가짜 S 다수 발생** → 추가 금지.
- **"정품감정완료"** — 우려와 달리 0건. 추가 가치 없음.
- **"100% 정품"**, **"진품"** — n=250/10. grading axis와 무관 (auth=store/kream이 더 강한 신호).

## text-sanitize.ts 보강 (Wave 720 추가)

`stripMarketingBoilerplate` 함수 강화 — 명품 reseller boilerplate line strip:
- `쇼룸 방문 구매` → `(reseller)`
- `쇼룸 진열` → `(reseller)`
- `수도권 퀵 가능` → `(reseller)`
- `당일 매입` / `오프라인 매장 운영` → `(reseller)`
- `실재고 보유중` / `모든 제품 퀵 가능` → `(reseller)`
- `컨디션 기준표` → `(reseller)`

이로써 명품 reseller boilerplate가 wear/auth axis 오염 X.

## sample mismatch (Wave 720 사례)

| pid | 시스템 grade | 실제 grade | 원인 |
|---|---|---|---|
| 221667421 | B | S/A | "시착만" 미커버 → Wave 720 fix |
| 347553600 | A | S | "크림택 달려있음" 미커버 → Wave 720 fix |
| 408683920 | B | A | "한번도 안신었어요... 270박스에 담아... 택포" → Wave 720 fix |
| 397083085 | B | C | "깔창 없지만 상태 좋아요" (n=8 low priority) → skip |

## 다음 단계 (defer 또는 별도 cycle)

1. **사이즈 표기 정밀화** (us/uk/eu vs mm 변환) — 별도 Wave 721+ 권고
2. axis E "런 N km" / "트레드밀만" — n ≤ 7, 가치 미미, skip
3. **명품 reseller boilerplate strip** — text-sanitize.ts에 적용됨 (이번 wave)

## 효과 추정

- A_WORN_1TO2 +216 hit → S/A 정밀도 13% 향상
- B_FULL +276 hit → full grading 정밀도 ↑
- C_KREAM +72 hit → S 신호 강화
- D_MAJOR + 솔/밑창 패턴 → 하자 발견율 ↑
- text-sanitize boilerplate strip → 명품 reseller 가짜 신호 차단

## 관련 commit
- Wave 720 commit (pending — shoe-axes.ts + text-sanitize.ts 변경)

## Agent 추적
- `ada0dfaf953be7a9b` — 17K 신발 sweep (297s, 24 tool_uses)
