# Wave A — 신발 카테고리 브랜드 깊이 (counterfeit + market risk + authentication)

날짜: 2026-05-20
영역: counterfeit-checklist 보강 (brand-specific 깊이)
범위: shoe (Nike Jordan/Dunk/Air Force/Air Max/Pegasus, Adidas Yeezy/Samba/Gazelle, New Balance, Converse, Vans, UGG, Dr. Martens, Puma, Hoka, Asics — 16 브랜드)

## 배경

외부 사업 검토 인용 (직접):
> "라벨/봉제/안감 3축 확인하세요'가 너무 일반적임. 아크테릭스라면:
> - Bird-aid 라벨 폰트 확인 (가품은 굵기 다름)
> - GORE-TEX 라벨 봉제 — 진품은 4면 박음질
> - 안감 시리얼 vs 외부 태그 일치 확인
> 이런 모델별 가품 체크포인트가 있어야 진짜 가치 있음. 일반론은 구글링이 더 빠름"

사용자 직접 인용:
> "정품 확인 필요 — 명품 의류 / 명품 정품 점검 6개 / 명품 옷 가품도 흔함. 라벨/봉제/안감 시리얼 3축 확인 — 이부분 섹션에서도 필요 지금은 너무 간이식임"

Wave 90 의 `counterfeit-checklist.ts` 는 카테고리당 5~8개 정적 체크리스트 — generic 가이드. Wave 394.6.d 의 `WhyTrustCollapse` 가품 Q 답 카테고리별 분기 — 한 줄짜리 일반론. 둘 다 "구글링이 더 빠름" 수준.

**Wave A** = brand-specific 깊이 정보 (변별 포인트 / 시장 위험 / 인증 채널) 신규 추가. shoe 부터 (가품 위험 최상위 + Wave 91/134 narrow catalog 확장 후 풀 매물 多).

## 변경

### 1. 신규 파일: `mvp/src/lib/category-brand-depth.ts`

12 카테고리 → 카테고리별 brands 레지스트리 + default 폴백. Wave A 는 shoe 만 채움. 후속 wave (B clothing, C bag, D 전자, E 나머지) 가 동일 구조 따름.

```ts
export type BrandDepth = {
  detectKeywords: string[];         // 카드 텍스트에서 brand 감지 keyword
  skuIdPrefixes?: string[];         // skuId prefix (가장 정확, 우선)
  label: string;                    // UI 라벨
  counterfeitRisk: "high" | "moderate" | "low";
  counterfeitChecks: string[];      // 모델별 가품 변별 포인트
  marketRisks: string[];            // 가품 외 시장 위험 (가수분해/굽창/사이즈 등)
  authentication: string[];         // 인증/검수 가능 채널
};

export type CategoryBrandDepth = {
  category: string;
  default: Omit<BrandDepth, "detectKeywords" | "label">;
  brands: Record<string, BrandDepth>;
};
```

### 2. shoe Wave A — 16 브랜드 (가품 위험 분류)

**high (가품 흔함, 한정판 위험 ↑↑):**
- nike-jordan (Air Jordan 1/4/11) — 박스 모델 번호, Jumpman 로고, 안창 폰트, Travis Scott/Dior 콜라보 위험 명시
- nike-dunk (Dunk Low/High, SB) — 박스 코드, 스우시 곡선 끝, 솔 원형 패턴. **Panda Dunk 가품 비율 70%+ 추정** 명시.
- adidas-yeezy — Boost 솔 입자, SPLY-350 폰트, **2022 Adidas-Kanye 결별 이후 가품 최상위** 명시.
- adidas-samba — 3-stripe 간격, 토 패치 가죽 두께. 2024 인기 폭발 후 가품 급증.
- adidas-gazelle — Indoor / Bold / Classic 버전 사이즈감 다름.
- newbalance (990v5/v6/992/993/2002R/9060) — **Made in USA 라벨 차이** (해외 OEM 가격 2배 차).
- converse-chuck (Chuck 70) — 토 캡 크림색 두툼함, 사이드 라인 정확히 2줄, 사이즈 라벨 US/UK/EU 3종.
- ugg-classic — 발목 라벨 폰트, 안감 양털 통가죽 vs 조각 이어붙임. 정품 박스 갈색 + 'UGG Australia' 로고.
- drmartens-1460 — 노란 봉제선 9~10땀, AirWair 라벨, UK 사이즈 환산 주의.

**moderate (가품 가능, 변별 권장):**
- nike-airforce (Air Force 1) — AF-1 '82 각인 깊이, 가죽 모공 패턴.
- nike-airmax — 에어 유닛 투명도, 자수 글자 간격.
- vans-oldskool (Old Skool/Authentic/Sk8-Hi) — 자즈 스트라이프 균일성, 워플 솔.
- puma (Palermo/Speedcat/Suede) — 폼스트라이프 곡선.

**low (가품 거의 없음 — 마일리지/세대 확인이 더 중요):**
- nike-pegasus (러닝화) — 마일리지 500km+ 쿠셔닝 죽음, 세대(39/40/41) 다름.
- hoka (Bondi/Clifton/Speedgoat) — 마일리지 + Bondi 8/9 / Clifton 9/10 세대 확인.
- asics (Gel 시리즈) — GEL-1130 패션 라인 vs Kayano 러닝 구분.

각 brand:
- `counterfeitChecks` 3~5개 (구체 항목)
- `marketRisks` 2~3개 (가품 외 위험)
- `authentication` 1~3개 (KREAM 검수, Stockx, 매장 영수증 등)

### 3. `detectBrandDepth(category, ctx)` 헬퍼

매칭 우선순위:
1. `skuIdPrefixes` (예: `shoe-nike-jordan`) — 가장 정확
2. `detectKeywords` 매칭 (`skuName + name` lowercased) — fallback
3. null — UI 는 기존 generic 정보 사용

### 4. UI 결합 — `pack-reveal-modal.tsx`

#### A. `WhyTrustCollapse` 가품 Q 답 (Q[1])

brand 감지된 경우 brand-specific 답으로 교체:
```
이 매물은 {condition}로 분류돼요. {brandLabel} — {riskLabel}.
변별 포인트: {top2Checks}. 인증: {firstAuth}.
```

감지 실패 시 기존 카테고리별 generic 답 (Wave 394.6.d 그대로).

#### B. `CounterfeitChecklistPanel` 헤드라인 + 펼침 박스

**Collapsed (헤드라인):** brand 감지되면 두 chip 추가
- 좌: `{brandLabel}` (amber)
- 우: 가품 위험 한국어 라벨 (`high` = rose / `moderate` = amber / `low` = emerald)

**Expanded:** 기존 generic 체크리스트 **위**에 brand-specific 박스 (amber 강조)
- 🎯 `{brandLabel} — 모델별 변별 포인트` 헤더
- 가품 변별 (구체 항목) — rose dot
- 시장 위험 (가품 외) — amber dot
- 인증/검수 가능 채널 — emerald dot
- 푸터: **"미뇨이는 정품 판정 X. 직접 거래 시 셀러에게 사진/영상 요청해 본인 판단 권장"**
  - Wave 394.1 외부 review #9 가이드 그대로 — "앱이 정품 판정한다"는 오해 차단.

### 5. 3화면 일관성

- `pack-reveal-modal.tsx` — 직접 수정 ✓
- `user-reveal-dashboard.tsx` — `PackRevealModal` 직접 사용 → 자동 적용 ✓
- `admin-pool-browser.tsx` — 운영자 도구. 가품/정품 정보 표시 X. 무관 ✓

(메모리 룰 `feedback_ui_changes_apply_to_all_card_screens` — 매물 카드 가품 정보는 reveal modal + dashboard 에 박힘. admin pool은 운영자용이라 표시 정책 다름.)

## 검증

- `npx tsc --noEmit` — 신규 코드 (`category-brand-depth.ts`, `pack-reveal-modal.tsx` 변경) 에러 0. 기존 pre-existing 에러 (test fixture `released` field missing, RevealItem.firstSeenAt 등) 는 무관.
- `npx tsx --test tests/waveA-category-brand-depth.test.ts` — **11/11 pass**
  - skuId prefix 매칭 (Nike Jordan/Dunk, New Balance)
  - keyword 매칭 (Adidas Yeezy 한글, Converse Chuck 영문)
  - Hoka low-risk 분류 확인
  - brand 감지 실패 시 null (3 케이스)
  - 16 브랜드 레지스트리 누락 검증
  - default 폴백 shape

## 영향

- 사용자가 매물 reveal 받으면 — 헤드라인부터 "나이키 조던 (Air Jordan)" "가품 위험 큼" 두 chip 즉시 보임
- 펼치면 — **박스 사이드 라벨 — 모델 번호(예: 555088-063) + 컬러 + 사이즈 3종이 신발 안창과 일치**, **Jumpman 로고 — 농구공 라인 5개, 다리 각도** 같은 brand-specific 변별 포인트 노출
- WhyTrustCollapse 가품 Q (Q[1]) — brand 감지 시 generic ("KREAM 검수 권장. 안창/박스/태그/시리얼") → brand-specific ("Air Jordan — 가품 위험 큼. 변별 포인트: 박스 사이드 라벨 ...")
- "구글링이 더 빠름" 비판 해소: 구글링은 Air Jordan 변별 포인트 찾으려면 여러 영상/포스트 비교 필요. 미뇨이는 매물 모달 안에서 즉시 확인 가능.

## 후속 wave

- **Wave B (clothing)** — Supreme (BOX 로고 시즌 태그), Stussy (인쇄 톤), BAPE (카모 패턴/지퍼 각인), Arcteryx (Bird-aid 라벨, GORE-TEX 4면 박음질), Patagonia, The North Face, Loewe/Lanvin/AMI/Maison Margiela
- **Wave C (bag)** — LV (핀스탬프 위치), Chanel (홀로그램), Gucci, Hermes, Dior, Goyard
- **Wave D (전자 — smartphone/tablet/laptop)** — iCloud/IMEI 변조 / 부품 교체 모델별 확인 도구 (Apple 정품 부품 메시지 등)
- **Wave E (나머지 — watch/perfume/camera/drone/earphone/smartwatch)** — Rolex 무브먼트, Chanel 향수 박스, AirPods Pro 무게, 등

각 wave 별:
- decision log + test fixture + brand registry 확장
- 동일 구조 (`detectBrandDepth` 헬퍼 그대로 사용 — UI 변경 0)
- counterfeit-checklist.ts 의 기존 generic 체크리스트는 fallback 으로 유지

## 메모리 룰 준수

- ✅ `project_core_principle_consumer_friendly` — 일반인 친화 톤 (전문 리셀러 용어 X, "박스 사이드 라벨", "혀 안쪽 라벨" 같은 직관적 표현)
- ✅ `feedback_decision_log_required` — 이 파일
- ✅ `feedback_ui_changes_apply_to_all_card_screens` — pack-reveal-modal 직접 + user-reveal-dashboard 자동 적용. admin-pool-browser 는 표시 정책 다름 (운영자 도구)
- ✅ `feedback_proceed_on_clear_wins` — 정보 깊이 보강은 명백한 win. 사전 confirm 없이 진행

## 위험

- **데이터 정확성** — brand-specific 변별 포인트 (예: "Jumpman 로고 농구공 라인 5개") 가 모델 세대별로 다를 수 있음. 일부 미세한 디테일은 정품도 시기 차이가 있음. 사용자에게 "본인 판단 권장" 푸터 + "정품 판정 X" 표현 명시.
- **brand 감지 정확도** — keyword 매칭은 false positive 가능 (예: "조던" 이 농구화 외 영화 제목 등). 현재는 broad keyword 위주 → 후속 wave에서 mustNotContain 추가 필요 시 catalog와 동일 구조 채택.
- **외부 정보 출처** — KREAM/Stockx 변별 가이드, 한국 신발 커뮤니티 reference. 정밀 인증은 KREAM 검수에 위임.

## 다음

1. 사용자가 shoe 매물 reveal 받아 brand 깊이 정보 확인 → 정확성 피드백 수집
2. Wave B (clothing) 착수 — Supreme/Arcteryx/Stussy 우선 (외부 review 짚은 영역)
3. 정확성 보강 패턴: production sweep 에서 shoe 매물 sample → KREAM/Stockx 정보와 cross-check 후 raw_listings 에 정합성 확인
