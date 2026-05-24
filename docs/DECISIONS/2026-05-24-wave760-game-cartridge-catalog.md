# Wave 760 — 게임 카트리지 카테고리 신설 + 파서 버그 fix

**날짜**: 2026-05-24
**Wave**: 760 (병렬 작업 — 골프 narrow split + 게임 카트리지)
**Owner**: Claude (background agent + main thread)

## 결정 사항

### 1. 게임 카트리지 100+ SKU 신설 — `src/lib/generated/catalog-760-game-titles.ts`

게임 본체 SKU (game_console category) 가 카트리지/타이틀 매물을 흡수하던 문제 해결.
신규 100+ SKU 신설 (`isGameTitle: true` 플래그) — Pokemon/Mario/Zelda/Animal Crossing/Kirby/Splatoon/Metroid 등.

- **Switch 게임**: 포켓몬 SV/SS/아르세우스/BDSP/레츠고/포코피아, 마리오 오디세이/카트8/파티/원더/3D월드/RPG/루이지/카트라이브, 젤다 TOTK/BOTW/꿈꾸는섬/무쌍, 동물의숲, 커비 디스커버리/스타얼라이즈, 메트로이드 프라임/드레드, 피크민4, 스매시 얼티밋, 스플래툰 2/3, 마인크래프트, 링피트, 저스트댄스, 파엠 풍화설월, 동키콩 트로피컬 등
- **PS5 게임**: 발더스게이트3 (#1 spread fix)
- **PS broad** (PS4/PS5 공통): NBA 2K, 라스트오브어스, 갓오브워, 호라이즌, 엘든링, 사이버펑크, GTA5, COD, 스파이더맨, 그란투리스모, 데드스트랜딩, 바이오하자드, 나루토
- **Switch2 게임**: broad + 동키콩 바난자 (2025-07)
- **Vintage**: GBA / SFC / N64 / DS / GameBoy broad
- **3DS 게임**: 닌텐독스, 레이튼, 마리오브라더스, 마리오카트7, 스매시3DS, 메이드인와리오골드, 동물의숲NL
- **액세서리**: 아미보, Switch Pro Controller, Switch2 Pro Controller, PS5 DualSense (+Edge), DualShock4, Pulse3D 헤드셋, Joy-Con Pair, 8BitDo, 카드케이스, Labo VR, 레이싱 휠

총 SKU: **~104개**. 대부분 매물 수 + median 가격 metric 박힘 (catalog 보강 시 측정 데이터).

### 2. Pipeline.ts — `isGameTitle` 분기 추가 (categoryScopedNoise)

기본 game_console SKU 는 game_title 패턴을 accessory 로 downgrade 했지만, 카트리지 본품 SKU 는 game_title 자체가 정상. `sku.isGameTitle === true` 인 경우 다음과 같이 처리:

```typescript
if (sku.isGameTitle) {
  if (game.listingType === "buying") return "buying";
  if (game.listingType === "damaged_or_modded") return "damaged";
  if (game.listingType === "multi_bundle") return "multi";
  if (game.listingType === "accessory") return "accessory";
  // game_title / normal / unknown → null (정상 매물 통과)
}
```

### 3. **Critical Parser Bug Fix** — accessoryTitleHits 의 "커버" substring 매칭

`ACCESSORY_TITLE_KEYWORDS` 의 "커버" 가 substring 매칭으로 **"디스커버리"** ("커비 디스커버리" 게임) 의 일부에 매칭 → 정상 게임 매물이 accessory 로 분류되는 버그 발견.

게임 IP signal regex (커비/포켓몬/마리오/젤다/동물의숲/스플래툰/메트로이드/피크민/스매시/닌텐도/playstation 등) 가 있으면 `["커버", "케이블", "필름"]` 같은 substring false positive hit 제거.

- **영향**: 게임 카트리지 본품 매물이 풀 진입 못 하던 버그 fix → game_console 카테고리 매물 회수 대폭 증가 예상
- **Regression Risk**: 게임 IP 일치 매물 중 정말로 액세서리인 경우 (예: "포켓몬 케이스") → 다른 accessory hit 들 (스탠드, 충전, 어댑터 등) 살아 있어서 분류 정확. 단 "커버/케이블/필름" 같은 일반 단어 substring 만 제거.

### 4. 골프 narrow split 18 SKU (Priority A)

Wave 760 sweep 결과 (Ping iron 935% spread, Majesty iron 721%, Titleist iron 689% 등) 기반:
- TaylorMade Driver 4: Stealth2, Qi10, Stealth, SIM
- Ping Iron 4: G430, G425, i230, i500
- Titleist 5: T100/T200/AP Iron, GT/TSi Driver
- Honma Iron 2: Beres premium, Tour World mid
- XXIO Driver 2: 13/12 신세대, 9/10/11 구세대
- Callaway Iron 3: Paradym, Apex forged, Rogue

## 측정 / 검증

- TypeScript typecheck: 통과 (catalog.ts / category-readiness.ts / pipeline.ts 에러 0)
- catalog-760-game-titles.ts: 104 SKU 로드 확인
- isGameTitle flag 박힌 SKU 정확히 game_title 분류 통과 (커비 디스커버리 케이스 trace 검증)

## 미해결 사항

- 게임 카트리지 background agent 가 추가 디버깅 중에 timeout — main thread 가 abort 후 commit
- "케이스" / "스탠드" 등 다른 accessory keyword 의 game IP substring false positive 추가 audit 필요할 수 있음 (현재는 "커버" 만 fix)
- 골프 narrow Priority B (~30+ SKU 더 있음 — Wood/Hybrid/Wedge/Putter sub-model) → 다음 wave

## 관련 commit

- `da965e8`: Wave 760 sweep 분석 (sub-model × condition × sex × shaft)
- `59ff1cd`: Wave 759 Phase 2 골프 웨지/우드/하이브리드/세트 20 SKU
- `0c6ad07`: Wave 759 골프 클럽 24 SKU
- 본 commit: Wave 760 게임 100+ SKU + isGameTitle 분기 + 커버/디스커버리 substring fix + 골프 narrow 18 SKU
