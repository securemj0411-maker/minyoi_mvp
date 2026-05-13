# Wave 49 — Parser storage 정확도 audit + 회귀 가드 (코드 patch 0)

> Status: **measure + test-only.** DB write 0, DDL 0, escrow gate OFF 유지, parser 코드 변경 0. fixture 회귀 가드 13개 추가, 133/133 tests pass.

## 1. 시작 가정 vs 실측

| 가정 (Wave 48 후) | 실측 (Wave 49) |
|---|---|
| parser storage precision 개선 여지 큼 (`1T/1TB/테라/512/256` 누락) | 현재 v31 parser가 모든 explicit pattern을 이미 정확히 처리 |
| 코드 patch 필요 | **코드 gap 없음.** patch 불필요 |

## 2. 현재 parser (`option-parser.ts:227-242 parseStorageGb`) 동작 확인

13 fixture trace 결과 (`scripts/wave49-storage-trace.ts`):

| 입력 패턴 | storageGb | comparable_key suffix |
|---|---:|---|
| `아이폰15프로맥스 화이트` (storage 없음) | **null** | `unknown_storage` ✓ |
| `아이폰15프로맥스 1T 화이트티타늄` | 1024 | `1024gb` |
| `아이폰15프로맥스1테라 정품 자급제` (glued) | 1024 | `1024gb` |
| `아이폰15프로맥스1테라유튜버하실분...` (glued + suffix) | 1024 | `1024gb` |
| `아이폰16프로맥스 1테라` (space) | 1024 | `1024gb` |
| `아이폰15프로맥스 블루 티타늄` + desc `1테라` | 1024 | `1024gb` |
| `아이폰16 프로 256` (bare 256) | 256 | `256gb` |
| `아이폰15프로맥스1tb` | 1024 | `1024gb` |
| `아이폰16프로 256g` | 256 | `256gb` |
| `아이폰 14 256기가` (prod pid 407837718 그대로) | 256 | `256gb` |
| `아이폰 16e 126gb 풀박스` (typo) | **null** ✓ (precision > recall) | `unknown_storage` |
| `아이폰15프로맥스1테라티타늄컬러` (suffix glued) | 1024 | `1024gb` |
| `아이폰15프로맥스 2테라` | 2048 | `2048gb` |
| `용량 256gb` desc | 256 | `256gb` |

→ 12/14 자연 매칭, 2/14 의도된 null (storage 명시 없음 OR typo). **explicit-only, silent 추정 0.**

## 3. 회귀 가드 — `tests/iphone-storage-parser.test.ts` (13 cases)

추가된 fixture 테스트:
- explicit `256기가`/`256g`/`256` bare
- `1T` (space, 글자) / `1tb` (compact) / `1테라` (glued/space/desc-only/suffix-glued)
- `2테라`
- `용량 256gb` prefix path
- precision guard: storage 없음 → null
- precision guard: `126gb` typo → null

테스트 결과: `npx tsc --noEmit` clean, `npm run test:core` **133/133 pass** (기존 120 + 신규 13).

## 4. Read-only replay 측정 — DB unknown_storage iphone 133 rows

`scripts/wave49-storage-replay-readonly.ts` (read-only, DB write 0):

| Metric | Value |
|---|---:|
| sampled DB rows (needs_review iphone unknown_storage) | 133 |
| parser_version breakdown | v24:7 / v26:113 / v27:3 / v30:6 / **v31:4** |
| current parser가 재파싱 시 resolve | **20 (15%)** |
| 그 중 1024gb (1TB) | 19 |
| 256gb | 1 |
| 재파싱해도 여전히 null | 113 (85%) |

해석:
- 코드는 정확. unknown_storage rows의 대부분이 v26 이전 legacy 시점에 파싱됨.
- 재파싱 시 15% 회복 (주로 `1테라` glued/typed 패턴). 85%는 본문에 storage 명시 자체가 없어 silent inference 금지 정책상 null이 정확.
- v31 stale rows 4건 중 `아이폰 14 256기가`처럼 본문에 명시된 케이스가 현재 코드로 resolve. v31 production parser와 local v31 사이의 미세 drift 의심 (어느 시점 deploy 이후 patch가 적용된 듯).

## 5. 정책 정합성 (목표 vs 결과)

| 목표 | 결과 |
|---|---|
| unknown_storage / wrong_storage / 1T/1TB/테라/512/256 누락 줄이기 | 코드는 이미 처리, 누락은 stale DB row 문제 |
| explicit storage만 파싱 | ✓ (silent inference path 없음) |
| silent storage 추정 금지 | ✓ (storage 없는 row → null 유지) |
| confidence/needs_review 정책 유지 | ✓ (parser code 0 change → conf/needs_review 정책 0 변동) |

## 6. 권고

본 wave에서는 **코드 변경 없음**이 정답. 추가 lift는 다음 중 1개로 분리:

A. **Wave 50 — stale parser_version row 재파싱** (DB write 필요, owner 사인오프 별도 wave).
   - lift 추정: 133 unknown_storage iphone row 중 20건 (~15%) resolve.
   - 전체 needs_review pool에 동일 작업 적용 시 lift는 더 큼 (smartphone+tablet+laptop 모두 v24/26/27/30 비중 큼).
   - risk: parser 출력이 일부 row에 대해 parsed_json 구조 변경 → downstream 영향 (전수 검토 필요).

B. **유지** — Phase 2 escrow가 dormant 상태인 한 stale row 재파싱 lift는 user-facing pool에 도달하지 않음. 현 시점 ROI 낮음.

## 7. 원칙 ack
- escrow gate 재활성 금지: ✓
- AI L2 escrow 경로 건드리지 않음: ✓
- candidate_pool / public promotion 금지: ✓ (test/script만 추가)
- DB write/DDL 금지: ✓ (read-only replay only)
- small scoped fixture/test 우선: ✓ (13 cases)
- before/after replay 측정 필수: ✓ (`reports/wave49-storage-replay-readonly-latest.json`)
- silent storage 추정 금지: ✓
- confidence/needs_review 정책 유지: ✓

## 8. 변경/검증/위험
- 변경:
  - `tests/iphone-storage-parser.test.ts` (NEW, 13 fixture cases)
  - `scripts/wave49-storage-trace.ts` (NEW, diagnostic trace)
  - `scripts/wave49-storage-replay-readonly.ts` (NEW, read-only replay)
- 변경 0:
  - `src/lib/option-parser.ts` (parser 코드 patch 없음)
  - 운영 코드, DB, 환경변수, escrow gate
- 검증: tsc clean, 133/133 tests pass
- 위험: 없음 (read-only)
- 다음: Wave 50 — stale row 재파싱 (DB write) 사인오프 받거나 보류

## 9. 남은 blocker
1. R3 contentHash 더블체크 path (retention 트랙 후속)
2. (조건부) stale parser_version row 재파싱 sign-off (lift 15% 가능)

→ **남은 blocker 2건**. parser 코드 정확성 자체에 신규 blocker 없음.
