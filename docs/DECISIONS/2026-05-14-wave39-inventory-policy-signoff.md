# Wave 39 — Inventory 정책 sign-off package (A/B/C)

> 2026-05-14 KST. 1-page. apply 0. owner 1안 선택용.

## 1. 배경
Wave 38: Phase 2 escrow gate ON 정상 작동, 단 narrow whitelist(iphone_{15,16,14,13,12}_pro) + parse_confidence≥0.55 게이트를 통과하는 eligible row = **1건** (24h 신규 0건). 결정론이 잘 작동할수록 escrow 모집단이 비는 구조. cron sign-off 자료를 모으려면 inventory 정책 결정 1회 필요.

## 2. 3안 비교

| 차원 | A. pro_max 편입 | B. conf floor 0.55→0.45 | C. parser storage patch |
|---|---|---|---|
| 동작 | `iphone\|iphone_{15,16}_pro_max\|` prefix 2개 추가 | 동일 5 SKU에 conf 0.45 row도 통과 | option-parser storage 추출 규칙 보강 |
| 신규 eligible (현 inventory) | **52건** (15_pro_max 25 + 16_pro_max 27, max_conf=0.60) | 22건 (16_pro 13 + 14_pro 4 + 13_pro 2 + 12_pro 3) | 가변. needs_review 모집단 자체가 줄어 escrow는 *감소* |
| Phase 2 escrow 활성도 | **즉시 의미 있는 발화 (cap=2 binding 도달 가능)** | 발화 발생하나 low-conf row 중심 | escrow는 약화, 결정론 path가 강화 |
| 정확성 영향 | pro_max는 catalog SKU 별도 존재. narrow 확장, broad 아님. AI가 storage 추정만 책임. | 0.45는 parser가 명시 정보 못 모은 zone. AI가 모델/storage/connectivity 동시 추정. 정확도 risk ↑ | 정확성 향상 방향 (명시 token 추출). 결정론 path 정확도 ↑ |
| 비용 | escrow 일 ~20-50건 호출 가정 시 월 $0.4~1 (cap=2 유지 시 더 낮음) | 동급 | 0 (parser patch는 호출 0) |
| 측정 가능성 | 1일 내 cron sign-off 자료 수집 가능 | 동일 | escrow는 안 늘어 sign-off 자료 보강 안 됨 |
| 회귀 risk | pro_max SKU catalog 정합성만 확인. 낮음 | parse_confidence 변경은 광범위 회귀 — escrow 외 path도 영향 | parser 변경 회귀 (테스트 필수) |
| 원칙 부합 | broad widening 아님 / silent 추정 아님 | silent 경계 (0.45는 명시 부족 zone) | 가장 안전 |

## 3. 추천 — **A. pro_max narrow 편입**

근거:
1. Phase 2 escrow가 작동해야 cron sign-off 자료가 생긴다. C는 escrow를 *비우는* 방향이라 본 목표와 반대.
2. inventory 실측 52건 + max_conf 0.60 > floor 0.55 → 게이트 통과 보장.
3. narrow whitelist 확장이지 broad 추정 아님. pro_max는 catalog에 이미 별도 SKU. 정확성 risk 최소.
4. AI가 추정할 잔여 차원은 **storage**만 (모델/series는 결정론으로 fixed). Phase 2 설계 의도와 정합.

## 4. 각 안 리스크 1줄
- **A**: catalog의 pro_max SKU가 storage variant까지 충분히 정의돼 있지 않으면 AI 추정 결과를 받아도 SKU 매칭 실패 위험 (사전 catalog 확인 필요).
- **B**: parse_confidence 0.45 row는 storage 외에 carrier/connectivity 명시도 부족해 AI가 silent 추정으로 흐를 가능성 — 원칙 경계.
- **C**: parser 변경 회귀 위험 + escrow 모집단 감소로 cron sign-off 자료 수집은 더 늦어짐.

## 5. 추천안 적용 시 다음 단계 (Wave 40 예고)
1. `src/lib/ai-l2-escrow.ts`의 `SMARTPHONE_NARROW_PREFIXES`에 2개 추가:
   - `iphone|iphone_15_pro_max|`
   - `iphone|iphone_16_pro_max|`
2. catalog의 `iphone-15-pro-max`, `iphone-16-pro-max` SKU + storage variant 정합성 확인.
3. tsc + test:core 재실행.
4. 1 tick fire로 selected>0 확인 + DB measurement.
5. 24h 자연 누적 후 cron sign-off 재제출.

비채택안 (B, C):
- **B**는 Wave 40에서 다루지 않는다 — 원칙 경계 분명.
- **C**는 별도 wave(Wave 41+)로 분리: parser precision 작업은 정확성 작업이라 escrow와 무관하게 가치 있음. 사인오프 별도.

## 6. 원칙 ack
- apply 금지: ✓ (본 wave 0 apply)
- cron live 등록 금지: ✓
- broad smartphone widening 금지: ✓ (추천안 A는 narrow 확장)
- silent carrier 추정 금지: ✓ (추천안 A는 storage만 AI 책임)
- decision package only: ✓

## 7. Sign-off 옵션
- [ ] **Approve A** (pro_max 편입) — Wave 40에서 코드 patch + 측정.
- [ ] Approve C (parser patch) — Wave 41 별도 wave로 분리 진행, escrow는 dormant 유지.
- [ ] Reject all — Phase 2 dormant 영구 수용 (cron sign-off는 폐기).
- [ ] Approve A + C (병렬) — Wave 40 = A 패치, Wave 41 = C 패치.

## 8. 변경/검증/위험
- 변경: 없음 (decision package only)
- 검증: Wave 38 baseline + production DB needs_review 분포 실측
- 위험: 없음
- 다음: Wave 40 — owner 선택안 적용 (default A 예상)

## 9. 남은 blocker
1. **inventory 정책 owner 사인오프** — 본 패키지가 그 자료 (← 결정 대기)
2. housekeeper cron + live merge — sign-off 결과에 따라 #1 다음 24h 측정 후 재제출
