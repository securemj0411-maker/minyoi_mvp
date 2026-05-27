# Wave 778 — Galaxy Watch 6/7 콜라보 에디션 차단

- 시간: 2026-05-27 KST
- 트리거: sweep audit + owner 우려 (톰브라운 에디션 시세 거품).

## 발견 — 실제 매물 수 작음

DB 점검 결과:
- galaxywatch-6 (249건): 톰브라운 1건, 우영미 0, 키츠네 0, 티타늄 0
- galaxywatch-7 (179건): 톰브라운 0, 티타늄 1건
- galaxywatch-4 (118건): 톰브라운 2건, 우영미 1, 키츠네 4
- galaxywatch-ultra (108건): 티타늄 30건 ← 정상 (Ultra는 원래 티타늄)

sweep agent 가 톰브라운 매물 수 과장했음. 실제 영향 매물 4~5건만.

## 결정 — mustNotContain patch 만, narrow SKU 신설 X

매물 수 부족 (1~2건) → narrow SKU 신설 ROI 낮음. **차단만 (`null sku_id` drop)**.

## 변경

`src/lib/catalog.ts`:
- `galaxywatch-6`: mustNotContain 에 톰브라운/우영미/메종키츠네 추가
- `galaxywatch-7`: 동일 추가
- (galaxywatch-4/5 는 이미 Wave 670 에서 톰브라운 차단됨)

## DB rematch

영향 매물 4~5건. UPDATE skip (cron 자연 갱신 충분).

## Follow-up

- 만약 톰브라운 매물 늘어나면 narrow SKU 신설 검토
- Galaxy Watch Ultra 티타늄 30건은 원래 Ultra=티타늄이라 분리 불필요
