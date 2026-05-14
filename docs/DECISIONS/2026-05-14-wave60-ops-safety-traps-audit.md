# Wave 60 — 운영 안전성 함정 3종 직접 점검 + 단일 RLS hole fix

> Status: **audit + 1 small DDL fix.** CLAUDE.md `## 함정` 3종 직접 코드/DB 점검. 2종은 이미 해결 (CLAUDE.md outdated), 1종에서 단일 hole 발견 후 즉시 fix.

CLAUDE.md 6 필드 포맷.

---

## 0.1 Trap 1 — `/api/debug/reset-db` NODE_ENV 가드

- 시간: 2026-05-14 KST
- 발견: `src/app/api/debug/reset-db/route.ts:57-58` 점검 결과 **이미 4중 가드 적용**:
  1. `process.env.NODE_ENV === "production" && process.env.ALLOW_DEBUG_RESET !== "1"` → 403 disabled
  2. `requireDebugAdmin(req)` — admin 인증
  3. `body.confirm === "RESET"` 리터럴 강제
  4. `DEBUG_RESET_SECRET` env 필수
- 변경: 없음 (이미 해결)
- 검증: route.ts 1-80 직접 read.
- 위험: 없음. CLAUDE.md `## 함정` "NODE_ENV 가드 없음" 문구는 **outdated** — 정정 필요 (별도 wave).
- 다음: CLAUDE.md 함정 섹션 update (선택).

---

## 0.2 Trap 2 — Pack open race condition

- 시간: 2026-05-14 KST
- 발견: `src/lib/pack-open.ts:507` 점검 결과 **`spend_and_record_pack_open` atomic RPC**가 이미 통합. spend + record 단일 트랜잭션, SECURITY DEFINER. 동일하게 `reserve_mvp_pool_candidates` / `commit_mvp_pool_reveal` / `release_mvp_pool_reservation` / `invalidate_mvp_pool_entry` 4 RPC도 SECURITY DEFINER 확인됨.
- 변경: 없음 (이미 해결)
- 검증: `pg_proc` query — 5 RPC 모두 `prosecdef=true`. route.ts 흐름: `openPack()` → 단일 RPC → 결과 반환. 분리 호출 없음.
- 위험: 없음. CLAUDE.md "spendUserCredits + openPack 분리 → double-spend 위험" 문구도 **outdated** — RPC 통합 후 race 해소됨.
- 다음: CLAUDE.md 함정 섹션 update (선택).

---

## 0.3 Trap 3 — RLS 정책 (단일 hole fix)

- 시간: 2026-05-14 KST
- 발견: 28 production 테이블 RLS 상태:
  - **23 테이블 DENY_ALL** (RLS on / policy 0) — anon·authenticated 기본 차단, service_role 우회 가동 중. 안전 default.
  - **4 user-facing POLICY_DEFINED**:
    - `mvp_listings`: anon/authenticated SELECT `true` (매물 카드 노출 의도)
    - `mvp_pack_opens` / `mvp_pack_reveals` / `mvp_reveal_feedback`: anon/authenticated ALL `false` (server-only)
    - 모두 정확한 의도된 설정
  - **1 hole: `mvp_listing_parsed_backup_wave50` RLS_OFF** — Wave 51에서 만든 backup, RLS 안 켜놓음. anon key로 직접 select 가능. description_preview 포함된 production parsed 사본이라 anon 노출 risk.
- 변경: `alter table public.mvp_listing_parsed_backup_wave50 enable row level security;` migration `wave60_backup_table_rls_enable` apply. policy 없음 → default DENY. comment에 Wave 60 RLS 활성 + service_role rollback 우회 명시.
- 검증: `pg_class.relrowsecurity=true` / policies=0 / service_role 영향 0 (Wave 51 rollback SQL 사용 시 service_role이라 통과).
- 위험: 매우 낮음. backup data 변경 0. service_role rollback path 정상 유지. anon noise gate 추가.
- 다음: 2026-05-21 backup DROP 시 본 RLS 설정도 함께 사라짐.

---

## 1. 종합 결과

| Trap | 결과 |
|---|---|
| reset-db NODE_ENV 가드 | ✓ 이미 해결 (4중 가드) |
| Pack open race | ✓ 이미 해결 (atomic RPC 통합) |
| RLS 정책 미흡 | ⚠️→✓ 1 hole 발견 후 즉시 fix (`backup_wave50` RLS 활성) |

CLAUDE.md `## 함정` 섹션의 reset-db/pack-open race 항목은 outdated — 실제 코드는 이미 정정됨. RLS 항목만 정확했는데 그것도 backup 임시 테이블 단일 케이스로 즉시 해소.

## 2. 변경/검증/위험
- 변경: DDL 1줄 (`alter table ... enable row level security` + comment)
- 검증: pg_class query / 5 RPC SECURITY DEFINER 확인 / 28 테이블 RLS status 일괄
- 위험: 없음 — 보안 강화 방향, 데이터 변경 0, service_role 우회 유지
- 다음: 자연 시간 작업 (PS5 catch-up / Wave 57 SKU 측정 / backup DROP)

## 3. 남은 blocker (재정렬, Wave 60 후)

1. R3 정밀 hash 정합 (cache 30d 도달 후, 한 달+)
2. 38 no_change parser_version 정리 (선택, 우선순위 낮음)
3. Phase A backup table DROP (2026-05-21+ 자동)
4. PS5 detail catch-up 완료 측정 (자연 시간)
5. Wave 57 +7 query SKU binding 측정 (자연 시간)
6. ~~CLAUDE.md `## 함정` 섹션 update~~ → Wave 60 동시 처리 완료 (reset-db / pack 4중 가드 / RLS 28 테이블 분류 명시)
7. 사업 카테고리 신규 사인오프 (시계 / 골프 / 카메라) — owner 결정

→ **남은 blocker 6건** (1·2 우선순위 낮음, 3 자동, 4·5 자연 시간, 7 owner)

## 4. CLAUDE.md 함정 섹션 retrofit (본 wave 추가)

- 시간: 2026-05-14 KST
- 발견: 본 wave §0.1·0.2 점검에서 reset-db NODE_ENV 가드 / pack open race 항목이 outdated. 다음 에이전트가 잘못된 가정으로 재시도 가능성.
- 변경: `CLAUDE.md:88-93 ## 함정` 섹션 3 항목 정정:
  - "팩 오픈 race" → "팩 오픈 atomic RPC" (Wave 60 점검 완료, race 해소 명시 + RPC 5종 SECURITY DEFINER 명시)
  - "RLS 정책 미흡" → "RLS 정책" (28 테이블 분류 명시, 신규 테이블 default 가이드)
  - "reset-db NODE_ENV 가드 없음" → 4중 가드 명시 (Wave 60 점검 완료)
- 검증: CLAUDE.md 라인 91-93 read 후 정합 확인.
- 위험: 없음 (doc only).
- 다음: 후속 에이전트가 CLAUDE.md 함정 섹션 읽고 reset-db/pack/race 재투입 방지.
