# 2026-05-19 Wave 370 — /me 피드 마진 압축 + 스켈레톤 잔해 정리

사용자 2가지:
1. 카테고리 sticky bar (이어폰/폰...) 위아래 마진 큼 (모바일 좁은데)
2. 새로고침 시 스켈레톤 2개 정도 뜨다가 결국 안 나오는 "잔해"

## 변경

### 마진/패딩 압축
- 통계 cream 박스: `mb-3 py-2` → `mb-2 py-1.5` (12+8 → 8+6)
- sticky 카테고리 바: `mb-3 py-2` → `mb-2 py-1.5`
- 위아래 누적 ~40px → ~24px 절약

### 스켈레톤 6 → 3
- 모바일 viewport ~2개만 보이는 데 6개 박혀있어서 데이터 도착 후 "잔해" 인식
- 실제 매물도 풀 정책 (wave 247.2/249/369) 따라 자주 < 6 → 시각 mismatch
- 3개로 줄여서 빠른 fade-in 체감

### 빈 풀 분기 친화 톤
**이전**: `bg-white p-6 text-zinc-600` "6시간 이상 지난 매물이 아직 없어요. 잠시 후 다시 와주세요."
- 평범한 회색 박스, 잔해처럼 보임

**이후**: emerald-tinted 박스 + HourglassIcon + 2-tier 메시지
- 큰 모래시계 아이콘 (h-8 w-8)
- "잠시 후 다시 와주세요" (font-bold)
- "매물 분석 중이에요. 곧 새 풀이 풀려요." (보조)
- 사이트 톤 (emerald 친화)

## 변경 파일

`src/components/explore-client.tsx`:
- line 365 통계 박스 className
- line 396 sticky bar className
- line 445 `length: 6` → `length: 3`
- line 473-478 빈 풀 분기 재설계

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

- 모바일 화면 상단 ~16px 공간 확보 (카테고리 위까지)
- 데이터 도착 후 layout shift 줄임 (3개 스켈레톤 → 실제 매물)
- 빈 풀일 때 잔해처럼 X, 명확한 다음 액션 안내
