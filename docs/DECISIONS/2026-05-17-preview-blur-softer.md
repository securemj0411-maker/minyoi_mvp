# 2026-05-17 preview-masked: blur 약화

## 사용자 지적

> "지금 근데 블러가 너무 쏀데?? 조금 덜 처리하면 안됌?"

## 박은 변경 (commit `70499b1`)

- 이미지 sharp blur sigma: **20 → 10** (적당한 블러)
- 이미지 jpeg quality: 60 → 70 (덜 자글거림)
- 제목 CSS blur: **2px → 1px** (살짝 부드러움)

## 보안 동일

- 원본 image URL 노출 X (sharp 처리 base64 만)
- 제목 데이터 = 마스킹 string ("갤** S** 울**")
- blur 약화 = 시각만, 데이터 안전성 동일

## Trade-off

- 약한 blur = 사진 인식 더 쉬움 (사용자 신뢰 ↑)
- 정확 식별 risk 약간 ↑ (가까이 보면 모델 추측 가능)
- 사용자 명시 "마스킹 가능성 감안" — 받아들임

## Test

288/288 pass.
