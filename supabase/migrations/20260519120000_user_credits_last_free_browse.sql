-- Wave 338 (Phase 1a — freemium explore 모델):
-- 무료 사용자가 /explore에서 새 30개 매물 받을 때 마지막 시각 추적.
-- /api/packs/pool에서 30분 cooldown 체크 (last_free_browse_at < NOW() - 30min).
-- 영향: 비파괴적 ADD COLUMN. 기존 데이터/쿼리 영향 없음. NULL 디폴트 (한 번도 안 받은 사용자).

alter table public.mvp_user_credits
  add column if not exists last_free_browse_at timestamptz;

comment on column public.mvp_user_credits.last_free_browse_at is
  'Wave 338: 무료 사용자가 /explore에서 마지막으로 새 30개 매물 받은 시각. 30분 cooldown 체크용.';
