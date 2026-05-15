// 2026-05-15: 다나와 가격 자동 refresh cron.
// 매일 1회 (새벽 4시 KST) trigger:
//   1. mvp_listing_parsed에서 미개봉 매물 자주 나오는 comparable_key 추출 (top 50)
//   2. 다나와 가격 fetch (1초/요청, rate limit 보호)
//   3. mvp_reference_prices upsert
// QStash schedule: 0 19 * * * (UTC 19시 = KST 새벽 4시)

import { NextResponse, type NextRequest } from "next/server";
import {
  buildCronRequestMeta,
  failCollectRun,
  finishCollectRunMinimal,
  startCollectRun,
} from "@/lib/collect-logs";
import { checkCronAuth } from "@/lib/cron-auth";
import { acquireCronGuard, cronGuardSkipBody } from "@/lib/cron-guard";
import { scrapeBatch, type ScrapedPrice } from "@/lib/reference-price-scraper";
import { restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const MAX_SKUS_PER_RUN = 60;

type CandidateKey = {
  comparable_key: string;
  total: number;
  new_count: number;
  sample_label: string;
};

async function loadTopCandidates(): Promise<CandidateKey[]> {
  // 미개봉 매물 1건 이상 등장한 SKU. 최근 30일 활성 매물 중에서.
  const sql = `
    select
      p.comparable_key,
      count(*) as total,
      count(*) filter (where (p.parsed_json->>'condition_notes') like '%new_or_open_box%') as new_count,
      (array_agg(r.sku_name) filter (where r.sku_name is not null))[1] as sample_label
    from public.mvp_listing_parsed p
    join public.mvp_raw_listings r on r.pid = p.pid
    where p.comparable_key is not null
      and p.needs_review = false
      and p.parse_confidence >= 0.7
    group by p.comparable_key
    having count(*) filter (where (p.parsed_json->>'condition_notes') like '%new_or_open_box%') >= 1
    order by new_count desc
    limit ${MAX_SKUS_PER_RUN}
  `;
  // PostgREST 직접 SQL 안 됨. RPC 없으면 별도 방식.
  // 임시: REST API로 listing_parsed 전체 fetch + JS에서 group by. 비용 큼.
  // 차선: 별도 RPC 만들거나 mvp_reference_prices의 기존 row 유지 + 신규 SKU만 추가.
  // 단순 방법: mvp_reference_prices에 이미 row 있는 SKU + 미개봉 매물 자주 등장하는 fixed list.
  // 향후 wave에서 RPC로 자동 추출.

  // 일단 KEY_TO_QUERY에 박힌 SKU를 default로 사용 (50개 fixed).
  // sql 변수 unused warning 회피 위해 시그니처에만 박음.
  void sql;
  const { KEY_TO_QUERY_LIST } = await import("@/lib/reference-price-scraper-keys");
  return KEY_TO_QUERY_LIST.map((entry) => ({
    comparable_key: entry.comparableKey,
    total: 0,
    new_count: 0,
    sample_label: entry.label,
  }));
}

async function upsertReferencePrice(item: { comparableKey: string; label: string }, scraped: ScrapedPrice) {
  const now = new Date().toISOString();
  await restFetch(tableUrl("mvp_reference_prices"), {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      comparable_key: item.comparableKey,
      label: item.label,
      coupang_price: null,            // 다나와 합산 가격이라 별도 컬럼 X
      naver_price: null,
      retail_price: null,
      effective_price: scraped.minPrice,
      source_urls: { danawa: scraped.sourceUrl, raw_sample: scraped.rawSample ?? null },
      updated_at: now,
    }),
  });
}

async function syncListingSkuMedian() {
  // 미개봉 매물의 sku_median을 reference_price.effective_price로 즉시 sync.
  // tick worker가 자동으로 다음 cycle에 update하지만 빠르게 반영하려고 SQL 직접.
  const sql = `
    with updates as (
      select
        l.pid,
        rp.effective_price as new_median
      from public.mvp_listings l
      join public.mvp_listing_parsed p on p.pid = l.pid
      join public.mvp_reference_prices rp on rp.comparable_key = p.comparable_key
      where (p.parsed_json->>'condition_notes') like '%new_or_open_box%'
        and rp.effective_price is not null
        and rp.effective_price > 0
        and l.sku_median != rp.effective_price
    )
    update public.mvp_listings l
    set sku_median = u.new_median,
        updated_at = now()
    from updates u
    where l.pid = u.pid
  `;
  void sql;
  // Supabase REST는 raw SQL 안 받음. RPC 필요. 일단 skip (다음 tick worker가 처리).
}

async function handle(req: NextRequest) {
  const { authOk, authReason } = checkCronAuth(req);
  if (!authOk) return NextResponse.json({ error: "unauthorized", reason: authReason }, { status: 401 });

  const guard = acquireCronGuard("reference_price_refresh", req);
  if (!guard.allowed) return NextResponse.json(cronGuardSkipBody(guard));

  // 2026-05-16: collect-logs 박기. 미박으면 watchdog false positive
  // (5/15 22:51 KST 알림이 그 케이스 — DB엔 정상 reference price 박혔는데 mvp_collect_runs엔 0건).
  const meta = buildCronRequestMeta(req, authOk, authReason, "reference-price-refresh");
  const run = await startCollectRun(meta);

  const startedAt = Date.now();
  try {
    const candidates = await loadTopCandidates();
    const items = candidates.map((c) => ({ comparableKey: c.comparable_key, label: c.sample_label }));

    const progress: Array<{ key: string; price: number | null }> = [];
    const scraped = await scrapeBatch(items, (done, total, current) => {
      console.log(`[ref-price] ${done}/${total} — ${current.query}: ${current.minPrice ?? "FAIL"}`);
    });

    let successCount = 0;
    let failCount = 0;
    for (const item of items) {
      const s = scraped.get(item.comparableKey);
      if (!s) {
        failCount += 1;
        continue;
      }
      if (s.minPrice === null) {
        failCount += 1;
        progress.push({ key: item.comparableKey, price: null });
        continue;
      }
      await upsertReferencePrice(item, s);
      successCount += 1;
      progress.push({ key: item.comparableKey, price: s.minPrice });
    }

    await syncListingSkuMedian();

    await finishCollectRunMinimal(run.id, run.startedAt, { upserted: successCount, collected: items.length }, {
      mode: "reference-price-refresh",
      total: items.length,
      success: successCount,
      fail: failCount,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      ok: true,
      total: items.length,
      success: successCount,
      fail: failCount,
      durationMs: Date.now() - startedAt,
      progress,
    });
  } catch (err) {
    console.error("[ref-price-refresh] error", err);
    await failCollectRun(run.id, run.startedAt, err);
    return NextResponse.json(
      { error: "ref_price_refresh_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  } finally {
    guard.release();
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
