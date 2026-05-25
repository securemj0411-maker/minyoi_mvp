// Daangn source production ingest module.
//
// codex/daangn-probe branch 의 probe API (src/lib/daangn.ts) 를 활용해
// 실제 cron 안에서 search → detail → raw upsert 까지 가는 ingest pipeline.
//
// Stage 1 (Shadow Mode):
//   - mvp_raw_listings 에 source='daangn' 으로 write 만
//   - candidate_pool 진입 차단 (poolEligible=false hard-coded)
//   - 검증 + parser 정확도 audit 용
//
// Stage 2+ (다음 phase):
//   - shipping_possible 매물만 pool_eligible=true
//   - detail queue 분리
//   - lifecycle/observation
//
// 환경 변수 (운영):
//   DAANGN_SOURCE_MODE              "off" (default) / "probe" / "active"
//   DAANGN_INGEST_MAX_COMBOS        12  (cron 당 search combo 수)
//   DAANGN_INGEST_MAX_DETAIL_SAMPLES 8   (cron 당 detail fetch 한도)
//   DAANGN_INGEST_DELAY_MS          600 (request 사이 delay)
//   DAANGN_INGEST_ACTIVE_HOURS      72  (boostedAt 활성 윈도)
//   DAANGN_INGEST_FRESH_HOURS       24  (detail fetch 우선순위 fresh 기준)
//
// 안전:
//   - mode=off 면 skip
//   - blockedSignals 발견 시 즉시 중단 + source_health 갱신
//   - robots.txt 우회 X (/kr/buy-sell/?in=... 만 사용)

import {
  DAANGN_BASE_URL,
  DAANGN_FASHION_CATEGORIES,
  DAANGN_SOURCE_ID,
  DEFAULT_DAANGN_FASHION_QUERY_SEEDS,
  DEFAULT_DAANGN_REGION_SEEDS,
  buildDaangnSearchUrl,
  daangnInternalPid,
  detectDaangnBlockSignal,
  fetchDaangnText,
  getDaangnSourceMode,
  parseDaangnDetailHtml,
  parseDaangnExternalId,
  parseDaangnSearchHtml,
  shouldFetchDaangnDetailCandidate,
  summarizeDaangnArticles,
  type DaangnBlockSignal,
  type DaangnCategorySeed,
  type DaangnDetailArticle,
  type DaangnQuerySeed,
  type DaangnRegionSeed,
  type DaangnSearchArticle,
  type DaangnSourceMode,
} from "@/lib/daangn";
import { jsonBody, restFetch, serviceHeaders, tableUrl } from "@/lib/supabase-rest";
import { buildDaangnQueryPool } from "@/lib/daangn-query-pool";
import { classifyListing } from "@/lib/pipeline";
import { ruleMatch } from "@/lib/catalog";
import { parseListingOptions, toParsedListingRow } from "@/lib/option-parser";

// ───────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────

export type DaangnShippingInference = "shipping_possible" | "direct_only" | "unknown";

export type DaangnIngestCombo = {
  region: DaangnRegionSeed;
  query: DaangnQuerySeed;
  category: DaangnCategorySeed;
};

export type DaangnIngestArticleRecord = {
  article: DaangnSearchArticle;
  combo: DaangnIngestCombo;
  ageHours: number | null;
  bucket: "fresh_24h" | "active_72h" | "stale" | "unknown";
};

export type DaangnIngestDetailRecord = {
  article: DaangnDetailArticle;
  combo: DaangnIngestCombo;
  shipping: DaangnShippingInference;
};

export type DaangnIngestResult = {
  source: typeof DAANGN_SOURCE_ID;
  mode: DaangnSourceMode;
  skipped: boolean;
  skipReason?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;

  // combo 진행
  combos: number;
  executedCombos: number;
  blockedCombos: number;
  failedCombos: number;

  // 매물 통계 (probe 와 동일 키)
  articles: number;
  ongoing: number;
  crawlAllowedOngoing: number;
  freshBoosted24h: number;
  activeBoosted72h: number;
  uniqueOngoingUrls: number;

  // detail 처리
  detailCandidates: number;
  detailFetched: number;
  detailParsed: number;
  detailFailed: number;

  // shipping 분포
  shipping: { shipping_possible: number; direct_only: number; unknown: number };

  // DB write (Stage 1: 모두 0 — schema 적용 후 활성)
  rawUpserted: number;
  rawSkippedExisting: number;

  // 안전 신호
  blockedSignals: DaangnBlockSignal[];
  sourceHealthStatus: "healthy" | "degraded" | "unhealthy";
  sourceHealthReason: string;
};

export type DaangnIngestOptions = {
  maxCombos?: number;
  maxDetailSamples?: number;
  delayMs?: number;
  activeWindowHours?: number;
  freshWindowHours?: number;
  timeoutMs?: number;
  // test override
  regions?: DaangnRegionSeed[];
  queries?: DaangnQuerySeed[];
  categories?: DaangnCategorySeed[];
  // Phase 6i: region firehose 모드 (default true). false 시 legacy keyword combo 모드.
  useRegionFirehose?: boolean;
  // dry-run: DB write 안 함 (Stage 1 default)
  dryRun?: boolean;
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function boundedInt(raw: string | number | undefined | null, fallback: number, min: number, max: number) {
  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function ageHours(timestamp: string | null, nowMs: number): number | null {
  if (!timestamp) return null;
  const t = Date.parse(timestamp);
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / 3_600_000;
}

function articleBucket(hours: number | null, freshH: number, activeH: number) {
  if (hours == null) return "unknown" as const;
  if (hours <= freshH) return "fresh_24h" as const;
  if (hours <= activeH) return "active_72h" as const;
  return "stale" as const;
}

// shipping 추론 — 보수적 (direct_only default).
// Codex hypothesis: "shipping은 구조화 신호가 약해서 설명문에 택배 가능 근거가 없으면 direct_only 로 보수 처리".
export function inferDaangnShipping(article: DaangnSearchArticle | DaangnDetailArticle): DaangnShippingInference {
  const title = (article.title ?? "").toLowerCase();
  const content = ((article as DaangnDetailArticle).content ?? article.content ?? "").toLowerCase();
  const blob = `${title}\n${content}`;

  // 명시적 직거래 only — direct_only 확정
  if (/직거래\s*만|직거래only|택배\s*안돼|택배\s*불가|직거래\s*위주/i.test(blob)) {
    return "direct_only";
  }
  // 명시적 택배 가능 — shipping_possible
  if (/택배\s*가능|택배\s*ok|전국택배|편의점\s*택배|반택|준등기|등기|cu\s*택배|gs\s*택배|우체국\s*택배|cj대한통운|cj\s*택배|롯데\s*택배|한진\s*택배|로젠\s*택배|당근페이|안전결제/i.test(blob)) {
    return "shipping_possible";
  }
  return "unknown";
}

function buildEmptyResult(mode: DaangnSourceMode, skipReason: string | undefined, startedAt: Date): DaangnIngestResult {
  return {
    source: DAANGN_SOURCE_ID,
    mode,
    skipped: true,
    skipReason,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    combos: 0,
    executedCombos: 0,
    blockedCombos: 0,
    failedCombos: 0,
    articles: 0,
    ongoing: 0,
    crawlAllowedOngoing: 0,
    freshBoosted24h: 0,
    activeBoosted72h: 0,
    uniqueOngoingUrls: 0,
    detailCandidates: 0,
    detailFetched: 0,
    detailParsed: 0,
    detailFailed: 0,
    shipping: { shipping_possible: 0, direct_only: 0, unknown: 0 },
    rawUpserted: 0,
    rawSkippedExisting: 0,
    blockedSignals: [],
    sourceHealthStatus: "healthy",
    sourceHealthReason: skipReason ?? "no-op",
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

// ───────────────────────────────────────────────────────────────────────────
// DB upsert
// ───────────────────────────────────────────────────────────────────────────

function buildRawListingRow(
  article: DaangnSearchArticle | DaangnDetailArticle,
  shipping: DaangnShippingInference | null,
  nowIso: string,
): { raw: Record<string, unknown>; parsed: Record<string, unknown> | null; sku_id: string | null } | null {
  const externalId = parseDaangnExternalId(article.href);
  if (!externalId) return null;
  // mvp_raw_listings.price 는 NOT NULL (no default).
  // 당근 매물 중 price=null = "가격 협의" 등 → reseller 가치 0 → skip.
  if (article.price == null || !Number.isFinite(Number(article.price))) return null;
  const pid = daangnInternalPid(externalId);
  const fullUrl = article.href.startsWith("http") ? article.href : `${DAANGN_BASE_URL}${article.href}`;

  // Phase 6 — classifier + parser 통합 (bunjang detail-worker 패턴).
  //   sku_id 매칭 → score-worker 가 처리 가능.
  //   detail.content 가 있으면 description 으로 사용 (parser quality ↑).
  const title = article.title ?? "";
  const description = ((article as DaangnDetailArticle).content ?? article.content ?? "") as string;
  const price = Number(article.price ?? 0);
  const classified = classifyListing(title, description, price);
  const storageListingType = classified.listingType === "normal" ? "normal" : (classified.listingType ?? "unknown");
  const matched = classified.listingType === "normal" ? ruleMatch(title, description) : null;
  const parsedOptions = matched
    ? parseListingOptions({
      title,
      description,
      skuId: matched.id,
      skuName: matched.modelName,
      category: matched.category,
    })
    : null;
  const skuId = parsedOptions && !parsedOptions.needsReview ? matched?.id ?? null : null;
  const skuName = parsedOptions && !parsedOptions.needsReview ? matched?.modelName ?? null : null;
  const parsedRow = parsedOptions ? toParsedListingRow(pid, parsedOptions) : null;

  // pool_eligible 정책 (Phase 6 수정 — 사용자 정책):
  //   당근 매물 = 동네 직거래 default OK.
  //   direct_only / unknown / shipping_possible 모두 pool 진입 후보.
  //   매물 노출 시 사용자 동네 매칭은 per-user filter (Phase 7).
  //   sku_id NULL = 분류 실패 → pool 차단.
  const poolEligible =
    Boolean(skuId) &&
    storageListingType === "normal" &&
    article.status === "Ongoing" &&
    !article.user.webCrawlNotAllowed;

  // mvp_raw_listings NOT NULL columns — 안전 fallback 박기 (NOT NULL no-default 모두 cover):
  //   pid, url, name, price (no-default — 위에서 skip 처리)
  //   그 외 default 있는 것 (num_faved, free_shipping, query, source, description_preview, sale_status,
  //   shop_review_count, listing_type, detail_status, raw_json, listing_state, missing_count,
  //   seller_source, score_dirty) 는 default 사용 가능하지만 명시 박기.
  const priceInt = Math.max(0, Math.round(Number(article.price)));
  const raw: Record<string, unknown> = {
    pid,
    source: DAANGN_SOURCE_ID,
    url: fullUrl,
    name: title || "(no title)",
    price: priceInt,
    num_faved: article.favoriteCount ?? 0,
    num_comment: article.chatCount ?? 0,
    free_shipping: false,
    thumbnail_url: article.thumbnail ?? null,
    description_preview: (description ?? "").slice(0, 500),
    query: `daangn:${article.region.name ?? article.region.dbId ?? "unknown"}`,
    seller_uid: article.user.dbId ?? null,
    seller_source: DAANGN_SOURCE_ID,
    listing_state: article.status === "Ongoing" ? "active" : "disappeared",
    listing_type: storageListingType,
    sku_id: skuId,
    sku_name: skuName,
    sale_status: article.status === "Ongoing" ? "saling" : (article.status?.toLowerCase() ?? ""),
    shop_review_count: 0,
    image_count: 0,
    missing_count: 0,
    detail_status: "done",
    detail_enriched_at: nowIso,
    source_updated_at: article.boostedAt ?? article.createdAt ?? nowIso,
    last_seen_at: nowIso,
    last_changed_at: nowIso,
    updated_at: nowIso,
    pool_eligible: poolEligible,
    score_dirty: poolEligible,  // sku 매칭 + normal → score-worker 가 다음 cycle 에 처리
    raw_json: {
      source: DAANGN_SOURCE_ID,
      externalId,
      region: article.region,
      category: article.category,
      createdAt: article.createdAt,
      boostedAt: article.boostedAt,
      viewCount: article.viewCount,
      chatCount: article.chatCount,
      favoriteCount: article.favoriteCount,
      user: article.user,
    },
    // Daangn 전용 컬럼 (Phase 3 schema migration)
    daangn_region_id: article.region.dbId,
    daangn_region_name: article.region.name,
    daangn_boosted_at: article.boostedAt,
    daangn_web_crawl_allowed: !article.user.webCrawlNotAllowed,
    daangn_shipping_inferred: shipping ?? "unknown",
  };
  return { raw, parsed: parsedRow, sku_id: skuId };
}

async function upsertDaangnRawListings(
  articles: DaangnSearchArticle[],
  detailRecords: DaangnIngestDetailRecord[],
): Promise<number> {
  if (articles.length === 0) return 0;
  const nowIso = new Date().toISOString();

  // detail enriched 매물 (shipping 추론됨) 은 우선 사용
  const detailShippingByExternal = new Map<string, DaangnShippingInference>();
  for (const r of detailRecords) {
    const ext = parseDaangnExternalId(r.article.href);
    if (ext) detailShippingByExternal.set(ext, r.shipping);
  }

  // dedupe by pid (같은 매물 여러 combo 중복 검색됨)
  const byPid = new Map<number, { raw: Record<string, unknown>; parsed: Record<string, unknown> | null }>();
  for (const article of articles) {
    const ext = parseDaangnExternalId(article.href);
    if (!ext) continue;
    const shipping = detailShippingByExternal.get(ext) ?? null;
    const built = buildRawListingRow(article, shipping, nowIso);
    if (!built) continue;
    byPid.set(built.raw.pid as number, { raw: built.raw, parsed: built.parsed });
  }

  const rawRows = [...byPid.values()].map((b) => b.raw);
  const parsedRows = [...byPid.values()].map((b) => b.parsed).filter((p): p is Record<string, unknown> => Boolean(p));
  if (rawRows.length === 0) return 0;

  // upsert raw (joongna 패턴 동일)
  const rawRes = await restFetch(`${tableUrl("mvp_raw_listings")}?on_conflict=pid`, {
    method: "POST",
    headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
    body: jsonBody(rawRows),
  });
  if (!rawRes.ok) {
    throw new Error(`mvp_raw_listings upsert failed: ${rawRes.status} ${await rawRes.text()}`);
  }

  // upsert parsed (score-worker 가 sku 매칭 매물 처리하려면 필수)
  if (parsedRows.length > 0) {
    const parsedRes = await restFetch(`${tableUrl("mvp_listing_parsed")}?on_conflict=pid`, {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=minimal"),
      body: jsonBody(parsedRows),
    });
    if (!parsedRes.ok) {
      // parsed upsert 실패는 fatal X — raw 는 박혔으니 다음 cron 재시도
      console.warn(`mvp_listing_parsed upsert failed: ${parsedRes.status} ${await parsedRes.text()}`);
    }
  }

  return rawRows.length;
}

// ───────────────────────────────────────────────────────────────────────────
// Combo selection (rotation strategy)
// ───────────────────────────────────────────────────────────────────────────

export type DaangnComboSelection = {
  combos: DaangnIngestCombo[];
  totalSpace: number;
};

export function selectDaangnCombos(input: {
  regions: DaangnRegionSeed[];
  queries: DaangnQuerySeed[];
  categories: DaangnCategorySeed[];
  maxCombos: number;
  // Phase 6h: production 은 shuffleRegions=true 로 111 region 골고루 hit.
  //   tests/순수함수 검증 시 false 로 결과 deterministic 유지.
  shuffleRegions?: boolean;
}): DaangnComboSelection {
  const { regions, queries, categories, maxCombos } = input;
  const shuffleRegions = input.shuffleRegions ?? false;
  const out: DaangnIngestCombo[] = [];
  let space = 0;

  // Phase 6e fallback: regions 가 빈 배열일 때 placeholder 1개로 동작.
  //   사용자별 동네 검색 등 future use case 대비.
  //   현실: nationwide 검색 안 됨 (ElasticSearch region sharding) — 운영 코드는 항상 regions 전달.
  if (regions.length === 0) {
    const placeholderRegion: DaangnRegionSeed = { id: "", name: "전국" };
    for (const query of queries) {
      for (const cat of categories) {
        space += 1;
        if (out.length >= maxCombos) continue;
        if (query.categoryIds.length > 0 && !query.categoryIds.includes(cat.id)) continue;
        out.push({ region: placeholderRegion, query, category: cat });
      }
    }
    return { combos: out, totalSpace: space };
  }

  // Phase 6h: region-round-robin + optional shuffle.
  //   - 기존 linear iteration: 111 region × 6 query × 3 cat = 1998 combo space,
  //     maxCombos=30 cap 으로 첫 1-2 region 만 hit → region 30+은 영영 cover 안 됨.
  //   - 새 방식: depth-first round-robin (1번째 query/cat 를 모든 region 에서 한 번씩,
  //     그 다음 2번째 query/cat 를 다시 모든 region) → maxCombos 안에서도 region 다양성 max.
  //   - shuffleRegions=true 시 매 tick 마다 region order 무작위화 → 운영에서 24h 누적 시
  //     모든 region 골고루 cover.

  // 1) per-region combo list 미리 build (category filter 통과한 것만)
  const regionOrder = shuffleRegions ? shuffleArray(regions) : regions;
  const perRegion: DaangnIngestCombo[][] = regionOrder.map((region) => {
    const list: DaangnIngestCombo[] = [];
    for (const query of queries) {
      for (const cat of categories) {
        space += 1;
        if (query.categoryIds.length > 0 && !query.categoryIds.includes(cat.id)) continue;
        list.push({ region, query, category: cat });
      }
    }
    return list;
  });

  // 2) depth-first round-robin: depth 0 ⇒ 각 region 의 0번째 combo, depth 1 ⇒ 1번째, ...
  let depth = 0;
  while (out.length < maxCombos) {
    let appended = false;
    for (const list of perRegion) {
      if (depth < list.length) {
        out.push(list[depth]);
        appended = true;
        if (out.length >= maxCombos) break;
      }
    }
    if (!appended) break;
    depth += 1;
  }

  return { combos: out, totalSpace: space };
}

// 순수 함수: Fisher-Yates shuffle (Math.random 사용, test 시 비결정적).
function shuffleArray<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Phase 6i: Region firehose 모드 sentinel.
//   ?in=구-id 만으로 fetch (키워드/카테고리 filter X) → 지역 최신 매물 통째 ingest.
//   keyword combo 의 99% 흘림 문제 해결 — 자릿수 다른 ingest 양.
const DAANGN_FIREHOSE_QUERY: DaangnQuerySeed = {
  label: "firehose",
  search: "",
  categoryIds: [],
};
const DAANGN_FIREHOSE_CATEGORY: DaangnCategorySeed = {
  id: 0,  // sentinel — buildDaangnSearchUrl 가 0 / empty 시 category_id param 생략
  name: "전체",
};

// Phase 6i: 지역 피드 firehose combo 생성기.
//   - input.maxRegions 만큼 region 선택 (shuffle 시 매 tick 다른 region)
//   - 각 region 당 1 combo (no keyword × no category filter)
//   - selectDaangnCombos 의 keyword × cat × region 매트릭스 우회
export function selectDaangnFirehoseCombos(input: {
  regions: DaangnRegionSeed[];
  maxRegions: number;
  shuffleRegions?: boolean;
}): DaangnComboSelection {
  const shuffleRegions = input.shuffleRegions ?? false;
  const order = shuffleRegions ? shuffleArray(input.regions) : input.regions;
  const limit = Math.min(input.maxRegions, order.length);
  const combos: DaangnIngestCombo[] = [];
  for (let i = 0; i < limit; i += 1) {
    combos.push({
      region: order[i],
      query: DAANGN_FIREHOSE_QUERY,
      category: DAANGN_FIREHOSE_CATEGORY,
    });
  }
  return { combos, totalSpace: input.regions.length };
}

// ───────────────────────────────────────────────────────────────────────────
// Main ingest
// ───────────────────────────────────────────────────────────────────────────

export async function runDaangnIngest(options: DaangnIngestOptions = {}): Promise<DaangnIngestResult> {
  const startedAt = new Date();
  const mode = getDaangnSourceMode();

  if (mode === "off") {
    return buildEmptyResult(mode, "mode_off", startedAt);
  }

  // Phase 6f: env 의존 제거 — 코드 default 가 항상 우선.
  //   사용자가 Vercel env 매번 변경하는 부담 제거.
  //   options 으로만 override 가능 (test/특수 케이스).
  // Phase 6i+ budget fix v2: 10 region 도 80s timeout (Vercel rate-limit slowdown 의심).
  //   3 region 으로 안전 마진 — 19:35/19:40/19:45/19:50 cron 다 timeout 났음.
  //   24h 누적: 3 × 288 tick = 864 region-hit / day → 111 region pool 8 cycle / day.
  //   대형 batch upsert path 최적화 후 다시 증가 (별도 wave).
  const maxCombos = boundedInt(options.maxCombos, 3, 1, 200);
  const maxDetailSamples = boundedInt(options.maxDetailSamples, 15, 0, 100);
  const delayMs = boundedInt(options.delayMs, 400, 200, 5000);
  const activeWindowHours = boundedInt(options.activeWindowHours, 72, 1, 720);
  const freshWindowHours = boundedInt(options.freshWindowHours, 24, 1, 168);
  const timeoutMs = boundedInt(options.timeoutMs, 10_000, 1_000, 30_000);
  const dryRun = options.dryRun ?? mode !== "active";

  // Region 기반 ingest (Phase 6g — 6e 전국 검색 가설 폐기).
  //   options.regions 으로 override 가능 (테스트/실험용).
  const regions = options.regions ?? DEFAULT_DAANGN_REGION_SEEDS;

  // Phase 6i: Region firehose 모드 default ON.
  //   배경: keyword × region combo 가 99% 매물 흘림 (지역 firehose 가 진짜 프리미티브).
  //   `?in=구-id` 단독 fetch → 지역 최신 매물 50+개 통째 ingest → 자릿수 다른 throughput.
  //   options.useRegionFirehose=false 로 keyword 모드 fallback 가능 (실험/테스트).
  const useRegionFirehose = options.useRegionFirehose ?? true;

  let combos: DaangnIngestCombo[];
  if (useRegionFirehose) {
    // Firehose 모드: keyword/category filter X, region 만 iteration.
    //   maxCombos = 한 tick 에서 fetch 할 region 수.
    const result = selectDaangnFirehoseCombos({
      regions,
      maxRegions: maxCombos,
      shuffleRegions: true,
    });
    combos = result.combos;
  } else {
    // Legacy keyword 모드: catalog query × region × category combo (Phase 6g 동작).
    let queries = options.queries;
    if (!queries || queries.length === 0) {
      try {
        const built = buildDaangnQueryPool({ maxQueries: 50, includeBroad: true });
        queries = built.length > 0 ? built : DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
      } catch (err) {
        console.warn("buildDaangnQueryPool failed (non-fatal)", err);
        queries = DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
      }
    }
    const categories = options.categories ?? DAANGN_FASHION_CATEGORIES;
    const result = selectDaangnCombos({ regions, queries, categories, maxCombos, shuffleRegions: true });
    combos = result.combos;
  }

  // 진행 통계
  let executedCombos = 0;
  let blockedCombos = 0;
  let failedCombos = 0;
  const blockedSignals: DaangnBlockSignal[] = [];

  const allArticles: DaangnSearchArticle[] = [];
  const ongoingSeenUrls = new Set<string>();

  for (let i = 0; i < combos.length; i += 1) {
    const combo = combos[i];
    const url = buildDaangnSearchUrl({
      regionId: combo.region.id || undefined,  // 빈 ID = 전국 검색
      categoryId: combo.category.id,
      search: combo.query.search,
    });

    let resp;
    try {
      resp = await fetchDaangnText(url, timeoutMs);
    } catch (err) {
      failedCombos += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    if (resp.blockSignal.blocked) {
      blockedCombos += 1;
      blockedSignals.push(resp.blockSignal);
      // 차단 감지 즉시 중단 (안전)
      break;
    }

    if (!resp.ok) {
      failedCombos += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    try {
      const parsed = parseDaangnSearchHtml(resp.body);
      for (const a of parsed.articles) {
        allArticles.push(a);
        if (a.status === "Ongoing" && a.href) ongoingSeenUrls.add(a.href);
      }
      executedCombos += 1;
    } catch (err) {
      failedCombos += 1;
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  // Summarize
  const summary = summarizeDaangnArticles(allArticles, {
    freshWindowHours,
    activeWindowHours,
    staleBoostedDays: 14,
  });
  const nowMs = Date.now();

  // Phase 6i+: Detail fetch 선별 priority — [sku_id 매칭 우선, then 신선도]
  //   배경: firehose 8K 매물 중 ~99% noise (catalog SKU 외). FIFO 신선도-only 정렬 시
  //         freshest 15 = 거의 noise → detail 낭비.
  //   대응: top 200 freshest 만 pre-classify (200ms cost), sku 매칭된 매물 우선
  //         enrich → shipping_possible/direct_only 정확도 ↑ → pool entry 정확도 ↑.
  const eligibleForDetail = allArticles
    .filter((a) => shouldFetchDaangnDetailCandidate(a, { activeWindowHours, nowMs }))
    .map((a) => ({ article: a, hours: ageHours(a.boostedAt ?? a.createdAt, nowMs) }))
    .sort((a, b) => (a.hours ?? Infinity) - (b.hours ?? Infinity))
    .slice(0, 200);  // top 200 freshest pre-filter

  const withSkuHint = eligibleForDetail.map((entry) => {
    const a = entry.article;
    const title = a.title ?? "";
    const desc = (a.content ?? "") as string;
    const price = Number(a.price ?? 0);
    let skuId: string | null = null;
    try {
      const cls = classifyListing(title, desc, price);
      if (cls.listingType === "normal") {
        const match = ruleMatch(title, desc);
        skuId = match?.id ?? null;
      }
    } catch {
      // classify 실패 시 sku null 로 fallback
    }
    return { ...entry, skuId };
  });

  const detailCandidates = withSkuHint
    .sort((a, b) => {
      const aHas = !!a.skuId;
      const bHas = !!b.skuId;
      if (aHas !== bHas) return aHas ? -1 : 1;  // sku 매칭 우선
      return (a.hours ?? Infinity) - (b.hours ?? Infinity);  // 그 다음 fresh 우선
    })
    .slice(0, maxDetailSamples);

  let detailFetched = 0;
  let detailParsed = 0;
  let detailFailed = 0;
  const shipping = { shipping_possible: 0, direct_only: 0, unknown: 0 };
  const detailRecords: DaangnIngestDetailRecord[] = [];

  for (const cand of detailCandidates) {
    const url = cand.article.href.startsWith("http") ? cand.article.href : `https://www.daangn.com${cand.article.href}`;
    let resp;
    try {
      resp = await fetchDaangnText(url, timeoutMs);
      detailFetched += 1;
    } catch (err) {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    if (resp.blockSignal.blocked) {
      blockedSignals.push(resp.blockSignal);
      break;
    }

    if (!resp.ok) {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }

    const parsed = parseDaangnDetailHtml(resp.body);
    if (!parsed) {
      detailFailed += 1;
      if (delayMs > 0) await sleep(delayMs);
      continue;
    }
    detailParsed += 1;

    const ship = inferDaangnShipping(parsed);
    shipping[ship] += 1;
    detailRecords.push({
      article: parsed,
      combo: combos[0], // best-effort — TODO: combo trace 유지
      shipping: ship,
    });

    if (delayMs > 0) await sleep(delayMs);
  }

  // Source health 평가
  let sourceHealthStatus: DaangnIngestResult["sourceHealthStatus"] = "healthy";
  let sourceHealthReason = "ok";
  if (blockedSignals.length > 0) {
    sourceHealthStatus = "unhealthy";
    sourceHealthReason = `blocked:${blockedSignals[0].reason ?? "unknown"}`;
  } else if (failedCombos / Math.max(1, combos.length) > 0.5) {
    sourceHealthStatus = "degraded";
    sourceHealthReason = `failed_rate_${Math.round((failedCombos / combos.length) * 100)}pct`;
  }

  // DB write (Stage 1 = Shadow Mode — raw_listings 까지만, pool_eligible=false hard-coded)
  let rawUpserted = 0;
  let rawSkippedExisting = 0;
  if (!dryRun) {
    try {
      rawUpserted = await upsertDaangnRawListings(allArticles, detailRecords);
    } catch (err) {
      sourceHealthStatus = "degraded";
      // 디버그 측면에서 충분히 보이도록 800자까지 보존
      sourceHealthReason = `db_write_error:${err instanceof Error ? err.message.slice(0, 800) : String(err).slice(0, 800)}`;
    }
  }

  const finishedAt = new Date();
  return {
    source: DAANGN_SOURCE_ID,
    mode,
    skipped: false,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),

    combos: combos.length,
    executedCombos,
    blockedCombos,
    failedCombos,

    articles: summary.total,
    ongoing: summary.ongoing,
    crawlAllowedOngoing: summary.crawlAllowedOngoing,
    freshBoosted24h: summary.freshBoosted24h,
    activeBoosted72h: summary.activeBoosted72h,
    uniqueOngoingUrls: ongoingSeenUrls.size,

    detailCandidates: detailCandidates.length,
    detailFetched,
    detailParsed,
    detailFailed,

    shipping,
    rawUpserted,
    rawSkippedExisting,

    blockedSignals,
    sourceHealthStatus,
    sourceHealthReason,
  };
}
