# Wave 925 — 이어폰 상태 evidence 운영 shadow dry-run

Date: 2026-05-29

## 결정

- Wave 924에서 만든 `earphone_condition_evidence`를 바로 pool gate에 연결하지 않고, 운영 DB read-only dry-run을 먼저 수행한다.
- DB mutation, candidate_pool mutation, reparse mutation은 하지 않는다.
- 이번 wave 산출물은 운영 수치/샘플 확인용 리포트 스크립트와 false positive 보정이다.

## 구현

- 추가 파일:
  - `scripts/report-earphone-condition-evidence-shadow.ts`
- 스크립트 역할:
  - 현재 `mvp_candidate_pool`의 `earphone` + `ready/reserved` row를 읽는다.
  - `mvp_raw_listings`의 title/description_preview에 local `parseEarphoneConditionEvidence()`를 적용한다.
  - hard candidate/warning/source/signal/sample을 `reports/earphone-condition-evidence-shadow-latest.*`에 쓴다.
  - `reports/`는 gitignore이므로 운영 결과물은 커밋하지 않는다.

## 1차 dry-run 결과

- 대상: ready/reserved earphone pool row 200개
- hard candidate: 17개 (8.5%)
- 신호:
  - physical_damage 9
  - audio_output_issue 6
  - anc_or_transparency_issue 2
  - battery_degraded 1
  - mic_issue 1

## 발견한 false positive

- `깨끗`의 `깨`가 physical damage로 잡혔다.
- `음질 문제 전혀 없습니다`, `음질 문제 아예 없습니다`, `음질 좋고 깨끗합니다`가 audio issue로 잡혔다.
- `노이즈캔슬링 잘되고 ... 문제없고`가 ANC issue로 잡혔다.
- `소리는 잘 들립니다. 마이크 약간 이상함`에서 audio issue까지 같이 잡혔다.

## 보정

- physical damage는 `깨졌/깨짐/깨진/깨져` 등 명시 손상 표현만 잡도록 좁혔다.
- `깨끗/깔끔`은 physical negation으로 처리했다.
- audio issue는 `문제 있음/이상 있음/불량`처럼 실제 이슈 표현 위주로 좁혔다.
- `음질/소리 문제 없음`, `잘 들림`, `음질 좋음`을 negation으로 보강했다.
- ANC issue는 `문제 있음/이상 있음/작동 안 됨/지지직` 중심으로 좁히고, `노캔 잘됨/문제없음`을 negation으로 보강했다.

## 보정 후 dry-run 결과

- 대상: ready/reserved earphone pool row 201개
- hard candidate: 6개 (3.0%)
- warning-only: 29개 (14.4%)
- not-full-product: 0개
- 신호:
  - audio_output_issue 2
  - physical_damage 2
  - battery_degraded 1
  - mic_issue 1
- source:
  - daangn 5
  - bunjang 1
- 샘플상 남은 hard candidate는 모두 실제 구매 판단상 보류/차단 후보로 보인다.
  - 지지직 소리
  - 노캔/주변음 모드 지지직
  - 마이크 약간 이상
  - 충전부 깨짐
  - 배터리 빨리 닳음

## 보류

- 이번 wave에서는 pool gate 연결을 보류한다.
- 이유:
  - `parsed_json.earphone_condition_policy.mode`는 아직 `shadow_only`다.
  - 기존 row는 parser version bump/reparse 없이는 evidence가 채워지지 않는다.
  - gate 연결 시 기존 ready 6개를 어떻게 invalidate/reparse할지 운영 절차가 필요하다.

## 다음 작업

1. candidate-pool-builder에 earphone hard evidence gate를 추가한다.
   - 예: `earphone_condition_audio_output_issue`, `earphone_condition_physical_damage`
2. parser output mode를 `shadow_only`에서 gate 가능 상태로 바꿀지 결정한다.
3. 기존 ready 6개는 작은 scoped reparse/invalidation script로 별도 처리한다.
4. warning-only(`missing_parts`, `hygiene_or_stain`)는 ready 차단이 아니라 상세 UX/체크리스트/가격 보정 후보로 남긴다.

## 검증

- `npx tsx --test tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 23 pass / 0 fail
- `npx tsx --test tests/core-rules.test.ts tests/earphone-condition-evidence.test.ts tests/wave207-earphone-single-side-block.test.ts`
  - 138 pass / 0 fail
- `npm run build`
  - pass
