# 2026-05-19 Wave 354 — /me 카드 등급 표시 (일반인 친화 풀어쓴 라벨)

사용자 지적:
1. /me 페이지(=ExploreClient) 카드에 상품 등급 표시 안 됨
2. "S급/A급/B급" 같은 짧은 라벨은 사용자가 뭔지 모름. 미개봉/새상품 아닌 등급 (B급/훼손 등)은 풀어쓴 친화 라벨이 나음

## 결정

### ConditionChip에 `variant="friendly"` 추가
- 기본 (`default`): "S급" / "A급" / "일반" / "사용감" / "훼손" — 운영자/모달 유지
- 친화 (`friendly`): "거의 새것" / "깨끗한 편" / "상태 보통" / "사용감 있음" / "하자 있음" — /me 카드용

### 라벨 매핑

| condition_class | default (운영자/모달) | friendly (/me 카드) |
|---|---|---|
| unopened | 미개봉/새상품 | 미개봉 |
| mint | S급 | 거의 새것 |
| clean | A급 | 깨끗한 편 |
| normal | 일반 | 상태 보통 |
| worn | 사용감 | 사용감 있음 |
| low_batt | 배터리 저하 | 배터리 약함 |
| flawed | 훼손 | 하자 있음 |

### 카드 배치
- 사진 오른쪽 메타 영역 (시간/우수셀러/무료배송 같은 줄)
- 시간 칩 **앞**에 배치 (등급이 가장 중요한 정보)
- sold out 카드엔 표시 X (이미 "잡힘" 칩 + 안내 문구 충분)

## 변경 파일

### `src/components/condition-chip.tsx`
- `Props`에 `variant?: "default" | "friendly"` 추가
- `ChipStyle`에 `friendlyLabel: string` 추가
- 7개 condition_class × `friendlyLabel` 매핑
- `displayLabel = variant === "friendly" ? friendlyLabel : label`

### `src/components/explore-client.tsx`
- `ConditionChip` import
- 카드 메타 영역에 `<ConditionChip conditionClass={item.conditionClass} variant="friendly" />` 추가
- `item.conditionClass`는 PoolItem에 이미 있음 (DB column)

## 검증

- `tsc --noEmit` 깨끗 (신규 에러 0)
- `eslint` 깨끗
- 기본 variant 사용처 (admin-pool-browser, pack-reveal-modal) 영향 X — prop optional

## 일관성

- 운영자풀: 짧은 라벨 유지 (정보 밀도 우선)
- 모달 (pack-reveal-modal): 기존 ConditionPhotoBadge 그대로 (사진 위 배지는 짧은 게 좋음)
- /me 카드: friendly 라벨 (사용자 이해 우선)
