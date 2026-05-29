-- Wave 932: batch Daangn detail backfill success patch.
--
-- Existing Daangn detail backfill updated mvp_raw_listings once per fetched
-- detail. With 3 shards this can create hundreds of REST PATCH calls per
-- cycle. This function preserves the same row-level update semantics while
-- batching successful manner-temperature patches.

create or replace function public.patch_mvp_daangn_detail_backfill_successes(
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_now timestamptz := now();
begin
  with input_rows as (
    select
      pid,
      manner_temperature,
      review_count
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as row(
      pid bigint,
      manner_temperature numeric,
      review_count integer
    )
    where pid is not null
      and manner_temperature is not null
  ), updated as (
    update public.mvp_raw_listings raw
    set daangn_manner_temperature = input_rows.manner_temperature,
        daangn_review_count = input_rows.review_count,
        detail_status = 'done',
        detail_enriched_at = v_now,
        detail_error = null,
        score_dirty = true,
        updated_at = v_now
    from input_rows
    where raw.pid = input_rows.pid
      and raw.source = 'daangn'
    returning raw.pid
  )
  select count(*) into v_count from updated;

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.patch_mvp_daangn_detail_backfill_successes(jsonb) from public;
revoke execute on function public.patch_mvp_daangn_detail_backfill_successes(jsonb) from anon;
revoke execute on function public.patch_mvp_daangn_detail_backfill_successes(jsonb) from authenticated;
grant execute on function public.patch_mvp_daangn_detail_backfill_successes(jsonb) to service_role;
