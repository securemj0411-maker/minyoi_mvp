# 2026-05-17 preview-masked: 서버 사이드 sharp blur (옵션 B)

## 사용자 결정

> "b로하면 좀 느려지지않음?? 그정도로 심각하게 느려지는건 아님??
> 제목블러도 처리 안됐는데 이것도 비슷한 방식으로??"

옵션 b (서버 사이드 sharp blur) 선택. 속도 우려 — instant 후 60초 캐시로 mitigation.

## 박은 변경 (commit `9172634`)

### 1. sharp 라이브러리 install (`^0.34.5`)
- Vercel serverless 환경 호환
- 이미지 resize + blur 처리

### 2. `/api/preview-pool` 서버 사이드 blur
```ts
async function fetchAndBlurImage(url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return await sharp(buf)
    .resize(160, 160, { fit: "cover" })
    .blur(20)          // 강한 블러 — 식별 불가능 + 사진 느낌 유지
    .jpeg({ quality: 60 })
    .toBuffer();
}
```
- base64 data URL 응답 — 원본 URL 클라이언트 노출 X
- Promise.all 병렬 처리 5개 (~250-500ms 첫 fetch)
- 60초 캐시 박혀있음

### 3. frontend
- `thumbnailUrl` → `blurredImage` (base64 data URL)
- `<img src={item.blurredImage}/>` — 진짜 blur 된 사진 표시
- DevTools 봐도 data URL 만 (원본 URL 흔적 없음, 데이터 자체가 blur 처리됨)

### 4. 제목 blur
- 서버에서 마스킹 ("갤** S** 울**") + CSS `blur-[2px]`
- 데이터 = 마스킹 string (DevTools 우회해도 안전)
- blur = visual 효과만 (자연스러운 모자이크 느낌)

## 보안

- 이미지: sharp blur 후 base64. **원본 데이터 자체 클라이언트에 없음**
- 제목: 마스킹된 string. CSS blur 는 visual 만, 데이터는 안전
- DevTools Network: data URL 만 (origin URL X)
- DevTools Elements: blur 된 base64 + 마스킹된 string

## 속도

- 첫 사용자: 250-500ms (5장 sharp 처리)
- 60초 캐시 후: instant (Vercel edge cache)
- 심각하지 않음 — 신뢰감 win > 속도 loss

## Trade-off

- sharp 의존성 추가 (~30MB)
- Vercel cold start 약간 느림 (sharp init ~100ms)
- balance: 보안 + 시각 둘 다 win > 의존성 비용

## Test

288/288 pass.
