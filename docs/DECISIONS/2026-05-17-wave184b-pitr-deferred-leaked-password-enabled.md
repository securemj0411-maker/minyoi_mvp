# Wave 184b — PITR 보류 + Leaked Password Protection 활성화

## 사용자 결정

PITR + Leaked Password Protection 항목 안내 후 결정:

### PITR: C 옵션 (현 상태 유지)
> "c로 일단 하자; 그건 일단 다른거 완성되면..."

**선택**: 자동 7일 backup만 유지 (Supabase Pro plan 기본).

#### 이유
- Pro plan 기본 7일 자동 backup 충분 — 일일 단위 복원 가능
- PITR add-on (월 $99 ~) cost burden — 사용자 base 작을 때 비효율
- 우선순위 다른 작업 (master plan Phase 0/1) 먼저 완성

#### 재개 조건
- 사용자 base > 500명 도달
- 시세 historical 손실 사고 1회 발생 시 즉시 활성화 검토
- 결제 인프라 박을 때 비용 같이 재산정

### Leaked Password Protection: 활성화
> "ㅇㅇ"

**선택**: 활성화 (Supabase 콘솔에서 사용자가 직접 토글).

#### 활성화 경로
1. https://supabase.com/dashboard → 미뇨이 프로젝트
2. Authentication → Settings → Password Settings
3. "Leaked Password Protection" toggle ON
4. HaveIBeenPwned.org 연동 자동 활성화

#### 효과
- 신규 가입 / 비밀번호 변경 시 노출된 비밀번호 차단
- 비용 0
- 보안 advisor WARN 1개 사라짐 (advisor 재실행 시 확인)

## Trade-off

### PITR C 선택 (현 상태) 의 risk
- **시세 historical 손실**: 한 번 잃으면 시세 곡선 다시 그릴 수 없음 (메모리 노트 명시)
- **분 단위 복원 불가**: 1시간 전 운영 실수 → 어제 backup으로만 복원 가능 (1일치 데이터 손실)
- **사고 시 복구 cost ↑**: 백업 시점 이후 모든 데이터 재수집/재계산

### Mitigation (B 옵션 일부)
- 매일 새벽 cron으로 핵심 시세 테이블 (mvp_market_price_daily, mvp_market_velocity_daily) export 박는 wave 검토 가능
- cost 0 + 보안 강화
- 구현 1일 — 다음 우선순위 후 wave 로 검토

## Wave 184 + 184b 보안 audit 종합 정리

| 항목 | 처리 | 상태 |
|---|---|---|
| API err.message sanitize utility | 박음 | ✅ |
| public/safety-stats sanitize | 박음 | ✅ |
| function_search_path_mutable | 마이그레이션 (2개) | ✅ |
| Leaked Password Protection | 활성화 결정 (사용자 콘솔 토글) | ✅ |
| PITR | 보류 (C 옵션) | ⏸️ |
| SECURITY DEFINER 뷰 (ERROR 2) | 별도 task 위임 | 🔄 |
| REVOKE EXECUTE (WARN 13) | 별도 task 위임 | 🔄 |
| RLS no policy 33개 테이블 | 보류 (service_role only) | ⏸️ |

## Linked

- `2026-05-17-wave184-security-audit-phase1.md` (메인 작업)
- `2026-05-17-master-plan-deferred-items.md`
