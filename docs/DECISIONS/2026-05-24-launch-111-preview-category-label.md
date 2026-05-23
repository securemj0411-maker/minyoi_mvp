# launch-111 — 비로그인 preview: 별표 마스킹 폐기 + 15만원 이하 5개

**Date**: 2026-05-24
**Owner**: caulee
**Scope**: preview-pool route — maskName 폐기 + tier 가격 한도 축소

## 배경 (사용자 frustration 2건)

1. 비로그인 메인 (/) preview-pool 매물 5개 제목이 `갤** S** 울**` 별표 마스킹 → "더러움".
2. TIER_B 가격 한도 30만원 → 신규 진입자 부담 큼.

## 변경

### TIER_B 가격 한도
- `TIER_B_MAX_KRW`: 300,000 → **150,000**
- 결과: 5개 다 15만원 이하 (10만 ×2 + 15만 ×3)

### maskName → categoryFriendlyLabel
- 단어 첫글자 + `*` repeat 함수 폐기
- 카테고리 코드 → 한글 라벨 매핑 (23개): shoe→신발, earphone→이어폰, smartphone→스마트폰, …
- response 의 `maskedName` 에 카테고리 라벨 채움

## 영향

비로그인 카드 제목이 "신발" / "이어폰" / "스마트폰" 같이 깔끔하게 나옴. 정확한 모델/시세는 가입 후만 노출 (카탈로그 leak 0).

---

## launch-111b — blur 제거 + 매입/시세 만원대 band

(같은 날 사용자 정정 2건)

### 배경
1. "이어폰/신발/의류 같은 걸 blur 처리하면 어떻게 해" — `maskedName` 에 `blur-[3px]` 박혀 있어서 카테고리 라벨도 흐릿. blur 의도와 카테고리 라벨 모순.
2. "매입/시세를 만원대로 하자 해놓고 정확값 박힌 거 = 구라". launch-111 답변에서 "이미 박혀 있음" 잘못 답변. 실제 코드는 `krw()` 정확값.

### 변경 (`preview-masked-dashboard.tsx`)
- `maskedName` 의 `blur-[3px]` 제거.
- `krwTenThousandBand()` 신규 — "15만원대", "150만원대".
- 매입 / 시세 / `marketGapLabel` 다 band 로 교체.

## 후속

launch-113 에서 sold 매물 실제 노출로 전환 — 정확값 다시 복귀 (sold 매물 = leak 없음).
