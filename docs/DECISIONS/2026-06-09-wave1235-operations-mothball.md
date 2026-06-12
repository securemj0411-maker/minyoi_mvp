# Wave 1235 — 운영 휴면 (Mothball / 비용 0)

- 날짜: 2026-06-09
- 지시: owner "득템잡이 운영종료다 다 중지시켜; 모든 워커 다 끝내고; 비용 안 들도록"
- 선택(AskUserQuestion): **A. 완전 휴면** — 워커 정지 + Supabase 일시정지 + 요금제 다운그레이드. **데이터 전부 보존, 가역.**

## 실행 완료
- **Vercel 크론 33개 전부 제거** — `vercel.json` → `{ "crons": [] }`. 커밋 `7358ae68` → origin/main 푸시 → 재배포 시 전 워커 정지.
  - 정지된 워커: tick, detail/score(x3)/recovery-worker, lifecycle(x3), pool-warmer, preview-pool, landing-showcases, membership-local-samples, housekeeper, market-worker, deep-crawl, joongna-worker, daangn-worker(x3)/detail/price-sweep, daily-backup, reference-price-refresh, compliance/payload-retention, raw-prune, sync-market-velocity, incident-watch, operator-brief, manual-deposit/membership-auto-approve, safety-stats-warmer.
  - 이게 **변동비 핵심** (당근/번개/중고나라 크롤 + OpenAI 파싱 + DB 쓰기) → 정지로 거의 0.
- pg_cron(DB 스케줄러): 없음 (확인함). 추가 정지 불필요.

## 내가 못 한 것 (도구 권한 없음 → owner가 대시보드에서)
- **Supabase 일시정지**: 바인딩된 MCP(`mcp__supabase__`)엔 pause 도구 없음. 관리 MCP(`a97858e1`)는 이 프로젝트(suwsvvjsycgcegepcktp)에 "no permission". → **owner 대시보드에서 Pause.**
- **요금제 다운그레이드**(Supabase Pro→Free, Vercel Pro→Hobby): 결제 액션이라 도구 불가 → owner.

## 데이터
- **전부 보존** (mothball). 삭제 안 함. PITR 없음 인지 — 그래서 보존 택함.
- 프로젝트 ref: suwsvvjsycgcegepcktp.

## 복원법 (재개 시)
1. Supabase: 대시보드에서 Restore project.
2. Vercel 크론: `7358ae68` revert (또는 직전 커밋 `2ab8f3d7`의 vercel.json 복원) + 재배포 → 크론 33개 부활.

## 주의
- Supabase 일시정지하면 사이트 DB 다운 → 사이트 사실상 다운. **구글애즈 이의신청(Wave 1234)도 무의미해짐**(죽은 사이트 심사 = 실패). 운영 접는 거면 무관.
