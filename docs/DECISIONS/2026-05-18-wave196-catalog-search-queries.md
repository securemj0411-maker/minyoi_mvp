# Wave 196 (2026-05-18) catalog SKU → search query 자동 매핑

> **상태: HIGH visibility 근본 fix.** Wave 187 (lifecycle batch) + Wave 184 (market-worker incremental) 의 의도된 후속. 시세 정확도 근본 layer.
>
> **⚠️ 다른 세션 주의 — 이미 박힘. 중복 작업 금지**:
> - `Sku` 타입에 `searchQueries?: string[]` optional 필드 **이미 추가됨** ([catalog.ts](../../src/lib/catalog.ts) line 53-60 부근)
> - `buildCatalogSearchQueries()` helper **이미 export됨** ([catalog.ts:6780](../../src/lib/catalog.ts:6780))
> - `pipeline-config.ts envQueries()` 가 **이미 catalog query 병합 중** ([pipeline-config.ts](../../src/lib/pipeline-config.ts) — 첫 import + line 374 부근)
> - env `PIPELINE_DISABLE_CATALOG_QUERIES=1` 로 rollback 가능
> - **catalog data (SKU 의 searchQueries 직접 채우기) 는 별 작업** — 본 wave 의 자동 fallback (aliases 사용) 이 충분히 cover. 필요 시에만 SKU 마다 명시.
>
> **재진행 trigger** (이 wave 박힌 후 다시 손댈 필요 있는 경우):
> - 신규 카테고리 SKU 추가 시 자동 cover (aliases 박혀있으면)
> - noise 발견 SKU 만 `searchQueries: []` 명시 차단
> - search budget timeout 측정 후 부족하면 query 우선순위 조정 (별 wave)

## 사용자 요구

> "근본적인 원인으로 해결해주라고;"

→ Wave 189/190/191/193/194/195 = UI/DB 표면 fix. 시세 sample 부족 (last_seen stale → cover 부족) **자체 원인 = search query 부족**. Wave 188 보류 사유 = catalog 충돌 + 작업량 — but 사용자 명시적 근본 fix 요구 → 자율 진행.

## 진단 (재요약)

| 카테고리 | search query 패턴 | fresh_28h % |
|---|---|---|
| 신발 | SKU 별 specific 30+개 ("호카 본디 8", "페가수스 40") | **80~92%** ✅ |
| 애플/갤럭시 | broad 만 ("맥북에어", "에어팟 프로 2") | **10~25%** ❌ |

**문제 흐름**:
1. broad query 검색 → 인기 모델 (M3/M4) 매물이 page 채움
2. 옛 모델 (i3, M1) 매물 page 뒤 → fetch 안 됨 → `last_seen` 영구 stale
3. market-worker 28h lookback (Wave 184) → stale 매물 시세 산정 제외
4. 시세 sample 3건 (실제 22 매물) → 우연 bias → 시세 110K (실제 130~170K)
5. 사용자 화면 시세 부정확

## 변경

### 1. `src/lib/catalog.ts` Sku 타입 확장

```ts
export type Sku = {
  ...
  // Wave 196: SKU 별 search query optional override.
  //   박힘 → 그 값 사용. 안 박힘 → aliases 자동 fallback.
  //   빈 배열 [] → noise 위험 SKU 자동 매핑 차단 (Wave 86 ILCE-7C 94% noise 학습).
  searchQueries?: string[];
};
```

### 2. `src/lib/catalog.ts` helper

```ts
export function buildCatalogSearchQueries(): string[] {
  const seen = new Set<string>();
  for (const sku of CATALOG) {
    const list = sku.searchQueries ?? sku.aliases;
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const q = typeof raw === "string" ? raw.trim() : "";
      if (!q || q.length < 4) continue;  // 4자 미만 noise
      seen.add(q);
    }
  }
  return [...seen];
}
```

- alias 4자 미만 skip (noise 차단)
- searchQueries 명시되면 우선, 없으면 aliases 자동

### 3. `src/lib/pipeline-config.ts` envQueries 병합

```ts
import { buildCatalogSearchQueries } from "@/lib/catalog";

function envQueries(): string[] {
  ...
  const catalogQueries = envBool("PIPELINE_DISABLE_CATALOG_QUERIES", false) ? [] : buildCatalogSearchQueries();
  const merged: string[] = [];
  for (const q of [...categoryQueries, ...queries, ...catalogQueries]) {
    if (!seen.has(q)) { seen.add(q); merged.push(q); }
  }
  return merged;
}
```

- 우선순위: category sweep > DEFAULT > catalog-derived (catalog 보충적, 시간 부족 시 후순위)
- env `PIPELINE_DISABLE_CATALOG_QUERIES=1` 로 rollback 가능

## 검증

### typecheck
```
npx tsc --noEmit --pretty false → 변경 파일 에러 0
```

### query 수 예상

catalog 329 SKU × 평균 3~5 aliases = 약 **1000~1500 catalog-derived queries**. DEFAULT 와 dedupe 후 약 800~1200 새 query 추가.

### 자연 효과 (다음 cron cycle 후)

1. search-worker 가 SKU 별 aliases 자연어 (예: "갤럭시 S23", "Galaxy S23") 로 매물 직접 검색
2. 인기 모델뿐 아니라 specific SKU 매물 fetch → `last_seen` 갱신
3. 1~2일 누적 시 fresh_28h % 25% → 60~80% 추정 (신발 사례 기준)
4. market-worker 시세 sample 다양화 → 사용자 매물 시세 정확

## 안전성 (whack-a-mole 검증)

| 변경 | 위험 | 영향 |
|---|---|---|
| Sku 타입 optional field 추가 | ✅ 안전 | 기존 SKU 영향 X, default undefined → aliases fallback |
| helper buildCatalogSearchQueries | ✅ 신규 | side effect X |
| envQueries 병합 | ⚠️ search-worker 시간 ↑ | 1000+ query 처리 부담. tickSearchBudgetMs 25s 안에 timeout 발생 시 일부 skip (cadence gate 가 우선순위 결정) |
| Bunjang API rate limit | ⚠️ 측정됨 | probe c=20 lenient. 시간당 ~수천 calls 안전 |
| 다른 컴포넌트 | ✅ 영향 X | catalog SKU data 안 건드림. 다른 세션의 catalog 작업과 영역 다름 |

### Search budget timeout 시나리오

- tickSearchBudgetMs 25s 안에 1000+ query 다 못 처리 → 일부 skip
- 다음 cycle 다시 시도. cadence gate (Wave 88) 가 query 우선순위 결정 — fresh % 낮은 SKU 자동 우선
- 점진 회복

## 미해결 → 별 wave

| Wave | 내용 | 우선 |
|---|---|---|
| 197? | noise 위험 SKU 점검 — alias 짧거나 모호한 SKU (예: 모델 코드 단독) 의 searchQueries=[] 명시 | low — 측정 후 발견 SKU 만 |
| 187-followup | parser v48 reparse 자연 완료 — NULL 66 매물 → 정상 분류 | 진행 중 |

## Lesson

1. **catalog data = single source of truth** — SKU aliases 가 search query 로 자동 활용. catalog 추가 시 query 같이 등록. drift 차단.
2. **신발 사례 검증** — Wave 134/138/144 의 specific query 30+ 박은 결과 fresh 80~92%. 동일 패턴 자동화로 다른 카테고리 확장.
3. **fallback chain 의미** — searchQueries 명시 (정제) > aliases (자동) > 4자 미만 skip (noise). 옵션 분리로 noise 위험 SKU 차단 가능.
4. **점진 자연 회복** — search-worker 한 cycle 에 다 처리 못 해도 cadence gate 가 우선순위 결정 → 1~2일 안에 점진 회복.

## 사용자 화면 예상 (1~2일 후)

기존 frustration:
- SE2 시세 110K (실제 130~170K)
- i3 macbook 시세 0건

Wave 196 효과:
- SE2 시세 sample 22 → 80%+ 매물 cover → 시세 ~140K (정확)
- i3 macbook search query "맥북 에어 i3" aliases 자동 추가 → fetch 보장 → 시세 박힘
- 다른 카테고리 모든 SKU fresh 비율 60~80%+ 추정
