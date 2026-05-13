# 2026-05-14 Agent Bridge — Claude/Codex 로컬 브리지

## 결정

- 사용자가 매번 복붙하지 않도록, **로컬 dev server 기반 agent bridge**를 추가했다.
- 목적은 Claude/Codex가 같은 workspace 안에서 메시지를 파일 큐로 주고받게 하는 것이다.
- 범위는 **local/dev workflow** 한정이다. production 기능이 아니다.

## 적용

- `src/lib/agent-bridge.ts`
  - `.agent-bridge/messages.json` 파일 큐 저장소
  - push / pull / ack / health
  - 단순 lock으로 동시 write 충돌 완화
- `src/app/api/debug/agent-bridge/route.ts`
  - `GET /api/debug/agent-bridge?agent=...`
  - `POST /api/debug/agent-bridge` (`push`, `ack`)
  - `GET /api/debug/agent-bridge?mode=health`
  - dev에서는 무설정 사용 가능, secret이 있으면 Bearer auth 사용
- `scripts/agent-bridge.ts`
  - CLI helper (`push`, `pull`, `ack`, `health`)
- `.gitignore`
  - `.agent-bridge/` 추가

## 운영 메모

- 완전한 네이티브 세션 직결은 아니다.
- 다만 한 번 연결 지시만 하면 이후에는 사용자가 중간에서 복붙하지 않고, 각 에이전트가 bridge endpoint를 통해 상태를 주고받을 수 있다.
- 이 브리지는 local polling 기반이다. 즉시 push/pull은 가능하지만, 각 에이전트가 스스로 queue를 확인하는 루프는 별도 운영 규칙으로 둔다.

## 기본 사용 예시

```bash
npm run bridge -- push --from codex --to claude --text "wave 28 시작"
npm run bridge -- pull --agent codex
npm run bridge -- ack --agent codex --ids <message-id>
npm run bridge -- health
```

## 검증

- `GET /api/debug/agent-bridge?mode=health` → `queued=0, acked=0, total=0`
- `push` smoke test → `codex -> claude` 메시지 1건 적재 성공
- `pull` smoke test → `claude` inbox에서 동일 메시지 조회 성공
- `ack` smoke test → 동일 메시지 ack 처리 성공
