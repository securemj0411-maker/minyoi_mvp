# Wave 241 (2026-05-19) — 새 사용자 코멘트 근본 fix (Wave 235 이후)

## 발단

사용자: "현재 코멘트도 봐보고 암튼 이미 너가 해결한 거일수도있고 근본적인 거 해결하려고하셈"

→ mvp_reveal_feedback 에서 Wave 235 이후 (08:30+) 박힌 코멘트 8건 분석.

## 발견 mismatch + 분류

### 즉시 fix (4건)

| pid | SKU | mismatch | fix |
|---|---|---|---|
| 407862936 | `shoe-asics-gel-kayano` | "아식스 x 톰브라운 카야노 14" 590k (일반 175k SKU) | mustNotContain "톰브라운/thom browne" + JJJJound/Kiko Kostadinov 등 designer collab |
| 400778196 | `bag-baobao-issey-miyake-lucent` | "캠퍼 × 이세이미야케" 신발 매물 bag SKU 매칭 | mustNotContain "캠퍼/camper/asics/salomon" + 신발 단어 명시 |
| 399103953 | `clothing-tnf-supreme-collab` | "Supreme x TNF Snakeskin **bag**" 200k 가방 매물 의류 SKU | mustNotContain "snakeskin bag/스네이크스킨/익스페디션 빅 백/스플릿 백/웨이스트 백/벨트 백" |
| 403477522/403560772 | `clothing-bape-tee` | BAPE tee/hoodie 콜라보 가격 45~520k 다 한 SKU (Travis Scott/CDG/Puma/스왈로브스키/뉴진스/세인트미카엘/네이버후드/wtaps) | mustNotContain 콜라보 brand 8 추가 |

### 정책 유지 (4건 — 자동 분리로 처리)

| pid | SKU | 사용자 코멘트 | 결정 |
|---|---|---|---|
| 408202266 | `clothing-polo-rrl-accessory` | "RRL 벨트 caiman crocodile vs 일반 — 다른 에디션 아닌가?? 아닐수도있음" | 사용자 확신 X. broad SKU 유지 (parser belt/wallet/cap 자동 분리). 다음 wave narrow split 검토. |
| 366123576 | `shoe-thugclub-adidas-superstar` | "슈퍼스타 부츠 럭스 vs 일반 — 비교부터가.." | text product-type "boot" vs "sneaker" 자동 분리 (Wave 236). 다음 cron 자동. |
| 328294050 | `shoe-cdg-vans-collab` | "포켓몬 vs 일반 카모 에디션 다른거 아닌가" | 사용자 확신 X. 에디션 narrow split 큰 작업 — skip. |

## 근본 진단

사용자 명시 "근본적인 거 해결" → 8건 패턴 종합:
- **edition/material variant 미분리** — BAPE 콜라보 / RRL 벨트 소재 / Asics 디자이너 collab / Vans CDG 에디션 ...
- **cross-category accessory** — BaoBao 신발 / TNF Supreme 가방
- **product-type 분리는 Wave 236 박힘** — text 명시 매물 자동 분리

근본 fix 전략 (단기 + 중기):
- **단기**: mustNotContain 으로 즉시 차단 (이번 wave)
- **중기**: narrow split (designer collab 별 SKU — Asics × Thom Browne, BAPE × Travis Scott 등 — 큰 작업 다음 wave)

## 파일

- `src/lib/catalog.ts` — shoe-asics-gel-kayano + clothing-tnf-supreme-collab + clothing-bape-tee mustNotContain
- `src/lib/generated/catalog-bag-wave91.ts` — bag-baobao-issey-miyake-lucent mustNotContain

## 미완 (다음 wave)

- RRL 벨트 narrow split (러프아웃 / 스터드 / caiman crocodile / 콘초 등 소재별)
- Asics × Thom Browne 별도 SKU
- BAPE × Travis Scott / × CDG 콜라보 별도 SKU (디자이너 collab 가격대 3~10배)
- Vans × CDG 에디션 별 narrow (포켓몬 / 일반 카모)
- HD15 Dyson narrow SKU 추가 (Wave 240 미완)
- production cron 후 60min 측정 (Wave 236~241 누적 효과)
