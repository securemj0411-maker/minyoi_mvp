# 2026-05-23 — launch-50: 카카오톡 공유 button alert → disabled 톤

## 발견 (자율 진단)
사용자가 RefreshModal (새 30개 매물 받기 모달) 에서 보는 button:
```ts
onClick={() => {
  // TODO Wave 384 phase 2: Kakao.Share.sendDefault + POST /api/packs/pool/share-bonus
  alert("카카오톡 공유 보너스는 곧 출시예요! 조금만 기다려주세요 🙏");
}}
```

문제:
- 사용자 클릭 → 구식 `alert` 박스 (모바일에서 OS alert popup)
- 미완성 기능을 활성 button 처럼 보임 = 사용자 misleading
- 진짜 박기 = Kakao SDK 통합 + App Key + DB schema (별 wave 영역)

## fix (단기)

button 자체 `disabled` + "준비중" 톤으로 자연 UI:
- `disabled` attribute 추가 (클릭 불가)
- `title` tooltip "카카오톡 공유 보너스는 준비중이에요"
- 배경 opacity 70% + 텍스트 흐림 (사용자 기대 명확)
- 우측 배지 "무료" → "준비중"
- 카피 "친구 가입 X · 공유 클릭 1번이면 끝" → "곧 출시예요 · 조금만 기다려주세요"

→ button 보이지만 클릭 X. 사용자가 "기다리면 됨" 인식.

## 향후 (별 wave)
진짜 박기 plan:
1. Kakao Developer App 등록 + App Key 환경 변수
2. Kakao JS SDK `Kakao.Share.sendDefault()` 통합
3. POST `/api/packs/pool/share-bonus` — DB 에 share 기록 + 사용자 크레딧 박음
4. `mvp_share_bonus` table migration

## 영향
- 코드: src/components/explore-client.tsx 1 곳 (button 1 개 + onClick 제거)
- 사용자: alert 박스 X. button 자연 disabled. 기대 명확.
- decision log: 이 파일

## 메모리 룰
- 미완성 기능: button 활성 + alert "곧 출시" 패턴 금지. disabled + 톤 명확.
- 정직 카피: "곧 출시예요"
