# Wave 799d — /lookup UX 3종 fix

- 시간: 2026-05-30 KST
- 트리거: owner — "조회 실패 / 공유 문구 잡문 / 진행 단계 안 보임"

## 문제

owner 가 당근 공유 link 그대로 붙여넣었더니 조회 실패.
공유 형식: `Check out this '아이패드 에어 11 (M4) ...' on Karrot! ... https://www.daangn.com/articles/1180105783`

### 원인 분석 (3 layer)

1. **공유 잡문**: URL 앞에 "Check out this ..." 같은 텍스트가 붙어 있어서 `parseListingUrl` regex 가 잡긴 잡지만, 사용자가 URL 만 따로 발라낼 필요 X.
2. **당근 ID 체계 불일치** (핵심):
   - 공유 URL: `daangn.com/articles/{numeric-10-digit}` (예: `1180105783`)
   - DB 저장 URL: `daangn.com/kr/buy-sell/{slug-with-shortid}/` (예: `...4qai2x6asn5z/`)
   - **다른 ID 체계** — ILIKE `*1180105783*` 로는 buy-sell URL 못 잡음.
   - DB 검증: `SELECT FROM mvp_raw_listings WHERE url ILIKE '%1180105783%'` → 0건.
3. **진행 단계 안 보임**: loading 중에 "조회 중..." 만 떠서 사용자가 멈춘 건지 모름.

## 변경

### 1. URL 자동 추출 — `extractFirstUrl`

```ts
function extractFirstUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s<>"'`)\]]+/i);
  return m ? m[0] : text.trim();
}
```

- POST body 의 `url` 필드를 raw text 로 받고, 첫 https URL 추출.
- 잡문 + URL 같이 붙여도 OK.

### 2. Daangn articles → buy-sell redirect 따라가기 — `resolveDaangnArticleSlug`

```ts
async function resolveDaangnArticleSlug(articleId: string): Promise<string | null> {
  const res = await fetch(`https://www.daangn.com/articles/${articleId}`, {
    method: "HEAD",
    redirect: "manual",
    signal: AbortSignal.timeout(5000),
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (loc) {
      const slugMatch = loc.match(/buy-sell\/([^/?]+)/i);
      if (slugMatch) {
        // slug 끝 shortId (예: 4qai2x6asn5z) — 한글 인코딩 충돌 회피.
        const shortIdMatch = slugMatch[1].match(/-([a-z0-9]{8,})\/?$/i);
        return shortIdMatch ? shortIdMatch[1] : slugMatch[1];
      }
    }
  }
  return null;
}
```

검증:
- `curl -IL https://www.daangn.com/articles/1180105783` → 307 → `/kr/buy-sell/.../...4qai2x6asn5z/`
- shortId `4qai2x6asn5z` 로 DB ILIKE 검색 — 매물이 DB 에 있으면 매칭.

호출 위치 (route 안):
```ts
let searchKey = parsed.key;
if (parsed.source === "daangn" && /^\d+$/.test(parsed.key)) {
  const resolvedSlug = await resolveDaangnArticleSlug(parsed.key);
  if (resolvedSlug) searchKey = resolvedSlug;
}
```

`not_found` 에러 메시지도 다음과 같이 분기:
- daangn articles + redirect 실패 → "당근 공유 URL 을 분석하지 못했어요 — 매물 상세 화면의 주소를 그대로 붙여넣어 보세요"
- 그 외 → "새 매물이거나 아직 우리 풀에 들어오지 않았어요"

### 3. Client 진행 단계 UI

`lookup-client.tsx`:
- `progressStage` state (0~4)
- `useEffect` on loading: 700ms → 1800ms → 3200ms 마다 stage++
- Progress bar (`width: stage * 25%`) + 단계 list 4개:
  1. URL 분석 + 매물 ID 추출
  2. 미뇨이 DB 에서 매물 검색
  3. 비교 매물 + 14일 시세 그래프 모으는 중
  4. 결과 정리 + 표시
- 현재 stage = 파랑 + animate-pulse, 완료 = 초록 ✓ + line-through, 미시작 = 회색

### 4. Input → textarea (공유 문구 한 줄 이상)

`<input type="url">` → `<textarea rows={2}>` 로 변경.
공유 문구 (URL + 앞 잡문) 가 2~3줄 차지하므로.
Label hint: "공유 문구 그대로 붙여넣어도 OK"

## Trade-off

### redirect fetch 비용

- 5초 timeout, daangn articles 형식일 때만 호출 (numeric ID 검사).
- daangn 의 robot 차단 가능성 → 실패 시 null fallback → 명확한 에러 메시지로 안내.
- daangn 자체가 articles → buy-sell 표준 redirect 제공 (현재 동작) — 차단되면 owner 가 별도 조치 필요.

### Progress UI = 가짜 진행

- 실제 server progress 가 아니라 client-side timer 기반.
- 빠른 응답 (< 700ms) 시 stage 1 만 잠깐 노출 — 큰 UX 문제 X.
- 느린 응답 (> 3.2s) 시 stage 4 에 머묾 — 멈춘 게 아님을 명시 가능.
- SSE 로 진짜 server progress 박는 건 over-engineering — MVP 단계에선 fake progress 로 충분.

## 사용 흐름 (수정 후)

```
사용자 input: "Check out this ... https://www.daangn.com/articles/1180105783"
→ extractFirstUrl: "https://www.daangn.com/articles/1180105783"
→ parseListingUrl: {source: 'daangn', key: '1180105783'}
→ resolveDaangnArticleSlug: "4qai2x6asn5z" (redirect 결과)
→ DB ILIKE *4qai2x6asn5z* → 매물 있으면 hit
→ 진행 단계 1~4 자동 표시
```

## 미해결

owner 의 케이스 (article `1180105783`) 는 우리 DB 에도 없는 매물이라 어쨌든 not_found.
다만 메시지가 "당근 공유 URL 분석 못 함 (당근 redirect 실패)" 가 아니라 "새 매물 / 풀에 안 들어옴" 으로 정확히 분기.

## Follow-up

- **bunjang share URL pattern 검증** — bunjang 공유도 잡문 붙는지 확인 필요 (현재 미검증)
- **joongna share URL pattern 검증** — 동일
- **server-side streaming progress** — 비용 vs UX 검토 (낮은 우선)
- **clipboard auto-detect** — `/lookup` 페이지 진입 시 클립보드 URL 자동 감지해서 "이거 조회할까요?" UX (낮은 우선)
