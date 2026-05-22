# Wave 660 — Coach Tabby 폴리쉬드 페블 레더 차단 (bag v22→v23)

## 발견

`bag|coach_tabby|shoulder|era_unknown|unknown_size_variant` (7건, spread 8.20x).

| pid | name | price |
|-----|------|-------|
| 357061750 | 코치 태비숄드백 CY920 블랙 | 820,000 |
| 393999706 | 코치 폴리쉬드 페블 레더 태비 숄더 백 | 700,000 |
| 392537788 | 코치 폴리쉬드 페블 레더 태비 숄더 백 | 680,000 |
| 306236113 | 코치 가방 타임스퀘어 태비 숄더백 위드 퀼팅 CW629 B4MER | 269,000 |
| 333386074 | 코치 태비 브라운 가죽 숄더백 | 204,680 |
| 383302206 | 코치 태비숄더백 아이보리 | 200,000 |
| 366223130 | 코치 타임스퀘어 태비 숄더 백 위드 퀼팅 17 | 100,000 |

두 가격대 — 일반 태비 100~205k vs 폴리쉬드 페블 레더 680~820k (top tier).

## 조치

mustNotContain 추가:
- `폴리쉬드 페블` / `polished pebble` / `폴리쉬드페블`
- `페블 레더` / `pebble leather`
- `cw629` / `b4mer` (SKU 코드 — short token 정확 매칭)

parser bag v22 → v23 + invalidate.

## Why

폴리쉬드 페블 레더는 Coach top-tier 시즌 collection (시그니처 페블 가죽 + 폴리쉬 마감). 일반 태비 시세 (10~20만) 대비 4배. broad SKU에 흘려보내면 spread 부풀림.

## How to apply

Coach Tabby 풀 확보되면 `coach_tabby_pebble` narrow SKU 분리 검토. 그때까지 broad에서 차단.
