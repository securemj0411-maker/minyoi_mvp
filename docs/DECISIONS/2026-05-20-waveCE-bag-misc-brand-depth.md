# Wave C + E — bag + 나머지 6 카테고리 brand depth

날짜: 2026-05-20
영역: category-brand-depth.ts + tests

## 배경

Wave A (shoe) + Wave B (clothing) + Wave D (전자) 완료 후 남은 카테고리:
- **Wave C (bag)** — 별 세션 진행 중이었으나 코드 미박힘
- **Wave E (watch/perfume/camera/drone/earphone/smartwatch)** — 별 세션이 WATCH 작업 시작 후 API Error 로 중단

사용자 결정 = "C + E 수동 진행 (서세션이 아니라 우리가 직접)".

## 변경

`mvp/src/lib/category-brand-depth.ts` 에 7 카테고리 블록 추가 + Registry 12 카테고리 완성.

### Wave C — bag (15 브랜드)

명품 (high risk):
- **Louis Vuitton** — 데이트 코드 / RFID 칩 (2021+) / 모노그램 정확성
- **Chanel** — 7~8자리 시리얼 + 보증 카드 매칭 / 퀼팅 다이아몬드
- **Gucci** — 시리얼 2줄 / GG 모노그램 간격 / Marmont 매물 주의
- **Hermès** — 새들 스티치 손바느질 / 년식 마크 (Square/Circle 알파벳) / Kelly/Birkin 인증 필수
- **Dior** — Lady Dior Cannage 패턴 / 시리얼 코드 형식
- **Goyard** — Y 헤링본 손그림 패턴
- **Prada** — 삼각 로고 양각 / Saffiano 가죽 / Re-Nylon
- **Bottega Veneta** — Intrecciato 위빙 strip 너비 균일
- **Celine** — Phoebe vs Hedi 시대 구분
- **Loewe** — Anagram 4 L 모양

대중 (moderate~low):
- **Maison Margiela** — Four-stitch + Numbers 라벨
- **Supreme** — BOX 로고 Futura Heavy Oblique (clothing Wave B 동일)
- **Stussy** — 손글씨 로고
- **TNF (North Face)** — 보레알리스/핫샷 + Supreme 콜라보
- **Acne Studios** — Musubi 시그니처
- **Carhartt WIP** — 노란 사각 라벨 (low risk)

### Wave E — 6 카테고리

#### watch (Rolex/Omega/Cartier/AP/PP/IWC high + Casio/Seiko low)
- Rolex: 8자리 시리얼 / 크라운 5각형 / Caliber 3xxx 무브먼트
- Omega: Co-Axial 무브먼트 / Seamaster HEV
- Cartier: 사파이어 cabochon / Roman Numeral 'IIII' (IV 아님)
- AP: Royal Oak 8 hex screw 위치 / Tapisserie 다이얼
- Patek: Extract from Archives ($400) = 정품 검증 최고 도구
- IWC: Caliber 32/51/89 시리즈
- Casio G-Shock / Seiko: 가품 거의 없음

#### perfume (Chanel/Dior high + Tom Ford/Jo Malone/Diptyque/Le Labo moderate)
- Chanel/Dior: 병 바닥 시리얼 + 박스 매칭 / Sauvage 가품 매우 흔함
- Tom Ford: Private Blend (Tobacco Vanille 등) 가품 흔함
- Jo Malone: Wood Sage / Lime Basil / English Pear
- Diptyque: Do Son / Tam Dao
- Le Labo: 라벨에 사용자 이름 + 날짜 (정품 표시)
- Memo Paris / Replica (Maison Margiela)

#### camera (모두 low risk — 가품 거의 X)
- Sony A7M3/M4 (300,000 셔터), Canon R5/R6/5D, Nikon Z9, Fujifilm X-T4/T5, Leica M11/Q3 (moderate)
- 진짜 위험 = 셔터 카운트 / 렌즈 곰팡이 / AS

#### drone (DJI low — 가품 거의 X)
- DJI Mavic/Air/Mini — 활성화 횟수 + 펌웨어 + 배터리 사이클
- GoPro Hero

#### earphone (high risk — 차이팟 가품 매우 흔함)
- AirPods Pro: 무게 5.3g / 케이스 50.8g / iOS 페어링 팝업
- AirPods 2/3/4 + AirPods Max
- Galaxy Buds (moderate), Sony WF/WH, Bose QC, Beats (Apple), Sennheiser

#### smartwatch (all low risk)
- Apple Watch (Series 9/10 + Ultra/Ultra 2)
- Galaxy Watch / Garmin Fenix
- 진짜 위험 = iCloud/FRP 잠금 + 페어링 해제 + 배터리

## Registry 완성

```ts
export const CATEGORY_BRAND_DEPTH = {
  shoe, clothing, smartphone, tablet, laptop,  // Wave A/B/D
  bag, watch, perfume, camera, drone, earphone, smartwatch,  // Wave C+E
};
```

12 카테고리 모두 cover. 외부 review #4 (모델별 가품 체크포인트) **완전 해소**.

## 검증

- TypeScript: 우리 파일 에러 0
- Test: 42/42 pass (Wave C+E 합쳐서 한 파일)
- Cross-category leak protection: shoe → bag, watch-casio → perfume, airpods → smartwatch, applewatch → earphone 다 null 확인
- Registry 12 카테고리 정확 확인

## UI 변경 0

기존 Wave A 헬퍼 (`detectBrandDepth`) 그대로. `pack-reveal-modal.tsx` (CounterfeitChecklistPanel + WhyTrustCollapse) 자동 적용.

3화면 일관성 (메모리 룰 `feedback_ui_changes_apply_to_all_card_screens`):
- `pack-reveal-modal` (직접 사용) ✓
- `user-reveal-dashboard` (PackRevealModal 호출) → 자동 ✓
- `admin-pool-browser` (가품 정보 표시 X) → 무관 ✓

## 외부 review #4 완전 해소

> "라벨/봉제/안감 3축 확인하세요'가 너무 일반적임. 아크테릭스라면 Bird-aid 라벨, GORE-TEX 4면 박음질 같은 모델별 가품 체크포인트가 있어야 진짜 가치 있음."

이제 12 카테고리 × 평균 8 브랜드 = **~95+ 브랜드 매물에 진짜 변별 포인트 노출**.

### 구체 예시 (Wave C+E)

- **LV**: "데이트 코드 6자리 + 2021+ RFID 칩 reading 가능"
- **Chanel**: "시리얼 7~8자리 + 보증 카드 매칭"
- **Hermès**: "새들 스티치 손바느질 / 년식 마크 Square/Circle 알파벳"
- **Rolex**: "크라운 5각형 + 5점 / Caliber 3xxx / 사이클로프 2.5배 확대"
- **Patek**: "Extract from Archives ($400) = 정품 검증 최고 도구"
- **AirPods Pro 2**: "본체 5.3g + 케이스 50.8g + iOS 페어링 자동 팝업"
- **Tom Ford Private Blend**: "병 바닥 'TF' 음각 + 메탈 캡 무게감"

## 후속

- Wave A/B/C/D/E 모두 완료. 외부 review #4 100% 충족.
- 미커밋 작업 (saved-money fix 등) 다른 세션 책임.
- 별 wave: brand depth 매물별 정확 brand 추출 정확도 측정 (production)
