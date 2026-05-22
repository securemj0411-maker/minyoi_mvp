# 2026-05-22 — launch-39: joongna React Flight payload location 파싱 + 빨간 깜빡임 무한 retry 차단

## 사용자 짚음 (full HTML payload + 빨간 깜빡임)

> "이거도 보고 파악해보고; payload다 확인해서 저거도 안오는지도 확인해보고 나 예산 전체로 하고
> 중고나라 필터링했는데 뭐 한 3초에 한번씩 빨간 위에 뭐 깜빡깜빡 거리는데 뭐야 이거??
> 몇초에 한번 계속 갱신할려고 하다가 없다고 알려주고 다시 사라지고 하는건가??"

두 가지 짚음:
1. **launch-38 의 button regex 보다 더 안정적인 location 추출** — 사용자가 detail HTML 전체
   payload 붙임. 분석 결과 `__next_f.push` (React Flight streaming) 안에 구조화된
   `locations[].locationName` 과 `tradeDetail.subContents[].text` 가 박혀 있음.
2. **위에서 빨간색 박스 깜빡깜빡** — 3초마다 "갱신 → 없음 → 사라짐" 반복.

## (1) joongna React Flight payload 파싱 보강

### 진단
launch-38 의 `extractJoongnaTradeLocation` = HTML 렌더링된 `<dt>만나서 직거래</dt>` 뒤
button text 의존. button 렌더 안 된 매물 (또는 button DOM 구조 바뀐 매물) 은 추출 실패.

사용자가 paste 한 실제 HTML 분석:
```
"locations":[{
  "dongCode":"4717066000",
  "locationName":"송하동",
  "lon":128.694238,
  "lat":36.5703957
}]

"tradeDetail":[{
  "title":"직거래",
  "contents":[{
    "subtitle":"만나서 직거래",
    "subContents":[{
      "text":"<u>송하동</u>",
      "location":{"locationName":"송하동",...}
    }]
  }]
}]
```

→ React Flight streaming 안 구조화 데이터. button 보다 안정적.

### fix
`src/lib/joongna.ts` `extractJoongnaTradeLocation` 5단계 fallback:

1. **escape 형태 `\"locationName\":\"...\"`** — React Flight escape (다른 escape field 와 동일)
2. **unescape 형태 `"locationName":"..."`** — SSR hydration / inline script
3. **escape `\"text\":\"<u>...<\/u>\"`** — tradeDetail.subContents
4. **unescape `"text":"<u>...</u>"`** — 같은 영역 unescape
5. **fallback: 기존 button regex** (가장 약함, render flow 의존)

각 단계마다 `[가-힣]{1,8}(?:동|시|구|군|읍|면)` 검증.

## (2) "빨간 깜빡임" 무한 retry loop 차단

### 진단 (사용자 시나리오 = source=joongna + budget=all)
explore-client.tsx 의 `IntersectionObserver` effect:
```ts
if (!creditFeedEnabled || loading || refreshing || feedExhausted || scrapOnly || items.length === 0) return;
// sentinel 보이면 loadPool(true)
```

가드에 `error` 없음. 다음 시나리오:
1. 사용자 admin/credit 보유 → `creditFeedEnabled=true`, items=30 (이전 fetch)
2. source=joongna 변경 → `loadPool(false)` → /api/packs/pool 응답
   - **만약 500 또는 네트워크 fail** → `setError(...)` 박힘 (feedExhausted 안 박힘)
3. 빨간 box 표시 (rose-50/rose-200 톤)
4. `refreshing/loading` false 됨 → IntersectionObserver effect 재실행
5. sentinel 보임 → 또 `loadPool(true)` → 또 error → 또 빨간 box
6. **2-3초 round-trip 단위로 무한 깜빡임**

추가 문제:
- 빨간 (rose) 톤 = 사용자에게 위협적. 메시지는 informational 인데 색은 critical.
- "매물 불러오기 실패" = 책망형 문구. 토스 톤 X.

### fix (3 단계)

**(a) error 발생 시 feedExhausted 도 박기** — 무한 retry 차단의 근원:
```ts
} else {
  setError(data.message ?? "매물을 잠시 못 가져왔어요. 잠시 후 다시 시도해주세요.");
  setFeedExhausted(true);
}
} catch (e) {
  setError(e instanceof Error && e.message ? e.message : "네트워크가 잠시 불안정해요. ...");
  setFeedExhausted(true);
}
```

**(b) IntersectionObserver 가드에 `error` 추가** — 이중 안전망:
```ts
if (!creditFeedEnabled || loading || refreshing || feedExhausted || scrapOnly || items.length === 0 || error) return;
```
deps 에도 `error` 추가.

**(c) 빨간 톤 → amber 톤 + 다시 시도 버튼**:
- `border-rose-200 bg-rose-50 text-rose-800` (위협적) → `border-amber-200 bg-amber-50/70` (informational, empty-state 와 톤 일치)
- 사용자가 직접 "다시 시도하기" 버튼 누르면 `setError(null) + setFeedExhausted(false) + loadPool(false)`.

## 영향
- 코드:
  - `src/lib/joongna.ts` — `extractJoongnaTradeLocation` 5단계 fallback
  - `src/components/explore-client.tsx` — loadPool error branch + IntersectionObserver 가드 + 빨간 box 톤
- DB / API: X
- 사용자:
  - location 추출률 ↑ (button 없는 매물도 location 추출)
  - 빨간 깜빡임 무한 retry → 1회 정직 안내 + 사용자가 직접 retry 결정
  - 톤 위협 ↓ (rose → amber)

## 메모리 룰
- 일반인 친화: 자동 재시도가 misleading 신호. 명시적 사용자 액션 우선.
- 3 화면 일관성: error box 톤 = empty state amber 와 통일.
- decision log: 이 파일.
