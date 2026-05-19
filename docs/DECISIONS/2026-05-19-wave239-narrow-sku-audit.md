# Wave 239 (2026-05-19) — fashion narrow SKU audit

## 발단

사용자 "계속 진행" — Wave 235~238 외 narrow SKU sample 검증.

대상: NB (993/992/990v5/990v6/2002R/574/9060/1906R) / Adidas (Samba/Gazelle/Tobacco/Spezial/Campus/Stansmith) / Yeezy 350 / Tabi sneaker / Hoka Bondi 8·9 / Asics (Kayano/Nimbus/Jog 100) / Converse (Chuck70 High/Jack Purcell) / Nike (AF1 White/Airmax 1/Pegasus 41) — 26 SKU sample 5건씩.

## 발견 mismatch

### 1. `shoe-newbalance-990v5` — mustContain 위험
- "**뉴발란스 410v5** 270 운동화" 50k 매물 매칭
- 원인: mustContain 에 "v5" 단독 박힘 → 다른 NB 모델 (410/411/412/810/910) 의 v5 표기도 매칭
- fix: "v5" 단독 제거 + mustNotContain 에 "410/411/412/810/910/996/999" 추가

### 2. `shoe-asics-jog-100` — model 자체가 broad
- "Asics Life Walker 010 Black" 150k / "조그 100 2 블랙" 75k 가격 차 2배
- modelName: "Asics Jog 100 / Life Walker (입문)" — 의도적 broad
- 결정: 그대로 둠 (broad SKU 정책). 시세 daily 분리 안 됨 trade-off — 작은 영향.

## 검토 정상 (24 SKU)

다 narrow model 정확 매칭:
- NB 993 / 992 / 990v6 / 2002R / 574-broad / 9060 / 1906R
- Adidas Samba OG broad / Gazelle OG broad / Tobacco broad / Spezial / Campus / Stansmith broad
- Yeezy 350
- Margiela Tabi Sneaker
- Hoka Bondi 8 / 9
- Asics Kayano (32/14/24 mix) / Nimbus (10/27 mix)
- Converse Chuck70 High broad / Jack Purcell broad
- Nike AF1 Low White / Airmax 1 / Pegasus 41

## 파일

- `src/lib/generated/catalog-shoe-narrow-wave134.ts` — NB 990v5 mustContain/mustNotContain + defaultProductType: "sneaker"

## 미완

- Asics Jog 100 / Life Walker narrow split (다음 wave 후보)
- 시계/카메라/드론 외 sample (perfume/kickboard/lego)
- broad SKU narrow split (RRL / Stussy Hoodie 등 — 큰 작업)
