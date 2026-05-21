export const DETAIL_EVENT_LABELS = {
  detail_opened: "상세 열람",
  detail_closed: "상세 닫기",
  free_limit_paywall_shown: "결제 CTA 노출",
  easy_mode_started: "쉬운모드 시작",
  easy_mode_reopened: "쉬운모드 다시 보기",
  easy_mode_step_view: "쉬운모드 장면",
  easy_mode_next: "쉬운모드 다음",
  easy_mode_prev: "쉬운모드 이전",
  easy_mode_skipped: "숫자 리포트 바로가기",
  easy_mode_completed: "쉬운모드 완료",
  detail_report_opened: "상세 숫자 리포트",
  original_confirm_opened: "원본 이동 확인창",
  original_clicked: "원본 매물 클릭",
  original_cancelled: "원본 이동 취소",
  related_clicked: "다른 매물 클릭",
  scrap_saved: "스크랩 저장",
  scrap_removed: "스크랩 해제",
} as const;

export type DetailEventType = keyof typeof DETAIL_EVENT_LABELS;

const DETAIL_EVENT_TYPES = new Set<string>(Object.keys(DETAIL_EVENT_LABELS));

export function isDetailEventType(value: unknown): value is DetailEventType {
  return typeof value === "string" && DETAIL_EVENT_TYPES.has(value);
}

export function detailEventLabel(value: string) {
  return DETAIL_EVENT_LABELS[value as DetailEventType] ?? value;
}
