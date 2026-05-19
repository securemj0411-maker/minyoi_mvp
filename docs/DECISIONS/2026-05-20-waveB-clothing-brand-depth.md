# Wave B — 의류 카테고리 브랜드 깊이 (외부 review #Arcteryx 직접 대응)

날짜: 2026-05-20
영역: counterfeit-checklist 보강 (clothing brand-specific)
범위: clothing (Arcteryx, Stone Island, Moncler, Supreme, Stussy, BAPE, Palace, Carhartt WIP, FOG Essentials, Patagonia, TNF, Polo Ralph Lauren, Lacoste, MLB Cap, Acne, Maison Margiela — 16 브랜드)

## 배경

Wave A (shoe) 와 동일 문제 — `WhyTrustCollapse` 가품 Q 답 + `CounterfeitChecklistPanel` 의 의류 카테고리 정보가 일반론 수준. 외부 review 인용:

> "라벨/봉제/안감 3축 확인하세요'가 너무 일반적. 아크테릭스라면:
> - Bird-aid 라벨 폰트 확인 (가품은 굵기 다름)
> - GORE-TEX 라벨 봉제 — 진품은 4면 박음질
> - 안감 시리얼 vs 외부 태그 일치 확인
> 이런 모델별 가품 체크포인트가 있어야 진짜 가치 있음."

Wave B 는 외부 review 의 **Arcteryx 예시를 그대로 구현** + 한국 중고시장 의류 가품 위험 상위 16개 브랜드 (catalog 등록 + 등록 외 다 cover).

## 변경

### 1. `mvp/src/lib/category-brand-depth.ts` — CLOTHING 블록 추가

Registry 확장:
```ts
export const CATEGORY_BRAND_DEPTH: Record<string, CategoryBrandDepth> = {
  shoe: SHOE,
  clothing: CLOTHING,   // ← Wave B 추가
};
```

UI/헬퍼 (`detectBrandDepth`) 는 Wave A 그대로 — **UI 변경 0**. 사용자가 의류 매물 reveal 받으면 자동으로 brand-specific 박스 노출.

### 2. clothing Wave B — 16 브랜드

**아웃도어 / 테크니컬 (high 위험):**
- **arcteryx** (외부 review 직접 구현):
  - **Bird-aid 라벨 (안주머니) — 새 로고 + 'BIRD AID' 폰트 굵기 균일성**
  - **GORE-TEX 라벨 봉제 — 정품 4면 박음질, 가품 2~3면만 봉제**
  - 안감 시리얼 vs 외부 행택 시리얼 일치
  - 지퍼 'WS' (Watertight Seal) 각인
  - Hanger Loop 두께
  - 행택 QR/시리얼 (`arcteryx.com/serial` 조회)
- **stoneisland** (compass 패치 + Certilogo):
  - **Certilogo 앱/사이트 코드 조회 (필수 권장)** — `certilogo.com`에서 'AUTHENTIC' 결과 캡처
  - Compass 패치 4면 봉제 + 단추 4구멍 (글루 X)
  - Shadow Project / Stellina 라인 가품 최상위
- **moncler** (DPP + Tricolor):
  - **Moncler DPP 코드 조회 (`moncler.com/dpp`)**
  - Tricolor 패치 4면 봉제
  - Lampo (이탈리아) 지퍼 각인
  - 다운 90/10 비율 표기
- **patagonia** (moderate): P-6 산 5봉우리 로고, FAIR TRADE 라벨, Retro-X / Deep Pile / Shell 사이즈감 다름
- **tnf** (high): NF 로고 곡선, Mountain Jacket GORE-TEX, **Supreme × TNF 콜라보 가품 80%+**, 한국 NF (영원아웃도어) vs USA TNF vs JP Purple Label 라벨 차이

**스트릿 (high 위험):**
- **supreme**: Box Logo **Futura Heavy Oblique 폰트**, 시즌 태그 ('F/W 18'), Box Logo Tee 가품 80%+, 한국 정식 발매 X
- **stussy**: 'S' 곡선 곡률, silkscreen 두께, 8-Ball 숫자 폰트
- **bape**: Shark Hoodie 카모 패턴, 지퍼 'BAPE' 각인, Shark face 자수 디테일, 라벨 일본어+영어 병기
- **palace**: Tri-Ferg 3D 음영, 시즌 태그 ('WINTER 21'), 한국 정식 발매 X
- **carhartt** (moderate): C 패치 4면 봉제, WIP (유럽/한국) vs Carhartt (US 워크웨어) 구분
- **fog-essentials**: 고무 'ESSENTIALS' 패치 두께, 반사 인쇄, **2022 한국 인기 폭발 후 가품 급증**

**클래식/패션 (high 위험):**
- **polo-ralph-lauren**: Pony 자수 (말 다리 + 폴로 스틱), POLO by RALPH LAUREN (구) vs POLO RALPH LAUREN (신), RRL 별도 라인 가품 위험 더 큼, Big Pony 숫자 모델, Bear 콜라보
- **lacoste**: 악어 옆모습 자수 (입 벌어진), 'L.12.12' 모델 코드, 자개 단추 'LACOSTE' 각인
- **mlb-cap**: 한국 라인 (F&F 영원아울렛) vs 미국 New Era, Gucci/Murakami/Nike 콜라보 위험

**럭셔리/디자이너 (moderate~high):**
- **acne** (moderate): Face 패치 봉제, 분홍 행택, RFID 태그
- **maison-margiela**: **Four-Stitch (흰 실 4땀)** 시그니처, **Numbers 라벨 (0~23) + 라인 동그라미** (예: '14' 동그라미 = 남성복), RIRI/Lampo 지퍼, MM6 vs Main 라인 가격대 5~10배 차

각 brand 4~6개 counterfeitChecks + 2~4개 marketRisks + 1~3개 authentication.

### 3. 테스트 — `mvp/tests/waveB-clothing-brand-depth.test.ts`

17개 케이스:
- skuId prefix 매칭 (arcteryx, bape, fog, patagonia, tnf, polo, mlb, acne)
- keyword 매칭 (supreme 한글, stussy 한글, MLB 양키스, 마르지엘라/MM6)
- **Arcteryx Bird-aid + GORE-TEX 4면 명시 확인** (외부 review 회귀 보호)
- **Stone Island Certilogo 명시 확인**
- **Supreme BOX 로고 명시 확인**
- BAPE Shark/카모 명시 확인
- TNF Supreme 콜라보 명시 확인
- Polo / RRL 둘 다 매칭 확인
- MM6 + Main 라인 둘 다 매칭 확인
- 16 브랜드 레지스트리 누락 검증
- shoe ↔ clothing 카테고리 cross-leak 방지 (skuId가 다른 카테고리로 false-match 안 되는지)

## 검증

- `npx tsx --test tests/waveA-... tests/waveB-...` — **28/28 pass** (Wave A 11 + Wave B 17)
- `npx tsc --noEmit` — 우리 파일 에러 0
- 헬퍼 (`detectBrandDepth`) 변경 X → 3화면 자동 적용:
  - `pack-reveal-modal` (`CounterfeitChecklistPanel` + `WhyTrustCollapse`) ✓
  - `user-reveal-dashboard` → `PackRevealModal` 그대로 사용 ✓
  - `admin-pool-browser` 무관 ✓

## 영향

- 의류 매물 reveal 시 brand 감지되면:
  - 헤드라인 chip: "아크테릭스 (Arcteryx)" + "가품 위험 큼" (rose)
  - 펼침: 🎯 **"아크테릭스 — 모델별 변별 포인트"** 박스 안에 "Bird-aid 라벨 폰트 굵기", "GORE-TEX 4면 박음질" 등 6개 구체 항목
  - WhyTrust 가품 Q 답: brand-specific 한 줄 + 변별 포인트 + 인증 채널
- **외부 review 비판 직접 해소** — Arcteryx Bird-aid / GORE-TEX 4면 박음질 100% 일치 구현
- Stone Island / Moncler / Supreme / FOG / TNF 등 한국 중고시장 가품 위험 최상위 브랜드 cover

## 후속 wave

- **Wave C: bag** — LV (핀스탬프), Chanel (홀로그램), Gucci, Hermes, Dior, Goyard
- **Wave D: 전자 (smartphone/tablet/laptop)** — iCloud/IMEI/부품 교체 모델별
- **Wave E: 나머지 (watch/perfume/camera/drone/earphone/smartwatch)**

각 wave 가 동일 구조 따르면 UI 변경 0.

## 메모리 룰 준수

- ✅ `project_core_principle_consumer_friendly` — "Bird-aid 라벨 폰트 굵기 균일성" 같이 사진으로 확인 가능한 직관적 표현. 전문 용어 (Cordura, ripstop 등) 회피
- ✅ `feedback_decision_log_required` — 이 파일
- ✅ `feedback_ui_changes_apply_to_all_card_screens` — Wave A 와 동일 헬퍼라 자동
- ✅ `feedback_proceed_on_clear_wins` — 명확한 정보 깊이 보강

## 위험

- **변별 포인트 정확성** — Arcteryx Bird-aid 라벨은 최근 모델 (2018+) 기준. 빈티지 모델은 라벨 위치/디자인 다를 수 있음. 사용자에게 "본인 판단 권장" 푸터 + "정품 판정 X" 표현 명시 (Wave A 와 동일).
- **brand 감지 false positive** — keyword 매칭이 "스토ンス" 같은 우연 매칭 가능. 현재는 broad keyword 위주 + skuId prefix 우선. catalog 매칭 안 된 매물은 keyword 만 사용.
- **시즌/지역 라벨 차이** — TNF (한국 영원/USA/JP Purple Label) 같이 같은 브랜드라도 라벨/가격이 다른 케이스. 변별 포인트에 "라벨 차이" 명시했지만 사용자 confusion 가능.

## 다음

1. 사용자가 의류 매물 reveal 받아 brand 깊이 정보 확인 → 정확성 피드백 수집 (특히 Arcteryx/Stone Island/Supreme — 외부 review 짚은 영역)
2. Wave C (bag) 착수 — LV/Chanel/Gucci 우선 (한국 명품 중고시장 가품 비율 최상위)
3. 정확성 보강: production sweep에서 clothing 매물 sample 검토. KREAM/Certilogo/공식 사이트 정보와 cross-check
