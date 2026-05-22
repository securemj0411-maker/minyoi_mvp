# Wave 669-670 — Galaxy Tab/Watch placeholder + 톰브라운 collab 차단

## Wave 669 — Galaxy Tab S8+ / S9 FE+ placeholder

| pid | name | price |
|-----|------|-------|
| 372086468 | 갤럭시탭 S8 플러스 128gb 그래파이트 wifi | 7,777 |
| 355154363 | 삼성 갤럭시탭 S9 FE+ 미개봉 새제품 | 7,580,000 |

S8+ 정상 35~45만, S9 FE+ 정상 58만. 7777원 / 758만원 = typo placeholder.

## Wave 670 — Galaxy Watch 3 41mm 톰브라운 collab

| pid | name | price |
|-----|------|-------|
| 370265147 | 삼성 갤럭시 워치 3 톰브라운 에디션 41mm | 500,000 |
| 400426263 | 갤럭시 워치3 41mm 무광 실버 톰브라운 에디션 | 490,000 |
| ... | 일반 워치 3 | 80,000~136,000 |

**galaxywatch-3 + galaxywatch-5 catalog 강화** (Wave 664 Watch 4와 동일 패턴):
- `톰브라운` / `thom browne` / `에디션` / `한정 에디션`
- 부품: 베젤만 / 스트랩만 / 케이스만 / 충전기만 / 부품 / 고장 / 매입

## 조치

- catalog (galaxywatch-3, galaxywatch-5) mustNotContain 추가
- invalidate: 4 pids (placeholder 2 + 톰브라운 2)

## Why

Samsung Galaxy 라인 (Tab/Watch)에 collab edition (톰브라운 / 디올) 가격대가 일반 모델 5~10배. broad SKU에서 차단.

placeholder/typo 매물은 매물 데이터 품질 이슈 — invalidate로 시세 inflate 방지. Task #25 systemic max price hard limit 후속.

## How to apply

Galaxy 시리즈 신규 SKU 추가 시 톰브라운/디올/Hermès collab + 부품 차단어 default로. floor outlier 발견 시 description에 placeholder/typo 시그널 확인.
