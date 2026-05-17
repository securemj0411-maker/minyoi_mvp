# Wave 198b — keyboard shortcut 사용설명서 가시화

## 사용자

> "근데 시발 shortcut을 넣었으면 사용설명서를 넣어주던가;; ㅋㅋ"

→ Wave 198 박았는데 우하단 floating `?` 버튼 못 봤음. 단축키 박혀있는지 모를 수도. 가시화 강화.

## 박은 것

### `/cau~~/loss-reports/loss-reports-client.tsx`

#### 1. 페이지 첫 진입 자동 도움말 modal

```ts
useEffect(() => {
  const seen = window.localStorage.getItem("minyoi.admin.lossReports.shortcutSeen");
  if (!seen) {
    setHelpOpen(true);
    window.localStorage.setItem("minyoi.admin.lossReports.shortcutSeen", "1");
  }
}, []);
```

- 처음 진입하면 도움말 modal 자동 표시
- localStorage 박혀서 2번째 진입부터 안 띄움
- 다시 보고 싶으면 우하단 `?` 또는 헤더 banner 클릭

#### 2. 상단 항상 보이는 hint banner

filter 위에 박힘 — 단축키 6개 항상 visible:

```
⌨️ 키보드 단축키: [j] 다음 [k] 이전 [e] 응답 [r] 보정완료 [d] 기각 [?] 도움말  [자세히 보기]
```

- blue 배경 + kbd 스타일
- "자세히 보기" 버튼 → 도움말 modal 열림
- 항상 visible — 운영자가 매번 확인 가능

## 비파괴

- localStorage 활용 — 서버 부담 0
- 기존 floating `?` 버튼 + ? 키 단축키 그대로
- 첫 진입 modal은 1회만 — 매번 띄우지 않음

## Test

`npm run test:core`: **412/412 pass**.

## Linked

- `2026-05-17-wave198-admin-loss-reports-keyboard-shortcuts.md`
