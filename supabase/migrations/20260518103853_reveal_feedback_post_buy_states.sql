-- Wave 242 (2026-05-18): post-buy follow-up states for /me closing loop.
--
-- These states intentionally store status only. Actual buy/sell price capture is
-- deferred until the UX can ask for money amounts without adding friction.

alter table public.mvp_reveal_feedback
  drop constraint if exists mvp_reveal_feedback_feedback_type_check;

alter table public.mvp_reveal_feedback
  add constraint mvp_reveal_feedback_feedback_type_check
  check (feedback_type in (
    'interested',
    'bought',
    'missed_sold',
    'bad_pick',
    'watching',
    'contacted',
    'passed',
    'inspected',
    'listed',
    'resold',
    'loss_report',
    'inaccurate_report'
  ));
