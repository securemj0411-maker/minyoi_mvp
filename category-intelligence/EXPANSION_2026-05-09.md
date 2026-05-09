# Category Expansion Run — 2026-05-09

## 실행 목적

토큰형 후보팩 BM을 확정하기 전에 실제 매물 풀이 충분한지 확인하기 위해 `아이폰 갤럭시 노트북` 범위를 v3 마이닝으로 확장 검증했다.

## 실행 커맨드

```bash
npm run mine:category:v3 -- --category="아이폰 갤럭시 노트북" --plan-only
npm run mine:category:v3 -- --category="아이폰 갤럭시 노트북" --limit=700 --pages=3
npm run mine:category:v3 -- --category=smartphone,laptop --reuse-samples
npm run promote:catalog -- --category=smartphone --prepare-approval
npm run promote:catalog -- --category=laptop --prepare-approval
```

## Planner 결과

자연어 요청 `아이폰 갤럭시 노트북`은 AI planner에 의해 다음 두 카테고리로 분해됐다.

| category | 포함 범위 |
|---|---|
| smartphone | 아이폰, 갤럭시, 스마트폰 매입/파손/중고 |
| laptop | 노트북, 맥북, 아이맥, 게이밍 노트북, 액정파손/부품용 |

## 최종 마이닝 결과

| category | samples | normal | normal 비율 | 주요 노이즈 | SKU 후보 | 승인 큐 |
|---|---:|---:|---:|---|---:|---:|
| smartphone | 699 | 357 | 51% | buying 206, damaged 72, accessory 64 | 6 | 8 pending |
| laptop | 694 | 475 | 68% | buying 121, damaged 93, ambiguous 4 | 8 | 12 pending |

## 시세 계산 가능한 SKU 후보

`count >= 5` 기준.

### smartphone

| SKU key | count | median |
|---|---:|---:|
| iphone-13 | 13 | 320,000 |
| galaxy-s23 | 10 | 300,000 |
| iphone-12 | 8 | 209,000 |
| iphone-15 | 8 | 636,000 |
| iphone-16 | 7 | 789,000 |
| galaxy-s24 | 6 | 430,000 |
| galaxy-s24-plus | 6 | 515,000 |
| iphone-15-pro | 5 | 905,000 |
| iphone-14 | 5 | 441,000 |
| galaxy-z-flip5 | 5 | 180,000 |

### laptop

| SKU key | count | median |
|---|---:|---:|
| macbook-pro | 61 | 899,000 |
| macbook-air | 29 | 799,000 |

## 판단

- smartphone은 매물 수는 충분하지만 buying/파손/액세서리 비율이 높다. 후보팩 BM에 쓰려면 매입글/업자성/파손폰 필터를 먼저 운영 pipeline에 승격해야 한다.
- laptop은 normal 비율이 68%로 더 좋고, MacBook Pro/Air 시세 샘플이 두껍다. 다음 확장 우선순위는 laptop 쪽이 더 높다.
- 단, laptop SKU 후보는 `맥북프로 M4 16인치`, `LG 그램`, `윈도우 노트북`처럼 세부 스펙 폭이 넓다. production 반영 전 approval queue 수동 검수가 필요하다.

## 도중 발견한 마이닝 안전장치 보강

AI가 `노트북`, `맥북` 같은 넓은 제품군 단어를 노이즈 키워드로 제안하는 케이스가 있었다. 이 단어들은 normal 매물에도 너무 자주 등장하므로 자동승격하면 위험하다.

조치:

- `mine-category-intelligence-v3.mjs`의 `keywordRiskFlags()`에 `broad_product_family_keyword` 위험 플래그 추가
- `노트북`, `맥북`, `아이폰`, `갤럭시`, `에어팟`, `애플워치`, `아이패드` 등 넓은 제품군 단어는 accessory 외 noise rule 자동승격 차단

## 다음 액션

1. laptop approval queue 12건 중 MacBook Pro/Air 관련 후보만 우선 승인 검토
2. smartphone은 `buying`, `damaged`, `accessory` 룰 후보부터 pipeline에 승격 검토
3. 승인 후 `promote-catalog --apply`
4. production 후보 풀이 얼마나 늘어나는지 QStash tick 2~3회 관찰
5. 그 다음 후보팩 BM 가능성 지표: 하루 3만원+/5만원+ 후보 수 집계
