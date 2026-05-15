# Wave 111 — normalize 모델명-suffix 공백 정규화 (가장 큰 vertical 강화)

> Status: **applied (code).** owner 지적 "vertical strengthening 우선". Wave 108-110은 horizontal expansion (새 lane). 진짜 vertical = 기존 lane 약점 분석 + 정밀화. 가장 큰 약점 iPhone Pro 128 self lane mining audit → 핵심 normalize 버그 발견.

CLAUDE.md 6 필드 포맷.

## 1. 진단 — iphone_15_pro_128gb_self lane match 49%

- 시간: 2026-05-15
- 발견: lane-replay 측정 iPhone Pro 자급제 lane들 매칭 약함:
  - iphone_15_pro_128gb_self: 50% lane match / 49% complete
  - iphone_14_pro_128gb_self: 56%
  - iphone_16_pro_128gb_self: 40%
  - galaxy_s24_ultra_256_self: 59%

  Mining sample 200건 직접 audit (`scripts/audit-iphone-15-pro-self.ts`):
  - Narrow match: 3건 (1.5%)
  - Broad iphone-15-pro 매칭: 84건
  - **Null (collision): 113건**

  Null 매물 sample 분석:
  - "아이폰 15프로 화이트티타늄 128기가 풀박" → null
  - "아이폰 15프로 128 화이트 풀박스" → null
  - 공통 패턴: **"아이폰 15프로"** (공백 비대칭 — 모델 숫자 + suffix 사이 공백 없음)

  **근본 원인**: normalize 함수가 모델명-suffix 공백 정규화 안 함:
  - "아이폰 15프로" — 한 공백 (15 다음)
  - catalog mustContain: "아이폰 15 프로" (양쪽 공백) / "아이폰15프로" (공백 0) / "iphone 15 pro"
  - tokenHit("아이폰 15 프로") → "아이폰 15프로 128" includes "아이폰 15 프로" = **false**
  - tokenHit("아이폰15프로") → "아이폰 15프로 128" includes "아이폰15프로" = **false** (공백 있음)
  - broad/narrow 둘 다 매칭 안 됨 → null

- 변경: 측정만.
- 위험: —
- 다음: NORMALIZATIONS rule 추가.

## 2. NORMALIZATIONS 모델명-suffix 공백 정규화

- 시간: 2026-05-15
- 변경: **[mvp/src/lib/catalog.ts:2881](mvp/src/lib/catalog.ts:2881)** NORMALIZATIONS 끝에 8개 rule 추가:
  ```typescript
  [/아이폰\s*(\d{1,2}e?)\s*프로\s?맥스/g, " 아이폰 $1 프로맥스 "],
  [/iphone\s*(\d{1,2}e?)\s*pro\s?max/gi, " iphone $1 pro max "],
  [/아이폰\s*(\d{1,2}e?)\s*프로(?!\s?맥)/g, " 아이폰 $1 프로 "],
  [/iphone\s*(\d{1,2}e?)\s*pro(?!\s?max)/gi, " iphone $1 pro "],
  [/아이폰\s*(\d{1,2}e?)\s*플러스/g, " 아이폰 $1 플러스 "],
  [/iphone\s*(\d{1,2}e?)\s*plus/gi, " iphone $1 plus "],
  [/갤럭시\s*s\s?(\d{1,2})\s*울트라/gi, " 갤럭시 s$1 울트라 "],
  [/galaxy\s*s\s?(\d{1,2})\s*ultra/gi, " galaxy s$1 ultra "],
  [/갤럭시\s*s\s?(\d{1,2})\s*플러스/gi, " 갤럭시 s$1 플러스 "],
  [/galaxy\s*s\s?(\d{1,2})\s*plus/gi, " galaxy s$1 plus "],
  [/갤럭시\s*z\s*(플립|폴드)\s?(\d{1,2})/gi, " 갤럭시 z$1 $2 "],
  [/galaxy\s*z\s*(flip|fold)\s?(\d{1,2})/gi, " galaxy z$1 $2 "],
  ```
- 검증:
  - tsc clean, 139/139 test pass
  - audit-iphone-15-pro-self.ts:
    - Null: 113 → **18** (95건 감소)
    - Broad 매칭: 84 → 175 (정확)
  - **lane-replay 효과**:
    | Lane | Before | After |
    |---|---:|---:|
    | iphone_15_pro_128gb_self | sku 50% / complete 49% | **sku 93.5% / complete 92%** |
    | iphone_14_pro_128gb_self | 56% / 55.5% | **90.5% / 89.5%** |
    | galaxy_s25_ultra_256_self | 76% / 75.5% | **90% / 89%** |
    | galaxy_s24_ultra_256_self | 61% / 59% | **84.5% / 82.5%** |
    | galaxy_s23_ultra_256_self | 71% / 67% | **84.5% / 80%** |
    | iphone_16_pro_128gb_self | 40% / 40% | 48% / 48% (sample 25 작음) |

  **iPhone 15 Pro 자급제 lane A급(>90%) 도달**. Galaxy Ultra B급(80%+) 도달.

- 위험: 낮음. normalize 규칙은 모델명 + 명확한 suffix 패턴이라 false positive 위험 작음.
- 다음:
  - production new 매물 ruleMatch에서 즉시 효과 (collect cron)
  - 기존 raw_listings 한 번 더 reclassify 검토 (단 mining sample 결과 이미 narrow 흡수 다수)
  - iPhone 16 Pro lane sample 25건 작음 — Wave 91-style mining 더 보강 검토

## 3. 거론 금지

- 위 normalize rule을 모든 모델로 확장 — over-aggressive normalize는 false positive 위험. 현재 iPhone/Galaxy S/Z만.
- 16 Pro lane sample 부족 — mining 작업 별도. ruleMatch 약점 아님.
