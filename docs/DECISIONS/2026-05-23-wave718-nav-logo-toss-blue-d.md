## Wave 718 — Nav 로고 토스 블루 + D로 변경

- 시간: 2026-05-23 KST
- 발견: 사이트 nav 로고가 초록 (`from-emerald-500 to-emerald-600`) + 글자 `M`. 현재 사이트 톤은 토스 블루 (`--brand-accent` = #3182F6 계열) — 로고만 톤 불일치.
- 변경: [src/components/app-nav.tsx:361-363](../../src/components/app-nav.tsx#L361)
  - `from-emerald-500 to-emerald-600` → `from-blue-500 to-blue-600`
  - `shadow-emerald-500/20` → `shadow-blue-500/20`
  - 글자 `M` → `D` (득템잡이)
- 검증: 단일 className/text 교체, lint/type 영향 없음. 다른 로고 인스턴스 grep 확인 — app-nav 한 군데만 존재.
- 위험: nav 옆 "Beta" 배지는 여전히 emerald 톤 (`bg-emerald-50 ... text-emerald-700`). 사용자가 로고만 명시했으므로 그대로 유지. 시각적 통일 원하면 다음 wave에서 blue 계열로 옮기는 거 검토.
- 다음: 사용자 확인 후 Beta 배지/기타 emerald 잔재 일괄 정리 여부 결정.
