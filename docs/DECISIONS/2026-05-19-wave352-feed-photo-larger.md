# 2026-05-19 Wave 352 — /me 피드 사진 확대 (당근 스타일 매칭)

사용자 지적: "당근은 사진이 더 크고 그렇지 않나?" — Wave 350에서 당근 스타일 (박스 X, divider만) 적용 후 사진 크기가 당근 대비 작음.

## 결정

### 사진 확대 88px → 120px
- 모바일 grid `[88px_minmax(0,1fr)]` → `[120px_minmax(0,1fr)]`
- Next/Image `sizes="88px"` → `sizes="120px"`
- 스켈레톤도 동일 크기로 매칭

### 패딩 조정 py-3 → py-4
- 사진이 커진 만큼 행 간격도 늘려 시각적 밸런스 유지
- 데스크탑 박스(`sm:p-3`)는 그대로 — 카드 모드 보존

## 변경 파일

수정:
- `src/components/explore-client.tsx` (3 곳)
  - line 386: 스켈레톤 grid + padding
  - line 434: 실제 카드 버튼 grid + padding
  - line 447: Next/Image sizes prop

## 검증

- `tsc --noEmit` — 신규 에러 0 (기존 tests/*.ts 에러는 pre-existing, 이 변경과 무관)
- `eslint` 깨끗

## 사용자 흐름

```
/me 진입 → ExploreClient feed
  ↓
모바일: 120px 정사각 썸네일 + 텍스트 (좌우 grid)
  ↓
당근마켓 피드 visual density 매칭
```
