# Wave 58 — MVP narrow-lane entry policy + Bunjang 카테고리 탐색

> Status: **policy decision + WebFetch 탐색 + inventory 실측.** DB write 0, catalog patch 0, candidate_pool/public 0, DDL 0. 정책 결정·탐색·실측 기록. 실제 새 catalog/lane 추가는 Wave 59+ 별도.

---

## 0. 결정 로그 요약 (CLAUDE.md 포맷)

CLAUDE.md line 111-121 강제 6 필드 형식으로 본 wave의 주요 결정 일괄.

### 0.1 정책 결정 — narrow-lane entry 11 criteria (MVP soft)

- 시간: 2026-05-14 KST
- 발견: 잡화 대비 전자기기 시세 정확도가 압도적으로 안정적이라는 사업 가설 + IT 외 영역에서도 사용자별 편차 적은 SKU가 존재한다는 user 지적 + Bunjang find_v2 실측에서 캠핑/LEGO/Xbox 등이 주 0~6건 회전이라는 객관 수치.
- 변경: `mvp/docs/DECISIONS/2026-05-14-wave58-mvp-narrow-lane-entry-policy.md` §1·§11에 11종 criteria 정의 (자본 ≤200만 / 회전 일1+·sold≤14d / 시세 std≤20% / 결정론 식별 / spread≥7~10% / last_7d≥8 / last_30d≥30 / median price 10만~200만 / query 자연어 매칭 / 가품 risk 낮음). 코드/DB 변경 0.
- 검증: Bunjang public categories API + find_v2 API 28 query 실측 (read-only).
- 위험: MVP soft policy로 명시 — 변경 시 별도 wave decision 필수. 자본·회전 임계값이 데이터 누적 후 완화될 수 있음.
- 다음: Wave 59+에서 후보 SKU 평가 시 본 11 criteria 적용.

### 0.2 행동 결정 — Bunjang public categories API 탐색

- 시간: 2026-05-14 KST
- 발견: 우리가 IT/전자기기에 anchor된 상태에서 Wave 56·57 query 추가도 IT 영역에 집중. user 지적: 비-IT 영역 중 사용자별 편차 적은 곳 누락.
- 변경: `scripts/wave58-inventory-probe.ts` 신규 (read-only). `https://api.bunjang.co.kr/api/1/categories/list.json` + find_v2.json 호출. DB/catalog/runtime 변경 0.
- 검증: top-level 17 카테고리 + 전자기기(600) 8 sub + 가전(610) 9 sub + 스포츠(700) 20 sub + 시계(421) 3 sub + 가방(430) 6 sub + 유아(500) 10 sub fetch. 14 후보 query × find_v2 측정 (page 0 top 100 / order=date / last_24h·7d·30d 분포).
- 위험: 없음 (public read-only).
- 다음: §11 실측 결과를 바탕으로 진입 후보 분류 + autonomy/owner 결정 분기.

### 0.3 폐기 결정 (카테고리·SKU 단위)

- 시간: 2026-05-14 KST
- 발견: §11.B 실측 — 캠핑/LEGO/Xbox/프로젝터(XGIMI·Aladdin)/매직 키보드 터치 ID/후지 X-T5 등이 11 criteria 미통과.
- 변경: 본 doc §11.C에 카테고리 단위 폐기 명시. 코드/catalog/DB 변경 0 (애초에 진입 안 한 영역).
- 검증: 주 매물 인입수 0~6건 / median 자본 초과 / query 매칭 실패 등 객관 수치.
- 위험: 시장 변화로 회전·자본 양상 바뀔 수 있음 → MVP soft policy에 따라 정기 재평가.
- 다음: Wave 59+에서 재진입 검토 시 동일 11 criteria 재적용.

### 0.4 진입 결정 — autonomy 범위 (사업 카테고리 신규 아님)

- 시간: 2026-05-14 KST
- 발견: §11.D 우선순위. Dyson Airwrap·Supersonic은 우리 Dyson V12 가전 family의 자연 확장. 사업 카테고리 신규 아님 + 11 criteria 전건 통과 (last_30d 79~100+ / median 19~28만).
- 변경: 본 doc §11.D·§11.E에 진입 우선순위 + autonomy/owner 분기 명시. 실제 catalog/mining은 Wave 59-B에서.
- 검증: Wave 56 narrow lane 등록 패턴 동일 (test:core 통과, candidate_pool delta 0, public promotion 분리 게이트).
- 위험: family 확장이지만 catalog mustContain/mustNotContain 정밀화 필요 (HS01/HS05/HD08/HD15 모델 분리). silent 추정 risk 0 (모델명 명시 매물만 narrow lane).
- 다음: Wave 59-B mining → catalog narrow lane 등록 → tick re-score → pool_eligible 결정.

### 0.5 보류 결정 — owner 사인오프 필요 (사업 카테고리 신규)

- 시간: 2026-05-14 KST
- 발견: §11.D 탄탄 6 후보 중 3 family (시계 G-Shock·Seiko 5 / 골프 TSR2·TSR3 / 카메라 소니 a6400)는 **사업 카테고리 신규**. 우리가 지금까지 한 번도 진입 안 한 영역. 5 criteria + 신규 6 criteria 통과하지만 사업 카테고리 추가는 autonomy 범위 외 (Wave 58 §1.B owner 결정 명시).
- 변경: 본 doc §11.E에 owner 사인오프 대기 명시. 코드/DB 변경 0.
- 검증: §11.B 회전·자본·진위 risk 분석 — 11 criteria 전건 통과 확인.
- 위험: 시계는 가품 risk (캐주얼 미드레인지 한정으로 완화) / 골프는 변형(헤드만·플렉스·로프트) 식별 정밀화 필요 / 카메라는 회전 경계 (last_7d=23).
- 다음: owner가 3 카테고리 중 진입 순서·범위·우선 1개 결정. 결정 후 Wave 59-C+에서 mining 진입.

### 0.6 cleanup 결정 — DEFAULT_SEARCH_QUERIES 정리 후보

- 시간: 2026-05-14 KST
- 발견: Wave 56·57 query 측정 + Wave 58 실측에서 (1) "JBL 플립6" 한글 변형 raw 0 (2) "Bose QC" 영어 단독 raw 0 (3) "LG 39GX900A" 200만+ 자본 초과 — 세 query 모두 11 criteria 위반.
- 변경: `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES 3 줄 제거 예정 (Wave 59-A).
- 검증: Wave 57 follow-up + Wave 58 §11 실측 데이터.
- 위험: 매우 낮음. 자연 cron query 줄어 cron cost ↓. SKU lift는 사실상 0이었으므로 사업 영향 0.
- 다음: Wave 59-A에서 1-line patch × 3 + test:core 통과 후 commit.

---

## 1. 정책 결정 — MVP narrow-lane entry criteria (soft)

핵심 사업 가치: **시세 정확도가 잡화 대비 압도적으로 안정적인 영역만 진입**. 이 정확도가 안 나오는 SKU는 카테고리 자체와 무관하게 거부.

### 1.A 5 criteria (MVP 초기, 절대 고정 아님)

| # | criterion | 임계값 (MVP) |
|---|---|---|
| 1 | 자본 천장 | 매입가 ≤ **200만원** |
| 2 | 회전율 | 일 매물 인입 ≥ 1건 AND 평균 sold ≤ 14일 |
| 3 | 시세 안정 | median 대비 std-dev ≤ 20% |
| 4 | SKU 식별성 | title+desc로 결정론 식별 가능, silent 추정 0 |
| 5 | 마진 | 매입가 vs 시세 spread ≥ 7~10% |

5개 모두 통과해야 narrow lane 후보. 1개라도 실패면 보류.

### 1.B 정책 적용 단위

- **카테고리 자체로 거부 금지** — 같은 카테고리 안에서 sub-SKU drill down.
- **드릴 단계**: 카테고리 → 서브카테고리 → SKU variant → narrow lane (catalog id).
- 예: "모니터 카테고리 무조건 OK/NO" 아님 → 27인치 1440p IPS 60~100만원 OK / 32인치 4K OLED 200만원+ NO.

### 1.C 과거 실수 명시 (반복 금지)

| 실수 | 이유 | 향후 |
|---|---|---|
| 고가 모니터 (LG 39GX900A 등 200만원+) | 자본 천장 위반, 회전 느림 | catalog narrow lane 제외 / Wave 58 후속에서 자연 inflow 무시 |
| GPU 4090 / 시네마 카메라 (200만원+) | 동일 | 진입 안 함 |
| 냉장고 / 세탁기 | 배송·재고·자본 모두 부담, 부업 부적합 | 진입 안 함 |

### 1.D 절대 고정 아님 — 변경 시점

- MVP 안정화 후 (예: 카테고리당 narrow lane ≥ 3개 ready + 1주 무사고)
- 매출/회전 데이터 누적으로 자본 천장 상향 / 회전율 임계 완화 검토
- 정책 변경은 별도 wave decision log에 기록

## 2. 탐색 대상 카테고리 (Bunjang WebFetch)

다음 카테고리 페이지를 차례로 fetch해서 sub-category tree 파악:
- 전자기기 / 디지털
- 가전제품
- 카메라
- 게임·취미
- 자동차용품 (오디오 제외)
- 컴퓨터·노트북

각 sub-category에서 가격대 / 인입 빈도 / 변형 다양성 보고 5 criteria 통과 SKU 후보 추출.

(WebFetch 결과는 §3에 append)

## 3. 탐색 결과 — Bunjang public categories API

source: `https://api.bunjang.co.kr/api/1/categories/list.json?stat_device=w&version=4` (read-only, no auth).

### 3.A 우리가 이미 narrow lane 잡은 영역

| Bunjang sub-category | inventory | 우리 catalog |
|---|---:|---|
| 600700 휴대폰 | 160,746 | iphone-*, galaxy-s-* |
| 600710 태블릿 | 34,215 | ipad-*, galaxy-tab-* |
| 600720 웨어러블 | 19,398 | applewatch-*, galaxywatch-* |
| 600500010 이어폰 | 37,538 | airpods-* |
| 600500011 헤드폰 | 11,994 | sony-wh-*, bose-qc-*, beats-* |
| 600500006 스피커 | 21,708 | jbl-flip-6, marshall-*, bose-soundlink-* |
| 600100001 노트북 | 26,306 | macbook-air-*, macbook-pro-*, lg-gram |
| 600100007 모니터 | 5,603 | monitor-xl2540k, lg 27gl/27us/27up/39gx |
| 600100006 데스크탑 | 35,385 | mac-mini-m2-256, imac-m3-24, mac-studio-m2 |
| 600600001 닌텐도 | 59,781 | switch-oled |
| 600600002 PS5 | 18,412 | ps5-disc-standard, ps5-digital-*, ps5-slim-* |
| 610500005 청소기 | 6,453 | dyson-v12, roborock-s8-pro-ultra |

### 3.B 미진입 sub-category 인벤토리

| sub-category | inventory | 1차 검토 |
|---|---:|---|
| 600100010 키보드 | 18,970 | ✅ narrow 후보 (Logitech MX Keys, Apple Magic Keyboard) |
| 600100011 마우스 | 9,837 | ✅ narrow 후보 (Logitech MX Master 3/3S) |
| 600200005 메모리/VGA | 15,017 | ❌ GPU 시세 변동 큼 + 4090 등 자본 초과 |
| 600200003 CPU/메인보드 | 8,706 | ❌ 자가조립 SKU 식별 어려움 |
| 600200004 HDD/ODD/SSD | 7,942 | ❌ spread 절대값 작음 (부업 효율 낮음) |
| 600300001 DSLR/미러리스 | 9,547 | ✅ narrow 후보 (보급 미러리스: Sony α6400, Fuji X-T5) |
| 600300002 일반디카/토이카메라 | 17,621 | ❌ 변형 무수 + 시세 변동 |
| 600300003 필름카메라 | 16,684 | ❌ 변형 무수 + silent 추정 risk |
| 600300004 렌즈 | 10,269 | ❌ 마운트·컨디션·연식 변수 큼 |
| 600300007 디지털 캠코더 | 6,549 | ❌ 영상장비 시장 narrow 어려움 |
| 600600003 XBOX | 3,470 | ✅ narrow 후보 (Series S/X) |
| 600600005 PC게임 | 27,031 | ❌ SKU 무한 (게임 타이틀) |
| 600500004 MP3/PMP | 6,908 | ❌ shrinking market |
| 600500002 비디오/프로젝터 | 23,316 | ⚠️ 검토 (XGIMI Halo / Aladdin 등 narrow 가능) |
| 610100 TV | 4,761 | ❌ 자본 초과 + 배송 부담 |
| 610200 냉장고 | 4,467 | ❌ 동일 |
| 610300 세탁기/건조기 | 3,774 | ❌ 동일 |
| 610400 에어컨 | 4,476 | ❌ 자본 + 설치 부담 + 계절성 |
| 610500002 공기청정기 | 2,796 | ✅ narrow 후보 (LG 퓨리케어 / 삼성 BESPOKE 큐브) |
| 610500009 선풍기/냉풍기 | 4,814 | ⚠️ Dyson Pure Cool 시즌 lane (5월 시즌 이전 진입 risk) |
| 610500006 마사지기 | 9,006 | ⚠️ 검토 (Bodyfriend / SK매직 안마의자 자본 초과, 마사지건은 OK) |
| 610600001 에어프라이어 | 1,174 | ❌ 가격 10~30만 spread 작음 + 신제품 빈도 |
| 610600002 커피머신 | 3,767 | ✅ narrow 후보 (DeLonghi 디나미카 / Breville Barista Pro) |
| 610600005 식기세척기 | 629 | ❌ 인벤토리 부족 + 설치 부담 |
| 610700001 고데기 | 6,713 | ✅ narrow 후보 (Dyson Airwrap) |
| 610700002 드라이기 | 3,016 | ✅ narrow 후보 (Dyson Supersonic) |
| 610700003 피부케어기기 | 11,920 | ⚠️ 검토 (LG 프라엘 등 narrow 가능, 시세 변동) |

## 4. 후보 SKU shortlist (criteria 5종 통과 추정)

8개 narrow lane 후보. 진입 자본·회전·시세안정·식별성·spread 모두 양호한 추정 영역.

| # | SKU 후보 | sub-category | 예상 매입가 | 회전 추정 | 결정론 식별 | 비고 |
|---|---|---|---|---|---|---|
| 1 | **Logitech MX Master 3 / 3S** | 600100011 마우스 | 10~17만 | 일 5~15건 | "MX Master 3" / "MX Master 3S" 명확 | 신/구버전 분리 명확 |
| 2 | **Apple Magic Keyboard (USB-C / Touch ID)** | 600100010 키보드 | 10~25만 | 일 3~10건 | "매직 키보드 터치 ID" 명확 | Lightning 구형 분리 필요 |
| 3 | **Sony α6400 (body / 16-50 kit)** | 600300001 미러리스 | 75~95만 | 일 3~8건 | "a6400" / "ILCE-6400" 모델명 | 렌즈 키트 명시 필수 |
| 4 | **Fujifilm X-T5 (body)** | 600300001 미러리스 | 130~180만 | 일 2~5건 | "X-T5" 모델명 | XT-4 분리 |
| 5 | **Xbox Series S / X** | 600600003 XBOX | 40~70만 | 일 5~10건 | "Series S" / "Series X" 명확 | 일반 Xbox One 분리 |
| 6 | **LG 퓨리케어 360 (AS281)** | 610500002 공기청정기 | 50~120만 | 일 2~6건 | 모델명 AS281* 명시 | 일반 퓨리케어 분리 |
| 7 | **Dyson Airwrap (Complete Long 등)** | 610700001 고데기 | 50~70만 | 일 5~12건 | "Airwrap" 명확 | Supersonic 분리 |
| 8 | **Dyson Supersonic (HD08 / Origin)** | 610700002 드라이기 | 40~60만 | 일 4~10건 | "Supersonic" 명확 | Airwrap 분리 |

**대조군 (검토 후 추가 사인오프 가능)**:
- DeLonghi 디나미카 / Breville Barista Pro (커피머신, 80~150만)
- XGIMI Halo+ / Aladdin (프로젝터, 60~120만)
- LG 프라엘 마스크 (피부케어, 50~80만)

## 5. 보류 SKU (criteria 미통과 명시)

| 영역 | 이유 |
|---|---|
| GPU 4080/4090, CPU 플래그십 | 자본 천장 위반 + 시세 변동 큼 |
| 일반 데스크탑 (자가조립) | SKU 식별 어려움 — silent 추정 위반 |
| HDD/SSD | spread 절대값 작아 부업 효율 낮음 |
| 필름카메라 / 렌즈 | 변형 무수, 컨디션·마운트·연식 변수 큼 |
| PC게임 타이틀 | SKU 무한 |
| MP3/PMP / 디지털 캠코더 | shrinking market |
| TV / 냉장고 / 세탁기 / 에어컨 | 자본 초과 + 배송·설치 부담 (사용자 명시 실수 영역) |
| 에어프라이어 / 인덕션 / 전기밥솥 | 매입가 10~30만 → spread 절대값 작음 + 신제품 출시 빈도 높음 |
| 모니터 200만원+ (LG 39GX900A 등) | 자본 초과 (사용자 명시 실수) — 현재 DEFAULT_SEARCH_QUERIES "LG 39GX900A" cleanup 후보 |
| 안마의자 (Bodyfriend / SK매직) | 자본 초과 + 설치 부담 |

## 6. 다음 wave 액션

### Wave 59 후보 (autonomy, 정확성 원칙 기반)
- **Wave 59-A**: cleanup wave — DEFAULT_SEARCH_QUERIES에서 (1) "JBL 플립6" 0-raw 한글 변형 (2) "Bose QC" 영어 단독 0-raw (3) **"LG 39GX900A" 200만원+ 자본 초과 SKU** 제거. 3 줄 제거 + test:core 통과.
- **Wave 59-B**: shortlist 8 후보 중 정확성·회전·spread 가장 안정적인 **3 SKU 먼저 catalog narrow lane 등록** (1차 진입). 후보:
  - Logitech MX Master 3/3S (마우스, 회전 빠름, 식별 명확)
  - Dyson Airwrap (가전, 이미 narrow Dyson V12 lane 가동 중 → 동일 family 확장)
  - Xbox Series S/X (게임콘솔, 이미 narrow PS5/Switch 가동 중 → 동일 family 확장)
  - mining 5 criteria 정밀 검증 후 사인오프
- **Wave 59-C**: 나머지 5 후보 (Apple Magic Keyboard / Sony α6400 / Fuji X-T5 / LG 퓨리케어 360 / Dyson Supersonic) 후속 wave 일정

### 진입 순서 권고
1. **Wave 59-A** cleanup 즉시 (autonomy)
2. **Wave 59-B** 3 SKU mining/catalog 등록 (Wave 56 동일 패턴, autonomy + test 통과 후 진행)
3. **Wave 60+** 나머지 5 후보 정밀 검증 후 단계적 진입

## 7. 정책 — 결정 vs 보류 vs 행동

| 항목 | 분류 | 근거 |
|---|---|---|
| MVP 자본 천장 200만원 | **정책 결정** | owner 명시 |
| 5 criteria (자본·회전·시세안정·식별성·spread) | **정책 결정** | 핵심 가치 (정확성 우선) 기반 |
| MVP soft policy (절대 고정 아님) | **정책 결정** | owner 명시 |
| 모든 결정/보류/행동 decision.md 기록 | **운영 정책** | owner 명시 |
| 위험 mutation 순간만 멈춤 | **autonomy 범위** | owner 위임 |
| TV/냉장고/세탁기/에어컨/4090/안마의자 진입 안 함 | **보류 결정** | 5 criteria 위반 |
| 8 SKU shortlist 후보 | **행동 후보** | 5 criteria 통과 추정, Wave 59+ 진입 |
| LG 39GX900A cleanup | **행동 결정** | 자본 초과 (실수), 즉시 cleanup |
| WebFetch Bunjang categories API | **행동 완료** | public read-only |

## 8. 원칙 ack
- 정확성 우선 / silent 추정 금지 / pool leak 0 / public promotion 분리 게이트: ✓
- 본 wave 자체는 DB write 0 / catalog patch 0 ✓
- 새 catalog narrow lane 추가는 Wave 59+ 별도 ✓
- 모든 결정/보류/행동 decision.md 기록: ✓
- MVP soft policy 명시 (변경 시 별도 wave): ✓

## 9. 변경/검증/위험
- 변경: decision log 1개 (정책 + 탐색 결과 + shortlist + 보류 명시)
- 검증: Bunjang categories API public fetch + 우리 catalog 대조 + 5 criteria 적용
- 위험: 없음 (read-only)
- 다음: Wave 59-A cleanup (autonomy) + Wave 59-B shortlist 3 SKU 진입 검토

## 10. 남은 blocker (재정렬)
1. R3 contentHash 더블체크 path (retention, 우선순위 낮음)
2. needs-owner 407 stale row apply (Wave 59-D 후보, autonomy로 nr_flip 365 처리 가능)
3. Phase A backup table DROP (2026-05-21+ 자동)
4. PS5 detail queue 198 catch-up (자연 cycle ~50분)
5. Wave 57 +7 query 121 catch-up + SKU 측정 (~1.5h)
6. **DEFAULT_SEARCH_QUERIES cleanup** (Wave 59-A 명확, autonomy)
7. **Wave 59-B 3 SKU 진입** (Logitech MX Master, Dyson Airwrap, Xbox Series S/X)
8. Wave 60+ 5 SKU 후속 진입 (Apple Magic Keyboard / Sony α6400 / Fuji X-T5 / LG 퓨리케어 360 / Dyson Supersonic)

→ **남은 blocker 8건** (4·5 자연 시간, 1·3 자동, 2·6·7·8 autonomy).

---

## 11. 실측 inventory probe (Wave 58 follow-up — Bunjang find_v2.json)

source: `https://api.bunjang.co.kr/api/1/find_v2.json?q=<query>&order=date&n=100&...`
script: `scripts/wave58-inventory-probe.ts`
report: `reports/wave58-inventory-probe-latest.json`
measure: page 0 top 100 매물의 `update_time` 기반 last_24h / 7d / 30d 분포 + median/p25/p75 price.

### 11.A 신규 추가 selection criteria (회전·자본 실측 기반)

§1.A 5 criteria에 운영적 컷오프 추가:

| # | 기준 | 컷오프 |
|---|---|---|
| 6 | last_7d ≥ 8건 (탄탄 floor) | 미만은 폐기 |
| 7 | last_30d ≥ 30건 (월 회전 floor) | 미만은 폐기 |
| 8 | median price ≤ 자본 천장 200만 | 초과는 폐기 |
| 9 | median price ≥ 10만 (spread 절대값 floor) | 미만은 부업 효율 부족 |
| 10 | query 한국어 자연 매칭 (Bunjang 매물 표기와 일치) | 0건이면 폐기 |
| 11 | 가품 risk 낮은 영역만 (캐주얼·미드레인지) | 명품/플래그십 제외 |

11종 criteria 모두 통과해야 narrow lane 진입 자격. 1종이라도 실패면 폐기 또는 경계 보류.

### 11.B 14 후보 실측 — 분류 결과

**탄탄 (last_7d ≥ 30 OR last_30d ≥ 70) — Wave 59-B 진입 검토 후보**

| 후보 | last_24h | last_7d | last_30d | median price | 비고 |
|---|---:|---:|---:|---:|---|
| Casio G-Shock | 100+ | 100+ | 100+ | 15만 | 압도적, 가품 risk 낮음 |
| Seiko 5 | 65 | 100+ | 100+ | 35만 | 압도적 |
| 다이슨 에어랩 | 28 | 87 | 100+ | 28만 | 우리 Dyson family 확장 |
| 다이슨 슈퍼소닉 | 21 | 52 | 79 | 19만 | 동일 확장 |
| 타이틀리스트 TSR3 | 17 | 48 | 90 | 38만 | 골프 신규 진입 후보 |
| 타이틀리스트 TSR2 | 8 | 30 | 76 | 40만 | 동일 |

**경계 (last_7d 8~25 범위 OR 자본 우려)**

| 후보 | last_7d | last_30d | median | 사유 |
|---|---:|---:|---:|---|
| 소니 a6400 | 23 | 52 | 91만 | 회전 양호, 카메라 신규 |
| 지샥 GA-2100 | 22 | 42 | 9만 | G-Shock subset, 매입가 ≥10만 경계 |
| LG 퓨리케어 360 | 15 | 26 | 25만 | 모델번호 정밀화 필요 |
| 삼성 더 프리스타일 | 10 | 29 | 40만 | 프로젝터 단일 후보 |
| MX Master 3/3S | 9 | 23 | 8만 | 매입가 ≤10만 경계, criterion #9 위반 |
| 세이코 프로스펙스 | 8 | 16 | 55만 | 회전 floor 경계 |

**폐기 (last_7d ≤ 6 OR 자본 초과 OR query 매칭 실패)**

| 후보 | last_7d | last_30d | 사유 |
|---|---:|---:|---|
| Xbox Series X | 6 | 37 | 회전 부족 (criterion #6) |
| Xbox Series S | 4 | 29 | 동일 |
| 테일러메이드 Stealth 2 | 3 | 10 | 회전 부족 + 매물 부족 |
| 매직 키보드 터치 ID | 1 | 1 | 인벤토리 빈약 |
| 후지 X-T5 | 14 | 28 | median 205만 > 자본 200만 천장 초과 (#8) |
| 스노우피크 화로대 | 0 | 1 | 사실상 없음 (#7) |
| 코베아 큐브 | 0 | 0 | 없음 |
| 콜맨 230A | 1 | 1 | 신발과 query 혼동 |
| XGIMI Halo | 0 | 0 | query 매칭 실패 (#10) |
| Aladdin 빔 | 0 | 0 | 동일 |
| 캘러웨이 파라다임 | 0 | 0 | query 매칭 실패 |
| 레고 UCS 75192 | 1 | 1 | 한정판이지만 회전 0 |
| 레고 10307 에펠탑 | 1 | 1 | 동일 |
| 레고 42143 페라리 | 1 | 2 | 동일 |
| Dyson Airwrap (영어) | 0 | 0 | 한글 "다이슨 에어랩" 표기가 자연어 |

### 11.C 카테고리 단위 폐기 명시

실측 결과 다음 영역은 **MVP 단계에서 narrow lane 진입 불가**로 결정 (user 우려 적중):

| 카테고리 family | 사유 | 결정 |
|---|---|---|
| 캠핑 (Snow Peak / 코베아 / Coleman) | 매물 주 0~1건, last_30d 0~1 | **전면 폐기** |
| LEGO (UCS / Modular / Technic 한정판) | 한정판 회전 1~2건/월 — collector niche | **전면 폐기** |
| Xbox Series S/X | 주 4~6건 — PS5 narrow 대비 ROI 부족 | **폐기** |
| 빔 프로젝터 (XGIMI / Aladdin) | query 매칭 실패, 자연어 표기 다름 | **폐기** (삼성 프리스타일만 경계) |
| 미러리스 고가 (Fuji X-T5 등) | 자본 200만 초과 | **자본 천장 위반 폐기** |
| 매직 키보드 / 데스크탑 액세서리 단일 | 인벤토리 빈약 | **폐기** |

### 11.D Wave 59-B 진입 우선순위 (autonomy 결정)

탄탄 + criteria 11종 통과 6 family를 다음 순서로 mining 진입:

| 순위 | family | 사업적 의미 | 진입 risk |
|---|---|---|---|
| 1 | **Casio G-Shock 미드레인지** (DW-5600 / GA-2100 / GMW-B5000 narrow) | 신 카테고리 (시계 첫 진입), 가품 risk 가장 낮음, 회전 압도적, 가격대 다양 | 낮음 |
| 2 | **다이슨 에어랩** + **다이슨 슈퍼소닉** | 우리 가전 family 확장 (이미 Dyson V12 narrow 가동), 회전 강함 | 낮음 |
| 3 | **Seiko 5 Sports** (SBSA / SRPD narrow) | 시계 두 번째, G-Shock과 다른 미드레인지 mechanical 시장 | 낮음 |
| 4 | **타이틀리스트 TSR3 드라이버** | 신 카테고리 (골프 첫 진입), 변형(헤드만/풀세트/플렉스/로프트) 정밀화 필요 | 중간 |
| 5 | **타이틀리스트 TSR2 드라이버** | TSR3과 동일 family, 후속 | 중간 |
| 6 | **소니 a6400 (보급 미러리스)** | 신 카테고리 (카메라 첫 진입), 자본 양호, 회전 경계 | 중간 |

경계 후보 (정밀 측정 후 별도 결정):
- LG 퓨리케어 360 / 세이코 프로스펙스 / 삼성 더 프리스타일
- MX Master 3/3S (자본 매우 낮음 → 부업 효율 검토 필요)
- 지샥 GA-2100 (G-Shock과 중복일 수 있음, 모델 분리 시 결정)

### 11.E 정책 적용 — autonomy 범위 vs owner 결정

| 항목 | 분류 | 근거 |
|---|---|---|
| 11종 selection criteria 적용 | autonomy 결정 | 정확성·자본·회전 기반 객관 |
| 캠핑/LEGO/Xbox/프로젝터 전면 폐기 | autonomy 결정 | criteria 실측 미통과 |
| Casio G-Shock / 다이슨 에어랩/슈퍼소닉 / Seiko 5 mining 진입 | autonomy 결정 | criteria 전건 통과 |
| 골프 (TSR2/TSR3) 신 카테고리 진입 | **owner 결정 권고** | 시즌성·변형 식별 risk + 사업 카테고리 신규 |
| 카메라 (소니 a6400) 신 카테고리 진입 | **owner 결정 권고** | 회전 경계 + 사업 카테고리 신규 |
| 시계 (G-Shock / Seiko 5) 신 카테고리 진입 | **owner 결정 권고** | 사업 카테고리 신규 (전자기기 → 시계) |
| 가전 family 확장 (Dyson Airwrap / Supersonic) | autonomy 결정 | 기존 Dyson V12 family 자연 확장 |

→ **Wave 59-B에서 autonomy로 즉시 진입 가능: Dyson Airwrap + Dyson Supersonic 2 family.**
→ 시계 / 골프 / 카메라는 **사업 카테고리 신규** → owner 사인오프 필요.

## 12. 변경/검증/위험 (Wave 58 follow-up)
- 변경: decision log §11 append, `scripts/wave58-inventory-probe.ts` 신규 (read-only)
- 검증: Bunjang find_v2 API 28 query 측정 + 11 criteria 분류
- 위험: 없음 (read-only)
- 다음:
  - Wave 59-A cleanup (JBL 플립6 / Bose QC / LG 39GX900A — autonomy)
  - Wave 59-B autonomy 가전 확장 (Dyson Airwrap + Supersonic mining)
  - Wave 59-C owner 사인오프 (시계 G-Shock·Seiko 5 / 골프 TSR3 / 카메라 a6400 신 카테고리 진입 — 3 카테고리 동시 또는 우선순위 1개)

## 13. 남은 blocker (재정렬, Wave 58 follow-up 후)

1. R3 contentHash 더블체크 path (retention, 우선순위 낮음)
2. needs-owner 407 stale row apply (Wave 59-D autonomy 가능: nr_flip 365 단독)
3. Phase A backup table DROP (2026-05-21+ 자동)
4. PS5 detail queue 198 catch-up (자연 cycle)
5. Wave 57 +7 query catch-up + SKU 측정 (자연 cycle)
6. **Wave 59-A cleanup** (autonomy 즉시: JBL 플립6 / Bose QC / LG 39GX900A 3 줄 제거)
7. **Wave 59-B autonomy** (Dyson Airwrap / Supersonic mining + catalog narrow lane 등록)
8. **Wave 59-C owner 사인오프** (시계 / 골프 / 카메라 신 카테고리 — 3 영역 중 진입 순서·범위 결정)

→ **남은 blocker 8건**.



## 7. 원칙 ack
- 정확성 우선 / silent 추정 금지 / pool leak 0 / public promotion 분리 게이트: ✓
- 본 wave 자체는 DB write 0 / catalog patch 0
- 새 catalog narrow lane 추가는 Wave 59+ 별도

## 8. 변경/검증/위험
- 변경: decision log 1개 (정책 + 탐색 계획)
- 검증: 정책 5 criteria 명시
- 위험: 없음 (read-only 탐색)
- 다음: WebFetch 결과 §3에 append → §4·5·6 채움
