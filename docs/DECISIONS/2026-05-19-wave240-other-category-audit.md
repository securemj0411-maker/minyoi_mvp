# Wave 240 (2026-05-19) — 다른 카테고리 audit (dyson/lego)

## 발단

사용자: "다른 거도 좋은데". Wave 237~239 fashion 위주 후 다른 카테고리 (perfume/kickboard/lego/dyson/airwrap/theragun/samsung) sample 검증.

## 발견 mismatch (3건)

| SKU | mismatch | 사례 |
|---|---|---|
| `dyson-airwrap-hs05` | **다른 brand** (로로보아) | "로로보아 에어아르떼 드라이기 (다이슨 에어랩X)" 32k |
| `dyson-supersonic-hd08` | **HD15 모델** | "다이슨 슈퍼소닉 HD15" 188k (HD08 ≠ HD15) |
| `lego-75331-razor-crest` | **부품 단품** | "75331 만달로리안 만도 몸통+헬멧 부품" 40k (본품 1.1M+) |

## fix

### 1. dyson-supersonic-hd08 mustContain/mustNotContain
- mustContain 에서 "hd15" 제거 (HD08 만 매칭)
- mustNotContain: "hd15", "hd16", "hd17", "supersonic nural", "뉴럴" 추가

→ HD15 매물 unmatched 처리. 다음 wave HD15 narrow SKU 추가.

### 2. dyson-airwrap-hs05 mustNotContain
- "로로보아", "loroboa", "에어아르떼", "airarte" 추가
- "에어랩x", "에어랩 아님", "에어랩이 아닌" 추가 (명시적 부정 표기)

### 3. lego-75331-razor-crest mustNotContain
- "몸통", "헬멧만", "헬멧 부품", "피규어만", "미니피겨만", "minifigure only", "부품 새상품" 추가

## 검토 정상 SKU (다 정확)

- dyson-airwrap-hs05 (Airwrap multi-styler)
- dyson-airwrap-id (I.D.)
- dyson-airwrap-origin (Origin)
- dyson-corrale-hs07 (Corrale Straightener)
- dyson-supersonic-origin (Supersonic Origin HD08)
- lego-10297-boutique-hotel
- lego-10312-jazz-club (구매요청 매물 1건 — 다음 cron 후 sku_id=null 자동 reset)
- lego-10326-natural-history-museum
- lego-21319-central-perk
- lego-21338-a-frame-cabin
- lego-42115-lamborghini-sian
- lego-42143-ferrari-daytona
- lego-75192-millennium-falcon
- lego-75313-at-at
- lego-75355-x-wing (UCS 루크 32k 매물 — 미니피겨 단품 가능성 모니터링)

## 미완

- perfume / kickboard / theragun / samsung — sample 매물 0건 (해당 SKU 매물 X 또는 catalog SKU 다른 prefix)
- HD15 narrow SKU 추가 (Dyson 새 세대)
- LEGO 75355 X-Wing 미니피겨 단품 검증 (32k 의심)
