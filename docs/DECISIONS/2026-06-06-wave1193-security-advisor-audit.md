# Wave 1193 (audit) — 사이트 검토 + 보안 advisor 발견

날짜: 2026-06-06
상태: 발견 기록 + 내 RPC 즉시 차단 / 나머지 owner 결정

## 사이트 health (정상)

- 배포: Vercel Ready (ac2fd709 등)
- cron: 정상 (stale 소수 — tick 5/30, daangn worker 2/12 등 무거운 워커만 가끔; score/lifecycle/recovery 0 stale = Medium 효과)
- 피드: candidate_pool RPC 0.1초 (전 지역, Wave 1192e)
- lifecycle: backlog 63.5K 감소 중, 시간당 1.3만 처리
- decision log: 1192b/d/g 누락분 보강 완료

## 보안 advisor (get_advisors security)

### 🔴 ERROR — RLS 비활성 (anon 이 PostgREST 로 직접 읽기 가능)
1. `mvp_market_price_daily_per_source` — per-source 시세 (Wave 886)
2. `_audit_skus_baseline_20260527` — 임시 audit 백업 테이블
3. `mvp_market_blocked_key_prefixes` — 차단 prefix 목록

→ 시세/매물은 어차피 server(service_role)로만 읽지만, anon 이 DB 직접 긁는 노출. 정석은 RLS enable (server 는 service_role 이라 RLS 우회 → 영향 0).

### 🟡 WARN — SECURITY DEFINER 함수 anon/authenticated 직접 호출 가능
- `claim_mvp_lifecycle_checks`, `claim_scorable_raw_rows`, `ensure_pool_eligible_for_ready_categories`, `mark_scorable_score_dirty_by_comparable_keys`, `prune_raw_listings_dead_rows`, `sync_market_velocity_daily_for_category`, `wave978_backfill_daangn_lifecycle_chunk` — cron 전용(service_role)인데 anon 노출
- `nearby_daangn_ready_feed` (Wave 1192e, 내가 만듦) — **✅ 즉시 REVOKE 완료** (anon, authenticated)

### 🟡 WARN — 기타
- Auth leaked password protection 꺼짐 (Supabase 대시보드 토글)
- `pg_trgm` extension in public schema
- function search_path mutable 2개

### INFO (무시 가능)
- RLS enabled no policy 다수 — RLS 켜졌고 policy 없음 = service_role 만 접근, anon 차단됨 (정상)

## 조치

- ✅ `nearby_daangn_ready_feed` anon/authenticated REVOKE (내 책임분)
- ⏳ ERROR RLS 3개 + 기존 cron RPC anon revoke → owner 결정 (보안 정리 wave 제안)
- ⏳ leaked-pw → owner 대시보드

## 권장

"보안 정리 wave" 로 RLS 3개 enable + cron RPC anon revoke 한 번에. 명백한 노출 차단이고 server(service_role)는 영향 0. 단 RLS enable 전 anon 키로 읽는 클라이언트 코드 없는지 1회 확인 (시세/매물은 server-only라 안전 예상).
