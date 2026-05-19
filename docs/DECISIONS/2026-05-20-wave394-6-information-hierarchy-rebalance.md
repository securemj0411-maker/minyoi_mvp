# Wave 394.6 — 위계 재정렬 (외부 review #1 + #7 + #8)

날짜: 2026-05-20
영역: pack-reveal-modal RevealCardItem 본문

## 배경

외부 review 핵심 지적:
> "첫 화면 3초 안에 '사라/말아라/협상해라' 셋 중 하나가 나와야 하는데, 지금은 7스크롤 끝에서야 답이 나옴" (#1)

> "정보 구조 순서가 꼬여 있음. 현재: 상품 → 수익 → 판매처 → 정품 확인 → 협상 → FAQ → 그래프. 실제 판단 순서: 1. 사도 되나 → 2. 얼마 남나 → 3. 데이터 믿을 만? → 4. 위험? → 5. 깎기 → 6. 어디 팔까 → 7. 근거" (#7)

> "FAQ가 너무 고객센터 느낌. 셀러/가품/안전결제/사기는 부가 정보가 아니라 구매 판단의 핵심. FAQ로 숨기면 안 됨" (#8)

## 변경 (단계별 .a / .b / .c)

### Wave 394.6.a — verdict chip 헤드라인 추가 (#1)

`RevealCardItem` 차익 헤드라인 옆 (L2911+):

```diff
- (차익 큰 숫자 + 차익 % chip + 판매완료 chip)
+ (차익 큰 숫자 + 차익 % chip + verdict chip + 판매완료 chip)
```

verdictTier 계산 (buyPriceGuidance.verdict 4-tier → 3-tier 일반인 친화):
- `great` / `good` → **"매입 OK"** (emerald)
- `fair` → **"협상 권장"** (amber)
- `tight` → **"협상 필수"** (rose)
- `isMarketInvalidated` → null (판매완료 chip이 대체)

3초 결정 답 = chip 한 개.

### Wave 394.6.b — 정보 순서 swap (#7)

좌측 카드 본문 panel 순서:

```diff
  WhyCheapPanel                          (왜 싸지)
  UpperFoldFearReducers                  (위험/안전 4타일)
- CostAssurancePanel
- PlatformProfitCompare                  (채널 비교) ← 너무 일찍
- CounterfeitChecklistPanel              (가품 점검) ← 너무 아래
- WhyTrustCollapse                       (FAQ)
- SellHelperPanel                        (판매 도우미)
+ CounterfeitChecklistPanel              (위험 — 구매 결정 핵심)
+ CostAssurancePanel
+ WhyTrustCollapse                       (FAQ — 의문 해소)
+ PlatformProfitCompare                  (채널 — 판매 결정 단위로 묶음)
+ SellHelperPanel
```

논리:
- 가품/리스크 = **구매 결정** 핵심 → UpperFold 직후
- 채널 비교 = **판매 결정** → SellHelper 직전 (둘 다 "판매" 단위)

### Wave 394.6.c — FAQ → 리스크 카드 위계 (#8)

`WhyTrustCollapse`:

```diff
- useState<number | null>(null)      // 디폴트 다 접힘
+ useState<number | null>(0)          // 첫 Q (셀러 신뢰) default 펼침

- "🤔 궁금한 점이 있다면"
+ "🛡 구매 전 확인 — 자주 묻는 4가지"
```

- 첫 Q 자동 펼침 — 사용자가 클릭 안 해도 핵심 정보 보임
- 헤더 톤: 고객센터 ("궁금한 점") → 능동 ("구매 전 확인")
- 4 Q&A 자체는 그대로 (셀러/가품/안전결제/사기) — 별 wave 에서 카테고리별 가품 답 분기 (Wave 393.8 연장)

## 사이드 효과

- verdict chip = 헤드라인 우측 chip 3개 (차익 % + verdict + 판매완료) — 매물 따라 다름. 일반 매물은 차익% + verdict 2개. 부담 작음
- 정보 순서 swap = JSX 줄 위치 변경만. component 자체 안 건드림. 안전
- WhyTrustCollapse 첫 Q 펼침 = LCP 영향 거의 X (이미 client render). 정보 부담 ↑ 단 가치 직접

## 후속 (별 wave)

- **Wave 394.6.d**: WhyTrust 가품 Q 카테고리별 답 분기 (Wave 393.8 카테고리 매핑 연장 — 폰/태블릿/에어팟/신발 다른 답)
- **Wave 394.6.e**: WhyCheap + UpperFoldFearReducers 통합 시도 (더 큰 압축, 별 wave 가치 측정)

## 원칙

- 일반인 친화 (memory 룰) — 3-tier verdict (great/good/fair/tight 4-tier 안 노출)
- 사용자 판단 흐름 따름 — 구매 결정 → 판매 결정 단위 분리
- 작은 단계 박음 — JSX 순서 swap + 상태 default + 헤더 카피만. 큰 layout 변경 X
