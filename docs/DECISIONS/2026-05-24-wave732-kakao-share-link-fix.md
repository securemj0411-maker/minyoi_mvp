## Wave 732 — 카카오 공유 링크 누락 fix + /invite UI 단순화

- 시간: 2026-05-24 KST
- 발견: 사용자 보고
  1. **기존 카카오 공유 시 링크가 안 나가고 텍스트만 보임**
     - "지금 팔면 바로 돈 되는 중고 상품이 있어요 / AI 가 매일 찾아주는 차익 상품, 지금 무료로 확인해보세요!" 두 줄만.
     - 원인: `objectType: "feed"` 는 카카오 카드 형식이라 `imageUrl` 필수. 없으면 카드 미리보기 못 만들어 텍스트만 fallback. link 객체 묻힘.
  2. **/invite 페이지에 "내 추천코드" 큰 표시 헷갈림**
     - 사용자: "사용자는 어차피 링크 복사만 하면 되는데 헷갈리게? 그냥 저 링크로 들어와서 가입하면 보상된다라는 자세한 설명만 하면 된다"
     - 코드 큰 표시 → 사용자 입장에선 의미 X (URL 안에 자동 포함됨)

### 변경

#### 1. 카카오 공유 `feed` → `text` 일괄 변환 (2 곳)
- [src/components/invite-client.tsx](../../src/components/invite-client.tsx) — `/invite` 친구 초대 공유
- [src/components/explore-client.tsx:1339](../../src/components/explore-client.tsx#L1339) — 기존 24h cooldown +3 공유

`objectType: "text"` 형식은 `imageUrl` 없이도 본문 + 링크 + 버튼 보장. 카카오 SDK 공식 spec:
```js
Kakao.Share.sendDefault({
  objectType: "text",
  text: "...",
  link: { mobileWebUrl, webUrl },
  buttonTitle: "...",
});
```

#### 2. /invite UI 단순화
- "내 추천 코드" 큰 박스 (mono 3xl 코드 + 복사 버튼) **제거**
- 메인 액션 두 개로 단순화:
  - 카카오 공유 버튼 (h-14, 굵게 — 주력 채널)
  - 링크 복사 버튼 (h-12, 보조)
- "이렇게 작동해요" 1/2/3 단계 자세한 설명 박음 (사용자 요청)
- 추천 현황은 0 명일 때 숨김 (새 사용자 화면 깔끔)

#### 3. env 확인
- `NEXT_PUBLIC_KAKAO_JS_KEY=a8fa6f737020f398a73f0c05cfd7f7ab` 박혀있음 ✓
- `DEFAULT_KAKAO_MEMO_TEMPLATE_ID=133282` (Kakao 메모 템플릿) 별도 lib.ts 상수 ✓
- Kakao JS SDK script layout.tsx:73 로드 ✓

### 검증

- `npx tsc --noEmit` — 0 error.
- 실제 카카오 메시지 작동은 사용자 spot check 필요.

### 위험 / 한계

- **카카오 Console 사이트 도메인 등록**: `objectType: "text"` 는 imageUrl 없어 OK 이지만, 도메인 미등록 시 link 클릭 시 카카오가 "외부 링크" 경고 띄울 수도. Production 도메인 등록 필수 (코드로 못 함):
  - https://developers.kakao.com → 내 애플리케이션 → 플랫폼 → Web → 사이트 도메인 추가
  - `http://localhost:3000` (dev) + `https://minyoi.com` (prod) 등록 권장.
- **카드형 메시지 (이미지 포함)** 원하면 `imageUrl` 박힌 og-image PNG 필요. `/opengraph-image.tsx` route 또는 `public/og-image.png` (1200x630) 만들어서 다음 wave 에 `objectType: "feed"` 복원.

### 다음

- 사용자: 카카오 Console 사이트 도메인 등록 확인.
- 향후 og-image 박고 `feed` 형식 카드 메시지 복원 (이미지 카드가 더 예쁨 — text 는 plain).
