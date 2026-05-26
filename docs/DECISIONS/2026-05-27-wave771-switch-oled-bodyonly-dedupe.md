# Wave 771 — Switch OLED bundle 분리 + switch-2 dedupe (owner decisions A/B/C 처리)

- 시간: 2026-05-27 KST
- 트리거: LAUNCH_PLAN owner decisions 4개 user 답변 받음. A=분리, B=3개 추가, C=v24 재파싱, D=보류.

## 답변 받은 후 진단

### B (Switch 2 / PS5 Pro / Switch Lite 추가) → **이미 존재**
- Switch Lite: line 5406 ✓
- Switch 2: line 5431 + line 5483 (**중복** ⚠️ — 동일 id "switch-2"가 2번)
- Switch OLED: line 5454 ✓
- PS5 Pro: line 5875 ✓

→ B 답변은 catalog 추가 아니라 **switch-2 dedup만 필요**.

### C (v24 매물 360건 재파싱) → **outdated**
LAUNCH_PLAN 통계 (2026-05-13)는 2주 전. 현재 PARSER_VERSION=v61. DB 측정:
- v61: 25,560건 (현재 working version)
- wave92-shoe-v41: 22,423건
- wave216-clothing-v52: 19,861건
- v54: 14,462건, v55: 13,421건, v47: 6,966건 ...
- v24는 통계상 거의 없음

→ v24 reparse 무의미. **skip**. 진짜 옛 parser 매물 (wave92-shoe-v11 2,503건 등) 재파싱은 별도 측정 후.

### D (카테고리 ready 승격) → **보류** (user 답변대로)

## 변경

### `src/lib/catalog.ts`

#### 1. switch-2 dedup (B 답변)
- **line 5431-5450 entry 삭제** (Wave 111i broad — msrp 599k, less precise mustContain).
- **line 5483-5509 entry 유지** (Wave 758 narrow — laneKey=switch_2, msrp 480k, stricter mustContain).
- 동일 SKU id 중복 정의는 `ruleMatch()` collision 유발 (LAUNCH_PLAN §1.6d).

#### 2. switch-oled fullset/bodyonly 분리 (A 답변)
- **기존 `switch-oled`**: modelName 변경 ("Full Set 박스/독/조이콘 포함"), msrp 414k 그대로.
  - mustNotContain에 bodyonly indicator 추가: "박스 없음", "박스없음", "박스 X", "박스미포함", "본체만", "본체 단품", "본체 제외".
- **신규 `switch-oled-bodyonly`** (msrp 250k, fullset 대비 -40%):
  - mustContain 3번째 그룹에 bodyonly indicator 강제 ("박스 없음" OR "본체만" 등).
  - mustNotContain에 "풀박스/풀세트/박스 포함" (switch-oled SKU 양보) + "본체 제외/본체 분실" (액세서리만 매물 차단).

### DB 재분배
- 기존 `switch-oled` 박힌 active 180건 중 bodyonly 명시 **8건** → `switch-oled-bodyonly`로 sku_id/sku_name UPDATE + score_dirty=true.
- pid 407954739, 408147805, 7002276002728, 7000896889938, 7000031749905, 7002422386912, 393593131, 407207077 (모두 "박스 없음" 또는 "본체만" 명시).

## 검증
- `npx tsc --noEmit` catalog.ts 에러 0건 (Wave 771 패치).
- DB pre-update dry-run: 86 fullset 명시 / 8 bodyonly 명시 / 86 ambiguous (default fullset 유지) = 180건 active.
- post-UPDATE: 8건 정상 reassign.

## 위험
- switch-oled-bodyonly msrp 250k 추정 — 실제 시장 시세 측정 후 자동 보정될 것 (market-worker).
- 신규 SKU mustContain 3번째 group이 strict → 명시 안 한 bodyonly 매물은 default fullset (switch-oled)으로 흡수. 정확성 우선 (recall 손해).
- switch-2 dedup으로 broad msrp 599k 정의 제거 → narrow msrp 480k가 단일 source of truth. (599k는 출시가 추정, 시장 시세는 narrow가 더 정확.)

## 다음
- production replay 측정 (수 시간 후 신규 switch-oled-bodyonly 매물 inflow + 시세 학습 확인).
- AI L2 Phase 1 metadata bridge (LAUNCH_PLAN §4.2 — DDL 없는 ROI 최고 작업).
- 옛 parser 매물 재파싱 정책은 별도 측정 후 (현 v61 + wave92-shoe-v41 + wave216-clothing-v52가 메인).
