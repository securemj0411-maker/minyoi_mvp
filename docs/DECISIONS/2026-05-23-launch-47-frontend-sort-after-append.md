# 2026-05-23 — launch-47: feed append 후 frontend client-side sort

## 사용자 짚음
> "매입단가순으로 하면 feed에서 초반건 순서대로 싼거로 하다가 아랫부분에는 막 갑자기 더 싼거 나오고 오름차순인데 분명히 제일 싸면 맨 앞에 나와야될텐데 암튼 이게 중간중간 feed append때문에 초반것만 되는건지?? 아니면 append단위로 오름차순이 적용되는건지?"

## 진단

### root cause
- `src/components/explore-client.tsx:1469` `displayItems` useMemo = **filter 만 적용, sort X**
- backend `/api/packs/pool` 가 PAGE_SIZE 30 단위로만 정렬:
  ```ts
  if (sort === "price_asc") items = sort by price;
  items = items.slice(0, PAGE_SIZE);
  ```
- frontend 가 새 batch append 시 (line 1351-1360): 이전 items + 새 items
- 결과: 1차 batch (1~25 가격) + 2차 batch (5~30 가격) → **5 가 25 뒤에 나옴 (reverse)**

= **append 단위 정렬, 전체 정렬 X**.

## fix

`displayItems` 에 client-side sort 추가:
```ts
if (sort === "price_asc") {
  return [...filtered].sort((a, b) =>
    a.price - b.price || b.expectedProfitMax - a.expectedProfitMax
  );
}
if (sort === "latest") {
  return [...filtered].sort((a, b) =>
    Date.parse(b.lastVerifiedAt) - Date.parse(a.lastVerifiedAt)
  );
}
return filtered;  // profit_desc = backend random shuffle 유지
```

### sort 별 처리
- **price_asc**: client-side sort (a.price asc, b.expectedProfitMax desc tiebreaker)
- **latest**: client-side sort (lastVerifiedAt desc)
- **profit_desc**: backend 의 다양화 + random shuffle 유지 (사용자에게 카테고리 다양 매물)

## 영향
- 코드: src/components/explore-client.tsx 1 곳 (displayItems useMemo)
- 사용자: 매입단가순/최신순 진짜 전체 정렬 — append 후에도 일관

## Trade-off
- 장점: 사용자 기대 일치 (가격 정렬 = 진짜 오름차순)
- 단점: 큰 items array sort = O(n log n) per render. items 100-200 정도라 부담 X.

## 메모리 룰
- UI 일관성: 사용자 약속 (정렬) 그대로 작동
- decision log: 이 파일
