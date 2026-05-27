# Wave 774 — Onboarding 본 매물 에어팟 사진 404 fix

- 시간: 2026-05-27 KST
- 트리거: 사용자 — "그 두페이지 에어팟 사진이 안불러와지는데? 비교매물 에어팟 4개 사진은 잘 되는데 그. 첫 가입자 모달에서".

## 발견

Production endpoint 직접 test:
- `/에어팟중고.jpg` → **HTTP 404** ❌ (한국어 파일명, root 위치)
- `/노캔고장/293736980_1_1728653235_w360.webp` → **HTTP 200** ✅ (한국어 폴더 + ASCII 파일명)

git에는 정상 tracked (49,259 bytes, blob 563338b3) 인데 Vercel deploy 후 serve 안 됨.

추정 원인: **Vercel deploy 시 root level 한국어 파일명 누락**. 폴더는 한국어 OK지만 파일명 한국어는 일부 build 단계에서 빠짐. 다른 file (`/노캔고장/*`) 은 폴더가 한국어지만 파일명은 ASCII라 살아남았음.

## 변경

### `public/airpods-pro-2-used.jpg` (신규)
- `public/에어팟중고.jpg` 의 ASCII 사본 (cp, 같은 49,259 bytes).

### `src/components/explore-client.tsx`
- src `/%EC%97%90%EC%96%B4%ED%8C%9F%EC%A4%91%EA%B3%A0.jpg` (URL-encoded "에어팟중고.jpg") → `/airpods-pro-2-used.jpg` 2곳 변경:
  - line 1228: step 0 (의심 mirror) 본 매물 카드 80x80 이미지
  - line 1271: step 1 (비교군) 본 매물 카드 64x64 이미지

## 검증

- `npx tsc --noEmit` 에러 0건
- 노캔고장/* 4개 비교 매물 이미지는 path 그대로 (이미 잘 작동 중).

## 위험

- 0. 파일 rename만, 콘텐츠 동일.
- 옛 `에어팟중고.jpg` 는 그대로 둠 (git 삭제 안 함). Vercel deploy 후 다른 곳에서 reference 있는지 확인 후 정리.

## 다음

- 다른 한국어 파일명 root-level public asset 점검 (있다면 동일 fix).
- Vercel deploy 후 사용자 onboarding 다시 테스트.
