# 2026-05-17 ConditionChip — 매물 등급 한국말 chip + 분류 정책 모달

## 사용자 요청

> "운영자풀에 해당 매물이 무슨 등급인지도 쓰자 mint인지 뭔지 5개 그거 등급은 한국말로 적으셈
> 훼손? 민트급(이건 한국말로 해도돼) 그리고 그거 오른쪽에 ?잇고 호버하면 모바일은 클릭하면
> 어떤 등급이 있고 어떤식으로 분류하는지 알수있도록"

## 박은 변경

### 새 컴포넌트 `src/components/condition-chip.tsx`

7 등급 매핑:
| condition_class | 한국말 | 색깔 | 설명 |
|---|---|---|---|
| unopened | 미개봉 | amber | 박스 안 뜯음. 다나와 새상품 시세 |
| clean / mint | 민트급 | emerald | S급. 사용감 거의 없음 / 풀구성품 / 배터리 100% |
| normal | 일반 | zinc | 일반 중고. 명시 신호 없음 (default) |
| worn | 사용감 | orange | 사용감, 잔기스, 미세 흠집 명시 |
| flawed | 훼손 | rose | 액정 깨짐 / 떨어뜨림 / 작동 결함. 풀 차단 |
| low_batt | 배터리 저하 | yellow | 배터리 효율 < 85%. 가격 modifier |

### Props

- `conditionClass: string | null` — 매물 condition
- `showHelp?: boolean` — `?` 버튼 + popover 표시 여부

### Popover (showHelp=true)

- `?` 클릭 → 6 등급 분류 표 + v46 conservative 정책 메모
- backdrop 클릭 시 닫힘
- 모바일/desktop 둘 다 동작 (호버 X, 클릭 only)

### 적용 (3 화면 정책 — 메모리 정합)

| 컴포넌트 | showHelp | 위치 |
|---|---|---|
| `admin-pool-browser.tsx` | **true** | 매물 카드 (band 옆) — 운영자 본인 |
| `pack-reveal-modal.tsx` | false | 매물 카드 (차익 라인 옆) — 일반 사용자에겐 정책 노출 X |
| `user-reveal-dashboard.tsx` | — | item type 에 conditionClass 없음. 별도 작업 (item fetch 시 conditionClass 추가 필요) |

## Trade-off

- `mint` 와 `clean` 둘 다 "민트급" label — 사용자 5 단계 인식 정합. 코드상 분리지만 UI 동일
- 일반 사용자 화면 (pack-reveal) 에 chip 만 표시 — 정책 modal 은 운영자 화면만
- user-reveal-dashboard 는 별도 작업 (data fetch path 추가 필요)

## 검증

- test 288/288 pass
- typecheck clean (내 변경)

## Commit

- `c18f4f1` admin-pool-browser + pack-reveal-modal 적용
- `260ac1d` (다른 세션 squash) condition-chip.tsx 새 파일 박힘
