// P2-1: query별 yield-based cadence 결정 로직 (simulator/runtime 공유).
// simulator(scripts/report-query-cadence-simulator.mjs)와 runtime housekeeper의
// evaluateSearchQueryCadences가 같은 로직을 쓰도록 단일 소스.

export type CategoryReadinessStatus = "ready" | "internal_only" | "blocked";

export type QueryYieldRow = {
  query: string;
  family: string;
  observed: number;
  changed: number;
  active: number;
  normalType: number;
  detailsPending: number;
  detailsDone: number;
  poolAny: number;
  poolReady: number;
  poolReserved: number;
  poolSpent: number;
};

export type CadenceDecision = {
  cadenceMinutes: number;
  cadence: "5m" | "10m" | "30m" | "60m";
  reason: string;
  mode: "harvest" | "gather";
  keepFresh: boolean;
};

// Wave 88: "category:<L2 id>" sweep query → 카테고리 family 직접 매핑.
// bunjang.ts CATEGORY_QUERY_PREFIX와 같이 사용.
const CATEGORY_SWEEP_FAMILY: Record<string, string> = {
  "600100": "laptop",
  "600300": "camera",
  "600500": "earphone",       // 오디오/영상 — 헤드폰/이어폰/스피커 흡수
  "600600": "game_console",
  "600700": "smartphone",
  "600710": "tablet",
  "600720": "smartwatch",
  "421":    "watch",
  "610":    "home_appliance",
  "700600": "sport_golf",
  // Wave 91 (2026-05-15)
  "405":    "shoe",
  "430":    "bag",
  "700350": "bike",           // 자전거 sub (700 broad는 골프/수영/발레 등 noise → 700350 narrow)
};

export function queryFamily(query: string): string {
  const q = String(query ?? "");
  if (q.startsWith("category:")) {
    const id = q.slice("category:".length).trim();
    return CATEGORY_SWEEP_FAMILY[id] ?? "unknown";
  }
  const lower = q.toLowerCase();
  if (lower.includes("에어팟")) return "earphone";
  // Wave 187 가민 — "가민 페닉스"/"forerunner" 등 → smartwatch (워치 시리즈는 별도 단어 안 들어감)
  if (
    lower.includes("가민") || lower.includes("garmin") ||
    lower.includes("페닉스") || lower.includes("피닉스") || lower.includes("fenix") ||
    lower.includes("포러너") || lower.includes("forerunner") ||
    lower.includes("인스팅트") || lower.includes("instinct") ||
    lower.includes("비누") || lower.includes("venu") ||
    lower.includes("에픽스") || lower.includes("epix") ||
    lower.includes("워치")
  ) return "smartwatch";
  if (lower.includes("아이폰") || lower.includes("갤럭시 s")) return "smartphone";
  if (lower.includes("아이패드") || lower.includes("갤럭시탭")) return "tablet";
  if (lower.includes("맥북")) return "laptop";
  // Wave 189 (2026-05-18): 신규 카테고리 매핑 추가 (drone/lego/kickboard/perfume).
  //   queryFamily 분류 누락 → 1,054 query "unknown" 매핑 → 카테고리별 cadence 최적화 + 대시보드 정확도 손실.
  if (
    lower.includes("dji") || lower.includes("디제이아이") ||
    lower.includes("mini ") || lower.includes("미니 ") ||
    lower.includes("mavic") || lower.includes("매빅") ||
    lower.includes("avata") || lower.includes("아바타") ||
    lower.includes("osmo") || lower.includes("오즈모") ||
    lower.includes("gopro") || lower.includes("고프로") ||
    lower.includes("hero") || lower.includes("히어로") ||
    lower.includes("드론")
  ) return "drone";
  if (lower.includes("lego") || lower.includes("레고") || lower.includes("ucs")) return "lego";
  if (
    lower.includes("샤오미 미 스쿠터") || lower.includes("샤오미 스쿠터") ||
    lower.includes("xiaomi mi scooter") || lower.includes("mi scooter") ||
    lower.includes("ninebot") || lower.includes("닌봇") ||
    lower.includes("세그웨이") || lower.includes("segway") ||
    lower.includes("킥보드") || lower.includes("전동킥보드") ||
    lower.includes("electric scooter")
  ) return "kickboard";
  if (
    lower.includes("조 말론") || lower.includes("jo malone") ||
    lower.includes("르 라보") || lower.includes("le labo") ||
    lower.includes("딥디크") || lower.includes("diptyque") ||
    lower.includes("톰 포드") || lower.includes("tom ford") ||
    lower.includes("replica") || lower.includes("리플리카") ||
    lower.includes("memo") || lower.includes("메모 파리") ||
    lower.includes("향수")
  ) return "perfume";
  // Wave 189: Dyson / Panasonic / Cyaars / BaByliss 헤어 기기 → home_appliance
  if (
    lower.includes("다이슨") || lower.includes("dyson") ||
    lower.includes("에어랩") || lower.includes("airwrap") ||
    lower.includes("슈퍼소닉") || lower.includes("supersonic") ||
    lower.includes("코랄") || lower.includes("corrale") ||
    lower.includes("파나소닉") || lower.includes("panasonic") ||
    lower.includes("babyliss") || lower.includes("바비리스") ||
    lower.includes("cyaars") || lower.includes("씨아스")
  ) return "home_appliance";
  // 갤럭시 북 — laptop
  if (lower.includes("갤럭시 북") || lower.includes("galaxy book") || lower.includes("갤럭시북")) return "laptop";
  // Wave 198 (2026-05-18): 의류 brand 매핑 — Polo / TNF / Stüssy 시그니처 + collab.
  //   raw 7d sweep: Polo 419건 / TNF 153건 / Stussy 195건. Nike×Stussy 109건 (압도적 collab).
  // Wave 199 (2026-05-18): Tier 2 brand 추가 — 라코스테 / 아더에러.
  if (
    lower.includes("폴로") || lower.includes("ralph lauren") || lower.includes("랄프로렌") ||
    lower.includes("rrl") || lower.includes("더블 알엘") ||
    lower.includes("노스페이스") || lower.includes("north face") || lower.includes("tnf") ||
    lower.includes("눕시") || lower.includes("nuptse") ||
    lower.includes("denali") || lower.includes("데날리") ||
    lower.includes("mountain jacket") || lower.includes("마운틴 자켓") ||
    lower.includes("nanamica") || lower.includes("나나미카") || lower.includes("퍼플라벨") ||
    lower.includes("stussy") || lower.includes("스투시") || lower.includes("stüssy") ||
    lower.includes("8 ball") || lower.includes("8ball") ||
    lower.includes("world tour") || lower.includes("월드투어") ||
    lower.includes("라코스테") || lower.includes("lacoste") ||
    // Wave 200: 꼼데가르송 (Comme des Garcons / CDG)
    lower.includes("꼼데") || lower.includes("comme des garcons") || lower.includes("commedesgarcons") || lower.includes("cdg ") ||
    // Wave 202: 룰루레몬 (의류 + 가방)
    lower.includes("룰루레몬") || lower.includes("lululemon") ||
    // Wave 203: 마르지엘라 / MM6 (의류 broad)
    lower.includes("mm6") || lower.includes("엠엠식스") ||
    (lower.includes("마르지엘라") && !lower.includes("타비") && !lower.includes("tabi") && !lower.includes("salomon") && !lower.includes("살로몬") && !lower.includes("글램슬램")) ||
    // Wave 214: 추가 의류 mainstream — BAPE/마뗑킴/리복 의류/아크테릭스/휠라/파타고니아/MLB/디스커버리
    lower.includes("bape") || lower.includes("베이프") || lower.includes("a bathing ape") ||
    lower.includes("matin kim") || lower.includes("마뗑킴") || lower.includes("마틴킴") ||
    lower.includes("arcteryx") || lower.includes("arc'teryx") || lower.includes("아크테릭스") ||
    lower.includes("patagonia") || lower.includes("파타고니아") ||
    lower.includes("discovery expedition") || lower.includes("디스커버리 익스페디션") ||
    (lower.includes("reebok") && !lower.includes("운동화") && !lower.includes("스니커즈")) ||
    (lower.includes("리복") && !lower.includes("운동화") && !lower.includes("스니커즈")) ||
    (lower.includes("fila") && !lower.includes("디스럽터")) ||
    (lower.includes("휠라") && !lower.includes("디스럽터")) ||
    lower.includes("mlb 모자") || lower.includes("mlb cap")
  ) return "clothing";
  // Wave 202: 신발 brand 매핑 (On Running / Birkenstock)
  // Wave 205: 크록스 / 아크네 신발 추가
  if (
    lower.includes("온러닝") || lower.includes("on running") ||
    lower.includes("클라우드 몬스터") || lower.includes("cloud monster") ||
    lower.includes("cloudsurfer") || lower.includes("클라우드서퍼") || lower.includes("클라우드 서퍼") ||
    lower.includes("버켄스탁") || lower.includes("birkenstock") ||
    lower.includes("보스턴") || lower.includes("아리조나") || lower.includes("취리히") || lower.includes("zurich") || lower.includes("zürich") ||
    lower.includes("크록스") || lower.includes("crocs") ||
    lower.includes("바야밴드") || lower.includes("bayaband") ||
    (lower.includes("아크네") && (lower.includes("트리플로") || lower.includes("triplo") || lower.includes("베르틴") || lower.includes("bertin"))) ||
    // Wave 215: Yeezy / BAPE STA
    (lower.includes("yeezy") && !lower.includes("이지페이") && !lower.includes("이지카")) ||
    lower.includes("이지 부스트") || lower.includes("이지 슬라이드") || lower.includes("이지 폼") ||
    lower.includes("bape sta") || lower.includes("bapesta") || lower.includes("베이프스타") ||
    // Wave 206: 푸마 신발
    lower.includes("푸마") || lower.includes("퓨마") || lower.includes("puma ") ||
    lower.includes("스피드캣") || lower.includes("speedcat") ||
    lower.includes("팔레르모") || lower.includes("palermo") ||
    // Wave 207: 미즈노 축구화/풋살화
    lower.includes("미즈노") || lower.includes("mizuno") ||
    lower.includes("모렐리아") || lower.includes("morelia") ||
    (lower.includes("알파") && (lower.includes("재팬") || lower.includes("jpn") || lower.includes("ag ") || lower.includes("tf "))) ||
    lower.includes("모나르시다") || lower.includes("monarcida") ||
    // Wave 208: 살로몬
    lower.includes("salomon") || lower.includes("살로몬") ||
    lower.includes("xt-6") || lower.includes("xt 6") ||
    lower.includes("xa pro") || lower.includes("xa-pro") || lower.includes("xa프로") ||
    lower.includes("acs pro") || lower.includes("스피드크로스") || lower.includes("speedcross") ||
    // Wave 209: 아식스
    lower.includes("아식스") || lower.includes("asics") ||
    lower.includes("gel-1130") || lower.includes("gel 1130") || lower.includes("젤-1130") || lower.includes("젤 1130") ||
    lower.includes("kayano") || lower.includes("카야노") || lower.includes("nimbus") || lower.includes("님버스") ||
    lower.includes("novablast") || lower.includes("노바블라스트") ||
    // Wave 210: 호카 / FOG
    lower.includes("호카") || lower.includes("hoka") ||
    lower.includes("마파테") || lower.includes("mafate") ||
    lower.includes("anacapa") || lower.includes("아나카파") ||
    lower.includes("피어 오브 갓") || lower.includes("피어오브갓") || lower.includes("피오갓") || lower.includes("fear of god") || lower.includes("fog ") ||
    lower.includes("champion") || lower.includes("챔피온")
  ) return "shoe";
  // 가방 (TNF 백팩) — bag
  if (
    lower.includes("borealis") || lower.includes("보레알리스") ||
    lower.includes("hot shot") || lower.includes("hotshot") || lower.includes("핫샷") ||
    lower.includes("big shot") || lower.includes("bigshot") || lower.includes("빅샷")
  ) return "bag";
  // Wave 194 (2026-05-18): 신발 / 가방 brand 매핑 — 이전엔 모두 unknown fallback.
  //   shoe category=1 query만 등록되어 통계/대시보드 misleading. 운영 가시성 ↑ 목적 (cosmetic).
  if (
    lower.includes("나이키") || lower.includes("nike") ||
    lower.includes("아디다스") || lower.includes("adidas") ||
    lower.includes("뉴발란스") || lower.includes("new balance") || lower.includes("newbalance") ||
    lower.includes("컨버스") || lower.includes("converse") || lower.includes("척테일러") || lower.includes("척70") || lower.includes("chuck") ||
    lower.includes("닥터마틴") || lower.includes("dr.martens") || lower.includes("dr martens") || lower.includes("doc martens") ||
    lower.includes("조던") || lower.includes("jordan") || lower.includes("aj1") || lower.includes("aj4") ||
    lower.includes("yeezy") || lower.includes("이지") ||
    lower.includes("호카") || lower.includes("hoka") || lower.includes("클리프턴") ||
    lower.includes("페가수스") || lower.includes("pegasus") || lower.includes("베이퍼플라이") || lower.includes("vaporfly") ||
    lower.includes("덩크") || lower.includes("dunk") ||
    lower.includes("에어포스") || lower.includes("airforce") || lower.includes("air force") ||
    lower.includes("삼바") || lower.includes("samba") || lower.includes("가젤") || lower.includes("gazelle") ||
    lower.includes("토바코") || lower.includes("tobacco") ||
    lower.includes("스탠스미스") || lower.includes("stan smith") || lower.includes("슈퍼스타") || lower.includes("superstar") ||
    lower.includes("코르테즈") || lower.includes("cortez") || lower.includes("블레이저") || lower.includes("blazer") ||
    lower.includes("스니커즈") || lower.includes("sneakers") ||
    lower.includes("운동화") || lower.includes("신발")
  ) return "shoe";
  if (
    lower.includes("루이비통") || lower.includes("louis vuitton") || lower.includes("lv ") ||
    lower.includes("구찌") || lower.includes("gucci") ||
    lower.includes("샤넬") || lower.includes("chanel") ||
    lower.includes("프라다") || lower.includes("prada") ||
    lower.includes("디올") || lower.includes("dior") ||
    lower.includes("생로랑") || lower.includes("saint laurent") || lower.includes("ysl") ||
    lower.includes("로에베") || lower.includes("loewe") ||
    lower.includes("발렌시아가") || lower.includes("balenciaga") ||
    lower.includes("토트백") || lower.includes("크로스백") || lower.includes("숄더백") || lower.includes("백팩")
  ) return "bag";
  return "unknown";
}

export function cadenceMinutesFromLabel(label: CadenceDecision["cadence"]): number {
  if (label === "5m") return 5;
  if (label === "10m") return 10;
  if (label === "30m") return 30;
  return 60;
}

export function costMultiplier(cadence: CadenceDecision["cadence"]): number {
  if (cadence === "5m") return 1;
  if (cadence === "10m") return 0.5;
  if (cadence === "30m") return 1 / 6;
  if (cadence === "60m") return 1 / 12;
  return 1;
}

/**
 * Query별 yield로 cadence를 결정한다.
 * - readiness !== 'ready' 또는 unknown family → mode='gather' + cadence='5m' 강제(downrank 면제).
 *   표본 부족 카테고리가 영영 못 자라는 악순환 방지.
 * - readiness='ready' 카테고리만 yield 기반 downrank(=harvest) 적용.
 * - 같은 query가 ready 기여 시작하면 자동 재평가에서 5m으로 승격됨.
 */
export function decideCadence(
  row: QueryYieldRow,
  readiness: { status: CategoryReadinessStatus } | null,
): CadenceDecision {
  // Wave 88: category sweep query는 yield와 무관하게 5m harvest 고정.
  // 광범위한 매물 흡수가 목적이라 readyRate 낮아도 downrank하면 안 됨.
  if (row.query.startsWith("category:")) {
    return {
      cadenceMinutes: 5,
      cadence: "5m",
      reason: "category_sweep_breadth_collect",
      mode: "harvest",
      keepFresh: true,
    };
  }
  const readyRate = row.observed ? row.poolReady / row.observed : 0;
  const poolRate = row.observed ? row.poolAny / row.observed : 0;
  const changeRate = row.observed ? row.changed / row.observed : 0;
  const family = row.family;
  const isHarvestable = readiness?.status === "ready";

  if (row.poolReady >= 2 || readyRate >= 0.0015) {
    return {
      cadenceMinutes: 5,
      cadence: "5m",
      reason: "ready_pool_yield",
      mode: "harvest",
      keepFresh: true,
    };
  }
  if ((family === "earphone" || family === "smartwatch") && row.poolAny > 0) {
    return {
      cadenceMinutes: 10,
      cadence: "10m",
      reason: "ready_family_pool_presence",
      mode: "harvest",
      keepFresh: true,
    };
  }

  if (!isHarvestable) {
    const status = readiness?.status ?? "unknown";
    return {
      cadenceMinutes: 5,
      cadence: "5m",
      reason: `gather_readiness=${status}`,
      mode: "gather",
      keepFresh: true,
    };
  }

  if (row.poolAny > 0 || poolRate >= 0.001 || changeRate >= 0.02) {
    return {
      cadenceMinutes: 30,
      cadence: "30m",
      reason: row.poolAny > 0 ? "some_pool_or_candidate_signal" : "high_change_rate",
      mode: "harvest",
      keepFresh: false,
    };
  }

  return {
    cadenceMinutes: 60,
    cadence: "60m",
    reason: "low_yield_broad_or_internal",
    mode: "harvest",
    keepFresh: false,
  };
}
