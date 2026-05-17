# Catalog SKU Audit (2026-05-17, 업데이트 v2)

> 사용자 지적 반영:
> - **9년 정책** (2017 이전 출시 제거). 2017+ 모델 모두 유지.
> - **빈 모델 전수 식별** — catalog가 체계적 mining 결과가 아니라 사람이 콕 집어 만든 거. 빈 모델 많음.

---

## A. 9년 초과 제거 후보 (2017 이전 = 9년+) — 자율 제거

| SKU | 출시 | 나이 |
|---|---|---:|
| iphone-se | 2016.3 | 10년 |
| macbook-pro-13-2013 | 2013 | 13년 |
| macbook-pro-13-2015 | 2015 | 11년 |
| macbook-air-13-2015 | 2015 | 11년 |
| macbook-pro-13-2016 | 2016 | 10년 |
| speaker-bose-soundlink-mini-ii | 2015 | 11년 |
| camera-sony-a5100 | 2014.8 | 12년 |
| camera-canon-eos-6d | 2012.11 | 13.5년 |

**제거 8개**. 나머지 (sony-wh-1000xm3 2018.9 = 7.7년, applewatch-series3 2017.9 = 8.7년, macbook-pro 2017/2018 등)는 **9년 이내**라 **유지**.

---

## B. Catalog 빈 모델 전수 — 9년 이내 출시 + 매물 자주 나오는 모델

### smartphone — 빈 모델 (현재 catalog에 없음)

**iPhone 일반 (Pro 아닌)**:
- ❌ iphone-12 (2020.10) — 매물 많음
- ❌ iphone-13 (2021.9) — 매물 매우 많음 (broad sku 외 모델 row 자체 없음)
- ❌ iphone-14 (2022.9) — 매물 많음
- ❌ iphone-15 (2023.9) — 매물 많음 (자급제 256-self만 있고 broad 없음)
- ❌ iphone-16 (2024.9) — 매물 많음 (자급제 256-self만 있음, broad 없음)
- ❌ iphone-12-pro 일반 (현재 -128-self만)
- ❌ iphone-13-plus / iphone-13-pro-max-self
- ❌ iphone-15-pro (broader, 자급제 외) — 자급제 128-self/256-self만 있고 broader sku 없음

**Galaxy S 일반 (Ultra 아닌)**:
- ❌ galaxy-s20 / s20-plus / s20-ultra (2020.2) — 9년 이내, 매물 다수
- ❌ galaxy-s23 (일반, 2023.2) — 현재 plus, ultra만
- ❌ galaxy-s24 (일반, 2024.1) — 현재 ultra만
- ❌ galaxy-s24-plus

**Galaxy Note**:
- ❌ galaxy-note-9 (2018.8) — 7.7년, 9년 정책상 OK
- ❌ galaxy-note-10 / note-10-plus (2019.8) — 6.8년
- ❌ galaxy-note-20-ultra (2020.8) — 현재 note20만, ultra 빠짐

**Galaxy A 시리즈 (중급 — 매물 많지만 SKU 0)**:
- ❌ galaxy-a시리즈 (A 7x, A 5x 등) — 전부 누락. 단 중급이라 차익 적을 수도. 우선순위 낮음

**Galaxy Z 시리즈**:
- ❌ galaxy-z-flip-3 (2021.8) — 4.7년
- ❌ galaxy-z-fold-3 (2021.8) — 4.7년

### tablet — 빈 모델

**iPad**:
- ❌ ipad-air-4 (2020.10) — 5.6년
- ❌ ipad-air-5 (M1, 2022.3) — 4.2년 — 매물 많음
- ❌ ipad-mini-5 (2019.3) — 7.2년
- ❌ ipad-mini-6 (A15, 2021.9) — 4.7년 — **매물 매우 많음 (Wave 179b iPad mini 6 사건 기억!)**
- ❌ ipad-7 (2019.9) / ipad-8 (2020.9) — 9년 이내
- ❌ ipad-pro-11-m1 (2021.4)
- ❌ ipad-pro-12-9-m1 (2021.4)
- ❌ ipad-pro-12-9-m2 (2022.10) — Pro 13 M2 있는데 12.9 정확히 박힘 필요

**Galaxy Tab**:
- ❌ galaxy-tab-s7 / s7-plus / s7-fe (2020.8) — 5.8년
- ❌ galaxy-tab-active 시리즈 — 산업용, 우선순위 낮음

### laptop — 빈 모델 (가장 큰 누수!)

**MacBook 누락 (가장 인기 + 핵심)**:
- ❌ **macbook-air-m1-13 (2020.11)** — 가장 인기 매물! 5.6년
- ❌ macbook-pro-13-m1 (2020.11) — 5.6년
- ❌ macbook-pro-13-m2 (2022.6) — 3.9년 (M2 Air만 있음)
- ❌ **macbook-pro-14-m1-pro / m1-max (2021.10)** — 4.6년 인기
- ❌ **macbook-pro-14-m2-pro / m2-max (2023.1)** — 3.3년
- ❌ macbook-pro-14-m4-pro / m4-max (2024.11)
- ❌ macbook-pro-16-m1-pro / m1-max (2021.10) — 4.6년 인기
- ❌ macbook-pro-16-m2-pro / m2-max (2023.1)
- ❌ macbook-pro-16-m3-pro / m3-max (2023.11)
- ❌ macbook-pro-16-m4-pro / m4-max (2024.11)
- ❌ macbook-air-m4-15 (2025.3) — 15" 누락 (13"만)
- ❌ macbook-air-m3-15 (2024.3)
- ❌ macbook-air-m2-15 (2023.6)

**LG Gram**:
- ❌ lg-gram-14/15/16 다른 size (현재 17 2024만)
- ❌ lg-gram-2023 / 2025 다른 year
- ❌ lg-gram-pro 시리즈

**Galaxy Book** (0 SKU!):
- ❌ galaxy-book-4 (2024.1)
- ❌ galaxy-book-4-pro / pro-360 (2024.1)
- ❌ galaxy-book-4-ultra (2024.1)
- ❌ galaxy-book-5 (2025.3)
- ❌ galaxy-book-3 시리즈 (2023.2)

**기타 (한국 시장 인기)**:
- ❌ lenovo-thinkpad 시리즈 — 기업/개발자 매물
- ❌ asus-rog 시리즈 — 게이밍
- ❌ msi-creator 시리즈
- ❌ hp-spectre / hp-omen

### smartwatch — 빈 모델

- ❌ galaxy-watch-3 (2020.8) — 5.8년
- ❌ galaxy-watch-active-2 (2019.9) — 6.7년
- ❌ galaxy-watch-fe (2024.8) — 신모델
- ❌ applewatch-series6-hermes / series9-hermes (현재 8, 10만)
- ❌ Garmin / 가민 — 0 SKU

### earphone — 빈 모델

- ❌ sony-linkbuds / linkbuds-s / linkbuds-fit (2022~2024) — 매물 다수
- ❌ bose-qc-earbuds-ii (2022.9) — Ultra Earbuds 전 세대
- ❌ bose-700-headphones (2019.5) — 6.5년 인기 모델
- ❌ apple-earpods (USB-C, 2023) — 마이너
- ❌ jbl-tour-one-m2 / tune 시리즈
- ❌ sennheiser-momentum 시리즈

### monitor / speaker / camera / desktop 등

- 핵심 누락 없음 (이미 sparse) — 단 일반 매물 적어서 우선순위 낮음

### 새 카테고리 (catalog 0개)

- ❌ **bag** (parsed 410/24h, SKU 0!) — 큰 누수
- ❌ **bike** (parsed 79/24h, SKU 0)

---

## C. 중복 + Broad SKU 정리

### 중복
- `bose-qc45` vs `bose-qc45-headphones` — 같은 제품. **bose-qc45-headphones 제거** (더 짧은 id 유지)

### Broad SKU (세대/옵션 미정 — 정확성 손해)
- `ipad-pro` — 세대 mix. narrow lane (m2/m4)만 있으면 폐기 가능
- `ipad-air` — 세대 mix
- `ipad-mini` — narrow lane (mini-7)으로 대체
- `iphone-air` — 새 모델 (broad 의도?) 그대로 둠
- `magic-keyboard-ipad` — 액세서리. **catalog에서 제거** (mvp_listing_parsed.category=null로 잡아도 됨)

---

## D. 처리 plan (자율 진행)

### Phase 1: 9년 초과 제거 + 명백 중복/액세서리 정리

제거 대상 (10개):
- iphone-se
- macbook-pro-13-2013/2015/2016 (3개)
- macbook-air-13-2015
- speaker-bose-soundlink-mini-ii
- camera-sony-a5100 / canon-eos-6d (2개)
- bose-qc45-headphones (중복)
- magic-keyboard-ipad (액세서리)

### Phase 2: 핵심 누락 추가 (단계별)

**우선순위 1 (매물 supply 가장 큼, 사용자 가치 큼)**:
1. **iPhone 일반 시리즈** (12/13/14/15/16) — 5개 + 자급제 변형. 풀 큰 회복.
2. **MacBook Air M1 13"** — Apple Silicon 가장 인기.
3. **iPad mini 6 (A15)** — Wave 179b에서 사고 났던 모델 — narrow lane 추가.
4. **iPad Air 5 (M1)** — 매물 많음.

**우선순위 2**:
5. **Galaxy S20/S23/S24 일반** — Ultra 외 일반/Plus.
6. **MacBook Pro 14/16 M1/M2/M3/M4 Pro/Max** — 거대한 그룹.
7. **Galaxy Book 4 / 4 Pro / 5** — 새 카테고리.
8. **LG Gram 다른 size/year**.

**우선순위 3**:
9. Galaxy Z Flip/Fold 3
10. Galaxy Watch 3 / Active 2
11. Sony LinkBuds 시리즈
12. Bose 700 / QC Earbuds II

**우선순위 4 — 새 카테고리**:
13. **bag** narrow lane (루이비통 네버풀, 샤넬 클래식, 고야르 생루이 등)
14. **bike** narrow lane (시마노, 트렉 등)

### Phase 3: base option fallback 박기 (Wave 182)
- catalog 정비 후 baseOptions 필드 추가
- option-parser base fallback 로직
- UI 3화면 "기본 옵션 가정" 표시
- LAUNCH_PLAN.md §12b update

---

## E. 다음 commit 단위

각 commit별 영향 작게 분할:
1. **Phase 1 (제거 10개 + 중복/액세서리 정리)** — 1 commit
2. **iPhone 일반 시리즈 추가 (12/13/14/15/16)** — 1 commit
3. **MacBook Apple Silicon 핵심 누락 추가** — 1 commit
4. **iPad mini 6 + iPad Air 5 narrow lane 추가** — 1 commit
5. **Galaxy S20/23/24 일반 + Plus 추가** — 1 commit
6. **MacBook Pro 14/16 M-series 추가** — 1 commit
7. **Galaxy Book 시리즈 새로 추가** — 1 commit
8. **(별도 wave) bag/bike 새 카테고리** — owner decision pending
9. **(별도 wave) base option fallback (Wave 182 Phase 2)** — 모든 catalog 정비 후

자, Phase 1부터 진행.
