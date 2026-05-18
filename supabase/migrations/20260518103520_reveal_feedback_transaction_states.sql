-- Wave 241 (2026-05-18): transaction-state feedback for /me retention loop.
--
-- Adds the first explicit closing-loop states:
--   contacted = user messaged/contacted seller
--   passed    = user intentionally passed on the listing
--
-- `bought` already exists and continues to drive SavedMoneyCounter.

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
    'loss_report',
    'inaccurate_report'
  ));
