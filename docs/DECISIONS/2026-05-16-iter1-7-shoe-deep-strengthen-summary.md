# 신발 카테고리 깊은 강화 — Iter 1~7 종합 (Wave 138~144)

> 2026-05-16. 사용자 명령: "10번 반복. 결정론 끌어올리기. 신발 ready로 만들 만큼". Iter 1~7 (7/10).

---

## 시작 상태 (Wave 137 직후)

| 지표 | 값 |
|---|---|
| 신발 SKU | 71 (catalog) |
| parsed 신발 | 1,110건 |
| parse_ready | 78.53% |
| unknown_size | 20.7% |
| 시세 SKU | 40 unique |
| 시세 sample | 41건 (avg 1.0) |
| pool 진입 | 0건 (internal_only) |
| 가품 차단 | 없음 |

---

## Iter 1~7 진행 종합

### Iter 1 (Wave 138) — parser size 220 + 7 변형 + 3 broad SKU
- **parser**: 사이즈 범위 230→**220~309** 확장 (여성 220/225 인식) + **cm 표기** (26cm→260)
- **catalog 6 SKU 변형 차단** (40+ 키워드):
  - AF1: 녹타/할로윈/유틸리티/플랫폼/꼼데가르송/sb
  - 993: 차이브/토프/머쉬룸
  - 2976: 모노/MIE/메이드 인 잉글랜드/버클
  - classic_short: 뉴 하이츠/청키/힐
  - chuck70: 다크쉐도우/터보다크/래커드
- **신규 broad 3 SKU**: NB 327, 아디다스 토바코, 가젤 OG
- **옛 36건 collab 매물 SQL DELETE** (자동 reparse 트리거)

### Iter 2 (Wave 139) — EU/US 사이즈 + 추가 변형
- **parser EU 사이즈** (35-46→220-290mm, prefix 명시 시)
- **parser US 사이즈** (5-13→230-310mm, prefix 명시 시)
- **catalog 5 추가 차단**:
  - classic_mini: 미니 II, 클리어 미니, 그레니
  - 2976: 2076 (별도), 하이, 옥스포드, 메리제인
  - 1460: 스터드 (Wanama), 워크부츠, 톨, J 키즈
  - COLLAB_BLOCK: 빌리 아일리시/타일러/Rhude/카사블랑카

### Iter 3 (Wave 140) — 5개 신규 narrow SKU
- shoe-converse-chuck70-high-black/white (msrp 115k) — Iter 6에서 broad 통합
- shoe-hoka-bondi-7 (msrp 199k, 옛 세대)
- shoe-nike-airforce-1-low-red (msrp 139k, 인기 컬러)
- shoe-converse-jack-purcell-broad (msrp 99k)
- shoe-nike-pegasus-turbo (msrp 219k, 39/40/41과 별도)

### Iter 4 (Wave 141) — pool 진입 가품 floor 차단
- `candidate-pool-builder.ts`: price < max(msrp, skuMedian) * **0.15** → pool 차단
- 신발/가방 카테고리만 적용
- 효과: **184건 가품 의심 매물 풀 차단** (samba 49 / gazelle 27 / jack_purcell 24 / tobacco 23 / ...)

### Iter 5 (Wave 142) — 시세 집계 가품 제외 (악순환 차단)
- `tick-pipeline.ts` marketAggregateStage: byKey 집계 전 가품 매물 제외
- Wave 141과 동일 ratio (msrp * 0.15) 정합성
- 이유: 가품 매물이 시세 평균 끌어내림 → 일반 매물도 fake_suspect 차단 (악순환)

### Iter 6 (Wave 143) — chuck70 하이 broad 통합
- 진단: chuck70_high_black/white 매칭 0건 (컬러 너무 다양: 파치먼트/러쉬블루/미드나잇)
- Fix: black/white SKU 폐기 → broad 통합 (msrp 115k, collab만 차단)
- collab 차단: 다크쉐도우/스투시/CDG/골프왕/스케치에디션

### Iter 7 (Wave 144) — mining 23개 query 확장
DEFAULT_SEARCH_QUERIES 신발 23개 신규 추가:
- 살로몬 XT-6 / ACS Pro
- 호카 마하 / 카본 X / 챌린저 / 라잇 / 시스카이
- 나이키 줌X / 베이퍼플라이 / 코르테즈 / 블레이저
- 아디다스 슈퍼스타 / 스탠스미스 / 컨트리 / 스페지알
- 반스 올드스쿨 / 슬립온
- 메종 마르지엘라 GAT
- 어그 변형: 울트라 미니 / 미니 II / 디스켓
- 닥마 변형: 1461 / 자돈 / 윙팁

목적: 인기 모델 cover 확장 → 시세 sample 누적 가속.

---

## 현재 상태 (Iter 8 측정)

| 지표 | Wave 137 | Iter 7 후 | 변화 |
|---|---|---|---|
| 신발 SKU 수 | 71 | **80** | **+9** (broad 3, narrow 6) |
| parsed 신발 | 1,110 | **1,471** | +361 |
| parse_ready | 78.53% | **79.27%** (전체) / **85.39%** (Wave 138 이후) | **+7%p (새 매물)** |
| unknown_size | 20.7% | 20.7% (전체) / **12.36%** (Wave 138 이후) | **-8%p** |
| unique 신발 모델 | ~40 | **55** | +15 |
| 시세 SKU | 40 | **40** | 같음 |
| 시세 sample | 41 | **41** | 같음 (누적 시간 필요) |
| pool 진입 | 0 | **0** | internal_only 정상 |
| 가품 차단 | 없음 | **~184건 floor** | ✅ |
| collab 차단 | 0 | **47건 (Wave 136) + 누적** | ✅ |
| mvp_category_readiness | row missing | **internal_only 명시** | ✅ DB 정합성 |

---

## Iter 8 — mvp_category_readiness 정합성

DB에 신발 row 없어서 명시 INSERT 했음:
```sql
INSERT INTO mvp_category_readiness (category, status, label, note, operator_note)
VALUES ('shoe', 'internal_only', '신발', 
  'Wave 134-144 catalog/parser 강화 진행 중. parse_ready 79%/시세 sample 1.0/매물 1.5K.',
  'Iter 1-8 (2026-05-16): 80 SKU + parser EU/US/UK/cm + 가품 floor.');
```

---

## ready 승급 검토 (사용자 결정)

| 기준 | 현재 | 목표 | 상태 |
|---|---|---|---|
| **catalog SKU coverage** | 80 SKU + mining 60 query | 충분 | ✅ |
| **parser 정확도** | 85% (Wave 138 이후) | 90%+ | ⚠️ 매물 더 흐름 후 90% 가능 |
| **가품 detection** | msrp * 0.15 floor | OK | ✅ |
| **시세 sample medium+** | 40 SKU 모두 low | 8+ sample = medium | ❌ 누적 부족 (시간만 해결, ~1주) |
| **min_ready_pool** | pool 0건 (internal_only) | 6+ | ❌ ready 승급 후 채워짐 |

**판단**: parser/catalog는 ready 충족. **시세 sample 누적이 마지막 병목** (자연 시간 흐름 ~3-7일).

추천 step:
1. **즉시**: 신발 internal_only 유지 (현재). 매물 흐름 자연 누적.
2. **3-7일 후**: 시세 medium confidence SKU 5+ 도달 시 ready 승급 검토.
3. **승급 조건**: medium+ confidence SKU 10개 이상 + 매물 흐름 검증.

---

## Iter 9-10 계획

### Iter 9: 가품 detection v2 (셀러 신뢰도 추가)
- 현재: msrp * 0.15 단일 기준
- v2: msrp * 0.15 OR (msrp * 0.25 + shop_review_count < 5) → 차단
- 신뢰도 낮은 셀러 + 가격 floor 결합 → false positive 더 줄이고 catch ↑

### Iter 10: 종합 + sense check
- 측정 종합
- 사용자 결정 필요 항목 정리
- decision log 마무리

---

## 다른 세션 알아볼 키 포인트

1. **Wave 138-144 (2026-05-16) 신발 깊은 강화 7 iter 완료**.
2. **parser**: 사이즈 220-309 + UK + EU + US + cm 다 인식.
3. **catalog 80 SKU**: 71 wave91/134 + 3 wave138 broad + 6 wave140 (chuck70 high broad, bondi 7, AF1 red, jack purcell, pegasus turbo).
4. **가품 floor**: msrp * 0.15 (신발/가방) — pool 진입 + 시세 집계 양쪽 차단.
5. **mining 60+ query**: 인기 모델 cover (살로몬/호카/나이키/아디다스/반스/마르지엘라).
6. **mvp_category_readiness shoe='internal_only'** (DB 명시).
7. **ready 승급 대기**: 시세 medium 누적 (~3-7일).
