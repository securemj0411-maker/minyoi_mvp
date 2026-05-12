# STATUS — Agent (iPhone 13 Pro 128GB self)

> 최종 갱신: 2026-05-12
> Branch: feature/iphone-13-pro-128-self
> Worktree: mvp-agent-a

## 현재 작업
- iPhone 13 Pro 128GB 자급제 narrow lane (15/16 패턴 그대로 13세대 sibling)

## 완료 (오늘)
- ✅ `iphone_13_pro_128gb_self`: mining + catalog wire 완료. READY_FOR_REVIEW (supply-limited).

## 산출

### 1. Mining — `category-intelligence/iphone_13_pro_128gb_self/`
- queries (4, 미션 spec 그대로):
  - "아이폰 13 프로 128 자급제"
  - "아이폰13프로 128 자급제"
  - "iphone 13 pro 128 자급제"
  - "아이폰 13 프로 자급제"
- pages=10, priceMin=350,000, priceMax=1,200,000 (2021 모델 반영)
- `acceptAll`: `/(?:아이폰|iphone)\s*13\s*(?:프로|pro)/i` (15/16 lane regex보다 한 단계 넓힘 — mixed-language "아이폰13pro" 잡기 위해. 13세대는 표기 혼용이 심함)
- reject 라벨 (15 Pro pattern + 13세대 sibling 차단):
  - `wrong_model_pro_max`, `wrong_model_13_base_or_plus_or_mini`
  - `wrong_model_12`, `wrong_model_14`, `wrong_model_15`, `wrong_model_16` (앞뒤 세대 모두 차단)
  - `wrong_storage_256`, `wrong_storage_512_1tb`
  - `carrier_skt/kt/lg/locked_generic` (4중)
  - `broken_or_parts`, `buying_post`, `refurbished_only`, `accessory_only`
- 결과: **total_fetched=60, parse_ready=6, rejected=54**
  - reject_breakdown 상위: `missing_(아이폰|iphone) 13 (프로|pro)` 35건 (검색 결과에 매입/타 모델 글이 섞임), `carrier_locked_generic` 20건, `wrong_storage_256` 18건, `price_too_low` 16건, `wrong_model_pro_max` 12건, `wrong_storage_512_1tb` 8건, `wrong_model_16` 7건

**200건 미달 — supply ceiling.** 2021년 모델 + 자급제 한정 검색에서 Bunjang 모집단이 60개 unique pids에 그침. 동일 4-query pattern으로 mining한 `iphone_16_pro_128gb_self`도 25/233에 그쳐 wire된 전례 있음 (catalog-only narrow). 자급제는 본질적으로 통신사 약정 매물에 밀려 적게 잡힘. parse_ready 6/60 (10%) 자체는 reject 룰이 정확히 동작했다는 신호.

### 2. Catalog — `src/lib/catalog.ts`
`iphone-13-pro` 다음에 `iphone-13-pro-128-self` 삽입 (line 217–249).
- `id: "iphone-13-pro-128-self"`, `category: "smartphone"`, `laneKey: "iphone_13_pro_128gb_self"`
- `msrpKrw: 1350000`, `released: 2021`
- mustContain: `[["아이폰 13 프로","아이폰13프로","iphone 13 pro"], ["128gb","128 gb","128기가","128g"], ["자급제","자급","공기계","언락"]]`
- mustNotContain (15/16 Pro pattern + 13세대 sibling 차단):
  - 프로맥스 / pro max / promax / 프맥 / 프로 맥스 / 플러스 / plus
  - **아이폰 12 / iphone 12 / 아이폰12** (이전 세대)
  - **아이폰 14 / iphone 14 / 아이폰14** (다음 세대)
  - 256gb / 512gb / 1tb 등 타 용량
  - skt/kt/lg 약정·완납·개통·전용, 통신사 개통/이동/전용, 번호 이동, 약정 승계, 완납폰, 할부 승계/잔여, 확정 기변
  - 리퍼폰
  - `...PHONE_NOISE` (케이스/필름/부품/매입 등)
- substring 충돌 점검 OK: mustNotContain 토큰들이 mustContain 토큰의 substring 아님.

### 3. tsc / test:core
- `npx tsc --noEmit`: 59 errors 모두 pre-existing (`@supabase/ssr`, `@supabase/supabase-js` 미설치 + `scripts/report-*.ts` 타입 오류). 본 변경분에서 신규 오류 0건. stash before/after 동일 카운트로 확인.
- `npm run test:core`: tsx CLI 미설치로 직접 `node --experimental-strip-types --import ./tests/_alias-loader.mjs --test tests/*.test.ts` 실행.
  - core-rules.test.ts: **77/77 pass**.
  - 전체: 87 pass / 3 fail. 실패 3건(`cron-guard`, `lifecycle-state`, `pack-open-race`)은 stash 후에도 동일하게 실패하는 pre-existing 환경 이슈 (module resolution / Supabase env). 본 변경분과 무관.

## In-Progress
- (없음)

## Blocked
- 🟡 `category-readiness.ts` 미션상 금지 — narrow lane registry에 `iphone_13_pro_128gb_self` 항목 추가는 메인 세션에서 다른 wave에 처리해야 LIVE 가능. 15/16 sibling 라인 (line 55–59, 75–79) 바로 옆에 추가하면 됨.

## Decision Request
- (없음 — 미션 spec대로 처리)

## 다음 사이클 의도
- 메인 머지 후 다른 narrow lane 미션 대기.

## 커밋 (오늘 만들 예정)
- `feat(catalog): wire iPhone 13 Pro 128GB self` — catalog.ts SKU + mine-narrow-lane.ts lane config + mining artifacts

## Observation
- iPhone 13 Pro 자급제 매물 supply는 16 Pro와 동급으로 thin (Bunjang 60 unique pids). 시세 학습을 위해선 7~14일 누적 수집이 필요할 가능성. 단일 mining session으로 200건 도달 불가가 정상.
- 13/14/15/16 Pro 모두 동일 spec (msrpKrw 1.35M~1.55M, 128GB self pattern) — narrow lane 시리즈로 묶어 시세 비교에 활용 가능.
