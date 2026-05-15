# Wave 109 — Parser 강화 (option-parser.ts)

> Status: **applied (code).** owner 요청 "파서도 다 강화". Wave 108은 catalog만이라 parser 약점 그대로. unknown_X 진단 후 가장 큰 ROI 3개 적용.

CLAUDE.md 6 필드 포맷.

## 1. Parser 약점 진단 (production 7일)

| 약점 | 건수 | 카테고리 |
|---|---:|---|
| unknown_connectivity (Apple/Galaxy Watch) | **800** | smartwatch |
| unknown_storage (iPad) | 369 | tablet |
| unknown_ram (MacBook) | 319 | laptop |
| unknown_connector (AirPods Max) | 238 | earphone |
| unknown_size (Apple Watch mm) | 192 | smartwatch |
| unknown_storage (iPhone) | 177 | smartphone |
| unknown_chip (iPad) | 172 | tablet |
| unknown_anc (AirPods 4) | 147 | earphone |
| unknown_generation (MacBook) | 141 | laptop |

## 1.1 Wave 109a — Watch SE/Series/Galaxy 6/7 GPS default

- 시간: 2026-05-15
- 발견: production sample 분석. Apple Watch / Galaxy Watch 매물 description에 cellular vs GPS 표기 거의 없음 (모델명 + mm + 색상만). 한국 reseller 시장에서 GPS 모델 95%+ (cellular는 별도 통신사 plan + 매물자 보통 명시).
- 변경: **[mvp/src/lib/option-parser.ts](mvp/src/lib/option-parser.ts:816)** `defaultConnectivity()`
  - 기존: Ultra 시리즈만 cellular default (line 818)
  - 추가: `applewatch_se / applewatch_series / galaxywatch_6 / galaxywatch_7` 모델 → GPS default
- 검증: tsc clean, 139/139 test pass.
- 위험: 낮음. cellular 명시 매물 (description의 "셀룰러/cellular/lte") 은 그대로 cellular. 모집단 95% GPS라 시세 평균 GPS 수렴 → 정확성 영향 작음.
- 다음:
  - Production reparse 후 unknown_connectivity 800건 → 대다수 GPS lane 진입 예상.
  - 시세 정확도 측정 (GPS vs Cellular 가격 차이 확인).

## 1.2 Wave 109b — ramPattern 18 추가 (MacBook Pro M3/M4 Pro base RAM)

- 시간: 2026-05-15
- 발견: production sample 분석. "맥북 프로 14 M3 Pro 18GB" 같이 18GB 명시 매물이 unknown_ram. parser ramPattern = `4|6|8|16|24|32|...` 에서 **18 빠짐**. MacBook Pro M3 Pro / M4 Pro base RAM이 18GB (Apple 공식 spec).
- 변경: **[mvp/src/lib/option-parser.ts:312](mvp/src/lib/option-parser.ts:312)**
  - `const ramPattern = "4|6|8|16|24|32|...";` → `"4|6|8|12|16|18|24|32|...";`
  - 12도 추가 (옛 모델 가능성).
- 검증: tsc clean, 139/139 test pass.
- 위험: 매우 낮음. Apple 공식 RAM spec 정밀 패턴.
- 다음: production reparse 후 unknown_ram 319건 중 18GB 명시 매물 정확 분류.

## 1.3 Wave 109b — Watch size mm 없는 표기 매칭

- 시간: 2026-05-15
- 발견: "애플워치9 45 배터리93%" / "애플워치 10 ... GPS 42" 같이 size 숫자만 명시 (mm 없음) 매물이 unknown_size. parser는 `\b(40|...|49)\s*m{1,2}\b` regex로 "mm" 필수.
- 변경: **[mvp/src/lib/option-parser.ts:584](mvp/src/lib/option-parser.ts:584)** `parseWatchSizeMm()`
  - 1차: 기존 "Xmm" 패턴 그대로
  - 2차: 워치 모델명 12자 이내 size 숫자 단독 매칭 — `/(?:애플\s?워치|applewatch|갤럭시\s?워치|galaxywatch)[a-z0-9\s]{0,12}?\b(40|41|...|49)\b/`
- 검증: tsc clean, 139/139 test pass.
- 위험: 낮음. false positive risk — "워치9 배터리효율 45%" 같이 noise 매칭 가능. 단 model 컨텍스트 12자 이내라 제한적.
- 다음: production reparse 후 측정. false positive 0건이면 stable, 다수면 컨텍스트 8자로 좁힘 검토.

## 2. SKIP 한 약점 (정책/한계)

| 약점 | 이유 |
|---|---|
| unknown_connector (AirPods Max 238) | description token 기반. default 박기 위험. 명시 매물만 lane 진입 유지 |
| unknown_storage (iPad 369, iPhone 177) | 매물자가 GB 명시 안 한 경우 대부분. default 박는 건 정책 12b 위반 (추정 fallback 금지) |
| unknown_chip (iPad 172) | 옛 iPad (Air 1/2/3, Pro 9.7/10.5) — A-series chip 명시 자체 X. 신모델 chip은 이미 잡힘. ROI 작음 |
| unknown_anc (AirPods 4 147) | "노캔" 단어만 명시 (강력 confirm 토큰 없음) — 추가 보강 시 false positive 위험 큼 |
| unknown_generation (MacBook 141) | macbook v31 patch로 chip → generation fallback 이미 적용 (LAUNCH_PLAN 3.2). 추가 보강 ROI 작음 |

## 3. 거론 금지

- iPad storage default (popular 256GB 가정) — 정책 12b 위반.
- iPhone storage default — 동일.
- MacBook base RAM default (8GB) — 변형 (16GB/24GB) 매물 다수, false positive risk 큼.
- "노캔" 단독 token 기반 ANC 매칭 강제 — description fuzzy 위험.
