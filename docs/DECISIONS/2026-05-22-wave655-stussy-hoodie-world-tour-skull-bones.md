# Wave 655 — Stussy Hoodie 월드투어/스컬본즈/iD 매거진 한정 차단 (clothing v27→v28)

## 발견

`clothing|stussy_hoodie|hoodie|c_grade` (32건, spread 8.4x).

| pid | name | price |
|-----|------|-------|
| 373138200 | 스투시 월드투어 후드 그레이 L | 185,000 |
| 408739522 | 스투시 8볼 후드 블루 M 피그먼트 정품 or 스투시 CPFM 8볼 | 159,000 |
| 309266242 | 스투시 SKULL & BONES PIG. DYED HOODIE 팝니다 | 150,000 |
| 399608155 | 스투시 월드 트라이브 후드 애쉬 헤더 | 140,000 |
| 400818245 | 스투시 베이직 스투시 피그먼트 다이아 후드 블루 XL | 140,000 |
| 376342224 | [XL] 스투시xiD 매거진 월드투어 피그먼트 후드 차콜 | 115,000 |
| 387556380 | 스투시 스택드 피그먼트 다이드 후드 xl | 100,000 |

일반 stussy hoodie c_grade = 22~50k → outlier 4~8배.

## 조치

기존 차단어 ("월드투어 후드" 단일 표기, "cpfm")으로 부족.
- `월드투어` (단독) — variant 모두 (피그먼트/차콜/그레이 etc.)
- `월드 트라이브` / `world tribe` — 별도 한정
- `skull & bones` / `스컬 본즈` — 빈티지 한정
- `iD 매거진` / `stussy id` — 매거진 collab
- `스택드` / `stacked` — 한정 라인
- `다이아 후드` / `피그먼트 다이아` — variant

parser `v27` → `v28` + invalidate.

## Why

기존 "월드투어 후드" 차단어는 정확 한 단어 시퀀스만. variant ("월드투어 피그먼트 후드", "월드투어 그레이" etc.)는 통과. 단어 단위 차단 ("월드투어")으로 강화.

## How to apply

stussy hoodie c_grade는 limited drop이 많아 spread 8x 이상이 정상. 추가 outlier 발견 시 한정 라인명 차단 + parser bump.
