# Category Intelligence — 카테고리 확장 엔진

`scripts/mine-category-intelligence.mjs`는 새 카테고리를 넓히기 전에 실제 번개장터 매물을 수집해서 아래를 한 번에 만든다.

- SKU 후보
- alias 후보
- 노이즈 룰 후보
- rough model별 가격 분포
- 사람이 검수할 리뷰 노트

## 실행

```bash
# 기본: smartphone
npm run mine:category

# 특정 카테고리
npm run mine:category -- --category=smartphone
npm run mine:category -- --category=tablet
npm run mine:category -- --category=laptop
npm run mine:category -- --category=small_appliance

# 여러 카테고리
npm run mine:category -- --category=smartphone,tablet

# 전체
npm run mine:category -- --category=all

# 빠른 스모크 테스트
npm run mine:category -- --category=smartphone --limit=20 --pages=1 --no-ai

# 이미 수집한 samples.json으로 AI/리포트만 재생성
npm run mine:category -- --category=smartphone --reuse-samples
```

기본값: `--category=smartphone --limit=300 --pages=2`

`OPENAI_API_KEY`는 `mvp/.env.local` 또는 `poc/.env`에서 읽는다. `--no-ai`를 붙이면 수집/분포만 생성한다.
AI 입력 샘플 수는 기본 50개이며 `CATEGORY_AI_SAMPLE_LIMIT`로 조정한다.

## 출력

```text
mvp/category-intelligence/
├── README.md
└── smartphone/
    ├── samples.json
    ├── price_distribution.json
    ├── noise_distribution.json
    ├── ai-intelligence.json
    ├── catalog_SUGGESTIONS.md
    ├── noise_PATCH.md
    └── REVIEW.md
```

## 운영 원칙

1. 이 스크립트는 자동 배포 도구가 아니다.
2. `catalog_SUGGESTIONS.md`에서 SKU 후보를 사람이 검수한다.
3. `noise_PATCH.md`에서 high/medium confidence 중 정밀도 높은 룰만 고른다.
4. `price_distribution.json`은 액세서리/부품/구매글/다중상품과 너무 낮은 가격을 제외한 rough 정상 본품 후보만으로 계산한다.
5. SKU id에는 `new/used/mint` 같은 상태값을 넣지 않는다. 상태는 매물 속성이고, 카탈로그 정체성이 아니다.
6. 승인한 것만 `src/lib/catalog.ts`와 `src/lib/pipeline.ts`에 수기 반영한다.
7. `npm run lint && npm run build` 통과 후 commit한다.
8. 다음 cron 후 `/debug`에서 저장 수, AI 제외 수, top 후보 품질을 확인한다.

## 왜 별도 엔진인가

`mine:rules`는 이미 존재하는 카테고리의 노이즈 키워드 보강용이다.

`mine:category`는 새 카테고리 확장 전 단계다. 스마트폰처럼 SKU 축이 넓은 카테고리는 룰만으로 부족하고, SKU 후보/alias/가격 분포까지 같이 봐야 한다.
