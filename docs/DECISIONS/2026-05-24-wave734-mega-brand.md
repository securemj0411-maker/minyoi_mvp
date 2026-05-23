# Wave 734 — Mega brand 신설 3 + FOG/Patagonia 거대 leak fix

**날짜**: 2026-05-24

## 배경
null brand 의류 unmatched 8,085건 sweep 결과:
- fog_essentials: **503건/주 p50 10만** ★★★ (이미 SKU 있지만 mustContain[0] FOG signal mandatory → 한국 셀러 leak)
- patagonia: **443건/주 p50 9.2만** ★★★ (이미 SKU 있지만 mustContain 너무 좁고 mustNotContain "다운/쉘" overblock)
- acne_studios: 427건/주 p50 15만
- nanamica: 251건/주 p50 19.4만
- tommy_hilfiger: 78건/주 p50 5.5만

총 ~1,700건/주 회수 가능.

## 신설 3 SKU (Wave 734)
- `acne_studios_broad` — 데님 premium 외 일반 broad
- `nanamica_apparel_broad` — 고어텍스/Coolmax 시그니처
- `tommy_hilfiger_broad` — 일반인 친화

## Leak fix — FOG Essentials (7 SKU)
**문제**: 7개 narrow + 1 broad 모두 mustContain[0] = ["피어오브갓", "fog", ...]로 FOG signal mandatory. 한국 셀러는 "에센셜 후드티"만 적음.

**Fix**: mustContain[0] (FOG) 제거. mustContain[0]에 essentials/에센셜만 mandatory. mustNotContain에 다른 brand essentials (Calvin Klein essentials / Polo essentials / essential oil / 기타) 차단 추가.

대상: hoodie / crewneck / tee / pants / shorts / jacket / broad (총 7개)

## Leak fix — Patagonia broad
**문제 1**: mustContain[1] product type 너무 좁음 (티셔츠/tee/후드/맨투맨/팬츠/베스트만). 후디/플리스/풀오버/신칠라/자켓/패딩/토렌트쉘/배기스 누락.

**문제 2**: mustNotContain "다운/down/쉘/shell" 차단 — Patagonia 다운자켓/토렌트쉘 매물 의도와 반대로 차단.

**Fix**: 
- mustContain[1] 확장: 후디/플리스/풀오버/신칠라/자켓/재킷/패딩/토렌트쉘/torrentshell/윈드브레이커/후디니/배기스/baggies/스냅t/나노퍼프/r1/r2 등
- mustNotContain "다운/쉘" 제거 (narrow SKU 명확 없음)
- 가방 키워드 차단 추가 (백팩/토트백/크로스백 등)

## 영향
- 1,700건/주 의류 풀 회수 (FOG 503 + Patagonia 443 + Acne 427 + Nanamica 251 + Tommy 78)
- spread risk: FOG essentials는 mustNotContain 강화로 false 차단. Patagonia는 narrow와 broad 명확 분리 유지.
