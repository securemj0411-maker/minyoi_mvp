-- Wave 947b: market invalidation hot-path index.
--
-- Production market_worker timed out on high-volume comparable_key reads:
--   comparable_key in (...)
--   parse_confidence >= 0.65
--   needs_review = false
--   order by pid asc
--   limit N
--
-- The older index on (comparable_key, parse_confidence desc) does not help the
-- pid ordering enough for hot keys such as AirPods. This partial covering index
-- is scoped to the exact eligible parsed-row subset used by market invalidation.

create index concurrently if not exists mvp_listing_parsed_market_invalidation_idx
  on public.mvp_listing_parsed(comparable_key, pid)
  include (
    parser_version,
    category,
    parse_confidence,
    condition_score,
    condition_class,
    condition_tier,
    needs_review,
    condition_notes
  )
  where needs_review is false
    and parse_confidence >= 0.65;
