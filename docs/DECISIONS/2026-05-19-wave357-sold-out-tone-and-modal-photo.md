# 2026-05-19 Wave 357 — sold out 칩 SaaS 친화 톤 + 모달 사진 확대

사용자 요청:
1. "잡힘" 같은 차가운 단어보다 "다른 사용자가 잡았어요 ㅠㅠ" 식 SaaS sympathy 톤
2. 상세 페이지 (PackRevealModal) 사진 좀 더 크게

## 결정

### Sold-out 칩 — "다른 분이 잡았어요 ㅠㅠ"
- 기존: `"잡힘"` (text-[9px] bg-rose-600)
- 변경: `"다른 분이 잡았어요 ㅠㅠ"` (text-[10px] bg-rose-600/95 + leading-tight + 가운데 정렬)
- overlay padding `px-2` 추가 (긴 라벨이 사진 끝에 닿지 않게)
- shadow `shadow` → `shadow-lg` (살짝 강조)

### 모달 사진 확대

| 화면 | 이전 | 이후 |
|---|---|---|
| 모바일 (< sm) | h-[145px] full width | **h-[210px]** full width |
| sm | 132×132 | **180×180** |
| lg+ | 150×150 | **220×220** |

`sizes` prop도 일관되게 갱신: `"180px, 220px"` (3개 Image 인스턴스 동일).

## 변경 파일

### `src/components/explore-client.tsx`
- sold out overlay 칩 라벨 + 스타일 교체

### `src/components/pack-reveal-modal.tsx`
- 사진 컨테이너 div className 크기 클래스 교체
- 2개 `<Image>` sizes prop 매칭 갱신

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 톤 가이드 (메모)

미뇨이 = 일반인 친화. "잡힘" 같은 시스템 단어 X.
- ✅ "다른 분이 잡았어요 ㅠㅠ"
- ✅ "💡 구독자는 잡을 수 있었어요"
- ✅ "다른 매물 찾기"
- ❌ "잡힘", "Sold Out", "Invalidated"
