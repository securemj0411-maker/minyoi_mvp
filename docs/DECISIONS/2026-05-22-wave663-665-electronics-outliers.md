# Wave 663-665 — Electronics 가격 outlier audit (spread 70~236x)

## Wave 663 — Galaxy Tab S10 Ultra 150M placeholder

pid 391306264 "갤럭시 탭 S10 울트라 5G 512GB 실버 정품 키보드" **150,000,000** (1.5억).

정상 시세 85~130만. 1.5억 = 명백한 typo/placeholder. 단일 invalidate.

## Wave 664 — Galaxy Watch 4 42mm spread 236x

| pid | name | price |
|-----|------|-------|
| 283510780 | 삼성 갤럭시 워치 4 클래식 톰브라운 에디션 42mm 풀세트 | 1,180,000 |
| 216874100 | 미개봉새상품 갤럭시워치4 42mm | 250,000 |
| ... | (정상 50~130k) | ... |
| 409431418 | 갤럭시워치4 42mm 클래식 베젤 부품 | 5,000 |

**Outlier 두 방향**:
- 상단: 톰브라운 collab edition (1.18M) — 정상의 5배
- 하단: 베젤 부품만 (5k) — accessory_only인데 매물 매칭

**catalog 강화 (galaxywatch-4 mustNotContain)**:
- `톰브라운` / `thom browne` / `tb collab`
- `디올` / `dior` / `마틴 마르지엘라` (collab)
- `에디션` / `edition` / `한정 에디션` / `limited edition`
- 부품: `베젤 부품` / `베젤만` / `케이스만` / `스트랩만` / `줄만` / `프레임만`

## Wave 665 — Beats Solo 4 Jennie spread 160x

| pid | name | price |
|-----|------|-------|
| 355247466 | [현매물] 비츠 솔로4 무선 온 이어 헤드폰 제니 스페셜 에디션 루비 레 | 1,600,000 |
| ... | (정상 480~640k) | ... |
| 359652783 | 제니스페셜헤드셋 비츠솔로4가 머길래 | 10,000 |

상/하 outlier 2건. 1.6M = 정상의 2.5배 (typo/새상품). 10k = blog/광고성 매물 (clickbait).

## 조치

각 SKU 단일 invalidate (광범위 차단 없이). catalog 강화는 Wave 664만 (Galaxy Watch 4).

## Why

Task #25 (전자기기 가격 outlier sanity check) 패턴 — placeholder/typo 매물이 시세 산정 inflate. 단일 invalidate로 임시 대응, systemic은 catalog별 max price hard limit (msrp × N 등) 필요.

## How to apply

전자기기 단일 outlier는 invalidate로 대응. systemic 차단 (시세 산정 IQR/Z-score outlier 제외)은 Task #25에서 별도 추진.
