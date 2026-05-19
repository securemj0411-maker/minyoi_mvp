# 2026-05-19 Wave 371 — "다른 매물 찾기" append + dedupe (덮어쓰기 X)

사용자: "append로 해야지 더 둘러보고 싶어서 다른 매물 찾기 눌렀는데 갑자기 기존 꺼 없어지면 뭐 장난하자는거임?"

## 결정

`setItems(data.items)` 단순 덮어쓰기 → **append + pid dedupe**.

### 동작
| 트리거 | 동작 |
|---|---|
| 초기 load (`refresh=false`) | 덮어쓰기 (첫 데이터) |
| 정렬 변경 (`refresh=false`) | 덮어쓰기 (다른 풀이라 새로) |
| 카테고리 필터 (클라이언트) | items 영향 X, displayItems만 |
| **"다른 매물 찾기" (`refresh=true`)** | **append + dedupe** |

### Dedupe 로직
```ts
setItems((prev) => {
  const existingPids = new Set(prev.map((it) => it.pid));
  const fresh = data.items!.filter((it) => !existingPids.has(it.pid));
  return [...prev, ...fresh];
});
```

- pid 기준 새 매물만 추가
- 같은 매물 두 번 안 노출

## 영향

### 풀 크기 변동
- 처음: 30개
- 1번 누름: 30 + (새 매물 N개, 중복 제외) = 30~60개
- 2번 누름: 또 추가
- 점점 풀 커짐 (무한 스크롤 패턴)

### Sold-out 누적
- 백엔드는 매번 sold-out 5개 fetch
- Dedupe로 같은 sold-out 중복 제외 → 새 sold-out만 추가
- 자연스럽게 누적 (이전 본 sold-out 사라지지 않음)

### Empty case
- 모든 새 매물이 중복이면 fresh = [] → 추가 0개
- 사용자 입장: "다른 매물 찾기" 눌렀는데 변화 없음
- 현재 별도 안내 X — 풀이 새로워질 때까지 기다려야

### Cooldown
- 그대로 (30분). 30분 통과 후만 refresh=1 호출 가능
- 모달 안 "다른 매물 찾기" 버튼 disabled (cooldown 중)

## 변경 파일

`src/components/explore-client.tsx`:
- `loadPool` 안 `setItems(data.items)` 단순 호출 → refresh 여부에 따라 분기
- refresh=true: dedupe + append
- refresh=false: 그대로 덮어쓰기

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 후속 가능

- 풀이 너무 커지면 (>100개) 가상 스크롤
- 새 매물 0개일 때 토스트 안내 ("새 매물이 없어요")
- 카테고리 필터에 dedupe 적용 후 매물 수 표시
