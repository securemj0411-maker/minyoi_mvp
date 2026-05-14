# Wave 67 — 신 사업 카테고리 진입: 시계 + 골프 + 카메라 보강

> Status: **applied (catalog patch + queries + category readiness).** code 변경 3 파일, DDL 0, candidate_pool 0, public 0. Owner 사인오프 (Wave 58 §11.E owner 결정 4 영역) 후 진입.

CLAUDE.md 6 필드 포맷.

## 0.1 신 카테고리 진입 — 시계 (Casio G-Shock + Seiko 5 Sports)

- 시간: 2026-05-14 KST
- 발견: Wave 58 §11.D 우선순위 1·3 — Casio G-Shock 미드레인지 (DW-5600 / GA-2100 / GMW-B5000) + Seiko 5 Sports (SRPD/SBSA) 11 criteria 전건 통과 (last_30d 100+ / median 15만~99만 / 회전 압도적 / 가품 risk 낮음 — 미드레인지 한정). owner 사인오프: "이거 존나 좋다 지금 하자".
- 변경:
  - `src/lib/catalog.ts`:
    - `Sku["category"]` union에 "watch" 추가
    - `WATCH_NOISE` 상수 신규 (줄/스트랩/베젤/케이스 단품, 가품, 복각, 부품용, 구매요청 reject)
    - 5개 신규 SKU 등록:
      - `watch-casio-gshock-dw5600` (laneKey: watch_gshock_dw5600, msrp 159,000)
      - `watch-casio-gshock-ga2100` (CasiOak, 169,000)
      - `watch-casio-gshock-gmwb5000` (Full Metal, 990,000)
      - `watch-seiko-5-sports-srpd` (5KX, 350,000)
      - `watch-seiko-5-sports-sbsa` (450,000)
    - mustContain은 모델 코드 + 한글 변형만 (지얄오크/카시오크/풀메탈 5000 등 alias). silent 추정 X.
    - mustNotContain은 동일 family 다른 model 코드 + WATCH_NOISE.
  - `src/lib/category-readiness.ts`:
    - CATEGORY_READINESS에 `watch: { status: "internal_only", minReadyPool: 5, minParseRate: 0.9, minTrustedKeys: 5 }` 추가
    - categoryFromComparableKey에 "watch" family 추가
  - `src/lib/pipeline-config.ts` DEFAULT_SEARCH_QUERIES에 4 query 추가:
    - "G-Shock", "지샥 GA-2100", "지샥 DW-5600", "지샥 풀메탈 5000"
    - "Seiko 5", "세이코 5 SRPD", "세이코 5 SBSA"
- 검증:
  - 신규 SKU sanity test 15/15 pass (positive 매칭 + negative reject 다 정상)
  - npx tsc --noEmit clean
  - npm run test:core 139/139 pass
  - 기존 SKU 회귀 0
- 위험:
  - LOW: internal_only로 시작 → 사용자 노출 없음, 시세 학습만
  - 가품 risk는 미드레인지(DW-5600/GA-2100) 한정으로 완화. 풀메탈 5000은 고가라 별도 모니터 필요
  - mustContain strict (모델 코드 명시 매물만) → recall 손해 수용 (§12b 정확성 우선)
- 다음:
  - Bunjang 자연 inflow 측정 (1주일 후 catalog binding 비율 / detail-skip 비율 / 시세 std 측정)
  - 측정 결과로 ready 승격 결정 (별도 wave)

## 0.2 신 카테고리 진입 — 골프 (Titleist TSR2 + TSR3 드라이버)

- 시간: 2026-05-14 KST
- 발견: Wave 58 §11.D 우선순위 4·5 — Titleist TSR2/TSR3 드라이버 11 criteria 통과 (last_30d 76·90 / median 38만·40만). 변형 (헤드만/플렉스/로프트) risk는 mustNotContain "헤드만" + GOLF_DRIVER_NOISE로 격리.
- 변경:
  - `src/lib/catalog.ts`:
    - `Sku["category"]` union에 "sport_golf" 추가
    - `GOLF_DRIVER_NOISE` 상수 신규 (풀세트/아이언세트/우드세트/유틸/구매요청/가품 reject)
    - 2개 신규 SKU:
      - `sport-golf-titleist-tsr2-driver` (laneKey: sport_golf_titleist_tsr2_driver, msrp 950,000)
      - `sport-golf-titleist-tsr3-driver` (msrp 950,000)
    - mustContain[0] = "tsr2/tsr3" 모델 코드, mustContain[1] = "드라이버/driver" 카테고리 명시 → 헤드/우드/유틸 자동 reject
    - mustNotContain에 동일 family 다른 모델 (tsr1/tsi/ts3/ts2) + "헤드만" + GOLF_DRIVER_NOISE
  - `src/lib/category-readiness.ts`: `sport_golf: { status: "internal_only", minReadyPool: 5 }` 추가
  - `src/lib/pipeline-config.ts`: "타이틀리스트 TSR2", "타이틀리스트 TSR3" query 추가
- 검증:
  - "TSR3 드라이버 9도" → 정상 매칭, "TSR3 드라이버 헤드만" → reject, "TSR2 풀세트" → reject 확인
  - tsc clean, test:core 139/139 pass
- 위험:
  - 변형(플렉스 R/S/SR/X, 로프트 8.5/9/10.5도) 식별 정밀화 필요 — 현재는 driver 본체로만 묶음. 측정 후 sub-lane 분리 검토.
  - 골프 시즌성 (봄~가을 inflow ↑) 고려 필요.
- 다음:
  - 1주~1개월 측정 후 sub-variant (헤드만 lane / 플렉스별 lane) 분리 검토
  - 골프 다른 브랜드 (캘러웨이 파라다임, 테일러메이드 Stealth 등) 진입은 측정 후 결정

## 0.3 카메라 보강 — Sony a6400

- 시간: 2026-05-14 KST
- 발견: Wave 58 §11.D 우선순위 6 — Sony a6400 last_7d=23, median 91만, 회전 양호. 카메라 카테고리는 이미 존재하므로 SKU만 추가 (신 카테고리 아님).
- 변경:
  - `src/lib/catalog.ts`: `camera-sony-a6400` SKU 추가 (laneKey: camera_body_only_exact_model, msrp 1,290,000)
  - mustContain: ["a6400", "ilce-6400", "알파 6400"] + ["바디", "body"] (기존 camera body_only_exact_model 정책 동일)
  - mustNotContain: CAMERA_BODY_ONLY_NOISE + 동일 family 다른 모델 (a6300/a6500/a6600/a6700)
  - `src/lib/pipeline-config.ts`: "소니 a6400", "Sony a6400" query 추가
- 검증:
  - "소니 a6400 바디 미러리스" → 매칭, "Sony a6400 16-50 렌즈킷" → reject
  - tsc clean, test:core 139/139 pass
- 위험:
  - 카메라 카테고리는 Wave 66에서 internal_only로 변경 (camera ready→internal_only revert). a6400 추가도 internal_only 유지.
  - body_only strict 정책으로 detail-skip 비율 높을 수 있음 (Wave 65 옵션 A 결정 동일).
- 다음:
  - 자연 inflow 측정. body 매물 비율 낮으면 별도 정책 검토.

## 0.4 종합 영향

- catalog SKU 8개 신규 (시계 5 + 골프 2 + 카메라 1)
- 신 카테고리 2개 추가 (watch + sport_golf), CATEGORY_READINESS internal_only
- DEFAULT_SEARCH_QUERIES 11 query 추가 (시계 7 + 골프 2 + 카메라 2)
- 사용자 노출 변화 0 (모두 internal_only)
- 시세 학습 시작 — 1주일 후 측정 wave 예정

## 0.5 남은 작업 (별도 wave)

- 측정 wave (1~2주 후): catalog binding 비율, detail-skip 비율, 시세 std, 회전 측정 → ready 승격 결정
- 변형 sub-lane (골프 헤드만 / 시계 가품 의심 강화 / 카메라 lens kit 별도 lane) 검토
- 다른 브랜드 진입 (오메가/롤렉스 등 고가 시계는 가품 risk로 보류)
