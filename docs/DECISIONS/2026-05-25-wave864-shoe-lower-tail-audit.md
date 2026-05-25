# 2026-05-25 Wave864 shoe lower-tail audit

## Context
- Continued the shoe deep-sweep after Wave863.
- Targeted lower-volume watch/internal-only lanes:
  - `shoe-asics-gt-2160-broad`
  - `shoe-balenciaga-speed-broad`
  - `shoe-onrunning-cloudboom-broad`
  - `shoe-onrunning-cloud-6`
  - `shoe-puma-mostro`
  - `shoe-adidas-gazelle-broad`
  - `shoe-nike-airforce-1-low-red`
  - `shoe-nike-sfb-broad`
  - `shoe-on-running-broad`
  - `shoe-onrunning-cloudtilt-broad`

## Decisions
- Reclassified normal Asics GT-2160 rows from stale broad into exact `shoe-asics-gt-2160`.
- Blocked GT-2160 premium/collab axes from the exact public lane:
  - Dime / 다임
  - Wood Wood / 우드우드
  - Gallery Department / 갤러리디파트먼트
  - Cecilie / 세실리에
  - Above The Clouds / 어보브더클라우즈
  - Beams / 빔즈 / Paper Girl
- Reclassified Cloudboom broad rows into exact `shoe-onrunning-cloudboom` where explicit Cloudboom Max/Strike wording was present.
- Kept Balenciaga Speed, Gazelle, SFB, On Running broad, and Cloudtilt broad as internal/watch broad lanes.
- Kept Puma Mostro and AF1 Low Red as existing exact lanes; no new blockers were needed in this sample.

## Applied Result
- Final reclassify dry-run and apply matched:
  - scanned parsed rows: 141
  - candidate rows: 40
  - reclassified rows: 13
  - refreshed rows: 24
  - rejected rows: 3
- Rejected GT-2160 pollution:
  - pid `357045789` — Asics x Dime GT-2160
  - pid `381353551` — Asics x Wood Wood GT-2160
  - pid `390705553` — Asics x Gallery Department GT-2160, 1.5M KRW
- Market staging completed after apply:
  - queued: 31
  - enriched: 31
  - scored: 848
  - upserted: 146
  - pool upserted: 818
  - reveal current profit updated: 1
  - reveal current profit invalidated: 0
- Gate cleanup after staging found 0 remaining candidates.

## Verification
- `npx tsx --test tests/fashion-catalog-regression.test.ts` passed: 62/62.
- Latest shoe safety:
  - catalog SKU: 641
  - non-empty SKU: 503
  - ready SKU: 83
  - ready safe public: 81
  - ready probably safe: 2
  - fix-now: 0
- Latest clothing safety:
  - catalog SKU: 260
  - non-empty SKU: 248
  - ready SKU: 49
  - ready safe public: 41
  - ready probably safe: 8
  - fix-now: 0

## Deferred
- Balenciaga Speed and Gazelle broad remain internal/watch because they still mix multiple sub-lines/variants.
- On Running generic and Cloudtilt broad remain internal/watch until Cloudswift/Cloudtilt/Cloudtilt Moon/other axes are split or proven safe.
- Continue lower-volume shoe audit, then run the same systematic pass on clothing broad lanes.
