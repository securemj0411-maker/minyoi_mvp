## Wave 72 — 랜딩 ShowcaseCard 모바일 jitter 수정 (translateX → fade-only)

- 시간: 2026-05-14 KST
- 발견: 모바일에서 랜딩페이지 카루셀 (3.5초 주기 회전) 시 카드+텍스트가 좌우로 jitter되어 페이지 전체 흔들림처럼 보임. user 신고: "사진 위치따라서 (외부 텍스트도) 같이 움직임".
  - 원인: `src/app/globals.css`의 3개 keyframes가 translateX 사용:
    - `showcase-swipe-in`: translateX(24px) → 0
    - `showcase-swipe-out`: translateX(0) → -52px
    - `showcase-content-in`: translateX(18px) → 0
  - 720ms + 540ms 동안 좌우 이동. 시각적으로 페이지 전체 jitter.
- 변경:
  - `src/app/globals.css`: 3개 keyframes의 translateX 제거. opacity + 미세 scale (0.98 ↔ 1)만 유지.
  - 카드 자체 layout (max-w-[460px], mx-auto)는 변경 0. 사진 사이즈도 변경 0.
- 검증:
  - npx tsc --noEmit clean
  - npm run test:core 139/139 pass
- 위험:
  - LOW: CSS only 변경. 시각적으로 horizontal slide가 fade로 바뀜. 기능 영향 0.
  - 디자인적으로 이전보다 정적이지만 안정적 (jitter 제거 우선).
- 다음:
  - production 배포 후 모바일에서 실 측정
