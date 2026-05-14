# Wave 95 — 사기 패턴 broader audit + marginal 정밀화 + narrow lane audit

> Status: **applied (code + audit).** 사용자 노출 사기 매물 사실상 0 확인. 3 narrow lane (Wave 93 승격) 0% pollution 달성. catalog NOISE 결정론 한계 도달 — 추가는 AI L2 영역.

CLAUDE.md 6 필드 포맷.

## 0.1 Marginal SKU 추가 정밀화 (결정론 한계 도달)

- 시간: 2026-05-15 10:00 KST
- 발견: Wave 94에서 MARGINAL 16 SKU 패턴 분석. 5가지 원인 식별:
  1. 케이스/액세서리 변형 (범퍼 락 / 가죽 / 한정 / 거치대 NK)
  2. 가품 anxiety (특A급 / 100% 정품 anxiety)
  3. 구형 모델 매칭 (broad SKU에 옛 변형) — **audit 측정 오해**, 실제 pool은 comparable_key별 시세 분리되어 정상
  4. 한정판/콜라보 (조슈아 비데스 G-Shock, 버스트다운 다이아 ga2100, GMW-B5000GD 한정 색)
  5. 가격 outlier (새상품 retail 가까운 가격) — 결정론 영역 아님 (madTrim)
- 변경:
  - `EARPHONE_NOISE_W94` 확장: 범퍼 락, 가죽 케이스, 샤넬 에어팟, 한정 케이스, 특A급, 노캔X
  - `TABLET_NOISE_W94` 확장: 거치대 NK, 아이패드 거치대
  - `WATCH_NOISE` (base) 확장: 조슈아 비데스, 버스트다운, 다이아, vvs, 모이사나이트, GMW-B5000GD, DW-5600JV (한정 콜라보 모델 코드)
- 검증: pollution audit iter4 결과:
  - HIGH 0 → 1 (airpods-4-anc 새상품 retail 가격 outlier — 결정론으로 못 잡음, madTrim 영역)
  - MARGINAL 16 → 10
  - SAFE 17 → 20 → 24 (narrow lane 포함 후)
- 위험: 매우 낮음. NOISE는 의도된 specific 변형만 추가.
- 다음: 남은 HIGH 1 + MARGINAL 10은 결정론 한계 + 표본 누적 영역. 추가 patch ROI 작음.

## 0.2 LANE_READINESS narrow lane audit (Wave 93 후속)

- 시간: 2026-05-15 10:30 KST
- 발견: Wave 93에서 3 narrow lane (shoe_salomon_xt6_black / bike_trek_emonda_sl5 / bike_merida_bignine) ready 승격했지만 audit 안 함. Wave 95 audit 확장:
  - shoe-salomon-xt-6-black: 29건, 0% pollution ✅
  - bike-trek-emonda-sl5: 39건, **5.1% pollution** (marginal) — "구합니다 / 순정휠셋" 매물
  - bike-merida-bignine: 15건, 0% ✅
- 변경: `src/lib/generated/catalog-bike-wave91.ts` 자동 패치:
  - 모든 bike SKU mustNotContain에 "구합니다", "순정휠셋", "순정 휠셋", "휠셋 단품", "안장 단품" 추가
  - Python script로 일괄 적용 (33 SKU)
- 검증: 재실행 후 emonda-sl5 5.1% → **0%** ✅
- 위험: 없음 (단품/구매 표현만 reject).
- 다음: 3 narrow lane 모두 safe_ready 0% — Vercel 배포 후 사용자 추천 진입 시 안전.

## 0.3 사기 매물 broader audit

- 시간: 2026-05-15 11:00 KST
- 발견: 최근 7일 raw_listings 49,985건 sweep. fraud pattern 6종 (사기조직 / 거래 anxiety / 가품 직접 표현 / 의심 거래 / abnormal_low / 도난 의심) 검색.
  - 매칭 35건. 단 **sku_id 배정된 매물 5건만 사용자 노출 risk**.
  - 5건 분석 결과 모두 **false positive** ("급처분 / 업자X / 개인판매" 같은 정상 표현). 진짜 사기 매물 아님.
  - **진짜 사기 매물 (전문사기조직 / 사기꾼 조심)은 모두 sku_id NULL** = catalog가 자동 reject 중. 사용자 노출 0.
- 변경: 없음 (catalog 이미 안전).
- 검증: `scripts/wave95-fraud-pattern-broader-audit.ts` + reports/wave95-fraud-broader-audit-latest.json.
- 위험: 없음.
- 다음:
  - 새 사기 패턴 발견 시 NOISE 추가.
  - "급처분" 같은 정상 표현 false positive — regex 풀어서 false alert 줄임 가능 (현 wave는 측정만).

## 1. 사용자 보호 최종 상태 (Wave 94 + 95 후)

| 카테고리 | 표본 양호 SKU 수 | HIGH (사용자 노출 risk) | MARGINAL |
|---|---:|---:|---:|
| earphone | 24 (16 lv + 5 marg + 2 safe + 1 HIGH) | 1 (airpods-4-anc 새상품 retail) | 5 |
| smartwatch | 7 safe + 2 marg | 0 | 2 |
| tablet | 3 safe + 1 marg | 0 | 1 |
| laptop | 0 safe + 2 marg | 0 | 2 |
| monitor | 2 safe | 0 | 1 |
| home_appliance | 1 lv | 0 | 0 |
| watch | 0 safe + 3 marg | 0 | 3 |
| sport_golf | 2 safe | 0 | 0 |
| **narrow lane (XT-6/Emonda/Big Nine)** | **3 safe** | **0** | 0 |

→ **HIGH pollution 1개** (airpods-4-anc 새상품 retail 가격 outlier — 정상 매물이지만 시세보다 비쌈, madTrim이 처리).

## 2. 결정론 영역 한계 명시

| 영역 | 결정론으로 해결 | AI L2 영역 / 시간 영역 |
|---|---|---|
| 케이스/액세서리 매물 | ✅ catalog NOISE | — |
| 부품 단품 매물 | ✅ catalog NOISE | — |
| 한정판/콜라보 시세 분리 | ✅ catalog NOISE | — |
| 가품 anxiety 매물 | ✅ catalog NOISE | — |
| 사기조직 매물 | ✅ catalog mustNotContain | — |
| 시세 outlier (가격만 이상) | ❌ | madTrim (이미 적용) |
| 새상품 retail 가격 | ❌ | madTrim |
| 가품 description 분석 | ❌ | **AI L2 영역** (LV 지피월릿 등) |
| 도난 자전거 | ❌ | UI 가이드 + 사용자 확인 |

## 3. 향후 작업 후보 (Wave 96+)

1. **AI L2 phase 1b** (LAUNCH_PLAN §4.5): LV 지피월릿 / 가품 가방 description 분석 → ready 승격
2. **자전거 narrow lane UI 가이드 통합** (Wave 93 USER_GUIDES md → PackRevealModal에 뱃지)
3. **사용자 피드백 → NOISE 자동 학습**: "이 매물 이상해요" 피드백을 catalog mustNotContain 후보로 자동 누적
4. **사기 false positive 줄이기**: "급처분 / 업자X" 정상 표현 분리

## 4. 거론 금지

- 닌텐도 Switch OLED — owner 명시 보류.
- 카메라 ready 재검토 — Wave 87 자연 대기.
- HIGH airpods-4-anc retail outlier 결정론 처리 시도 — madTrim 영역.
