# Wave 394.2 — 외부 review Tier 2/3 작은 정정 3개 (#14 #13 #20)

날짜: 2026-05-20
영역: pack-reveal-modal (협상 가이드 + 채널 비교 + ConditionChip)

## 배경

외부 review 부분 수용 13개 중 작고 안전한 카피/UI 정정만 묶음. 위계 재정렬 (#1/#7/#8) + #23 모드 토글 = 큰 작업 별 wave 분리.

원칙: Wave 394.1 단정형 정정 톤 (외부 review #22) 연장 — "왜 그런데?" 의문 1줄로 해소.

## 정정

| # | 항목 | 정정 위치 | 정정 내용 |
|---|---|---|---|
| **#14** | 협상 가이드 근거 부재 | `pack-reveal-modal.tsx` 협상 가이드 panel (L2503+) | "협상 시도 X원" line 아래 sub 1줄: `현재가 −{negotiationRoom}원 깎기 (차익의 30% 또는 최대 2만원)`. buyPriceGuidance.ts L42 산출식 노출 |
| **#13** | 채널 비교 단순화 (당근 무조건 좋아 보임) | `pack-reveal-modal.tsx` PlatformProfitCompare (L2497+) | 번개장터 + 당근 line 둘 다 리스크 chip 추가. 번개 = "전국 거래" + "안전결제" emerald, 당근 = "지역 제한" + "네고 부담" amber. 균형 잡힘 |
| **#20** | 사진 분석 부재 한계 | `pack-reveal-modal.tsx` LastVerifiedAtBadge (L514+) | ConditionChip 아래 1줄 추가: "AI가 매물 설명(텍스트) 기준 판단 · 사진은 직접 확인 권장". "앱이 사진 보고 condition 판정했다" 오해 차단 |

## 효과

- 사용자 직관 질문 ("왜 이 가격?", "당근이 진짜 더 좋아?", "AI가 사진 봤어?") 직접 해소
- 단정형 톤 → 조건부 톤 (외부 review #22 정신 연장, Wave 394.1 결)
- 신뢰도 boost (산출 근거 투명화)
- UI 변경 작음 (sub line + chip 만, 큰 layout 변경 X)

## 의도적 미수용

- **#5** 하단 CTA 작게 — 별 wave (CTA 크기는 conversion 영향. 사용자 비교 필요)
- **#18** 색상 의미 정리 — 전체 검토 큰 작업. 별 wave 가치
- 위계 재정렬 (#1/#7/#8) — 모달 layout 크게 흔드는 작업. 별 wave
- **#23** 초보/상세 모드 토글 — 사용자 명시 채택 큰 작업. 별 wave (Wave 394.5)
- **#24** 패스 조건 명시 — 우리는 차익 미만 매물 안 보여주는 방식. 추가 패스 조건 박을지 사용자 결정 필요
- **#21** /me 카드 "왜 추천" 1줄 — explore-client.tsx 변경. 별 wave

## 후속 (별 wave)

- **Wave 394.5**: #23 초보/상세 모드 토글
- **Wave 394.6**: 위계 재정렬 (#1/#7/#8) — UpperFold 압축, 정보 구조, FAQ → 리스크 카드
- **Wave 394.7**: #5 CTA 사이즈, #18 색상 일관성, #21 /me 추천 매물 비교 이유
- **Wave 394.B step 2/3**: fashion bag/clothing conditionFromText (shoe step 1 = Wave 254.5 ✓)

## 원칙

- 일반인 친화 단일 톤 (memory 룰 `project_core_principle_consumer_friendly`)
- 단정형 → 조건부 (외부 review #22 정신)
- 작은 변경 묶음 → 큰 wave 분리 (안전 + 검증 쉬움)
