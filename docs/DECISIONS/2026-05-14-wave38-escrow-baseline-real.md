# Wave 38 — Phase 2 escrow baseline (dev alive, 2 manual ticks)

> Status: **measure-only.** apply 0, cron live 0, cap 변경 0. Wave 37의 "dev server OFF" 가정은 **틀렸음**. 실제로 dev server는 1일 13시간 가동 상태였고, 진짜 원인은 외부 cron이 일시 끊겼을 뿐. 본 wave에서 manual tick 2회 fire로 baseline 수집.

## 1. Dev server 상태 (정정)

```
$ ps -p 742 -o pid,etime,command
  PID     ELAPSED COMMAND
  742 01-13:39:33 next-server (v16.2.6)
$ curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/
HTTP 200
```

- PID 742, etime **1일 13시간 39분** (Wave 35 gate ON 이전부터 계속 가동).
- port 3000 200 OK.
- 내가 `npm run dev` 별도 실행 시도 → port 충돌로 실패 (`Another next dev server is already running.`). 기존 인스턴스 사용.

**Wave 37의 "dev server offline" 결론은 부정확.** 실제는 dev server 가동 + 외부 cron이 일시 끊긴 상태였다. 첫 tick fire 시 한 차례 Supabase fetch 에러 발생 (transient), 두 번째 fire부터 정상.

## 2. Manual tick fire 결과

`curl -X POST -H "Authorization: Bearer minyoi-cron-2026" http://localhost:3000/api/cron/tick?force=1` 2회.

| Metric | Tick 1 | Tick 2 |
|---|---:|---:|
| ok | true | true |
| scored | 143 | 150 |
| score_phase2_escrow_gate_enabled | **1** | **1** |
| score_phase2_escrow_selected | **0** | **0** |
| score_phase2_escrow_resolved_pass | **0** | **0** |
| score_phase2_escrow_held | **0** | **0** |
| score_phase2_escrow_unavailable_retry | **0** | **0** |
| score_needs_review_skipped | 7 | 0 |
| aiApiCalls | 0 | n/a |
| aiCacheHits | 4 | n/a |
| poolUpserted | 11 | n/a |

해석:
- **gate_enabled=1**: Next.js dev mode가 `.env.local` 자동 재로딩, `AI_L2_ESCROW_PHASE2_ENABLED=1`이 runtime에 반영됨.
- **selected=0**: gate ON에도 narrow whitelist + parse_confidence>=0.55 게이트를 통과한 row 0. Tick 1에서 needs_review 7건이 들어왔지만 전부 gate에서 차단.
- 모든 transition (pass/held/unavailable) = 0: selected=0의 자연 귀결.

## 3. Pool leak 재확인

```sql
SELECT
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_pending'=ANY(score_flags)) AS pending,  -- 0
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_held'=ANY(score_flags)) AS held,        -- 0
  (SELECT count(*) FROM mvp_listing_analysis WHERE 'ai_escrow_unavailable'=ANY(score_flags)) AS u,     -- 0
  (SELECT count(*) FROM mvp_candidate_pool p JOIN mvp_listing_analysis a USING(pid)
     WHERE 'ai_escrow_pending'=ANY(a.score_flags) OR 'ai_escrow_held'=ANY(a.score_flags)
        OR 'ai_escrow_unavailable'=ANY(a.score_flags)) AS pool_leak;                                   -- 0
```

`raw_seen_15m = 2854` — manual tick fire로 raw refresh 확인 (cron 가동 신호). **Pool leak = 0**. 단, escrow flag 부여된 row가 발생하지 않았으므로 여전히 **negative confirmation**.

## 4. AI cache write 재개 여부

| Metric | Value |
|---|---:|
| cache_total | 529 (unchanged) |
| cache_last_1h | 0 |
| 마지막 classified_at | 2026-05-13 16:40 UTC |
| Tick 1 aiCacheHits | 4 |
| Tick 1 aiApiCalls | 0 |

해석: cache는 hit만 발생, 새 API 호출 없음. 이유: escrow selected=0이므로 escrow 경로의 cache write도 없음. 비-escrow AI review path (legacy)는 shouldAiReview 조건을 만족하는 row가 있어야 하는데 이 tick에서 cache hit만 났다.

**AI cache write는 escrow 발화가 있을 때 재개.** 현재는 inventory 부족으로 기다림 상태.

## 5. Cron sign-off 판정

| 자료 | 필요 | 현재 |
|---|---|---|
| escrow_selected 일 누적 | 측정 | 0 (gate ON 이후) |
| escrow가 cache 증가에 미치는 영향 | 측정 | 0 (escrow 발화 없음) |
| pool 차단 positive confirmation | row 실측 | 없음 (negative만) |
| cap=2 binding 여부 | run-cap 도달 1회+ | 도달 0회 (inventory 1건) |

→ **cron sign-off 재제출 불가.** Phase 2 활성화는 코드/runtime/DB 모두 정상이지만, narrow whitelist + 명시 conf 게이트가 inventory를 너무 좁혀 측정 자체가 무의미한 수준. 24h~7d 자연 누적 또는 inventory 정책 재논의가 선행되어야 sign-off 자료가 의미를 가진다.

## 6. 구조적 발견

- Wave 36에서 본 "needs_review iphone 전부 `|unknown_storage` 종결" 패턴 그대로. parser가 storage 추출 실패한 row가 escrow 후보 모집단의 90%+.
- 명시 storage가 있는 narrow pro 시리즈는 parse_confidence가 충분히 올라가 결정론 path를 통과 → escrow 모집단에 안 들어옴. **결정론이 잘 동작할수록 escrow 자체가 비게 되는 구조.**
- pro_max 시리즈는 needs_review 인벤토리가 가장 큼 (16_pro_max 27건, 15_pro_max 25건)이지만 narrow whitelist 5개에서 의도적으로 제외 — broad widening risk 회피.

→ Phase 2 escrow의 실제 사업적 lift는 다음 중 하나가 결정되기 전까지 측정 불가:
  (a) pro_max 시리즈 narrow prefix 편입 (사인오프 필요)
  (b) parse_confidence floor 0.55→0.45 완화 (silent 추정 위험)
  (c) parser storage 추출 정확도 향상 (별도 wave, recall이 아닌 precision 작업)

(c)가 정책적으로 가장 안전. 단 본 wave 범위 외.

## 7. 원칙 ack
- apply 추가 금지: ✓
- cron live 등록 금지: ✓
- cap 변경 금지: ✓
- broad smartphone widening 금지: ✓ (whitelist 변경 0)
- silent carrier 추정 금지: ✓ (conf floor 변경 0)

## 8. 변경/검증/위험
- 변경: 없음 (manual tick fire 2회 = production runtime 정상 흐름)
- 검증: tick 2회 ok=true, gate_enabled=1, selected=0, leak=0
- 위험: 첫 tick fire 시 transient Supabase fetch fail 1회 → 자동 retry/재발사로 해소. 패턴이라기보다 우발적 네트워크 hiccup으로 판단.
- 다음: Wave 39 — **inventory 정책 사인오프 wave**. (a) pro_max narrow 편입 (b) parser storage 정확도 patch (c) 측정 그대로 대기 중 1개 owner 결정.

## 9. 남은 blocker
1. **inventory 정책 결정 (신규)**: 위 (a)/(b)/(c) 중 하나 owner 사인오프. 없으면 escrow는 사실상 dormant.
2. **housekeeper cron + live merge**: 측정 자료 부족 그대로. inventory 정책 결정 후 24h 자연 누적 → 재제출.

→ **남은 blocker 2건** (#1, #2). #2는 #1에 의존.
