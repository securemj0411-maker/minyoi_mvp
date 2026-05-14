# Wave 86 — 강제 mining + catalog 수렴 + 시계 ready 승격

> Status: **applied (code + DB write 2).** sport_golf + watch ready 승격, catalog 강화, mining query 정리. autonomy + owner 결정 (Wave 86 브리핑 후).

CLAUDE.md 6 필드 포맷.

## 0.1 강제 mining + parser/catalog 진단 + 수렴

- 시간: 2026-05-14 KST
- 발견: 자연 cron cycle 대기 대신 `scripts/wave86-watch-camera-boost-diag.ts` 신규로 Bunjang find_v2 page 0~2 강제 fetch + ruleMatch + parseListingOptions inline 진단 (DB INSERT X).
- 결과 (1차 → catalog patch → 2차 binding rate):
  - DW-5600: 88% → 88% (이미 OK, parser 100%)
  - GMW-B5000: 94% → 94% (이미 OK)
  - GA-2100 (지샥 GA-2100/지얄오크): 35%→78%
  - Seiko 5 SRPD: 21% → **82%** (mustContain 완화 + Presage 격리)
  - Sony A7M3: 15% → **65%** (body 요구 제거 + A7R/A7S/A7C 격리)
  - Canon R6 Mark II: 26% → **74%** (body 요구 제거 + R6 Mark III/렌즈 키트 격리)
  - Sony A7C: 9% → 18% (catalog 격리는 작동, "소니 A7C" query 자체가 broad noise — Bunjang search returns A7CR/A7C2/A7S2/액자 등)
- 변경:
  - `scripts/wave86-watch-camera-boost-diag.ts` 신규.
  - `src/lib/catalog.ts`:
    - watch-seiko-5-sports-srpd: mustContain 완화 (["세이코","seiko"] + ["srpd","5kx"]) + Presage/Astron/SKX/킹세이코/그랜드세이코 격리.
    - camera-canon-eos-r6-mark-ii: body 요구 제거, R6 Mark III/렌즈 키트 패턴 격리 추가.
    - camera-sony-a7m3: body 요구 제거, A7R/A7S/A7C/렌즈 키트 격리.
    - camera-sony-a7c: body 요구 제거, A7CR/A7C II/A7M3/A7S2/렌즈 키트 격리.
  - `src/lib/pipeline-config.ts`:
    - "카시오크" query 폐기 (97% noise, 카시오 탱크/Edifice/Exilim 디카 흡수).
    - "ILCE-7C" query 폐기 (94% noise, 액자/은화/Slice75 흡수).
- 검증:
  - tsc clean (script tsc error는 production code 영향 X).
  - test:core pass.
  - 2차 diag report: `reports/wave86-watch-camera-boost-diag-latest.json`.
- 위험:
  - body 요구 제거 → 렌즈 키트 매물이 본체 SKU로 들어올 risk → mustNotContain "+ RF/+ EF/+ 24-/+ 70-" lens 키트 패턴 + 기존 CAMERA_BODY_ONLY_NOISE (렌즈/키트/세트) cross-reject로 보완.
  - A7C 18% — 결정론 한계 인정. 추가 unbound는 catalog로 잡을 게 아니라 query/AI L2 영역.

## 0.2 결정론 수렴 인정

- 시간: 2026-05-14 KST
- 발견: A7C unbound 분석 → 18% 잔여는 catalog mustNotContain 정상 작동 결과 (A7CR/A7C2/A7S2 등 다른 변형 reject). GA-2100 unbound 22%도 마찬가지 (GA-B2100/GM-2100/GAM-S2100 reject). 즉 **결정론 ceiling 도달**.
- 변경: 없음 (인정만).
- 검증: 측정값 그대로 → catalog 추가 강화 무의미.
- 위험: 없음.
- 다음:
  - A7C broad query noise → 별도 SKU 분리 (A7CR / A7C II) 고려 (별도 wave).
  - LAUNCH_PLAN §12b "결정론 70~90% ceiling, AI L2 fallback" 원칙 일치.
  - 시계 추가 SKU/한정판 등은 AI L2 또는 별도 narrow lane.

## 0.3 sport_golf + watch 카테고리 ready 승격

- 시간: 2026-05-14 06:38 / 06:47 KST
- 발견: 시계 4 SKU 평균 85% bind + parser 100%. 골프 TSR2/TSR3 100% bind + parser 100%. 모든 ready 지표 통과.
- 변경: DB UPDATE
  - `mvp_category_readiness` sport_golf → ready (label '골프', 2026-05-14 06:38:36)
  - `mvp_category_readiness` watch → ready (label '시계', 2026-05-14 06:47:54)
- 검증: returning row OK.
- 위험: 매우 낮음. 시세 신뢰도 양호 (parser 100%, binding rate 80%+).
- 다음:
  - 사용자 노출 1주 모니터링.
  - TSi/TSR + Presage/SRPD false positive 측정.

## 1. owner 결정 분류

| 항목 | 분류 | 상태 |
|---|---|---|
| sport_golf ready 승격 | owner 확정 (Wave 86) | ✅ |
| watch ready 승격 | owner 확정 (Wave 86) | ✅ |
| camera ready 승격 | **현 internal_only 유지** | A7C 18% binding → 별도 SKU 분리 후 재검토 |
| 닌텐도 OLED 정책 | **보류** | owner 결정 대기 |

## 2. 남은 catalog 약점 (결정론 ceiling)

| SKU | Binding | 한계 사유 |
|---|---:|---|
| Sony A7C | 18% | "소니 A7C" query 자체가 broad noise — A7CR/A7C II/A7S2/액자 등 흡수 |
| GA-2100 | 78% | unbound 22% = GA-B2100/GM-2100/GAM-S2100 (정확 reject) |
| DW-5600 | 88% | unbound 12% = 콜라보판 가격 wide / 다른 변형 (정확 reject) |
| GMW-B5000 | 94% | 최고 수준 |
| Seiko 5 SRPD | 82% | unbound 18% = Presage SRPD/SKX (정확 reject) |
| A7M3 | 65% | unbound 35% = 렌즈 키트 / A7R III / A7S III 흡수 |
| R6 Mark II | 74% | unbound 26% = R6 Mark III / 렌즈 키트 흡수 |

→ 추가 강화는 정확성 손해 risk 큼 → AI L2 영역.

## 3. 다음 가능 작업

1. A7C 별도 SKU (A7CR / A7C II) 분리 — broad noise 해소.
2. 카메라 narrow query 추가 ("ILCE-7M3", "ILCE-7C body" 등 모델 코드 강화).
3. AI L2 enable (LAUNCH_PLAN §4.5 미실현) — broad recall 처리.
4. 닌텐도 OLED 정책 결정 (owner).
