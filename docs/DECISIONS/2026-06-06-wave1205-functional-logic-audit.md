# Wave 1205 (audit) — 기능 로직 버그 audit (피드/시세조회/hooks/데이터)

날짜: 2026-06-06
상태: 발견 기록. general-purpose agent ×4 병렬 (피드/시세조회/React hooks/데이터·성능).
배터리 P0는 Wave 1194b로 즉시 fix 완료.

## 🔴 P0 (즉시 fix됨)
- **배터리 정규식 결함** (Wave 1194 self) → **Wave 1194b 완료** (2311bd26). normalize % 제거로 죽은 코드 + "성능 NN" FP.

## 🔴 P0 (남음)

### 데이터/성능
- **0~1원 차익 매물 ready 진입** — candidate-pool-builder.ts:837 + profit.ts:236. `Math.round((0+1)/2)=1` → band 1 → gate 통과. 실질 순익 0 추천. Wave 885에서 최소차익 10000→1 낮춘 부작용. **owner 정책 확인 필요**(최소차익 얼마?).

### 피드 (explore-client + pool route)
- **append race** — explore-client.tsx:3129-3141. `setItems((prev)=>[...prev,...fresh])`가 seq/source 재검증 없이 최신 prev에 append → 빠른 필터 전환 시 옛 source 매물 섞임. loadPool deps에 source/sort 없고 ref로만 읽는 구조가 악화.
- **무한스크롤 150 천장** — explore-client.tsx:3364-3415. IntersectionObserver가 displayItems까지만 DOM 늘리고 서버 continuation 안 부름. continuation은 1회 + 150 cap → 근처 150개 넘으면 못 봄.

### 시세조회 (lookup)
- **maxDuration 미설정 + restFetch 90초×8 다단계** — route.ts(export 없음) + supabase-rest.ts:107. 인터랙티브 조회에 cron용 90초 재시도값 → 무한 로딩/강제종료. (paywall #6은 해당 없음 — 멤버십 전용 전환, 차감 로직 자체 없음.)
- **중나 live-ingest fetch 예외 미포착** — live-ingest.ts:155 + joongna.ts:203,551. 번개/당근은 null 반환인데 중나만 throw → 404 대신 500.

## 🟡 P1 (owner 정책 얽힘 / 신중)
- **sold 1건이 active 호가 70%에 묻힘** — tick-pipeline.ts:4983. "팔린 게 시세"(Wave 983) 정책과 긴장. sold 1건 outlier 회피(Wave 221) trade-off. → 의도면 주석 정정, 아니면 sold 저가 신호 별도 처리.
- **madTrim 5표본 outlier 잔존** — market-math.ts:119. 5표본 중 1 trim하면 4 survivor인데 floor가 5 요구 → trim 취소. fashion/game(표본 2+ 통과) outlier 노출.
- **lookup race (AbortController 없음)** — lookup-client.tsx. 연속 조회 시 엉뚱한 결과 + 서버 SSE/DB 작업 누수.
- **expectedProfit condition 이중 차감 가능** — profit.ts:86. 시세가 이미 condition 분리됐는데 또 페널티. 측정 필요.

## ✅ 양호 (확인 완료)
- **React hooks: P0 없음.** addEventListener/setInterval/subscription/observer cleanup 전수 균형(mismatch 0). loadPool seq 가드로 race 방어. 발견은 전부 P2(closeRefreshModal useCallback cleanup 오용, 매초 틱 무가드, 텔레그램 폴링 무한지속) — 누수/무한루프 아님.
- claim RPC `for update skip locked` 동시성 안전.

## 권장 우선순위
1. 0~1원 차익 (owner 정책 확인 후 빠름)
2. 시세조회 maxDuration + 중나 500 (사용자 갇힘)
3. 피드 append race + 무한스크롤 (데이터 정합성, 손 더 감)
4. sold 1건/madTrim (owner 시세 정책 결정)
