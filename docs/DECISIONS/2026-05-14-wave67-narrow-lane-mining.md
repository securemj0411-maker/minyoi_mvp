# Wave 67 마이닝 — 신 사업 카테고리 narrow lane 8개 mining 진행

> Status: **applied (mine-narrow-lane.ts 8 lane config 추가 + 실행 완료).** code 변경 1 파일, mining outputs 8 폴더 신규. DDL 0, candidate_pool 0, public 0, runtime DB 0.

CLAUDE.md 6 필드 포맷.

## 0. 발견 — Wave 67 SKU 누락 검증

- 시간: 2026-05-14 KST
- 발견: Wave 67에서 catalog SKU 8개 추가했으나 `category-intelligence/<lane>/parse_summary.json` 디렉토리 0건. 즉 mining 자체가 안 돌았음. user 지적: "마이닝 튜닝, 옵션 분석 다 했는지" 비상 점검 필요. 기존 lg_gram/macbook/galaxy 등은 모두 mining 디렉토리 보유 확인.
- 변경: 본 wave에서 8 lane mining config 추가 + 실행.

## 1. mine-narrow-lane.ts lane config 추가

- 시간: 2026-05-14 KST
- 변경: `scripts/lib/mine-narrow-lane.ts` LaneKey union + LANES record에 8 lane 신규 추가:
  - `watch_gshock_dw5600`, `watch_gshock_ga2100`, `watch_gshock_gmwb5000`
  - `watch_seiko_5_sports_srpd`, `watch_seiko_5_sports_sbsa`
  - `sport_golf_titleist_tsr2_driver`, `sport_golf_titleist_tsr3_driver`
  - `camera_sony_a6400`
- 각 lane: queries (자연어 + 모델 코드), pages (4~6), targetParseReady (60~150), priceMin/Max, acceptAll/acceptAnyOf, rejectLabelled (가품/구매요청/액세서리/다른 모델 등 8~10 패턴)
- 검증: tsc clean
- 위험: LOW (read-only Bunjang API 호출, DB 변경 0)

## 2. 8 lane mining 실행 결과

- 시간: 2026-05-14 KST
- 변경: `category-intelligence/<lane>/` 8 폴더 신규 생성 (parse_summary.json + samples 등)

| Lane | candidates | parse_ready | rejected | 상태 |
|---|---:|---:|---:|---|
| watch_gshock_ga2100 | 422 | 140 | 282 | ✅ 풍부 (target 150 미달이지만 양호) |
| watch_gshock_dw5600 | 221 | 125 | 96 | ✅ 양호 (target 80 초과) |
| watch_gshock_gmwb5000 | 101 | 40 | 61 | 🟡 thin (고가 모델, 정상) |
| watch_seiko_5_sports_srpd | 26 | 4 | 22 | 🔴 거의 없음 |
| watch_seiko_5_sports_sbsa | 1 | 1 | 0 | 🔴 사실상 부재 (일본 한정 가능성) |
| sport_golf_titleist_tsr2_driver | 163 | 116 | 47 | ✅ 양호 |
| sport_golf_titleist_tsr3_driver | 125 | 85 | 40 | ✅ 양호 |
| camera_sony_a6400 | 180 | 33 | 147 | 🟡 thin (body 명시 매물 적음, lens kit 압도적) |

- 위험: LOW. mining outputs는 학습/판단용, 사용자 노출 0.
- 다음:
  - **Seiko 5 SRPD/SBSA 폐기 검토** (별도 wave) — 한국 Bunjang에서 거의 없음, query 확장해도 회복 어려울 가능성
  - Sony a6400은 body 명시 매물 33건이라 lane 유지하되 카메라 정책 동일 (body_only strict)

## 3. 발견 — option-parser 카테고리 옵션 추출 누락 (별도 wave 필요)

- 시간: 2026-05-14 KST
- 발견: catalog 매칭 + parser test 결과:
  - **camera (Sony a6400)**: `camera|camera|camera_sony_a6400|body_only|no_lens` — 기존 camera 옵션 추출 정상 작동, needs_review=false
  - **watch (G-Shock GA-2100)**: `watch|watch_casio_gshock_ga2100` — **옵션 0**, needs_review=true → 풀 진입 못 함
  - **sport_golf (TSR3)**: `sport_golf|sport_golf_titleist_tsr3_driver` — **옵션 0**, needs_review=true
- 변경: 본 wave에서 변경 0. 별도 wave 필요.
- 검증: 6 매물 샘플 테스트로 패턴 확인.
- 위험: 현재 watch/sport_golf SKU 매칭되어도 풀 진입 0건 (needs_review로 escrow). 즉 시세 학습은 가능 (parsed 테이블 적재), 사용자 노출만 차단.
- 다음 (Wave 68):
  - `src/lib/option-parser.ts`에 watch 카테고리 옵션 추출 추가 (케이스 사이즈는 모델별 고정이라 모델만으로 충분, 다만 needs_review 정책 분기)
  - sport_golf 카테고리: 로프트 (도), 샤프트 플렉스 옵션 — 단 정밀도 confidence 따라 unknown_X 허용
  - 카테고리별 needs_review 정책: 모델 매칭 성공 + mustNotContain 통과 시 needs_review=false 가능하게

## 4. 종합

- catalog SKU 8개 (Wave 67)에 대해 mining infrastructure 완성: lane configs + parse_summary
- 시계 G-Shock + 골프 TSR2/TSR3는 **데이터 충분** (parse_ready 85~140), Bunjang 시장 검증 완료
- Seiko 5 SRPD/SBSA + Sony a6400은 **데이터 thin** — Wave 68 옵션 정책 결정 후 lane 폐기/유지 재검토
- option-parser 카테고리 옵션 추출은 **다음 wave**로 분리 (현 상태에선 시세 학습은 OK, 사용자 노출만 차단됨)

## 5. 잔여 blocker

- Wave 68: option-parser watch/sport_golf 카테고리 옵션 추출 + needs_review 정책 분기
- Wave 68 후속: Seiko 5 SRPD/SBSA inventory thin 대응 (lane 폐기 vs query 대폭 확장)
