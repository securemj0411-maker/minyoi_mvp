# Rule Mining — 카테고리별 노이즈 룰 발굴

`mvp/scripts/mine-noise-rules.mjs` 가 번개장터에서 카테고리별 매물을 수집하고, 휴리스틱 + AI 분석으로 `pipeline.ts`에 추가할 노이즈 키워드를 제안한다.

## 실행

```bash
# 전체 카테고리 (airpods + applewatch + galaxywatch)
npm run mine:rules

# 특정 카테고리만
npm run mine:rules -- --category=applewatch

# 여러 개 콤마로
npm run mine:rules -- --category=applewatch,galaxywatch

# 옵션
npm run mine:rules -- --category=airpods --limit=250 --pages=2
npm run mine:rules -- --no-ai           # AI 호출 생략 (휴리스틱만)
```

기본값: `--limit=250 --pages=2 --category=all`

`OPENAI_API_KEY` 가 `mvp/.env.local` 또는 `poc/.env` 에 있으면 AI 호출. 없거나 `--no-ai` 면 휴리스틱만.

## 출력

```
mvp/rule-mining/
├── README.md                   ← 이 파일
├── airpods/
│   ├── samples.json            ← 수집된 raw 매물
│   ├── distribution.json       ← 휴리스틱 분포 (parts X건, multi Y건)
│   ├── ai-suggestions.json     ← AI 응답 그대로
│   ├── RULE_MINING_REPORT.md   ← 사람용 종합 리포트
│   └── PATCH.md                ← 핵심: pipeline.ts에 추가할 키워드 후보
├── applewatch/ (동일 구조)
└── galaxywatch/ (동일 구조)
```

## 워크플로

1. 마이닝 실행 (위 명령어). 카테고리당 약 5~10분.
2. `mvp/rule-mining/{category}/PATCH.md` 열고 high/medium confidence 항목 검수.
3. 근거 PID 1~2건 spot-check — 실제 매물 description에 키워드가 정상 매칭되는지.
4. 좋은 키워드를 `mvp/src/lib/pipeline.ts` 의 해당 상수 배열 (`PARTS_KEYWORDS`, `DAMAGED_KEYWORDS`, `MULTI_KEYWORDS`, `ACCESSORY_TITLE_KEYWORDS` 등) 에 추가.
5. `npm run lint && npm run build` 통과 확인 후 commit.
6. 다음 cron (30분 이내) 실행에서 Supabase의 새 매물 분류 결과 변화 확인.

## 언제 다시 돌릴지

- 새 카테고리/SKU 확장 직전 (예: 갤럭시 버즈, 애플 펜슬 추가 시)
- top 후보에서 노이즈가 다시 새기 시작했을 때
- 분기 1회 정기 점검

## 카테고리 추가하려면

`scripts/mine-noise-rules.mjs` 상단 `CATEGORIES` 객체에 항목 추가:

```js
CATEGORIES.galaxybuds = {
  label: "Galaxy Buds",
  queries: ["갤럭시버즈", "갤럭시 버즈 프로", ...],
  skus: ["galaxybuds-pro-2", ...],
  aiHints: "...",
};
```

`catalog.ts` SKU 추가는 별도 작업.

## 자동 코드 생성을 안 하는 이유

JSON → TypeScript 자동 PR/배포까지는 의도적으로 하지 않았다. MVP에서는 사람의 눈으로 검수하는 게 안전망이고, 룰 변경은 빈도가 낮아 수기 반영 비용이 작다. 카테고리 10개 이상으로 확장되면 그때 자동화 재고.
