# 2026-05-19 — P1-F-Fix-1: Title-triage skipped pid lifecycle seed

## 결정

[Sold 검출 진단](2026-05-19-p1-velocity-condition-confidence-sold-detection.md) 결과에서 발견된 fix-1 박음.

**문제**: 신발/의류/가방 매물의 99%+가 title-triage에서 `detail_status='skipped'` 처리되는데, `seedLifecycleChecks`가 detail enrichment 성공 후에만 호출돼서 skipped pid는 `mvp_lifecycle_checks`에 **영구 누락**. → sold polling 대상 X → sold 검출 1~5% (smartwatch 40% vs)

**해결**: title-triage skip patch 직후에 같은 pid들을 `general` priority tier로 lifecycle seed. polling 비용 최소화 + sold 검출 회복.

## 변경 (What)

파일: [tick-pipeline.ts:1334-1351](../../src/lib/tick-pipeline.ts#L1334)

`patch_title_triage_skips` substage 직후에 `seed_lifecycle_for_skipped` substage 추가:

```ts
const skippedPids = titleTriageSkipGroups.flatMap((group) => group.ids);
if (skippedPids.length > 0) {
  await timedSearchSubstage(timingsMs, "seed_lifecycle_for_skipped", async () => {
    const seeded = await seedLifecycleChecks(
      skippedPids.map((pid) => ({ pid, priorityTier: "general" as const })),
    );
    timingsMs.skipped_lifecycle_seeded = seeded;
  });
}
```

## 안전성

- `seedLifecycleChecks` 내부 → `insertIgnoreRows` 사용. 이미 lifecycle에 있는 pid는 중복 X
- `priority_tier='general'` (가장 낮은 우선순위, 긴 cooldown). polling 비용 최소화
- `state_reason='seeded_from_pipeline'` 박힘 (디버깅용)
- 첫 production 실행 시 mass insert (신발 4208 + 의류 310 + 가방 347 + 기타 = 약 5000 row). chunk 처리되어 안전

## 예상 효과

다음 market-worker cron(매시간 QStash) 실행 후:
- `mvp_lifecycle_checks`에 skipped pid 약 5000건 추가
- lifecycle-worker가 general tier 폴링 시작 (긴 cooldown 따라)
- 매물 SOLD_OUT 또는 disappeared 인지 시 `listing_state='sold_confirmed'` or `'disappeared'` 박힘
- velocity 다음 새벽 cron이 sold_confirmed를 집계 → 신발/의류/가방 sold 카운트 증가

다만 **즉시 효과는 X** — lifecycle polling cadence(general tier 긴 cooldown) + sold 발생 시간 + 다음 velocity cron 누적 필요. **2~7일에 걸쳐 점진 회복** 예상.

## 후속 — 같이 안 박은 것

- **P1-F-Fix-2** (disappeared도 sold 표본 포함): 정책 결정이라 사용자가 yes 안 함. 자연 sold만으로 데이터 회복 가능 여부 보고 결정
- **SKU catalog 확장** — title-triage 실패가 본질적으론 catalog 부족 때문. Wave 90 source diversification 후속 mining wave에서 신발/의류/가방 모델 추가 작업 필요 (별도)
- **확인 모니터링**: 1주일 후 신발/의류/가방 sold % 측정. 5% → 15%+ 회복하면 fix 성공

## 관련

- 진단 보고서: docs/DECISIONS/2026-05-19-p1-velocity-condition-confidence-sold-detection.md
- Velocity P0 fix: docs/DECISIONS/2026-05-19-velocity-p0-fix.md
- Wave 90 source diversification 메모리 — 신발/의류/가방 추가의 본질적 흐름
