# 2026-05-14 Compliance Wave 1 — 법적 리스크 격상 1차

> 배경: `미뇨이_회색지대_운영_매뉴얼_2026-05-14.md` + `미뇨이 법적리스크 진단 (PPT).html` 기반 현재 코드/스키마 갭 분석 후, 분쟁 노출도 즉시 감소 작업 1차.

---

## 적용 1 — how-it-works 페이지 자백 표현 제거

- 시간: 2026-05-14 (세션 진행)
- 발견: `src/app/how-it-works/page.tsx` 공개 페이지에서 본인 침해 행위를 직접 광고 중. 분쟁 시 원고측이 디스커버리 없이 캡쳐만으로 자백 증거로 인용 가능. 야놀자 사건 패소 패턴.
  - line 32: `"번개장터 검색 결과와 상세를 계속 쌓고, 원본 매물 데이터를 저장합니다."` ← 최악
  - line 24/25: `status: "내부 학습"` ← 번개장터 약관 제37조 2호 "기계학습·인공지능 학습" 단어 매칭
  - line 232: `"내부 학습으로 묶어둡니다"` ← 동일 단어
  - line 221: 위 라벨의 스타일 비교 조건 (라벨 변경 시 같이 바꿔야 스타일 일치)
- 변경: 4군데 일괄 패치
  - `"내부 학습"` → `"비공개 검증"` (replace_all, line 24/25/221/232)
  - line 31 step 이름: `"1. 검색/수집"` → `"1. 데이터 모니터링"`
  - line 32 step 텍스트: `"공개된 매물의 가격·인기도 신호를 지속적으로 모니터링해, 시세 통계와 비교 인덱스로 가공합니다."`
- 검증: 표현만 변경, 기능/로직 영향 0. tsc/test 무영향.
- 위험: 없음. 사용자 인지 가능성도 낮음 (지원 카테고리 라벨 텍스트만).
- 다음: 없음. 완료.

---

## 보류 1 — User-Agent 정직 표기

- 시간: 2026-05-14
- 발견: 매뉴얼은 `User-Agent: Mignoi-Bot/1.0 (+https://mignoi.kr/bot)` 정직 표기를 권고 (hiQ v LinkedIn 미국 모델, "선의·공개성" 입증 핵심). 현재 `src/lib/bunjang.ts:6` Chrome 124 위장 중.
- 결정: **무기한 보류**.
- 이유:
  - 한국 번개장터는 차단 자체가 법원에서 다투는 변수가 아님. 매각 직전 단계라 외부 위험에 더 공격적.
  - 정직 봇 UA = IP 단위 영구 차단 가능성 매우 높음. Vercel 인프라 단일 IP 풀 → 메인 트래픽도 같이 사망.
  - 1% 실험 트래픽도 같은 인프라면 의미 없음. 별도 IP/클라우드 필요한데 그 비용/복잡도 > 분쟁 시 입증력 향상 가치.
  - "Mignoi-Bot" UA 자체가 법무팀에 서비스 이름 노출 → C&D 트리거 빨라짐.
- 대체 — 같은 "선의 입증" 효과를 다른 5개로 보강:
  1. 법률의견서 사전 확보 (가장 강력)
  2. robots.txt 매일 fetch + 로그 보존 (모니터링 기록만, 실제 순응 X)
  3. Rate Limit 평시 cron 200→1500ms 완화
  4. Deep link 트래픽 환원 — 이미 적용 중 (`pack-reveal-modal.tsx:442`, `dashboard.tsx:891`)
  5. 시간대 02-06시 회피 (평시 cron만)
- 다음: 법률의견서 확보 후 변호사가 "그래도 정직 표기 필수" 의견 시 별도 인프라에서 재검토.

---

## 결정 1 — 원본 텍스트 보존 정책 = 하이브리드 TTL

- 시간: 2026-05-14
- 발견:
  - 매뉴얼 Layer 2는 raw 매물 데이터를 90일 TTL + hash 권고 (잡코리아 4.5억 패소 회피 패턴).
  - 현 `mvp_raw_listings`는 `name`/`description_preview`/`raw_json` 모두 영구 평문. P2-2에서 `mvp_listing_observation_payloads`의 `raw_json`만 90일 TTL 적용 완료, 동일 패턴 재사용 가능.
  - 코드 의존도 grep 결과:
    - `name`은 사용자 노출 필수 (`landing-showcases`, `candidates`, `score-output-mapper`, `pack-open`). NULL 시 카드 깨짐.
    - `description`은 score 재계산 시 `classifyListing`/`suspiciousModelText`/`hasNormalSignal`/`parseShippingFromDescription` 입력. 단 score 한 번 계산 후 `mvp_listing_analysis.score` 영구 저장 → 재계산 안 하면 영향 0.
    - `raw_json`은 코드에서 읽는 곳 없음 (저장만 함). 안전하게 비울 수 있음.
    - 시세/회전률은 `mvp_listing_observations.price`(영구 fact column) + `mvp_market_price_daily/velocity_daily`(영구 통계) 기반. raw text 의존 X.
- 결정: **하이브리드 정책**
  | listing_state | name | description_preview | raw_json | thumbnail_url |
  |---|---|---|---|---|
  | `active` | 보존 | 90일 후 NULL | 90일 후 NULL | 보존 |
  | `sold_confirmed`/`disappeared`/`archived` | 30일 후 NULL | 30일 후 NULL | 30일 후 NULL | 30일 후 NULL |
- 이유:
  - active 매물 name 보존 = 사용자 노출 안전.
  - 죽은 매물 전부 NULL = 매물 시계열 통째 사라짐 → "원본 영구 복제" 회피 90% 달성.
  - 분쟁 시 입증: "active 동안만 노출용 캐시, 죽으면 30일 후 폐기".
- 대안 검토:
  - 옵션 "raw_json만 90일 TTL" → name/description 영구 보유 = 잡코리아 패턴 그대로. 탈락.
  - 옵션 "+ `mvp_listing_tags` 신규 테이블로 태그 추출" → YAGNI. 추후 키워드 분석 기능 만들 때 그때 추출. 지금 미리 만들지 않음.
- 추후 후회 가능성 점검:
  - 가격 시계열/회전률 그래프 = `observations.price` + `market_*_daily` 영구. 무관.
  - 키워드 트렌드 = parser가 이미 `comparable_key`로 추출 중. active 매물에서 신호 계속 받음. 무관.
  - 사기 패턴 학습 = active + 사용자 신고로 충분. 죽은 매물 텍스트 없어도 가능. 무관.
  - 사진 갤러리 = 어차피 self-host 안 함 → 번개장터 CDN URL은 정책 무관하게 만료. 별개 문제.
  - 자체 AI 학습 = 약관 제37조 2호 명시 금지. 절대 하면 안 됨.
- 검증: 아직 미적용. 다음 단계에서 schema migration + housekeeperStage 호출 추가 + 일회 백필 스크립트 진행 예정.
- 위험: 30일 컷오프가 너무 짧으면 죽은 매물 시계열 분석 (예: "이 모델은 평균 며칠 만에 팔리는가") 영향. 단 회전률 통계는 `velocity_daily`에 영구 보존되므로 raw text 없이도 계산 완료된 결과는 보존됨.
- 다음: schema migration SQL + housekeeperStage 호출 2줄 추가 + 일회 백필 스크립트 작성 → OK 후 적용.

---

## 결정 2 — 셀러 정보 처리 방향

- 시간: 2026-05-14
- 발견:
  - `mvp_raw_listings.seller_uid`/`seller_name`, `mvp_sellers.seller_uid`/`seller_name` 평문 저장 중.
  - 코드 grep 결과:
    - `seller_uid`는 `market-math.ts:27`에서 시세 dedup 키로 사용 ("같은 셀러 매물 중복 카운트 방지"). 같은 셀러 식별만 가능하면 됨 → hash로 충분.
    - `seller_name`은 `tick-pipeline.ts`에서 저장만 하지 UI/score/parser 어디서도 안 읽음. 저장 자체 폐기 가능.
- 결정:
  - `seller_uid` → SHA-256 hash로 변환 후 저장 (dedup 동작 보존).
  - `seller_name` → 컬럼 자체 폐기 (raw_listings, sellers, listing_observations 모두).
- 이유: 개보법 위험 (셀러 닉네임 = 식별 가능 개인정보) 즉시 제거. 사업 영향 0.
- 검증: 아직 미적용. 다음 단계에서 migration + 일회 백필 + tick-pipeline 코드 수정.
- 위험: 기존 데이터 hash 변환 시 dedup 키가 바뀌므로 시세 계산이 일시 영향. 단 hash는 일관되므로 신규 수집은 정상 동작. 백필 시점에 한 번만 재계산.
- 다음: migration + 백필 + tick-pipeline 수정 → OK 후 적용.

---

## 미결 — 다음 wave 후보

- Rate Limit 평시 cron만 200→1500ms (사용자 실시간 트리거는 그대로 유지)
- 시간대 회피 — 평시 cron만 02-06시 회피
- robots.txt 매일 fetch + 로그 보존 (실제 순응 X, 모니터링 기록만)
- 코드 변수명/문서 sweep — `crawl`/`수집`/`우회`/`차단 회피` 일괄 치환

---

## 적용 2 — Compliance Wave 1.1 Phase A: raw_listings 텍스트 retention 인프라

- 시간: 2026-05-14 (Phase A)
- 발견: Decision 1 (하이브리드 TTL) 적용을 위한 인프라. 초기 안은 `tick-pipeline.ts` (3448줄 God file) 안의 `housekeeperStage`에 호출을 직접 박았으나, 사용자 review에서 4가지 지적:
  - (1) tick-pipeline blast radius 큼 → 별도 모듈 + 별도 cron route로 분리
  - (2) SQL WHERE 조건 NULL-safe로 (coalesce + jsonb 빈 비교)
  - (3) RPC 결과 처리 강화 (res.ok 체크, 파싱 실패 throw — 0건으로 삼키지 않음)
  - (4) dead 매물 이미지 URL 삭제는 별도 wave (Wave 1.2)로 분리, 이번엔 text만
- 변경:
  - `mvp/supabase/schema.sql`: 끝에 함수 2개 append
    - `prune_raw_listings_active_text(p_days int default 90, p_batch_limit int default 5000, p_dry_run bool default false)`
    - `prune_raw_listings_dead_text(p_days int default 30, p_batch_limit int default 5000, p_dry_run bool default false)`
    - 둘 다 `security definer` + service_role grant. public/anon/authenticated revoke
    - WHERE 조건 모두 `coalesce(col, '') <> ''` 또는 `coalesce(raw_json, '{}'::jsonb) <> '{}'::jsonb` 로 NULL-safe
    - `p_dry_run=true` 시 update 없이 대상 row count만 반환
    - active 함수는 `listing_state='active'` 만 대상, dead 함수는 `listing_state in ('sold_confirmed','disappeared','archived')` 만 대상
    - active update set: `description_preview=''`, `raw_json='{}'::jsonb`. name/thumbnail_url/image_url_template 보존
    - dead update set: `name=''`, `description_preview=''`, `raw_json='{}'::jsonb`. 이미지 URL은 Wave 1.2까지 보존
  - `mvp/src/lib/compliance-retention.ts`: 신규 격리 모듈
    - `runRawTextRetention({ dryRun, activeDays?, deadDays?, batchLimit? })` 단일 진입점
    - `callPruneRpc`에서 res.ok 체크, JSON/raw 문자열 모두 처리, 파싱 실패 시 throw
    - 한 step 실패해도 다른 step은 진행, 결과 `steps[]`로 반환 (호출자가 partial failure 판단)
  - `mvp/src/app/api/cron/compliance-retention/route.ts`: 신규 cron route
    - `GET`/`POST` 둘 다 지원, `checkCronAuth` + `acquireCronGuard("compliance_retention", req)` 사용
    - query param: `dry_run`, `active_days`, `dead_days`, `batch_limit` 전부 clamp 적용
    - 응답: `{ ok, mode, dryRun, params, totalCount, steps, startedAt }`. partial failure 시 status 207
    - `console.info` / `console.error` 로 로그 박힘 (steps 전체 포함)
  - `mvp/src/lib/cron-guard.ts`: 3군데 patch — `CronWorkerMode` union + `DEFAULT_COOLDOWN_MS` + `DEFAULT_LEASE_MS`에 각 1줄 `compliance_retention` 추가. tsc 타입 에러 해소용. 로직 변경 0, 신규 cron mode 선언만 (다른 cron mode 추가와 동일 패턴)
  - `tick-pipeline.ts`: **0줄 변경** (CLAUDE.md God file 금지 원칙 준수)
  - `vercel.json` / cron 등록: **이번 phase 미적용** (Phase B에서 진행)
- 검증 (Phase A 마무리 시 진행 — 사용자 요청 4가지):
  1. active prune 대상 row count → `/api/cron/compliance-retention?dry_run=1` 호출 후 `steps[scope=active].count`
  2. dead prune 대상 row count → 동일 응답의 `steps[scope=dead].count`
  3. 그 대상 중 `pool_eligible=true` / `mvp_candidate_pool` 관련 row 수 → 별도 SQL select (decision 로그 또는 supabase SQL editor)
  4. route 수동 1회 호출 시 응답/로그 형식 확인 → 위 같은 endpoint 호출 결과
- 위험:
  - SQL 함수만 정의됨. vercel cron 등록 X. 자동 호출 발생 0. 명시적 호출(`?dry_run=0`) 없으면 데이터 변경 0
  - dry_run 호출은 update 0 — 데이터 영향 0, 단 큰 batch 시 count(*) 부하 있을 수 있음 (인덱스 활용 — `mvp_raw_listings_state_idx(listing_state, last_seen_at desc)` 사용 가능, last_changed_at 대신 last_seen_at 인덱스라 약간 비효율적이지만 batch limit으로 충분히 커버됨)
- Rollback:
  - Level 1: cron 등록 안 했으므로 자동 호출 자체가 없음. 즉시 안전
  - Level 2: SQL revoke로 함수 호출 자체 차단 — `revoke execute on function public.prune_raw_listings_active_text(integer,integer,boolean) from service_role;` 동일하게 dead도. 즉시 cron route는 RPC 실패로 반환
  - Level 3: 신규 두 .ts 파일 제거 + schema의 함수 두 개 drop. 기존 코드 영향 0
  - 데이터 복구: dry_run 단계에서는 변경 0이라 복구 불필요. apply 후 데이터 복구는 `raw_json`은 `mvp_listing_observation_payloads` 최신 row에서 부분 복원 가능 (90일 TTL 전), `name`/`description_preview`는 영구 손실
- 다음:
  - Phase A: 위 4가지 dry-run 검증 결과 보고 → **완료, 적용 3 참조**
  - Phase B: 검증 통과 시 cron 등록 1줄 추가 → **완료, 적용 3 참조**

---

## 적용 3 — Compliance Wave 1.1 Phase A 검증 + Phase B 활성화

- 시간: 2026-05-14 (Phase A 검증 + Phase B 머지)

### Phase A 검증 결과 (이상 없음)

dry-run 4가지 직접 실행 (Supabase MCP `execute_sql` + dev server `localhost:3000` curl):

| 항목 | 값 | 판단 |
|---|---|---|
| `prune_raw_listings_active_text(90, 5000, true)` | **0** | 정상 — 컷오프 도달 row 없음 |
| `prune_raw_listings_dead_text(30, 5000, true)` | **0** | 정상 |
| pool 영향 (active+dead 둘 다): `total_target` / `pool_eligible_count` / `in_pool_count` / `in_active_pool_count` | **0 / 0 / 0 / 0** | 정상 — 컷오프 도달 row 자체가 0이라 pool 잔재 0 |
| route 응답 (`GET /api/cron/compliance-retention?dry_run=1&force=1`) | `{ok:true, mode:"compliance-retention", dryRun:true, params:{activeDays:90, deadDays:30, batchLimit:5000}, totalCount:0, steps:[{scope:"active", durationMs:105, ok:true, count:0}, {scope:"dead", durationMs:105, ok:true, count:0}], startedAt:"..."}` | 정상 — JSON 스키마/HTTP 200/console.info 로그 모두 정상 |

### Phase A — 데이터 분포 sanity check

```
total_rows: 38,557
active_total: 37,821
dead_total: 695
oldest_changed: 2026-05-09
newest_changed: 2026-05-13
older_than_90d: 0
older_than_30d: 0
```

서비스 raw_listings 데이터가 약 5일치라 90/30일 컷오프 도달 row 자연 0. 정상.

### Phase A — 함수 동작 입증 (짧은 TTL 강제 시)

`active_days=1, dead_days=1, batch_limit=10` 강제 호출:
- `active`: 32,346 매칭 (`active_total` 37,821의 86%)
- `dead`: 678 매칭 (`dead_total` 695의 98%)
- duration: 88~136ms

`listing_state` 분기 + `last_changed_at` 컷오프 + NULL-safe `coalesce` 모두 정상 작동. dry-run에서는 batch_limit 미적용 (count 전체 반환 — 의도된 동작).

### Phase A — 인증 검증

`Authorization` 헤더 없이 호출 → `HTTP 401 { ok:false, error:"unauthorized", reason:"missing_authorization" }`. `checkCronAuth` 정상.

### Dev cooldown note (비치명)

dev server 첫 호출 시 `cron-guard` cooldown skip 발생 — 원인은 [cron-guard.ts:103](mvp/src/lib/cron-guard.ts:103)의 `globalThis.__minyoiCronGuard` 상태가 모듈 hot-reload 사이에도 유지되기 때문. dev 재호출은 `?force=1` query param으로 우회. 운영 환경은 Vercel cron이 일일 1회만 호출하므로 cooldown 60s 무관.

### Phase B — vercel cron 활성화

- 신규 파일: `mvp/vercel.json`
  ```json
  {
    "crons": [
      { "path": "/api/cron/compliance-retention", "schedule": "0 19 * * *" }
    ]
  }
  ```
- 스케줄: UTC 19:00 = **KST 04:00 매일** (한국 새벽, 부하 최저)
- query param 없이 호출 → default 90일(active) / 30일(dead) / batch 5000
- production 배포 후 활성. dev 무영향
- Vercel Hobby/Pro 모두 일일 1회 cron 지원

### Phase B — 효과 타임라인

| 시점 | 효과 |
|---|---|
| 머지 ~ +30일 | cron 매일 04:00 KST 실행, 두 step 모두 `count:0` 반환 (데이터 미성숙) |
| +30일 (2026-06-13 부근) | dead 매물 30일 컷오프 도달 시작 → 죽은 매물 텍스트 NULL 처리 시작 |
| +90일 (2026-08-12 부근) | active 매물 90일 컷오프 도달 시작 → 늙은 active의 description_preview/raw_json NULL 처리 시작 |

### Phase B — 운영 모니터링 권고 (사용자 측)

- Vercel logs에서 매일 `[compliance-retention] run complete` 라인 확인 (steps[].count, durationMs)
- 매월 1회 supabase에서 oldest_changed 추세 확인 — 실제 prune 작동 입증
  ```sql
  select min(last_changed_at) as oldest, max(last_changed_at) as newest
  from public.mvp_raw_listings;
  ```
- 이상치 (cron 실패 누적, count 비정상 급증 등) 발견 시 Level 1 rollback = `vercel.json`에서 cron entry 제거 후 redeploy

### 검증: `npx tsc --noEmit` clean (Phase A 머지 시 확인). schema migration `compliance_wave1_raw_text_retention` 적용 완료 (Supabase MCP `apply_migration`).

### 위험

- vercel.json은 production 배포 시 즉시 cron 활성. 단 첫 30일 동안 prune 대상 0건 (데이터 미성숙)이라 production blast radius 사실상 0.
- production 배포 후 첫 1주일은 Vercel logs 매일 1회 확인 권장 (cron auth 정상, 5xx 없는지).

### 다음 (이 wave 마감, 추가 변경 없음)

- Compliance Wave 1.2: dead 매물 `thumbnail_url`/`image_url_template` 30일 TTL — 별도 검토
- Compliance Wave 2: `seller_uid` SHA-256 hash + `seller_name` 컬럼 폐기 — 별도 wave
- Compliance Wave 3: Rate Limit 평시 cron 1500ms / 시간대 02-06시 회피 / robots.txt fetch + 로그 — 별도 wave
- Compliance Wave 4: 코드 변수명/문서 sweep — 별도 wave

---

## 분리 — 별도 wave로 미루는 항목

- **seller_uid SHA-256 hash + seller_name 컬럼 폐기**: Compliance Wave 2 (이번 wave 혼합 X — 사용자 명시 요청)
- **이미지 URL retention (`thumbnail_url`, `image_url_template`) Wave 1.2**: dead 매물에 한해 30일 후 NULL 검토. self-host 안 함 → 저작권 위험 0, 분쟁 시 "보유" 외관만 — 우선순위 낮음
- **Rate Limit 평시 cron 1500ms / 시간대 02-06시 회피 / robots.txt fetch + 로그**: Compliance Wave 3 (운영 정책 wave)
- **문서/변수명 sweep (`crawl`/`수집`/`우회`/`차단 회피`)**: Compliance Wave 4 (위생 wave)

---

## 금지선 / 변경 정리 (현 시점)

- runtime 코드 변경:
  - `src/app/how-it-works/page.tsx` 1개 파일 (적용 1, 표현만)
  - `src/lib/compliance-retention.ts` 신규 (적용 2 Phase A)
  - `src/app/api/cron/compliance-retention/route.ts` 신규 (적용 2 Phase A)
  - `src/lib/cron-guard.ts` 3군데 patch (적용 2 Phase A, 신규 cron mode 선언만 — 로직 무변경)
- schema 변경: `mvp/supabase/schema.sql` 끝에 함수 2개 append (적용 2 Phase A)
- 신규 cron 등록: 0 (Phase B에서 진행)
- 기존 코드 로직 수정 (tick-pipeline.ts/pipeline.ts/option-parser.ts/catalog.ts 등): **0줄**
- 외부 차단 위험 동반 작업 (UA 변경): 적용 X, 보류
- 자동 호출 발생: 0 (Phase B 등록 전까지)
- tsc 검증: clean (Phase A 적용 후 `npx tsc --noEmit` 0 에러)
