# 2026-05-19 Wave 293 — pack-open category 타입 빌드 수정

## 배경
- Vercel/Next build가 `src/lib/pack-open.ts:293:39`에서 실패했다.
- `ReservedRow`는 `category?: string | null`인데 `categoryFromPool` helper는 `category: string | null`을 요구하고 있었다.
- 실제 로직은 category가 없으면 `comparable_key`에서 카테고리를 추론하는 fallback을 이미 갖고 있었으므로 타입만 더 좁게 선언된 상태였다.

## 결정
- `categoryFromPool` 입력 타입을 `category?: string | null`, `comparable_key?: string | null`로 넓혔다.
- 이 helper는 pool RPC row와 inventory snapshot row 양쪽에서 쓰이므로, DB row shape 차이를 허용하는 계약이 맞다.

## 보류
- category가 완전히 없는 row를 별도 metric으로 집계하는 작업은 보류한다. 현재는 fallback 후 `unknown` bucket 처리로 충분하다.

## 검증
- `npm run build`로 Next typecheck 통과 여부를 확인한다.
