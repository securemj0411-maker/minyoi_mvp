# 2026-05-20 — 상세보기 사진 위 모바일 dot overlay 제거

## 배경

상세보기 사진 위에 `absolute right-3 top-[76px] ... bg-black/45 ... sm:hidden` 형태의 모바일 dot overlay가 떠 있었다.

## 결정

- 현재 상세보기는 사진 한 장만 쓰는 구조라 carousel indicator가 의미 없다.
- 위치도 애매해 사진 위 불필요한 UI로 보이므로 제거한다.

## 조치

- `src/components/pack-reveal-modal.tsx`의 모바일 dot overlay block만 삭제했다.
- 실제 사진, 상태 pill, `크게 보기` 동작은 유지했다.
