# 외부 review wrap-up — 이번 세션 전체 진척 정리

날짜: 2026-05-20
영역: pack-reveal-modal (매물 reveal 모달) + 별 세션 (카테고리/브랜드 가품 깊이)

## 배경

외부 사업 검토 리뷰 23개 항목 — 사용자가 paste. 분류 (스킵 3 / 부분수용 13 / 무조건수용 7) 후 단계별 wave 진행. 사용자 명시 채택 #23 (모드 토글) 포함.

## 외부 review 23개 진척 (이번 세션)

### ✅ 완료 (이번 세션)

| # | 항목 | Wave | 상태 |
|---|---|---|---|
| 1 | UpperFold 압축 (3초 결정) | 394.6.a | verdict chip 헤드라인 |
| 3 | sample 시세 매물 | 394.4 + .b | ComparableListings + market-source rewire |
| 5 | CTA 사이즈 ↓ | 394.7.a | py-2.5 + text-13px + shadow-md |
| 6 | CTA 문구 | 394.1 | "원본 매물 보기" |
| 7 | 정보 순서 재정렬 | 394.6.b + .b.fix2 | Counterfeit 위로 / Platform 아래로 / ComparableListings 차익 직후 |
| 8 | FAQ → 리스크 카드 | 394.6.c | 첫 Q 펼침 + "🛡 구매 전 확인 — 자주 묻는 4가지" |
| 9 | 정품 단정형 정정 | 394.1 | bag/perfume/watch/clothing "정품 확인 필요" |
| 12 | 그래프 표본 부족 | (변경 X) | 이미 thin history 처리 완료 |
| 13 | 채널 리스크 chip | 394.2 | 번개 (전국/안전) / 당근 (지역/네고) |
| 14 | 협상가 산출식 | 394.2 | "현재가 −Y원 깎기 (차익 30% 또는 max 2만원)" |
| 15 | 가격 만원 단위 | 394.1 | "약 86.8만원 이상" |
| 17 | 비용 줄바꿈 | 394.1 | 3행 리스트 (whitespace-pre-line) |
| 18 | 색상 일관성 | 394.7.b | DealEvidence 4번 rose → emerald (안전결제 안전 의미) |
| 19 | "실시간" 과장 | 394.1 | "최신 수집 기준" / "최신 호가" |
| 20 | 사진 분석 한계 | 394.2 | "AI는 매물 설명 텍스트 기준 판단" |
| 21 | /me 카드 "왜 추천" | 394.7.c | RelatedRevealStrip 차익률 + condition chip |
| 22 | 단정형 → 조건부 | 394.1 | verdictLabel "차익 충분 · 현재 데이터 기준" |
| 23 | 초보/상세 모드 토글 | 394.5.a/b/c + .a.fix/.fix2 | 모드 토글 + 양방향 sync |
| 가품 Q | 카테고리별 답 | 394.6.d | 12 카테고리 분기 (폰 = 가품 X / 신발 = 큼 등) |

### ⏳ 별 세션 진행 (별 worktree)

| Wave | 항목 | 상태 |
|---|---|---|
| A | shoe brand depth (16 브랜드) | ✅ 완료 (Nike/Adidas/NB/Dr.Martens/UGG 등) |
| B | clothing brand depth (16 브랜드) | ✅ 완료 (Arcteryx Bird-aid/Supreme/BAPE/Stussy/Maison Margiela 등) |
| C | bag brand depth | ⏳ 진행 중 (LV/Chanel/Gucci/Hermes/Dior 등) |
| D | 전자 brand depth (smartphone/tablet/laptop) | 🆕 spawn chip — 사용자 클릭 대기 |
| E | 나머지 brand depth (watch/perfume/camera/drone/earphone/smartwatch) | 🆕 spawn chip — 사용자 클릭 대기 |
| 4 | 모델별 가품 체크포인트 = Wave A~E 결과 | ⏳ A~E 완료 시 충족 |

### ❌ 스킵 (우리 사이트 안 맞음)

| # | 항목 | 이유 |
|---|---|---|
| 2 | 100점 점수 분해 | 우리 점수 시스템 없음 |
| 16 | 화면 분리 (멀티 화면) | 일반인 친화 단일 모달 (메모리 룰) |

### ⏳ 보류

| # | 항목 | 이유 |
|---|---|---|
| 10 | ConditionChip 근거 자세히 | AI 한계 line 만 박힘. 더 깊은 근거 = 별 wave 가치 |
| 24 | 패스 조건 명시 | 정책 충돌 (우리는 차익 미만 매물 안 보여주는 식). 사용자 결정 필요 |
| 7번 | 계절성/타이밍 시그널 | 데이터 누적 부족 (현재 ~7일). 더 쌓이면 |

## 다른 세션 작업 (이번 세션과 무관, 진행 중)

main branch 의 modified + untracked 영역:

| Wave | 작업 | 상태 |
|---|---|---|
| 254.5 step 2/3 | fashion bag/clothing conditionFromText | ✅ commit `c47f40f` |
| 254.6 | parseClothingProductType regex 우선순위 | ✅ commit `8940f86` |
| 254.7 | production build TS 오류 fix (3 src/ 에러) | ✅ commit `eb3ac97` |
| 255 | parser_version drift auto-detection (tick-pipeline.ts) | modified, uncommitted |
| A | category-brand-depth.ts 신규 + test + decision log | 일부 commit, 일부 untracked |
| - | saved-money endpoint id → pid fix | modified + decision log untracked |

이 세션들이 자기 책임으로 commit + push.

## 우리 세션 commit 정리 (main + fix branch)

main:
- `44a9a65` Wave 394.5.a.fix2 + 394.7.c (양방향 sync + RelatedRevealStrip chip)
- `56a1d2f` Wave 394.7.b (색상 일관성)

fix/me-demand-supply-payload-2026-05-20:
- `67d9160` Wave 394.5.a.fix2 (양방향 sync) — main 미머지
- `8d66487` Wave 394.5.a.fix (토글 위치 ↑)
- `407a178` Wave 394.5.b+c (ComparableListings 12개 + 신뢰도 펼침)
- `4619561` Wave 394.5.a (모드 토글 디테일 펼침)
- `cb463c7` Wave 394.6.b.fix (비교 매물 위계 ↑)
- `b3be34a` Wave 394.6.b.fix2 (좌측 카드 안)
- `55fa2ba` Wave 394.6.b.fix3 (정렬 + layout + %)
- `0c5d582` Wave 394.6.b.fix4 ("판매중" chip 제거)
- `3c069a5` Wave 394.6.d (가품 Q 카테고리별)
- `0f80d31` Wave 394.6 (위계 재정렬)
- `b4cc093` Wave 394.1 (Tier 1 카피 7개)
- `5ac9b7a` Wave 394.2 (Tier 2/3)
- `1872874` Wave 394.4 (sample 시세)
- `dc5286c` Wave 394.4.b (market-source rewire)
- `2d43c7e` Wave 394.7.a (CTA 사이즈)
- `b3be34a` Wave 394.6.b.fix2 (비교 매물 → 좌측 카드)

## dev server 트러블슈팅 (이번 세션)

문제: localhost:3000 무한 로딩.
원인:
1. 다른 세션이 main mvp 메인 디렉토리 직접 작업 (별 worktree X)
2. .next cache stale
3. 우리 fix branch 의 fix2 가 main 에 미머지 → 사용자 dev 가 옛 코드 봄 (단방향 sync 버그)

해결:
1. PID 71091, 71115 kill (dev server 멈춤)
2. `.next` 디렉토리 삭제
3. dev server 재시작 (PID 6219)
4. main 의 working tree 에 fix2 직접 박음 → hot reload 적용 (`✓ Compiled in 127ms`)
5. commit (44a9a65) main push

이후 다른 세션이 main 에서 또 작업 시작 → 동시 working tree 경합 발생. 향후 spawn 시 `isolation: worktree` 명시 권장.

## 후속 spawn (이번 세션 박은 chip)

- **saved-money endpoint fix** — id → pid 한 줄 변경 (다른 세션 진행 중)
- **Wave D 전자 brand depth** — 사용자 클릭 시 spawn (isolation worktree 권장)
- **Wave E 나머지 brand depth** — 사용자 클릭 시 spawn

## 원칙 (이번 세션 적용)

- **일반인 친화 단일 톤** — 모든 wave 적용 (모드 토글도 디폴트 simple)
- **단정형 → 조건부** — Wave 394.1 + 394.2 + 394.6 일관 (외부 review #22 정신)
- **사이트 USP (band-aware 시세 비교)** — Wave 394.4 (sample 시세 매물) 정면 강화
- **3화면 일관성** — buy-price-guidance 변경으로 admin + pack-reveal + user-reveal 자동 적용
- **decision log 즉시** — 매 wave commit 시 박음
- **destructive 사전 confirm** — DB 변경 영역 X (UI 카피 정정 only)
- **명확한 fix 묻지 말고 진행** — Tier 1 일괄 박음

## 사용자 짚은 정정 사이클 (이번 세션)

매번 사용자 직접 짚은 후 정정:
1. **비교 매물 → 시세 그래프 위** (위계) — 사용자 짚음 "이 시세가 믿을만한건지 결정이 우선순위"
2. **비교 매물 → 좌측 카드** (위계 더 ↑) — 사용자 짚음 "비교매물이 위계가 훨씬 높지 않나?"
3. **비교 매물 가격 정렬** — 사용자 짚음 "가격 낮은거 부터"
4. **가격 우측 column** — 사용자 짚음 "가격은 오른쪽에"
5. **차이 % 의미** — 사용자 짚음 "현재 매입가 대비 몇 % 싸거나 비싼지"
6. **"판매중" chip 제거** — 사용자 짚음 "매물명 반토막"
7. **상세 모드 범위 결정** — 사용자 결정 "디테일 펼침 + 일부 고급 기능, 통계 도구 X"
8. **간단 보기 안 돌아감** — 사용자 짚음 (양방향 sync fix2)
9. **토글 안 보임** — 사용자 짚음 (emerald 강조 + 별도 row)

핵심 — 사용자 직접 사용 후 immediate 정정. 신뢰 큼.
