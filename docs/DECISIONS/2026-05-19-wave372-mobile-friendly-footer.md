# 2026-05-19 Wave 372 — 모바일 친화 푸터 (사업자 정보 collapse)

사용자: "모바일도 저렇게 푸터 놓음? 너무 아래가 지저분한데 법적 요건 충족하면서 모바일 친화적으로?"

## 법적 검토

「전자상거래 등에서의 소비자보호에 관한 법률 시행령」 제13조 + 「상거래에서의 표시·광고에 관한 법률」:
- 사업자명, 대표자, 사업자등록번호, 통신판매업 신고번호, 주소, 연락처
- 호스팅 사업자 정보
- "표시" 요건만 — **형태는 자유**. collapsible/접힌 상태도 사용자가 펼칠 수 있으면 OK.

쿠팡 모바일, 당근 모바일도 다 `<details>` 형식 사용.

## 결정

**모바일 collapse / 데스크탑 열림**:

| 영역 | 모바일 (< sm) | 데스크탑 (sm+) |
|---|---|---|
| Legal 링크 한 줄 | 항상 표시 | 항상 표시 |
| 사업자 정보 `<details>` | 닫힘 (▾ 클릭 펼침) | 자동 열림 (cursor-default) |
| MVP mock 안내 | 작게 표시 | 작게 표시 |

### 디자인 압축
- 3 column grid → **인라인 텍스트 (4~5줄)**
- 상호명 · 대표 / 사업자번호 · 통신판매업 / 주소 / 이메일 · 번호 · 시간 / 호스팅 · 서비스명
- 각 줄에 `·` 구분자 + key bold

### Open 동작
```tsx
<details open>
  <summary className="cursor-pointer sm:cursor-default">
    <span>득템잡이 · 사업자 정보</span>
    <svg className="sm:hidden group-open:rotate-180" />
  </summary>
  ...
</details>
```

`open` 속성 — 기본 열림. 모바일에서 사용자 클릭하면 닫을 수 있음. 데스크탑은 SVG ▾ 안 보이고 cursor도 default.

## 변경 파일

`src/components/app-footer.tsx` 전면 재작성:
- 3 column grid 제거 → 인라인 텍스트
- `<details open>` 으로 collapse
- 패딩 `py-8` → `py-5 sm:py-7` (모바일 축소)
- text-sm → text-xs (모바일)

## 검증

- `tsc --noEmit` 깨끗
- `eslint` 깨끗

## 효과

| 화면 | 이전 푸터 높이 | 이후 푸터 높이 |
|---|---|---|
| 모바일 닫힘 | ~280px (3 column 세로 쌓임) | ~80px (legal + 토글 + mock) |
| 모바일 펼침 | 동일 | ~200px (인라인 정보) |
| 데스크탑 | ~180px | ~150px |

법적 요건 충족 + 모바일 정리 + 사이트 톤 유지.
