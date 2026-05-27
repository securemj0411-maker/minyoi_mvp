import { createHash } from "node:crypto";

export const DAANGN_SOURCE_ID = "daangn" as const;
export const DAANGN_BASE_URL = "https://www.daangn.com";
export const DAANGN_ROBOTS_URL = `${DAANGN_BASE_URL}/robots.txt`;

// pid namespace (joongna = 7_000_000_000_000+, bunjang = native, daangn = 9_000_000_000_000+).
// String slug ID 를 deterministic 64-bit hash 로 변환해서 bigint pid 로 매핑.
const DAANGN_PID_BASE = 9_000_000_000_000;

export function daangnInternalPid(externalId: string): number {
  if (!externalId) throw new Error("daangnInternalPid: empty externalId");
  const digest = createHash("sha256").update(`${DAANGN_SOURCE_ID}:${externalId}`).digest();
  const hash32 = digest.readUInt32BE(0);
  return DAANGN_PID_BASE + hash32;
}

export function parseDaangnExternalId(href: string): string | null {
  if (!href) return null;
  // /kr/buy-sell/<slug>/
  const m = /\/kr\/buy-sell\/([^/?#]+)\/?/.exec(href);
  if (!m) return null;
  return decodeURIComponent(m[1]);
}

export type DaangnSourceMode = "off" | "probe" | "active";

export type DaangnBlockSignal = {
  blocked: boolean;
  reason: string | null;
  status: number;
};

export type DaangnFetchResult = {
  ok: boolean;
  url: string;
  status: number;
  contentType: string;
  body: string;
  blockSignal: DaangnBlockSignal;
};

export type DaangnRegionSeed = {
  name: string;
  id: string;
};

export type DaangnCategorySeed = {
  name: string;
  id: number;
};

export type DaangnQuerySeed = {
  label: string;
  search: string;
  categoryIds: number[];
};

export type DaangnSearchArticle = {
  id: string;
  href: string;
  title: string | null;
  price: number | null;
  status: string | null;
  content: string | null;
  thumbnail: string | null;
  createdAt: string | null;
  boostedAt: string | null;
  favoriteCount: number | null;
  chatCount: number | null;
  viewCount: number | null;
  region: {
    dbId: string | null;
    name: string | null;
  };
  category: {
    dbId: string | null;
    name: string | null;
  };
  user: {
    dbId: string | null;
    nickname: string | null;
    webCrawlNotAllowed: boolean;
  };
};

export type DaangnDetailArticle = DaangnSearchArticle & {
  user: DaangnSearchArticle["user"] & {
    score: number | null;
    reviewCount: number | null;
    profileImage: string | null;
    regionName: string | null;
  };
  recommendedCount: number | null;
  commentCount: number | null;
};

export type DaangnSearchProbeCombo = {
  region: DaangnRegionSeed;
  query: DaangnQuerySeed;
  category: DaangnCategorySeed;
  url: string;
  ok: boolean;
  status: number;
  blockSignal: DaangnBlockSignal;
  currentFilters: {
    regionId: string | null;
    categoryId: string | null;
    search: string | null;
  };
  result: DaangnSearchSummary;
};

export type DaangnSearchSummary = {
  total: number;
  ongoing: number;
  crawlAllowedOngoing: number;
  reserved: number;
  closed: number;
  freshBoosted24h: number;
  activeBoosted72h: number;
  staleBoostedOverDays: number;
  latestBoostedAt: string | null;
  regionTop: Array<{ name: string; count: number }>;
  samples: Array<{
    title: string | null;
    price: number | null;
    boostedAt: string | null;
    region: string | null;
    href: string;
    sellerNickname: string | null;
  }>;
};

export type DaangnProbeReport = {
  source: typeof DAANGN_SOURCE_ID;
  mode: DaangnSourceMode;
  writable: false;
  robots: {
    ok: boolean;
    status: number;
    disallow: string[];
    sitemaps: string[];
    blockSignal: DaangnBlockSignal;
    note: string;
  };
  searchedAt: string;
  probe: {
    regions: DaangnRegionSeed[];
    queries: DaangnQuerySeed[];
    categories: DaangnCategorySeed[];
    requestedCombos: number;
    executedCombos: number;
    delayMs: number;
    freshWindowHours: number;
    activeWindowHours: number;
    staleBoostedDays: number;
  };
  totals: {
    articles: number;
    ongoing: number;
    crawlAllowedOngoing: number;
    freshBoosted24h: number;
    activeBoosted72h: number;
    uniqueOngoingUrls: number;
    detailSamplesFetched: number;
    blockedCombos: number;
    failedCombos: number;
  };
  combos: DaangnSearchProbeCombo[];
  detailSamples: DaangnDetailArticle[];
  cadenceRecommendation: string[];
  decision: "disabled" | "source_safe_to_continue_probe_only" | "stop_on_block_or_error";
};

export type DaangnProbeOptions = {
  mode?: DaangnSourceMode;
  regions?: DaangnRegionSeed[];
  queries?: DaangnQuerySeed[];
  categories?: DaangnCategorySeed[];
  maxCombos?: number;
  maxDetailSamples?: number;
  delayMs?: number;
  timeoutMs?: number;
  freshWindowHours?: number;
  activeWindowHours?: number;
  staleBoostedDays?: number;
};

type RemixContext = {
  state?: {
    loaderData?: Record<string, unknown>;
  };
};

const TRANSPARENT_USER_AGENT =
  process.env.DAANGN_USER_AGENT ??
  `MinyoiDaangnProbe/0.1 (+${process.env.SOURCE_CONTACT_URL ?? process.env.SOURCE_CONTACT_EMAIL ?? "contact: operator"})`;

const DEFAULT_HEADERS = {
  "User-Agent": TRANSPARENT_USER_AGENT,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.6",
};

export const DAANGN_FASHION_CATEGORIES: DaangnCategorySeed[] = [
  { id: 14, name: "남성패션/잡화" },
  { id: 31, name: "여성잡화" },
  { id: 5, name: "여성의류" },
];

// Wave 775 (2026-05-27): 우리 catalog 매핑 가능한 8 카테고리 (사용자 검증).
//   firehose mode 의 80% 미스매칭 (식품/유아동/도서 등 흡수) 해결.
//   각 카테고리 우리 ready SKU 매핑:
//     1   디지털기기      → smartphone/tablet/earphone/laptop/smartwatch/desktop/speaker/camera/drone/monitor
//     2   취미/게임/음반  → game_console/lego
//     3   스포츠/레저     → sport_golf/shoe/bike
//     5   여성의류        → clothing
//     6   뷰티/미용       → perfume
//     14  남성패션/잡화   → clothing/shoe/bag
//     31  여성잡화        → bag
//     172 생활가전        → home_appliance
export const DAANGN_TARGET_CATEGORIES: DaangnCategorySeed[] = [
  { id: 1, name: "디지털기기" },
  { id: 2, name: "취미/게임/음반" },
  { id: 3, name: "스포츠/레저" },
  { id: 5, name: "여성의류" },
  { id: 6, name: "뷰티/미용" },
  { id: 14, name: "남성패션/잡화" },
  { id: 31, name: "여성잡화" },
  { id: 172, name: "생활가전" },
];

// Phase 6h: 구·시·군 단위 region pool 111개 (광역시 + 경기도 + 광역단체).
//
// 배경 (Phase 6e 회귀 + 6g 확장):
//   - `?search=` 만으로 nationwide 검색 시 ElasticSearch region sharding 으로 empty
//   - 동 단위 51개 (Phase 6) 는 동작/서초/종로 6개 구 만 cover → 서울 25 구 1/4 만 cover
//   - 구 단위 검색 (`?in=구_name-id`) verified 동작 — moajung 도 동일 방식
//
// 구성:
//   - 서울특별시 25 구 (전체)
//   - 부산광역시 16 구·군 (전체)
//   - 인천광역시 10 구·군 (전체)
//   - 대구광역시 8 구·군
//   - 대전광역시 5 구
//   - 광주광역시 5 구
//   - 울산광역시 5 구·군
//   - 경기도 37 시·구 (수원/성남/고양/용인/안산/안양 분구 + 핵심 시 + 화성/평택/김포/광명 등)
//   - 총 111 region (인구밀집 광역시 + 경기 핵심 = 한국 인구 ~75% cover)
//
// 동 단위 (Phase 6) 는 deprecated — 구 단위가 strictly broader coverage.
// 영업 시작 가능 = YES (서울 25 구 + 광역시 49 구 + 경기 37 시·구).
export const DEFAULT_DAANGN_REGION_SEEDS: DaangnRegionSeed[] = [
  // ─────── 서울특별시 25 구 ───────
  { id: "381", name: "강남구" },
  { id: "432", name: "강동구" },
  { id: "140", name: "강북구" },
  { id: "257", name: "강서구" },
  { id: "340", name: "관악구" },
  { id: "71",  name: "광진구" },
  { id: "278", name: "구로구" },
  { id: "294", name: "금천구" },
  { id: "169", name: "노원구" },
  { id: "154", name: "도봉구" },
  { id: "87",  name: "동대문구" },
  { id: "324", name: "동작구" },
  { id: "221", name: "마포구" },
  { id: "206", name: "서대문구" },
  { id: "362", name: "서초구" },
  { id: "53",  name: "성동구" },
  { id: "119", name: "성북구" },
  { id: "404", name: "송파구" },
  { id: "238", name: "양천구" },
  { id: "305", name: "영등포구" },
  { id: "36",  name: "용산구" },
  { id: "189", name: "은평구" },
  { id: "2",   name: "종로구" },
  { id: "20",  name: "중구" },
  { id: "102", name: "중랑구" },
  // ─────── 부산광역시 16 구·군 ───────
  { id: "452", name: "부산 중구" },
  { id: "462", name: "부산 서구" },
  { id: "476", name: "부산 동구" },
  { id: "490", name: "부산 영도구" },
  { id: "502", name: "부산진구" },
  { id: "524", name: "동래구" },
  { id: "538", name: "부산 남구" },
  { id: "556", name: "부산 북구" },
  { id: "570", name: "해운대구" },
  { id: "589", name: "사하구" },
  { id: "606", name: "금정구" },
  { id: "624", name: "부산 강서구" },
  { id: "632", name: "연제구" },
  { id: "645", name: "수영구" },
  { id: "656", name: "사상구" },
  { id: "669", name: "기장군" },
  // ─────── 인천광역시 10 구·군 ───────
  { id: "826", name: "인천 중구" },
  { id: "842", name: "인천 동구" },
  { id: "854", name: "미추홀구" },
  { id: "876", name: "연수구" },
  { id: "890", name: "남동구" },
  { id: "910", name: "부평구" },
  { id: "933", name: "계양구" },
  { id: "946", name: "인천 서구" },
  { id: "968", name: "강화군" },
  { id: "983", name: "옹진군" },
  // ─────── 대구광역시 8 구·군 ───────
  { id: "676", name: "대구 중구" },
  { id: "689", name: "대구 동구" },
  { id: "710", name: "대구 서구" },
  { id: "728", name: "대구 남구" },
  { id: "742", name: "대구 북구" },
  { id: "766", name: "수성구" },
  { id: "790", name: "달서구" },
  { id: "813", name: "달성군" },
  // ─────── 대전광역시 5 구 ───────
  { id: "1095", name: "대전 동구" },
  { id: "1112", name: "대전 중구" },
  { id: "1130", name: "대전 서구" },
  { id: "1154", name: "유성구" },
  { id: "1166", name: "대덕구" },
  // ─────── 광주광역시 5 구 ───────
  { id: "994",  name: "광주 동구" },
  { id: "1008", name: "광주 서구" },
  { id: "1027", name: "광주 남구" },
  { id: "1044", name: "광주 북구" },
  { id: "1072", name: "광산구" },
  // ─────── 울산광역시 5 구·군 ───────
  { id: "1180", name: "울산 중구" },
  { id: "1194", name: "울산 남구" },
  { id: "1209", name: "울산 동구" },
  { id: "1219", name: "울산 북구" },
  { id: "1228", name: "울주군" },
  // ─────── 경기도 37 시·구 ───────
  { id: "1259", name: "수원 장안구" },
  { id: "1270", name: "수원 권선구" },
  { id: "1282", name: "수원 팔달구" },
  { id: "1293", name: "수원 영통구" },
  { id: "1305", name: "성남 수정구" },
  { id: "1322", name: "성남 중원구" },
  { id: "1334", name: "성남 분당구" },
  { id: "1357", name: "의정부시" },
  { id: "1374", name: "안양 만안구" },
  { id: "1389", name: "안양 동안구" },
  { id: "1447", name: "광명시" },
  { id: "1466", name: "평택시" },
  { id: "1491", name: "동두천시" },
  { id: "1501", name: "안산 상록구" },
  { id: "1515", name: "안산 단원구" },
  { id: "1529", name: "고양 덕양구" },
  { id: "1549", name: "고양 일산동구" },
  { id: "1561", name: "고양 일산서구" },
  { id: "1578", name: "구리시" },
  { id: "1606", name: "오산시" },
  { id: "1613", name: "시흥시" },
  { id: "1631", name: "군포시" },
  { id: "1643", name: "의왕시" },
  { id: "1650", name: "하남시" },
  { id: "1664", name: "용인 처인구" },
  { id: "1676", name: "용인 기흥구" },
  { id: "1688", name: "용인 수지구" },
  { id: "1698", name: "파주시" },
  { id: "1720", name: "이천시" },
  { id: "1735", name: "안성시" },
  { id: "1751", name: "김포시" },
  { id: "1765", name: "화성시" },
  { id: "1791", name: "경기 광주시" },
  { id: "1802", name: "양주시" },
  { id: "1814", name: "포천시" },
  { id: "1829", name: "여주시" },
  // Wave 760 (2026-05-26): brute scan id=1830-1878 발견 — 경기 외곽 면·읍 단위.
  //   여주/연천/가평/양평 의 동·면·읍 27개. 매물 inflow 다양화 + 비수도권 사용자 일부 매물 노출.
  { id: "1830", name: "가남읍" },         // 여주
  { id: "1831", name: "점동면" },         // 여주
  { id: "1832", name: "흥천면" },         // 여주
  { id: "1833", name: "금사면" },         // 여주
  { id: "1834", name: "세종대왕면" },     // 여주
  { id: "1835", name: "대신면" },         // 여주
  { id: "1836", name: "북내면" },         // 여주
  { id: "1837", name: "강천면" },         // 여주
  { id: "1838", name: "산북면" },         // 여주
  { id: "1839", name: "여흥동" },         // 여주
  { id: "1840", name: "중앙동" },         // 여주
  { id: "1841", name: "오학동" },         // 여주
  { id: "1843", name: "연천읍" },         // 연천
  { id: "1844", name: "전곡읍" },         // 연천
  { id: "1845", name: "군남면" },         // 연천
  { id: "1846", name: "청산면" },         // 연천
  { id: "1847", name: "백학면" },         // 연천
  { id: "1848", name: "미산면" },         // 연천
  { id: "1850", name: "신서면" },         // 연천
  { id: "1852", name: "장남면" },         // 연천
  { id: "1854", name: "가평읍" },         // 가평
  { id: "1855", name: "설악면" },         // 가평
  { id: "1865", name: "옥천면" },         // 양평
  { id: "1868", name: "청운면" },         // 양평
  { id: "1869", name: "양동면" },         // 양평
  { id: "1871", name: "용문면" },         // 양평
  { id: "1878", name: "동산면" },         // 양평
  // Wave 761 (2026-05-26): 강원도 18 시·군 — 각 1 seed (sibling cascade 로 시·군 전체 cover).
  //   sibling cascade 검증: 1854 가평읍 seed → 1855 설악면 매물 330건 수집 ✅ (DB 측정).
  //   같은 원리로 각 시·군 1 seed 만으로 그 시·군 전체 매물 inflow.
  { id: "1880", name: "남면" },           // 강원 춘천시
  { id: "1902", name: "문막읍" },         // 강원 원주시
  { id: "1928", name: "주문진읍" },       // 강원 강릉시
  { id: "1950", name: "천곡동" },         // 강원 동해시
  { id: "1961", name: "황지동" },         // 강원 태백시
  { id: "1970", name: "영랑동" },         // 강원 속초시
  { id: "1979", name: "도계읍" },         // 강원 삼척시
  { id: "1993", name: "홍천읍" },         // 강원 홍천군
  { id: "2004", name: "횡성읍" },         // 강원 횡성군
  { id: "2014", name: "영월읍" },         // 강원 영월군
  { id: "2025", name: "평창읍" },         // 강원 평창군
  { id: "2035", name: "정선읍" },         // 강원 정선군
  { id: "2046", name: "철원읍" },         // 강원 철원군
  { id: "2059", name: "화천읍" },         // 강원 화천군
  { id: "2065", name: "양구읍" },         // 강원 양구군
  { id: "2071", name: "인제읍" },         // 강원 인제군
  { id: "2079", name: "간성읍" },         // 강원 고성군
  { id: "2086", name: "양양읍" },         // 강원 양양군
  // 충북 청주 4구 + 충주.
  { id: "2095", name: "낭성면" },         // 충북 청주 상당구
  { id: "2109", name: "사창동" },         // 충북 청주 서원구
  { id: "2121", name: "오송읍" },         // 충북 청주 흥덕구
  { id: "2133", name: "내수읍" },         // 충북 청주 청원구
  { id: "2142", name: "주덕읍" },         // 충북 충주시
  // Wave 762 (2026-05-26): 충북 나머지 9 시·군 + 충남 7 시·군 + 천안 2구.
  //   sibling cascade — 1 seed per 군·시 = 그 군·시 전체 매물 inflow.
  { id: "2168", name: "봉양읍" },         // 충북 제천시
  { id: "2186", name: "보은읍" },         // 충북 보은군
  { id: "2198", name: "옥천읍" },         // 충북 옥천군
  { id: "2208", name: "영동읍" },         // 충북 영동군
  { id: "2220", name: "증평읍" },         // 충북 증평군
  { id: "2223", name: "진천읍" },         // 충북 진천군
  { id: "2231", name: "괴산읍" },         // 충북 괴산군
  { id: "2243", name: "음성읍" },         // 충북 음성군
  { id: "2253", name: "단양읍" },         // 충북 단양군
  // 충남 (천안 + 7 시).
  { id: "2264", name: "목천읍" },         // 충남 천안 동남구
  { id: "2282", name: "성환읍" },         // 충남 천안 서북구
  { id: "2296", name: "유구읍" },         // 충남 공주시
  { id: "2313", name: "웅천읍" },         // 충남 보령시
  { id: "2332", name: "염치읍" },         // 충남 아산시
  { id: "2350", name: "대산읍" },         // 충남 서산시
  { id: "2366", name: "강경읍" },         // 충남 논산시
  { id: "2430", name: "장항읍" },         // 충남 서천군
  // Wave 763 (2026-05-26): 충남 잔여 4 + 전북 14 + 전남 22 + 경북 24 + 경남 1 = 65 seed.
  { id: "2444", name: "청양읍" },         // 충남 청양군
  { id: "2455", name: "홍성읍" },         // 충남 홍성군
  { id: "2467", name: "예산읍" },         // 충남 예산군
  { id: "2480", name: "태안읍" },         // 충남 태안군
  // 전북 14 시·군.
  { id: "2491", name: "중앙동" },         // 전북 전주시
  { id: "2527", name: "옥구읍" },         // 전북 군산시
  { id: "2555", name: "함열읍" },         // 전북 익산시
  { id: "2586", name: "신태인읍" },       // 전북 정읍시
  { id: "2610", name: "운봉읍" },         // 전북 남원시
  { id: "2634", name: "만경읍" },         // 전북 김제시
  { id: "2654", name: "삼례읍" },         // 전북 완주군
  { id: "2668", name: "진안읍" },         // 전북 진안군
  { id: "2680", name: "무주읍" },         // 전북 무주군
  { id: "2687", name: "장수읍" },         // 전북 장수군
  { id: "2695", name: "임실읍" },         // 전북 임실군
  { id: "2708", name: "순창읍" },         // 전북 순창군
  { id: "2720", name: "고창읍" },         // 전북 고창군
  { id: "2735", name: "부안읍" },         // 전북 부안군
  // 전남 22 시·군.
  { id: "2750", name: "용당1동" },        // 전남 목포시
  { id: "2774", name: "돌산읍" },         // 전남 여수시
  { id: "2805", name: "승주읍" },         // 전남 순천시
  { id: "2831", name: "남평읍" },         // 전남 나주시
  { id: "2852", name: "광양읍" },         // 전남 광양시
  { id: "2865", name: "담양읍" },         // 전남 담양군
  { id: "2878", name: "곡성읍" },         // 전남 곡성군
  { id: "2890", name: "구례읍" },         // 전남 구례군
  { id: "2899", name: "고흥읍" },         // 전남 고흥군
  { id: "2918", name: "보성읍" },         // 전남 보성군
  { id: "2932", name: "화순읍" },         // 전남 화순군
  { id: "2947", name: "장흥읍" },         // 전남 장흥군
  { id: "2958", name: "강진읍" },         // 전남 강진군
  { id: "2970", name: "해남읍" },         // 전남 해남군
  { id: "2985", name: "영암읍" },         // 전남 영암군
  { id: "2998", name: "무안읍" },         // 전남 무안군
  { id: "3009", name: "함평읍" },         // 전남 함평군
  { id: "3019", name: "영광읍" },         // 전남 영광군
  { id: "3032", name: "장성읍" },         // 전남 장성군
  { id: "3044", name: "완도읍" },         // 전남 완도군
  { id: "3059", name: "진도읍" },         // 전남 진도군
  { id: "3069", name: "지도읍" },         // 전남 신안군
  // 경북 24 시·군 (포항 2구 + 군위 — 23년 대구 편입 전 ID).
  { id: "3096", name: "구룡포읍" },       // 경북 포항 남구
  { id: "3111", name: "흥해읍" },         // 경북 포항 북구
  { id: "3128", name: "감포읍" },         // 경북 경주시
  { id: "3152", name: "아포읍" },         // 경북 김천시
  { id: "3175", name: "풍산읍" },         // 경북 안동시
  { id: "3200", name: "선산읍" },         // 경북 구미시
  { id: "3228", name: "풍기읍" },         // 경북 영주시
  { id: "3248", name: "금호읍" },         // 경북 영천시
  { id: "3265", name: "함창읍" },         // 경북 상주시
  { id: "3294", name: "문경읍" },         // 경북 문경시
  { id: "3311", name: "하양읍" },         // 경북 경산시
  { id: "3327", name: "군위읍" },         // 경북 군위군 (현 대구)
  { id: "3336", name: "의성읍" },         // 경북 의성군
  { id: "3355", name: "청송읍" },         // 경북 청송군
  { id: "3364", name: "영양읍" },         // 경북 영양군
  { id: "3371", name: "영덕읍" },         // 경북 영덕군
  { id: "3385", name: "청도읍" },         // 경북 청도군
  { id: "3395", name: "대가야읍" },       // 경북 고령군
  { id: "3404", name: "성주읍" },         // 경북 성주군
  { id: "3415", name: "왜관읍" },         // 경북 칠곡군
  { id: "3424", name: "예천읍" },         // 경북 예천군
  { id: "3437", name: "봉화읍" },         // 경북 봉화군
  { id: "3448", name: "울진읍" },         // 경북 울진군
  { id: "3460", name: "울릉읍" },         // 경북 울릉군
  // 경남 시작 (창원).
  { id: "3467", name: "동읍" },           // 경남 창원시 (의창구)
  // Wave 764 (2026-05-26): 경남 잔여 4 구 + 17 시·군 + 제주 2 + 세종 1 = 24.
  //   v8 scan (3501-5500) → 1619 region IDs. cherry-pick.
  { id: "3476", name: "반송동" },         // 경남 창원 성산구
  { id: "3484", name: "구산면" },         // 경남 창원 마산합포구
  { id: "3504", name: "내서읍" },         // 경남 창원 마산회원구
  { id: "3520", name: "충무동" },         // 경남 창원 진해구
  { id: "3534", name: "문산읍" },         // 경남 진주시
  { id: "3567", name: "산양읍" },         // 경남 통영시
  { id: "3583", name: "사천읍" },         // 경남 사천시
  { id: "3600", name: "진영읍" },         // 경남 김해시
  { id: "3621", name: "삼랑진읍" },       // 경남 밀양시
  { id: "3642", name: "거제면" },         // 경남 거제시
  { id: "3662", name: "물금읍" },         // 경남 양산시
  { id: "3677", name: "의령읍" },         // 경남 의령군
  { id: "3691", name: "가야읍" },         // 경남 함안군
  { id: "3702", name: "창녕읍" },         // 경남 창녕군
  { id: "3717", name: "고성읍" },         // 경남 고성군
  { id: "3732", name: "남해읍" },         // 경남 남해군
  { id: "3743", name: "하동읍" },         // 경남 하동군
  { id: "3757", name: "산청읍" },         // 경남 산청군
  { id: "3769", name: "함양읍" },         // 경남 함양군
  { id: "3781", name: "거창읍" },         // 경남 거창군
  { id: "3794", name: "합천읍" },         // 경남 합천군
  // 제주 2 시.
  { id: "3813", name: "한림읍" },         // 제주 제주시
  { id: "3840", name: "대정읍" },         // 제주 서귀포시
  // 세종 (특별자치시, 동 단위 only).
  { id: "4153", name: "종촌동" },         // 세종특별자치시
  { id: "4203", name: "부천시" },
];

export const DEFAULT_DAANGN_FASHION_QUERY_SEEDS: DaangnQuerySeed[] = [
  { label: "shoe", search: "나이키 덩크", categoryIds: [14, 31] },
  { label: "shoe", search: "아디다스 삼바", categoryIds: [14, 31] },
  { label: "shoe", search: "뉴발란스 993", categoryIds: [14, 31] },
  { label: "clothing", search: "아크테릭스 베타", categoryIds: [14, 5] },
  { label: "clothing", search: "슈프림 노스페이스", categoryIds: [14, 5] },
  { label: "clothing", search: "파타고니아 자켓", categoryIds: [14, 5] },
];

type DaangnEnv = Record<string, string | undefined>;

export function getDaangnSourceMode(env: DaangnEnv = process.env): DaangnSourceMode {
  const value = String(env.DAANGN_SOURCE_MODE ?? env.MARKET_SOURCE_DAANGN_MODE ?? "").trim().toLowerCase();
  if (value === "active" || value === "probe") return value;
  return "off";
}

export function isDaangnRuntimeEnabled(env: DaangnEnv = process.env): boolean {
  return getDaangnSourceMode(env) === "active";
}

function statusBlockReason(status: number): string | null {
  if (status === 401 || status === 403 || status === 451) return `http_${status}_access_denied`;
  if (status === 429) return "http_429_rate_limited";
  if (status === 503) return "http_503_source_unavailable";
  return null;
}

export function detectDaangnBlockSignal(input: {
  status: number;
  contentType?: string | null;
  bodyPreview?: string | null;
}): DaangnBlockSignal {
  const statusReason = statusBlockReason(input.status);
  if (statusReason) return { blocked: true, reason: statusReason, status: input.status };

  const body = String(input.bodyPreview ?? "").slice(0, 5000).toLowerCase();
  const challengeHits = [
    "captcha",
    "recaptcha",
    "hcaptcha",
    "access denied",
    "too many requests",
    "unusual traffic",
    "비정상적인 접근",
    "자동화된 접근",
    "접근이 제한",
    "요청이 많",
  ];
  const hit = challengeHits.find((token) => body.includes(token));
  if (hit) return { blocked: true, reason: `challenge_${hit.replace(/\s+/g, "_")}`, status: input.status };

  return { blocked: false, reason: null, status: input.status };
}

export async function fetchDaangnText(url: string, timeoutMs = 10_000): Promise<DaangnFetchResult> {
  const res = await fetch(url, {
    headers: DEFAULT_HEADERS,
    redirect: "follow",
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  });
  const contentType = res.headers.get("content-type") ?? "";
  const body = await res.text();
  const blockSignal = detectDaangnBlockSignal({
    status: res.status,
    contentType,
    bodyPreview: body,
  });
  return {
    ok: res.ok && !blockSignal.blocked,
    url: res.url || url,
    status: res.status,
    contentType,
    body,
    blockSignal,
  };
}

export function buildDaangnSearchUrl(input: {
  search?: string | null;      // optional — 없으면 region firehose (Phase 6i)
  regionId?: string | null;
  categoryId?: number | string | null;
}): string {
  const params = new URLSearchParams();
  // region 명시 시: 해당 region 매물 / 없을 때 (실제로는 empty payload — sharding)
  if (input.regionId && input.regionId.trim()) {
    params.set("in", input.regionId.trim());
  }
  // Phase 6i: empty/0 categoryId 시 filter 생략 (전체 카테고리 firehose)
  if (
    input.categoryId != null
    && String(input.categoryId).trim()
    && String(input.categoryId) !== "0"
  ) {
    params.set("category_id", String(input.categoryId).trim());
  }
  // Phase 6i: empty search 시 param 생략 (region firehose 모드 — 키워드 무관 지역 최신 매물 통째).
  if (input.search && input.search.trim()) {
    params.set("search", input.search.trim());
  }
  // Keep the query form, not /kr/buy-sell/s/*, because the latter is disallowed
  // in robots.txt for generic crawlers.
  return `${DAANGN_BASE_URL}/kr/buy-sell/?${params.toString()}`;
}

function decodeHtmlEntity(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function parseRobotsTxt(text: string): { disallow: string[]; sitemaps: string[] } {
  const disallow: string[] = [];
  const sitemaps: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const sitemap = /^sitemap:\s*(.+)$/i.exec(trimmed)?.[1]?.trim();
    if (sitemap) {
      sitemaps.push(sitemap);
      continue;
    }
    const disallowed = /^disallow:\s*(.+)$/i.exec(trimmed)?.[1]?.trim();
    if (disallowed) disallow.push(disallowed);
  }
  return { disallow, sitemaps };
}

export function extractDaangnRemixContext(html: string): RemixContext | null {
  const match = html.replace(/\0/g, "").match(/window\.__remixContext\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!match?.[1]) return null;
  try {
    return JSON.parse(decodeHtmlEntity(match[1])) as RemixContext;
  } catch {
    return null;
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function toDaangnArticle(raw: unknown): DaangnSearchArticle | null {
  const row = objectRecord(raw);
  if (!row) return null;
  const href = stringValue(row.href) ?? stringValue(row.id);
  if (!href) return null;
  const region = objectRecord(row.region) ?? objectRecord(row.regionId);
  const category = objectRecord(row.category);
  const user = objectRecord(row.user);
  return {
    id: stringValue(row.id) ?? href,
    href,
    title: stringValue(row.title),
    price: numberValue(row.price),
    status: stringValue(row.status),
    content: stringValue(row.content),
    thumbnail: stringValue(row.thumbnail),
    createdAt: stringValue(row.createdAt),
    boostedAt: stringValue(row.boostedAt),
    favoriteCount: numberValue(row.favoriteCount),
    chatCount: numberValue(row.chatCount),
    viewCount: numberValue(row.viewCount),
    region: {
      dbId: stringValue(region?.dbId),
      name: stringValue(region?.name),
    },
    category: {
      dbId: stringValue(category?.dbId),
      name: stringValue(category?.name),
    },
    user: {
      dbId: stringValue(user?.dbId),
      nickname: stringValue(user?.nickname),
      webCrawlNotAllowed: booleanValue(user?.webCrawlNotAllowed),
    },
  };
}

function findDaangnSearchLoader(context: RemixContext | null): Record<string, unknown> | null {
  const loaderData = context?.state?.loaderData;
  if (!loaderData) return null;
  return objectRecord(loaderData["routes/kr.buy-sell._index"]);
}

export function parseDaangnSearchHtml(html: string): {
  articles: DaangnSearchArticle[];
  currentFilters: {
    regionId: string | null;
    categoryId: string | null;
    search: string | null;
  };
} {
  const loader = findDaangnSearchLoader(extractDaangnRemixContext(html));
  const allPage = objectRecord(loader?.allPage);
  const rawArticles = Array.isArray(allPage?.fleamarketArticles) ? allPage.fleamarketArticles : [];
  const currentFilters = objectRecord(loader?.currentFilters);
  return {
    articles: rawArticles.map(toDaangnArticle).filter((article): article is DaangnSearchArticle => Boolean(article)),
    currentFilters: {
      regionId: stringValue(currentFilters?.regionId),
      categoryId: stringValue(currentFilters?.categoryId),
      search: stringValue(currentFilters?.search),
    },
  };
}

function findDaangnDetailArticle(context: RemixContext | null): Record<string, unknown> | null {
  const seen = new Set<unknown>();
  const stack: unknown[] = [context];
  while (stack.length) {
    const value = stack.pop();
    if (!value || typeof value !== "object" || seen.has(value)) continue;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const child of value) stack.push(child);
      continue;
    }
    const row = value as Record<string, unknown>;
    if (row.title && row.price && (row.viewCount !== undefined || row.chatCount !== undefined || row.favoriteCount !== undefined)) {
      return row;
    }
    for (const child of Object.values(row)) stack.push(child);
  }
  return null;
}

export function parseDaangnDetailHtml(html: string): DaangnDetailArticle | null {
  const raw = findDaangnDetailArticle(extractDaangnRemixContext(html));
  const base = toDaangnArticle(raw);
  if (!base || !raw) return null;
  const user = objectRecord(raw.user);
  const userRegion = objectRecord(user?.region);
  return {
    ...base,
    user: {
      ...base.user,
      score: numberValue(user?.score),
      reviewCount: numberValue(user?.reviewCount),
      profileImage: stringValue(user?.profileImage),
      regionName: stringValue(userRegion?.name),
    },
    recommendedCount: Array.isArray(raw.recommendedArticles) ? raw.recommendedArticles.length : null,
    commentCount: Array.isArray(raw.comments) ? raw.comments.length : null,
  };
}

function ageHours(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (nowMs - ms) / 3_600_000);
}

export function shouldFetchDaangnDetailCandidate(
  article: DaangnSearchArticle,
  options: {
    activeWindowHours: number;
    nowMs?: number;
  },
): boolean {
  if (article.status !== "Ongoing") return false;
  if (article.user.webCrawlNotAllowed) return false;
  const hours = ageHours(article.boostedAt ?? article.createdAt, options.nowMs ?? Date.now());
  if (hours == null) return false;
  return hours <= options.activeWindowHours;
}

export function summarizeDaangnArticles(
  articles: DaangnSearchArticle[],
  options: {
    freshWindowHours: number;
    activeWindowHours: number;
    staleBoostedDays: number;
    nowMs?: number;
  },
): DaangnSearchSummary {
  const nowMs = options.nowMs ?? Date.now();
  const ongoing = articles.filter((article) => article.status === "Ongoing");
  const crawlAllowedOngoing = ongoing.filter((article) => !article.user.webCrawlNotAllowed);
  const regionCounts = new Map<string, number>();
  for (const article of articles) {
    const key = article.region.name ?? "(unknown)";
    regionCounts.set(key, (regionCounts.get(key) ?? 0) + 1);
  }
  const freshness = (article: DaangnSearchArticle) => ageHours(article.boostedAt ?? article.createdAt, nowMs);
  const sortedOngoing = [...crawlAllowedOngoing].sort((a, b) => {
    const aMs = Date.parse(a.boostedAt ?? a.createdAt ?? "");
    const bMs = Date.parse(b.boostedAt ?? b.createdAt ?? "");
    return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
  });
  const staleHours = options.staleBoostedDays * 24;
  return {
    total: articles.length,
    ongoing: ongoing.length,
    crawlAllowedOngoing: crawlAllowedOngoing.length,
    reserved: articles.filter((article) => article.status === "Reserved").length,
    closed: articles.filter((article) => article.status === "Closed").length,
    freshBoosted24h: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours <= options.freshWindowHours;
    }).length,
    activeBoosted72h: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours <= options.activeWindowHours;
    }).length,
    staleBoostedOverDays: crawlAllowedOngoing.filter((article) => {
      const hours = freshness(article);
      return hours != null && hours > staleHours;
    }).length,
    latestBoostedAt: sortedOngoing[0]?.boostedAt ?? sortedOngoing[0]?.createdAt ?? null,
    regionTop: [...regionCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count })),
    samples: sortedOngoing.slice(0, 5).map((article) => ({
      title: article.title,
      price: article.price,
      boostedAt: article.boostedAt,
      region: article.region.name,
      href: article.href,
      sellerNickname: article.user.nickname,
    })),
  };
}

function sumCombos(combos: DaangnSearchProbeCombo[], key: keyof DaangnSearchSummary): number {
  return combos.reduce((sum, combo) => {
    const value = combo.result[key];
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

export async function probeDaangnPublicSource(options: DaangnProbeOptions = {}): Promise<DaangnProbeReport> {
  const mode = options.mode ?? getDaangnSourceMode();
  const nowMs = Date.now();
  const freshWindowHours = options.freshWindowHours ?? 24;
  const activeWindowHours = options.activeWindowHours ?? 72;
  const staleBoostedDays = options.staleBoostedDays ?? 21;
  const delayMs = options.delayMs ?? 650;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const regions = options.regions?.length ? options.regions : DEFAULT_DAANGN_REGION_SEEDS;
  const categories = options.categories?.length ? options.categories : DAANGN_FASHION_CATEGORIES;
  const queries = options.queries?.length ? options.queries : DEFAULT_DAANGN_FASHION_QUERY_SEEDS;
  const maxCombos = Math.max(0, options.maxCombos ?? 18);

  const robotsResult = await fetchDaangnText(DAANGN_ROBOTS_URL, timeoutMs);
  const robotsParsed = robotsResult.ok ? parseRobotsTxt(robotsResult.body) : { disallow: [], sitemaps: [] };

  const combosToRun: Array<{ region: DaangnRegionSeed; query: DaangnQuerySeed; category: DaangnCategorySeed }> = [];
  for (const region of regions) {
    for (const query of queries) {
      for (const categoryId of query.categoryIds) {
        const category = categories.find((entry) => entry.id === categoryId);
        if (!category) continue;
        combosToRun.push({ region, query, category });
      }
    }
  }

  const combos: DaangnSearchProbeCombo[] = [];
  const detailCandidates = new Map<string, DaangnSearchArticle>();
  const uniqueOngoingUrls = new Set<string>();
  for (const combo of combosToRun.slice(0, maxCombos)) {
    if (combos.length > 0 && delayMs > 0) await sleep(delayMs);
    const url = buildDaangnSearchUrl({
      regionId: combo.region.id,
      search: combo.query.search,
      categoryId: combo.category.id,
    });
    const fetched = await fetchDaangnText(url, timeoutMs);
    const parsed = fetched.ok ? parseDaangnSearchHtml(fetched.body) : {
      articles: [],
      currentFilters: { regionId: null, categoryId: null, search: null },
    };
    const result = summarizeDaangnArticles(parsed.articles, {
      freshWindowHours,
      activeWindowHours,
      staleBoostedDays,
      nowMs,
    });
    for (const article of parsed.articles) {
      if (article.status === "Ongoing" && !article.user.webCrawlNotAllowed) {
        uniqueOngoingUrls.add(article.href);
      }
    }
    for (const article of parsed.articles) {
      if (!shouldFetchDaangnDetailCandidate(article, { activeWindowHours, nowMs })) continue;
      detailCandidates.set(article.href, article);
    }
    combos.push({
      ...combo,
      url,
      ok: fetched.ok,
      status: fetched.status,
      blockSignal: fetched.blockSignal,
      currentFilters: parsed.currentFilters,
      result,
    });
  }

  const detailSamples: DaangnDetailArticle[] = [];
  for (const article of [...detailCandidates.values()].slice(0, Math.max(0, options.maxDetailSamples ?? 5))) {
    if (detailSamples.length > 0 && delayMs > 0) await sleep(delayMs);
    const fetched = await fetchDaangnText(article.href, timeoutMs);
    if (!fetched.ok) continue;
    const detail = parseDaangnDetailHtml(fetched.body);
    if (detail) detailSamples.push(detail);
  }

  const blockedCombos = combos.filter((combo) => combo.blockSignal.blocked).length;
  const failedCombos = combos.filter((combo) => !combo.ok).length;
  const shouldStop = robotsResult.blockSignal.blocked || blockedCombos > 0 || (combos.length > 0 && failedCombos === combos.length);

  return {
    source: DAANGN_SOURCE_ID,
    mode,
    writable: false,
    robots: {
      ok: robotsResult.ok,
      status: robotsResult.status,
      disallow: robotsParsed.disallow,
      sitemaps: robotsParsed.sitemaps,
      blockSignal: robotsResult.blockSignal,
      note: "Probe uses /kr/buy-sell/?query form and does not call /kr/buy-sell/s/*.",
    },
    searchedAt: new Date(nowMs).toISOString(),
    probe: {
      regions,
      queries,
      categories,
      requestedCombos: combosToRun.length,
      executedCombos: combos.length,
      delayMs,
      freshWindowHours,
      activeWindowHours,
      staleBoostedDays,
    },
    totals: {
      articles: sumCombos(combos, "total"),
      ongoing: sumCombos(combos, "ongoing"),
      crawlAllowedOngoing: sumCombos(combos, "crawlAllowedOngoing"),
      freshBoosted24h: sumCombos(combos, "freshBoosted24h"),
      activeBoosted72h: sumCombos(combos, "activeBoosted72h"),
      uniqueOngoingUrls: uniqueOngoingUrls.size,
      detailSamplesFetched: detailSamples.length,
      blockedCombos,
      failedCombos,
    },
    combos,
    detailSamples,
    cadenceRecommendation: [
      "Use boostedAt as the primary poll cursor; createdAt is secondary because sellers frequently bump old listings.",
      "Fetch detail only for Ongoing + crawl-allowed + active-window search hits; search pages include many Closed rows.",
      "Poll hot fashion seeds every 15-30 minutes only after low-rate soak; cold seeds can run every 2-4 hours.",
      "Treat Danggeun as direct-trade-first: expose region before credit reveal and do not assume shipping unless text says so.",
    ],
    decision: mode === "off" ? "disabled" : shouldStop ? "stop_on_block_or_error" : "source_safe_to_continue_probe_only",
  };
}
