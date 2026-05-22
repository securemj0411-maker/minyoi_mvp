-- Wave 714b (2026-05-23): condition_chips text[] 추가 — 정규화 chip array.
--
-- 사용자 요구 (2026-05-23):
--   "박스도 잇고 실착 적을수도잇고 다른 chip도 될수도잇고 동시에"
--   "이식성 강하게 정규화해서 보관해야될듯? 어디서든 잘 활용될수있게"
--   "/me 페이지 상세보기에서 간단하게 실착 2~3회, 박스포함 뭐 이런거"
--
-- 형식: text[] (Postgres array). listing 당 multi-chip 동시 보유.
-- 예: ["wear:unworn", "box:full", "auth:kream", "extra:extra_laces"]
-- UI 한국어 라벨: `mvp/src/lib/grading/chips.ts:CHIP_LABELS`.
--
-- positive only (negative chip 은 다음 wave).
-- GIN index — 특정 chip 보유 매물 query 효율 (예: "kream 인증만", "풀구성만").
--
-- 영향: ADD COLUMN NULL 허용 — 기존 row/query 영향 0.

ALTER TABLE public.mvp_listing_parsed
  ADD COLUMN IF NOT EXISTS condition_chips text[] NULL;

COMMENT ON COLUMN public.mvp_listing_parsed.condition_chips IS
  'Wave 714: 정규화 chip key array (예: [wave:unworn, box:full, auth:kream]). UI 라벨은 grading/chips.ts:CHIP_LABELS. positive only.';

CREATE INDEX IF NOT EXISTS idx_mvp_listing_parsed_condition_chips
  ON public.mvp_listing_parsed USING GIN (condition_chips)
  WHERE condition_chips IS NOT NULL;
