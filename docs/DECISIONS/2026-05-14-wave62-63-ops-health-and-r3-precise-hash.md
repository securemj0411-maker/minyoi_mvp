# Wave 62-63 — ops health check + R3 정밀 hash 정합

> Status: **applied (code only).** DB write 0, candidate_pool 0, public 0, DDL 0. autonomy 범위 (사업 카테고리 변경 없음).

CLAUDE.md 6 필드 포맷.

---

## 0.1 Wave 62 — ops health snapshot (read-only)

- 시간: 2026-05-14 KST
- 발견: Wave 61 mining query 보강 후 시스템 전반 상태 한 번에 측정.
- 변경: 없음 (read-only SQL)
- 검증 (DB 측정):
  - `mvp_candidate_pool`: total 1046 = ready 363 / invalidated 666 / spent 17 (status enum은 ready/invalidated/spent, public·internal은 카테고리 readiness 레벨)
  - `mvp_detail_queue`: pending 328 / done(60m) 236 → 자연 drain rate 안정 (Wave 61 +10 query 유입 후 큐 부하)
  - `mvp_raw_listings(24h)`: 4529 (정상 수집)
  - `mvp_listing_parsed` parser_version: option-parser-v32 53 (current) / v31 16,828 (dominant) / v26+v24+v30+v27 = 38 (Wave 59 §0.2 언급 no_change rows, 선택적 정리 대상)
  - `parsed.needs_review=true`: 8,529 (broad recall AI L2 후보 모집단)
  - `raw.score_dirty=true`: 39,345 (자연 drain 중, Wave 59-D 마킹 15,257 외 자연 누적)
- 위험: 없음 (read-only)
- 다음: 큰 red flag 없음. parser_version v32 fresh rollover 정상 진행 중. ops 측정 결과는 별도 wave 트리거 없음.

---

## 0.2 Wave 63 — R3 정밀 hash 정합

- 시간: 2026-05-14 KST
- 발견: Wave 59 §0.3 R3 contentHash path는 production hash (PipelineRow full input) vs raw fingerprint (3-field subset)의 **prefix 8 char** 비교로 사실상 random match — `r3DeleteEnabled=true` 활성 불가. Wave 59 다음 액션 항목.
- 변경:
  - `src/lib/pipeline.ts:1099` `contentHash(row: PipelineRow)` 를 `export`로 노출. comment로 housekeeper 재사용 의도 + scoreFlags 한계 명시.
  - `src/lib/housekeeper-ai-cache.ts`:
    - `rawFingerprint` 제거 (3-field subset hash, prefix-8 비교 폐기)
    - `fetchParsedSnapshots(pids)` 신규 — `mvp_listing_parsed`에서 comparable_key / parse_confidence / needs_review / parsed_json fetch
    - `fetchRawSnapshots` 확장 — `sku_name` 추가 select
    - `reconstructHashRow(raw, parsed)` 신규 — production PipelineRow shape 재구성, parser metadata (unknownParts / criticalUnknown / escrowKind) 는 parsed_json에서 추출, scoreFlags=[] 대입 (한계)
    - `verifyR3Stale(pids)` — production `contentHash()` 재사용 + **exact equality** 비교. 일치 → fresh, 불일치 → stale 후보
  - `r3DeleteEnabled` default는 여전히 false (관찰만, Wave 59 정책 유지)
- 검증:
  - `npx tsc --noEmit` clean (전체 codebase)
  - `npm run test:core` 139/139 pass (135 → 139, Wave 60 이후 4 신규 테스트 추가됨)
- 위험:
  - **알려진 한계**: `scoreFlags`는 어느 테이블에도 persist되지 않음. AI 호출 당시 non-empty scoreFlags였던 row는 raw/parser 변경 없어도 mismatch → stale 후보로 잡힘. 보수적 (false-negative 허용, false-positive DELETE 차단). `r3DeleteEnabled=true` 활성 시 해당 row들은 cache miss → AI 재호출 → 비용 미미 ($0.001/row 수준, LAUNCH_PLAN §4.5a 기준).
  - false positive (잘못 DELETE) risk: 거의 0. exact hash equality → 모든 input field 일치 보장 (scoreFlags 외).
  - false negative (DELETE 못 함) risk: scoreFlags 있던 row 비율만큼. shouldAiReview trigger flag 보유 row → 보수적으로 cache 유지.
  - 첫 R3 발화 예상: cache 30d 도달 후 = 2026-06-08+.
- 다음:
  - cache 30d 도달 후 R3 candidates 발화 시 r3_hash_verified_* 측정.
  - 측정값 기반 `r3DeleteEnabled=true` 활성 여부 owner 결정 (false-positive 0 + false-negative 허용 가능 시 활성).
  - scoreFlags persist 필요성 owner 결정: 비용 vs hygiene trade-off — 현재 비용 낮아 보류 권장.

---

## 1. 결정 분류

| 항목 | 분류 | 근거 |
|---|---|---|
| ops health snapshot | autonomy 행동 (read-only) | 변경 0 |
| R3 contentHash exported + housekeeper 재사용 | autonomy 행동 | safety net 강화, default 비활성 유지 |
| scoreFlags persist column 추가 | autonomy 보류 | schema 변경 필요, 비용 미미 |
| r3DeleteEnabled=true 활성 | autonomy 보류 | 첫 발화 측정 (2026-06-08+) 후 결정 |

## 2. 남은 blocker (재정렬)

1. R3 첫 발화 측정 (cache 30d, 2026-06-08+)
2. 38 no_change parser_version 정리 (낮음)
3. Phase A backup DROP (2026-05-21+ 자동)
4. PS5 catch-up 완료 측정 (자연 시간)
5. Wave 57 +7 query SKU binding 측정 (자연 시간)
6. Wave 61 +10 query catch-up 측정 + 경계 3 cleanup (자연 시간 1~2h)
7. report-*.ts 483개 분류·통합 (orphan 319 + model-level 정밀 리포트 분리)
8. 사업 카테고리 신규 사인오프 (시계/골프/카메라) — owner

→ **남은 blocker 8건** (1 자연 시간, 2 낮음, 3 자동, 4·5·6 자연 시간, 7 별도 wave, 8 owner)
