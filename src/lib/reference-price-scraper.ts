// 2026-05-15: 다나와 가격비교 스크래퍼.
// 미개봉/새상품 매물의 시세 비교용 — 우리 풀 매물 시세(중고)와 별도로 쿠팡/네이버/11번가/G마켓 등
// 모든 한국 쇼핑몰 최저가를 다나와에서 가져옴. 다나와는 SSR HTML이라 fetch + parse 안정적.
//
// 검색 URL: https://search.danawa.com/dsearch.php?query=<keyword>&originalQuery=<keyword>
// 결과 페이지에 "최저가" 가격이 박혀있음. CSS selector 또는 정규식으로 추출.
//
// rate limit 보호: 요청 사이 1초 sleep, User-Agent 박음.

const DANAWA_SEARCH_URL = "https://search.danawa.com/dsearch.php";
const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export type ScrapedPrice = {
  query: string;
  minPrice: number | null;
  sourceUrl: string;
  rawSample?: string; // 디버그용 첫 매물 title
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 다나와 검색 결과에서 최저가 추출.
 * 다나와 HTML 구조 (2026-05 기준):
 * - .prod_main_info .price_sect strong → 가격
 * - 또는 .lowest_prc → 최저가 명시
 * - 정규식으로 "₩X,XXX,XXX" 또는 "X,XXX,XXX원" 패턴 추출 후 최저
 */
export async function fetchDanawaMinPrice(query: string): Promise<ScrapedPrice> {
  const url = `${DANAWA_SEARCH_URL}?query=${encodeURIComponent(query)}&originalQuery=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      // Vercel serverless timeout: 10s
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return { query, minPrice: null, sourceUrl: url };
    }
    const html = await res.text();

    // 다나와 HTML — "최저" 또는 "최저가" 텍스트 근처 가격 추출.
    // 일반 패턴: <strong>1,490,000</strong> 원 또는 <em class="prc_c">1,490,000</em>
    // 가장 안전: "최저가" 또는 "price_sect" 컨텍스트 안의 첫 가격
    const pricePattern = /(?:최저가?|lowest|price_sect)[\s\S]{0,500}?([0-9]{1,3}(?:,[0-9]{3}){1,3})\s*원/gi;
    const allPrices: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = pricePattern.exec(html)) !== null) {
      const num = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(num) && num >= 10_000 && num <= 10_000_000) {
        allPrices.push(num);
      }
    }
    // Fallback: 단순 "X,XXX,XXX원" 모두 추출, 첫 20개 중 최저
    if (allPrices.length === 0) {
      const simplePattern = /([0-9]{1,3}(?:,[0-9]{3}){1,3})\s*원/g;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = simplePattern.exec(html)) !== null && count < 20) {
        const num = Number(m[1].replace(/,/g, ""));
        if (Number.isFinite(num) && num >= 50_000 && num <= 5_000_000) {
          allPrices.push(num);
          count += 1;
        }
      }
    }

    if (allPrices.length === 0) {
      return { query, minPrice: null, sourceUrl: url };
    }

    // outlier 차단: median ± 50% 안만 유지
    allPrices.sort((a, b) => a - b);
    const med = allPrices[Math.floor(allPrices.length / 2)];
    const safe = allPrices.filter((p) => p >= med * 0.5 && p <= med * 1.5);
    const minPrice = safe.length > 0 ? Math.min(...safe) : allPrices[0];

    // raw sample: 첫 제품 title 추출 (검증용)
    const titleMatch = html.match(/<p\s+class="prod_name"[\s\S]{0,200}?<a[^>]*>([\s\S]{0,200}?)<\/a>/i);
    const rawSample = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 100) : undefined;

    return { query, minPrice, sourceUrl: url, rawSample };
  } catch (err) {
    console.error("[danawa-scraper] fetch failed", { query, err: err instanceof Error ? err.message : String(err) });
    return { query, minPrice: null, sourceUrl: url };
  }
}

/**
 * comparable_key → 다나와 검색용 한국어 query 매핑.
 * 풀에 자주 등장하는 SKU에 대해 정확한 검색어 박음.
 * 신규 SKU는 label 그대로 사용 (fallback).
 */
const KEY_TO_QUERY: Record<string, string> = {
  // AirPods
  "airpods|airpods_4|usbc|anc": "에어팟 4세대 ANC",
  "airpods|airpods_4|usbc|no_anc": "에어팟 4세대",
  "airpods|airpods_4_anc|usbc": "에어팟 4세대 ANC",
  "airpods|airpods_max|usbc": "에어팟 맥스 USB-C",
  "airpods|airpods_max|lightning": "에어팟 맥스",
  "airpods|airpods_pro_2_lightning|lightning": "에어팟 프로 2세대",
  "airpods|airpods_pro_2_usbc|usbc": "에어팟 프로 2세대 USB-C",
  "airpods|airpods_pro_3|usbc": "에어팟 프로 3세대",
  "airpods|airpods_pro_1|lightning": "에어팟 프로 1세대",
  // iPad
  "ipad|ipad_10|10_9in|64gb|wifi": "아이패드 10세대 64GB Wi-Fi",
  "ipad|ipad_10|10_9in|256gb|wifi": "아이패드 10세대 256GB Wi-Fi",
  "ipad|ipad_mini|7_gen|8_3in|128gb|wifi": "아이패드 미니 7세대 128GB Wi-Fi",
  "ipad|ipad_mini|6_gen|8_3in|64gb|wifi": "아이패드 미니 6세대 64GB Wi-Fi",
  "ipad|ipad_air|m4|11in|128gb|wifi": "아이패드 에어 M4 11인치 128GB Wi-Fi",
  "ipad|ipad_air|m3|11in|128gb|wifi": "아이패드 에어 M3 11인치 128GB Wi-Fi",
  "ipad|ipad_pro|m5|11in|256gb|wifi": "아이패드 프로 M5 11인치 256GB Wi-Fi",
  "ipad|ipad_pro|m5|13in|256gb|wifi": "아이패드 프로 M5 13인치 256GB Wi-Fi",
  // iPhone
  "iphone|iphone_16e|128gb": "아이폰 16e 128GB",
  "iphone|iphone_16|128gb": "아이폰 16 128GB",
  "iphone|iphone_16_pro_max|256gb": "아이폰 16 Pro Max 256GB",
  "iphone|iphone_16_pro_max|512gb": "아이폰 16 Pro Max 512GB",
  "iphone|iphone_15_pro_max|256gb": "아이폰 15 Pro Max 256GB",
  "iphone|iphone_14|128gb": "아이폰 14 128GB",
  // Apple Watch
  "applewatch|applewatch_se3|40mm|gps": "애플워치 SE 3세대 40mm GPS",
  "applewatch|applewatch_se3|44mm|gps": "애플워치 SE 3세대 44mm GPS",
  "applewatch|applewatch_se2|40mm|gps": "애플워치 SE 2세대 40mm GPS",
  "applewatch|applewatch_se2|44mm|gps": "애플워치 SE 2세대 44mm GPS",
  "applewatch|applewatch_series9|41mm|gps": "애플워치 시리즈 9 41mm GPS",
  "applewatch|applewatch_series10|46mm|gps": "애플워치 시리즈 10 46mm GPS",
  "applewatch|applewatch_series10|42mm|gps": "애플워치 시리즈 10 42mm GPS",
  "applewatch|applewatch_ultra|49mm|cellular": "애플워치 울트라 1세대 49mm 셀룰러",
  "applewatch|applewatch_ultra2|49mm|cellular": "애플워치 울트라 2 49mm 셀룰러",
  // Galaxy
  "galaxy_s|galaxy_s25|256gb": "갤럭시 S25 256GB",
  "galaxy_s|galaxy_s24_ultra|512gb": "갤럭시 S24 Ultra 512GB",
  "galaxywatch|galaxywatch_ultra|47mm|cellular": "갤럭시 워치 울트라 47mm LTE",
  "galaxywatch|galaxywatch_ultra|47mm|gps": "갤럭시 워치 울트라 47mm GPS",
  "galaxywatch|galaxywatch_7|44mm|gps": "갤럭시 워치 7 44mm GPS",
  "galaxywatch|galaxywatch_7|40mm|gps": "갤럭시 워치 7 40mm GPS",
  "galaxywatch|galaxywatch_6|40mm|gps": "갤럭시 워치 6 40mm GPS",
  "galaxy_tab|galaxy_tab_s10_ultra|14_6in|256gb|wifi": "갤럭시 탭 S10 Ultra 256GB Wi-Fi",
  "galaxy_tab|galaxy_tab_s10_plus|12_4in|256gb|wifi": "갤럭시 탭 S10+ 256GB Wi-Fi",
  "galaxy_tab|galaxy_tab_s9_fe_plus|12_4in|128gb|wifi": "갤럭시 탭 S9 FE+ 128GB Wi-Fi",
  // MacBook
  "macbook|macbook_air|m5_gen|m5|13in|16gb_ram|512gb_ssd": "맥북 에어 M5 13인치 16GB 512GB",
  // Earphone
  "earphone|galaxy_buds_3_pro": "갤럭시 버즈 3 프로",
  "earphone|sony_wh_ch520": "소니 WH-CH520",
  "earphone|beats_solo_4": "비츠 솔로 4",
  // Casio / Speaker
  "casio|gshock_dw5600": "지샥 DW-5600",
  "casio|gshock_ga2100": "지샥 GA-2100",
  "speaker|marshall_emberton_ii|portable_bluetooth_speaker": "마샬 엠버튼 2",
};

export function getQueryForComparableKey(comparableKey: string, fallbackLabel?: string): string {
  return KEY_TO_QUERY[comparableKey] ?? fallbackLabel ?? comparableKey;
}

/**
 * Batch scraping helper — sleep 1초씩 박아서 rate limit 보호.
 */
export async function scrapeBatch(
  items: { comparableKey: string; label: string }[],
  onProgress?: (done: number, total: number, current: ScrapedPrice) => void,
  options?: { maxElapsedMs?: number; delayMs?: number },
): Promise<Map<string, ScrapedPrice>> {
  const result = new Map<string, ScrapedPrice>();
  const startedAt = Date.now();
  const delayMs = Math.max(0, options?.delayMs ?? 1000);
  for (let i = 0; i < items.length; i++) {
    if (options?.maxElapsedMs != null && Date.now() - startedAt >= options.maxElapsedMs) break;
    const item = items[i];
    const query = getQueryForComparableKey(item.comparableKey, item.label);
    const scraped = await fetchDanawaMinPrice(query);
    result.set(item.comparableKey, scraped);
    onProgress?.(i + 1, items.length, scraped);
    if (i < items.length - 1 && delayMs > 0) await sleep(delayMs); // rate limit
  }
  return result;
}
