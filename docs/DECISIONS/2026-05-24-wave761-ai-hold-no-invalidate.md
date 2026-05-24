# Wave 761 — AI hold 매물 invalidate 차단 (release mechanism)

**날짜**: 2026-05-24
**Wave**: 761 (Wave 757 ai_audit_hold release mechanism 완료)
**Owner**: Claude

## 사용자 보고

"신발이 아침에 비해서 엄청 줄고있는데 invalidated된게 보니까 ... 시세랑 차익 충분하고 판매완료도 아니고 댓글수 8개 넘지도 않는데 invalidate된게 너무 많은데 이거 뭐임?"

사용자가 본 매물 4건 (이지부스트 2 + 닥마 2) — 모두 정상 매물:
- 차익 +22K~+50K
- 시세 신뢰 92~95%
- 댓글 8 미만
- 판매중

## 진단

`mvp_candidate_pool` 지난 1시간 신발 invalidate 사유 분포:
| 사유 | 건수 |
|---|---|
| **ai_audit_hold_review** | **16** ← 핵심 |
| negative_resell_gap | 11 |
| sku_median_unavailable | 7 |
| profit_below_pack_band | 4 |
| 기타 | 3 |

지난 6시간 (fashion 전체):
- shoe: 30 hold (24/30 = **80% 차익 20K+ 정상 매물**)
- clothing: 10 hold (7/10 정상)
- bag: 1 hold

사용자 본 4건 모두 `ai_audit_status='hold'` + `invalidated_reason='ai_audit_hold_review'` 확정.

AI hold 사유 패턴:
- "셀러 상세 설명 부족" ("상태좋아요" 한마디만 적힘)
- "시세보다 싼 가격 의심" — 사실 우리가 찾는 차익 매물

근본 원인: `tick-pipeline.ts:4646` `isAiAuditDefiniteNonPass` 가
`hold` + `reject` + `skipped_unavailable` 셋 다 동급 invalidate.

AI hold = "정보 부족, 확신 없음" 인데 reject (명확한 위험) 와 동급 처리.

## 결정

사용자 핵심 원칙 (project_core_principle_consumer_friendly): "일반인도 편하게 돈 벌 수 있는 AI 사이트".
한국 중고시장 셀러는 "상세 설명 안 적음" 이 일반적 → AI 가 hold 시키면 좋은 매물 다 잃음.

### Fix — `isAiAuditDefiniteNonPass`

```typescript
// BEFORE
return status === "hold" || status === "reject" || status === "skipped_unavailable";

// AFTER
return status === "reject";  // reject 만 hard invalidate
```

- **hold**: ready 유지 (사용자가 직접 판단). `ai_audit_status='hold'` 유지 → UI 에서 "AI 검토 중" 표시 가능 (별도 wave)
- **skipped_unavailable** (AI 호출 실패): 다음 cron 에서 재시도 기회 (invalidate 안 함)
- **reject**: 명확한 위험 (가품/사기 패턴) — invalidate 유지

### 기존 invalidate 매물 복원

지난 24h `ai_audit_hold_review` 로 invalidate 된 fashion 매물 41건 ready 복원:
- shoe: 30
- clothing: 10
- bag: 1

사용자가 본 4건 (이지 2 + 닥마 2) 모두 포함.

복원 SQL:
```sql
UPDATE mvp_candidate_pool
SET status = 'ready', invalidated_reason = NULL,
    updated_at = NOW(), last_verified_at = NOW()
WHERE invalidated_reason = 'ai_audit_hold_review'
  AND updated_at >= NOW() - INTERVAL '24 hours'
  AND category IN ('shoe', 'clothing', 'bag');
```

## 안전성

- `ai_audit_status='hold'` 그대로 박혀있음 → UI 가 별도 wave 에서 "AI 검토 중" 배지 표시 가능
- 다른 안전장치 동작: profit_band / score / confidence / catalog mustNotContain / parser FLAWED_NOTES 등
- reject 만 invalidate → AI 가 명확히 가품/사기 판단한 매물은 여전히 차단

## 영향

- 즉시 pool 신발 매물 회복 (지난 24h 30건 + 시간당 4-5건 신규 추가)
- "신발이 아침에 비해서 엄청 줄고있다" 해결
- AI 가 confidence 낮으면 hold 처리해도 사용자에게 보임 → 판단 권한 사용자에게 이양

## 미해결 (별도 wave)

- UI "AI 검토 중" 배지 표시 (`pack-reveal-modal` / `admin-pool-browser` / `user-reveal-dashboard` 3화면)
- hold 매물 차익 작은 경우 (<10K) 추가 안전장치 검토 — 현재는 풀 진입 허용
- `skipped_unavailable` 매물 재시도 메커니즘 (lifecycle worker 에서 일정 시간 후 재AI)
