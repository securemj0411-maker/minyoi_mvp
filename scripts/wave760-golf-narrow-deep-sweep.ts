// Wave 760 (2026-05-24): 골프 narrow deep sweep.
// Wave 759 follow-up — 같은 brand × type SKU 내 가격 차이 큰 세분화 찾기.
//
// 사용자 핵심 지적:
//   - 가격 차이 큰 세분화 안 측정 (Stealth1 vs Stealth2 vs Qi10)
//   - 남/여 가격 차이 안 측정
//   - 샤프트 (스틸 vs 그라파이트) 안 측정
//   - 사용감 / condition keyword 분석 X ← 핵심
//
// 추가 분석:
//   a. Sub-model 추출 (Stealth, SIM, Qi10, M2, M4, M6, R7, G410, G430, TSR2, TSR3 etc)
//   b. Loft 추출 ("9도", "10.5도", etc)
//   c. Shaft 추출 (스틸, 그라파이트, 투어 AD, 디아마나, 벤투스 etc)
//   d. Generation/Year (Stealth2, Qi10, 1세대, 2세대)
//   e. Men's/Women's (남성용, 여성용, L/S/R flex)
//   f. Condition (새제품, 미개봉, S급, A급, B급, C급, 사용감, 흠집, 데미지 etc)
//
// Wave 759 v3 lessons applied:
//   - ruleMatch 호출 X (CPU busy loop 방지)
//   - process.stderr 로 progress log (5 queries마다)
//   - Incremental save (15 queries마다)
//   - 8s timeout per fetch

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchPage, type SearchItem } from "@/lib/bunjang";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");

const GOLF_BRANDS = [
  "캘러웨이", "타이틀리스트", "테일러메이드", "PXG", "핑", "마제스티",
  "혼마", "미즈노 골프", "스릭슨", "브리지스톤 골프", "젝시오", "오노프",
  "스코티 카메론", "오디세이", "코브라 골프",
];
const GOLF_PRODUCT_TYPES = ["드라이버", "아이언", "우드", "퍼터", "웨지", "하이브리드", "클럽 세트"];
const GENERIC_QUERIES = [
  "골프 드라이버", "골프 아이언", "골프 우드", "골프 퍼터", "골프 웨지",
  "골프 클럽 세트", "골프 하이브리드", "골프 풀세트", "골프 클럽",
];

type Record = {
  pid: string;
  name: string;
  price: number;
  query: string;
  brand: string | null;
  productType: string | null;
  subModel: string | null;
  loft: string | null;
  shaft: string | null;
  generation: string | null;
  sex: string | null;
  flex: string | null;
  condition: string | null;
};

function log(msg: string) {
  process.stderr.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

function extractBrand(title: string): string | null {
  const t = title.toLowerCase();
  if (/타이틀리스트|titleist/.test(t)) return "Titleist";
  if (/캘러웨이|callaway/.test(t)) return "Callaway";
  if (/테일러메이드|taylormade/.test(t)) return "TaylorMade";
  if (/pxg/.test(t)) return "PXG";
  if (/마제스티|majesty/.test(t)) return "Majesty";
  if (/혼마|honma/.test(t)) return "Honma";
  if (/스릭슨|srixon/.test(t)) return "Srixon";
  if (/브리지스톤|bridgestone/.test(t)) return "Bridgestone";
  if (/젝시오|xxio/.test(t)) return "XXIO";
  if (/오노프|onoff/.test(t)) return "Onoff";
  if (/스코티\s*카메론|scotty\s*cameron/.test(t)) return "Scotty Cameron";
  if (/오디세이|odyssey/.test(t)) return "Odyssey";
  if (/코브라|cobra/.test(t)) return "Cobra";
  if (/미즈노/.test(t) && /골프|아이언|드라이버|우드|퍼터|웨지/.test(t)) return "Mizuno";
  if (/요넥스|yonex/.test(t)) return "Yonex";
  if (/포틴|fourteen/.test(t)) return "Fourteen";
  if (/엔진|engine/.test(t) && /골프|퍼터/.test(t)) return "Engine";
  if (/prgr|프로기어/.test(t)) return "PRGR";
  if (/^핑\s|핑\s+골프|\sping\s|핑\s*g\d|핑\s*i\d/.test(t)) return "Ping";
  if (/아담스|adams/.test(t)) return "Adams";
  if (/클리블랜드|cleveland/.test(t)) return "Cleveland";
  if (/벤호건|ben\s*hogan/.test(t)) return "Ben Hogan";
  if (/볼빅|volvik/.test(t)) return "Volvik";
  return null;
}

function extractProductType(title: string): string | null {
  const t = title.toLowerCase();
  if (/드라이버|driver|1번우드/.test(t)) return "driver";
  if (/아이언/.test(t) && !/우드|드라이버|퍼터|웨지|하이브리드/.test(t)) return "iron";
  if (/페어웨이\s*우드|fairway\s*wood|5번우드|3번우드/.test(t)) return "fairway_wood";
  if (/하이브리드|hybrid|유틸리티|utility/.test(t)) return "hybrid";
  if (/퍼터|putter/.test(t)) return "putter";
  if (/웨지|wedge|sw\b|pw\b|gw\b|aw\b/.test(t)) return "wedge";
  if (/클럽\s*세트|full\s*set|풀세트|풀\s*세트|하프\s*세트|half\s*set/.test(t)) return "set";
  if (/우드/.test(t)) return "wood_other";
  if (/샤프트|shaft/.test(t)) return "shaft";
  return null;
}

// Sub-model extraction. 매물에 흔히 등장하는 모델 코드.
function extractSubModel(title: string, brand: string | null): string | null {
  const t = title.toLowerCase();
  // TaylorMade
  if (brand === "TaylorMade") {
    if (/qi35|qi\s*35/.test(t)) return "Qi35";
    if (/qi10/.test(t)) return "Qi10";
    if (/stealth\s*2|스텔스\s*2|스텔스2/.test(t)) return "Stealth2";
    if (/stealth|스텔스/.test(t)) return "Stealth";
    if (/sim\s*2|심\s*2|심2/.test(t)) return "SIM2";
    if (/sim|심맥스|심2맥스|심맥|\bsim\b/.test(t)) return "SIM";
    if (/m6/.test(t)) return "M6";
    if (/m5/.test(t)) return "M5";
    if (/m4/.test(t)) return "M4";
    if (/m3/.test(t)) return "M3";
    if (/m2/.test(t)) return "M2";
    if (/m1/.test(t)) return "M1";
    if (/r1\b|\sr1\s/.test(t)) return "R1";
    if (/r9|r 9/.test(t)) return "R9";
    if (/r7/.test(t)) return "R7";
    if (/r11/.test(t)) return "R11";
    if (/r15/.test(t)) return "R15";
    if (/버너|burner/.test(t)) return "Burner";
    if (/p7/.test(t)) return "P7";
    if (/p770/.test(t)) return "P770";
    if (/p790/.test(t)) return "P790";
    if (/스파이더|spider/.test(t)) return "Spider";
    return null;
  }
  // Callaway
  if (brand === "Callaway") {
    if (/엘리트|elyte/.test(t)) return "Elyte";
    if (/패러다임|paradym/.test(t)) return "Paradym";
    if (/에픽|epic/.test(t)) return "Epic";
    if (/로그|rogue/.test(t)) return "Rogue";
    if (/마브릭|mavrik/.test(t)) return "Mavrik";
    if (/빅버사|big\s*bertha|그레이트빅버사/.test(t)) return "BigBertha";
    if (/ai\s*스모크|ai-?smoke/.test(t)) return "AiSmoke";
    if (/엑스알|xr/.test(t)) return "XR";
    if (/레가시/.test(t)) return "Legacy";
    if (/스틸헤드|steelhead/.test(t)) return "Steelhead";
    if (/아펙스|apex/.test(t)) return "Apex";
    if (/오디세이|odyssey/.test(t)) return "Odyssey";
    if (/포지드|forged/.test(t)) return "Forged";
    return null;
  }
  // Titleist
  if (brand === "Titleist") {
    if (/gt3/.test(t)) return "GT3";
    if (/gt2/.test(t)) return "GT2";
    if (/gt1/.test(t)) return "GT1";
    if (/tsr3/.test(t)) return "TSR3";
    if (/tsr2/.test(t)) return "TSR2";
    if (/tsr1/.test(t)) return "TSR1";
    if (/tsi3/.test(t)) return "TSi3";
    if (/tsi2/.test(t)) return "TSi2";
    if (/tsi1/.test(t)) return "TSi1";
    if (/ts3/.test(t)) return "TS3";
    if (/ts2/.test(t)) return "TS2";
    if (/917/.test(t)) return "917";
    if (/915/.test(t)) return "915";
    if (/913/.test(t)) return "913";
    if (/910/.test(t)) return "910";
    if (/ap3/.test(t)) return "AP3";
    if (/ap2/.test(t)) return "AP2";
    if (/ap1/.test(t)) return "AP1";
    if (/t100/.test(t)) return "T100";
    if (/t200/.test(t)) return "T200";
    if (/t300/.test(t)) return "T300";
    if (/스카티|벨로키|뉴포트|뉴포트2/.test(t)) return "Scotty";
    if (/보키|vokey/.test(t)) return "Vokey";
    return null;
  }
  // Ping
  if (brand === "Ping") {
    if (/g440/.test(t)) return "G440";
    if (/g430/.test(t)) return "G430";
    if (/g425/.test(t)) return "G425";
    if (/g410/.test(t)) return "G410";
    if (/g400/.test(t)) return "G400";
    if (/g30/.test(t)) return "G30";
    if (/g25/.test(t)) return "G25";
    if (/g20/.test(t)) return "G20";
    if (/g15/.test(t)) return "G15";
    if (/g10/.test(t)) return "G10";
    if (/g700/.test(t)) return "G700";
    if (/g710/.test(t)) return "G710";
    if (/i500/.test(t)) return "i500";
    if (/i59/.test(t)) return "i59";
    if (/k15/.test(t)) return "K15";
    if (/i\s*210|i210/.test(t)) return "i210";
    if (/i\s*230|i230/.test(t)) return "i230";
    if (/blueprint/.test(t)) return "Blueprint";
    return null;
  }
  // PXG
  if (brand === "PXG") {
    if (/0211/.test(t)) return "0211";
    if (/0311\s*xp/.test(t)) return "0311XP";
    if (/0311\s*p/.test(t)) return "0311P";
    if (/0311\s*sgi/.test(t)) return "0311SGI";
    if (/0311\s*x/.test(t)) return "0311X";
    if (/0311\s*t/.test(t)) return "0311T";
    if (/0311/.test(t)) return "0311";
    if (/black\s*ops|블랙\s*옵스/.test(t)) return "BlackOps";
    if (/0317/.test(t)) return "0317";
    if (/배틀레디|battle\s*ready/.test(t)) return "BattleReady";
    if (/머스탱|mustang/.test(t)) return "Mustang";
    return null;
  }
  // Honma
  if (brand === "Honma") {
    if (/베레스|beres/.test(t)) return "Beres";
    if (/투어월드|tour\s*world|tw/.test(t)) return "TourWorld";
    if (/xp-?1/.test(t)) return "XP-1";
    if (/xp-?2/.test(t)) return "XP-2";
    return null;
  }
  // XXIO
  if (brand === "XXIO") {
    if (/젝시오\s*13|xxio\s*13/.test(t)) return "XXIO13";
    if (/젝시오\s*12|xxio\s*12/.test(t)) return "XXIO12";
    if (/젝시오\s*11|xxio\s*11/.test(t)) return "XXIO11";
    if (/젝시오\s*10|xxio\s*10/.test(t)) return "XXIO10";
    if (/젝시오\s*9|xxio\s*9/.test(t)) return "XXIO9";
    if (/젝시오\s*8|xxio\s*8/.test(t)) return "XXIO8";
    if (/mp500/.test(t)) return "MP500";
    if (/mp400/.test(t)) return "MP400";
    if (/mp300/.test(t)) return "MP300";
    if (/mp200/.test(t)) return "MP200";
    if (/mp100/.test(t)) return "MP100";
    if (/prime/.test(t)) return "Prime";
    return null;
  }
  // Srixon
  if (brand === "Srixon") {
    if (/zx7/.test(t)) return "ZX7";
    if (/zx5/.test(t)) return "ZX5";
    if (/zx4/.test(t)) return "ZX4";
    if (/zx\b/.test(t)) return "ZX";
    if (/z785/.test(t)) return "Z785";
    if (/z765/.test(t)) return "Z765";
    if (/z745/.test(t)) return "Z745";
    if (/z725/.test(t)) return "Z725";
    if (/z565/.test(t)) return "Z565";
    if (/z545/.test(t)) return "Z545";
    if (/z355/.test(t)) return "Z355";
    return null;
  }
  // Mizuno
  if (brand === "Mizuno") {
    if (/jpx\s*923/.test(t)) return "JPX923";
    if (/jpx\s*921/.test(t)) return "JPX921";
    if (/jpx\s*919/.test(t)) return "JPX919";
    if (/jpx\s*900/.test(t)) return "JPX900";
    if (/jpx\s*850/.test(t)) return "JPX850";
    if (/jpx\s*825/.test(t)) return "JPX825";
    if (/jpx\s*800/.test(t)) return "JPX800";
    if (/jpx\s*ez/.test(t)) return "JPXEZ";
    if (/jpx\s*e\d/.test(t)) return "JPXE";
    if (/mp-?20/.test(t)) return "MP20";
    if (/mp-?5/.test(t)) return "MP5";
    if (/mp-?15/.test(t)) return "MP15";
    if (/pro\s*22/.test(t)) return "Pro22";
    return null;
  }
  // Bridgestone
  if (brand === "Bridgestone") {
    if (/v300/.test(t)) return "V300";
    if (/v500/.test(t)) return "V500";
    if (/b1\b/.test(t)) return "B1";
    if (/b2\b/.test(t)) return "B2";
    if (/b3\b/.test(t)) return "B3";
    if (/jgr/.test(t)) return "JGR";
    if (/201cb|201\s*cb/.test(t)) return "201CB";
    if (/tour\s*b/.test(t)) return "TourB";
    return null;
  }
  // Scotty Cameron — putter focused
  if (brand === "Scotty Cameron") {
    if (/뉴포트\s*2|newport\s*2/.test(t)) return "Newport2";
    if (/뉴포트|newport/.test(t)) return "Newport";
    if (/팬텀|phantom/.test(t)) return "Phantom";
    if (/슈퍼\s*셀렉트|super\s*select/.test(t)) return "SuperSelect";
    if (/스페셜\s*셀렉트|special\s*select/.test(t)) return "SpecialSelect";
    if (/팻소|fatso/.test(t)) return "Fatso";
    if (/투어\s*프로토|tour\s*proto/.test(t)) return "TourPrototype";
    return null;
  }
  // Odyssey — putter focused
  if (brand === "Odyssey") {
    if (/화이트핫|white\s*hot/.test(t)) return "WhiteHot";
    if (/베르사|versa/.test(t)) return "Versa";
    if (/ai-?one|ai\s*one/.test(t)) return "AiOne";
    if (/2볼|2-?ball/.test(t)) return "2Ball";
    if (/오웍스|o-?works/.test(t)) return "OWorks";
    if (/트리플\s*트랙|triple\s*track/.test(t)) return "TripleTrack";
    if (/툴롱|toulon/.test(t)) return "Toulon";
    if (/스트로크\s*랩|stroke\s*lab/.test(t)) return "StrokeLab";
    if (/듀얼\s*포스|dual\s*force/.test(t)) return "DualForce";
    return null;
  }
  // Cobra
  if (brand === "Cobra") {
    if (/aerojet/.test(t)) return "Aerojet";
    if (/darkspeed/.test(t)) return "Darkspeed";
    if (/speedzone|스피드존/.test(t)) return "Speedzone";
    if (/king\s*sb|킹\s*sb/.test(t)) return "KingSB";
    if (/킹\s*코브라|king\s*cobra/.test(t)) return "KingCobra";
    if (/fp/.test(t)) return "FP";
    return null;
  }
  // Majesty
  if (brand === "Majesty") {
    if (/프레스티지오|prestigio/.test(t)) return "Prestigio";
    if (/프레스티지|prestige/.test(t)) return "Prestige";
    if (/베라티|verite/.test(t)) return "Verite";
    if (/콘퀘스트|conquest/.test(t)) return "Conquest";
    if (/fl\s*플러스|fl\s*plus/.test(t)) return "FLPlus";
    if (/마루망/.test(t)) return "Maruman";
    return null;
  }
  return null;
}

// Loft 추출 — 흔히 "9도", "9.5도", "10.5도" 패턴
function extractLoft(title: string): string | null {
  const m = title.match(/(\d{1,2}\.?\d?)\s*도/);
  if (m) {
    const v = parseFloat(m[1]);
    if (v >= 6 && v <= 25) return `${v}도`;
  }
  return null;
}

// Shaft 추출
function extractShaft(title: string): string | null {
  const t = title.toLowerCase();
  if (/카본\s*샤프트|carbon\s*shaft/.test(t)) return "Carbon";
  if (/그라파이트|graphite/.test(t)) return "Graphite";
  if (/경량\s*스틸|light\s*steel/.test(t)) return "LightSteel";
  if (/스틸\s*샤프트|steel\s*shaft|스틸s\b|스틸r\b|스틸/.test(t)) return "Steel";
  if (/투어\s*ad|tour\s*ad/.test(t)) return "TourAD";
  if (/디아마나|diamana/.test(t)) return "Diamana";
  if (/벤투스|ventus/.test(t)) return "Ventus";
  if (/텐세이|tensei/.test(t)) return "Tensei";
  if (/스피더|speeder/.test(t)) return "Speeder";
  if (/지오텍|geotech/.test(t)) return "Geotech";
  if (/카이저|kaiser/.test(t)) return "Kaiser";
  if (/atmos/.test(t)) return "Atmos";
  if (/kbs/.test(t)) return "KBS";
  if (/dg\s*\d|dynamic\s*gold/.test(t)) return "DynamicGold";
  if (/n\.?s\.?\s*pro|nspro/.test(t)) return "NSPro";
  if (/모데우스|modus/.test(t)) return "Modus";
  return null;
}

// Generation/year — Stealth 2, 1세대, 2세대 등
function extractGeneration(title: string): string | null {
  const t = title.toLowerCase();
  if (/1세대|first\s*gen/.test(t)) return "1st";
  if (/2세대|second\s*gen/.test(t)) return "2nd";
  if (/3세대|third\s*gen/.test(t)) return "3rd";
  if (/4세대|fourth\s*gen/.test(t)) return "4th";
  if (/5세대|fifth\s*gen/.test(t)) return "5th";
  const year = title.match(/(202[0-9])\s*년?/);
  if (year) return year[1];
  return null;
}

// Sex (남/여) 추출
function extractSex(title: string): string | null {
  const t = title.toLowerCase();
  if (/여성용|여자|레이디|lady|ladies|여\s*아이언|여\s*드라이버|여\s*우드|여\s*퍼터|여\s*웨지|여성\s*골프/.test(t)) return "Women";
  if (/남성용|남자|남\s*아이언|남\s*드라이버|남\s*우드|남\s*퍼터|남\s*웨지|men\b|mens/.test(t)) return "Men";
  return null;
}

// Flex (R/S/L/X) 추출
function extractFlex(title: string): string | null {
  // 가장 명확한 패턴 — 단독 단어 또는 "도 S" 같은 패턴
  if (/\b(\d도\s*x|x\s*flex|엑스플렉스)\b/i.test(title)) return "X";
  if (/\b(\d도\s*s|s\s*flex|에스플렉스|강도s)\b/i.test(title)) return "S";
  if (/\b(\d도\s*sr|sr\s*flex)\b/i.test(title)) return "SR";
  if (/\b(\d도\s*r|r\s*flex|알플렉스)\b/i.test(title)) return "R";
  if (/\b(\d도\s*l|l\s*flex|엘플렉스|레이디스?\s*플렉스)\b/i.test(title)) return "L";
  if (/\b(\d도\s*a|a\s*flex)\b/i.test(title)) return "A";
  // 백업: "강도 X" 패턴
  const m = title.match(/강도\s*([XSRLA]R?)/i);
  if (m) return m[1].toUpperCase();
  return null;
}

// Condition (사용감, S급, A급, B급, C급, 새제품 etc) 추출
function extractCondition(title: string): string | null {
  const t = title.toLowerCase();
  // 새제품 / 미개봉
  if (/미개봉|새상품|새제품|미사용|언박싱|언오픈|언패키지/.test(t)) return "New";
  if (/신동급|신동\s*급/.test(t)) return "NearNew";
  // 등급 (S급/A급/B급/C급)
  if (/s급\b|s\s*급|에스급/.test(t)) return "S";
  if (/a급\b|a\s*급|에이급/.test(t)) return "A";
  if (/b급\b|b\s*급|비급/.test(t)) return "B";
  if (/c급\b|c\s*급|시급/.test(t)) return "C";
  // 일반 중고
  if (/중고/.test(t)) return "Used";
  // 사용감/흠집
  if (/사용감\s*많|흠집\s*많|많이\s*사용|많이사용|데미지|상처\s*많/.test(t)) return "Worn";
  if (/사용감|흠집|작은\s*스크래치|미세\s*흠집/.test(t)) return "LightWear";
  return null;
}

const records: Record[] = [];
let queriesDone = 0;
let apiCalls = 0;
let apiErrors = 0;
const outDir = path.join(appDir, "docs/AUDIT_LOG");
mkdirSync(outDir, { recursive: true });
const startTs = Date.now();
const partialPath = path.join(outDir, `wave760-golf-narrow-${startTs}-partial.json`);
const finalPath = path.join(outDir, `wave760-golf-narrow-${startTs}.json`);

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

function saveReport(isPartial = false) {
  const dedupe = new Map<string, Record>();
  for (const r of records) dedupe.set(r.pid, r);
  const unique = Array.from(dedupe.values());

  // Cohort groupings
  const byBrandSubModelMap = new Map<string, number[]>();      // brand|subModel -> prices
  const byBrandConditionMap = new Map<string, number[]>();     // brand|productType|condition -> prices
  const bySexCategoryMap = new Map<string, number[]>();        // brand|productType|sex -> prices
  const byShaftMap = new Map<string, number[]>();              // brand|productType|shaft -> prices
  const byGenerationMap = new Map<string, number[]>();         // brand|subModel|generation -> prices
  const bySubModelLoftMap = new Map<string, number[]>();       // brand|subModel|loft -> prices
  const byBrandFlexMap = new Map<string, number[]>();          // brand|productType|flex -> prices

  for (const r of unique) {
    if (!r.brand || !r.productType || r.price < 10000) continue;
    if (r.subModel) {
      const k = `${r.brand}|${r.subModel}|${r.productType}`;
      const list = byBrandSubModelMap.get(k) ?? [];
      list.push(r.price);
      byBrandSubModelMap.set(k, list);
    }
    if (r.condition) {
      const k = `${r.brand}|${r.productType}|${r.condition}`;
      const list = byBrandConditionMap.get(k) ?? [];
      list.push(r.price);
      byBrandConditionMap.set(k, list);
    }
    if (r.sex) {
      const k = `${r.brand}|${r.productType}|${r.sex}`;
      const list = bySexCategoryMap.get(k) ?? [];
      list.push(r.price);
      bySexCategoryMap.set(k, list);
    }
    if (r.shaft) {
      const k = `${r.brand}|${r.productType}|${r.shaft}`;
      const list = byShaftMap.get(k) ?? [];
      list.push(r.price);
      byShaftMap.set(k, list);
    }
    if (r.subModel && r.generation) {
      const k = `${r.brand}|${r.subModel}|${r.generation}`;
      const list = byGenerationMap.get(k) ?? [];
      list.push(r.price);
      byGenerationMap.set(k, list);
    }
    if (r.subModel && r.loft) {
      const k = `${r.brand}|${r.subModel}|${r.loft}`;
      const list = bySubModelLoftMap.get(k) ?? [];
      list.push(r.price);
      bySubModelLoftMap.set(k, list);
    }
    if (r.flex) {
      const k = `${r.brand}|${r.productType}|${r.flex}`;
      const list = byBrandFlexMap.get(k) ?? [];
      list.push(r.price);
      byBrandFlexMap.set(k, list);
    }
  }

  function toStats(map: Map<string, number[]>, minSamples = 3) {
    return Object.fromEntries(
      [...map.entries()]
        .filter(([, prices]) => prices.length >= minSamples)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([k, prices]) => [k, {
          count: prices.length,
          median: median(prices),
          min: Math.min(...prices),
          max: Math.max(...prices),
        }])
    );
  }

  // narrow_split_candidates: 같은 (brand, productType) 내 cohort 별 median 30%+ 차이
  // Sub-model 별 비교 (예: TaylorMade driver: Stealth vs Stealth2 vs Qi10)
  type SplitCandidate = {
    brand: string;
    productType: string;
    dimension: "subModel" | "condition" | "sex" | "shaft" | "generation" | "flex";
    cohorts: { key: string; count: number; median: number }[];
    minMedian: number;
    maxMedian: number;
    spreadPct: number;
    recommendation: string;
  };
  const splitCandidates: SplitCandidate[] = [];

  // Sub-model split
  const brandProductTypeSubModels = new Map<string, Map<string, number[]>>();
  for (const [k, prices] of byBrandSubModelMap.entries()) {
    if (prices.length < 5) continue;
    const [brand, subModel, productType] = k.split("|");
    const bpKey = `${brand}|${productType}`;
    let m = brandProductTypeSubModels.get(bpKey);
    if (!m) { m = new Map(); brandProductTypeSubModels.set(bpKey, m); }
    m.set(subModel, prices);
  }
  for (const [bpKey, subMap] of brandProductTypeSubModels.entries()) {
    if (subMap.size < 2) continue;
    const cohorts = [...subMap.entries()].map(([sub, prices]) => ({
      key: sub,
      count: prices.length,
      median: median(prices),
    })).sort((a, b) => b.median - a.median);
    const minMed = Math.min(...cohorts.map(c => c.median));
    const maxMed = Math.max(...cohorts.map(c => c.median));
    if (minMed === 0) continue;
    const spread = (maxMed - minMed) / minMed;
    if (spread >= 0.3) {
      const [brand, productType] = bpKey.split("|");
      splitCandidates.push({
        brand, productType, dimension: "subModel",
        cohorts, minMedian: minMed, maxMedian: maxMed,
        spreadPct: Math.round(spread * 100),
        recommendation: `${brand} ${productType} sub-model 별 SKU 분리 권장 (top: ${cohorts[0].key} ${cohorts[0].median.toLocaleString()}원 vs bottom: ${cohorts[cohorts.length-1].key} ${cohorts[cohorts.length-1].median.toLocaleString()}원)`,
      });
    }
  }

  // Condition split (brand x productType)
  const brandProductTypeConditions = new Map<string, Map<string, number[]>>();
  for (const [k, prices] of byBrandConditionMap.entries()) {
    if (prices.length < 5) continue;
    const [brand, productType, condition] = k.split("|");
    const bpKey = `${brand}|${productType}`;
    let m = brandProductTypeConditions.get(bpKey);
    if (!m) { m = new Map(); brandProductTypeConditions.set(bpKey, m); }
    m.set(condition, prices);
  }
  for (const [bpKey, condMap] of brandProductTypeConditions.entries()) {
    if (condMap.size < 2) continue;
    const cohorts = [...condMap.entries()].map(([c, prices]) => ({
      key: c, count: prices.length, median: median(prices),
    })).sort((a, b) => b.median - a.median);
    const minMed = Math.min(...cohorts.map(c => c.median));
    const maxMed = Math.max(...cohorts.map(c => c.median));
    if (minMed === 0) continue;
    const spread = (maxMed - minMed) / minMed;
    if (spread >= 0.3) {
      const [brand, productType] = bpKey.split("|");
      splitCandidates.push({
        brand, productType, dimension: "condition",
        cohorts, minMedian: minMed, maxMedian: maxMed,
        spreadPct: Math.round(spread * 100),
        recommendation: `${brand} ${productType} condition 별 가격 분리 필요 (top: ${cohorts[0].key} vs bottom: ${cohorts[cohorts.length-1].key})`,
      });
    }
  }

  // Sex split (Men vs Women)
  const brandProductTypeSexes = new Map<string, Map<string, number[]>>();
  for (const [k, prices] of bySexCategoryMap.entries()) {
    if (prices.length < 5) continue;
    const [brand, productType, sex] = k.split("|");
    const bpKey = `${brand}|${productType}`;
    let m = brandProductTypeSexes.get(bpKey);
    if (!m) { m = new Map(); brandProductTypeSexes.set(bpKey, m); }
    m.set(sex, prices);
  }
  for (const [bpKey, sexMap] of brandProductTypeSexes.entries()) {
    if (sexMap.size < 2) continue;
    const cohorts = [...sexMap.entries()].map(([s, prices]) => ({
      key: s, count: prices.length, median: median(prices),
    })).sort((a, b) => b.median - a.median);
    const minMed = Math.min(...cohorts.map(c => c.median));
    const maxMed = Math.max(...cohorts.map(c => c.median));
    if (minMed === 0) continue;
    const spread = (maxMed - minMed) / minMed;
    if (spread >= 0.3) {
      const [brand, productType] = bpKey.split("|");
      splitCandidates.push({
        brand, productType, dimension: "sex",
        cohorts, minMedian: minMed, maxMedian: maxMed,
        spreadPct: Math.round(spread * 100),
        recommendation: `${brand} ${productType} 남/여 별 SKU 분리 필요`,
      });
    }
  }

  // Shaft split
  const brandProductTypeShafts = new Map<string, Map<string, number[]>>();
  for (const [k, prices] of byShaftMap.entries()) {
    if (prices.length < 5) continue;
    const [brand, productType, shaft] = k.split("|");
    const bpKey = `${brand}|${productType}`;
    let m = brandProductTypeShafts.get(bpKey);
    if (!m) { m = new Map(); brandProductTypeShafts.set(bpKey, m); }
    m.set(shaft, prices);
  }
  for (const [bpKey, shaftMap] of brandProductTypeShafts.entries()) {
    if (shaftMap.size < 2) continue;
    const cohorts = [...shaftMap.entries()].map(([s, prices]) => ({
      key: s, count: prices.length, median: median(prices),
    })).sort((a, b) => b.median - a.median);
    const minMed = Math.min(...cohorts.map(c => c.median));
    const maxMed = Math.max(...cohorts.map(c => c.median));
    if (minMed === 0) continue;
    const spread = (maxMed - minMed) / minMed;
    if (spread >= 0.3) {
      const [brand, productType] = bpKey.split("|");
      splitCandidates.push({
        brand, productType, dimension: "shaft",
        cohorts, minMedian: minMed, maxMedian: maxMed,
        spreadPct: Math.round(spread * 100),
        recommendation: `${brand} ${productType} 샤프트 별 가격 차이 큼`,
      });
    }
  }

  // Sort split candidates by spread descending
  splitCandidates.sort((a, b) => b.spreadPct - a.spreadPct);

  // Brand × condition extraction count (전체)
  const conditionCoverage = new Map<string, number>();
  for (const r of unique) {
    const key = r.condition ?? "(none)";
    conditionCoverage.set(key, (conditionCoverage.get(key) ?? 0) + 1);
  }
  const sexCoverage = new Map<string, number>();
  for (const r of unique) {
    const key = r.sex ?? "(none)";
    sexCoverage.set(key, (sexCoverage.get(key) ?? 0) + 1);
  }
  const shaftCoverage = new Map<string, number>();
  for (const r of unique) {
    const key = r.shaft ?? "(none)";
    shaftCoverage.set(key, (shaftCoverage.get(key) ?? 0) + 1);
  }
  const subModelCoverage = new Map<string, number>();
  for (const r of unique) {
    const key = r.subModel ? `${r.brand}-${r.subModel}` : "(none)";
    subModelCoverage.set(key, (subModelCoverage.get(key) ?? 0) + 1);
  }

  const report = {
    sweep: "wave760-golf-narrow",
    isPartial,
    timestamp: new Date().toISOString(),
    queriesDone, apiCalls, apiErrors,
    elapsedSec: Math.round((Date.now() - startTs) / 1000),
    totalFetched: records.length,
    uniqueMatters: unique.length,
    extractionCoverage: {
      condition: Object.fromEntries([...conditionCoverage.entries()].sort((a, b) => b[1] - a[1])),
      sex: Object.fromEntries([...sexCoverage.entries()].sort((a, b) => b[1] - a[1])),
      shaft: Object.fromEntries([...shaftCoverage.entries()].sort((a, b) => b[1] - a[1])),
      subModelTopBrands: Object.fromEntries(
        [...subModelCoverage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
      ),
    },
    byBrandSubModel: toStats(byBrandSubModelMap),
    byBrandCondition: toStats(byBrandConditionMap),
    bySexCategory: toStats(bySexCategoryMap),
    byShaft: toStats(byShaftMap),
    byGeneration: toStats(byGenerationMap),
    bySubModelLoft: toStats(bySubModelLoftMap, 5),
    byBrandFlex: toStats(byBrandFlexMap),
    narrow_split_candidates: splitCandidates.slice(0, 60),
  };

  writeFileSync(isPartial ? partialPath : finalPath, JSON.stringify(report, null, 2));
  log(`SAVED ${isPartial ? "partial" : "final"}: ${unique.length} unique, ${splitCandidates.length} split candidates`);
}

process.on("SIGTERM", () => { log("SIGTERM"); saveReport(true); process.exit(143); });
process.on("SIGINT", () => { log("SIGINT"); saveReport(true); process.exit(130); });

async function fetchWithTimeout(query: string, page: number): Promise<SearchItem[]> {
  try {
    const items = await Promise.race([
      searchPage(query, page, { order: "score", limit: 96 }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("timeout_8s")), 8_000),
      ),
    ]);
    return items;
  } catch (e) {
    apiErrors += 1;
    log(`  ERR ${query} p${page}: ${(e as Error).message}`);
    return [];
  }
}

async function runSweep() {
  const queries = [
    ...GENERIC_QUERIES,
    ...GOLF_BRANDS.flatMap((brand) =>
      GOLF_PRODUCT_TYPES.map((pt) => `${brand} ${pt}`),
    ),
  ];

  log(`START: ${queries.length} queries × 2 pages`);

  for (let qi = 0; qi < queries.length; qi++) {
    const query = queries[qi];
    for (let page = 0; page < 2; page++) {
      apiCalls += 1;
      const items = await fetchWithTimeout(query, page);
      for (const item of items) {
        const brand = extractBrand(item.name);
        records.push({
          pid: item.pid,
          name: item.name,
          price: item.price,
          query,
          brand,
          productType: extractProductType(item.name),
          subModel: extractSubModel(item.name, brand),
          loft: extractLoft(item.name),
          shaft: extractShaft(item.name),
          generation: extractGeneration(item.name),
          sex: extractSex(item.name),
          flex: extractFlex(item.name),
          condition: extractCondition(item.name),
        });
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    queriesDone += 1;
    if ((qi + 1) % 5 === 0) {
      log(`PROGRESS ${qi + 1}/${queries.length} | ${records.length} fetched | ${apiErrors} errs`);
    }
    if ((qi + 1) % 15 === 0) {
      saveReport(true);
    }
  }

  saveReport(false);
  log(`DONE: ${records.length} fetched, ${Math.round((Date.now() - startTs) / 1000)}s elapsed`);
}

runSweep().catch((e) => {
  log(`FATAL: ${(e as Error).message}`);
  saveReport(true);
  process.exit(1);
});
