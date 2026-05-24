# Wave 771 — AI hold 정책 명확화 ("상태 모름") + 향후 UI 배지 계획

**날짜**: 2026-05-24
**Wave**: 771

## 사용자 #7 핵심 통찰

> "hold를 박아놓으면 애초에 AI검토중이 아니라 AI가 판단이 애매하다고 끝난거 아님?? AI검토중이라기보단 그냥 fallback으로 그냥 false positive 이런식으로 좀 아랫등급이나 중간에서 아래 정도"
>
> "상태 AI는 애초에 sku구분이 잘됬다는 가정하에 AI가 hold면 그냥 상태 없음이나 안좋은 상태로 그냥 들어가면 되는거아님?? ai pass된 애들은 더 정확한 상태를 가지는거고 어떻게 생각해?"

## 시스템 구조 (사용자 가정 정정)

| Layer | 역할 | AI? |
|---|---|---|
| **Parser** (`option-parser.ts` / `wave92-fashion-mobility.ts`) | regex+로직 기반 옵션/SKU/conditionClass 추출 | **No** (deterministic) |
| **AI L2 shadow audit** (`ai-l2-shadow-audit.ts`) | Claude/GPT 가 listingType + conditionClass 한 번에 분류 | **Yes (1개)** |

사용자 가정: "파싱 AI + 상태 AI 둘 다 있음" → 실제는 같은 AI 가 둘 다 함.

### Parser 실패 처리 (이미 작동)
- SKU 매칭 실패 → `needsReview=true` → pool 차단 ✓
- 의류는 default 옵션 적어 needsReview 빈번 → 차단
- 전자기기는 `baseOptions` (Wave 182) fallback → "iPhone 12 128GB unlocked" 같은 default

### AI 결과 처리
- `pass`: AI 가 정상 확신 → 풀 진입 ✓
- `hold`: AI 가 모호 → Wave 761 부터 풀 유지 (사용자 #1 보고 fix)
- `reject`: AI 가 위험 확신 → invalidate

## 결정 — AI hold 정책 (사용자 #7 제안 채택)

**AI 가 listingType 판단 못 함 (hold) = condition 도 판단 불가**.
→ "AI 검토 중" 부정확 표현. "상태 모름 — AI 판단 불가" 가 정직.

### 완전 구현 4단계

| Step | 작업 | 상태 |
|---|---|---|
| 1 | `tick-pipeline.ts` AI verdict patch 명확화 (주석 + 정책 박힘) | ✅ Wave 771 본 commit |
| 2 | DB `condition_class` NULL constraint 해제 (schema migration) | 🔄 별도 wave |
| 3 | `comparable_key` 의 tier 부분 → `unknown_condition` overwrite | 🔄 별도 wave (parser 변경) |
| 4 | UI 3화면 (admin / reveal-modal / dashboard) "❓ 상태 모름" 배지 | 🔄 별도 wave (데이터 flow 추가) |

## 현재 적용 (Step 1)

```typescript
// tick-pipeline.ts syncPoolAiAuditStatusesFromCurrentCache
const patch: Record<string, unknown> = {
  ai_audit_status: verdict,  // hold / pass / reject
  ai_audit_at: now,
  ai_audit_reason: (cached.reason ?? "").slice(0, 200),
};
// Wave 771 주석: hold 일 때 condition_class null overwrite 의도지만
// NOT NULL constraint 라 보류 → schema migration 후 별도 wave.
```

`ai_audit_status='hold'` flag 가 DB 에 박혀있어서 UI 가 fetch 해서 표시 가능.

## 안전성

- Wave 761 정책 유지 (hold 매물 풀에 살림)
- DB schema 변경 0 (NOT NULL constraint 유지)
- 향후 UI 배지/시세 grouping 변경은 별도 wave (큰 변경)

## 다음 wave plan

Wave 772: UI 배지 + schema migration
- `mvp_candidate_pool.condition_class` ALTER COLUMN ... DROP NOT NULL
- 3화면 카드에 `ai_audit_status='hold'` 일 때 chip 표시
- comparable_key tier 부분 `unknown_condition` overwrite (drift gate 재발동)

## 관련 commit

- `2c1a1bdf`: Wave 770 — Universal placeholder ceiling
- 본 commit: Wave 771 — AI hold 정책 명확화 (코드 주석 + decision log)
