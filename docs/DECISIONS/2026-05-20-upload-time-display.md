# 2026-05-20 — 셀러 업로드 시점 표시 ("등록 N시간 전")

## 결정

`/me` + 매물 상세 모달 + `/me` 카드 리스트(ExploreClient)의 "**N시간 전**" 표시가 모두
**미뇨이 system 시간** (검증/등장) 기반이라 사용자가 "셀러가 올린 시점"으로 오해.

→ `first_seen_at` (미뇨이가 처음 발견한 시점 ≈ 실제 업로드 +0~30분 lag) 기반 "**등록 N시간 전**"으로 우선 표시. 검증 시점은 hover/sub로 강등.

## 진단

| 위치 | 카피 | 기준 (Before) |
|---|---|---|
| pack-reveal-modal:496 | "N시간 전 **검증**" | lastVerifiedAt |
| pack-reveal-modal:511 | "N시간 전 **등장**" | freshSeconds = lastVerifiedAt |
| explore-client:771 | "N시간 전" (라벨 X) | lastVerifiedAt |
| user-reveal-dashboard:457 | revealedAt → freshSeconds | 사용자 reveal 시점 |

**모두 미뇨이 system 시간**. 셀러 업로드 시점 표시 X.

### 데이터 상태
- `mvp_raw_listings.source_uploaded_at`: 스키마 있음 / **0% (105,116건 전부 NULL)** — detail API 미수집
- `mvp_raw_listings.first_seen_at`: **100%** — 미뇨이 처음 발견 시점 (collect cadence 기준 실제 업로드 +0~30분 lag)

→ 옵션 A (first_seen_at 사용) 채택. 정확한 source_uploaded_at backfill은 P1 (별도).

## 변경 (What)

### 1. 타입 정의
- `src/lib/pack-open.ts:43-49` `RevealCard.firstSeenAt?: string | null` 추가
- `src/components/user-reveal-dashboard.tsx:46-48` `RevealItem.firstSeenAt` 추가
- `src/components/explore-client.tsx:32-34` `PoolItem.firstSeenAt` 추가
- `src/app/api/packs/me/route.ts:113, 227` `RawRow.first_seen_at` + `RevealItem.firstSeenAt`

### 2. API 응답 채움
- `src/app/api/packs/me/route.ts`
  - raw select에 `first_seen_at` 컬럼 추가
  - RevealItem 응답에 `firstSeenAt: raw?.first_seen_at ?? null`
- `src/app/api/packs/pool/route.ts`
  - raw select에 `first_seen_at` 컬럼 추가
  - PoolItem 응답에 `firstSeenAt: meta?.first_seen_at ?? null`

### 3. UI 표시 우선순위 변경
- `pack-reveal-modal.tsx`
  - 신규 `uploadAgoLabel(firstSeenAtIso)` 함수 — "방금/N분/N시간/N일 전 등록"
  - 2 군데 (line 1778, 2729) 표시 우선 변경: firstSeenAt 있으면 "등록 N시간 전", 없으면 fallback `freshLabel` (검증)
  - 검증 시점은 `title` hover로 강등
- `user-reveal-dashboard.tsx:459`
  - selectedItem → RevealCard 변환 시 `firstSeenAt` 전달
- `explore-client.tsx`
  - `hoursAgoLabel` 1시간 미만 케이스 추가 (분 단위)
  - 카드 리스트 표시 (`line 772-775`): `firstSeenAt` 있으면 "N시간 전 등록" + 없으면 fallback
  - `poolItemToRevealCard` 매핑에 firstSeenAt 전달

## 사용자 화면 변화

| 상황 | Before | After |
|---|---|---|
| /me 카드 메타 | "30분 전 검증" | "**2시간 전 등록**" |
| 상세 모달 fold-above | "30분 전 등장" | "**2시간 전 등록**" + hover "데이터 30분 전 검증" |
| 상세 모달 매입가 옆 | "30분 전 검증" | "**2시간 전 등록**" + hover "데이터 30분 전 검증" |
| /me 카드 (explore) | "2시간 전" (애매) | "**2시간 전 등록**" 명확 |

## 안전성

- `firstSeenAt` nullable — 옛 reveal/일부 source에 없을 수 있음 → fallback `freshLabel`(검증)로 우아하게 강등
- DB 컬럼 100% coverage 확인 (3일치 105k 매물 전부 first_seen_at 보유)
- lag 추정 (first_seen_at - source 실제 업로드) = 0~30분. collect cadence가 매분~10분이라 평균 lag <10분. **사용자 오해 risk 거의 0**

## 후속 (P1)

1. **`source_uploaded_at` 실제 채움** — `lib/bunjang.ts` `fetchDetail`이 detail API의 timestamp 받아 raw_listings에 박기 + backfill. 정확한 업로드 시각 확보 (현재는 first_seen_at 근사)
2. **상세 모달 metadata 표시 정비** — 등록 + 검증 + 마지막 본 시간 (lastSeenAt) 모두 표시할지 (디자인 결정)
3. **3 화면 룰**: admin-pool-browser도 같은 우선순위 적용 검토

## 관련

- 메모리: "수익 보장 X / 정보 제공만 명시" — 시간 표시도 같은 정직성 (검증 vs 등록 구분)
- 사용자 피드백: "/me페이지나 상세페이지에 몇시간 전 이거는 검증 얘기고 언제 올렷는지를 알려줘야되는거아닐까"
- 사용자 결정 (옵션 A 선택): "first_seen_at으로 '등록 N시간 전' 즉시 표시"
