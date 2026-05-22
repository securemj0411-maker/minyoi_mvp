# 2026-05-22 — Launch CRITICAL #9: Dark mode FOUC fix

## audit 발견
- `src/components/app-nav.tsx:24-29` 의 `applyTheme()` 가 client mount 후 호출
- `<head>` 에 blocking script 없음
- system=dark 사용자가 페이지 진입 시 흰 화면 한 프레임 깜빡 → 모바일 OLED 자극

## fix
`src/app/layout.tsx` `<head>` 안에 inline `<script>` 박음. React mount 전 paint
직전에 즉시 `.dark` class 토글.

```html
<script>
  (function(){
    try {
      var s = localStorage.getItem("minyoi-theme-v1");
      var d = s === "dark" || ((s === "system" || !s) && matchMedia("(prefers-color-scheme: dark)").matches);
      if (d) {
        document.documentElement.classList.add("dark");
        document.documentElement.dataset.theme = "dark";
      } else {
        document.documentElement.dataset.theme = "light";
      }
    } catch (e) {}
  })();
</script>
```

## 동작 흐름
1. HTML 로드 → `<head>` 의 inline script 즉시 실행
2. localStorage 확인 → `.dark` class 토글 (필요 시)
3. paint 시작 — 이미 dark 적용된 상태
4. React mount → app-nav 가 `applyTheme()` 호출 (이미 적용된 상태와 일치)

## 영향
- HTML 1줄 추가 (~300 bytes minified)
- blocking script — 페이지 paint 약간 느림 (수 ms 추가)
- 단 FOUC 방지가 훨씬 임팩트 큼

## localStorage key 일관성
- inline script: `"minyoi-theme-v1"`
- app-nav.tsx: `THEME_STORAGE_KEY = "minyoi-theme-v1"`
- 둘 다 같은 source ✓ (분리 운영 X — 변경 시 두 곳 동시 수정 필요. 단 자주 변경 안 함)

## 검증
- TypeScript compile clean
- production 배포 후 mobile Safari (dark mode) 에서 새 시크릿 창 — 흰 깜빡임 없는지 확인

## 메모리 룰
- 일반인 친화: 사용자 첫 인상 깨짐 차단
- decision log: 이 파일
