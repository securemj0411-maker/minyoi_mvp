# Wave 250.4 — 5 카테고리 audit (smartwatch/earphone/drone/camera/appliance)

- date: 2026-05-19
- type: catalog mustNotContain 보강 (additive — outlier 매물 차단)
- scope:
  - `watch-casio-gshock-gmwb5000` — CV 1.58 → 한정판/collab 차단
  - `airpods-pro-2` (HEADPHONE_NOISE) — CV 0.93 → 단품/본체 패턴 보강
  - `dji-mini-3-pro` — CV 1.20 → 액세서리/typo 차단
  - `dyson-airwrap-hs05` — CV 1.43 → 한국어 아이디/한정판/110v 변경 차단
- branch: `fix/market-chart-honesty-2026-05-19`

## 배경

작업 1 (narrow split) 완료 후 5 카테고리 audit. production sample 측정 결과 CV ≥ 0.7 SKU 만 audit.

### CV 분포 (active 매물 기반)

```
watch-casio-gshock-gmwb5000   CV 1.58 (n=34) ← 한정판/collab outlier
dyson-airwrap-hs05            CV 1.43 (n=37) ← 한국어 아이디 모델 leak
dji-mini-3-pro                CV 1.20 (n=8)  ← accessory + typo
watch-casio-gshock-dw5600     CV 1.03 (n=66) ← (별도 wave 검토)
airpods-pro-2-lightning       CV 0.93 (n=20) ← 단품 매물 (stale SKU tag, HEADPHONE_NOISE 보강)
airpods-max                   CV 0.82 (n=607) ← high volume, 별도 wave
camera (sony-a*/canon/fujifilm) CV < 0.5      ← clean ✓
```

## 결정

### 1. `watch-casio-gshock-gmwb5000` mustNotContain 보강

production sample outlier (정상 ₩450k vs):
- pid 362801056 "포터 GMW-B5000TFC" ₩5.6M (12x)
- pid 387020331 "GMW-B5000TCM 티타늄 카모" ₩1.6M (3.6x)
- pid 408990627 "40주년 한정 PG-9 민트급" ₩950k (2x)
- pid 393782792 "에릭헤이즈 콜라보 EH" ₩800k (1.8x)

기준 모델 = GMW-B5000D-1 (블랙/풀메탈, ~₩450k). 정상 sub-variants (BT/BPC/PG 일반) 는 유지.
mustNotContain 추가: `포터`, `tfc`, `콜라보`, `collab`, `tcm`, `티타늄 카모`, `에릭헤이즈`, `eric haze`, `40주년`, `40th`, `pg-9`, `mrg`, `커스텀 블랙`.

### 2. `HEADPHONE_NOISE` 패턴 보강 (전역 — airpods-pro-2 등)

production sample (`sku_id='airpods-pro-2-lightning'` stale) 발견 패턴:
- "왼쪽 이어폰 단품" / "오른쪽 이어폰 단품"
- "프로2 본체" / "본체만" / "본체 가져가신"
- "8핀 본체" / "8핀 왼쪽" / "8핀 오른쪽"

기존 `왼쪽만/유닛만` → 변형 통과. HEADPHONE_NOISE 에 명시 패턴 추가:
- `왼쪽 이어폰`, `오른쪽 이어폰`, `좌측 이어폰`, `우측 이어폰`
- `왼쪽 단품`, `오른쪽 단품`, `좌측 단품`, `우측 단품`
- `본체만`, `본체 만`, `본체 판매`, `본체 가져가신`, `본체 분실`, `본체 찾`, `분실 본체`
- `이어폰 단품`
- `8핀 본체`, `8핀,본체`, `8핀 왼쪽`, `8핀 오른쪽`

영향: airpods/galaxy-buds/bose/beats/sony-wh 등 모든 HEADPHONE_NOISE 사용 SKU 일괄 적용.

### 3. `dji-mini-3-pro` mustNotContain 보강

production sample (n=8):
- pid 393097968 "Dji 미니3,4프로 배터리" ₩57k (typo + accessory)
- pid 379948875 "프로펠러 14개" ₩50k
- pid 377859044 "RC조정기(중고)" ₩330k
- pid 408817380 "DJI 미니34프로" ₩750k (typo — 3, 4 둘 다 match)

mustNotContain 추가:
- 배터리/프롭/프로펠러 단품: `배터리 판매`, `프롭 판매`, `프로펠러 홀더`, `프로펠러 14`, `프로펠러 12`, `프로펠러 6`, `프로펠러 4`, `랜딩기어`, `랜딩 기어`
- 조종기 단품: `조정기(중고)`, `rc조정기`, `rc 조정기`, `rc조종기`, `rc 조종기`
- 액세서리 모음: `악세사리 모음`, `액세서리 모음`, `악세사리만`, `액세서리만`
- typo: `미니34프로`, `미니3,4프로`, `미니 3,4 프로`, `미니3 4프로`, `mini3,4`, `미니3,4`, `3,4프로`, `프롭 랜딩`

주의: 단순 "배터리" 단독 차단 시 정상 풀셋 통과 못 함 → "배터리 판매" 같은 명시 패턴만.

### 4. `dyson-airwrap-hs05` mustNotContain 보강

production sample (n=37):
- pid 407010796 "한정판 컴플리트 롱 (오닉스/골드)" ₩3.9M (9x)
- pid 345607032 "에어랩 아이디 (한국어)" ₩660k — HS-ID 신모델, 별도 lane (영문 `i.d./id` 만 잡혀 한국어 변형 통과)
- pid 408401448 "에어랩 교환 (110v>220v)" — 변경 서비스 매물

mustNotContain 추가:
- `아이디 멀티`, `아이디 스타일러`, `아이디 에어랩`, `에어랩 아이디` (한국어 ID 모델)
- `한정판`, `limited edition`, `limited 에디션`
- `오닉스/골드`, `온닉스/골드`, `온닉스 골드`
- `110v>220v`, `110v→220v`, `110v 변경`, `110v 교환`, `변환 서비스`, `교환 서비스`

### 5. camera 카테고리 — clean (skip)

- `camera-sony-a7c` CV 0.47 (n=6)
- `camera-canon-eos-r6-mark-ii` CV 0.21 (n=6)
- `camera-sony-a7c-ii` CV 0.05 (n=11)

모두 CV < 0.5 → 정상. 추가 audit 불필요.

### 6. `dyson-supersonic-hd08` — 측정만 (catalog 이미 fix)

CV 0.64 (n=47). "뉴럴" 모델 (HD16) 매물 leak — 이미 mustNotContain 에 `"뉴럴"` 차단 박힘 (Wave 240).
production 데이터에 stale sku_id 잔존 → rematch 후 정상화 예상.

## 영향 (additive only)

- 4 SKU mustNotContain 보강 → outlier 매물 차단, narrow lane 정상 가격대만 catch.
- HEADPHONE_NOISE 전역 보강 → 모든 헤드폰/이어폰 SKU 의 단품 매물 차단 효과 동일.
- rematch 후 CV 측정 필요 (별도 wave). 예상: CV 1.58 → ~0.5, 1.43 → ~0.4, 1.20 → ~0.5, 0.93 → ~0.4.

## 검증

- production sample SQL 측정 결과 위 참조.
- code: `npx tsc --noEmit -p .` (catalog.ts 0 error).

## 참고

- Wave 153 (한쪽만 / 본체 X 코멘트 패턴 — HEADPHONE_NOISE 시초)
- Wave 179 (헤드폰 한쪽 단품 흡수)
- Wave 235 brand mustNotContain
- Wave 237 accessory NOISE
- Wave 240 perfume/kickboard/lego/헤어 audit
- Wave 250 (catalog narrow split — RRL/FOG)
