# Wave 811 — Magic Keyboard catalog + fatal keyword 보강

- 시간: 2026-05-30 KST
- 트리거: owner — "deepsweep 으로 SKU 신설 / 파싱 강화 / 상태 표현 다 한건가? 안했으면 진행 ㄱ"

## 정직 status (Wave 811 박기 전)

### catalog 신설 (Wave 809) 박힘 — but Tier A 누락
- Wave 809: 9 SKU (LEGO/Switch 게임/골프 3/AirPods 4 2/Dyson V8·V10)
- Wave 808 Tier A: 신발 누락 (이지부스트/삼바/슈퍼스타/가젤) 실제로는 **이미 catalog 박혀있음** (Wave 712c/133/138)
  - sample 매물 unmatched 인 이유 = 콜라보/시즌 변형이 mustNotContain 걸린 거 (별도 audit)
- 갤버즈 2/2 Pro/3/3 Pro 도 **이미 박혀있음** (catalog.ts:6782+)
- 진짜 누락 = **Apple Magic Keyboard** (없음)

### 파싱 강화 — 안 박혀있음 (이번 wave 박음)
- `FATAL_LISTING_KEYWORDS` 기존 12개 → 30+개 확장
- `INCOMPLETE_AIRPODS_KEYWORDS` 변형 보강

### 상태 표현 — Wave 802 박힌 거 외 추가 미박힘
- 박힌 거: tier badge / class label / chips / flags / 분석 신뢰도
- 안 박힌 거: 가품 의심 시그널 (FATAL hit 시), 풀박/미개봉/한정판 별도 표시
- → 별도 wave 권장 (작업 크고 UI 변경 큼)

## 변경

### A. Apple Magic Keyboard narrow (신규 파일)

`src/lib/generated/catalog-wave811-magic-keyboard.ts`:
- `tablet-magic-keyboard-ipad-11` (11" iPad Air/Pro 용, msrp 449K)
- `tablet-magic-keyboard-ipad-13` (12.9"/13" iPad Pro/Air 용, msrp 519K)

호환품 차단 (`COMPAT_BRAND_NOISE`):
- AITEWO / Nimin / HOU / 니케 / Logitech / Logi / Ainope / ESR / WIWU / Fintie / Baseus / Xiaomi
- 일반 키워드: "호환", "compatible", "compat", "타사 호환", "키보드 케이스"

근거: Wave 808 sample 호환품 50% (정품 ₩150K vs Nimin ₩45K, AITEWO ₩80K).

### B. Fatal keyword 확장 (`src/lib/profit.ts`)

기존 (12개):
- 타오바오, 짭, 가품, 짝퉁, 레플, 레플리카, 이미테이션, 정품아님, 비정품

추가 (18+개):
- 가품 표현: 짭짤, 짭품, 짝뚱, repl, imitation, 정품아니, 미러, mirror, 1:1, 1대1 quality, 퀄리티, quality, 퀄, 디테일급, 오버런, overrun, 도배
- 파손: 벽돌, 벽돌됨, 벽돌화, 배터리 부풀음/부풀, 디스플레이 깨짐, 액정 깨짐, 메인보드 고장/만, 보드만, 기판만, 기판 부품, 내부 파손
- 리퍼: 리퍼비시, refurbished, refurb
- 매입글: 삽니다, 구합니다, 구매, 구매합니다, 매입, 매입가
- 부품: 부품만, 부품 판매, 부품용

### C. INCOMPLETE_AIRPODS_KEYWORDS 확장

추가 변형:
- L 유닛 / R 유닛 / l유닛 / r유닛
- left only / right only
- 왼쪽만 / 오른쪽만 / 좌만 / 우만
- 케이스만 / 충전 케이스만 / 본체만 / 배터리만

## DB rematch

```
매칭 가능 매물: 656건 (매직 키보드 + 새 fatal keyword)
이미 parsed row 있던 거 reset: 14건
나머지 642건은 cron 새 분류 시 자연 잡힘
```

## Follow-up

### Wave 808 Tier A "신발 누락" 실제 진단 필요
- Wave 808 sample 의 "이지부스트 350 V2 샌드 토프" / "삼바 비건 블랙" / "슈퍼스타 디즈니 덤보" / "가젤 인도어 핑크" 모두 catalog 박혀있는데도 sku_id NULL
- 원인 추정: 콜라보/시즌 variant 가 mustNotContain 에 걸려서 false negative
- 별도 wave — production sample sweep 으로 mustNotContain 정확도 audit

### 상태 표현 — 별도 wave
- 가품 의심 시그널 UI badge (FATAL hit 시 빨강 경고)
- 풀박/미개봉/한정판 시그널 (현재 condition_tier 와 별도)
- /lookup + pack-reveal-modal + admin-pool-browser 3 surface 동시 적용

### Wave 810c — 시세 cron 표본 떨어진 root cause
- 폴로 어제 28건 (high) → 오늘 5건 (low) = cron 의심
- 다른 SKU 도 같은 패턴 가능성
- 별도 wave 검토 필요
