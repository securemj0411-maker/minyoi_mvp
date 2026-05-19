// Wave 244 (2026-05-19): learning queue admin UI.
//
// 정책:
//   - AI = 학습 catalyst (단기), catalog = source-of-truth (영구)
//   - regex patch 자동 X — admin approve 시 pending_patches 큐 적재.
//     catalog 코드는 admin 이 별도 git PR 또는 manual apply.
//   - reject 한 패턴은 false_positive=true → 같은 sku/matched_text 다시 큐 진입 X.
//
// 화면 구성:
//   1. 측정 카드 3개 — coverage % (오늘/이번주/이번달), 비용 USD (오늘/이번달), AI 호출 비율 line.
//   2. learning queue 테이블 — freq>=3 pending. sample pids 5건. approve/reject 버튼.

import LearningQueueAdmin from "@/components/learning-queue-admin";

export const dynamic = "force-dynamic";

export default function LearningQueueAdminPage() {
  return <LearningQueueAdmin />;
}
