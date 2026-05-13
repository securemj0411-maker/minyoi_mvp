-- 검증된 4개 안 쓰이는 인덱스 DROP
-- 근거: pg_stat_user_indexes idx_scan=0 (stats_reset=null로 누적 통계 신뢰)
--      + 코드 grep 결과 해당 컬럼 조합 쿼리 0건
-- 효과: 27 MB 회수 + 매 INSERT/UPDATE 시 b-tree 갱신 비용 감소
-- 위험: 0 (DROP만 함)

drop index if exists public.mvp_listing_observations_seller_idx;
drop index if exists public.mvp_sellers_resurrection_idx;
drop index if exists public.mvp_sellers_seen_idx;
drop index if exists public.mvp_listing_observation_payloads_pid_seen_idx;
