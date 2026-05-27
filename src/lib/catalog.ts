// catalog_v1.py를 TypeScript로 포팅.
// 카탈로그 SKU 19개 + generated mining catalog + normalize + ruleMatch.

import { GENERATED_CATALOG } from "@/lib/generated/catalog";
import { LANE_READINESS } from "@/lib/category-readiness";
// Wave 91 (2026-05-15): 일반인 친화 카테고리 확장 (신발/가방/자전거). 모두 본품만, resale ≤200만.
import { SHOE_CATALOG } from "@/lib/generated/catalog-shoe-wave91";
// Wave 133 (2026-05-16): broad SKU 5개 신설 → Wave 134에서 narrow 30개로 교체 (variant 가격 차이 +151%).
// import { SHOE_BROAD_CATALOG } from "@/lib/generated/catalog-shoe-broad-wave133"; // 폐기.
// Wave 134 (2026-05-16): 신발 narrow SKU 30개 (세대/컬러/한정판 분리). 정확매칭 §12b.
import { SHOE_NARROW_CATALOG } from "@/lib/generated/catalog-shoe-narrow-wave134";
// NB 530 + AF1 + 덩크 일부 = variant 가격 차이 작아 Wave 133 broad 유지하되, 핵심 conflict 제거.
import { SHOE_BROAD_CATALOG } from "@/lib/generated/catalog-shoe-broad-wave133";
// Wave 138 (2026-05-16): 신규 broad 3개 (NB 327, 토바코, 가젤 OG) — Iter 1 needs_review 분석 발굴.
import { SHOE_BROAD_WAVE138_CATALOG } from "@/lib/generated/catalog-shoe-broad-wave138";
// Wave 140 (2026-05-16): 신규 5개 narrow (척70 하이 black/white, 본디 7, AF1 트리플 레드, 잭퍼셀, 페가수스 터보).
import { SHOE_WAVE140_CATALOG } from "@/lib/generated/catalog-shoe-narrow-wave140";
import { BAG_CATALOG } from "@/lib/generated/catalog-bag-wave91";
import { BIKE_CATALOG } from "@/lib/generated/catalog-bike-wave91";
// Wave 266 (2026-05-20): 번개장터 deep sweep — fashion/shoe/bag catalog 대폭 보강.
//  · shoe: 살로몬 X울트라/판타즘/RX슬라이드/XT-4/ACS Pro, NB 1300/1400/1500/1600/2002,
//    나이키 샥스 R4/Z/TL/Ride2, 코르테즈, 문레이서, 스피리돈, 슈퍼플라이/티엠포/머큐리얼,
//    SFB, 송포더뮤트, 스탠스미스, Y-3 콰사/일반, 원스타, 디워커, 발렌시아가
//    트리플S/스피드/트랙/러너, 명품 신발 broad (LV/구찌/프라다/에르메스/디올)
//  · clothing: 폴로 broad, 베이프 자켓, 스투시 broad, 슈프림 broad, 아크네 broad,
//    꼼데가르송 broad, 칼하트 broad, 톰브라운 broad, 챔피온 broad, MLB apparel,
//    디스커버리 broad, TNF 눕시/발토로/맥머도/히말라야, 파타고니아 broad, 스톤아일랜드,
//    Moncler, Canada Goose
//  · bag: 명품 brand-broad fallback — LV/Gucci/Chanel/Dior/Prada/Celine/Bottega/Hermes/
//    Balenciaga/Burberry/Coach/Margiela/Valentino/YSL/MCM/Ferragamo/Miu Miu/Lemaire/CDG/Thom Browne
import { SHOE_WAVE266_CATALOG } from "@/lib/generated/catalog-wave266-shoe";
import { CLOTHING_WAVE266_CATALOG } from "@/lib/generated/catalog-wave266-clothing";
import { BAG_WAVE266_CATALOG } from "@/lib/generated/catalog-wave266-bag";
// Wave 712b (2026-05-23): bias-free agent 14 brand 의류 + 21 brand 신발 검증 결과 일괄 신설.
//   - 의류: Adidas collab 5 (Thug/BAPE/SFTM/Y-3/FOG) / FOG Main Line 4 / Polo 7 / Stone Island 3 / Arc'teryx Down / NB collab 2 / BAPE Adidas + Longsleeve + Bag / Stussy 3 + Nike sub 2 / TNF Novelty + Steep Tech / Junya + CDG Converse broad / Polo Chief Keef
//   - 신발: Onitsuka 2 / AF1 LV8 + Tune Squad + UNDEFEATED / Salomon RX Slide+Phantasm+Mary Jane+XT-Whisper / Hoka Mafate Xlim+Hopara+Mach 6+Kaha 3 / Mizuno Golf JPX+MX+Wave Prophecy / Sacai split 4 / Adidas Adios Pro+Takumi+NMD R1+Pureboost / Dr.Martens 5 / Vans Anaheim+Style 36 / Converse Chuck All Star+Chuck70 Low+RunStarHike+FCW / Yeezy 350 Zebra+Foam Sand+Quantum / Crocs Sanrio+Crocband+Anderson Bell / Puma Rose+Nitro
import { WAVE_712B_BIAS_FREE_SKUS } from "@/lib/generated/catalog-712b-bias-free";
// Wave 712c (2026-05-23): 신발 bias-free 21 brand 검증 — Wave 712b 24 SKU 박은 후 누락 100+ 추가.
//   NB vintage 12 / Asics+Onitsuka 8 / Air Max 3 / Dr.Martens 14 / Yeezy 6 / Hoka 3 / Salomon 6 /
//   On Running 5 / Superstar 5 / Cortez 4 / AJ1 5 / Puma 5 / Crocs 4 / Blazer 5 / Mizuno 2 / Adidas Boost 4
import { WAVE_712C_SHOE_BULK } from "@/lib/generated/catalog-712c-shoe-bulk";
// Wave 715 (2026-05-23): 의류 catalog 체계적 narrow split — Phase 0 audit 결과 20 broad SKU 5-150x spread fix.
//   Thom Browne 6-split (4-bar/Cardigan/Knit/Shirt/Suit/Sweat) + Polo Vintage + Moncler 3-split (Maya/Grenoble/Tricot)
//   + Supreme Box Logo + Carhartt WIP Detroit + CDG 3-split (PLAY/Homme Plus/Junya) + Stussy×Nike + Arc'teryx LEAF/Veilance
import { WAVE_715_CLOTHING_NARROW, BAPE_SUBLINE_NOISE } from "@/lib/generated/catalog-715-clothing-narrow";
// Wave 726 (2026-05-24): agent deep sweep — 신규 brand 신설 (Alpha Industries / Levi's / Discovery).
//   일반인 친화 가격대 brand 추가. 명품/골프웨어는 별 cycle.
import { WAVE_726_CLOTHING_BRAND_ADD } from "@/lib/generated/catalog-726-clothing-brand-add";
// Wave 727 (2026-05-24): 골프웨어 6 brand broad SKU 신설 (Titleist/PXG/Malbon/G·FORE/J.Lindeberg/Mark&Lona).
//   2,624건 sku_id=null 풀 회복. 일반인 친화 가격대 (5-11만).
import { WAVE_727_GOLF_BROAD } from "@/lib/generated/catalog-727-golf-broad";
// Wave 728 (2026-05-24): supreme/arcteryx catalog leak fix — 누락 collab/한정 라인 narrow 신설.
//   supreme dickies/mm6/collab broad + arcteryx proton/solano/rampart.
import { WAVE_728_LEAK_FIX } from "@/lib/generated/catalog-728-leak-fix";
import { WAVE_729_CARHARTT_BROAD } from "@/lib/generated/catalog-729-carhartt-broad";
import { WAVE_730_NIKE_APPAREL_BROAD } from "@/lib/generated/catalog-730-nike-apparel-broad";
import { WAVE_731_ADIDAS_APPAREL_BROAD } from "@/lib/generated/catalog-731-adidas-apparel-broad";
import { WAVE_732_MULTI_BRAND } from "@/lib/generated/catalog-732-multi-brand";
import { WAVE_733_SHOE_BROAD } from "@/lib/generated/catalog-733-shoe-broad";
import { WAVE_734_MEGA_BRAND } from "@/lib/generated/catalog-734-mega-brand";
import { WAVE_735_GOLF_BROAD_2 } from "@/lib/generated/catalog-735-golf-broad-2";
import { WAVE_736_MM6_LACOSTE } from "@/lib/generated/catalog-736-mm6-lacoste";
import { WAVE_746_NEIGHBORHOOD_SCHOTT } from "@/lib/generated/catalog-746-neighborhood-schott";
import { WAVE_749_SONY_ELECTRONICS } from "@/lib/generated/catalog-749-sony-electronics";
import { WAVE_737_SHOE_BROAD_2 } from "@/lib/generated/catalog-737-shoe-broad-2";
// Wave 760 (2026-05-24): 게임 카트리지/타이틀 SKU 100+ 신설 (Pokemon/Mario/Zelda/Animal Crossing 등).
//   기존 game_console 카테고리 활용 (option B). isGameTitle: true 플래그 박아서
//   parser game_title 분류 → pipeline downgrade 차단. Switch v1 본체 SKU 가 게임 TITLE 흡수하던
//   문제 (Wave 758 mustNotContain block) 의 본질적 해결책.
//   일반인 친화 ⭐⭐⭐ (가품 risk 0, mass 매물, 모든 연령대). ~3000+ 매물 회수 예상.
import { WAVE_760_GAME_TITLES } from "@/lib/generated/catalog-760-game-titles";
// Wave 805 (2026-05-24): clothing/shoe high-spread axis split.
//   Arc'teryx Atom/Beta/Proton sub-lines + Stussy hoodie/zip/crewneck + Stussy Nike Air Penny.
import { WAVE_805_FASHION_AXIS_SPLITS } from "@/lib/generated/catalog-805-fashion-axis-splits";
// Wave 806 (2026-05-24): active fashion/shoe spread repair.
//   Asics Kiko/Gel-Quantum/Nimbus + Puma Nitro + Mizuno Prophecy + Carhartt Converse exact sub-lanes.
import { WAVE_806_FASHION_SHOE_AXIS_SPLITS } from "@/lib/generated/catalog-806-fashion-shoe-axis-splits";
// Wave 811 (2026-05-25): shoe broad internal lanes → explicit public model axes.
//   Asics Kayano generation split + Adidas/Puma football model split.
import { WAVE_811_SHOE_EXACT_AXIS_SPLITS } from "@/lib/generated/catalog-811-shoe-exact-axis-splits";
import { WAVE_880_FASHION_CURRENT_DRIFT } from "@/lib/generated/catalog-880-fashion-current-drift";

export type Sku = {
  id: string;
  brand: string;
  category: "earphone" | "smartwatch" | "smartphone" | "tablet" | "laptop" | "monitor" | "speaker" | "camera" | "game_console" | "desktop" | "home_appliance" | "small_appliance" | "watch" | "sport_golf" | "shoe" | "bag" | "bike" | "drone" | "perfume" | "kickboard" | "lego" | "clothing";
  modelName: string;
  aliases: string[];
  mustContain: string[][];
  mustNotContain: string[];
  msrpKrw: number;
  released: number;
  // Optional narrow-lane tag. When set, this SKU belongs to a specific runtime
  // lane (e.g. "ps5_disc_digital_standard") whose readiness in
  // `LANE_READINESS` overrides the broader category gate.
  laneKey?: string;
  // Wave 128 (2026-05-16): 사용자 친화 혼동 주의 메모.
  // pack reveal modal / admin pool / 추천 카드에 표시 (셀러에게 정확히 설명 도움).
  // 예: "Max 2 = USB-C 별칭. Lightning 1세대와 분리.",
  //     "S25 Edge = 별도 모델 (얇음, 512GB 단일).",
  //     "AirPods 4 ANC = 일반 4와 별도 (가격 +20K)."
  confusionNote?: string;
  // Wave 182 (2026-05-17): base option fallback.
  // 매물 텍스트에 옵션 (RAM/SSD/storage/size/connectivity 등) 명시 안 됐을 때 가장 낮은 옵션 가정.
  // base 시세는 항상 underestimate → priceGap 보수적 → false positive 발생 X (§12b 안전).
  // 단 SKU 가 자급제/storage 명시 변형이면 이미 옵션 확정 → baseOptions 박지 X.
  // 박은 SKU 만 parser 가 base fallback 적용 (옛 동작 호환).
  baseOptions?: {
    storageGb?: number;       // smartphone / tablet
    ramGb?: number;           // laptop / desktop
    ssdGb?: number;           // laptop / desktop
    watchSizeMm?: number;     // smartwatch
    connectivity?: "wifi" | "cellular" | "gps" | "bluetooth";
    carrier?: "unlocked" | "skt" | "kt" | "lgu";
  };
  // Wave 196 (2026-05-18): SKU 별 search query optional override.
  //   진단 (Wave 187) — 신발 카테고리 (SKU 별 specific query 30+) fresh_28h 80~92%,
  //   다른 카테고리 (broad query "맥북에어") 10~25%. broad 검색은 인기 모델 위주 결과 →
  //   옛 모델 매물 page 뒤로 밀려 last_seen 갱신 X → market-worker lookback (Wave 184) 밖 →
  //   시세 sample 부족 → 시세 부정확 (사용자 매물 카드 frustration 근본 원인).
  //   policy: 박힌 SKU 는 그 값. 안 박혔으면 aliases 자동 fallback (buildCatalogSearchQueries
  //   helper 가 처리). noise 가능성 있는 SKU 는 빈 배열 [] 박아서 명시 차단.
  searchQueries?: string[];
  // Wave 236d (2026-05-19): catalog model 자체가 product-type 1개 확정인 SKU 만 박힘.
  //   사용자 의도: "노스페이스 빅샷 블랙 이런것만 보고 티셔츠인지 추정이 확실히 되면 그
  //     이름이 티셔츠밖에 없는 이름이면 당연히 넣어야되는데" — narrow model SKU = product-type 확정.
  //   policy:
  //     - model 자체가 product-type 1개 라인 (Borealis=backpack, Nuptse=down jacket) → 박기
  //     - model 이 multi product-type (RRL/FOG Essentials/Supreme collab broad) → 박지 X
  //   미박힘 SKU + text 매칭 실패 → parser needsReview=true → pool 차단 (안전).
  //   값: parser ClothingProductType/BagProductType/ShoeProductType union 문자열.
  defaultProductType?: string;
  // Wave 760 (2026-05-24): game-title SKU 플래그.
  //   game-console parser는 default로 "타이틀/카트리지/디스크" 패턴을 game_title 으로 분류 →
  //   pipeline 이 accessory 로 downgrade → pool 진입 차단. 게임 카트리지/디스크 본품 SKU 에는
  //   isGameTitle=true 박아서 downgrade 차단 (정상 매물로 살림).
  //   주의: 이 플래그 박은 SKU 는 mustNotContain 에 "본체"/"풀박" body keyword 박아서
  //   본체 SKU 와 매칭 충돌 방지.
  isGameTitle?: boolean;
  // Wave 760: 본품 가격 tier 분리 — 미개봉/한정판/풀박 변형은 시세군 다름.
  //   미개봉 = ~1.4x normal, 한정판 = ~2x normal, 풀박 vintage = ~3x normal (DS 포켓몬 130K vs 알칩 35K).
  //   현재는 reference only — runtime tier 분리 X. 향후 confidence band 조정용.
  conditionTier?: "mint" | "limited" | "boxed" | "loose";
  // Wave 767 (2026-05-24): 가품 의심 floor 가격 (premium brand sanity check).
  //   매물 가격 < minPriceKrw 면 parser 가 needsReview + criticalUnknown 박음 → pool 차단.
  //   사용자 #6 deep sweep 발견: "톰브라운 캐주얼니트 7,900원" 같은 명백한 가품 매물.
  //   적용 정책: premium brand 정품 최저 가격 보수적 floor (정상 차익 매물도 조금 잃는 trade-off 감수).
  //   예: thombrowne 50K / moncler 200K / arcteryx_leaf 200K / acne 20K / supreme 30K / polo_rrl 50K.
  //   미박힘 SKU → floor 검사 skip (기존 동작).
  minPriceKrw?: number;
};

const FOG_ESSENTIALS_BRAND_SIGNAL = ["fog", "fear of god", "피오갓", "피어오브갓", "피오지"];

const FASHION_AXIS_DIRECT_OVERRIDE_IDS = new Set([
  "clothing-arcteryx-atom-lt-hoody",
  "clothing-arcteryx-atom-lt-jacket",
  "clothing-arcteryx-atom-sl",
  "clothing-arcteryx-atom-ar-heavyweight",
  "clothing-arcteryx-beta-lt",
  "clothing-arcteryx-beta-sl",
  "clothing-arcteryx-beta-ar",
  "clothing-arcteryx-proton-lt",
  "clothing-arcteryx-proton-fl",
  "clothing-arcteryx-proton-sv",
  "clothing-arcteryx-proton-ar",
  "clothing-stussy-crewneck-sweat",
  "clothing-stussy-zip-hoodie",
  "clothing-stussy-hoodie",
  "shoe-stussy-nike-air-penny",
]);

function isFashionAxisDirectOverrideCompatible(titleChoice: Sku, combinedDirect: Sku) {
  if (!FASHION_AXIS_DIRECT_OVERRIDE_IDS.has(combinedDirect.id)) return false;
  if (titleChoice.id === combinedDirect.id) return true;
  if (titleChoice.id === "clothing-arcteryx-atom" && combinedDirect.id.startsWith("clothing-arcteryx-atom-")) return true;
  if (titleChoice.id === "clothing-arcteryx-beta" && combinedDirect.id.startsWith("clothing-arcteryx-beta-")) return true;
  if (titleChoice.id === "clothing-arcteryx-proton" && combinedDirect.id.startsWith("clothing-arcteryx-proton-")) return true;
  if (
    titleChoice.id === "clothing-stussy-hoodie" &&
    (combinedDirect.id === "clothing-stussy-hoodie" ||
      combinedDirect.id === "clothing-stussy-crewneck-sweat" ||
      combinedDirect.id === "clothing-stussy-zip-hoodie")
  ) return true;
  if (titleChoice.id === "shoe-stussy-nike-collab" && combinedDirect.id === "shoe-stussy-nike-air-penny") return true;
  return false;
}

// Wave 122 (2026-05-15): 모든 카테고리 공통 noise 패턴 (Wave 121 audit 결과).
// 휴대폰 audit에서 발견 — 다른 카테고리 (laptop/tablet/earphone/smartwatch/speaker)도 동일 noise 가능.
// 사용자 통찰: "다른 brand까지 빠짐없이 모두 같은 패턴 차단"
// Wave 122b: 전체 brand audit 결과 추가 발견 — 사은품 증정/룰렛 이벤트/광고 prefix.
// Wave 188 internal test (2026-05-18): 모든 신규 카테고리 (drone/perfume/kickboard/lego/home_appliance 헤어 기기)
// 공통 false positive 차단 — 굿즈/액세서리 단품/케이스/거치대/가품.
// production sweep 결과 오염률 50% 발견 → 일관 적용으로 10~15% 목표.
// Wave 188 follow-up (2026-05-18): production sweep 재실행 → 발견된 추가 패턴 보강
//  - "포토카트" (오타), "포카 2종" (포카 세트 형태)
//  - "노즐 툴", "툴 키트" (Dyson 슈퍼소닉 액세서리 단품)
//  - "필터 키트", "ND 필터", "ND16/64/256", "K&F" (DJI 드론 액세서리 100% FP)
//  - "HS01 풀세트" (Airwrap 구형 — 다른 SKU)
const WAVE188_NEW_CATEGORY_NOISE = [
  // 굿즈 / 콜라보 (포토카드 / 박보검 다이슨 콜라보 등)
  "포토카드", "포카", "특전", "굿즈", "한정 굿즈", "박보검",
  "포토카트", "포카 2종", "포카 세트", "포카2종", "포토카드 2종",
  // 가품 / 카피 브랜드
  "휙", "다이슨 저렴이", "다이슨 짝퉁", "이미테이션", "정품 아님", "lepin", "카피", "복제",
  // 액세서리 단품 (공통)
  "거치대", "스탠드만", "벽거치", "케이스만", "정품 케이스", "박스만",
  "충전기만", "어댑터만", "케이블만", "배터리만",
  "필름만", "보호 필름만", "보호 필름 단품",
  // Dyson 슈퍼소닉 — 노즐/툴 단품 (본품 X)
  "노즐 툴", "노즐 툴 세트", "툴 세트", "툴 키트", "툴만",
  // DJI 드론 — ND/필터 키트 단품 (본품 X)
  "필터 키트", "nd 필터", "nd16", "nd64", "nd256", "k&f", "k & f", "kf concept",
];

// Wave 805: Nintendo Switch body lanes must not absorb game-title rows that
// are not yet covered by narrow title SKUs. Keep this on body consoles only;
// OLED/Zelda/Splatoon/Pokemon console editions may be legitimate bundles.
const SWITCH_BODY_GAME_TITLE_NOISE = [
  "호그와트", "hogwarts", "레거시", "legacy",
  "라보", "labo", "토이콘", "toy-con", "toycon",
  "디지몬", "digimon", "동키콩 리턴즈", "donkey kong returns",
  "아틀리에", "atelier", "마리의 아틀리에", "피크민", "pikmin",
  "드래곤퀘스트", "드래곤 퀘스트", "dragon quest", "드퀘",
  "저스트댄스", "저스트 댄스", "just dance",
  "나루토", "naruto", "소닉", "sonic",
];

// DJI/GoPro drone-class 필터 액세서리 단품 (본품 X). drone SKU spread 용.
// Wave 192 (2026-05-18): production sweep 발견 추가 액세서리 — "스마트 조종기", "컨트롤러", "볼타 그립" 등.
//   잘못 매칭된 매물이 시세 sample로 들어가 median 비현실적 낮음 (dji-mini-2 312k, dji-mini-4-pro 44k).
const DRONE_FILTER_ACCESSORY_NOISE = [
  "필터만", "필터 단품", "렌즈 필터", "보호 필터", "uv 필터", "cpl", "2in1 필터", "필터 세트",
  // 조종기/컨트롤러/리모컨 단품
  "스마트 조종기", "조종기 단품", "조종기만", "컨트롤러 단품", "컨트롤러만",
  "rc 컨트롤러", "rc-n1", "rc-n2", "rc2", "smart controller",
  "리모컨만", "리모컨 단품",
  // 그립/홀더/마운트 (GoPro/액션캠 액세서리)
  "볼타", "그립 단품", "셀카봉만", "셀카봉 단품", "삼각대만",
  "헬멧 마운트", "마운트 단품", "흡착 마운트",
  // Wave 237 (2026-05-19): production audit — DJI 액세서리 단품 매물 다수 mismatch.
  //   본품 가격 (DJI Mavic 1~3M, Mini 800k) 과 격차 큼 → 시세 왜곡 (60k 매물이 median 낮춤).
  //   주의: "프로펠러" 단독 차단 X — 정상 본품 풀세트도 차단됨. 단품 명시 키워드만.
  "배터리만", "배터리 단품", "배터리 판매(?!\\s*용)", "드론배터리", "battery only",
  "프롭만", "프로펠러만", "프로펠러 단품", "프롭 단품",
  "매크로 렌즈", "pov 렌즈", "렌즈 단품", "와이드 렌즈 단품", "어안 렌즈만",
  "액세서리 4종", "액세서리 세트(?!\\s*포함)", "악세 풀셋(?!\\s*트)", "악세서리 모음", "액세서리 모음",
  "스킨 스티커만", "보호 스티커만", "데칼만", "데칼 단품",
  "마이크 단품", "마이크만", "외장 마이크 단품",
  "프로펠러 가드만", "프로펠러 홀더만",
  "슬링백만", "전용 슬링백만",
  "삼각대로드만", "삼각대 단품만",
  "배터리 핸들만", "배터리 그립만",
];

// Garmin 워치 액세서리 (마운트/스트랩/케이스 단품) — 본품 X.
const GARMIN_ACCESSORY_NOISE = [
  "바이크 마운트", "자전거 마운트", "핸들바 마운트", "퀵 릴리즈 마운트",
  "쿼터 마운트", "마운트 어댑터", "마운트 키트",
  "충전 케이블", "충전 거치대", "충전 도크", "도크만",
  "스트랩 단품", "밴드 단품", "실리콘 스트랩", "메탈 스트랩", "가죽 스트랩",
];

const COMMON_PRODUCT_NOISE = [
  // 케이지/촬영용 액세서리 (NEEWER/스몰리그)
  "케이지", "케이지 킷", "케이지킷", "케이지 키트", "케이지키트",
  // 콜라보 굿즈 / 캐릭터 굿즈 / 아이돌 응원 굿즈
  "콜라보 에디션", "콜라보에디션", "에디션 패키지", "에디션패키지",
  "네임보드", "우치와", "키링", "테디베어",
  // 광고/업자 매물
  "단독 행사", "단독행사", "행사중", "개인결제창", "결제창",
  // 교신 매물 (교환 의미)
  "교신", "교신원함", "교신원합니다", "교신원해요", "교환원해용",
  // Wave 122b: 사은품/이벤트/광고 prefix
  // 주의: 대괄호 token은 normalize에서 제거되어 일반 token으로 변환 → 정상 매물에 false positive
  // (예: "[풀박스]" → " 풀박스 " → "풀박스" 명시한 정상 매물도 reject). 대괄호 token 사용 X.
  "사은품 증정", "사은품증정", "사은품 드림",
  "룰렛 이벤트", "룰렛이벤트",
  "리뷰 이벤트", "리뷰이벤트",
  "쿠폰 증정", "쿠폰증정",
  "마우스 증정", "마우스증정",
  "포장스티커안뜯은", "포장 스티커 안뜯은",
  // Wave 124 (2026-05-15): 전체 카테고리 audit 추가 발견 — 부품/스킨 token (catalog level 차단 OK).
  // 주의: K-pop 굿즈 (포카/포토카드/특전/엔시티) 은 pipeline.ts:467 categoryScopedNoise에서 처리 (catalog mustNotContain 추가 X)
  // 이유: catalog reject되면 ruleMatch null → categoryScopedNoise 도달 못 함 → accessory 분류 실패
  "메탈스티커", "메탈 스티커",  // 사은품 스티커
  "스킨 스티커", "스킨스티커",  // 스위치 등 스킨 액세서리
  "본체화면만", "화면만",  // 부품 (본품 X), "디스플레이만"은 monitor 정상 매물 false positive 우려라 제외
  "조이스틱 핸들",  // 게임기 액세서리
  "박스만 판매", "박스 단독", "박스 단품",  // 박스 단독 매물 (본체 X)
];

const PHONE_NOISE = [
  "케이스",
  "case",
  "폰케이스",
  "그립톡",
  "스마트톡",
  "맥세이프",
  "파인우븐",
  "슬림아머",
  "슈피겐",
  "어반소피스티케이션",
  "모란카노",
  "tyreus",
  "디월렛",
  "다이어리",
  "필름",
  "강화유리",
  "키보드",
  "키패드",
  "물리키패드",
  "충전기만",
  "어댑터만",
  "액정",
  "액정만",
  "배터리만",
  "메인보드",
  "뒷판",
  "후면유리",
  "후면 유리",
  "후면판",
  "백글라스",
  "하우징",
  "카메라렌즈",
  "카메라 렌즈",
  "충전단자",
  "줄이어폰",
  "부품용",
  "파손폰",
  "고장폰",
  "고장",
  "분실폰",
  "잠김",
  "락걸림",
  "매입",
  "삽니다",
  "구합니다",
  "구해봅니다",
  "구매함",
  "최고가",
  "대여",
  "렌탈",
  "색상교환",
  "교환하실분",
  "교환하실 분",
  // Wave 120 (2026-05-15): iPhone broad audit 발견 — 교환/빈박스 매물 reject 강화.
  "교환원함", "교환원합니다", "교환해요", "교환해주실분", "교환해주실 분",
  "빈박스", "박스만",
  // Wave 121/122: COMMON_PRODUCT_NOISE 통합 (모든 카테고리 동일 패턴).
  ...COMMON_PRODUCT_NOISE,
  // 휴대폰 전용: 인형 (어반 소피스티케이션 테디베어 같은 굿즈 — phone에서만)
  "인형",
  // 휴대폰 전용: 고객님 (광고/업자 매물)
  "고객님",
  // 가격 거부 표시 (셀러가 99999999 / 12345678 같은 dummy 가격 입력)
  // 가격은 pipeline에서 검증 (catalog mustNotContain은 text only)
  // Wave 111e: brand-less normalize 부작용 차단 — 스타일러스/S펜만 매물이 broad SKU에 흡수되는 것 방지.
  "스타일러스",
  "s펜만",
  "s 펜만",
  "에스펜만",
  // Wave 114d (2026-05-15): broad SKU도 통신사 약정/번호이동/할부 매물 reject.
  // 자급제 narrow lane은 이미 mustNotContain에 있음. broad는 누락 — precision 약점.
  // production audit 1건 발견: "[개통폰] 아이폰15 타통신사 -> KT 번호이동" → iphone-15 broad 흡수
  "번호이동",
  "번호 이동",
  "약정승계",
  "약정 승계",
  "할부승계",
  "할부 승계",
  "할부 잔여",
  "할부잔여",
  "개통폰",
  "kt 약정",
  "skt 약정",
  "skt 완납",
  "kt 완납",
  "lgu+ 약정",
  "유플 약정",
  // Wave 605 (2026-05-22): galaxy_sXX systemic false positive 차단 (Wave 604 follow-up).
  //   production audit: galaxy_s21/22/23/24/25/26 SKU에 오토바이/디올 클러치/POS기/소니 카메라/풀카운트 의류/
  //   핫토이 피규어/카시오 시계/숙박권/미니카 등 false positive 150+건.
  //   모든 phone SKU 적용 (PHONE_NOISE spread).
  // 오토바이/자동차
  "pcx", "pcx125", "ninja", "mt-09", "r3 ", "벨로스터", "veloster", "터빈",
  // 디지털 카메라 (소니 사이버샷 DSC-S2100, 캐논 파워샷 s20, 후지 x-s20 등)
  "dsc-", "dsc s", "사이버샷", "cybershot", "캐논", "canon", "파워샷", "powershot",
  "후지", "fuji", "fujifilm",
  // 의류 시즌/model code (풀카운트 데님 S2107, 디올 클러치 S2107, 미우미우 SS21, 아디다스 HS2069 등)
  "풀카운트", "fullcount", "ss21", "fw21", "ss22", "fw22", "ss23", "fw23", "ss24", "fw24",
  "s2107", "hs2069", "byss20",
  // POS기/IT 기기
  "posbank", "bigpos", "키오스크", "kiosk",
  // 피규어
  "핫토이", "hot toys", "hottoys", "mms214",
  // 시계 (카시오 GMA-S2100, G-Shock)
  "gma s", "gma-s", "ga-2100", "ga2100", "카시오 gma", "g-shock", "지샥",
  // 숙박권/리조트
  "리솜", "레스트리", "숙박 양도", "양도해요",
  // 골프 (다이나믹 골드 샤프트 S200/S300, 타이틀리스트 등)
  "타이틀리스트", "titleist", "캘러웨이", "callaway", "테일러메이드", "taylormade",
  "미즈노", "mizuno", "브리지스톤", "bridgestone", "스릭슨", "srixon", "에폰", "epon",
  "포지드", "forged", "다이나믹 골드", "다골", "투어이슈",
  // 자전거 (Garmin Rally RS200 등)
  "가민", "garmin", "랠리", "rally", "rs200",
  // 액션캠/사운드바/앰프
  "callas20", "soocoo", "yas207", "xls202",
  // 미니카
  "토미카", "tomica", "1:64", "1/64", "미니카",
  // Wave 751 (2026-05-24) Pareto sweep — iPhone Pro 18,000x spread audit 발견.
  // 사제수리/대용량 배터리/케이스 brand/bait 차단.
  "사제수리", "사제 수리", "사제수리폰", "수리폰",
  "에너자이저", "energizer", "대용량 배터리",
  "어프어프", "케이스만",
  // bait listings: "개당5000원" 같은 multi-unit dummy 가격
  "개당", "개당가격", "장당",
  // Wave 751b (2026-05-24) batch audit:
  // - 목업폰/디스플레이용 (iPhone 15 Pro Max 7K)
  // - 껍데기/구성품만 (iPhone 13 Pro 5K / iPhone 16 Pro 25K)
  // - GTS250 NVIDIA GPU → galaxy-s25 false match (6.5K)
  // - 광고성 bait ("2/3일까지만 이 가격" — macbook-air)
  "목업폰", "목업 폰", "전시품", "전시폰", "디스플레이용", "디스플레이 용",
  "껍데기", "껍데기만", "구성품만", "구성품 만", "내용물만",
  // GPU false match (Galaxy S25 mustNotContain spread)
  "gts250", "gts 250", "그래픽카드", "그래픽 카드", "geforce",
  // 광고 bait
  "이가격", "이 가격", "오늘까지만", "특가 마감", "급마감",
  // Wave 753 (2026-05-24) Pareto: iPhone 17 Pro Max 306x audit — 학교제출용/모형/가짜폰 차단.
  "목각폰", "목각 폰", "모형폰", "모형 폰", "가짜폰", "가짜 폰",
  "학교제출용", "학교 제출용", "전시용", "전시 용",
  // 캐릭터 case (마이멜로디/뮤즈무드 같은 case brand)
  "뮤즈무드", "muse mood", "마이멜로디 아이폰", "쿠로미 아이폰",
];

const TABLET_NOISE = [
  "케이스",
  "필름",
  "강화유리",
  "펜슬만",
  "애플펜슬만",
  "키보드만",
  "매직키보드만",
  "충전기만",
  "액정",
  "액정만",
  "배터리만",
  "부품용",
  "파손",
  "고장",
  "매입",
  "삽니다",
  "구합니다",
  "대여",
  "렌탈",
  // Wave 122: 공통 noise 패턴 (케이지/콜라보/광고/교신)
  ...COMMON_PRODUCT_NOISE,
  // Wave 648b: 교환 매물 차단 (Wave 235/645/648 패턴 spread to tablet).
  "교환 원함", "교환원함", "교환원해요", "교환 원해요", "교환원합니다", "교환 원합니다",
  "교환희망", "교환 희망", "교환합니다", "교환만",
];

const HEADPHONE_NOISE = [
  "이어패드만",
  "이어 패드만",
  "이어쿠션만",
  "이어 쿠션만",
  "헤드쿠션만",
  "헤드 쿠션만",
  "케이스만",
  "파우치만",
  "거치대만",
  "스탠드만",
  "충전기만",
  "케이블만",
  "부품용",
  "고장",
  "불량",
  "삽니다",
  "구합니다",
  "매입",
  // Wave 179 (2026-05-17): 사용자 코멘트 pid 343583659 — 에어팟/이어폰 한쪽 단품 본품 시세로 흡수.
  // 명시 패턴만 (false positive 차단): "왼쪽만"은 OK, 단독 "왼쪽"은 정상 매물도 사용 → 제외.
  "왼쪽만", "오른쪽만", "좌측만", "우측만",
  "왼쪽 유닛", "오른쪽 유닛", "좌 유닛", "우 유닛",
  "한쪽만", "한쪽 구매", "한쪽 판매", "한쪽 유닛",
  "유닛만", "유닛 판매", "유닛입니다",
  "본체와 호환",  // "A2968 본체와 호환" — 이건 본체 아닌 부품 시그널
  "충전 케이스만", "충전케이스만",
  // Wave 250 (2026-05-19): airpods-pro-2 CV 0.93 production sample 측정 후 단품 패턴 보강.
  //   "왼쪽 이어폰 단품" / "오른쪽 이어폰 단품" / "프로2 본체" / "본체만" / "본체 가져가신" 등.
  //   기존 "왼쪽만" / "유닛만" 만 차단 → "왼쪽 이어폰 단품" / "본체 가져가신" 변형 통과.
  "왼쪽 이어폰", "오른쪽 이어폰", "좌측 이어폰", "우측 이어폰",
  "왼쪽 단품", "오른쪽 단품", "좌측 단품", "우측 단품",
  "본체만", "본체 만", "본체 판매",
  "본체 가져가신", "본체 분실", "본체 찾", "분실 본체",
  "이어폰 단품",
  "8핀 본체", "8핀,본체", "8핀 왼쪽", "8핀 오른쪽",
  // Wave 751 (2026-05-24) Pareto sweep — AirPods Pro 3 1250x spread.
  // 분실/찾기 글 차단 (10M dummy 가격 lost & found 매물).
  "분실물", "분실 신고", "잃어버렸", "잃어버린", "분실해서",
  "찾아 주", "찾아주", "찾습니다", "찾고 있", "찾고있",
  "사례하겠", "사례드립",
  // Wave 751b (2026-05-24) — AirPods Max 어프어프 콜라보 케이스/하드 차단.
  "어프어프", "전과자 콜라보", "전과자콜라보", "클리어하드", "하드 케이스",
  // Wave 122: 공통 noise 패턴
  ...COMMON_PRODUCT_NOISE,
];

const SPEAKER_NOISE = [
  "케이스",
  "case",
  "하드쉘",
  "파우치",
  "가방",
  "커버",
  "스탠드만",
  "거치대만",
  "충전기만",
  "케이블만",
  "마이크",
  "무선마이크",
  "노래방",
  "karaoke",
  "pa",
  "리시버",
  "receiver",
  "앰프",
  "amp",
  "사운드바",
  "soundbar",
  "일괄",
  "고장",
  "파손",
  "대여",
  "렌탈",
  "삽니다",
  "구합니다",
  "매입",
  // Wave 122: 공통 noise 패턴
  ...COMMON_PRODUCT_NOISE,
];

const CAMERA_BODY_ONLY_NOISE = [
  "렌즈",
  "lens",
  "번들",
  "번들킷",
  "키트",
  "kit",
  "세트",
  "풀셋",
  "풀셋트",
  "바디캡",
  "렌즈캡",
  "뒷캡",
  "캡",
  "케이스",
  "가방",
  "하자",
  "수리필요",
  "부품용",
  "고장",
  "구매",
  "삽니다",
  "구합니다",
  "업자x",
  "사기꾼",
  "바디프렌드",
];

// Wave 67: 시계 narrow lane noise (오리지널 본체 매물만 매칭).
// 가품/리퍼/액세서리/구매요청 거름. "줄/스트랩/베젤"은 액세서리만 명시될 때 거름 (본체+ 같이는 OK 위해 mustContain 우선).
const WATCH_NOISE = [
  "줄만", "스트랩만", "밴드만",
  "베젤만", "유리만", "쉬라우드만",
  "케이스만",
  "복각", "homage", "오마주",
  "고장", "수리필요", "부품용", "as용", "고정만",
  "삽니다", "구매합니다", "구합니다",
  "가품", "이미테이션", "fake",
  "사진용", "디스플레이용", "전시용",
  // Wave 95: 한정판/콜라보 variant — 일반 모델과 시세 다름 (시세 분리 못 하면 median 왜곡).
  "조슈아 비데스", "joshua vides", "조슈아비데스",
  "버스트다운", "burst down", "다이아 박힘", "풀다이아",
  "vvs", "모이사나이트",
  "x 콜라보", "X 콜라보", "콜라보 한정",
  // 카시오 시계 한정 모델 코드 (GMW-B5000GD-1DR, DW-5600JV-7 등 — 별도 SKU 분리 전까지 reject)
  "gmw-b5000gd", "gmwb5000gd",
  "dw-5600jv", "dw5600jv",
  "버스트", "drip",
  // Wave 645: 교환 매물 차단 (Wave 235 PHONE_NOISE 패턴 spread to WATCH).
  //   production: pid 405218598 '가민포러너265 교환 원합니다' 999,999 (placeholder).
  "교환 원함", "교환원함", "교환원해요", "교환 원해요", "교환원합니다", "교환 원합니다",
  "교환희망", "교환 희망", "교환합니다", "교환만",
];

// Wave 67: 골프 narrow lane noise (드라이버 본체 매물 — 헤드만은 별개 분기).
// 풀세트(아이언+드라이버) / 우드세트는 거름 — 드라이버 단독 매물만.
const GOLF_DRIVER_NOISE = [
  "풀세트", "풀 세트", "골프세트", "골프 세트",
  "아이언세트", "아이언 세트",
  "우드세트", "우드 세트",
  "삽니다", "구매합니다", "구합니다",
  "가품", "이미테이션", "fake",
  "수리필요", "부품용", "고장",
  "유틸",  // 유틸리티 우드 — 드라이버 아님
  // Wave 111j (2026-05-15): 드라이버 헤드만/샤프트만 매물 차단 (본체 매물만).
  "드라이버 헤드", "driver head", "헤드 단품", "헤드만", "head only",
  "샤프트만", "샤프트 단품", "shaft only",
  "헤드커버만",
];

// Wave 759 (2026-05-24): 골프 broad SKU 신설용 공통 noise.
const GOLF_CLUB_COMMON_NOISE = [
  "삽니다", "구매합니다", "구합니다", "구해요", "구함", "wts", "wtb", "사삽니다",
  "가품", "이미테이션", "fake", "짭", "복각",
  "수리필요", "부품용", "고장", "헤드만", "head only", "샤프트만", "shaft only",
  "헤드커버만", "헤드 커버만",
  // Wave 807: generic "풀세트" alone pulled non-golf full sets into sport_golf.
  "바이올린", "악기", "레스큐빔", "다이빙", "랜턴", "렌턴", "카드지갑", "지갑", "wallet",
  // 의류 (Wave 727+ catalog 있음 — golf 의류 제외)
  "골프웨어", "골프복", "골프 의류",
  // 가방 (사용자 정책 가방 ready X)
  "캐디백", "캐디 백", "골프백", "골프 백", "스탠드백", "토트백",
  // 신발/액세서리
  "골프화", "골프 화", "장갑", "골프 장갑",
  // 골프공
  "골프공", "골프 공", "공 박스", "공만",
  // 모자
  "골프 모자", "골프모자", "캡", "볼캡",
  // 광고/매입
  "최고가", "최고가 매입", "매입 다 받음",
];

// 골프 driver broad용 추가 noise
const GOLF_DRIVER_BROAD_NOISE = [
  ...GOLF_CLUB_COMMON_NOISE,
  // 다른 product type 차단 (driver만)
  "아이언", "iron", "퍼터", "putter", "웨지", "wedge",
  "하이브리드", "hybrid", "유틸리티", "utility",
  "페어웨이 우드", "fairway wood", "5번 우드", "3번 우드",
  "풀세트", "풀 세트", "하프세트", "하프 세트", "골프세트",
  "아이언세트", "우드세트",
];

// 골프 iron broad용 추가 noise
const GOLF_IRON_BROAD_NOISE = [
  ...GOLF_CLUB_COMMON_NOISE,
  "드라이버", "driver", "퍼터", "putter", "웨지", "wedge",
  "하이브리드", "hybrid",
  "페어웨이 우드", "fairway wood",
  "단품", "1번", "단일",
];

// 골프 putter broad용 추가 noise
const GOLF_PUTTER_BROAD_NOISE = [
  ...GOLF_CLUB_COMMON_NOISE,
  "드라이버", "driver", "아이언", "iron", "웨지", "wedge",
  "하이브리드", "hybrid", "우드", "wood",
  "퍼터 커버", "퍼터커버", "퍼터 그립만",
];

const LAPTOP_NOISE = [
  "메인보드",
  "메인 보드",
  "로직보드",
  "로직 보드",
  "상판",
  "하판",
  "액정만",
  "배터리만",
  "키보드만",
  "부품용",
  "부품",
  "고장",
  "침수",
  // Wave 113 (2026-05-15): 대여/렌탈/임대 매물 reject. 화상면접 영상편집 단기 렌탈.
  "대여",
  "렌탈",
  "임대",
  // 보호필름/탈부착 보호 매물 accessory reject (broad macbook-air에 케이스/파우치 있음).
  "보호필름",
  "보호 필름",
  "사생활 필름",
  "사생활 보호필름",
  "사생활 보호 필름",
  // Wave 122: 공통 noise 패턴
  ...COMMON_PRODUCT_NOISE,
  // Wave 648: 교환 매물 차단 (Wave 235 PHONE_NOISE 패턴 spread).
  //   production: pid 407486538 '맥북프로 m5 max 14인치 교환만' 5.79M (placeholder/교환).
  "교환 원함", "교환원함", "교환원해요", "교환 원해요", "교환원합니다", "교환 원합니다",
  "교환희망", "교환 희망", "교환합니다", "교환만",
  // Wave 751 (2026-05-24) Pareto sweep — macbook-pro 4400x spread audit 발견.
  // 키보드 가드/공박스/도킹스테이션/구매 글 차단.
  "키보드 가드", "키보드가드", "공박스", "박스만",
  "도킹 스테이션", "도킹스테이션", "docking station", "조이룸", "joyroom",
  "사봐요", "사요", "사고싶어요", "사고 싶어요",
  // 호환 거치대/스탠드 (단품)
  "거치대만", "스탠드만", "받침대만", "노트북 받침대만", "노트북 받침만",
];

// Wave 94 (2026-05-15): pollution audit 발견 패턴 강화.
// 카테고리별로 자동 spread (GENERATED_CATALOG_WITH_GATES 패턴 확장).

// 이어폰/헤드폰: 케이스/실리콘/거치대 단품 매물 reject 강화
// Wave 94 iter2: audit에서 "에어팟2 케이스 기본 베이지" / "버즈3 프로 케이스 1회 사용" 같은
// 매물 발견 → 좀 더 broad한 패턴 추가.
const EARPHONE_NOISE_W94 = [
  "실리콘 케이스", "보호 케이스", "케이스 단품", "케이스 1회",
  "투명 케이스", "하드 케이스", "젤리 케이스", "범퍼 케이스",
  "케이스 기본", "케이스 신상", "케이스 미사용", "케이스 미사용품",
  "케이스 미개봉",
  "에어팟 케이스", "에어팟 1,2세대 케이스", "에어팟 1/2 케이스",
  "버즈 케이스", "버즈3 케이스", "버즈3 프로 케이스", "버즈3프로 케이스",
  "버즈3,버즈3프로 케이스", "버즈프로 케이스", "버즈 프로 케이스",
  "갤럭시 버즈 케이스", "케이맥스",
  // Wave 95: marginal SKU audit에서 발견된 추가 케이스 변형
  "범퍼 락", "범퍼락", "가죽 케이스", "가죽케이스",
  "에어팟 케이스 새상품", "샤넬 에어팟", "샤넬 케이스",
  "한정 케이스", "콜라보 케이스", "디자인 케이스",
  "특a급", "특A급", "최상품 (가품)",
  "노캔x", "노이즈 캔슬링 X",
  "이어캡", "이어탭", "이어 캡", "이어 탭", "earcap",
  "필름", "강화유리",
  "유닛 판매", "오른쪽 유닛", "왼쪽 유닛", "유닛 단품",
  "본체만 판매 X", "본체만 분리",
  "스트랩만", "넥스트랩만", "넥 스트랩만",
  "구매원함", "구매원합니다", "구매희망",
  ...COMMON_PRODUCT_NOISE,
];

// 스마트워치: 케이스/밴드/필름 단품 매물 reject 강화
const SMARTWATCH_NOISE_W94 = [
  "강화유리", "액정보호", "보호 케이스", "보호케이스", "필름",
  "투명 케이스", "하드 케이스", "젤리 케이스", "범퍼", "스킨",
  "밴드만", "메탈 밴드", "밀레니즈 밴드", "스포츠 밴드 단품",
  "스트랩만", "줄만", "버클만",
  "충전기만", "충전 거치대만", "거치대만",
  "구매원함", "구매원합니다", "구매희망",
  ...COMMON_PRODUCT_NOISE,
];

// 모니터: 거치대/스탠드/암 단품 매물 reject (현재 NOISE 없음)
// Wave 94 iter2: "27gp850 모니터 거치대" 같이 모델명만 + 거치대 reject 강화.
const MONITOR_NOISE_W94 = [
  "거치대만", "거치대 단품", "모니터 거치대",
  "스탠드만", "스탠드 단품",
  "암 단품", "모니터 암", "vesa 마운트만",
  "vesa 어댑터", "리모컨만", "전원선만", "케이블만",
  "벽걸이 brackets",
  "구매원함", "구매원합니다", "구매희망",
  "삽니다", "구합니다",
];

// 가전 (로보락/다이슨 등): 악세사리/키트/소모품 reject (현재 NOISE 없음)
// Wave 94 iter2: 사기 매물 패턴 reject.
const HOME_APPLIANCE_NOISE_W94 = [
  "악세사리", "악세서리", "엑세서리",
  "키트", "kit", "키트 미개봉",
  "물걸레", "물 걸레", "걸레 패드",
  "필터", "filter", "필터만", "필터 교체",
  "브러시만", "brush", "롤러브러시", "사이드 브러시",
  "소모품", "소모품 세트",
  "충전 받침", "도크만", "도크 단품",
  "리모컨만", "전원선만", "배터리만",
  "구매원함", "구매원합니다", "구매희망",
  "전문사기조직", "사기 신고", "사기조직",
];

// 시계 (워치): 구매원함 + 케이스 단품 reject 추가
const WATCH_NOISE_W94 = [
  "구매원함", "구매원합니다", "구매희망",
  "유리 단품", "쉴드 단품",
  "보호 케이스", "케이스 단품",
  "필름", "강화유리",
];

// 태블릿: 짭펜슬/구형 세대 reject 강화
const TABLET_NOISE_W94 = [
  "짭펜슬", "정품 펜슬 아님", "정품 펜슬 X",
  "비공식 펜슬", "호환 펜슬만",
  // Wave 95: 거치대 NK 등 액세서리
  "거치대 nk", "거치대 nk32", "아이패드 거치대",
  "태블릿 거치대",
  ...COMMON_PRODUCT_NOISE,
];

// 스피커: 케이스/충전기/벽걸이 단품 reject 강화
const SPEAKER_NOISE_W94 = [
  "하드 케이스 단품", "스킨만", "보호 커버만",
  "스트랩 단품",
  "충전 도크만", "충전 받침만",
  ...COMMON_PRODUCT_NOISE,
];

// Wave 94: 카테고리별 NOISE를 GENERATED_CATALOG SKU에 자동 spread.
// 기존 mustNotContain은 union으로 보존 (intent loss 없음).
// Wave 114d (2026-05-15): smartphone broad용 통신사 NOISE (parts 토큰 제외).
// PHONE_NOISE 전체를 smartphone에 spread하면 "백글라스/액정" 같은 parts 토큰이 broad SKU mustNotContain에 들어가서
// → catalog ruleMatch null → categoryScopedNoise (pipeline.ts phonePartsSignal) 도달 못 함 → parts 분류 깨짐.
// 통신사/번호이동/매입 token만 spread해서 안전.
const SMARTPHONE_BROAD_NOISE_W114D = [
  "번호이동", "번호 이동",
  "약정승계", "약정 승계",
  "할부승계", "할부 승계", "할부 잔여", "할부잔여",
  "개통폰",
  "kt 약정", "skt 약정", "skt 완납", "kt 완납",
  "lgu+ 약정", "유플 약정",
  "매입", "삽니다", "구합니다", "구해봅니다", "구매함", "최고가",
  "대여", "렌탈",
  ...COMMON_PRODUCT_NOISE,
];

const CATEGORY_NOISE_MAP_W94: Partial<Record<Sku["category"], readonly string[]>> = {
  // Wave 114d (2026-05-15): smartphone broad에 통신사/매입 noise만 spread (parts 토큰 제외).
  smartphone: SMARTPHONE_BROAD_NOISE_W114D,
  laptop: LAPTOP_NOISE,
  earphone: EARPHONE_NOISE_W94,
  smartwatch: SMARTWATCH_NOISE_W94,
  monitor: MONITOR_NOISE_W94,
  home_appliance: HOME_APPLIANCE_NOISE_W94,
  watch: WATCH_NOISE_W94,
  tablet: TABLET_NOISE_W94,
  speaker: SPEAKER_NOISE_W94,
};

const GENERATED_CATALOG_WITH_GATES: Sku[] = GENERATED_CATALOG.map((sku) => {
  const noise = CATEGORY_NOISE_MAP_W94[sku.category];
  if (!noise) return sku;
  return {
    ...sku,
    mustNotContain: [...new Set([...sku.mustNotContain, ...noise])],
  };
});

const CORE_SMARTPHONE_CATALOG: Sku[] = [
  {
    id: "iphone-11-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_11_pro_128gb_self",
    modelName: "iPhone 11 Pro 128GB (자급제)",
    aliases: ["아이폰 11 프로 128 자급제", "iPhone 11 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 11 프로", "아이폰11프로", "iphone 11 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 10", "iphone 10", "아이폰10",
      "아이폰 12", "iphone 12", "아이폰12",
      "xs", "xr",
      "64gb", "64 gb", "64기가",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1390000,
    released: 2019,
  },
  {
    id: "iphone-12-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_12_pro_128gb_self",
    modelName: "iPhone 12 Pro 128GB (자급제)",
    aliases: ["아이폰 12 프로 128 자급제", "iPhone 12 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 12 프로", "아이폰12프로", "iphone 12 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "미니", "mini",
      "플러스", "plus",
      "아이폰 11", "iphone 11", "아이폰11",
      "아이폰 13", "iphone 13", "아이폰13",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1350000,
    released: 2020,
  },
  {
    id: "iphone-13-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 13 Pro",
    aliases: ["아이폰 13 프로", "아이폰13프로", "iPhone 13 Pro"],
    // Wave 749c (2026-05-24): 한국 셀러 표기 변형 보강.
    //   "아이폰 13프로" (mid-space), "아이폰13 프로" (반대 mid-space) 등 모두 catch.
    mustContain: [["아이폰 13 프로", "아이폰13프로", "아이폰 13프로", "아이폰13 프로", "iphone 13 pro", "iphone13 pro", "iphone 13pro"]],
    mustNotContain: ["프로맥스", "프로 맥스", "promax", "프맥", "pro max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2021,
  },
  {
    id: "iphone-13-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_13_pro_128gb_self",
    modelName: "iPhone 13 Pro 128GB (자급제)",
    aliases: ["아이폰 13 프로 128 자급제", "iPhone 13 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 13 프로", "아이폰13프로", "iphone 13 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 12", "iphone 12", "아이폰12",
      "아이폰 14", "iphone 14", "아이폰14",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1350000,
    released: 2021,
  },
  {
    id: "iphone-13-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 13 Pro Max",
    aliases: ["아이폰 13 프로맥스", "아이폰13프로맥스", "iPhone 13 Pro Max"],
    // Wave 749d (2026-05-24): mid-space 변형 보강.
    mustContain: [["아이폰 13 프로맥스", "아이폰13프로맥스", "아이폰 13 프로 맥스", "아이폰 13프로맥스", "아이폰13 프로맥스", "아이폰13 프로 맥스", "아이폰 13프로 맥스", "iphone 13 pro max", "iphone13 pro max", "iphone 13pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1490000,
    released: 2021,
  },
  {
    id: "iphone-14-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 14 Pro",
    aliases: ["아이폰 14 프로", "아이폰14프로", "iPhone 14 Pro"],
    // Wave 749c: 한국 셀러 mid-space 변형 보강.
    mustContain: [["아이폰 14 프로", "아이폰14프로", "아이폰 14프로", "아이폰14 프로", "iphone 14 pro", "iphone14 pro", "iphone 14pro"]],
    mustNotContain: ["프로맥스", "프로 맥스", "promax", "프맥", "pro max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1550000,
    released: 2022,
  },
  {
    id: "iphone-14-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_14_pro_128gb_self",
    modelName: "iPhone 14 Pro 128GB (자급제)",
    aliases: ["아이폰 14 프로 128 자급제", "iPhone 14 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 14 프로", "아이폰14프로", "iphone 14 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 13", "iphone 13", "아이폰13",
      "아이폰 15", "iphone 15", "아이폰15",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1550000,
    released: 2022,
  },
  {
    id: "iphone-14-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 14 Pro Max",
    aliases: ["아이폰 14 프로맥스", "아이폰14프로맥스", "iPhone 14 Pro Max"],
    // Wave 749d: mid-space 변형 보강.
    mustContain: [["아이폰 14 프로맥스", "아이폰14프로맥스", "아이폰 14 프로 맥스", "아이폰 14프로맥스", "아이폰14 프로맥스", "아이폰14 프로 맥스", "아이폰 14프로 맥스", "iphone 14 pro max", "iphone14 pro max", "iphone 14pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1750000,
    released: 2022,
  },
  {
    id: "iphone-15-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 15 Pro Max",
    aliases: ["아이폰 15 프로맥스", "아이폰15프로맥스", "iPhone 15 Pro Max"],
    mustContain: [["아이폰 15 프로맥스", "아이폰15프로맥스", "아이폰 15 프로 맥스", "iphone 15 pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1900000,
    released: 2023,
  },
  {
    id: "iphone-15-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_15_pro_128gb_self",
    modelName: "iPhone 15 Pro 128GB (자급제)",
    aliases: ["아이폰 15 프로 128 자급제", "iPhone 15 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 15 프로", "아이폰15프로", "iphone 15 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 14", "iphone 14", "아이폰14",
      "아이폰 16", "iphone 16", "아이폰16",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1550000,
    released: 2023,
  },
  // Wave 114 (2026-05-15): iPhone Pro 256GB 자급제 narrow lane 3개 (Pro 시리즈).
  // 매물 측정 (broad iphone-15-pro/16-pro/14-pro 7일 sample 분석):
  // - "아이폰 16프로 256 데저트티타늄 자급제" 등 16 Pro 256 자급제 5건+
  // - "아이폰 15프로 화이트 256기가 자급제" 등 15 Pro 256 자급제 2건+
  // - 14 Pro 256 자급제도 매물 다수 (broad에 흡수 중)
  // Pro 시리즈는 128/256/512/1TB 옵션 4개. 256은 중간 옵션이라 매물 dense.
  {
    id: "iphone-15-pro-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_15_pro_256gb_self",
    modelName: "iPhone 15 Pro 256GB (자급제)",
    aliases: ["아이폰 15 프로 256 자급제", "iPhone 15 Pro 256 SIM-Free"],
    mustContain: [
      ["아이폰 15 프로", "아이폰15프로", "iphone 15 pro"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 14", "iphone 14", "아이폰14",
      "아이폰 16", "iphone 16", "아이폰16",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1700000,
    released: 2023,
  },
  {
    id: "iphone-16-pro-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_16_pro_256gb_self",
    modelName: "iPhone 16 Pro 256GB (자급제)",
    aliases: ["아이폰 16 프로 256 자급제", "iPhone 16 Pro 256 SIM-Free"],
    mustContain: [
      ["아이폰 16 프로", "아이폰16프로", "iphone 16 pro"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 15", "iphone 15", "아이폰15",
      "아이폰 17", "iphone 17", "아이폰17",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1850000,
    released: 2024,
  },
  {
    id: "iphone-14-pro-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_14_pro_256gb_self",
    modelName: "iPhone 14 Pro 256GB (자급제)",
    aliases: ["아이폰 14 프로 256 자급제", "iPhone 14 Pro 256 SIM-Free"],
    mustContain: [
      ["아이폰 14 프로", "아이폰14프로", "iphone 14 pro"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 13", "iphone 13", "아이폰13",
      "아이폰 15", "iphone 15", "아이폰15",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1550000,
    released: 2022,
  },
  {
    id: "iphone-16e",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 16e",
    aliases: ["아이폰 16e", "아이폰16e", "iPhone 16e"],
    mustContain: [["아이폰 16e", "아이폰16e", "iphone 16e"]],
    mustNotContain: ["프로", "pro", "프로맥스", "pro max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 990000,
    released: 2025,
  },
  // Wave 110 (2026-05-15): iPhone 15/16 일반(Pro 아닌) 256GB 자급제 narrow lane.
  // 매물 측정 자급제+256 명시: 15 일반 6건, 16 일반 8건.
  {
    id: "iphone-15-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_15_256gb_self",
    modelName: "iPhone 15 256GB (자급제)",
    aliases: ["아이폰 15 256 자급제", "iPhone 15 256 SIM-Free"],
    mustContain: [
      ["아이폰 15", "아이폰15", "iphone 15"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로", "pro", "프로맥스", "pro max", "promax", "프맥",
      "플러스", "plus",
      "16e", "아이폰 16", "iphone 16", "아이폰16",
      "아이폰 14", "iphone 14", "아이폰14",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1250000,
    released: 2023,
  },
  {
    id: "iphone-16-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_16_256gb_self",
    modelName: "iPhone 16 256GB (자급제)",
    aliases: ["아이폰 16 256 자급제", "iPhone 16 256 SIM-Free"],
    mustContain: [
      ["아이폰 16", "아이폰16", "iphone 16"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로", "pro", "프로맥스", "pro max", "promax", "프맥",
      "플러스", "plus",
      "16e",
      "아이폰 15", "iphone 15", "아이폰15",
      "아이폰 17", "iphone 17", "아이폰17",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1250000,
    released: 2024,
  },
  // Wave 111f (2026-05-15): iPhone Air (Apple 2025 신상) broad SKU.
  {
    id: "iphone-air",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone Air",
    aliases: ["아이폰 에어", "아이폰17 에어", "iPhone Air", "iPhone 17 Air"],
    mustContain: [["아이폰 에어", "아이폰에어", "아이폰17 에어", "아이폰 17 에어", "아이폰17에어", "iphone air", "iphone 17 air"]],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥",
      "플러스", "plus",
      "아이폰 15", "iphone 15", "아이폰15",
      "아이폰 16", "iphone 16", "아이폰16",
      "아이폰 14", "iphone 14", "아이폰14",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2025,
  },
  // Wave 111f: Galaxy Z Flip 7 broad SKU (Samsung 2025-07 신상).
  {
    id: "galaxy-z-flip-7",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Flip 7",
    aliases: ["갤럭시 Z 플립 7", "갤럭시Z플립7", "Galaxy Z Flip 7"],
    mustContain: [["갤럭시 z플립7", "갤럭시z플립7", "갤럭시 z 플립 7", "z플립7", "z 플립 7", "galaxy z flip 7", "z flip 7"]],
    mustNotContain: [
      "z플립6", "z flip 6", "갤럭시z플립6",
      "z플립5", "z flip 5", "갤럭시z플립5",
      "z플립4", "z flip 4",
      "z플립3", "z flip 3",
      "폴드", "fold",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2025,
  },
  // Wave 111f: iPhone Air 자급제 narrow lane (256/512).
  {
    id: "iphone-air-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_air_256gb_self",
    modelName: "iPhone Air 256GB (자급제)",
    aliases: ["아이폰 에어 256 자급제", "iPhone Air 256 SIM-Free", "아이폰 17 에어"],
    mustContain: [
      ["아이폰 에어", "아이폰에어", "아이폰17 에어", "아이폰 17 에어", "아이폰17에어", "iphone air", "iphone 17 air"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "아이폰 프로", "iphone pro", "프로맥스", "pro max", "promax", "프맥",
      "플러스", "plus",
      "아이폰 16", "iphone 16", "아이폰16",
      "아이폰 15", "iphone 15", "아이폰15",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "128gb", "128 gb", "128기가",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2025,
  },
  {
    id: "iphone-air-512-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_air_512gb_self",
    modelName: "iPhone Air 512GB (자급제)",
    aliases: ["아이폰 에어 512 자급제", "iPhone Air 512 SIM-Free"],
    mustContain: [
      ["아이폰 에어", "아이폰에어", "아이폰17 에어", "아이폰 17 에어", "아이폰17에어", "iphone air", "iphone 17 air"],
      ["512gb", "512 gb", "512기가"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "아이폰 프로", "iphone pro", "프로맥스", "pro max", "promax", "프맥",
      "플러스", "plus",
      "아이폰 16", "iphone 16", "아이폰16",
      "아이폰 15", "iphone 15", "아이폰15",
      "256gb", "256 gb", "256기가",
      "1tb", "1 tb", "1테라",
      "128gb", "128 gb", "128기가",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1700000,
    released: 2025,
  },
  // Wave 111f: Galaxy Z Flip 7 (Samsung 2025-07 신상) 자급제 narrow lane.
  {
    id: "galaxy-z-flip-7-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_z_flip_7_256_self",
    modelName: "Galaxy Z Flip 7 256GB (자급제)",
    aliases: ["갤럭시 Z 플립 7 256 자급제", "Galaxy Z Flip 7 256 SIM-Free"],
    mustContain: [
      ["갤럭시 z플립7", "갤럭시z플립7", "갤럭시 z 플립 7", "z플립7", "z 플립 7", "galaxy z flip 7", "z flip 7"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "z플립6", "z flip 6", "갤럭시z플립6",
      "z플립5", "z flip 5", "갤럭시z플립5",
      "z플립4", "z flip 4",
      "z플립3", "z flip 3",
      "폴드", "fold",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "128gb", "128 gb", "128기가",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1500000,
    released: 2025,
  },
  {
    id: "iphone-16-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 16 Pro",
    aliases: ["아이폰 16 프로", "아이폰16프로", "iPhone 16 Pro"],
    // Wave 749c: 한국 셀러 mid-space 변형 보강.
    mustContain: [["아이폰 16 프로", "아이폰16프로", "아이폰 16프로", "아이폰16 프로", "iphone 16 pro", "iphone16 pro", "iphone 16pro"]],
    mustNotContain: ["프로맥스", "프로 맥스", "promax", "프맥", "pro max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1550000,
    released: 2024,
  },
  {
    id: "iphone-16-pro-128-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_16_pro_128gb_self",
    modelName: "iPhone 16 Pro 128GB (자급제)",
    aliases: ["아이폰 16 프로 128 자급제", "iPhone 16 Pro 128 SIM-Free"],
    mustContain: [
      ["아이폰 16 프로", "아이폰16프로", "iphone 16 pro"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로맥스", "pro max", "promax", "프맥", "프로 맥스",
      "플러스", "plus",
      "아이폰 15", "iphone 15", "아이폰15",
      "아이폰 17", "iphone 17", "아이폰17",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1550000,
    released: 2024,
  },
  {
    id: "iphone-16-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 16 Pro Max",
    aliases: ["아이폰 16 프로맥스", "아이폰16프로맥스", "iPhone 16 Pro Max"],
    // Wave 749d: mid-space 변형 보강.
    mustContain: [["아이폰 16 프로맥스", "아이폰16프로맥스", "아이폰 16 프로 맥스", "아이폰 16프로맥스", "아이폰16 프로맥스", "아이폰16 프로 맥스", "아이폰 16프로 맥스", "iphone 16 pro max", "iphone16 pro max", "iphone 16pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1900000,
    released: 2024,
  },
  // Wave 117e (2026-05-15): iPhone 행렬 완전 audit — 매물 빈도 측정 후 일괄 누락 broad SKU 추가.
  // 측정: 15 Pro 795, 15/16 일반 861, 13/14 일반 723, 14/15/16 Plus 268, 11/12 시리즈 233 (다 sku_id null).
  {
    id: "iphone-11",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 11",
    aliases: ["아이폰 11", "아이폰11", "iPhone 11"],
    mustContain: [["아이폰 11", "아이폰11", "iphone 11"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "플러스", "plus", "미니", "mini", ...PHONE_NOISE],
    msrpKrw: 950000,
    released: 2019,
  },
  {
    id: "iphone-11-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 11 Pro",
    aliases: ["아이폰 11 프로", "아이폰11프로", "iPhone 11 Pro"],
    // Wave 749e: mid-space 보강.
    mustContain: [["아이폰 11 프로", "아이폰11프로", "아이폰 11프로", "아이폰11 프로", "iphone 11 pro", "iphone11 pro", "iphone 11pro"]],
    mustNotContain: ["맥스", "max", "프로맥스", "promax", "프로 맥스", "프맥", ...PHONE_NOISE],
    msrpKrw: 1390000,
    released: 2019,
  },
  {
    id: "iphone-11-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 11 Pro Max",
    aliases: ["아이폰 11 프로맥스", "아이폰11프로맥스", "iPhone 11 Pro Max"],
    // Wave 749e: mid-space 보강.
    mustContain: [["아이폰 11 프로맥스", "아이폰11프로맥스", "아이폰 11 프로 맥스", "아이폰 11프로맥스", "아이폰11 프로맥스", "아이폰11 프로 맥스", "아이폰 11프로 맥스", "iphone 11 pro max", "iphone11 pro max", "iphone 11pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1550000,
    released: 2019,
  },
  // iphone-12 — GENERATED_CATALOG에 이미 있음. CORE 추가 X.
  {
    id: "iphone-12-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 12 Pro",
    aliases: ["아이폰 12 프로", "아이폰12프로", "iPhone 12 Pro"],
    // Wave 749e: mid-space 보강.
    mustContain: [["아이폰 12 프로", "아이폰12프로", "아이폰 12프로", "아이폰12 프로", "iphone 12 pro", "iphone12 pro", "iphone 12pro"]],
    mustNotContain: ["맥스", "max", "프로맥스", "promax", "프로 맥스", "프맥", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2020,
  },
  {
    id: "iphone-12-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 12 Pro Max",
    aliases: ["아이폰 12 프로맥스", "아이폰12프로맥스", "iPhone 12 Pro Max"],
    // Wave 749e: mid-space 보강.
    mustContain: [["아이폰 12 프로맥스", "아이폰12프로맥스", "아이폰 12 프로 맥스", "아이폰 12프로맥스", "아이폰12 프로맥스", "아이폰12 프로 맥스", "아이폰 12프로 맥스", "iphone 12 pro max", "iphone12 pro max", "iphone 12pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1490000,
    released: 2020,
  },
  // iphone-13, iphone-14 — GENERATED_CATALOG에 이미 있음. CORE 추가 X.
  {
    id: "iphone-14-plus",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 14 Plus",
    aliases: ["아이폰 14 플러스", "아이폰14플러스", "iPhone 14 Plus"],
    // Wave 749d: mid-space 보강.
    mustContain: [["아이폰 14 플러스", "아이폰14플러스", "iphone 14 plus", "아이폰 14+", "아이폰 14플러스", "아이폰14 플러스", "iphone14 plus", "iphone 14plus", "아이폰14+", "iphone14+"]],
    mustNotContain: ["프로", "pro", "맥스", "max", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2022,
  },
  // iphone-15 — GENERATED_CATALOG에 이미 있음. CORE 추가 X.
  {
    id: "iphone-15-plus",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 15 Plus",
    aliases: ["아이폰 15 플러스", "아이폰15플러스", "iPhone 15 Plus"],
    // Wave 749d: mid-space 보강.
    mustContain: [["아이폰 15 플러스", "아이폰15플러스", "iphone 15 plus", "아이폰 15+", "아이폰 15플러스", "아이폰15 플러스", "iphone15 plus", "iphone 15plus", "아이폰15+", "iphone15+"]],
    mustNotContain: ["프로", "pro", "맥스", "max", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2023,
  },
  // iphone-15-pro, iphone-16 — GENERATED_CATALOG에 이미 있음. CORE 추가 X.
  {
    id: "iphone-16-plus",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 16 Plus",
    aliases: ["아이폰 16 플러스", "아이폰16플러스", "iPhone 16 Plus"],
    // Wave 749d: mid-space 보강.
    mustContain: [["아이폰 16 플러스", "아이폰16플러스", "iphone 16 plus", "아이폰 16+", "아이폰 16플러스", "아이폰16 플러스", "iphone16 plus", "iphone 16plus", "아이폰16+", "iphone16+"]],
    mustNotContain: ["프로", "pro", "맥스", "max", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2024,
  },
  {
    id: "iphone-17-plus",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 17 Plus",
    aliases: ["아이폰 17 플러스", "아이폰17플러스", "iPhone 17 Plus"],
    // Wave 749d: mid-space 보강.
    mustContain: [["아이폰 17 플러스", "아이폰17플러스", "iphone 17 plus", "아이폰 17+", "아이폰 17플러스", "아이폰17 플러스", "iphone17 plus", "iphone 17plus", "아이폰17+", "iphone17+"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "에어", "air", ...PHONE_NOISE],
    msrpKrw: 1450000,
    released: 2025,
  },
  // Wave 117 (2026-05-15): iPhone 누락 모델 일괄 추가 — 14일 매물 측정 결과:
  // - iPhone 13 mini: 772건 (catalog X) ⭐
  // - iPhone SE 시리즈: 493건 (catalog X)
  // - iPhone 17 시리즈: 276건 (2025-09 출시, Wave 111f 시점엔 미출시였음)
  // - iPhone 12 mini: 167건
  {
    id: "iphone-12-mini",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 12 mini",
    aliases: ["아이폰 12 미니", "아이폰12 미니", "아이폰 12미니", "아이폰12미니", "iPhone 12 mini"],
    mustContain: [["아이폰 12 미니", "아이폰12 미니", "아이폰 12미니", "아이폰12미니", "iphone 12 mini", "iphone12 mini"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 950000,
    released: 2020,
  },
  {
    id: "iphone-13-mini",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 13 mini",
    aliases: ["아이폰 13 미니", "아이폰13 미니", "아이폰 13미니", "아이폰13미니", "iPhone 13 mini"],
    mustContain: [["아이폰 13 미니", "아이폰13 미니", "아이폰 13미니", "아이폰13미니", "iphone 13 mini", "iphone13 mini"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 950000,
    released: 2021,
  },
  // iPhone SE 시리즈 — 2세대 (2020), 3세대 (2022). 1세대 (2016) 제거: 9년 정책.
  {
    id: "iphone-se2",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone SE (2nd gen, 2020)",
    aliases: ["아이폰 SE 2세대", "아이폰SE 2세대", "iPhone SE 2020", "아이폰 SE2"],
    mustContain: [["아이폰 se 2", "아이폰se 2", "아이폰 se2", "아이폰se2", "iphone se 2", "iphone se2", "se 2세대", "se2세대", "se 2020"]],
    mustNotContain: ["se3", "se 3", "3세대", "se 1", "1세대", "프로", "pro", "맥스", "max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 590000,
    released: 2020,
  },
  {
    id: "iphone-se3",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone SE (3rd gen, 2022)",
    aliases: ["아이폰 SE 3세대", "아이폰SE 3세대", "iPhone SE 2022", "아이폰 SE3"],
    mustContain: [["아이폰 se 3", "아이폰se 3", "아이폰 se3", "아이폰se3", "iphone se 3", "iphone se3", "se 3세대", "se3세대", "se 2022"]],
    mustNotContain: ["se2", "se 2", "2세대", "se 1", "1세대", "프로", "pro", "맥스", "max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 650000,
    released: 2022,
  },
  // iPhone 17 시리즈 (2025-09 출시).
  {
    id: "iphone-17",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 17",
    aliases: ["아이폰 17", "아이폰17", "iPhone 17"],
    mustContain: [["아이폰 17", "아이폰17", "iphone 17"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "플러스", "plus", "에어", "air", " e ", "17e", ...PHONE_NOISE],
    msrpKrw: 1250000,
    released: 2025,
  },
  {
    id: "iphone-17-pro",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 17 Pro",
    aliases: ["아이폰 17 프로", "아이폰17프로", "iPhone 17 Pro"],
    // Wave 749c: 한국 셀러 mid-space 변형 보강.
    mustContain: [["아이폰 17 프로", "아이폰17프로", "아이폰 17프로", "아이폰17 프로", "iphone 17 pro", "iphone17 pro", "iphone 17pro"]],
    mustNotContain: ["프로맥스", "promax", "pro max", "프로 맥스", "프맥", ...PHONE_NOISE],
    msrpKrw: 1700000,
    released: 2025,
  },
  {
    id: "iphone-17-pro-max",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 17 Pro Max",
    aliases: ["아이폰 17 프로맥스", "아이폰17프로맥스", "iPhone 17 Pro Max"],
    // Wave 749d: mid-space 변형 보강.
    mustContain: [["아이폰 17 프로맥스", "아이폰17프로맥스", "아이폰 17 프로 맥스", "아이폰 17프로맥스", "아이폰17 프로맥스", "아이폰17 프로 맥스", "아이폰 17프로 맥스", "iphone 17 pro max", "iphone17 pro max", "iphone 17pro max"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 2100000,
    released: 2025,
  },
  {
    id: "iphone-17e",
    brand: "Apple",
    category: "smartphone",
    modelName: "iPhone 17e",
    aliases: ["아이폰 17e", "아이폰17e", "iPhone 17e"],
    mustContain: [["아이폰 17e", "아이폰17e", "iphone 17e"]],
    mustNotContain: ["프로", "pro", "맥스", "max", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 990000,
    released: 2026,
  },
  // Wave 108 (2026-05-15): iPhone Pro Max 256GB 자급제 narrow lane 신설. 매물 89건 (15: 37, 16: 52).
  {
    id: "iphone-15-pro-max-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_15_pro_max_256gb_self",
    modelName: "iPhone 15 Pro Max 256GB (자급제)",
    aliases: ["아이폰 15 프로맥스 256 자급제", "iPhone 15 Pro Max 256 SIM-Free"],
    mustContain: [
      ["아이폰 15 프로맥스", "아이폰15프로맥스", "아이폰 15 프로 맥스", "iphone 15 pro max"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "플러스", "plus",
      "아이폰 14", "iphone 14", "아이폰14",
      "아이폰 16", "iphone 16", "아이폰16",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "128gb", "128 gb", "128기가",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1900000,
    released: 2023,
  },
  {
    id: "iphone-16-pro-max-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_16_pro_max_256gb_self",
    modelName: "iPhone 16 Pro Max 256GB (자급제)",
    aliases: ["아이폰 16 프로맥스 256 자급제", "iPhone 16 Pro Max 256 SIM-Free"],
    mustContain: [
      ["아이폰 16 프로맥스", "아이폰16프로맥스", "아이폰 16 프로 맥스", "iphone 16 pro max"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "플러스", "plus",
      "아이폰 15", "iphone 15", "아이폰15",
      "아이폰 17", "iphone 17", "아이폰17",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "128gb", "128 gb", "128기가",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1900000,
    released: 2024,
  },
  // Wave 182 Phase 2 chunk 4 (2026-05-17): Galaxy S20 시리즈 (2020.2) — 누락.
  // Wave 604 (2026-05-22): production false positive 발견 — pid 167726339 '후지 x-s20', 408889097 '삼성 비스포크 vs20',
  //   408917411 '가민 랠리 RS200', 409026880 '투어이슈 S200' 골프 샤프트 다 galaxy_s20|128gb 매칭.
  // Wave 604b: brand 강제는 줄임 표기 ('S23울트라') 정상 매물도 차단 → mustNotContain 차단어만 유지.
  {
    id: "galaxy-s20",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S20",
    aliases: ["갤럭시 S20", "갤럭시S20", "Galaxy S20"],
    mustContain: [["갤럭시 s20", "갤럭시s20", "galaxy s20", "s20"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션", "노트", "note", ...PHONE_NOISE,
      // Wave 604: 다른 카테고리 false positive 차단.
      "후지", "fuji", "fujifilm", "x-s20", "x s20",  // Fujifilm 카메라
      "비스포크", "bespoke", "청소기", "vacuum", "vs20",  // 삼성 청소기
      "가민", "garmin", "랠리", "rally", "rs200",  // Garmin 자전거 파워미터
      "골프", "골프채", "아이언", "퍼터", "샤프트", "s200", "x100", "s300",  // 골프 (다이나믹 골드 샤프트)
      "타이틀리스트", "titleist", "캘러웨이", "callaway", "테일러메이드", "taylormade",
      "미즈노", "mizuno", "브리지스톤", "bridgestone", "스릭슨", "srixon", "에폰", "epon",
      "로디아", "rodio", "rodd", "조디아", "포지드", "forged",
      // Wave 604b: 추가 광범위 false positive.
      "캐논", "canon", "파워샷", "powershot",  // Canon 카메라
      "리솜", "레스트리", "숙박",  // 숙박권 양도
      "callas20", "soocoo", "yas207", "xls202",  // 자전거/액션캠/사운드바/앰프 model code
      "벨로스터", "veloster", "터빈", "turbine",  // 자동차 부품
      "ns207", "샤프", "펜텔",  // 골프 셔츠 + 문구
      "토미카", "tomica", "1:64", "1/64", "미니카",  // 미니카
      "스프린터", "hs2069", "byss20",  // 아디다스 의류 model code
    ],
    msrpKrw: 1359000,
    released: 2020,
  },
  {
    id: "galaxy-s20-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S20 Plus",
    aliases: ["갤럭시 S20 플러스", "갤럭시S20+", "Galaxy S20 Plus"],
    mustContain: [["갤럭시 s20", "갤럭시s20", "galaxy s20", "s20"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", "노트", "note", ...PHONE_NOISE],
    msrpKrw: 1499000,
    released: 2020,
  },
  {
    id: "galaxy-s20-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S20 Ultra",
    aliases: ["갤럭시 S20 울트라", "갤럭시S20 울트라", "Galaxy S20 Ultra"],
    mustContain: [["갤럭시 s20", "갤럭시s20", "galaxy s20", "s20"], ["울트라", "ultra"]],
    mustNotContain: ["fe", "팬에디션", "노트", "note", "s21", "s22", "s23", ...PHONE_NOISE],
    msrpKrw: 1599000,
    released: 2020,
  },
  {
    id: "galaxy-s21",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S21",
    aliases: ["갤럭시 S21", "갤럭시S21", "Galaxy S21"],
    // Wave 753c (2026-05-24) Pareto: 240x audit — bare "s21" 제거. brand context 필수.
    // 발견: "톤28 샴푸바 S21" / "육육걸즈 F_S2120" / "젝시믹스 XL_S2125" 같은
    // 의류/skincare item code "S21XX" 대량 false match.
    mustContain: [["갤럭시 s21", "갤럭시s21", "galaxy s21"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션", "노트", "note",
      // 의류/skincare item code (PS21XX / F_S21XX / TOUN28 / 톤28)
      "toun28", "톤28", "샴푸바", "바디워시 s2",
      ...PHONE_NOISE],
    msrpKrw: 999000,
    released: 2021,
  },
  {
    id: "galaxy-s22",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S22",
    aliases: ["갤럭시 S22", "갤럭시S22", "Galaxy S22"],
    // Wave 753c (2026-05-24) Pareto: 250x audit — bare "s22" 제거.
    // 발견: "PS22184" 같은 PlayStation 2 일본판 게임 카트리지 일련번호 false match.
    mustContain: [["갤럭시 s22", "갤럭시s22", "galaxy s22"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션",
      // PS2 게임 일련번호 (PS22XXX = PlayStation 2 카탈로그 번호)
      "ps2", "ps 2", "playstation 2", "여성향", "일본판",
      "ps22", "ps 22",
      ...PHONE_NOISE],
    msrpKrw: 999000,
    released: 2022,
  },
  // galaxy-s23, galaxy-s24 — GENERATED_CATALOG에 이미 있음. CORE 추가 X.
  {
    id: "galaxy-note20",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Note 20",
    aliases: ["갤럭시 노트20", "갤럭시노트20", "Galaxy Note 20"],
    mustContain: [["갤럭시 노트20", "갤럭시노트20", "galaxy note 20", "galaxy note20", "노트20"]],
    mustNotContain: ["울트라", "ultra", "노트10", "노트8", "노트9", "note 10", "note 8", "note 9", ...PHONE_NOISE],
    msrpKrw: 1199000,
    released: 2020,
  },
  // Wave 182 Phase 2 chunk 4 (2026-05-17): Galaxy Note 20 Ultra + Note 10/10+ (2019/2020) — 누락.
  {
    id: "galaxy-note20-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Note 20 Ultra",
    aliases: ["갤럭시 노트20 울트라", "갤럭시노트20 울트라", "Galaxy Note 20 Ultra"],
    mustContain: [["갤럭시 노트20", "갤럭시노트20", "galaxy note 20", "galaxy note20", "노트20"], ["울트라", "ultra"]],
    mustNotContain: ["노트10", "노트8", "노트9", "note 10", "note 8", "note 9", ...PHONE_NOISE],
    msrpKrw: 1450000,
    released: 2020,
  },
  {
    id: "galaxy-note10",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Note 10",
    aliases: ["갤럭시 노트10", "갤럭시노트10", "Galaxy Note 10"],
    mustContain: [["갤럭시 노트10", "갤럭시노트10", "galaxy note 10", "galaxy note10", "노트10"]],
    mustNotContain: ["플러스", "plus", "+", "노트20", "노트8", "노트9", "note 20", "note 8", "note 9", ...PHONE_NOISE],
    msrpKrw: 1099000,
    released: 2019,
  },
  {
    id: "galaxy-note10-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Note 10 Plus",
    aliases: ["갤럭시 노트10 플러스", "갤럭시노트10+", "Galaxy Note 10 Plus"],
    mustContain: [["갤럭시 노트10", "갤럭시노트10", "galaxy note 10", "galaxy note10", "노트10"], ["플러스", "plus", "+"]],
    mustNotContain: ["노트20", "노트8", "노트9", "note 20", "note 8", "note 9", ...PHONE_NOISE],
    msrpKrw: 1249000,
    released: 2019,
  },
  {
    id: "galaxy-s21-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S21 Plus",
    aliases: ["갤럭시 S21 플러스", "갤럭시S21플러스", "Galaxy S21 Plus", "S21+"],
    mustContain: [["갤럭시 s21 플러스", "갤럭시s21플러스", "galaxy s21 plus", "s21 plus", "s21+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1199000,
    released: 2021,
  },
  {
    id: "galaxy-s22-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S22 Plus",
    aliases: ["갤럭시 S22 플러스", "갤럭시S22플러스", "Galaxy S22 Plus", "S22+"],
    mustContain: [["갤럭시 s22 플러스", "갤럭시s22플러스", "galaxy s22 plus", "s22 plus", "s22+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1199000,
    released: 2022,
  },
  {
    id: "galaxy-s23-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S23 Plus",
    aliases: ["갤럭시 S23 플러스", "갤럭시S23플러스", "Galaxy S23 Plus", "S23+"],
    mustContain: [["갤럭시 s23 플러스", "갤럭시s23플러스", "galaxy s23 plus", "s23 plus", "s23+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2023,
  },
  {
    id: "galaxy-s23-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S23 Ultra",
    aliases: ["갤럭시 S23 울트라", "갤럭시S23울트라", "Galaxy S23 Ultra"],
    mustContain: [["갤럭시 s23 울트라", "갤럭시s23울트라", "galaxy s23 ultra", "s23 ultra"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1600000,
    released: 2023,
  },
  {
    id: "galaxy-s24-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S24 Ultra",
    aliases: ["갤럭시 S24 울트라", "갤럭시S24울트라", "Galaxy S24 Ultra"],
    mustContain: [["갤럭시 s24 울트라", "갤럭시s24울트라", "galaxy s24 ultra", "s24 ultra"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1700000,
    released: 2024,
  },
  {
    id: "galaxy-s24-ultra-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s24_ultra_256_self",
    modelName: "Galaxy S24 Ultra 256GB (자급제)",
    aliases: ["갤럭시 S24 울트라 256 자급제", "Galaxy S24 Ultra 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s24 울트라", "갤럭시s24울트라", "galaxy s24 ultra", "s24 ultra"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "s23", "갤럭시 s23", "galaxy s23",
      "s25", "갤럭시 s25", "galaxy s25",
      "플러스", "plus", "일반", "basic",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1700000,
    released: 2024,
  },
  {
    id: "galaxy-s25",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S25",
    aliases: ["갤럭시 S25", "갤럭시S25", "Galaxy S25"],
    mustContain: [["갤럭시 s25", "갤럭시s25", "galaxy s25", "s25"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션", "엣지", "edge", "gs25", ...PHONE_NOISE],
    msrpKrw: 1150000,
    released: 2025,
  },
  // Wave 114 (2026-05-15): Galaxy S25 Edge (2025-05 출시, 신모델 얇은 디자인).
  // 매물 측정: 7일 broad galaxy-s25 sample 분석 결과 "갤럭시s25엣지 512gb 자급제" 등 5건+ 흡수 중.
  // S25 Edge는 일반 S25와 별도 모델 (얇은 폼팩터, 카메라 다름). catalog 누락이었음.
  {
    id: "galaxy-s25-edge",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S25 Edge",
    aliases: ["갤럭시 S25 엣지", "갤럭시S25엣지", "Galaxy S25 Edge"],
    mustContain: [["갤럭시 s25 엣지", "갤럭시s25엣지", "galaxy s25 edge", "s25 엣지", "s25 edge"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1499000,
    released: 2025,
    confusionNote: "Edge = 별도 모델 (2025-05 신상, 얇은 폼팩터, 512GB 단일). 일반 S25 (256/512), S25 Plus, Ultra, FE 다 별도.",
  },
  // Wave 108 (2026-05-15): Galaxy S 일반 (Ultra/Plus 아닌) 256GB 자급제 narrow lane.
  // 매물 측정: s23 자급제 55, s24 자급제 46, s25 자급제 38. 총 139건.
  {
    id: "galaxy-s21-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s21_256_self",
    modelName: "Galaxy S21 256GB (자급제)",
    aliases: ["갤럭시 S21 256 자급제", "Galaxy S21 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s21", "갤럭시s21", "galaxy s21"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "울트라", "ultra", "플러스", "plus", "fe", "팬에디션",
      "s20", "갤럭시 s20", "galaxy s20",
      "s22", "갤럭시 s22", "galaxy s22",
      "s23", "갤럭시 s23", "galaxy s23",
      "노트", "note",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 999000,
    released: 2021,
  },
  {
    id: "galaxy-s22-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s22_256_self",
    modelName: "Galaxy S22 256GB (자급제)",
    aliases: ["갤럭시 S22 256 자급제", "Galaxy S22 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s22", "갤럭시s22", "galaxy s22"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "울트라", "ultra", "플러스", "plus", "fe", "팬에디션",
      "s21", "갤럭시 s21", "galaxy s21",
      "s23", "갤럭시 s23", "galaxy s23",
      "s24", "갤럭시 s24", "galaxy s24",
      "노트", "note",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 999000,
    released: 2022,
  },
  {
    id: "iphone-13-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_13_256gb_self",
    modelName: "iPhone 13 256GB (자급제)",
    aliases: ["아이폰 13 256 자급제", "iPhone 13 256 SIM-Free"],
    mustContain: [
      ["아이폰 13", "아이폰13", "iphone 13"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로", "pro", "맥스", "max", "미니", "mini",
      "아이폰 12", "iphone 12", "아이폰12",
      "아이폰 14", "iphone 14", "아이폰14",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1090000,
    released: 2021,
  },
  {
    id: "iphone-14-256-self",
    brand: "Apple",
    category: "smartphone",
    laneKey: "iphone_14_256gb_self",
    modelName: "iPhone 14 256GB (자급제)",
    aliases: ["아이폰 14 256 자급제", "iPhone 14 256 SIM-Free"],
    mustContain: [
      ["아이폰 14", "아이폰14", "iphone 14"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "프로", "pro", "맥스", "max", "플러스", "plus",
      "아이폰 13", "iphone 13", "아이폰13",
      "아이폰 15", "iphone 15", "아이폰15",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1250000,
    released: 2022,
  },
  {
    id: "galaxy-s23-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s23_256_self",
    modelName: "Galaxy S23 256GB (자급제)",
    aliases: ["갤럭시 S23 256 자급제", "Galaxy S23 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s23", "갤럭시s23", "galaxy s23"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "울트라", "ultra", "플러스", "plus", "fe", "팬에디션",
      "s22", "갤럭시 s22", "galaxy s22",
      "s24", "갤럭시 s24", "galaxy s24",
      "s25", "갤럭시 s25", "galaxy s25",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1200000,
    released: 2023,
  },
  {
    id: "galaxy-s24-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s24_256_self",
    modelName: "Galaxy S24 256GB (자급제)",
    aliases: ["갤럭시 S24 256 자급제", "Galaxy S24 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s24", "갤럭시s24", "galaxy s24"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "울트라", "ultra", "플러스", "plus", "fe", "팬에디션",
      "s23", "갤럭시 s23", "galaxy s23",
      "s25", "갤럭시 s25", "galaxy s25",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1250000,
    released: 2024,
  },
  {
    id: "galaxy-s25-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s25_256_self",
    modelName: "Galaxy S25 256GB (자급제)",
    aliases: ["갤럭시 S25 256 자급제", "Galaxy S25 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s25", "갤럭시s25", "galaxy s25"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "울트라", "ultra", "플러스", "plus", "fe", "팬에디션", "엣지", "edge",
      "s23", "갤럭시 s23", "galaxy s23",
      "s24", "갤럭시 s24", "galaxy s24",
      "s26", "갤럭시 s26", "galaxy s26",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1300000,
    released: 2025,
  },
  {
    id: "galaxy-s25-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S25 Plus",
    aliases: ["갤럭시 S25 플러스", "갤럭시S25플러스", "Galaxy S25 Plus"],
    mustContain: [["갤럭시 s25 플러스", "갤럭시s25플러스", "galaxy s25 plus", "s25 plus"]],
    mustNotContain: ["울트라", "ultra", ...PHONE_NOISE],
    msrpKrw: 1350000,
    released: 2025,
  },
  {
    id: "galaxy-s25-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S25 Ultra",
    aliases: ["갤럭시 S25 울트라", "갤럭시S25울트라", "Galaxy S25 Ultra"],
    mustContain: [["갤럭시 s25 울트라", "갤럭시s25울트라", "galaxy s25 ultra", "s25 ultra"]],
    mustNotContain: ["플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 1700000,
    released: 2025,
  },
  {
    id: "galaxy-s25-ultra-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s25_ultra_256_self",
    modelName: "Galaxy S25 Ultra 256GB (자급제)",
    aliases: ["갤럭시 S25 울트라 256 자급제", "Galaxy S25 Ultra 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s25 울트라", "갤럭시s25울트라", "galaxy s25 ultra", "s25 ultra"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "s24", "갤럭시 s24", "galaxy s24",
      "s23", "갤럭시 s23", "galaxy s23",
      "s26", "갤럭시 s26", "galaxy s26",
      "플러스", "plus", "일반", "basic",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1700000,
    released: 2025,
  },
  {
    id: "galaxy-s23-ultra-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_s23_ultra_256_self",
    modelName: "Galaxy S23 Ultra 256GB (자급제)",
    aliases: ["갤럭시 S23 울트라 256 자급제", "Galaxy S23 Ultra 256 SIM-Free"],
    mustContain: [
      ["갤럭시 s23 울트라", "갤럭시s23울트라", "galaxy s23 ultra", "s23 ultra"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "s22", "갤럭시 s22", "galaxy s22",
      "s24", "갤럭시 s24", "galaxy s24",
      "s25", "갤럭시 s25", "galaxy s25",
      "s26", "갤럭시 s26", "galaxy s26",
      "플러스", "plus", "일반", "basic",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1600000,
    released: 2023,
  },
  // Wave 112 (2026-05-15): Galaxy S FE (Fan Edition) broad SKU 3개.
  // 매물 측정: 30분 sweep null sample에서 "갤럭시S23FE 256기가" 8건+, "갤럭시S24FE 256기가" 3건,
  // "갤럭시 S25 FE 256GB" 1건. catalog 누락이었음. FE는 일반/Ultra/Plus와 별도 모델 (저가 라인).
  {
    id: "galaxy-s23-fe",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S23 FE",
    aliases: ["갤럭시 S23 FE", "갤럭시S23FE", "Galaxy S23 FE", "S23 팬에디션"],
    mustContain: [["갤럭시 s23 fe", "갤럭시s23 fe", "갤럭시s23fe", "galaxy s23 fe", "s23 fe", "s23fe", "s23 팬에디션"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 850000,
    released: 2023,
    confusionNote: "FE (Fan Edition) = 저가 라인 (msrp ₩850K). 일반 S23 (1.2M), Ultra (1.6M), Plus 다 별도. 가격 ~30% 낮음.",
  },
  {
    id: "galaxy-s24-fe",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S24 FE",
    aliases: ["갤럭시 S24 FE", "갤럭시S24FE", "Galaxy S24 FE", "S24 팬에디션"],
    mustContain: [["갤럭시 s24 fe", "갤럭시s24 fe", "갤럭시s24fe", "galaxy s24 fe", "s24 fe", "s24fe", "s24 팬에디션"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 949000,
    released: 2024,
  },
  {
    id: "galaxy-s25-fe",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S25 FE",
    aliases: ["갤럭시 S25 FE", "갤럭시S25FE", "Galaxy S25 FE", "S25 팬에디션"],
    mustContain: [["갤럭시 s25 fe", "갤럭시s25 fe", "갤럭시s25fe", "galaxy s25 fe", "s25 fe", "s25fe", "s25 팬에디션"]],
    mustNotContain: ["울트라", "ultra", "플러스", "plus", ...PHONE_NOISE],
    msrpKrw: 999000,
    released: 2025,
  },
  // Wave 112 (2026-05-15): Galaxy S26 시리즈 broad SKU 3개 (2026-01 신상).
  // 매물 측정: 30분 sweep null sample에서 "S26 울트라" 7건+, "S26 일반" 2건, "S26 256GB" 2건.
  // 출시 즉시 매물 활발. catalog 누락이었음.
  {
    id: "galaxy-s26",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S26",
    aliases: ["갤럭시 S26", "갤럭시S26", "Galaxy S26"],
    mustContain: [["갤럭시 s26", "갤럭시s26", "galaxy s26", "s26"]],
    // Wave 751b Pareto: 545x audit — Chanel SS26 collection + 붕스 키레네 오르골 false match.
    mustNotContain: ["울트라", "ultra", "플러스", "plus", "fe", "팬에디션", "gs26",
      "ss26", "ss 26", "fw26", "fw 26", // Chanel/명품 시즌 코드
      "샤넬", "chanel", "디올", "dior", "구찌", "gucci",
      "오르골", "music box", "키레네", "붕스",
      ...PHONE_NOISE],
    msrpKrw: 1250000,
    released: 2026,
  },
  {
    id: "galaxy-s26-plus",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S26 Plus",
    aliases: ["갤럭시 S26 플러스", "갤럭시S26플러스", "Galaxy S26 Plus", "S26+"],
    mustContain: [["갤럭시 s26 플러스", "갤럭시s26플러스", "galaxy s26 plus", "s26 plus", "s26+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1450000,
    released: 2026,
  },
  {
    id: "galaxy-s26-ultra",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy S26 Ultra",
    aliases: ["갤럭시 S26 울트라", "갤럭시S26울트라", "Galaxy S26 Ultra"],
    mustContain: [["갤럭시 s26 울트라", "갤럭시s26울트라", "galaxy s26 ultra", "s26 ultra"]],
    mustNotContain: ["플러스", "plus", "fe", "팬에디션", ...PHONE_NOISE],
    msrpKrw: 1800000,
    released: 2026,
  },
  // Wave 118 (2026-05-15): Galaxy Z Flip/Fold + Watch + Buds 행렬 완성.
  // 매물 측정 (14일): Watch 4 (261), Watch 5 (125), Z Flip 5/6 (각 47/46), Z Flip 4 (30), Z Fold 7 (30), Buds 3 (26), Z Fold 6 (11).
  // Wave 182 Phase 2 chunk 5 (2026-05-17): Galaxy Z Flip 3 (2021.8) — 누락된 옛 인기.
  {
    id: "galaxy-z-flip-3",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Flip 3",
    aliases: ["갤럭시 Z 플립 3", "갤럭시Z플립3", "Galaxy Z Flip 3"],
    mustContain: [["갤럭시 z 플립 3", "갤럭시z플립3", "갤럭시 z플립3", "z flip 3", "zflip3", "z플립3"]],
    mustNotContain: ["z flip 4", "z플립4", "z flip 5", "z플립5", "z flip 6", "z플립6", "z flip 7", "z플립7", "폴드", "fold", ...PHONE_NOISE],
    msrpKrw: 1259000,
    released: 2021,
  },
  {
    id: "galaxy-z-flip-4",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Flip 4",
    aliases: ["갤럭시 Z 플립 4", "갤럭시Z플립4", "Galaxy Z Flip 4"],
    mustContain: [["갤럭시 z 플립 4", "갤럭시z플립4", "갤럭시 z플립4", "z flip 4", "zflip4", "z플립4"]],
    mustNotContain: ["z flip 3", "z플립3", "z flip 5", "z플립5", "z flip 6", "z플립6", "z flip 7", "z플립7", "폴드", "fold", ...PHONE_NOISE],
    msrpKrw: 1359000,
    released: 2022,
  },
  {
    id: "galaxy-z-flip-5",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Flip 5",
    aliases: ["갤럭시 Z 플립 5", "갤럭시Z플립5", "Galaxy Z Flip 5"],
    mustContain: [["갤럭시 z 플립 5", "갤럭시z플립5", "갤럭시 z플립5", "z flip 5", "zflip5", "z플립5"]],
    mustNotContain: ["z flip 4", "z플립4", "z flip 6", "z플립6", "z flip 7", "z플립7", "폴드", "fold", ...PHONE_NOISE],
    msrpKrw: 1399000,
    released: 2023,
  },
  {
    id: "galaxy-z-flip-6",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Flip 6",
    aliases: ["갤럭시 Z 플립 6", "갤럭시Z플립6", "Galaxy Z Flip 6"],
    mustContain: [["갤럭시 z 플립 6", "갤럭시z플립6", "갤럭시 z플립6", "z flip 6", "zflip6", "z플립6"]],
    mustNotContain: ["z flip 4", "z플립4", "z flip 5", "z플립5", "z flip 7", "z플립7", "폴드", "fold", ...PHONE_NOISE],
    msrpKrw: 1499000,
    released: 2024,
  },
  // Wave 182 Phase 2 chunk 5: Galaxy Z Fold 3 (2021.8) — 누락된 옛 인기.
  {
    id: "galaxy-z-fold-3",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Fold 3",
    aliases: ["갤럭시 Z 폴드 3", "갤럭시Z폴드3", "Galaxy Z Fold 3"],
    mustContain: [["갤럭시 z 폴드 3", "갤럭시z폴드3", "갤럭시 z폴드3", "z fold 3", "zfold3", "z폴드3"]],
    mustNotContain: ["z fold 4", "z폴드4", "z fold 5", "z폴드5", "z fold 6", "z폴드6", "z fold 7", "z폴드7", "플립", "flip", ...PHONE_NOISE],
    msrpKrw: 1999000,
    released: 2021,
  },
  {
    id: "galaxy-z-fold-4",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Fold 4",
    aliases: ["갤럭시 Z 폴드 4", "갤럭시Z폴드4", "Galaxy Z Fold 4"],
    mustContain: [["갤럭시 z 폴드 4", "갤럭시z폴드4", "갤럭시 z폴드4", "z fold 4", "zfold4", "z폴드4"]],
    mustNotContain: ["z fold 3", "z폴드3", "z fold 5", "z폴드5", "z fold 6", "z폴드6", "z fold 7", "z폴드7", "플립", "flip", ...PHONE_NOISE],
    msrpKrw: 2299000,
    released: 2022,
  },
  {
    id: "galaxy-z-fold-5",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Fold 5",
    aliases: ["갤럭시 Z 폴드 5", "갤럭시Z폴드5", "Galaxy Z Fold 5"],
    mustContain: [["갤럭시 z 폴드 5", "갤럭시z폴드5", "갤럭시 z폴드5", "z fold 5", "zfold5", "z폴드5"]],
    mustNotContain: ["z fold 4", "z폴드4", "z fold 6", "z폴드6", "z fold 7", "z폴드7", "플립", "flip", ...PHONE_NOISE],
    msrpKrw: 2398000,
    released: 2023,
  },
  {
    id: "galaxy-z-fold-6",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Fold 6",
    aliases: ["갤럭시 Z 폴드 6", "갤럭시Z폴드6", "Galaxy Z Fold 6"],
    mustContain: [["갤럭시 z 폴드 6", "갤럭시z폴드6", "갤럭시 z폴드6", "z fold 6", "zfold6", "z폴드6"]],
    mustNotContain: ["z fold 4", "z폴드4", "z fold 5", "z폴드5", "z fold 7", "z폴드7", "플립", "flip", ...PHONE_NOISE],
    msrpKrw: 2599000,
    released: 2024,
  },
  {
    id: "galaxy-z-fold-7",
    brand: "Samsung",
    category: "smartphone",
    modelName: "Galaxy Z Fold 7",
    aliases: ["갤럭시 Z 폴드 7", "갤럭시Z폴드7", "Galaxy Z Fold 7"],
    mustContain: [["갤럭시 z 폴드 7", "갤럭시z폴드7", "갤럭시 z폴드7", "z fold 7", "zfold7", "z폴드7"]],
    mustNotContain: ["z fold 4", "z폴드4", "z fold 5", "z폴드5", "z fold 6", "z폴드6", "플립", "flip", ...PHONE_NOISE],
    msrpKrw: 2699000,
    released: 2025,
  },
  {
    id: "galaxy-z-flip-5-256-self",
    brand: "Samsung",
    category: "smartphone",
    laneKey: "galaxy_z_flip_5_256_self",
    modelName: "Galaxy Z Flip 5 256GB (자급제)",
    aliases: ["갤럭시 Z 플립5 256 자급제", "Galaxy Z Flip 5 256 SIM-Free"],
    // 변형 흡수만 추가 (같은 의미 다른 표현). 자급제 group은 정확성 우선 원칙으로 유지 —
    // 명시 안 된 매물은 lane 진입 금지. "256" 단독은 가격 텍스트와 충돌 risk → 제거.
    mustContain: [
      ["갤럭시 z 플립", "갤럭시z플립", "갤럭시 플립", "갤럭시플립", "galaxy z flip", "galaxyzflip", "z flip", "zflip"],
      ["플립5", "플립 5", "flip5", "flip 5", "5세대"],
      ["256gb", "256 gb", "256g", "256기가"],
      ["자급제", "자급", "공기계", "언락", "정상해지", "정상 해지", "확정기변", "확정 기변", "전 통신사", "타통신사", "유심 꽂고", "유심꽂고", "무약정"],
    ],
    mustNotContain: [
      "플립4", "플립 4", "flip 4",
      "플립6", "flip 6",
      "폴드", "fold",
      "512gb", "512 gb", "512g", "1tb",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...PHONE_NOISE,
    ],
    msrpKrw: 1399000,
    released: 2023,
  },
];

const CORE_LAPTOP_CATALOG_PRO: Sku[] = [
  {
    id: "macbook-pro-14-m3-18-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m3_18_512",
    modelName: "MacBook Pro 14\" M3 18GB 512GB",
    aliases: ["맥북 프로 14 M3 18 512", "MacBook Pro 14 M3 18GB 512GB"],
    // Wave 106 #48: 18GB RAM + 512GB SSD 명시 강화. mustContain 에 "18gb" 추가.
    // "8gb" mustNotContain 못 박는 이유 = "18gb" 와 substring 충돌.
    // 8GB base 매물은 mustContain "18gb" 매칭 실패로 reject 됨.
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["m3"],
      ["14인치", "14 인치", "14형", "14\""],
      ["18gb", "18 gb", "18기가", "18램"],
      ["512gb", "512 gb", "512기가"],
    ],
    mustNotContain: [
      "에어", "air",
      "16인치", "16형",
      "(m1)", "(m2)", "(m4)",
      " m1 ", " m2 ", " m4 ",
      "16gb", "16 gb",
      "24gb",
      "36gb",
      "256gb", "256 gb",
      "1tb", "2tb",
      "메인보드", "로직보드", "상판", "하판",
      "액정만", "배터리만", "키보드만",
      "부품", "고장", "침수",
      "매입", "삽니다",
    ],
    msrpKrw: 2690000,
    released: 2023,
  },
];

const CORE_TABLET_CATALOG: Sku[] = [
  {
    id: "ipad-pro",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad Pro",
    aliases: ["아이패드 프로", "아이패드프로", "iPad Pro"],
    mustContain: [["아이패드", "ipad"], ["프로", "pro"]],
    mustNotContain: ["에어", "air", "미니", "mini", "a17pro", "a17 pro", ...TABLET_NOISE],
    msrpKrw: 1500000,
    released: 2024,
  },
  {
    id: "ipad-pro-11-m4-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_11_m4_256_wifi",
    modelName: "iPad Pro 11\" M4 256GB Wi-Fi",
    aliases: ["아이패드 프로 11 M4 256", "iPad Pro 11 M4 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m4"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["11인치", "11 인치", "11형", "11\"", "11″"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"", "12.9인치", "12.9 인치", "12.9\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "2tb", "2 tb", "2테라",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1899000,
    released: 2024,
  },
  // Wave 182 Phase 2 chunk 4 (2026-05-17): iPad Pro M1 (2021.4) narrow lanes — 매물 많음.
  {
    id: "ipad-pro-11-m1-128-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_11_m1_128_wifi",
    modelName: "iPad Pro 11\" M1 128GB Wi-Fi",
    aliases: ["아이패드 프로 11 M1 128", "iPad Pro 11 M1 128GB Wi-Fi", "아이패드 프로 3세대 11"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m1"],
      ["128gb", "128 gb", "128기가", "128g"],
      ["11인치", "11 인치", "11형", "11\""],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "12.9인치", "12.9 인치", "12.9\"", "13인치", "13 인치", "13\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "1tb", "2tb",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1099000,
    released: 2021,
  },
  {
    id: "ipad-pro-12-9-m1-128-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_12_9_m1_128_wifi",
    modelName: "iPad Pro 12.9\" M1 128GB Wi-Fi",
    aliases: ["아이패드 프로 12.9 M1 128", "iPad Pro 12.9 M1 128GB Wi-Fi", "아이패드 프로 5세대"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m1"],
      ["128gb", "128 gb", "128기가", "128g"],
      // Wave 182 (2026-05-17): catalog normalize Wave 114c 가 "12.9" → "13인치" 변환.
      // narrow SKU mustContain 에 "13인치" 추가해야 변환된 텍스트에서 매칭. m1 chip 로 13인치 narrow (m2/m4) 와 격리.
      ["12.9인치", "12.9 인치", "12.9\"", "12.9형", "12.9", "13인치", "13 인치", "13형", "13in"],
    ],
    // Wave 182 fix: mustNotContain 에서 "13인치"/"13 인치"/"13\"" 제거.
    // normalize 가 "12.9" → "13인치" 변환하므로 자기자신 차단 발생. m1 chip mustContain 으로 13인치 narrow (m2/m4) 와 격리 충분.
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "1tb", "2tb",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1499000,
    released: 2021,
  },
  // Wave 182 Phase 2 chunk 4: iPad Air 4 (2020.10, A14) — 옵션 명시 매물.
  {
    id: "ipad-air-4-64-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_4_64_wifi",
    modelName: "iPad Air 4 (A14) 64GB Wi-Fi",
    aliases: ["아이패드 에어 4 64", "iPad Air 4 64GB Wi-Fi", "아이패드 에어 A14"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["a14", "4세대", "4 세대", "에어 4", "에어4", "ipad air 4"],
      ["64gb", "64 gb", "64기가", "64g"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "m1", "m2", "m3", "5세대", "에어 5", "에어5",
      "셀룰러", "cellular", "유심", "esim",
      "256gb", "256 gb", "256기가",
      "128gb", "128 gb", "128기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 779000,
    released: 2020,
  },
  {
    id: "ipad-pro-11-m2-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_11_m2_256_wifi",
    modelName: "iPad Pro 11\" M2 256GB Wi-Fi",
    aliases: ["아이패드 프로 11 M2 256", "iPad Pro 11 M2 256GB Wi-Fi", "아이패드 프로 4세대 11 256"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m2"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["11인치", "11 인치", "11형", "11\"", "11″"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"", "12.9인치", "12.9 인치", "12.9\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "2tb", "2 tb", "2테라",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1399000,
    released: 2022,
  },
  {
    id: "ipad-pro-13-m4-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_13_m4_256_wifi",
    modelName: "iPad Pro 13\" M4 256GB Wi-Fi",
    aliases: ["아이패드 프로 13 M4 256", "iPad Pro 13 M4 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m4"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["13인치", "13 인치", "13형", "13\"", "13″"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb",
      "1tb", "2tb",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 2399000,
    released: 2024,
  },
  // Wave 766 (2026-05-27): iPad Pro M5 (2025-10) narrow lane — ready pool 3건 broad으로 떨어짐 (M5 11"/13").
  //   M5는 다른 칩/디스플레이 세대 → AJ11 Low/High 수준 명확한 분리. MSRP M4와 동일 (Apple 가격 정책).
  {
    id: "ipad-pro-11-m5-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_11_m5_256_wifi",
    modelName: "iPad Pro 11\" M5 256GB Wi-Fi",
    aliases: ["아이패드 프로 11 M5 256", "iPad Pro 11 M5 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m5"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["11인치", "11 인치", "11형", "11\"", "11″"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"", "12.9인치", "12.9 인치", "12.9\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "2tb", "2 tb", "2테라",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1899000,
    released: 2025,
  },
  {
    id: "ipad-pro-13-m5-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_13_m5_256_wifi",
    modelName: "iPad Pro 13\" M5 256GB Wi-Fi",
    aliases: ["아이패드 프로 13 M5 256", "iPad Pro 13 M5 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m5"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["13인치", "13 인치", "13형", "13\"", "13″"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb",
      "1tb", "2tb",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 2399000,
    released: 2025,
  },
  {
    id: "ipad-pro-13-m2-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_pro_13_m2_256_wifi",
    modelName: "iPad Pro 13\" M2 256GB Wi-Fi",
    aliases: ["아이패드 프로 13 M2 256", "iPad Pro 13 M2 256GB Wi-Fi", "아이패드 프로 12.9 M2 256", "아이패드 프로 6세대 256"],
    mustContain: [
      ["아이패드", "ipad"],
      ["프로", "pro"],
      ["m2"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["13인치", "13 인치", "13형", "13\"", "12.9인치", "12.9 인치"],
    ],
    mustNotContain: [
      "에어", "air", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb",
      "512gb", "1tb", "2tb",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1899000,
    released: 2022,
  },
  {
    id: "ipad-air",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad Air",
    aliases: ["아이패드 에어", "아이패드에어", "iPad Air"],
    mustContain: [["아이패드", "ipad"], ["에어", "air"]],
    // Wave 751 (2026-05-24) Pareto sweep — 3846x spread audit 발견.
    // iPad Air 1세대 (2013) / 2세대 (2014) 9년 정책 차단. 교환 dummy 가격 차단.
    mustNotContain: [
      "프로", "pro", "미니", "mini",
      "에어 1", "에어1", "에어 1세대", "에어1세대", "1세대",
      "에어 2", "에어2", "에어 2세대", "에어2세대", "2세대",
      "16gb", "16 gb", "16기가", "16g",
      "32gb", "32 gb", "32기가",
      // 교환 dummy 가격 (a16 → 에어4 같은 trade post)
      "추가금액", "추가 금액", "교환 가능", "교환합니다",
      ...TABLET_NOISE,
    ],
    msrpKrw: 900000,
    released: 2024,
  },
  // Wave 182 Phase 2 (2026-05-17): iPad Air 5 (M1, 2022.3) — 인기 매물.
  // 출시 4.2년 / msrp 779,000 / base 64GB Wi-Fi.
  {
    id: "ipad-air-5-m1-64-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_5_m1_64_wifi",
    modelName: "iPad Air 5 (M1) 64GB Wi-Fi",
    aliases: ["아이패드 에어 5 64", "iPad Air 5 64GB Wi-Fi", "아이패드 에어 M1"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m1", "5세대", "5 세대", "에어 5", "에어5", "ipad air 5"],
      ["64gb", "64 gb", "64기가", "64g"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "m2", "m3", "m4", "(m2)", "(m3)", "(m4)",
      "에어 4", "에어4", "4세대", "에어 6", "에어6",
      "13인치", "13 인치", "13\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 779000,
    released: 2022,
  },
  {
    id: "ipad-air-5-m1-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_5_m1_256_wifi",
    modelName: "iPad Air 5 (M1) 256GB Wi-Fi",
    aliases: ["아이패드 에어 5 256", "iPad Air 5 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m1", "5세대", "5 세대", "에어 5", "에어5", "ipad air 5"],
      ["256gb", "256 gb", "256기가", "256g"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "m2", "m3", "m4", "(m2)", "(m3)", "(m4)",
      "에어 4", "에어4", "4세대",
      "13인치", "13 인치", "13\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "64gb", "64 gb", "64기가",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 999000,
    released: 2022,
  },
  {
    id: "ipad-air-m2-11-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_m2_11_256_wifi",
    modelName: "iPad Air M2 11\" 256GB Wi-Fi",
    aliases: ["아이패드 에어 11 M2 256", "iPad Air 11 M2 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m2"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["11인치", "11 인치", "11형", "11\"", "11″"],
    ],
    // Wave 111d: "프로" 단독이 "애플펜슬 프로" false reject. "아이패드 프로" / "ipad pro" context 명시.
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"", "12.9인치", "12.9 인치", "12.9\"",
      "셀룰러", "cellular", " lte ", " 5g ", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "2tb", "2 tb", "2테라",
      "(m1)", "(m3)", " m1 ", " m3 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 999000,
    released: 2024,
  },
  {
    id: "ipad-air-m3-11-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_m3_11_256_wifi",
    modelName: "iPad Air M3 11\" 256GB Wi-Fi",
    aliases: ["아이패드 에어 11 M3 256", "iPad Air 11 M3 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m3"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["11인치", "11 인치", "11형", "11\""],
    ],
    // Wave 111d: "프로" 단독 false reject 차단 (애플펜슬 프로 등). "아이패드 프로" context 명시.
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb",
      "512gb", "1tb", "2tb",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1099000,
    released: 2025,
  },
  // Wave 766 (2026-05-27): iPad Air M4 (2026 refresh) narrow lane — ready pool에서 broad으로 떨어진 매물 발견.
  //   M4 칩 = 다른 세대 (M3 → M4). pool 매물 "아이패드 에어 11 M4 128GB" 명시 기준.
  {
    id: "ipad-air-m4-11-128-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_m4_11_128_wifi",
    modelName: "iPad Air M4 11\" 128GB Wi-Fi",
    aliases: ["아이패드 에어 11 M4 128", "iPad Air 11 M4 128GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m4"],
      ["128gb", "128 gb", "128기가", "128g"],
      ["11인치", "11 인치", "11형", "11\""],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "13인치", "13 인치", "13형", "13\"",
      "셀룰러", "cellular", "유심", "esim",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "1tb", "2tb",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      "에어 4", "에어4", "에어 5", "에어5", "4세대", "5세대",
      ...TABLET_NOISE,
    ],
    msrpKrw: 899000,
    released: 2026,
  },
  // Wave 119 (2026-05-15): iPad Air 13" narrow lane (M2/M3) — 14일 매물 87건. 11인치만 있던 narrow에 13인치 sibling 추가.
  {
    id: "ipad-air-m2-13-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_m2_13_256_wifi",
    modelName: "iPad Air M2 13\" 256GB Wi-Fi",
    aliases: ["아이패드 에어 13 M2 256", "iPad Air 13 M2 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m2"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["13인치", "13 인치", "13형", "13\""],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb",
      "512gb", "1tb", "2tb",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1099000,
    released: 2024,
  },
  {
    id: "ipad-air-m3-13-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_air_m3_13_256_wifi",
    modelName: "iPad Air M3 13\" 256GB Wi-Fi",
    aliases: ["아이패드 에어 13 M3 256", "iPad Air 13 M3 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["에어", "air"],
      ["m3"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["13인치", "13 인치", "13형", "13\""],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "미니", "mini",
      "11인치", "11 인치", "11형", "11\"",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb",
      "512gb", "1tb", "2tb",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1199000,
    released: 2025,
  },
  {
    id: "ipad-mini",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad mini",
    aliases: ["아이패드 미니", "아이패드미니", "iPad mini"],
    mustContain: [["아이패드", "ipad"], ["미니", "mini"]],
    // Wave 751b Pareto: 333x audit — 백팩/키보드/액세서리 false match 차단.
    mustNotContain: ["프로", "pro", "에어", "air",
      "백팩", "backpack", "복조리백", "복조리 백", "보부상",
      "누에르", "나일론 백",
      "호환 블루투스", "호환 키보드", "휴대용 키보드", "블루투스 키보드",
      ...TABLET_NOISE],
    msrpKrw: 750000,
    released: 2024,
  },
  // Wave 182 Phase 2 chunk 5 (2026-05-17): iPad mini 5 (A12, 2019.3) — 옛 인기, 9년 정책 OK.
  {
    id: "ipad-mini-5-64-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_mini_5_64_wifi",
    modelName: "iPad mini 5 (A12) 64GB Wi-Fi",
    aliases: ["아이패드 미니 5 64", "iPad mini 5 64GB Wi-Fi", "아이패드 미니 A12"],
    mustContain: [
      ["아이패드", "ipad"],
      ["미니", "mini"],
      ["a12", "5세대", "5 세대", "ipad mini 5", "미니 5", "미니5", "5미니"],
      ["64gb", "64 gb", "64기가", "64g"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "에어", "air",
      "미니 4", "mini 4", "미니 6", "mini 6", "미니6", "6세대", "a15",
      "미니 7", "mini 7", "미니7", "7세대", "a17",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "256gb", "256 gb", "256기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 499000,
    released: 2019,
  },
  {
    // Wave 182 Phase 2 (2026-05-17): iPad mini 6 (A15, 2021.9) — Wave 179b stale 차익 사건 모델.
    // 출시 4.7년 / msrp 749,000 / base 64GB Wi-Fi.
    id: "ipad-mini-6-64-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_mini_6_64_wifi",
    modelName: "iPad mini 6 (A15) 64GB Wi-Fi",
    aliases: ["아이패드 미니 6 64", "iPad mini 6 64GB Wi-Fi", "아이패드 미니 A15"],
    mustContain: [
      ["아이패드", "ipad"],
      ["미니", "mini"],
      ["a15", "6세대", "6 세대", "ipad mini 6", "미니 6", "미니6", "6미니"],
      ["64gb", "64 gb", "64기가", "64g", "64"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "에어", "air",
      "미니 5", "mini 5", "미니4", "5세대", "4세대",
      "미니 7", "mini 7", "미니7", "7세대", "a17",
      "셀룰러", "cellular", "유심", "esim",
      "128gb", "128 gb", "128기가",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 749000,
    released: 2021,
  },
  {
    // Wave 182 Phase 2: iPad mini 6 (A15) 256GB Wi-Fi 변형.
    id: "ipad-mini-6-256-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_mini_6_256_wifi",
    modelName: "iPad mini 6 (A15) 256GB Wi-Fi",
    aliases: ["아이패드 미니 6 256", "iPad mini 6 256GB Wi-Fi"],
    mustContain: [
      ["아이패드", "ipad"],
      ["미니", "mini"],
      ["a15", "6세대", "6 세대", "ipad mini 6", "미니 6", "미니6", "6미니"],
      ["256gb", "256 gb", "256기가", "256g"],
    ],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "에어", "air",
      "미니 5", "mini 5", "미니 7", "mini 7", "미니7", "7세대", "a17",
      "셀룰러", "cellular", "유심", "esim",
      "64gb", "64 gb", "64기가",
      "128gb", "128 gb", "128기가",
      "512gb", "512 gb", "512기가",
      ...TABLET_NOISE,
    ],
    msrpKrw: 989000,
    released: 2021,
  },
  {
    id: "ipad-mini-7-128-wifi",
    brand: "Apple",
    category: "tablet",
    laneKey: "ipad_mini_7_128_wifi",
    modelName: "iPad mini 7 (A17 Pro) 128GB Wi-Fi",
    aliases: ["아이패드 미니 7 128", "iPad mini 7 128GB Wi-Fi", "아이패드 미니 A17 128"],
    mustContain: [
      ["아이패드", "ipad"],
      ["미니", "mini"],
      ["a17", "7세대", "7 세대", "ipad mini 7", "미니 7", "미니7", "7미니", "아이패드 7미니", "아이패드7미니"],
      ["128gb", "128 gb", "128기가", "128g", "128"],
    ],
    // Wave 111d: "프로" 단독은 "애플펜슬 프로" false reject. "아이패드 프로" / "iPad Pro" context.
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro", "에어", "air",
      "미니 6", "mini 6", "미니6",
      "미니 5", "mini 5", "미니4",
      "6세대", "5세대",
      "셀룰러", "cellular", "유심", "esim",
      "256gb", "256 gb", "256기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      ...TABLET_NOISE,
    ],
    msrpKrw: 749000,
    released: 2024,
  },
  {
    id: "ipad-10",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad 10th gen",
    aliases: ["아이패드 10세대", "아이패드10세대", "iPad 10th gen"],
    mustContain: [["아이패드", "ipad"], ["10세대", "10 세대", "10th", "ipad 10"]],
    mustNotContain: ["프로", "pro", "에어", "air", "미니", "mini", "11세대", "11 세대", "11th", "a16", ...TABLET_NOISE],
    msrpKrw: 680000,
    released: 2022,
  },
  // Wave 119 (2026-05-15): iPad 9세대 (2021) broad — 14일 매물 32건.
  // Wave 182 Phase 2 chunk 5 (2026-05-17): iPad 7th (2019.9) / 8th gen (2020.9) — 9년 정책 OK.
  {
    id: "ipad-7",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad 7th gen",
    aliases: ["아이패드 7세대", "아이패드7세대", "iPad 7th gen"],
    mustContain: [["아이패드", "ipad"], ["7세대", "7 세대", "7th", "ipad 7"]],
    mustNotContain: ["프로", "pro", "에어", "air", "미니", "mini", "8세대", "8 세대", "8th", "9세대", "9 세대", "9th", "10세대", "10 세대", "11세대", ...TABLET_NOISE],
    msrpKrw: 429000,
    released: 2019,
  },
  {
    id: "ipad-8",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad 8th gen",
    aliases: ["아이패드 8세대", "아이패드8세대", "iPad 8th gen"],
    mustContain: [["아이패드", "ipad"], ["8세대", "8 세대", "8th", "ipad 8"]],
    mustNotContain: ["프로", "pro", "에어", "air", "미니", "mini", "7세대", "7 세대", "7th", "9세대", "9 세대", "9th", "10세대", "10 세대", "11세대", ...TABLET_NOISE],
    msrpKrw: 449000,
    released: 2020,
  },
  {
    id: "ipad-9",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad 9th gen",
    aliases: ["아이패드 9세대", "아이패드9세대", "iPad 9th gen"],
    mustContain: [["아이패드", "ipad"], ["9세대", "9 세대", "9th", "ipad 9"]],
    mustNotContain: ["프로", "pro", "에어", "air", "미니", "mini", "10세대", "10 세대", "10th", "11세대", "11 세대", "11th", "a16", ...TABLET_NOISE],
    msrpKrw: 449000,
    released: 2021,
  },
  // Wave 111g (2026-05-15): iPad A16 (11세대) Apple 2024-10 신상.
  {
    id: "ipad-11",
    brand: "Apple",
    category: "tablet",
    modelName: "iPad 11th gen (A16)",
    aliases: ["아이패드 11세대", "아이패드11세대", "iPad 11th gen", "iPad A16"],
    mustContain: [["아이패드", "ipad"], ["11세대", "11 세대", "11th", "ipad 11", "a16"]],
    mustNotContain: [
      "아이패드 프로", "아이패드프로", "ipad pro",
      "에어", "air", "미니", "mini",
      "10세대", "10 세대", "10th",
      "a17", "a18",
      ...TABLET_NOISE,
    ],
    msrpKrw: 459000,
    released: 2024,
  },
  // Wave 142 (2026-05-17): iPad Magic Keyboard narrow lane (accessory 다양화).
  // magic-keyboard-ipad SKU 제거 (액세서리 — Wave 182 catalog 정비).
  // Wave 182 Phase 2 chunk 6 (2026-05-17): Galaxy Tab S6 (2019.8) + S6 Lite (2020.5) — 옛 인기 누락.
  {
    id: "galaxy-tab-s6",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S6",
    aliases: ["갤럭시탭 S6", "갤탭 S6", "Galaxy Tab S6"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s6", "s 6"]],
    mustNotContain: ["s6 lite", "s6lite", "s6 라이트", "s7", "s 7", "s8", "s9", "s10", ...TABLET_NOISE],
    msrpKrw: 729000,
    released: 2019,
  },
  {
    id: "galaxy-tab-s6-lite",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S6 Lite",
    aliases: ["갤럭시탭 S6 Lite", "갤탭 S6 라이트", "Galaxy Tab S6 Lite"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s6 lite", "s6lite", "s6 라이트"]],
    mustNotContain: ["s7", "s 7", "s8", "s9", "s10", ...TABLET_NOISE],
    msrpKrw: 459000,
    released: 2020,
  },
  // Wave 182 Phase 2 chunk 4 (2026-05-17): Galaxy Tab S7 시리즈 (2020.8) narrow lane.
  {
    id: "galaxy-tab-s7",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S7",
    aliases: ["갤럭시탭 S7", "갤탭 S7", "Galaxy Tab S7"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s7", "s 7"]],
    mustNotContain: ["s7 플러스", "s7 plus", "s7+", "s7 fe", "s7fe", "s8", "s 8", "s9", "s10", ...TABLET_NOISE],
    msrpKrw: 880000,
    released: 2020,
  },
  {
    id: "galaxy-tab-s7-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S7 Plus",
    aliases: ["갤럭시탭 S7 플러스", "갤탭 S7+", "Galaxy Tab S7 Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s7", "s 7"], ["플러스", "plus", "+"]],
    mustNotContain: ["s7 fe", "s7fe", "s8", "s 8", "s9", "s10", "ultra", "울트라", ...TABLET_NOISE],
    msrpKrw: 1180000,
    released: 2020,
  },
  {
    id: "galaxy-tab-s7-fe",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S7 FE",
    aliases: ["갤럭시탭 S7 FE", "갤탭 S7 FE", "Galaxy Tab S7 FE"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s7", "s 7"], ["fe"]],
    mustNotContain: ["s7 플러스", "s7 plus", "s7+", "s8", "s 8", "s9", "s10", "ultra", "울트라", ...TABLET_NOISE],
    msrpKrw: 690000,
    released: 2021,
  },
  {
    id: "galaxy-tab-s8",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S8",
    aliases: ["갤럭시탭 S8", "갤탭 S8", "Galaxy Tab S8"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s8", "s 8"]],
    mustNotContain: ["s8 울트라", "s8 ultra", "s8 플러스", "s8 plus", ...TABLET_NOISE],
    msrpKrw: 900000,
    released: 2022,
  },
  {
    id: "galaxy-tab-s8-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S8 Plus",
    aliases: ["갤럭시탭 S8 플러스", "갤탭 S8+", "Galaxy Tab S8 Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s8", "s 8"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", ...TABLET_NOISE],
    msrpKrw: 1100000,
    released: 2022,
  },
  {
    id: "galaxy-tab-s8-ultra",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S8 Ultra",
    aliases: ["갤럭시탭 S8 울트라", "갤탭 S8 울트라", "Galaxy Tab S8 Ultra"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s8", "s 8"], ["울트라", "ultra"]],
    mustNotContain: ["플러스", "plus", ...TABLET_NOISE],
    msrpKrw: 1400000,
    released: 2022,
  },
  {
    id: "galaxy-tab-s9",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S9",
    aliases: ["갤럭시탭 S9", "갤탭 S9", "Galaxy Tab S9"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s9", "s 9"]],
    mustNotContain: ["s9 울트라", "s9 ultra", "s9 플러스", "s9 plus", "fe", "팬에디션", ...TABLET_NOISE],
    msrpKrw: 1000000,
    released: 2023,
  },
  {
    id: "galaxy-tab-s9-fe",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S9 FE",
    aliases: ["갤럭시탭 S9 FE", "갤탭 S9 FE", "Galaxy Tab S9 FE"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s9", "s 9"], ["fe", "팬에디션"]],
    mustNotContain: ["플러스", "plus", "울트라", "ultra", ...TABLET_NOISE],
    msrpKrw: 629000,
    released: 2023,
  },
  {
    id: "galaxy-tab-s9-fe-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S9 FE Plus",
    aliases: ["갤럭시탭 S9 FE 플러스", "갤탭 S9 FE+", "Galaxy Tab S9 FE Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s9", "s 9"], ["fe", "팬에디션"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", ...TABLET_NOISE],
    msrpKrw: 799000,
    released: 2023,
  },
  {
    id: "galaxy-tab-s9-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S9 Plus",
    aliases: ["갤럭시탭 S9 플러스", "갤탭 S9+", "Galaxy Tab S9 Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s9", "s 9"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...TABLET_NOISE],
    msrpKrw: 1200000,
    released: 2023,
  },
  {
    id: "galaxy-tab-s9-ultra",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S9 Ultra",
    aliases: ["갤럭시탭 S9 울트라", "갤탭 S9 울트라", "Galaxy Tab S9 Ultra"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s9", "s 9"], ["울트라", "ultra"]],
    mustNotContain: ["플러스", "plus", ...TABLET_NOISE],
    msrpKrw: 1600000,
    released: 2023,
  },
  {
    id: "galaxy-tab-s10-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S10 Plus",
    aliases: ["갤럭시탭 S10 플러스", "갤탭 S10+", "Galaxy Tab S10 Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s10", "s 10"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", "fe", "팬에디션", ...TABLET_NOISE],
    msrpKrw: 1250000,
    released: 2024,
  },
  {
    id: "galaxy-tab-s10-fe-plus",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S10 FE Plus",
    aliases: ["갤럭시탭 S10 FE 플러스", "갤탭 S10 FE+", "Galaxy Tab S10 FE Plus"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s10", "s 10"], ["fe", "팬에디션"], ["플러스", "plus", "+"]],
    mustNotContain: ["울트라", "ultra", ...TABLET_NOISE],
    msrpKrw: 899000,
    released: 2025,
  },
  {
    id: "galaxy-tab-s10-ultra",
    brand: "Samsung",
    category: "tablet",
    modelName: "Galaxy Tab S10 Ultra",
    aliases: ["갤럭시탭 S10 울트라", "갤탭 S10 울트라", "Galaxy Tab S10 Ultra"],
    mustContain: [["갤럭시탭", "갤탭", "galaxy tab", "tab"], ["s10", "s 10"], ["울트라", "ultra"]],
    mustNotContain: ["플러스", "plus", ...TABLET_NOISE],
    msrpKrw: 1700000,
    released: 2024,
  },
  {
    id: "galaxy-tab-s10-ultra-256-self",
    brand: "Samsung",
    category: "tablet",
    laneKey: "galaxy_tab_s10_ultra_256_self",
    modelName: "Galaxy Tab S10 Ultra 256GB Wi-Fi (자급제)",
    aliases: [
      "갤럭시탭 S10 울트라 256 자급제",
      "갤탭 S10 울트라 256 와이파이",
      "Galaxy Tab S10 Ultra 256 Wi-Fi",
    ],
    mustContain: [
      ["갤럭시탭", "갤탭", "galaxy tab", "tab"],
      ["s10", "s 10"],
      ["울트라", "ultra"],
      ["256gb", "256 gb", "256기가", "256g", "256"],
      ["자급제", "자급", "wifi", "와이파이"],
    ],
    mustNotContain: [
      "플러스", "plus",
      "fe", "팬에디션",
      "s9", "갤럭시탭 s9", "갤탭 s9", "galaxy tab s9", "tab s9",
      "s11", "갤럭시탭 s11", "갤탭 s11", "galaxy tab s11", "tab s11",
      "셀룰러", "cellular", "5g", "lte", "유심",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "skt 완납", "skt 개통", "skt 약정", "skt 전용",
      "kt 완납", "kt 개통", "kt 약정", "kt 전용",
      "lgu+", "lg u+", "유플러스", "엘지유플",
      "통신사 개통", "통신사 전용", "번호 이동", "약정 승계",
      "완납폰", "완납 폰", "할부 승계", "할부 잔여", "확정 기변",
      "리퍼폰", "리퍼 폰",
      ...TABLET_NOISE,
    ],
    msrpKrw: 1700000,
    released: 2024,
  },
];

const CORE_LAPTOP_CATALOG: Sku[] = [
  // Wave 182 Phase 2 (2026-05-17): MacBook Air M1 13" 추가 — Apple Silicon 가장 인기 매물.
  // 출시 2020.11 / msrp 1,290,000 / base 8GB/256GB.
  // M2/M3/M4 차단 + Intel (2018 등) 차단 + Pro 차단.
  {
    id: "macbook-air-m1-13-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m1_13_256",
    modelName: "MacBook Air M1 13\" 256GB",
    aliases: ["맥북 에어 M1 13 256", "MacBook Air M1 13\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m1"],
      ["13인치", "13 인치", "13형", "13\""],
      ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "15인치", "15형", "16인치", "16형",
      "(m2)", "(m3)", "(m4)",
      " m2 ", " m3 ", " m4 ",
      "16gb", "16 gb", "16기가", "16램",
      "24gb", "24 gb", "24기가", "24램",
      "512gb", "512 gb", "512기가", "512",
      "1tb", "1 tb", "1테라",
      "intel", "인텔", "i5", "i7", "i9", "2018", "2017", "2019", "2020년형",
      "메인보드", "로직보드", "상판", "하판",
      "액정만", "배터리만", "키보드만",
      "빈박스", "박스만", "보호필름", "필름", "케이스만", "파우치",
      "교환", "교신",
      "부품", "고장", "침수",
      "매입", "삽니다",
    ],
    msrpKrw: 1290000,
    released: 2020,
  },
  {
    id: "macbook-air-m2-13-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m2_13_256",
    modelName: "MacBook Air M2 13\" 256GB",
    aliases: ["맥북 에어 M2 13 256", "MacBook Air M2 13\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m2"],
      ["13인치", "13 인치", "13형", "13\""],
      ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "15인치", "15형",
      "(m1)", "(m3)", "(m4)",
      " m1 ", " m3 ", " m4 ",
      "16gb", "16 gb", "16기가", "16램",
      "24gb", "24 gb", "24기가", "24램",
      "512gb", "512 gb", "512기가", "512",
      "1tb", "1 tb", "1테라",
      "메인보드", "로직보드", "상판", "하판",
      "액정만", "배터리만", "키보드만",
      "빈박스", "박스만", "보호필름", "필름", "케이스만", "파우치",
      "교환", "교신",
      "부품", "고장", "침수",
      "매입", "삽니다",
    ],
    msrpKrw: 1690000,
    released: 2022,
  },
  {
    id: "macbook-air-m3-13-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m3_13_256",
    modelName: "MacBook Air M3 13\" 256GB",
    aliases: ["맥북 에어 M3 13 256", "MacBook Air M3 13\" 256GB"],
    // Wave 106 #48: m2 패턴 따라 8GB/256GB base only 강제 (RAM/SSD 옵션 정밀화).
    // 옛: variant 8개 매칭 (16gb/512gb 매물도 통과 → 카드에 잘못된 모델 표시).
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m3"],
      ["13인치", "13 인치", "13형", "13\""],
      ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "15인치", "15형",
      "(m1)", "(m2)", "(m4)",
      " m1 ", " m2 ", " m4 ",
      "16gb", "16 gb", "16기가", "16램",
      "24gb", "24 gb", "24기가", "24램",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      "메인보드", "로직보드", "상판", "하판",
      "액정만", "배터리만", "키보드만",
      "빈박스", "박스만", "보호필름", "필름", "케이스만", "파우치",
      "교환", "교신",
      "부품", "고장", "침수",
      "매입", "삽니다",
    ],
    msrpKrw: 1390000,
    released: 2024,
  },
  // Wave 123 (2026-05-15): MacBook Air M4 + MacBook Pro 14 M4 narrow lane.
  // 매물 14일: Air M4 192건, Pro 14 M4 121건, Pro 16 M3/M4 321건, Pro M1 211, Pro M2 72.
  // M3 narrow lane과 동일한 RAM/storage 강제 정책 (LAUNCH_PLAN 1.6e).
  {
    id: "macbook-air-m4-13-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m4_13_256",
    modelName: "MacBook Air M4 13\" 256GB",
    aliases: ["맥북 에어 M4 13 256", "MacBook Air M4 13\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m4"],
      ["13인치", "13 인치", "13형", "13\""],
      ["16gb", "16 gb", "16기가", "16램", "16g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "15인치", "15형",
      "(m1)", "(m2)", "(m3)",
      " m1 ", " m2 ", " m3 ",
      "8gb", "8 gb", "8기가",  // M4 Air base는 16GB
      "24gb", "24 gb", "24기가", "24램",
      "32gb", "32 gb", "32기가",
      "512gb", "512 gb", "512기가",
      "1tb", "1 tb", "1테라",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1390000,
    released: 2025,
  },
  // Wave 182 Phase 2 chunk 4 (2026-05-17): MacBook Air 15" M2/M3/M4 narrow lanes.
  {
    id: "macbook-air-m2-15-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m2_15_256",
    modelName: "MacBook Air M2 15\" 256GB",
    aliases: ["맥북 에어 M2 15 256", "MacBook Air M2 15\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m2"],
      ["15인치", "15 인치", "15형", "15\""],
      ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "13인치", "13 인치", "13형",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      "16gb", "16 gb", "16기가", "16램",
      "24gb", "24 gb", "24기가",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1890000,
    released: 2023,
  },
  {
    id: "macbook-air-m3-15-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m3_15_256",
    modelName: "MacBook Air M3 15\" 256GB",
    aliases: ["맥북 에어 M3 15 256", "MacBook Air M3 15\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m3"],
      ["15인치", "15 인치", "15형", "15\""],
      ["8gb", "8 gb", "8기가", "8램", "8g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "13인치", "13 인치", "13형",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      "16gb", "16 gb", "16기가", "16램",
      "24gb", "24 gb",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1890000,
    released: 2024,
  },
  {
    id: "macbook-air-m4-15-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m4_15_256",
    modelName: "MacBook Air M4 15\" 256GB",
    aliases: ["맥북 에어 M4 15 256", "MacBook Air M4 15\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m4"],
      ["15인치", "15 인치", "15형", "15\""],
      ["16gb", "16 gb", "16기가", "16램", "16g", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "프로", "pro",
      "13인치", "13 인치", "13형",
      "(m1)", "(m2)", "(m3)", "(m5)", " m1 ", " m2 ", " m3 ", " m5 ", "m5", // Wave 779 M5 차단
      "8gb", "8 gb",
      "24gb", "24 gb", "32gb",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1990000,
    released: 2025,
  },
  // Wave 779 (2026-05-27): MacBook M5 narrow lanes — owner 우려 "iPad Pro M5는 Wave 766 추가됐는데 MacBook M5 누락".
  //   DB 매물 539건 (macbook-pro broad 240 + null 163 + macbook-air broad 136) 다 broad 에 묶여 시세 dilution.
  //   M4 패턴 그대로 + Apple silicon M5 chip (2025-10 발표).
  {
    id: "macbook-air-m5-13-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m5_13_256",
    modelName: "MacBook Air M5 13\" 256GB",
    aliases: ["맥북 에어 M5 13 256", "MacBook Air M5 13\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m5"],
      ["13인치", "13 인치", "13형", "13\""],
      ["16gb", "16 gb", "16기가", "16램", "16g", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "프로", "pro",
      "15인치", "15형",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "8gb", "8 gb",
      "24gb", "24 gb", "32gb",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1690000,
    released: 2025,
    confusionNote: "MacBook Air M5 13\" base (2025-10). M4 대비 +₩300K. Apple silicon 5세대.",
  },
  {
    id: "macbook-air-m5-15-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_m5_15_256",
    modelName: "MacBook Air M5 15\" 256GB",
    aliases: ["맥북 에어 M5 15 256", "MacBook Air M5 15\" 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["에어", "air"],
      ["m5"],
      ["15인치", "15 인치", "15형", "15\""],
      ["16gb", "16 gb", "16기가", "16램", "16g", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "프로", "pro",
      "13인치", "13 인치", "13형",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "8gb", "8 gb",
      "24gb", "24 gb", "32gb",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1990000,
    released: 2025,
    confusionNote: "MacBook Air M5 15\" base (2025-10).",
  },
  // Wave 182 Phase 2 chunk 2 (2026-05-17): MacBook Pro 14" M1/M2/M3/M4 Pro/Max narrow lanes.
  // 14" Pro는 2021.10 M1 Pro/Max로 시작 (vanilla M1 14"는 없음).
  // 옵션 변형 많아 가장 base (Pro=16GB/512GB, Max=32GB/1TB) narrow만. 다른 RAM/SSD는 별도 lane 필요.
  {
    id: "macbook-pro-14-m1-pro-16-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m1_pro_16_512",
    modelName: "MacBook Pro 14\" M1 Pro 16GB/512GB",
    aliases: ["맥북 프로 14 M1 Pro 16 512", "MacBook Pro 14\" M1 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m1 pro", "m1pro"],
      ["16gb", "16 gb", "16기가", "16램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m1 max", "m1max",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      "32gb", "32 gb", "32기가",
      "8gb", "8 gb", "8기가",
      "1tb", "1 tb", "1테라", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2690000,
    released: 2021,
  },
  {
    id: "macbook-pro-14-m1-max-32-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m1_max_32_1tb",
    modelName: "MacBook Pro 14\" M1 Max 32GB/1TB",
    aliases: ["맥북 프로 14 M1 Max 32 1TB", "MacBook Pro 14\" M1 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m1 max", "m1max"],
      ["32gb", "32 gb", "32기가", "32램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m1 pro", "m1pro",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      "16gb", "16 gb", "16기가",
      "64gb", "64 gb",
      "512gb", "512 gb",
      "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3490000,
    released: 2021,
  },
  {
    id: "macbook-pro-14-m2-pro-16-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m2_pro_16_512",
    modelName: "MacBook Pro 14\" M2 Pro 16GB/512GB",
    aliases: ["맥북 프로 14 M2 Pro 16 512", "MacBook Pro 14\" M2 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m2 pro", "m2pro"],
      ["16gb", "16 gb", "16기가", "16램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m2 max", "m2max",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      "32gb", "32 gb", "32기가",
      "8gb", "8 gb", "8기가",
      "1tb", "1 tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2790000,
    released: 2023,
  },
  {
    id: "macbook-pro-14-m2-max-32-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m2_max_32_1tb",
    modelName: "MacBook Pro 14\" M2 Max 32GB/1TB",
    aliases: ["맥북 프로 14 M2 Max 32 1TB", "MacBook Pro 14\" M2 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m2 max", "m2max"],
      ["32gb", "32 gb", "32기가", "32램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m2 pro", "m2pro",
      "(m1)", "(m3)", "(m4)", " m1 ", " m3 ", " m4 ",
      "16gb", "16 gb", "16기가",
      "64gb", "64 gb", "96gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3590000,
    released: 2023,
  },
  {
    id: "macbook-pro-14-m3-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m3_max_36_1tb",
    modelName: "MacBook Pro 14\" M3 Max 36GB/1TB",
    aliases: ["맥북 프로 14 M3 Max", "MacBook Pro 14\" M3 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m3 max", "m3max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m3 pro", "m3pro",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      "18gb", "18 gb", "8gb", "16gb",
      "48gb", "64gb", "96gb", "128gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4090000,
    released: 2023,
  },
  {
    id: "macbook-pro-14-m4-pro-24-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m4_pro_24_512",
    modelName: "MacBook Pro 14\" M4 Pro 24GB/512GB",
    aliases: ["맥북 프로 14 M4 Pro 24 512", "MacBook Pro 14\" M4 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m4 pro", "m4pro"],
      ["24gb", "24 gb", "24기가", "24램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      "36gb", "36 gb", "48gb", "64gb",
      "8gb", "16gb",
      "1tb", "1 tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2990000,
    released: 2024,
  },
  {
    id: "macbook-pro-14-m4-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m4_max_36_1tb",
    modelName: "MacBook Pro 14\" M4 Max 36GB/1TB",
    aliases: ["맥북 프로 14 M4 Max", "MacBook Pro 14\" M4 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m4 max", "m4max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "16인치", "16 인치", "16형",
      "m4 pro", "m4pro",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      "24gb", "24 gb", "48gb", "64gb", "96gb", "128gb",
      "16gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4390000,
    released: 2024,
  },
  {
    id: "macbook-pro-14-m4-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m4_256",
    modelName: "MacBook Pro 14\" M4 256GB (base)",
    aliases: ["맥북 프로 14 M4 256", "MacBook Pro 14\" M4 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["m4"],
      ["14인치", "14 인치", "14형", "14\""],
      ["16gb", "16 gb", "16기가", "16램", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "에어", "air",
      "16인치", "16형",
      "m4 pro", "m4pro", "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)",
      " m1 ", " m2 ", " m3 ",
      "24gb", "24 gb", "24gb", "32gb", "36gb", "48gb",
      "8gb", "8 gb", "8기가",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2390000,
    released: 2024,
  },
  {
    // Wave 124 (2026-05-15): 옛 Intel 맥북 narrow lane 시작점.
    // production 84건, parser_pass 85% (이미 chip/year/screen 잘 잡음). M1 16" Pro 는 2021 → 2019 명시 매물은 Intel only.
    // narrow lane 추가 효과 = 시세 sample 분리 (M1/M2/M3 Pro와 안 섞임), pool 진입 가능.
    // RAM/SSD 다양 (i7 16/512, i9 32/1TB 등) 수용 — 시세 분포 변동성 받아들임.
    // Wave 182 Phase 2 chunk 2 (2026-05-17): MacBook Pro 16" Apple Silicon (M1/M3/M4) narrow lanes.
    // 16"는 2019 Intel → 2021 M1 Pro/Max → 2023 M2/M3 → 2024 M4. M2 단명 (10개월), 우선순위 낮아서 skip.
    id: "macbook-pro-16-m1-pro-16-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m1_pro_16_512",
    modelName: "MacBook Pro 16\" M1 Pro 16GB/512GB",
    aliases: ["맥북 프로 16 M1 Pro 16 512", "MacBook Pro 16\" M1 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m1 pro", "m1pro"],
      ["16gb", "16 gb", "16기가", "16램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m1 max", "m1max",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      "32gb", "32 gb", "8gb",
      "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3490000,
    released: 2021,
  },
  {
    id: "macbook-pro-16-m1-max-32-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m1_max_32_1tb",
    modelName: "MacBook Pro 16\" M1 Max 32GB/1TB",
    aliases: ["맥북 프로 16 M1 Max", "MacBook Pro 16\" M1 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m1 max", "m1max"],
      ["32gb", "32 gb", "32기가", "32램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m1 pro", "m1pro",
      "(m2)", "(m3)", "(m4)", " m2 ", " m3 ", " m4 ",
      "16gb", "16 gb", "64gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4290000,
    released: 2021,
  },
  {
    id: "macbook-pro-16-m3-pro-18-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m3_pro_18_512",
    modelName: "MacBook Pro 16\" M3 Pro 18GB/512GB",
    aliases: ["맥북 프로 16 M3 Pro", "MacBook Pro 16\" M3 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m3 pro", "m3pro"],
      ["18gb", "18 gb", "18기가", "18램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m3 max", "m3max",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      "36gb", "36 gb", "8gb", "16gb",
      "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3590000,
    released: 2023,
  },
  {
    id: "macbook-pro-16-m3-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m3_max_36_1tb",
    modelName: "MacBook Pro 16\" M3 Max 36GB/1TB",
    aliases: ["맥북 프로 16 M3 Max", "MacBook Pro 16\" M3 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m3 max", "m3max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m3 pro", "m3pro",
      "(m1)", "(m2)", "(m4)", " m1 ", " m2 ", " m4 ",
      "18gb", "18 gb", "8gb", "16gb",
      "48gb", "64gb", "96gb", "128gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4690000,
    released: 2023,
  },
  {
    id: "macbook-pro-16-m4-pro-24-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m4_pro_24_512",
    modelName: "MacBook Pro 16\" M4 Pro 24GB/512GB",
    aliases: ["맥북 프로 16 M4 Pro", "MacBook Pro 16\" M4 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m4 pro", "m4pro"],
      ["24gb", "24 gb", "24기가", "24램", "기본형", "기본 모델"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ",
      "36gb", "36 gb", "48gb", "64gb",
      "8gb", "16gb",
      "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3690000,
    released: 2024,
  },
  {
    id: "macbook-pro-16-m4-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m4_max_36_1tb",
    modelName: "MacBook Pro 16\" M4 Max 36GB/1TB",
    aliases: ["맥북 프로 16 M4 Max", "MacBook Pro 16\" M4 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m4 max", "m4max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m4 pro", "m4pro",
      "(m1)", "(m2)", "(m3)", " m1 ", " m2 ", " m3 ", "(m5)", " m5 ", "m5 max", "m5max",
      "24gb", "24 gb", "48gb", "64gb", "96gb", "128gb",
      "16gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4890000,
    released: 2024,
  },
  // Wave 779 (2026-05-27): MacBook Pro M5 narrow lanes — M4 패턴 그대로 + M5 chip.
  //   MBP M5 시리즈 (2025-10 발표): 14" base / 14" Pro / 14" Max / 16" Pro / 16" Max.
  {
    id: "macbook-pro-14-m5-256",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m5_256",
    modelName: "MacBook Pro 14\" M5 256GB (base)",
    aliases: ["맥북 프로 14 M5 256", "MacBook Pro 14\" M5 256GB"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["m5"],
      ["14인치", "14 인치", "14형", "14\""],
      ["16gb", "16 gb", "16기가", "16램", "기본형", "기본 모델", "깡통", "노옵션", "노 옵션"],
    ],
    mustNotContain: [
      "에어", "air",
      "16인치", "16형",
      "m5 pro", "m5pro", "m5 max", "m5max",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "24gb", "24 gb", "32gb", "36gb", "48gb",
      "8gb", "8 gb", "8기가",
      "512gb", "512 gb", "1tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2490000,
    released: 2025,
    confusionNote: "MacBook Pro 14\" M5 base (2025-10). M4 base 대비 +₩100K.",
  },
  {
    id: "macbook-pro-14-m5-pro-24-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m5_pro_24_512",
    modelName: "MacBook Pro 14\" M5 Pro 24GB/512GB",
    aliases: ["맥북 프로 14 M5 Pro", "MacBook Pro 14\" M5 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m5 pro", "m5pro"],
      ["24gb", "24 gb", "24기가", "24램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "15인치", "15 인치", "15형", "16인치", "16 인치", "16형",
      "m5 max", "m5max",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "16gb", "16 gb", "32gb", "36gb", "48gb",
      "1tb", "1 tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3290000,
    released: 2025,
    confusionNote: "MacBook Pro 14\" M5 Pro 24GB/512GB base (2025-10).",
  },
  {
    id: "macbook-pro-14-m5-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_14_m5_max_36_1tb",
    modelName: "MacBook Pro 14\" M5 Max 36GB/1TB",
    aliases: ["맥북 프로 14 M5 Max", "MacBook Pro 14\" M5 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["14인치", "14 인치", "14형", "14\""],
      ["m5 max", "m5max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "15인치", "15 인치", "15형", "16인치", "16 인치", "16형",
      "m5 pro", "m5pro",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "16gb", "24gb", "24 gb", "48gb", "64gb", "96gb", "128gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 4890000,
    released: 2025,
    confusionNote: "MacBook Pro 14\" M5 Max 36GB/1TB base (2025-10).",
  },
  {
    id: "macbook-pro-16-m5-pro-24-512",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m5_pro_24_512",
    modelName: "MacBook Pro 16\" M5 Pro 24GB/512GB",
    aliases: ["맥북 프로 16 M5 Pro", "MacBook Pro 16\" M5 Pro"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m5 pro", "m5pro"],
      ["24gb", "24 gb", "24기가", "24램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m5 max", "m5max",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "16gb", "16 gb", "32gb", "36gb", "48gb",
      "1tb", "1 tb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3990000,
    released: 2025,
    confusionNote: "MacBook Pro 16\" M5 Pro 24GB/512GB base (2025-10).",
  },
  {
    id: "macbook-pro-16-m5-max-36-1tb",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_m5_max_36_1tb",
    modelName: "MacBook Pro 16\" M5 Max 36GB/1TB",
    aliases: ["맥북 프로 16 M5 Max", "MacBook Pro 16\" M5 Max"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\""],
      ["m5 max", "m5max"],
      ["36gb", "36 gb", "36기가", "36램"],
    ],
    mustNotContain: [
      "에어", "air",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m5 pro", "m5pro",
      "(m1)", "(m2)", "(m3)", "(m4)", " m1 ", " m2 ", " m3 ", " m4 ",
      "24gb", "24 gb", "48gb", "64gb", "96gb", "128gb",
      "16gb",
      "512gb", "512 gb", "2tb",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 5490000,
    released: 2025,
    confusionNote: "MacBook Pro 16\" M5 Max 36GB/1TB base (2025-10).",
  },
  {
    id: "macbook-pro-16-2019",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_16_2019",
    modelName: "MacBook Pro 16\" 2019 (Intel)",
    aliases: ["맥북 프로 16 2019", "MacBook Pro 16\" 2019", "A2141"],
    mustContain: [
      ["맥북", "macbook"],
      ["프로", "pro"],
      ["16인치", "16 인치", "16형", "16\"", "16in", " 16 ", "16,"],
      ["2019", "2019년형", "a2141"],
    ],
    mustNotContain: [
      "에어", " air ",
      "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형",
      "m1 pro", "m1pro", "m1 max", "m1max",
      "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max",
      "m4 pro", "m4pro", "m4 max", "m4max",
      "m5 pro", "m5pro", "m5 max", "m5max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)",
      " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 3290000,
    released: 2019,
  },
  // Wave 124: 옛 Intel macbook narrow lane 일괄 (Pro 15"/13", Air 13"). M1/M2/M3/M4/M5 차단 → Intel only 분리.
  // RAM/SSD 다양 매물 수용 (옛 Intel 은 RAM/SSD 명시 안 한 매물 다수). 시세 분포 변동성 받아들임.
  {
    id: "macbook-pro-15-2019",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_15_2019",
    modelName: "MacBook Pro 15\" 2019 (Intel)",
    aliases: ["맥북 프로 15 2019", "A1990"],
    mustContain: [
      ["맥북", "macbook"], ["프로", "pro"],
      ["15인치", "15 인치", "15형", "15\"", "15in"],
      ["2019", "2019년형", "a1990"],
    ],
    mustNotContain: [
      "에어", " air ", "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "16인치", "16형",
      "m1 pro", "m1pro", "m1 max", "m1max", "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max", "m4 pro", "m4pro", "m4 max", "m4max",
      "m5 pro", "m5pro", "m5 max", "m5max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)", " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2990000,
    released: 2019,
  },
  {
    id: "macbook-pro-15-2018",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_15_2018",
    modelName: "MacBook Pro 15\" 2018 (Intel)",
    aliases: ["맥북 프로 15 2018", "A1990"],
    mustContain: [
      ["맥북", "macbook"], ["프로", "pro"],
      ["15인치", "15 인치", "15형", "15\"", "15in"],
      ["2018", "2018년형"],
    ],
    mustNotContain: [
      "에어", " air ", "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "16인치", "16형",
      "2019", "2017",
      "m1 pro", "m1pro", "m1 max", "m1max", "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max", "m4 pro", "m4pro", "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)", " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2890000,
    released: 2018,
  },
  {
    id: "macbook-pro-15-2017",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_15_2017",
    modelName: "MacBook Pro 15\" 2017 (Intel)",
    aliases: ["맥북 프로 15 2017", "A1707"],
    mustContain: [
      ["맥북", "macbook"], ["프로", "pro"],
      ["15인치", "15 인치", "15형", "15\"", "15in"],
      ["2017", "2017년형", "a1707"],
    ],
    mustNotContain: [
      "에어", " air ", "13인치", "13 인치", "13형", "14인치", "14 인치", "14형", "16인치", "16형",
      "2018", "2019",
      "m1 pro", "m1pro", "m1 max", "m1max", "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max", "m4 pro", "m4pro", "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)", " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 2790000,
    released: 2017,
  },
  {
    id: "macbook-pro-13-2019",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_13_2019",
    modelName: "MacBook Pro 13\" 2019 (Intel)",
    aliases: ["맥북 프로 13 2019", "A2159", "A1989"],
    mustContain: [
      ["맥북", "macbook"], ["프로", "pro"],
      ["13인치", "13 인치", "13형", "13\"", "13in"],
      ["2019", "2019년형", "a2159", "a1989"],
    ],
    mustNotContain: [
      "에어", " air ", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형", "16인치", "16형",
      "m1 pro", "m1pro", "m1 max", "m1max", "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max", "m4 pro", "m4pro", "m4 max", "m4max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)", " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1990000,
    released: 2019,
  },
  {
    id: "macbook-pro-13-2017",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_pro_13_2017",
    modelName: "MacBook Pro 13\" 2017 (Intel)",
    aliases: ["맥북 프로 13 2017", "A1706", "A1708"],
    mustContain: [
      ["맥북", "macbook"], ["프로", "pro"],
      ["13인치", "13 인치", "13형", "13\"", "13in"],
      ["2017", "2017년형", "a1706", "a1708"],
    ],
    mustNotContain: [
      "에어", " air ", "14인치", "14 인치", "14형", "15인치", "15 인치", "15형", "16인치", "16형",
      "2018", "2019",
      "m1 pro", "m1pro", "m1 max", "m1max", "m2 pro", "m2pro", "m2 max", "m2max",
      "m3 pro", "m3pro", "m3 max", "m3max",
      "(m1)", "(m2)", "(m3)", "(m4)", "(m5)", " m1 ", " m2 ", " m3 ", " m4 ", " m5 ",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1790000,
    released: 2017,
  },
  // macbook-pro-13 2013/2015/2016 제거 (Wave 182 9년 정책).
  {
    id: "macbook-air-13-2018",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_13_2018",
    modelName: "MacBook Air 13\" 2018 (Intel)",
    aliases: ["맥북 에어 13 2018", "A1932"],
    mustContain: [
      ["맥북", "macbook"], ["에어", "air"],
      ["13인치", "13 인치", "13형", "13\"", "13in"],
      ["2018", "2018년형", "a1932"],
    ],
    mustNotContain: [
      "프로", " pro", "11인치", "11 인치", "12인치", "12 인치", "15인치", "15 인치", "15형", "16인치",
      "2017", "2019", "2020",
      "m1", "m2", "m3", "m4", "m5",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1490000,
    released: 2018,
  },
  {
    id: "macbook-air-13-2017",
    brand: "Apple",
    category: "laptop",
    laneKey: "macbook_air_13_2017",
    modelName: "MacBook Air 13\" 2017 (Intel)",
    aliases: ["맥북 에어 13 2017", "A1466"],
    mustContain: [
      ["맥북", "macbook"], ["에어", "air"],
      ["13인치", "13 인치", "13형", "13\"", "13in"],
      ["2017", "2017년형"],
    ],
    mustNotContain: [
      "프로", " pro", "11인치", "11 인치", "12인치", "12 인치", "15인치", "15 인치", "15형", "16인치",
      "2018", "2019", "2020",
      "m1", "m2", "m3", "m4", "m5",
      ...LAPTOP_NOISE,
    ],
    msrpKrw: 1290000,
    released: 2017,
  },
  // macbook-air-13-2015 제거 (Wave 182 9년 정책).
  {
    id: "lg-gram-17-2024",
    brand: "LG",
    category: "laptop",
    laneKey: "lg_gram_17_2024",
    modelName: "LG Gram 17\" 2024 (16GB / 512GB)",
    aliases: ["LG 그램 17 2024", "엘지 그램 17 2024", "LG Gram 17 2024"],
    mustContain: [
      ["lg 그램", "lg그램", "lg전자 그램", "lg전자그램", "엘지 그램", "엘지그램", "lg gram"],
      ["17인치", "17 인치", "17형", "17\"", "17z90s", "17zd90s", "17zd90su"],
      ["2024", "13세대", "14세대", "ultra 7", "ultra 5", "코어울트라", "17z90s", "17zd90s", "17zd90su"],
    ],
    mustNotContain: [
      "14인치", "14 인치", "14형",
      "15인치", "15 인치", "15형",
      "16인치", "16형",
      "2 in 1", "2in1",
      "gram pro", "그램프로", "그램 프로",
      "17z90sp", "17zd90sp", "17z90tr", "17zd90tr",
      "17z90r", "17zd90r", "17z90p", "17zd90p", "17z90q", "17zd90q", "17z90u", "17zd90u", "17zd90ru",
      "2023", "2022", "2021", "2020", "2019",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
    ],
    msrpKrw: 1990000,
    released: 2024,
  },
  // Wave 182 Phase 4 (2026-05-17): Galaxy Book 시리즈 (Samsung 노트북 한국 인기).
  // 옵션 변동 큼 (RAM/SSD/screen 다양) — base option fallback (SKU_BASE_OPTIONS) 으로 풀 진입 가능.
  // catalog mustContain 은 모델명 + chip variant. mustNotContain 은 다른 변형 격리.
  {
    id: "galaxy-book-4",
    brand: "Samsung",
    category: "laptop",
    laneKey: "galaxy_book_4",
    modelName: "Samsung Galaxy Book 4 (15.6\")",
    aliases: ["갤럭시북 4", "갤럭시 북 4", "Galaxy Book 4"],
    // mustContain: 갤럭시 북 + 4 결합 명시 (모델명 + 세대 숫자 분리 매칭 회피).
    mustContain: [["갤럭시 북 4", "갤럭시북 4", "갤럭시북4", "galaxy book 4"]],
    // mustNotContain: 다른 변형 (Pro/Ultra/Edge/360 + 다른 세대) 격리. 단일 숫자 X (Core 5 등에 false hit).
    mustNotContain: [
      "프로", "pro", "ultra", "울트라", "edge", "엣지", "360",
      "갤럭시 북 5", "갤럭시북 5", "galaxy book 5", "갤럭시 북 3", "갤럭시북 3",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 1290000,
    released: 2024,
  },
  {
    id: "galaxy-book-4-pro",
    brand: "Samsung",
    category: "laptop",
    laneKey: "galaxy_book_4_pro",
    modelName: "Samsung Galaxy Book 4 Pro (14\")",
    aliases: ["갤럭시북 4 프로", "갤럭시 북 4 프로", "Galaxy Book 4 Pro"],
    mustContain: [
      ["갤럭시 북 4 프로", "갤럭시북 4 프로", "갤럭시북4 프로", "galaxy book 4 pro"],
    ],
    // mustNotContain: "ultra"/"울트라" 단독 박지 X — chip "Core Ultra"의 ultra 자기차단. 모델명 결합으로 격리.
    mustNotContain: [
      "갤럭시 북 4 울트라", "갤럭시북 4 울트라", "galaxy book 4 ultra",
      "360", "edge", "엣지",
      "갤럭시 북 5", "갤럭시북 5", "galaxy book 5",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 1990000,
    released: 2024,
  },
  {
    id: "galaxy-book-4-ultra",
    brand: "Samsung",
    category: "laptop",
    laneKey: "galaxy_book_4_ultra",
    modelName: "Samsung Galaxy Book 4 Ultra (16\", RTX 4050/4070)",
    aliases: ["갤럭시북 4 울트라", "갤럭시 북 4 울트라", "Galaxy Book 4 Ultra"],
    mustContain: [
      ["갤럭시 북 4 울트라", "갤럭시북 4 울트라", "galaxy book 4 ultra"],
    ],
    mustNotContain: [
      "프로", "pro", "edge", "엣지", "360",
      "갤럭시 북 5", "갤럭시북 5", "galaxy book 5",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 3290000,
    released: 2024,
  },
  {
    id: "galaxy-book-5",
    brand: "Samsung",
    category: "laptop",
    laneKey: "galaxy_book_5",
    modelName: "Samsung Galaxy Book 5 (15.6\")",
    aliases: ["갤럭시북 5", "갤럭시 북 5", "Galaxy Book 5"],
    mustContain: [["갤럭시 북 5", "갤럭시북 5", "갤럭시북5", "galaxy book 5"]],
    mustNotContain: [
      "프로", "pro", "ultra", "울트라", "edge", "엣지", "360",
      "갤럭시 북 4", "갤럭시북 4", "galaxy book 4",
      "갤럭시 북 6", "갤럭시북 6", "galaxy book 6",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 1390000,
    released: 2025,
  },
  {
    id: "galaxy-book-5-pro",
    brand: "Samsung",
    category: "laptop",
    laneKey: "galaxy_book_5_pro",
    modelName: "Samsung Galaxy Book 5 Pro",
    aliases: ["갤럭시북 5 프로", "갤럭시 북 5 프로", "Galaxy Book 5 Pro"],
    mustContain: [["갤럭시 북 5 프로", "갤럭시북 5 프로", "galaxy book 5 pro"]],
    // mustNotContain: "ultra"/"울트라" 단독 박지 X — chip "Core Ultra"의 ultra 자기차단. 모델명 결합으로 격리.
    mustNotContain: [
      "갤럭시 북 5 울트라", "갤럭시북 5 울트라", "galaxy book 5 ultra",
      "360", "edge", "엣지",
      "갤럭시 북 4", "갤럭시북 4", "galaxy book 4",
      "액정만", "메인보드", "부품", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 2090000,
    released: 2025,
  },
];

export const CATALOG: Sku[] = [
  // ─── Monitor exact model-code review candidates ─────
  {
    id: "monitor-xl2540k",
    brand: "BenQ ZOWIE",
    category: "monitor",
    laneKey: "monitor_benq_xl2540k",
    modelName: "BenQ ZOWIE XL2540K",
    aliases: ["XL2540K", "벤큐 XL2540K", "ZOWIE XL2540K"],
    mustContain: [["xl2540k"]],
    mustNotContain: [],
    msrpKrw: 499000,
    released: 2020,
  },
  {
    id: "monitor-27us550",
    brand: "LG",
    category: "monitor",
    modelName: "LG 27US550",
    aliases: ["27US550", "LG 27US550", "27US550-W"],
    mustContain: [["27us550"]],
    mustNotContain: [],
    msrpKrw: 399000,
    released: 2024,
  },
  {
    id: "monitor-ls27f354fhk",
    brand: "Samsung",
    category: "monitor",
    modelName: "Samsung LS27F354FHK",
    aliases: ["LS27F354FHK", "삼성 LS27F354FHK"],
    mustContain: [["ls27f354fhk"]],
    mustNotContain: [],
    msrpKrw: 249000,
    released: 2016,
  },
  {
    id: "monitor-39gx900a",
    brand: "LG",
    category: "monitor",
    modelName: "LG 39GX900A",
    aliases: ["39GX900A", "39GX900A-B", "LG 39GX900A"],
    mustContain: [["39gx900a"]],
    mustNotContain: [],
    msrpKrw: 2190000,
    released: 2025,
  },
  {
    id: "monitor-aw2525hm",
    brand: "Dell Alienware",
    category: "monitor",
    modelName: "Dell Alienware AW2525HM",
    aliases: ["AW2525HM", "Alienware AW2525HM"],
    mustContain: [["aw2525hm"]],
    mustNotContain: [],
    msrpKrw: 499000,
    released: 2025,
  },
  {
    // Wave 24: LG 27UP850N-W (UltraFine 4K, USB-C 90W, 2022 refresh). msrp 약 650k.
    // 중고 시세 255~500k (Bunjang 7 collected). UP850 / UP850N / UP850K 변형 포함 (동일 form factor).
    id: "monitor-27up850n",
    brand: "LG",
    category: "monitor",
    laneKey: "monitor_lg_27up850n",
    modelName: "LG 27UP850N-W",
    aliases: ["27UP850N", "27UP850", "27UP850K", "27UP850N-W", "LG 27UP850N", "LG 27UP850", "LG UltraFine 27UP850"],
    mustContain: [["27up850"]],
    mustNotContain: [
      // 다른 LG 4K monitor 변형 분리
      "27ul850", "27uk850", "27up550", "27up600", "27us550",
      // gaming 27GP850과 격리
      "27gp850", "27gn850", "ultragear", "울트라기어",
      // 32"/24" 다른 사이즈
      "32up850", "32up", "24up",
      // 부품/단품/하자
      "스탠드만", "거치대만", "케이블만", "어댑터만", "부품용", "파손", "고장", "수리이력", "액정파손",
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 650000,
    released: 2022,
  },
  {
    // Wave 24 fallback: LG 27GP850-B (UltraGear QHD 165Hz Nano IPS, 2021). msrp 590k.
    // 27UP850N의 distribution 너무 좁음(356~380k)으로 fallback. 중고 240~340k wider.
    id: "monitor-27gp850",
    brand: "LG",
    category: "monitor",
    laneKey: "monitor_lg_27gp850",
    modelName: "LG UltraGear 27GP850-B",
    aliases: ["27GP850", "27GP850-B", "LG 27GP850", "LG UltraGear 27GP850", "엘지 울트라기어 27GP850"],
    mustContain: [["27gp850"]],
    mustNotContain: [
      // 다른 LG UltraGear gaming 변형 격리
      "27gn850", "27gn800", "27gp83", "27gp95", "27gp700",
      // UltraFine 4K 라인업과 격리
      "27up850", "27ul850", "27uk850",
      // 32"/24" 다른 사이즈
      "32gp850", "24gp850",
      // 부품/단품/하자
      "스탠드만", "거치대만", "케이블만", "어댑터만", "부품용", "파손", "고장", "수리이력", "액정파손",
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 590000,
    released: 2021,
  },
  {
    id: "monitor-27gl650f",
    brand: "LG",
    category: "monitor",
    modelName: "LG UltraGear 27GL650F",
    aliases: ["27GL650F", "LG 27GL650F", "울트라기어 27GL650F"],
    mustContain: [["27gl650f"]],
    mustNotContain: [],
    msrpKrw: 399000,
    released: 2019,
  },
  // ─── Portable Bluetooth speaker exact-model review candidates ───
  {
    id: "speaker-jbl-go-3",
    brand: "JBL",
    category: "speaker",
    modelName: "JBL GO 3",
    aliases: ["JBL GO 3", "JBL GO3", "제이비엘 GO3"],
    mustContain: [["jbl", "제이비엘"], ["go3", "go 3"]],
    mustNotContain: [...SPEAKER_NOISE],
    msrpKrw: 49900,
    released: 2020,
  },
  {
    id: "speaker-jbl-go-4",
    brand: "JBL",
    category: "speaker",
    modelName: "JBL GO 4",
    aliases: ["JBL GO 4", "JBL GO4", "제이비엘 GO4"],
    mustContain: [["jbl", "제이비엘"], ["go4", "go 4"]],
    mustNotContain: [...SPEAKER_NOISE],
    msrpKrw: 59900,
    released: 2024,
  },
  {
    id: "speaker-jbl-flip-6",
    brand: "JBL",
    category: "speaker",
    laneKey: "speaker_jbl_flip6",
    modelName: "JBL Flip 6",
    aliases: ["JBL Flip 6", "JBL Flip6", "JBL 플립6", "제이비엘 플립6"],
    mustContain: [["jbl", "제이비엘"], ["flip6", "flip 6", "플립6"]],
    // Wave 84: Flip 5/7 격리. Flip 5/6/7 모두 USB-C라 단자 구분 불가, 텍스트로만.
    // Flip 7 (2025.2) 출시 후 Flip 6 자연 시세 하락 — 격리 명시 필수.
    mustNotContain: [...SPEAKER_NOISE, "flip 5", "flip5", "플립 5", "플립5", "flip 7", "flip7", "플립 7", "플립7", "flip 4", "플립4", "플립 4", "flip 3"],
    msrpKrw: 149000,
    released: 2021,
  },
  {
    // Wave 16: Bose SoundLink Flex narrow lane.
    // JBL Flip 6 (시세 80k)가 bandFromProfit 1 threshold(20k) 통과 구조적 불가하여
    // 더 wide한 가격 분포 (신품 219k, 중고 시세 100~150k) 를 가진 Bose SoundLink Flex 추가.
    // "soundlink flex" 명시 강제 — SoundLink Mini/Revolve/Color/Micro 변형은 mustNotContain로 제외.
    id: "speaker-bose-soundlink-flex",
    brand: "Bose",
    category: "speaker",
    laneKey: "speaker_bose_soundlink_flex",
    modelName: "Bose SoundLink Flex",
    aliases: ["Bose SoundLink Flex", "보스 사운드링크 플렉스", "bose soundlink flex", "보스 SoundLink Flex"],
    mustContain: [["bose", "보스"], ["soundlink flex", "soundlinkflex", "사운드링크 플렉스", "사운드링크플렉스"]],
    mustNotContain: [...SPEAKER_NOISE, "mini", "revolve", "color", "micro", "soundbar", "사운드바"],
    msrpKrw: 219000,
    released: 2021,
  },
  {
    // Wave 20: Sonos Roam (1st gen, 2021) narrow lane.
    // msrp 269k. 중고 시세 100~200k 추정 → bandFromProfit 1+ 통과 가능.
    // Roam SL/Roam 2/Move/One/Five/Era 등 sub-variant는 mustNotContain로 분리.
    id: "speaker-sonos-roam",
    brand: "Sonos",
    category: "speaker",
    laneKey: "speaker_sonos_roam",
    modelName: "Sonos Roam",
    aliases: ["Sonos Roam", "소노스 롬", "소노스Roam", "소노스 로엄", "소노스 로암"],
    mustContain: [["sonos", "소노스"], ["roam", "롬", "로엄", "로암"]],
    mustNotContain: [
      ...SPEAKER_NOISE,
      // Roam 변형 / 다른 Sonos 라인업 격리
      "roam sl", "roamsl", "roam 2", "roam2",
      "move", "one", "five", "era", "beam", "arc", "play:1", "play:3", "play:5", "sub",
      // 충전 도크/패드만 단독 판매 제외
      "충전도크", "충전 도크", "도크만", "wireless charger", "charging dock",
    ],
    msrpKrw: 269000,
    released: 2021,
  },
  {
    // Wave 20: Marshall Emberton II narrow lane (Sonos Roam은 Bunjang 0건으로 pivot).
    // msrp 219k. 중고 시세 80~150k 추정 → bandFromProfit 1~3 통과 가능.
    // Emberton I/III, Stockwell/Kilburn/Willen/Tufton 등 다른 Marshall portable은 분리.
    id: "speaker-marshall-emberton-ii",
    brand: "Marshall",
    category: "speaker",
    laneKey: "speaker_marshall_emberton_ii",
    modelName: "Marshall Emberton II",
    aliases: ["Marshall Emberton II", "Marshall Emberton 2", "마샬 엠버튼 II", "마샬 엠버튼 2", "마샬엠버튼2"],
    mustContain: [["marshall", "마샬"], ["emberton ii", "emberton 2", "emberton2", "엠버튼 ii", "엠버튼 2", "엠버튼2"]],
    mustNotContain: [
      ...SPEAKER_NOISE,
      // Emberton 다른 세대 격리
      "emberton iii", "emberton 3", "emberton3", "엠버튼 iii", "엠버튼 3", "엠버튼3",
      // 다른 Marshall portable 라인업 분리
      "stockwell", "스탁웰", "kilburn", "킬번", "willen", "윌렌", "tufton", "터프턴", "middleton", "미들턴",
      // 거치/홈 시리즈 분리
      "stanmore", "스탠모어", "acton", "액턴", "woburn", "워번",
      // 헤드폰/이어폰 라인업
      "major", "minor", "monitor ii", "헤드폰", "이어폰",
      // 앰프 (마샬은 기타 앰프 브랜드라 같이 검색됨)
      "기타 앰프", "guitar amp", "콤보앰프",
    ],
    msrpKrw: 219000,
    released: 2022,
  },
  // speaker-bose-soundlink-mini-ii 제거 (Wave 182 9년 정책, 2015 모델).
  {
    id: "speaker-jbl-boombox-2",
    brand: "JBL",
    category: "speaker",
    modelName: "JBL Boombox 2",
    aliases: ["JBL Boombox 2", "JBL 붐박스2", "JBL 붐박스 2"],
    mustContain: [["jbl", "제이비엘"], ["boombox 2", "boombox2", "붐박스2", "붐박스 2"]],
    mustNotContain: [...SPEAKER_NOISE],
    msrpKrw: 599000,
    released: 2020,
  },
  {
    id: "speaker-lg-pk5",
    brand: "LG",
    category: "speaker",
    modelName: "LG PK5",
    aliases: ["LG PK5", "엘지 PK5"],
    mustContain: [["lg", "엘지"], ["pk5", "pk 5"]],
    mustNotContain: [...SPEAKER_NOISE],
    msrpKrw: 199000,
    released: 2018,
  },
  {
    id: "speaker-lg-pk7w",
    brand: "LG",
    category: "speaker",
    modelName: "LG PK7W",
    aliases: ["LG PK7W", "엘지 PK7W", "LG 엑스붐 PK7W"],
    mustContain: [["lg", "엘지"], ["pk7w", "pk 7w"]],
    mustNotContain: [...SPEAKER_NOISE],
    msrpKrw: 299000,
    released: 2018,
  },
  // ─── Desktop narrow-lane Wave 17: Mac mini M2 base 256GB ───
  {
    // Mac mini M2 (2023) 8GB/256GB 정가 990k.
    // 중고 시세 분포 600~850k 추정 → bandFromProfit 1 (20k+) 통과 충분.
    // option-parser는 desktop fallthrough로 [family, model] comparable_key 생성.
    id: "desktop-mac-mini-m2-256",
    brand: "Apple",
    category: "desktop",
    laneKey: "desktop_mac_mini_m2_256",
    modelName: "Apple Mac mini M2 256GB",
    aliases: ["Mac mini M2", "맥미니 M2", "맥미니M2", "Apple Mac mini M2", "Mac mini M2 256"],
    mustContain: [["mac mini", "맥미니", "맥 미니"], ["m2"]],
    // M1/M3/M4/Pro/Ultra/Studio 변형 + 512GB 이상 + 16GB RAM 변형 제외 (base 256/8GB만).
    mustNotContain: ["m1", "m3", "m4", "m2 pro", "m2pro", "m2 ultra", "m2ultra", "mac studio", "맥스튜디오", "imac", "아이맥", "macbook", "맥북", "512gb", "1tb", "2tb", "16gb", "24gb"],
    msrpKrw: 990000,
    released: 2023,
  },
  // Wave 118c (2026-05-15): Mac Mini M4 추가 (2024-10 신상, 14일 매물 13건).
  {
    id: "desktop-mac-mini-m4",
    brand: "Apple",
    category: "desktop",
    modelName: "Apple Mac mini M4",
    aliases: ["Mac mini M4", "맥미니 M4", "맥미니M4", "Apple Mac mini M4"],
    mustContain: [["mac mini", "맥미니", "맥 미니"], ["m4"]],
    mustNotContain: ["m1", "m2", "m3", "m4 pro", "m4pro", "m4 max", "m4max", "mac studio", "맥스튜디오", "imac", "아이맥", "macbook", "맥북", "부품", "고장", "매입", "삽니다"],
    msrpKrw: 990000,
    released: 2024,
  },
  // ─── Home appliance narrow-lane Wave 19: Dyson V12 Detect Slim ───
  {
    // Dyson V12 Detect Slim (Korea SKU). msrp 약 890k. 중고 시세 350~700k 추정.
    // 다른 V-시리즈(V6/V7/V8/V10/V11/V15/Gen5)와 분리. option-parser는 home_appliance fallthrough로 [family, model] comparable_key 생성.
    id: "home-appliance-dyson-v12-detect-slim",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "home_appliance_dyson_v12_detect_slim",
    modelName: "Dyson V12 Detect Slim",
    aliases: ["Dyson V12", "다이슨 V12", "다이슨V12", "Dyson V12 Detect Slim", "다이슨 V12 디텍트 슬림"],
    mustContain: [["v12"], ["다이슨", "dyson"]],
    // V12 외 다른 Dyson 모델 + 부품/액세서리/매입/하자 제외.
    mustNotContain: ["v6", "v7", "v8", "v10", "v11", "v15", "gen5", "gen 5", "outsize", "옴니글라이드", "omni-glide", "헤어드라이어", "에어랩", "airwrap", "supersonic", "선풍기", "공기청정기", "히터", "헤드만", "툴만", "배터리만", "필터만", "충전기만", "거치대만", "케이스만", "박스만", "부품용", "파손", "고장", "수리이력", "v12s", "submarine", "서브마린", "물걸레"],
    msrpKrw: 890000,
    released: 2022,
  },
  // ─── Home appliance Wave 21: Roborock S8 Pro Ultra ───
  {
    // Roborock S8 Pro Ultra (flagship robot vacuum + mop, 2023). msrp 1,790k.
    // 중고 시세 600~1,200k 추정 → bandFromProfit 2~3 통과 가능 (distribution wide).
    // Bunjang Roborock 모집단에서 가장 dense (S8 base 0건, Pro Ultra 14건, Qrevo 12건).
    // S8 base/S8+/S8 MaxV/Qrevo/S7/Q-series 등은 mustNotContain로 분리.
    id: "home-appliance-roborock-s8-pro-ultra",
    brand: "Roborock",
    category: "home_appliance",
    laneKey: "home_appliance_roborock_s8_pro_ultra",
    modelName: "Roborock S8 Pro Ultra",
    aliases: ["Roborock S8 Pro Ultra", "로보락 S8 Pro Ultra", "로보락 S8프로울트라", "로보락 S8 프로 울트라", "Roborock S8 ProUltra"],
    mustContain: [["roborock", "로보락"], ["s8 pro ultra", "s8proultra", "s8 프로 울트라", "s8프로울트라", "s8프로 울트라", "s8 프로울트라"]],
    mustNotContain: [
      // S8 다른 변형 분리
      "s8 maxv", "s8maxv", "s8 max v",
      "s8+", "s8 plus", "s8plus",
      // 다른 세대/시리즈
      "s7", "s6", "s5",
      "qrevo", "q revo", "q5", "q7", "q8",
      "g10", "g20", "h7",
      // 부품/소모품/액세서리만
      "걸레만", "솔만", "필터만", "배터리만", "충전기만", "어댑터만", "케이블만",
      "도크만", "충전도크", "거치대만", "케이스만", "박스만",
      "부품용", "파손", "고장", "수리이력", "침수",
      // 매입/구매
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
      // 타 브랜드 robot vac
      "샤오미", "dreame", "드리미", "ecovacs", "에코백스", "lg 코드제로", "삼성 비스포크",
    ],
    msrpKrw: 1790000,
    released: 2023,
  },
  // ─── Wave 183 (2026-05-17): 헤어 기기 (home_appliance 확장) ──
  // Dyson Supersonic / Airwrap / Corrale + 시아루스 글램팜 / 매직 ProV + 파나소닉 나노이 + 바비리스.
  // 모두 단일 옵션 (색상 변형 시세 동일). 짝퉁 risk Dyson 일부 (시리얼/홀로그램 식별).
  {
    id: "dyson-supersonic-hd08",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_supersonic_hd08",
    modelName: "Dyson Supersonic (HD08)",
    aliases: ["Dyson Supersonic", "다이슨 슈퍼소닉", "Dyson HD08"],
    // mustContain 강화: "헤어드라이어" / "드라이어" 명시 매물만 본품으로 인정.
    // Wave 240 (2026-05-19): production audit — "HD15" 매물 188k 매칭. HD15 다른 세대 (24년).
    //   mustContain 에서 "hd15" 제거 + mustNotContain 차단 → HD15 매물 unmatched 처리.
    mustContain: [
      ["다이슨", "dyson"],
      ["슈퍼소닉", "supersonic", "hd08"],
      ["헤어드라이어", "드라이어", "본체", "본품", "풀세트", "hd08"],
    ],
    // Wave 188 internal test (2026-05-18): production sweep 으로 발견한 false positive 차단.
    // Wave 188 follow-up: sweep 재실행 결과 HD08 FP 65% (12/26). "노즐 툴 세트" / "박보검 포토카드 2종" 잡음.
    // → WAVE188_NEW_CATEGORY_NOISE spread 추가.
    mustNotContain: [
      "origin", "오리진", "에어랩", "airwrap", "코랄", "corrale",
      "이미테이션", "정품 아님", "가품",
      // 액세서리/부품 단품
      "노즐만", "노즐 세트", "툴 일괄",
      "필터만", "디퓨저만",
      "거치 대", "7구 거치",
      // 트래블판 (해외 spec) — 한국 본품 시세와 분리
      "트래블", "travel",
      "수리", "고장", "충전 안됨", "침수",
      "매입", "삽니다", "구합니다",
      // Wave 240 (2026-05-19): HD15 / HD16 / HD17 다른 세대 차단.
      "hd15", "hd16", "hd17", "supersonic nural", "뉴럴",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 550000,
    released: 2018,
  },
  {
    id: "dyson-supersonic-origin",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_supersonic_origin",
    modelName: "Dyson Supersonic Origin (HD13)",
    aliases: ["Dyson Supersonic Origin", "다이슨 슈퍼소닉 오리진", "Dyson HD13"],
    mustContain: [["다이슨", "dyson"], ["슈퍼소닉", "supersonic"], ["origin", "오리진", "hd13"]],
    mustNotContain: [
      "에어랩", "airwrap", "코랄", "corrale",
      "이미테이션", "정품 아님", "가품",
      "노즐만", "필터만", "어댑터만", "거치대만",
      "박스만", "충전기만", "부품",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
    ],
    msrpKrw: 399000,
    released: 2023,
  },
  {
    id: "dyson-airwrap-hs05",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_airwrap_hs05",
    modelName: "Dyson Airwrap Multi-styler Complete (HS05)",
    aliases: ["Dyson Airwrap", "다이슨 에어랩", "Airwrap Multi-styler", "에어랩 멀티스타일러"],
    // mustContain 강화: "본체 / 본품 / 풀세트 / 컴플리트 / 멀티스타일러 / 스타일러 (단독 토큰)" 명시 매물만.
    mustContain: [
      ["다이슨", "dyson"],
      ["에어랩", "airwrap"],
      ["본체", "본품", "풀세트", "컴플리트", "complete", "멀티스타일러", "스타일러"],
    ],
    // Wave 188 internal test (2026-05-18): production sweep 추가 false positive 차단.
    // Wave 188 follow-up: sweep 재실행 결과 HS05 FP 37% (8/24). "HS01 풀세트" (구형 — 별 SKU), "휙 다이슨 저렴이" 잡음.
    // → HS01 / HS02 / HS03 / HS04 구형 차단 + WAVE188_NEW_CATEGORY_NOISE spread 추가.
    mustNotContain: [
      "i.d.", " id ", "iD", "코안다", "co-anda", "coanda", "2x", "hs08",
      "오리진", "origin", "hs09",
      // Wave 188 follow-up: 구형 (HS01/02/03/04) — 다른 시세 라인이므로 차단
      "hs01", "hs02", "hs03", "hs04",
      "슈퍼소닉", "supersonic", "코랄", "corrale",
      "이미테이션", "정품 아님", "가품",
      // 액세서리/어태치먼트 단품
      "어태치먼트만", "노즐만", "디퓨저만",
      "7구 거치",
      "롱배럴 단품", "롱배럴만", "양방향 롱배럴 40mm 미사용", "양방향 롱배럴 단품",
      "브러쉬", "브러시", "스무딩",
      "부품",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      // Wave 240 (2026-05-19): production audit — "로로보아 에어아르떼" 매물 다이슨 SKU 잘못 매칭.
      "로로보아", "loroboa", "loroboar", "에어아르떼", "airarte",
      // "다이슨 에어랩X" / "다이슨 에어랩 아님" 같은 명시적 부정 표기
      "에어랩x", "에어랩 x", "에어랩 아님", "에어랩이 아닌",
      // Wave 250 (2026-05-19): CV 1.43 (n=37) — 한국어 "아이디" 모델 / 한정판 색상 / 110v 변경 매물 차단.
      //   pid 407010796 "한정판 컴플리트 롱 (오닉스/골드)" ₩3.9M outlier.
      //   pid 345607032 "에어랩 아이디" ₩660k — HS-ID 신모델 (별도 lane, 영문 i.d./id 만 잡혀 통과).
      //   pid 408401448 "에어랩 교환 (110v>220v)" — 110v→220v 변경 서비스 매물.
      "아이디 멀티", "아이디 스타일러", "아이디 에어랩", "에어랩 아이디",
      "한정판", "limited edition", "limited 에디션",
      "오닉스/골드", "온닉스/골드", "온닉스 골드",
      "110v>220v", "110v→220v", "110v 변경", "110v 교환", "변환 서비스", "교환 서비스",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 699000,
    released: 2022,
  },
  // Wave 185 internal test (2026-05-18): Dyson Airwrap Origin (저가형 신모델, 2024.11) 추가.
  {
    id: "dyson-airwrap-origin",
    brand: "Dyson", category: "home_appliance", laneKey: "dyson_airwrap_origin",
    modelName: "Dyson Airwrap Origin",
    aliases: ["Dyson Airwrap Origin", "다이슨 에어랩 오리진"],
    mustContain: [["다이슨", "dyson"], ["에어랩", "airwrap"], ["오리진", "origin"]],
    mustNotContain: [
      "i.d.", "iD", "코안다", "co-anda", "coanda", "2x", "hs08",
      "슈퍼소닉", "supersonic", "코랄", "corrale",
      "브러쉬", "어태치먼트만", "노즐만", "롱배럴 단품",
      "수리", "고장", "침수",
      "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 449000,
    released: 2024,
  },
  {
    id: "dyson-airwrap-id",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_airwrap_id",
    modelName: "Dyson Airwrap i.d. (HS08, Co-anda 2x)",
    aliases: ["Dyson Airwrap i.d.", "다이슨 에어랩 i.d.", "Airwrap iD", "Airwrap Coanda 2x"],
    mustContain: [
      ["다이슨", "dyson"],
      ["에어랩", "airwrap"],
      ["i.d.", " id ", "iD", "코안다", "co-anda", "coanda", "2x", "hs08"],
    ],
    mustNotContain: [
      "hs05", "multi-styler complete",
      "슈퍼소닉", "supersonic", "코랄", "corrale",
      "이미테이션", "정품 아님", "가품",
      "어태치먼트만", "노즐만", "어댑터만", "거치대만",
      "박스만", "케이스만", "충전기만", "부품",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
    ],
    msrpKrw: 899000,
    released: 2024,
  },
  {
    id: "dyson-corrale-hs07",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_corrale_hs07",
    modelName: "Dyson Corrale (HS07, 무선 고데기)",
    aliases: ["Dyson Corrale", "다이슨 코랄", "Dyson HS07"],
    mustContain: [["다이슨", "dyson"], ["코랄", "corrale", "hs07"], ["본체", "본품", "풀세트", "무선 고데기", "고데기"]],
    mustNotContain: [
      "슈퍼소닉", "supersonic", "에어랩", "airwrap",
      "플레이트만", "플레이트 단품", "노즐만",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 599000,
    released: 2020,
  },
  // Wave 751d (2026-05-24) Pareto: Dyson V-series 무선 청소기 76건 unmatched.
  // V15 (33건) + V12 (43건) catalog 누락 — Pareto big win.
  {
    id: "dyson-v15-detect",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_v15_detect",
    modelName: "Dyson V15 Detect / Submarine (무선 청소기)",
    aliases: ["Dyson V15", "다이슨 V15", "V15 Detect", "V15 서브마린"],
    mustContain: [["다이슨", "dyson"], ["v15", "v 15"]],
    mustNotContain: [
      "v8", "v 8", "v10", "v 10", "v11", "v 11", "v12", "v 12",
      "에어랩", "airwrap", "슈퍼소닉", "supersonic", "코랄", "corrale",
      "필터만", "헤드만", "노즐만", "배터리만", "전동브러시만",
      "충전기만", "거치대만",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다", "구해요",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 900000,
    released: 2021,
  },
  {
    id: "dyson-v12-detect",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_v12_detect",
    modelName: "Dyson V12 Detect Slim / Submarine (무선 청소기)",
    aliases: ["Dyson V12", "다이슨 V12", "V12 Detect Slim", "V12 서브마린"],
    mustContain: [["다이슨", "dyson"], ["v12", "v 12"]],
    mustNotContain: [
      "v8", "v 8", "v10", "v 10", "v11", "v 11", "v15", "v 15",
      "에어랩", "airwrap", "슈퍼소닉", "supersonic", "코랄", "corrale",
      "필터만", "헤드만", "노즐만", "배터리만", "전동브러시만",
      "충전기만", "거치대만",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다", "구해요",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 700000,
    released: 2021,
  },
  {
    id: "dyson-v8-v11-vacuum-broad",
    brand: "Dyson",
    category: "home_appliance",
    laneKey: "dyson_v8_v11_vacuum_broad",
    modelName: "Dyson V8 / V10 / V11 무선 청소기 (구형 broad)",
    aliases: ["Dyson V8", "Dyson V10", "Dyson V11", "다이슨 V8", "다이슨 V10", "다이슨 V11"],
    mustContain: [["다이슨", "dyson"], ["v8", "v 8", "v10", "v 10", "v11", "v 11"]],
    mustNotContain: [
      "v12", "v 12", "v15", "v 15", "v6", "v 6",
      "에어랩", "airwrap", "슈퍼소닉", "supersonic", "코랄", "corrale",
      "필터만", "헤드만", "노즐만", "배터리만", "전동브러시만",
      "충전기만", "거치대만",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다", "구해요",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 500000,
    released: 2018,
    confusionNote: "V8 (2016)/V10 (2018)/V11 (2019) — 구형 broad. V12 (2021)/V15 (2021)는 별도 SKU.",
  },
  {
    id: "cyaars-glampam",
    brand: "Cyaars",
    category: "home_appliance",
    laneKey: "cyaars_glampam",
    modelName: "시아루스 글램팜",
    aliases: ["시아루스 글램팜", "글램팜", "Glampam"],
    mustContain: [["시아루스", "cyaars"], ["글램팜", "glampam"]],
    mustNotContain: [
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 250000,
    released: 2021,
  },
  {
    id: "cyaars-magic-prov",
    brand: "Cyaars",
    category: "home_appliance",
    laneKey: "cyaars_magic_prov",
    modelName: "시아루스 매직 ProV",
    aliases: ["시아루스 매직 ProV", "시아루스 매직프로V", "Magic ProV"],
    mustContain: [["시아루스", "cyaars"], ["매직", "magic"], ["prov", "pro v", "프로 v", "프로v"]],
    mustNotContain: [
      "글램팜", "glampam", "인피니티", "infinity",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 199000,
    released: 2022,
  },
  {
    id: "panasonic-eh-na0j",
    brand: "Panasonic",
    category: "home_appliance",
    laneKey: "panasonic_eh_na0j",
    modelName: "Panasonic EH-NA0J (나노이 + 미네랄)",
    aliases: ["Panasonic EH-NA0J", "파나소닉 EH-NA0J", "파나소닉 나노이", "EH-NA0J"],
    mustContain: [["파나소닉", "panasonic"], ["eh-na0j", "eh na0j", "ehna0j", "na0j"]],
    mustNotContain: [
      "eh-na9c", "na9c", "eh-na98", "na98", "eh-na2j", "na2j",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 280000,
    released: 2021,
  },
  {
    id: "panasonic-eh-na9c",
    brand: "Panasonic",
    category: "home_appliance",
    laneKey: "panasonic_eh_na9c",
    modelName: "Panasonic EH-NA9C (나노이)",
    aliases: ["Panasonic EH-NA9C", "파나소닉 EH-NA9C", "EH-NA9C"],
    mustContain: [["파나소닉", "panasonic"], ["eh-na9c", "eh na9c", "ehna9c", "na9c"]],
    mustNotContain: [
      "eh-na0j", "na0j", "eh-na98", "na98", "eh-na2j", "na2j",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 199000,
    released: 2019,
  },
  {
    id: "panasonic-eh-na98",
    brand: "Panasonic",
    category: "home_appliance",
    laneKey: "panasonic_eh_na98",
    modelName: "Panasonic EH-NA98",
    aliases: ["Panasonic EH-NA98", "파나소닉 EH-NA98", "EH-NA98"],
    mustContain: [["파나소닉", "panasonic"], ["eh-na98", "eh na98", "ehna98", "na98"]],
    mustNotContain: [
      "eh-na0j", "na0j", "eh-na9c", "na9c",
      "케이스만", "박스만", "충전기만", "부품",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 179000,
    released: 2018,
  },
  {
    id: "babyliss-pro-2174u",
    brand: "BaByliss",
    category: "home_appliance",
    laneKey: "babyliss_pro_2174u",
    modelName: "BaByliss Pro 2174U 파마기",
    aliases: ["BaByliss Pro 2174U", "바비리스 프로 2174U", "Babyliss 2174"],
    mustContain: [["babyliss", "바비리스"], ["pro", "프로"], ["2174", "2174u"]],
    mustNotContain: [
      "케이스만", "박스만", "충전기만", "부품",
      "수리", "고장", "침수",
      "매입", "삽니다", "구합니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 130000,
    released: 2020,
  },
  // ─── Desktop Wave 22: iMac M3 24-inch ───
  {
    // Apple iMac M1 24" (2021). Dense enough in generic "아이맥" query, but
    // must stay separate from older Intel 21/27-inch and newer M3/M4 models.
    id: "desktop-imac-m1-24",
    brand: "Apple",
    category: "desktop",
    laneKey: "desktop_imac_m1_24",
    modelName: "Apple iMac M1 24\"",
    aliases: ["iMac M1", "아이맥 M1", "iMac M1 24", "아이맥 M1 24", "아이맥 24인치 M1"],
    mustContain: [["imac", "아이맥"], ["m1"]],
    mustNotContain: [
      "m2", "m3", "m4", "intel", "인텔",
      "27인치", "27\"", "27in", "21인치", "21.5", "21\"", "21in", "retina 5k", "5k retina",
      "mac studio", "맥 스튜디오", "맥스튜디오", "mac pro", "맥프로", "mac mini", "맥미니", "macbook", "맥북",
      "스탠드만", "어댑터만", "케이블만", "박스만", "케이스만", "부품용", "파손", "고장", "수리이력", "액정파손", "메인보드",
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 1690000,
    released: 2021,
  },
  {
    // Apple iMac M3 24" (2023). msrp 1,690~2,090k (8GB/256 base ~ 16GB/512 top).
    // Bunjang probe: M3 67건 (가장 dense), distribution 1.2~1.55M. wide enough for profit_band 1~2.
    // 다른 chip(M1/M2/M4/Intel) + 27"/21" 이전 세대 분리.
    id: "desktop-imac-m3-24",
    brand: "Apple",
    category: "desktop",
    laneKey: "desktop_imac_m3_24",
    modelName: "Apple iMac M3 24\"",
    aliases: ["iMac M3", "아이맥 M3", "iMac M3 24", "아이맥 M3 24", "아이맥 24인치 M3"],
    mustContain: [["imac", "아이맥"], ["m3"]],
    mustNotContain: [
      // 다른 chip 격리
      "m1", "m2", "m4", "intel", "인텔",
      // iMac 27"/21" (Intel 시절) 격리
      "27인치", "27\"", "27in", "21인치", "21.5", "21\"", "21in", "retina 5k", "5k retina",
      // Mac Studio / mini / Pro / MacBook 분리
      "mac studio", "맥스튜디오", "mac pro", "맥프로", "mac mini", "맥미니", "macbook", "맥북",
      // 부품/단품/하자
      "스탠드만", "어댑터만", "케이블만", "박스만", "케이스만", "부품용", "파손", "고장", "수리이력", "액정파손", "메인보드",
      // 매입/구매
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 1890000,
    released: 2023,
  },
  {
    // Wave 112 (2026-05-15): Apple iMac M4 24" (2024-10). msrp 1,990k base. Bunjang
    // 30분 sweep null sample에서 "아이맥 m4 256 기본형" 1건 발견. catalog 누락.
    // M1/M2/M3 + 27"/21" (Intel) 격리.
    id: "desktop-imac-m4-24",
    brand: "Apple",
    category: "desktop",
    laneKey: "desktop_imac_m4_24",
    modelName: "Apple iMac M4 24\"",
    aliases: ["iMac M4", "아이맥 M4", "iMac M4 24", "아이맥 M4 24", "아이맥 24인치 M4"],
    mustContain: [["imac", "아이맥"], ["m4"]],
    mustNotContain: [
      "m1", "m2", "m3", "intel", "인텔",
      "27인치", "27\"", "27in", "21인치", "21.5", "21\"", "21in", "retina 5k", "5k retina",
      "mac studio", "맥스튜디오", "mac pro", "맥프로", "mac mini", "맥미니", "macbook", "맥북",
      "스탠드만", "어댑터만", "케이블만", "박스만", "케이스만", "부품용", "파손", "고장", "수리이력", "액정파손", "메인보드",
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 1990000,
    released: 2024,
  },
  {
    // Apple Mac Studio M4 Max 512GB (2025). Query "맥스튜디오" is polluted by
    // MAXSTUDIO apparel; only exact Mac Studio + M4 Max + 512 rows may bind.
    id: "desktop-mac-studio-m4-max-512",
    brand: "Apple",
    category: "desktop",
    laneKey: "desktop_mac_studio_m4_max_512",
    modelName: "Apple Mac Studio M4 Max 512GB",
    aliases: ["Mac Studio M4 Max", "맥 스튜디오 M4 Max", "맥스튜디오 M4 Max", "맥 스튜디오 M4 맥스"],
    mustContain: [["mac studio", "맥 스튜디오", "맥스튜디오"], ["m4 max", "m4max", "m4 맥스"], ["512", "512gb", "512g"]],
    mustNotContain: [
      "m1", "m2", "m3", "m4 pro", "m4pro", "m2 max", "m2max", "m2 ultra", "m2ultra",
      "imac", "아이맥", "mac mini", "맥미니", "macbook", "맥북", "mac pro", "맥프로",
      "1tb", "1테라", "2tb", "2테라", "4tb", "4테라",
      "스탠드만", "어댑터만", "케이블만", "박스만", "케이스만", "부품용", "파손", "고장", "수리이력", "메인보드",
      "매입", "삽니다", "구해요", "구매합니다", "구합니다",
    ],
    msrpKrw: 3290000,
    released: 2025,
  },
  // ─── Camera body-only exact-model internal candidates ───
  {
    id: "camera-canon-eos-r6-mark-ii",
    brand: "Canon",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Canon EOS R6 Mark II",
    aliases: ["Canon EOS R6 Mark II", "캐논 EOS R6 Mark II", "알육막투", "R6M2"],
    // Wave 86: body 요구 제거 (R6 Mark II 매물 다수가 "바디" 명시 없음). 대신
    // mustNotContain에 lens kit 패턴 + R6 Mark III/R5/R5 Mark II 격리 강화.
    mustContain: [["eos r6 mark ii", "r6 mark ii", "r6m2", "알육막투"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "r6 mark iii", "r6mark3", "r6m3", "알육막삼", "+ rf ", "+ ef ", "+ 24-", "+ 70-", "+ 28-", "+ 85", "+ 35", "+ 70 200", "+ 24 105", "+ 24 70"],
    msrpKrw: 3199000,
    released: 2022,
  },
  {
    id: "camera-sony-a7m3",
    brand: "Sony",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Sony A7 III",
    aliases: ["Sony A7 III", "Sony A7M3", "소니 A7M3", "ILCE-7M3"],
    // Wave 86: body 요구 제거. A7R/A7S/A7C 모든 변형 격리 강화.
    // Wave 617 (2026-05-22): production false positive — pid 409263245 '삼성 갤럭시 탭 A7 32GB' 100k 매물이
    //   'a7 3' substring match로 잘못 매칭 ('a7 32gb' 안에 'a7 3' 들어감). 'a7 3' → 'a7 iii' 만 사용.
    mustContain: [["a7m3", "a7 iii", "ilce 7m3"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "a7m2", "a7m4", "a7r3", "a7rm3", "a7r iii", "a7r3", "a7s3", "a7s iii", "a7s ii", "a7sm3", "a7c", "a7c2", "a7c ll", "a7cr", "a7c ii", "ilce-7cm2", "ilce 7cm2", "ilce-7sm2", "ilce 7sm2", "+ rf", "+ ef", "+ 28-75", "+ 24-", "+ 70-", "케이지",
      // Wave 617: 다른 카테고리 false positive (Galaxy Tab A7 등).
      "갤럭시", "galaxy", "삼성", "samsung", "tab a7", "탭 a7", "탭a7",
    ],
    msrpKrw: 2499000,
    released: 2018,
  },
  {
    id: "camera-sony-a7c",
    brand: "Sony",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Sony A7C",
    aliases: ["Sony A7C", "소니 A7C", "ILCE-7C"],
    // Wave 86: body 요구 제거 + A7C II/A7CR/A7M3/A7S 격리 강화.
    mustContain: [["a7c", "ilce 7c"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "a7c2", "a7cr", "a7c ll", "a7c2 ", "a7c ii", "7cm2", "ilce 7cm2", "ilce-7cm2", "a7m3", "a7m4", "a7s2", "a7s3", "ilce 7sm2", "ilce-7sm2", "+ rf", "+ ef", "+ 28-", "+ 24-", "+ 70-", "케이지"],
    msrpKrw: 2199000,
    released: 2020,
  },
  {
    // Wave 87: A7C II (2023.10) — A7C 후속, 33MP, ILCE-7CM2. A7C broad noise 해소.
    id: "camera-sony-a7c-ii",
    brand: "Sony",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Sony A7C II",
    aliases: ["Sony A7C II", "소니 A7C II", "Sony A7C2", "소니 A7C2", "A7C ll", "ILCE-7CM2"],
    mustContain: [["a7c2", "a7c ii", "a7c ll", "ilce 7cm2"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "a7cr", "ilce 7cr", "a7c rangefinder", "a7m3", "a7m4", "a7s2", "a7s3", "ilce 7sm2", "+ rf", "+ ef", "+ 28-", "+ 24-", "+ 70-", "케이지"],
    msrpKrw: 2999000,
    released: 2023,
  },
  {
    // Wave 87: A7CR (2023.10) — A7C 라인 고해상 61MP variant, ILCE-7CR.
    id: "camera-sony-a7cr",
    brand: "Sony",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Sony A7CR",
    aliases: ["Sony A7CR", "소니 A7CR", "ILCE-7CR"],
    mustContain: [["a7cr", "ilce 7cr"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "a7c2", "a7c ii", "ilce 7cm2", "a7r", "a7r5", "a7r v", "a7r iv", "a7m3", "a7m4", "+ rf", "+ ef", "+ 28-", "+ 24-", "+ 70-", "케이지"],
    msrpKrw: 4290000,
    released: 2023,
  },
  // camera-sony-a5100 제거 (Wave 182 9년 정책, 2014).
  {
    id: "camera-canon-eos-m6",
    brand: "Canon",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Canon EOS M6",
    aliases: ["Canon EOS M6", "캐논 EOS M6"],
    mustContain: [["eos m6", "캐논 m6"], ["바디", "바디만", "body"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE],
    msrpKrw: 899000,
    released: 2017,
  },
  {
    id: "camera-nikon-z9",
    brand: "Nikon",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Nikon Z9",
    aliases: ["Nikon Z9", "니콘 Z9"],
    mustContain: [["z9", "니콘 z9"], ["바디", "바디만", "body"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE],
    msrpKrw: 6998000,
    released: 2021,
  },
  // camera-canon-eos-6d 제거 (Wave 182 9년 정책, 2012).
  {
    id: "camera-fujifilm-x-t4",
    brand: "Fujifilm",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Fujifilm X-T4",
    aliases: ["Fujifilm X-T4", "후지필름 X-T4", "후지 X-T4"],
    mustContain: [["x-t4", "x t4", "xt4"], ["바디", "바디만", "body"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE],
    msrpKrw: 2099000,
    released: 2020,
  },
  // ─── PlayStation 5 (Standard, Disc/Digital) ─────────
  // narrow lane: ps5_disc_digital_standard (Slim/Pro/PSVR/Switch/액세서리 차단)
  {
    id: "ps5-disc-standard",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps5_disc_digital_standard",
    modelName: "PlayStation 5 (Disc, Standard)",
    aliases: ["PS5 디스크", "PS5 Disc", "플스5 디스크", "플레이스테이션 5 디스크"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5", "playstation 5"],
      ["디스크", "disc"],
    ],
    mustNotContain: [
      "ps5 pro", "ps 5 pro", "플스5 프로", "플스 5 프로", "ps5pro",
      "슬림", "slim", "ps5 slim", "플스5 슬림",
      "디지털 에디션", "digital edition", "디지털에디션",
      "psvr", "psvr2", "ps vr", "vr2", "vr 2",
      "스위치", "switch", "닌텐도", "nintendo",
      "ps4", "ps3", "ps2", "ps1",
      "컨트롤러만", "듀얼센스만", "dualsense만", "충전기만", "케이스만", "스탠드만",
      "기프트", "gift card", "디지털 카드", "월정액",
      "ssd만", "ssd 단품", "카드만",
      "구합니다", "삽니다", "매입", "wts", "wtb",
      "부품용", "고장",
    ],
    msrpKrw: 698000,
    released: 2020,
  },
  {
    id: "ps5-digital-standard",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps5_disc_digital_standard",
    modelName: "PlayStation 5 (Digital, Standard)",
    aliases: ["PS5 디지털", "PS5 Digital", "플스5 디지털", "플레이스테이션 5 디지털 에디션"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5", "playstation 5"],
      ["디지털", "digital"],
    ],
    mustNotContain: [
      "ps5 pro", "ps 5 pro", "플스5 프로", "플스 5 프로", "ps5pro",
      "슬림", "slim", "ps5 slim", "플스5 슬림",
      "디스크 에디션", "disc edition", "디스크에디션",
      "psvr", "psvr2", "ps vr", "vr2", "vr 2",
      "스위치", "switch", "닌텐도", "nintendo",
      "ps4", "ps3", "ps2", "ps1",
      "컨트롤러만", "듀얼센스만", "dualsense만", "충전기만", "케이스만", "스탠드만",
      "기프트", "gift card", "디지털 카드", "월정액", "psn",
      "ssd만", "ssd 단품", "카드만",
      "구합니다", "삽니다", "매입", "wts", "wtb",
      "부품용", "고장",
    ],
    msrpKrw: 568000,
    released: 2020,
  },
  // Wave 754 (2026-05-24) Pareto: PS5 base 526건 unmatched (edition 명시 안 된 broad).
  // disc/digital 명시 안 된 generic "PS5" 매물 catch-all. 시세는 disc/digital 평균치로.
  {
    id: "ps5-broad",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps5_broad",
    modelName: "PlayStation 5 (broad — edition 미명시)",
    aliases: ["PS5", "플스5", "플레이스테이션 5"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5", "playstation 5"],
    ],
    mustNotContain: [
      // narrow lane으로 매칭되어야 할 명시
      "디스크", "disc", "디지털", "digital",
      "ps5 pro", "ps 5 pro", "플스5 프로", "ps5pro",
      "슬림", "slim", "ps5 slim",
      "psvr", "psvr2", "ps vr", "vr2",
      "스위치", "switch", "닌텐도",
      "ps4", "ps3", "ps2", "ps1",
      "컨트롤러만", "듀얼센스만", "dualsense만", "충전기만", "케이스만", "스탠드만",
      "기프트", "gift card", "디지털 카드", "월정액", "psn",
      "구합니다", "삽니다", "매입", "wts", "wtb",
      "부품용", "고장",
      // Wave 758 Phase 2 (2026-05-24): 게임 TITLE/액세서리 systemic 차단 (Switch v1 패턴).
      // 게임 TITLE (PS5 게임이 본체 SKU에 흡수되는 거 차단)
      "아바타", "프론티어", "가디언즈", "오브 갤럭시", "진삼국무쌍", "삼국무쌍",
      "원피스 오디세이", "오디세이", "갓오브워", "라스트오브어스", "라스트 오브 어스",
      "호라이즌", "데몬즈소울", "데몬즈 소울", "콜오브듀티", "콜 오브 듀티", "콜옵",
      "콜 옵", "gta", "디아블로", "엘든링", "엘든 링", "사이버펑크",
      "리틀나이트메어", "에이스컴뱃", "ace combat", "파이널판타지", "파판", "ff7", "ff15",
      "젤다", "포켓몬", "마리오", "메트로이드", "동물의숲",
      "용과 같이", "야쿠자", "철권", "스트리트 파이터",
      // 스틸북/케이스/CD/타이틀
      "스틸북", "스틸 북", "스틸케이스", "스틸 케이스", "ps5 타이틀", "타이틀만",
      "ps5 cd", "cd 매입", "디스크 매입",
      // 한정판/에디션 (game)
      "한정판 게임", "에디션 게임", "에디션 한정", "타이틀 일괄", "게임 일괄",
      "특전상품", "특전 상품", "예약특전", "리미티드 에디션 게임",
      // 액세서리
      "펄스 3d", "펄스3d", "pulse 3d", "무선 헤드셋", "헤드셋만",
      "듀얼센스 컨트롤러 2개", "듀얼센스만 판매", "컨트롤러 2개", "패드 2개",
      "충전 거치대만", "충전거치대만", "ssd 2t", "ssd 1t", "콘솔 커버", "콘솔커버",
    ],
    msrpKrw: 630000,  // disc 698K + digital 568K 평균
    released: 2020,
  },
  // Wave 754 — PS4 base broad (210 unmatched)
  {
    id: "ps4-broad",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps4_broad",
    modelName: "PlayStation 4 (broad)",
    aliases: ["PS4", "플스4", "플레이스테이션 4"],
    mustContain: [
      ["ps4", "플스4", "플스 4", "플레이스테이션 4", "playstation 4"],
    ],
    mustNotContain: [
      "ps4 pro", "플스4 프로", "ps4pro", "프로",
      "ps4 슬림", "ps4 slim", "플스4 슬림", "슬림",
      "ps5", "ps3", "ps2", "ps1",
      "psvr", "psvr2", "ps vr", "vr2",
      "스위치", "switch", "닌텐도",
      "컨트롤러만", "듀얼쇼크만", "dualshock만", "충전기만", "케이스만", "스탠드만",
      "기프트", "gift card", "디지털 카드", "월정액", "psn",
      "ssd만", "ssd 단품", "카드만",
      "구합니다", "삽니다", "매입", "wts", "wtb",
      "부품용", "고장",
      "ps2", "ps22", // PS2 게임 일련번호 false match (Wave 753c galaxy-s22와 동일)
      // Wave 758 Phase 2 (2026-05-24): 게임 TITLE/스틸북 systemic 차단 (PS4 본체 매칭 1% → 50%+ 회복).
      // PS4 게임 TITLE (PS4 본체 SKU가 게임 카트리지 흡수)
      "고스트트릭", "운명갱신", "스카이랜더스", "스왑포스", "아크파크",
      "리틀나이트메어", "라이덴", "라이덴5", "파이널판타지", "파판",
      "에이스컴뱃", "ace combat", "갓오브워", "라스트오브어스", "라스트 오브 어스",
      "콜오브듀티", "콜 오브 듀티", "콜옵", "콜 옵", "gta",
      "원피스", "오디세이", "용과 같이", "야쿠자", "철권", "스트리트 파이터",
      "ps4 타이틀", "타이틀 정발", "ps4 cd", "cd 매입", "디스크 매입",
      "ps4 미개봉 게임", "신품 정발",
      // 스틸북/케이스/한정판
      "스틸북", "스틸 북", "스틸케이스", "스틸 케이스",
      "디렉터스 컷", "디렉터스컷", "리미티드 에디션 게임", "한정판 게임",
      // 게임 일괄/매입
      "타이틀 일괄", "게임 일괄", "vr 게임 2개", "ps4 cd 매입",
      // 액세서리
      "고스트2", "조이스틱", "EX Revolution", "duo 컨트롤러",
      "패드 2개", "컨트롤러 2개", "헤드셋만",
      // mod/jailbreak (정상 매물 X)
      "goldhen", "골든헨", "rebug", "리벅", "젠지", "젠지젠지",
    ],
    msrpKrw: 398000,
    released: 2013,
  },
  // Wave 754 — PS4 Pro narrow (37 unmatched)
  {
    id: "ps4-pro",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps4_pro",
    modelName: "PlayStation 4 Pro",
    aliases: ["PS4 Pro", "플스4 프로", "플스 4 프로"],
    mustContain: [
      ["ps4", "플스4", "플스 4", "플레이스테이션 4", "playstation 4"],
      ["pro", "프로"],
    ],
    mustNotContain: [
      "ps5", "ps3", "ps2", "ps1",
      "슬림", "slim",
      "psvr", "psvr2",
      "스위치", "switch", "닌텐도",
      "컨트롤러만", "듀얼쇼크만", "충전기만", "케이스만", "스탠드만",
      "구합니다", "삽니다", "매입",
      "부품용", "고장",
    ],
    msrpKrw: 498000,
    released: 2016,
  },
  // ─── Nintendo Switch OLED (2021-10) ─────────────────
  // Wave 117b (2026-05-15): Nintendo Switch 1세대 broad + Switch Lite catalog 추가.
  // 매물 측정: 14일 Switch v1 339건 / Switch Lite 19건. 다 sku_id null이었음.
  // 3DS/2DS/DS (옛 휴대용) + 네트워크 스위치 격리.
  {
    id: "switch-v1",
    brand: "Nintendo",
    category: "game_console",
    modelName: "Nintendo Switch (1st gen, 2017)",
    aliases: ["Nintendo Switch", "닌텐도 스위치", "스위치 1세대", "스위치1"],
    mustContain: [
      ["닌텐도 스위치", "닌텐도스위치", "nintendo switch", "스위치1", "스위치 1세대"],
    ],
    mustNotContain: [
      // 다른 Switch 모델 격리
      "oled", "올레드",
      "스위치 2", "스위치2", "switch 2", "switch2",
      "라이트", "lite",
      // 옛 휴대용 게임기 격리 (3DS / DS / 2DS는 별도 카테고리)
      "3ds", "ds xl", "dsxl", "2ds", "nds", " ds ",
      // 네트워크 스위치 격리 (dell s5232f-on 같은 IT 장비)
      "dell", "cisco", "sfp", "포트", "네트워크",
      // 게임/액세서리 단품
      "컨트롤러만", "조이콘만", "게임만", "게임 팩", "게임 카드", "게임팩",
      "충전기만", "케이스만", "독만", "도크만",
      "부품", "고장",
      "매입", "삽니다", "구해요", "구합니다",
      // Wave 751b (2026-05-24) Pareto: 307x spread audit — 액세서리/게임 카트리지 false match 대량.
      "메탈걸쇠", "메탈 걸쇠", "걸쇠 교체", "헐거움",
      "조이콘 핸드그립", "조이콘핸드그립", "조이콘 핸들", "조이콘 스트랩", "조이콘 그립",
      "핸드그립 세트", "그립 세트",
      // 게임 타이틀 (스위치 게임 카트리지가 콘솔로 false match)
      "fifa", "피파", "마리오카트", "큐브 크리에이터", "친구모아", "친구 모아",
      "젤다", "zelda", "포켓몬", "pokemon", "스플래툰", "splatoon",
      "닌텐도 스위치 수리", "스위치 수리",
      // Wave 758 (2026-05-24) Game category deep sweep — 게임 카트리지/액세서리 systemic 차단.
      // 사용자 발견: switch-v1 SKU가 게임 TITLE까지 흡수 → 시세군 망가짐 (5만~22만 mix).
      // 게임 카트리지/디스크/알칩 (단품)
      "알칩", "알 칩", "곽팩", "곽 팩", "디스크 단품", "카트리지 단품", "카트리지만",
      "게임칩", "게임 칩", "게임 카트리지", "게임카트리지", "게임 cd", "게임cd",
      "타이틀", "title", "정품 타이틀", "스틸북", "스틸 북", "스틸 케이스", "스틸케이스",
      // 게임 TITLE (가장 많이 흡수되는 게임명)
      "마인크래프트", "minecraft", "포켓몬스터", "별의커비", "별의 커비", "슈퍼 몽키볼",
      "리버시티", "지라프", "픽스 아크", "역전재판", "오도로키", "시드마이어", "문명 6",
      "슈퍼 스매시", "스매시 브라더스", "대난투", "동물의숲", "동물의 숲", "모여봐요",
      "메이드 인 와리오", "와리오", "동키콩", "트로피컬", "오리와 눈먼", "테니스 월드",
      "리버시티", "에어포트 히어로", "젤다의 꿈꾸는", "꿈꾸는 섬", "제노블레이드",
      "마리오 잼버리", "마리오 테니스", "에이스", "슈퍼 마리오 3d", "퓨리 월드",
      "심연", "떠도는밤", "샤이닝펄", "포켓몬 실드", "스타얼라이즈", "메트로이드",
      "삼국무쌍", "갤럭시", "원피스 오디세이", "가디언즈", "갤럭시 오브",
      "용과 같이", "야쿠자", "철권", "스트리트 파이터", "버추얼파이터",
      "ace combat", "에이스컴뱃", "리듬세상", "리듬 세상",
      // 액세서리
      "프로콘", "프로 컨트롤러", "pro controller", "조이콘 정품", "정품 조이콘", "조이콘 그립",
      "아미보", "amiibo", "아미보 카드", "아미보카드",
      "휠", "스티어링 휠", "레이싱 휠", "마리오카트 레이싱",
      "닌텐도 정품 hdmi", "정품 hdmi", "hdmi 케이블", "hdmi케이블",
      "충전독", "충전 독", "충전 거치대",
      // 옛 닌텐도 콘솔
      "wii", "wii u", "위유", "wii콘",
      "gba", "게임보이 어드밴스", "게임보이어드밴스",
      "게임보이", "gameboy", "gbc", "gb 컬러", "게임보이 컬러", "게임보이컬러",
      "sfc", "슈퍼패미컴", "슈퍼 패미컴", "패미콤", "fc 캡틴", "famicom",
      "닌텐도 클래식 미니", "클래식 미니", "닌텐도클래식",
      "dsi", "dsi ll", "dsill",
      // 한정판/콜라보 케이스 (HEAD bag/SWEETCH 브랜드 케이스)
      "sweetch", "스위치 케이스", "스위치케이스 브랜드", "헬멧백",
      // 동봉/일괄 패턴 (단품 시세 무의미)
      "타이틀 일괄", "게임 일괄", "타이틀 합본", "게임 합본",
      ...SWITCH_BODY_GAME_TITLE_NOISE,
    ],
    msrpKrw: 360000,
    released: 2017,
    confusionNote: "1세대 (2017). LCD 6.2인치, 분리 가능 조이콘. OLED (2021)/Lite (2019)/Switch 2 (2025)와 별도.",
  },
  {
    id: "switch-lite",
    brand: "Nintendo",
    category: "game_console",
    modelName: "Nintendo Switch Lite",
    aliases: ["Nintendo Switch Lite", "닌텐도 스위치 라이트", "스위치 라이트", "스위치라이트"],
    mustContain: [
      ["닌텐도", "nintendo", "스위치", "switch"],
      ["라이트", "lite"],
    ],
    mustNotContain: [
      "oled", "올레드",
      "스위치 2", "스위치2", "switch 2", "switch2",
      "3ds", "ds xl", "dsxl", "2ds", "nds", " ds ",
      "dell", "cisco", "sfp", "포트", "네트워크",
      "컨트롤러만", "조이콘만", "게임만", "게임 팩", "게임팩",
      "충전기만", "케이스만",
      "부품", "고장",
      "매입", "삽니다", "구해요", "구합니다",
    ],
    msrpKrw: 270000,
    released: 2019,
    confusionNote: "Lite (2019) = 휴대용 전용 (TV 연결 X, 조이콘 분리 X). 일반 Switch와 시세 다름 (₩90K↓).",
  },
  // Wave 771 (2026-05-27): Wave 111i broad switch-2 entry 삭제 — Wave 758 narrow (laneKey=switch_2, msrp 480k) 와 중복 (id 동일). dedupe.
  // narrow lane: switch_oled (Switch 2/Lite/일반 스위치/PS5/액세서리 차단)
  {
    id: "switch-oled",
    brand: "Nintendo",
    category: "game_console",
    laneKey: "switch_oled",
    modelName: "Nintendo Switch OLED Full Set (박스/독/조이콘 포함)",
    aliases: ["Nintendo Switch OLED", "닌텐도 스위치 OLED", "스위치 올레드", "스위치 OLED"],
    mustContain: [
      ["닌텐도", "nintendo", "스위치", "switch"],
      ["oled", "올레드"],
    ],
    // Wave 771 (2026-05-27): bodyonly indicators 차단. owner decision A — fullset vs bodyonly 별도 SKU 분리.
    //   매물 sample 분석: "풀박스/풀세트/풀박" = fullset (default 시장, 245-420k) / "박스 없음/본체만/본체 제외" = bodyonly (별도 SKU).
    mustNotContain: [
      "스위치 2", "switch 2", "스위치2", "switch2",
      "라이트", "lite",
      "일반 스위치", "스위치 1",
      "ps5", "ps4",
      "컨트롤러만", "조이콘만", "게임만", "게임 팩", "게임 카드",
      "기프트", "gift",
      "충전기만", "케이스만",
      "부품", "고장",
      "매입", "삽니다",
      // Wave 771: bodyonly indicators → switch-oled-bodyonly narrow에 양보
      "박스 없음", "박스없음", "박스 X", "박스미포함", "박스 미포함",
      "본체만", "본체 단품", "본체단품", "본체 제외", "본체제외",
    ],
    msrpKrw: 414000,
    released: 2021,
    confusionNote: "OLED (2021-10) Full Set. 박스/독/조이콘/스트랩/충전기 포함 매물. 본체만 매물은 switch-oled-bodyonly SKU.",
  },
  // Wave 771 (2026-05-27): owner decision A — Switch OLED body-only 별도 SKU.
  //   bodyonly 매물 시세 ~250k (fullset 대비 30-40% 낮음). 별도 SKU로 정확한 시세 비교.
  {
    id: "switch-oled-bodyonly",
    brand: "Nintendo",
    category: "game_console",
    laneKey: "switch_oled_bodyonly",
    modelName: "Nintendo Switch OLED Body Only (본체만, 박스/구성품 없음)",
    aliases: ["Nintendo Switch OLED 본체만", "닌텐도 스위치 OLED 본체만", "스위치 OLED 박스 없음"],
    mustContain: [
      ["닌텐도", "nintendo", "스위치", "switch"],
      ["oled", "올레드"],
      // bodyonly 명시 indicator 중 하나는 필수
      ["박스 없음", "박스없음", "박스 X", "박스미포함", "박스 미포함", "본체만", "본체 단품", "본체단품"],
    ],
    mustNotContain: [
      "스위치 2", "switch 2", "스위치2", "switch2",
      "라이트", "lite",
      "일반 스위치", "스위치 1",
      "ps5", "ps4",
      "컨트롤러만", "조이콘만", "게임만", "게임 팩", "게임 카드",
      "기프트", "gift",
      "충전기만", "케이스만",
      "부품", "고장",
      "매입", "삽니다",
      // 본체 없는 액세서리 매물 차단 (예: "본체 제외 박스만")
      "본체 제외", "본체제외", "본체 분실", "본체분실",
      // 풀박스 매물 차단 (switch-oled SKU 양보)
      "풀박스", "풀박", "풀세트", "박스 포함", "박스포함", "박스 있음",
    ],
    msrpKrw: 250000,  // 시장 시세 fullset 대비 -40%
    released: 2021,
    confusionNote: "OLED bodyonly. 본체만 매물 (박스/구성품 없음). fullset 대비 시세 ~30-40% 낮음.",
  },
  // Wave 758 (2026-05-24) 게임 deep sweep: Switch 2 (2025-06) 신설.
  //   audit: 335 unmatched 매물 (catalog 없음). 신상 인기 모델.
  //   본체 75만~85만 / 게임 4.6만~10만 / 액세서리 (프로콘2/조이콘 커버) 별도.
  {
    id: "switch-2",
    brand: "Nintendo",
    category: "game_console",
    laneKey: "switch_2",
    modelName: "Nintendo Switch 2 (2025-06)",
    aliases: ["Nintendo Switch 2", "닌텐도 스위치 2", "스위치2", "Switch 2"],
    mustContain: [
      ["스위치 2", "스위치2", "switch 2", "switch2", "닌텐도 스위치 2", "닌텐도 스위치2"],
    ],
    mustNotContain: [
      // 다른 모델 격리
      "oled", "올레드", "lite", "라이트",
      "닌텐도 스위치 1", "스위치 1세대", "스위치1세대",
      "ps5", "ps4", "xbox", "엑박", "스팀덱",
      // 게임 카트리지/액세서리 (본체 외 — 시세군 다름)
      "메트로이드 프라임", "마리오 파티", "마리오파티", "잼버리", "동물의숲", "동물의 숲",
      "포코피아", "요시", "드래곤퀘스트", "스컬앤코", "스칼렛", "야숨", "왕눈",
      "프로콘2", "프로콘 2", "조이콘 스틱커버", "조이콘스틱", "스틱커버",
      "파우치", "퀼팅 미디움", "케이스 블랙", "케이스만",
      "타이틀 일괄", "게임 일괄", "타이틀 15종", "게임 15종",
      "구매합니다", "구합니다", "삽니다", "매입",
      // 게임 단품 (스위치2용 게임은 본체 아님)
      "스위치2 게임", "스위치2용 게임", "스위치2용 카트리지",
      "스위치2 카트리지", "스위치2 알칩",
    ],
    msrpKrw: 480000,
    released: 2025,
    confusionNote: "Switch 2 (2025-06). 본체 시세 75~85만. 게임 4~10만, 액세서리 별도. 일반 Switch (2017)와 별도 SKU.",
  },
  // Wave 758: Xbox 신설 (77 unmatched 매물, catalog 없음).
  //   Series X/S 신상 본체 + One (구형) 모두 cover.
  {
    id: "xbox-series-x",
    brand: "Microsoft",
    category: "game_console",
    laneKey: "xbox_series_x",
    modelName: "Xbox Series X (2020-11)",
    aliases: ["Xbox Series X", "엑박 시리즈 X", "엑스박스 시리즈 X"],
    mustContain: [
      ["xbox series x", "xbox seriesx", "엑박 시리즈 x", "엑박시리즈x", "엑스박스 시리즈 x", "엑스박스시리즈x"],
    ],
    mustNotContain: [
      "series s", "시리즈 s", "시리즈s",
      "xbox one", "엑박 원", "엑박원", "xbox 360", "엑박 360",
      "ps5", "ps4", "스위치", "스팀덱",
      "컨트롤러만", "컨트롤러 단품", "패드만",
      "키넥트", "kinect", "어답터", "어댑터",
      "게임만", "디스크만", "타이틀만",
      "구매합니다", "구합니다", "삽니다", "매입",
      "ASUS ROG", "ROG Ally", "rog ally",
    ],
    msrpKrw: 598000,
    released: 2020,
  },
  {
    id: "xbox-series-s",
    brand: "Microsoft",
    category: "game_console",
    laneKey: "xbox_series_s",
    modelName: "Xbox Series S (2020-11)",
    aliases: ["Xbox Series S", "엑박 시리즈 S", "엑스박스 시리즈 S"],
    mustContain: [
      ["xbox series s", "xbox seriess", "엑박 시리즈 s", "엑박시리즈s", "엑스박스 시리즈 s", "엑스박스시리즈s"],
    ],
    mustNotContain: [
      "series x", "시리즈 x", "시리즈x",
      "xbox one", "엑박 원", "엑박원", "xbox 360", "엑박 360",
      "ps5", "ps4", "스위치", "스팀덱",
      "컨트롤러만", "컨트롤러 단품", "패드만",
      "키넥트", "kinect",
      "게임만", "디스크만", "타이틀만",
      "구매합니다", "구합니다", "삽니다", "매입",
    ],
    msrpKrw: 398000,
    released: 2020,
  },
  {
    id: "xbox-one",
    brand: "Microsoft",
    category: "game_console",
    laneKey: "xbox_one_broad",
    modelName: "Xbox One (S/X, 2013-2017 구형)",
    aliases: ["Xbox One", "엑박 원", "엑박원"],
    mustContain: [
      ["xbox one", "xbox 1", "엑박 원", "엑박원", "엑스박스 원", "엑스박스원"],
    ],
    mustNotContain: [
      "series x", "series s", "시리즈 x", "시리즈 s",
      "xbox 360", "엑박 360",
      "ps5", "ps4", "스위치", "스팀덱",
      "컨트롤러만", "패드만", "키넥트만",
      "게임만", "디스크만", "타이틀만",
      "구매합니다", "구합니다", "삽니다", "매입",
    ],
    msrpKrw: 498000,
    released: 2013,
  },
  // Wave 758: Steam Deck 신설 (22 unmatched 매물).
  {
    id: "steamdeck-oled",
    brand: "Valve",
    category: "game_console",
    laneKey: "steamdeck_oled",
    modelName: "Steam Deck OLED (2023-11)",
    aliases: ["Steam Deck OLED", "스팀덱 OLED", "스팀덱oled"],
    mustContain: [
      ["스팀덱", "steam deck", "steamdeck"],
      ["oled", "올레드"],
    ],
    mustNotContain: [
      "lcd", "엘시디",
      "rog ally", "asus rog", "legion go", "리전고", "리전 go", "gpd",
      "umpc", "한방팩", "에뮬게임",
      "노트북",
      "구매합니다", "구합니다", "삽니다", "사삽니다", "매입",
      "케이스만", "독만", "스킨만",
    ],
    msrpKrw: 700000,
    released: 2023,
  },
  {
    id: "steamdeck-lcd",
    brand: "Valve",
    category: "game_console",
    laneKey: "steamdeck_lcd",
    modelName: "Steam Deck LCD (2022-02)",
    aliases: ["Steam Deck LCD", "스팀덱 LCD", "스팀덱lcd"],
    mustContain: [
      ["스팀덱", "steam deck", "steamdeck"],
      ["lcd", "엘시디"],
    ],
    mustNotContain: [
      "oled", "올레드",
      "rog ally", "asus rog", "legion go", "리전고", "리전 go", "gpd",
      "umpc", "한방팩",
      "노트북",
      "구매합니다", "구합니다", "삽니다", "매입",
      "케이스만", "독만", "스킨만",
    ],
    msrpKrw: 400000,
    released: 2022,
  },
  // ═══════════════════════════════════════════════════════════
  // Wave 760 (2026-05-24) 골프 narrow split (Wave 760 sweep 결과 기반)
  // Wave 760 sweep 발견: Ping iron 935% spread, Majesty iron 721%, Titleist iron 689% 등.
  // Priority A 30+ SKU.
  // ═══════════════════════════════════════════════════════════
  // ─── TaylorMade Driver narrow (subModel 별 분리) ───
  {
    id: "sport-golf-taylormade-stealth2-driver",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_stealth2_driver",
    modelName: "TaylorMade Stealth2 Driver (신상)",
    aliases: ["Stealth2", "스텔스2"],
    mustContain: [["테일러메이드", "taylormade"], ["스텔스2", "스텔스 2", "stealth2", "stealth 2"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "qi10", "sim", "burner", "r7"],
    msrpKrw: 800000, released: 2023,
  },
  {
    id: "sport-golf-taylormade-qi10-driver",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_qi10_driver",
    modelName: "TaylorMade Qi10 Driver (최신)",
    aliases: ["Qi10"],
    mustContain: [["테일러메이드", "taylormade"], ["qi10"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "qi35", "stealth", "sim", "burner"],
    msrpKrw: 950000, released: 2024,
  },
  {
    id: "sport-golf-taylormade-stealth-driver",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_stealth_driver",
    modelName: "TaylorMade Stealth Driver",
    aliases: ["Stealth", "스텔스"],
    mustContain: [["테일러메이드", "taylormade"], ["스텔스", "stealth"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "stealth2", "스텔스2", "qi10"],
    msrpKrw: 550000, released: 2022,
  },
  {
    id: "sport-golf-taylormade-sim-driver",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_sim_driver",
    modelName: "TaylorMade SIM/SIM2/SIM Max Driver",
    aliases: ["SIM Driver", "SIM2", "SIM Max", "심맥스"],
    mustContain: [["테일러메이드", "taylormade"], ["sim", "심맥스", "심2맥스"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "stealth", "qi10"],
    msrpKrw: 350000, released: 2020,
  },
  // ─── Ping Iron narrow (G-series) ───
  {
    id: "sport-golf-ping-g430-iron",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_g430_iron",
    modelName: "Ping G430 Iron Set",
    aliases: ["Ping G430 Iron", "핑 G430 아이언"],
    mustContain: [["ping", "핑 ", "핑골프"], ["g430"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "g440", "g425", "g410", "g400", "i230", "i500", "타핑", "쇼핑", "핑크"],
    msrpKrw: 1500000, released: 2023,
  },
  {
    id: "sport-golf-ping-g425-iron",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_g425_iron",
    modelName: "Ping G425 Iron Set",
    aliases: ["Ping G425 Iron", "핑 G425 아이언"],
    mustContain: [["ping", "핑 ", "핑골프"], ["g425"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "g440", "g430", "g410", "g400", "i230", "i500", "타핑", "쇼핑", "핑크"],
    msrpKrw: 1200000, released: 2020,
  },
  {
    id: "sport-golf-ping-i230-iron",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_i230_iron",
    modelName: "Ping i230 Iron Set (forged)",
    aliases: ["Ping i230 Iron", "핑 i230 아이언"],
    mustContain: [["ping", "핑 ", "핑골프"], ["i230"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "g430", "g425", "i500", "타핑", "쇼핑", "핑크"],
    msrpKrw: 1400000, released: 2022,
  },
  {
    id: "sport-golf-ping-i500-iron",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_i500_iron",
    modelName: "Ping i500/i525 Iron Set",
    aliases: ["Ping i500", "Ping i525", "핑 i500", "핑 i525"],
    mustContain: [["ping", "핑 ", "핑골프"], ["i500", "i525"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "g430", "g425", "i230", "타핑", "쇼핑", "핑크"],
    msrpKrw: 800000, released: 2018,
  },
  // ─── Titleist Iron narrow (T-series + AP-series) ───
  {
    id: "sport-golf-titleist-t100-iron",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_t100_iron",
    modelName: "Titleist T100 Iron Set (players)",
    aliases: ["Titleist T100 Iron", "타이틀리스트 T100"],
    mustContain: [["타이틀리스트", "titleist"], ["t100"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "t200", "t300", "t350", "ap1", "ap2", "ap3"],
    msrpKrw: 1800000, released: 2023,
  },
  {
    id: "sport-golf-titleist-t200-iron",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_t200_iron",
    modelName: "Titleist T200 Iron Set (forgiving players)",
    aliases: ["Titleist T200 Iron", "타이틀리스트 T200"],
    mustContain: [["타이틀리스트", "titleist"], ["t200"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "t100", "t300", "t350", "ap1", "ap2", "ap3"],
    msrpKrw: 1700000, released: 2023,
  },
  {
    id: "sport-golf-titleist-ap-iron",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_ap_iron",
    modelName: "Titleist AP1/AP2/AP3 Iron Set (구형)",
    aliases: ["Titleist AP1", "Titleist AP2", "Titleist AP3"],
    mustContain: [["타이틀리스트", "titleist"], ["ap1", "ap2", "ap3", "ap 1", "ap 2", "ap 3"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "t100", "t200", "t300", "t350"],
    msrpKrw: 700000, released: 2018,
  },
  // ─── Titleist Driver narrow (GT/TSR/TSi) ───
  {
    id: "sport-golf-titleist-gt-driver",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_gt_driver",
    modelName: "Titleist GT2/GT3 Driver (2024 신상)",
    aliases: ["Titleist GT2", "Titleist GT3", "타이틀리스트 GT"],
    mustContain: [["타이틀리스트", "titleist"], ["gt2", "gt3", "gt 2", "gt 3"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "tsr", "tsi", "ts3", "ts2"],
    msrpKrw: 1100000, released: 2024,
  },
  {
    id: "sport-golf-titleist-tsi-driver",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_tsi_driver",
    modelName: "Titleist TSi2/TSi3 Driver (구형)",
    aliases: ["Titleist TSi2", "Titleist TSi3", "타이틀리스트 TSi"],
    mustContain: [["타이틀리스트", "titleist"], ["tsi2", "tsi3", "tsi 2", "tsi 3"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "tsr", "gt2", "gt3", "ts3", "ts2"],
    msrpKrw: 500000, released: 2020,
  },
  // ─── Honma Iron narrow (Beres = premium vs Tour World) ───
  {
    id: "sport-golf-honma-beres-iron",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_beres_iron",
    modelName: "Honma Beres Iron Set (premium 4-5 star)",
    aliases: ["Honma Beres Iron", "혼마 베레스 아이언"],
    mustContain: [["혼마", "honma"], ["베레스", "beres"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "tour world", "tw series"],
    msrpKrw: 2500000, released: 2020,
  },
  {
    id: "sport-golf-honma-tour-world-iron",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_tour_world_iron",
    modelName: "Honma Tour World Iron Set (mid-tier)",
    aliases: ["Honma Tour World Iron", "혼마 투어월드"],
    mustContain: [["혼마", "honma"], ["tour world", "tw 시리즈", "투어월드", "투어 월드", "tw747", "tw757", "tw767", "tw777"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "베레스", "beres"],
    msrpKrw: 600000, released: 2018,
  },
  // ─── XXIO Driver narrow (신/구세대) ───
  {
    id: "sport-golf-xxio-13-12-driver",
    brand: "XXIO", category: "sport_golf", laneKey: "sport_golf_xxio_13_12_driver",
    modelName: "XXIO 13/12 Driver (신세대)",
    aliases: ["XXIO 13", "XXIO 12", "젝시오 13", "젝시오 12"],
    mustContain: [["젝시오", "xxio"], ["13", "12", "13세대", "12세대", "젝시오13", "젝시오12"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "11", "10", "9", "8", "7"],
    msrpKrw: 950000, released: 2023,
  },
  {
    id: "sport-golf-xxio-11-9-driver",
    brand: "XXIO", category: "sport_golf", laneKey: "sport_golf_xxio_11_9_driver",
    modelName: "XXIO 9/10/11 Driver (구세대 4-7년 전)",
    aliases: ["XXIO 11", "XXIO 10", "XXIO 9"],
    mustContain: [["젝시오", "xxio"], ["11", "10", "9", "젝시오11", "젝시오10", "젝시오9"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "13", "12", "mp400", "mp500"],
    msrpKrw: 350000, released: 2017,
  },
  // ─── Callaway Iron narrow ───
  {
    id: "sport-golf-callaway-paradym-iron",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_paradym_iron",
    modelName: "Callaway Paradym Iron Set (신상)",
    aliases: ["Callaway Paradym Iron", "캘러웨이 패러다임"],
    mustContain: [["캘러웨이", "callaway"], ["paradym", "패러다임"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "rogue", "apex", "epic", "mavrik"],
    msrpKrw: 1500000, released: 2023,
  },
  {
    id: "sport-golf-callaway-apex-iron",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_apex_iron",
    modelName: "Callaway Apex Iron Set (forged premium)",
    aliases: ["Callaway Apex Iron", "캘러웨이 에이펙스"],
    mustContain: [["캘러웨이", "callaway"], ["apex", "에이펙스"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "paradym", "rogue", "mavrik"],
    msrpKrw: 1700000, released: 2022,
  },
  {
    id: "sport-golf-callaway-rogue-iron",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_rogue_iron",
    modelName: "Callaway Rogue Iron Set (mid-tier)",
    aliases: ["Callaway Rogue Iron", "캘러웨이 로그"],
    mustContain: [["캘러웨이", "callaway"], ["rogue", "로그"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE, "paradym", "apex", "epic", "mavrik"],
    msrpKrw: 700000, released: 2018,
  },
  // ═══════════════════════════════════════════════════════════
  // ─── PlayStation 5 Slim (Disc/Digital, 2023-11) ─────
  // narrow lane: ps5_slim (Standard/Pro/PSVR/Switch/액세서리 차단)
  {
    id: "ps5-slim-disc",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps5_slim",
    modelName: "PlayStation 5 Slim (Disc)",
    aliases: ["PS5 슬림 디스크", "PS5 Slim Disc", "플스5 슬림 디스크", "플레이스테이션 5 슬림 디스크"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5"],
      ["슬림", "slim"],
      ["디스크", "disc"],
    ],
    mustNotContain: [
      "ps5 pro", "ps 5 pro", "플스5 프로", "ps5pro",
      "psvr", "psvr2", "vr2", "ps vr",
      "switch", "닌텐도", "nintendo",
      "ps4", "ps3", "ps2", "ps1",
      "컨트롤러만", "듀얼센스만", "dualsense만", "충전기만", "케이스만", "스탠드만",
      "디스크 드라이브", "disc drive",
      "기프트", "gift card", "월정액",
      "ssd만", "ssd 단품",
      "구합니다", "삽니다", "매입",
      "부품용", "고장",
    ],
    msrpKrw: 628000,
    released: 2023,
  },
  {
    id: "ps5-slim-digital",
    brand: "Sony",
    category: "game_console",
    laneKey: "ps5_slim",
    modelName: "PlayStation 5 Slim (Digital)",
    aliases: ["PS5 슬림 디지털", "PS5 Slim Digital", "플스5 슬림 디지털", "플레이스테이션 5 슬림 디지털"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5"],
      ["슬림", "slim"],
      ["디지털", "digital"],
    ],
    mustNotContain: [
      "ps5 pro", "ps 5 pro", "플스5 프로", "ps5pro",
      "psvr", "psvr2", "vr2", "ps vr",
      "switch", "닌텐도", "nintendo",
      "ps4", "ps3", "ps2", "ps1",
      "컨트롤러만", "듀얼센스만", "dualsense만", "충전기만", "케이스만", "스탠드만",
      "기프트", "gift card", "월정액",
      "ssd만", "ssd 단품",
      "구합니다", "삽니다", "매입",
      "부품용", "고장",
    ],
    msrpKrw: 498000,
    released: 2023,
  },
  // Wave 118c (2026-05-15): PS5 Pro 신상 catalog 추가 (2024-11 출시, 14일 매물 11건).
  {
    id: "ps5-pro",
    brand: "Sony",
    category: "game_console",
    modelName: "PlayStation 5 Pro",
    aliases: ["PS5 Pro", "PS5 프로", "플스5 프로", "플레이스테이션 5 프로"],
    mustContain: [
      ["ps5", "플스5", "플스 5", "플레이스테이션 5"],
      ["pro", "프로"],
    ],
    mustNotContain: [
      "슬림", "slim",
      "psvr", "psvr2", "vr2", "ps vr",
      "switch", "닌텐도", "nintendo",
      "ps4", "ps3",
      "컨트롤러만", "듀얼센스만", "패드만", "케이스만", "스탠드만",
      "거치대만", "케이블만", "어댑터만", "충전기만",
      "게임만", "디스크만", "보드만",
      "부품", "고장", "수리이력", "삽니다", "구합니다", "매입",
    ],
    msrpKrw: 990000,
    released: 2024,
    confusionNote: "PS5 Pro 신상 (2024-11). GPU 67% 더 강력, 8K 지원. 일반 PS5 / Slim과 별도 모델, ~₩300K↑.",
  },
  // ─── AirPods ─────────────────────────────────────────
  {
    id: "airpods-2",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 2nd gen",
    aliases: ["에어팟 2세대", "AirPods 2", "에어팟2"],
    mustContain: [["에어팟", "airpods"], ["2세대", "2 세대", "2nd"]],
    mustNotContain: ["프로", "pro", "max", "맥스", "3세대", "4세대"],
    msrpKrw: 199000,
    released: 2019,
  },
  {
    id: "airpods-3",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 3rd gen",
    aliases: ["에어팟 3세대", "AirPods 3", "에어팟3"],
    mustContain: [["에어팟", "airpods"], ["3세대", "3 세대", "3rd"]],
    mustNotContain: ["프로", "pro", "max", "맥스", "2세대", "4세대"],
    msrpKrw: 269000,
    released: 2021,
  },
  {
    id: "airpods-4",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 4th gen",
    aliases: ["에어팟 4세대", "AirPods 4", "에어팟4"],
    mustContain: [["에어팟", "airpods"], ["4세대", "4 세대", "4th"]],
    // ANC 매물은 airpods-4-anc SKU로만 분류 (별도 제품).
    // Wave 753 (2026-05-24) Pareto: 275x audit — case+brand collab + 케으스 typo + mix listing 차단.
    mustNotContain: ["프로", "pro", "max", "맥스", "2세대", "3세대", "anc", "노이즈 캔슬", "노캔", "노이즈캔슬",
      "마이멜로디", "쿠로미", "산리오", "sanrio", "포차코", "리락쿠마",
      "케으스", "케이스만", "보호 케이스", "보호케이스",
      "에어팟 프류", // typo "프로" 같은 mix listing
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 199000,
    released: 2024,
  },
  {
    id: "airpods-pro-1",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 1st gen",
    aliases: ["에어팟 프로 1세대", "AirPods Pro 1"],
    // Wave 749e: 한국 셀러 표기 "프로1" / "프로 1" / "에어팟프로1" no-space 변형 보강.
    mustContain: [["에어팟", "airpods"], ["프로", "pro"], ["1세대", "1 세대", "1st", "프로1", "프로 1", "pro1", "pro 1"]],
    // Wave 179 (2026-05-17): HEADPHONE_NOISE 추가 — 단품/유닛/케이스만 차단 일관성.
    mustNotContain: [
      "2세대", "2nd", "max", "맥스", "usb-c", "usbc", "c타입", "타입c",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 329000,
    released: 2019,
  },
  {
    // 2026-05-16 (사용자 코멘트 #110 + Apple 공식 확인): AirPods Pro 2 Lightning(2022) vs USB-C(2023)
    // 정가 동일 359K, 차이는 IP54 방진 + Vision Pro 무손실 (사실상 무의미) + 충전 단자만.
    // catalog 분리 의미 없음 → 단일 SKU 통합. 시세 sample 합쳐 정확도 ↑.
    // 옛 두 SKU (airpods-pro-2-lightning + airpods-pro-2-usbc) 통합. parser/comparable_key 도 connector token 무시.
    id: "airpods-pro-2",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 2nd gen (Lightning + USB-C 통합)",
    aliases: ["에어팟 프로 2세대", "AirPods Pro 2", "AirPods Pro 2nd gen"],
    mustContain: [
      ["에어팟", "airpods"],
      ["프로", "pro"],
      ["2세대", "2 세대", "2nd", " 2 ", "프로 2", "프로2"],
    ],
    mustNotContain: [
      "max", "맥스",
      "3세대", "3 세대", "3rd", "프로 3", "프로3",
      "1세대", "1 세대", "1st", "프로 1", "프로1",
      // Wave 179 (2026-05-17): 단품/유닛/케이스만 차단 (HEADPHONE_NOISE).
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 359000,
    released: 2022,
    confusionNote: "Lightning(2022) + USB-C(2023) 통합 SKU. 기능 차이는 IP54 방진 + Vision Pro 무손실 (사실상 무의미). 시세 동일 처리.",
  },
  {
    id: "airpods-4-anc",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods 4 (ANC)",
    aliases: ["에어팟 4세대 ANC", "AirPods 4 ANC", "에어팟4 ANC"],
    // 변형 흡수: "에어팟4 ANC" (공백 없음), "에어팟 4 ANC" 등.
    // 다른 세대는 mustNotContain "1세대/2세대/3세대"로 격리.
    mustContain: [
      ["에어팟", "airpods"],
      ["4세대", "4 세대", "4th", "에어팟4", "에어팟 4", "airpods 4", "airpods4"],
      ["anc", "노이즈 캔슬", "노캔", "노이즈캔슬"],
    ],
    mustNotContain: ["프로", "pro", "max", "1세대", "2세대", "3세대", ...HEADPHONE_NOISE],
    msrpKrw: 249000,
    released: 2024,
    confusionNote: "ANC (노이즈 캔슬링) 탑재 4세대. 일반 AirPods 4 (ANC 없음, ~₩199K)와 별도 — 가격 ~₩50K↑.",
  },
  {
    id: "airpods-pro-3",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Pro 3rd gen",
    aliases: ["에어팟 프로 3세대", "AirPods Pro 3", "에어팟프로3"],
    mustContain: [
      ["에어팟", "airpods"],
      ["프로", "pro"],
      ["3세대", "3 세대", "3rd", "프로 3", "프로3"],
    ],
    mustNotContain: [
      "1세대",
      "1st",
      "2세대",
      "2nd",
      "맥스",
      "max",
      "라이트닝",
      "lightning",
      ...HEADPHONE_NOISE,
      // Wave 667 (2026-05-22): AirPods 일반 3 (Pro 아님) 차단 — 76k 매물 false positive.
      "프로 아님", "pro 아님", "(프로 아님)", "(프로아님)", "프로아님",
      "에어팟 3세대 정품 (프로",
      // 박스/설명서/케이스만 (parts_only) — 8k outlier.
      "상자만", "박스만", "설명서만", "박스+설명서", "상자+설명서", "박스 설명서",
      "케이스만 판매", "케이스만 팔아",
      // 정보 매물 (clickbait) — 60k outlier.
      "초기화 방법", "사례해요", "사례하겠습니다", "정보 알려주시면", "방법 알려주시면",
      // 광고성 매물.
      "내용필독", "내용 필독", "필독 매물", "ㅍㅍ(", "급처(",
    ],
    msrpKrw: 369000,
    released: 2025,
    confusionNote: "Pro 3세대 (2025-09). USB-C only (Lightning 모델 없음). Pro 2 (2022/2023)와 별도.",
  },
  {
    id: "airpods-max",
    brand: "Apple",
    category: "earphone",
    modelName: "AirPods Max (Lightning)",
    aliases: ["에어팟 맥스", "AirPods Max", "에어팟맥스"],
    mustContain: [["에어팟", "airpods"], ["맥스", "max"]],
    // Wave 765 + Wave 885 (통합):
    //   Wave 765 (2026-05-27): 2세대 (USB-C, 2024) 매물 차단 강화 — "에어팟 맥스2 미드나이트 2026" 흡수 차단.
    //   Wave 885 (재검토 — 사용자 우려 반영): year-only 토큰 (2024/2025/2026) 제거.
    //     기본 "에어팟 맥스" alone = Lightning default (의도된 행동, 변경 X).
    //     year 단독은 구매 시점 vs 모델 연식 모호 (Apple 이 2024년 9월까지 Lightning 판매 → "2024년 구매 Lightning" 가능).
    mustNotContain: [
      "usb-c", "usbc", "c타입", "타입c", "씨타입", "c핀", "c 핀",
      // 2024+ USB-C 신컬러 (Lightning 1세대엔 절대 없는 색) — Wave 765 + Wave 885
      "스타라이트", "starlight", "미드나이트", "midnight", "퍼플", "purple", "오렌지", "orange",
      // 2세대 / Max 2 명시적 라벨 — Wave 765
      "맥스 2", "맥스2", "max 2", "max2", "2세대", "2 세대",
      // 2세대 model 번호 — Wave 765
      "a3184",
      // model year 명시 (year-only 는 의도적으로 제외 — 구매연도 vs 모델연식 모호) — Wave 885
      "2024년형", "2025년형", "2024 모델", "2025 모델", "2024 신모델", "2025 신모델",
    ],
    msrpKrw: 769000,
    released: 2020,
    confusionNote: "Lightning 1세대 (2020-12). 매물 \"맥스 1세대\" 또는 단순 \"맥스\" = 이 모델. USB-C/Max 2는 별도 SKU.",
  },
  {
    id: "airpods-max-usbc",
    brand: "Apple",
    category: "earphone",
    laneKey: "airpods_max_usbc",
    modelName: "AirPods Max (USB-C, 2024)",
    aliases: ["에어팟 맥스 USB-C", "AirPods Max USB-C", "에어팟맥스 USB-C", "에어팟 맥스 2", "에어팟맥스2"],
    confusionNote: "매물 \"맥스 2\" / \"2세대\" 부르는 게 이 모델 (Apple 공식은 \"USB-C\"). Lightning 1세대 (2020-12)와 시세 다름.",
    // Wave 766 (2026-05-27): 소비자 명칭 흡수 강화 — 1세대 broad에서 차단된 "맥스2"/2세대 컬러 매물이 USB-C narrow에 잡히도록.
    //   audit: ready pool 5건이 airpods-max로 stale 박힘 (Wave 765 mustNotContain 이전 분류) → 이 narrow가 USB-C 키워드 없어도 흡수해야 함.
    mustContain: [
      ["에어팟", "airpods"],
      ["맥스", "max"],
      // Wave 885 (재검토): explicit "USB-C" 또는 1세대엔 없는 신컬러 또는 명시적 세대 라벨.
      //   year-only 는 의도적으로 제외 (구매연도 vs 모델연식 모호).
      //   Wave 766: a3184 (2세대 model 번호) 추가.
      [
        "usb-c", "usbc", "c타입", "타입c", "씨타입", "c핀", "c 핀",
        "스타라이트", "starlight", "미드나이트", "midnight", "퍼플", "purple", "오렌지", "orange",
        "맥스 2", "맥스2", "max 2", "max2", "2세대", "2 세대",
        "2024년형", "2025년형", "2024 모델", "2025 모델", "2024 신모델", "2025 신모델",
        "a3184",
      ],
    ],
    // 1세대 Lightning 전용 컬러 (Apple 공식: Space Gray, Silver, Sky Blue, Pink, Green) +
    // 1세대 명시 라벨 -> Lightning 우선. Wave 885 재검토 — 사용자 우려 반영 (1세대 default 보존).
    mustNotContain: [
      "라이트닝", "lightning", "8핀", "8 핀", "팔핀",
      "스페이스그레이", "스페이스 그레이", "space gray", "space grey",
      "스카이블루", "스카이 블루", "sky blue",
      "1세대", "1 세대", "1st gen", "1st generation",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 769000,
    released: 2024,
  },
  {
    id: "sony-wh-1000xm5",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-1000XM5",
    aliases: ["소니 WH-1000XM5", "소니 XM5", "Sony WH-1000XM5"],
    mustContain: [["소니", "sony"], ["wh-1000xm5", "wh1000xm5", "xm5"]],
    mustNotContain: ["xm6", "xm4", "ult900n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 499000,
    released: 2022,
  },
  {
    id: "sony-wh-1000xm4",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-1000XM4",
    aliases: ["소니 WH-1000XM4", "소니 XM4", "Sony WH-1000XM4"],
    mustContain: [["소니", "sony"], ["wh-1000xm4", "wh1000xm4", "xm4"]],
    mustNotContain: ["xm6", "xm5", "xm3", "ult900n", "ch720n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 459000,
    released: 2020,
  },
  {
    id: "sony-wh-1000xm3",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-1000XM3",
    aliases: ["소니 WH-1000XM3", "소니 XM3", "Sony WH-1000XM3"],
    mustContain: [["소니", "sony"], ["wh-1000xm3", "wh1000xm3", "xm3"]],
    mustNotContain: ["xm6", "xm5", "xm4", "ult900n", "ch720n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 449000,
    released: 2018,
  },
  {
    id: "sony-wh-1000xm6",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-1000XM6",
    aliases: ["소니 WH-1000XM6", "소니 XM6", "Sony WH-1000XM6"],
    mustContain: [["소니", "sony"], ["wh-1000xm6", "wh1000xm6", "xm6"]],
    mustNotContain: ["xm5", "xm4", "ult900n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 599000,
    released: 2025,
    confusionNote: "XM6 신상 (2025). 디자인 약간 변경, 폴딩 메커니즘 복귀. XM5 (2022) ~₩100K 더 비쌈. WF-1000XM6 (이어버드)는 별도 모델.",
  },
  // Wave 182 Phase 2 chunk 6 (2026-05-17): Sony LinkBuds 시리즈 (WF-L900/LS900N/LS910N).
  {
    id: "sony-linkbuds",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony LinkBuds (WF-L900)",
    aliases: ["소니 LinkBuds", "소니 링크버즈", "Sony LinkBuds"],
    mustContain: [["소니", "sony"], ["linkbuds", "링크버즈", "link buds", "wf-l900", "wfl900"]],
    mustNotContain: [
      "linkbuds s", "linkbuds-s", "ls900", "wf-ls900",
      "linkbuds fit", "linkbuds-fit", "ls910", "wf-ls910",
      "linkbuds open", "lk900",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 219000,
    released: 2022,
  },
  {
    id: "sony-linkbuds-s",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony LinkBuds S (WF-LS900N)",
    aliases: ["소니 LinkBuds S", "소니 링크버즈S", "Sony LinkBuds S"],
    mustContain: [["소니", "sony"], ["linkbuds s", "linkbuds-s", "링크버즈 s", "링크버즈s", "wf-ls900n", "wfls900n", "ls900"]],
    mustNotContain: [
      "linkbuds fit", "linkbuds-fit", "ls910",
      "linkbuds open", "lk900",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 269000,
    released: 2022,
  },
  {
    id: "sony-linkbuds-fit",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony LinkBuds Fit (WF-LS910N)",
    aliases: ["소니 LinkBuds Fit", "Sony LinkBuds Fit"],
    mustContain: [["소니", "sony"], ["linkbuds fit", "linkbuds-fit", "ls910", "wf-ls910n", "링크버즈 핏", "링크버즈핏"]],
    mustNotContain: [
      "linkbuds s", "linkbuds-s", "ls900",
      "linkbuds open", "lk900",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 299000,
    released: 2024,
  },
  {
    id: "sony-wh-ult900n",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-ULT900N / ULT Wear",
    aliases: ["소니 WH-ULT900N", "소니 ULT WEAR", "Sony ULT Wear"],
    mustContain: [["소니", "sony"], ["wh-ult900n", "wh ult900n", "whult900n", "ult900n", "ult wear", "ultwear"]],
    mustNotContain: ["1000xm", "xm3", "xm4", "xm5", "xm6", "ch720n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 259000,
    released: 2024,
  },
  {
    id: "sony-wh-ch720n",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-CH720N",
    aliases: ["소니 WH-CH720N", "Sony WH-CH720N"],
    mustContain: [["소니", "sony"], ["wh-ch720n", "wh ch720n", "whch720n", "ch720n"]],
    mustNotContain: ["1000xm", "xm3", "xm4", "xm5", "xm6", "ult900n", "ch520", ...HEADPHONE_NOISE],
    msrpKrw: 199000,
    released: 2023,
  },
  {
    id: "sony-wh-ch520",
    brand: "Sony",
    category: "earphone",
    modelName: "Sony WH-CH520",
    aliases: ["소니 WH-CH520", "Sony WH-CH520"],
    mustContain: [["소니", "sony"], ["wh-ch520", "wh ch520", "whch520", "ch520"]],
    mustNotContain: [
      "wh-ch700n",
      "wh ch700n",
      "whch700n",
      "ch700n",
      "wh-ch710n",
      "wh ch710n",
      "whch710n",
      "ch710n",
      "wh-ch500",
      "wh ch500",
      "whch500",
      "ch500",
      "wh-1000xm",
      "xm3",
      "xm4",
      "xm5",
      "xm6",
      "ult900n",
      "ult wear",
      "ultwear",
      "linkbuds",
      "wf-",
      "wf 1000",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 79000,
    released: 2022,
  },
  // Wave 182 Phase 2 chunk 6 (2026-05-17): Bose 700 헤드폰 (2019.5) + QC Earbuds II (2022.9).
  {
    id: "bose-700-headphones",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose Noise Cancelling Headphones 700",
    aliases: ["보스 700", "Bose 700", "Bose Headphones 700", "Bose NC 700"],
    mustContain: [["보스", "bose"], ["700", "nc 700", "noise cancelling 700"], ["헤드폰", "headphone", "헤드셋"]],
    mustNotContain: [
      "qc 울트라", "qc ultra", "quietcomfort ultra", "quietcomfort",
      "qc35", "qc 35", "qc45", "qc 45", "qc15", "qc 15", "qc20", "qc 20",
      "soundlink", "사운드링크",
      "이어버드", "earbuds",
      "soundbar", "사운드바",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 499000,
    released: 2019,
  },
  {
    id: "bose-qc-earbuds-ii",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose QuietComfort Earbuds II",
    aliases: ["보스 QC 이어버드 II", "Bose QC Earbuds II", "Bose QuietComfort Earbuds II"],
    mustContain: [
      ["보스", "bose"],
      ["quietcomfort earbuds ii", "qc 이어버드 2", "qc 이어버드 ii", "qc earbuds 2", "qc earbuds ii", "qc earbudsii"],
    ],
    mustNotContain: [
      "ultra", "울트라",
      "headphone", "헤드폰", "헤드셋",
      "qc35", "qc 35", "qc45", "qc 45",
      "soundlink", "사운드링크",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 379000,
    released: 2022,
  },
  {
    // Wave 118c (2026-05-15): Bose QC Ultra Earbuds (이어버드 — Headphones와 별도 모델, 2023-10 출시).
    id: "bose-ultra-open-earbuds",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose Ultra Open Earbuds",
    aliases: ["보스 울트라 오픈 이어버드", "Bose Ultra Open Earbuds", "보스 ULTRA Open"],
    // Wave 749g (2026-05-24): Ultra Open Earbuds 2024 신상 (오픈형 ear cuff). 200k 매물 leak.
    mustContain: [
      ["보스", "bose"],
      ["ultra open", "울트라 오픈", "ultra-open", "ultraopen", "울트라오픈"],
    ],
    mustNotContain: [
      "qc", "quietcomfort",
      "headphone", "헤드폰", "헤드셋",
      "soundlink", "사운드링크",
      "보스턴", "boston",  // 가방 false positive
      "엠보스드", "embossed",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 379000,
    released: 2024,
    confusionNote: "Ultra Open Earbuds (오픈형 ear cuff, 귀에 걸기). QC Ultra Earbuds (인이어, 노이즈캔슬링)와 별도 모델 — 가격 ~₩80K 차이.",
  },
  {
    id: "bose-qc-ultra-earbuds",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose QuietComfort Ultra Earbuds",
    aliases: ["보스 QC 울트라 이어버드", "Bose QC Ultra Earbuds", "Bose QuietComfort Ultra Earbuds"],
    mustContain: [
      ["보스", "bose"],
      ["quietcomfort ultra", "qc ultra", "qc 울트라", "quietcomfort 울트라", "qcultra"],
      ["이어버드", "earbuds"],
    ],
    mustNotContain: [
      "headphone", "헤드폰", "헤드셋",
      "qc35", "qc 35", "qc45", "qc 45", "qc15", "qc 15", "qc20", "qc 20",
      "soundlink", "사운드링크",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 459000,
    released: 2023,
    confusionNote: "QC Ultra **Earbuds** (이어버드 in-ear). QC Ultra **Headphones** (오버이어, msrp ₩599K)와 별도 모델. 시세 ~₩140K 차이.",
  },
  {
    id: "bose-qc-ultra-headphones",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose QuietComfort Ultra Headphones",
    aliases: ["보스 QC 울트라 헤드폰", "Bose QC Ultra Headphones", "Bose QuietComfort Ultra Headphones"],
    mustContain: [
      ["보스", "bose"],
      ["quietcomfort ultra", "qc ultra", "qc 울트라", "quietcomfort 울트라", "qcultra"],
      ["헤드폰", "headphone", "헤드셋"],
    ],
    mustNotContain: [
      "qc35",
      "qc 35",
      "qc45",
      "qc 45",
      "qc15",
      "qc 15",
      "qc20",
      "qc 20",
      "quietcomfort 35",
      "quietcomfort 45",
      "quietcomfort earbuds",
      "qc 이어버드",
      "qc earbuds",
      "이어버드",
      "earbuds",
      "earphone",
      "soundlink",
      "사운드링크",
      // 2026-05-16 (사용자 코멘트 id 108 pid 399464822): 한정판/스페셜 에디션은 일반 시세보다 비쌈.
      // 같은 SKU 비교군에 끼면 평균 끌어올림. 일반 QC Ultra 시세에서 제외.
      // 한정판 mining 부족 + 시세 별도라 internal 처리 (별도 SKU는 wave 보강 후).
      "다이아몬드 60주년",
      "60주년 다이아몬드",
      "다이아몬드 에디션",
      "60주년 에디션",
      "한정판",
      "limited edition",
      "anniversary",
      // 2세대 분리 — 사용자 코멘트 "2세대 우드샌드" — 가격대 다름.
      "qc 울트라 2세대",
      "qc ultra 2세대",
      "ultra 2nd gen",
      "ultra gen 2",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 599000,
    released: 2023,
  },
  // bose-qc45-headphones 제거 (Wave 182 중복 — bose-qc45 SKU와 동일 제품. id 짧은 것 유지).
  {
    id: "beats-studio-pro",
    brand: "Beats",
    category: "earphone",
    modelName: "Beats Studio Pro",
    aliases: ["비츠 스튜디오 프로", "Beats Studio Pro"],
    mustContain: [
      ["비츠", "beats"],
      ["스튜디오 프로", "studio pro", "스튜디오프로", "studiopro"],
    ],
    mustNotContain: [
      "studio 3",
      "studio3",
      "studio 2",
      "studio2",
      // Wave 91: "Studio Pro 3" 같은 모호한 매물 격리 (실존 모델 아님 — Studio 3 Wireless 또는 오기재).
      // 사용자 코멘트로 발견 (pid 334750861 "비츠 스튜디오 프로3").
      "프로3",
      "프로 3",
      "pro 3",
      "pro3",
      "솔로",
      "solo 4",
      "solo4",
      "solo 3",
      "fit",
      "flex",
      "powerbeats",
      "이어버드",
      "earbuds",
      "earphone",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 449000,
    released: 2023,
  },
  {
    id: "bose-qc45",
    brand: "Bose",
    category: "earphone",
    modelName: "Bose QuietComfort 45",
    aliases: ["보스 QC45", "Bose QC45"],
    mustContain: [["보스", "bose"], ["qc45", "qc 45", "quietcomfort 45"]],
    mustNotContain: ["울트라", "ultra", ...HEADPHONE_NOISE],
    msrpKrw: 389000,
    released: 2021,
  },
  {
    id: "beats-solo4",
    brand: "Beats",
    category: "earphone",
    modelName: "Beats Solo 4",
    aliases: ["비츠 솔로 4", "비츠 솔로4", "Beats Solo 4"],
    mustContain: [
      ["비츠", "beats"],
      ["솔로 4", "solo 4", "솔로4", "solo4"],
    ],
    mustNotContain: [
      // Wave 126 (2026-05-16): Jennie Edition 차단 (사용자 코멘트 #15/#45).
      // 일반 Solo 4 ~170K vs Jennie Special Edition ~600K. 시세 왜곡 큼.
      "제니", "jennie", "제니 에디션", "제니에디션", "jennie edition",
      "스페셜 에디션", "스페셜에디션", "special edition",
      "솔로 3",
      "solo 3",
      "솔로3",
      "solo3",
      "솔로 2",
      "solo 2",
      "솔로2",
      "solo2",
      "솔로 프로",
      "solo pro",
      "solopro",
      "스튜디오 프로",
      "studio pro",
      "스튜디오프로",
      "studiopro",
      "스튜디오 3",
      "studio 3",
      "studio3",
      "비츠 fit",
      "beats fit",
      "fit pro",
      "비츠 flex",
      "beats flex",
      "파워비츠",
      "powerbeats",
      "이어버드",
      "earbuds",
      "earphone",
      "닥터드레 ep",
      // Wave 106 #49: Jennie special edition 분리 (MJ 코멘트 #2 — 가격 270~600k vs 일반 175-200k mixed).
      "제니",
      "jennie",
      "스페셜 에디션",
      "special edition",
      "스페셜에디션",
      "specialedition",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 249000,
    released: 2024,
  },
  {
    // Wave 106 #49: Beats Solo 4 Jennie special edition (BLACKPINK).
    // 일반 Solo 4 (175-200k) 와 가격 그룹 다름 (270-600k). 같은 SKU 시세 mixed 차단.
    id: "beats-solo4-jennie",
    brand: "Beats",
    category: "earphone",
    modelName: "Beats Solo 4 (Jennie Edition)",
    aliases: ["비츠 솔로 4 제니", "Beats Solo 4 Jennie"],
    mustContain: [
      ["비츠", "beats"],
      ["솔로 4", "solo 4", "솔로4", "solo4"],
      ["제니", "jennie", "스페셜 에디션", "special edition", "스페셜에디션", "specialedition"],
    ],
    mustNotContain: [
      "솔로 3", "solo 3", "솔로3", "solo3",
      "솔로 2", "solo 2", "솔로2", "solo2",
      "솔로 프로", "solo pro", "solopro",
      "스튜디오 프로", "studio pro", "스튜디오프로", "studiopro",
      "스튜디오 3", "studio 3", "studio3",
      "비츠 fit", "beats fit", "fit pro",
      "비츠 flex", "beats flex",
      "파워비츠", "powerbeats",
      "이어버드", "earbuds", "earphone",
      "닥터드레 ep",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 349000,
    released: 2025,
  },
  // Wave 182 Phase 2 chunk 6 (2026-05-17): Galaxy Buds 2 + 2 Pro + Live — 옛 인기 누락.
  {
    id: "galaxy-buds-2",
    brand: "Samsung",
    category: "earphone",
    modelName: "Galaxy Buds 2",
    aliases: ["갤럭시 버즈 2", "갤버즈2", "Galaxy Buds 2"],
    mustContain: [["갤럭시 버즈", "갤버즈", "galaxy buds"], [" 2 ", "버즈2", "버즈 2", "buds2", "buds 2"]],
    mustNotContain: ["프로", "pro", " 3 ", "버즈3", "buds3", " 4 ", "버즈4", "buds4", "라이브", "live", "1세대"],
    msrpKrw: 179000,
    released: 2021,
  },
  {
    id: "galaxy-buds-2-pro",
    brand: "Samsung",
    category: "earphone",
    modelName: "Galaxy Buds 2 Pro",
    aliases: ["갤럭시 버즈 2 프로", "갤버즈2프로", "Galaxy Buds 2 Pro"],
    mustContain: [["갤럭시 버즈", "갤버즈", "galaxy buds"], [" 2 ", "버즈2", "버즈 2", "buds2", "buds 2"], ["프로", "pro"]],
    mustNotContain: [" 3 ", "버즈3", "buds3", " 4 ", "버즈4", "buds4", "라이브", "live"],
    msrpKrw: 269000,
    released: 2022,
  },
  {
    id: "galaxy-buds-live",
    brand: "Samsung",
    category: "earphone",
    modelName: "Galaxy Buds Live",
    aliases: ["갤럭시 버즈 라이브", "갤버즈 라이브", "Galaxy Buds Live"],
    mustContain: [["갤럭시 버즈", "갤버즈", "galaxy buds"], ["라이브", "live"]],
    mustNotContain: [" 2 ", "버즈2", "buds2", " 3 ", "버즈3", "buds3", " 4 ", "버즈4", "buds4", "프로", "pro", "ultra"],
    msrpKrw: 219000,
    released: 2020,
  },
  // Wave 118: Galaxy Buds 3 일반 broad 추가 (매물 14일 26건).
  {
    id: "galaxy-buds-3",
    brand: "Samsung",
    category: "earphone",
    modelName: "Galaxy Buds 3",
    aliases: ["갤럭시 버즈 3", "갤버즈3", "Galaxy Buds 3"],
    mustContain: [
      ["갤럭시 버즈", "갤버즈", "galaxy buds"],
      [" 3 ", "버즈3", "버즈 3", "buds3", "buds 3"],
    ],
    mustNotContain: ["프로", "pro", " 4 ", "버즈4", "buds4", " 2 ", "버즈2", "buds2", "라이브", "live", "1세대", "2세대"],
    msrpKrw: 219000,
    released: 2024,
    confusionNote: "Buds 3 일반 (오픈형, msrp ₩219K). Buds 3 Pro (인이어 + ANC, msrp ₩319K)와 별도 — ~₩100K 차이.",
  },
  {
    id: "galaxy-buds-3-pro",
    brand: "Samsung",
    category: "earphone",
    laneKey: "galaxy_buds_3_pro",
    modelName: "Galaxy Buds 3 Pro",
    aliases: ["갤럭시 버즈 3 프로", "갤버즈3프로", "Galaxy Buds 3 Pro", "갤럭시버즈3프로", "버즈프로3", "버즈 프로3"],
    // Wave 749 leak fix: 한국 셀러 "버즈프로3 / 버즈 프로3" prefix 표기 흔함.
    mustContain: [
      ["갤럭시 버즈", "갤버즈", "galaxy buds", "버즈"],
      ["3 프로", "3프로", "3 pro", "프로3", "프로 3"],
    ],
    mustNotContain: [
      "1세대",
      "2세대",
      "버즈 2",
      "버즈2",
      "buds 2",
      "buds2",
      "버즈 1",
      "버즈1",
      "buds 1",
      "buds1",
      "fe",
      "라이브",
      "live",
      "버즈 +",
      "버즈+",
      "buds +",
      "buds+",
      "buds plus",
      "4 프로", "4프로", "4 pro",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 309000,
    released: 2024,
  },
  // Wave 111h (2026-05-15): Galaxy Buds 4 Pro (Samsung 2025 신상).
  {
    id: "galaxy-buds-4-pro",
    brand: "Samsung",
    category: "earphone",
    laneKey: "galaxy_buds_4_pro",
    modelName: "Galaxy Buds 4 Pro",
    aliases: ["갤럭시 버즈 4 프로", "갤버즈4프로", "Galaxy Buds 4 Pro", "갤럭시버즈4프로", "버즈 프로 4", "버즈프로4"],
    // Wave 749e: 한국 셀러 "프로 4" / "프로4" 순서 변형 catch (사용자 발견 320k 미개봉 매물).
    mustContain: [
      ["갤럭시 버즈", "갤버즈", "galaxy buds", "버즈"],
      ["4 프로", "4프로", "4 pro", "프로 4", "프로4", "pro 4"],
    ],
    mustNotContain: [
      "1세대", "2세대", "3세대",
      "버즈 3", "버즈3", "buds 3", "buds3",
      "버즈 2", "버즈2", "buds 2", "buds2",
      "버즈 1", "버즈1", "buds 1", "buds1",
      "fe",
      "라이브", "live",
      "버즈 +", "버즈+", "buds +", "buds+", "buds plus",
      ...HEADPHONE_NOISE,
    ],
    msrpKrw: 350000,
    released: 2025,
  },
  {
    id: "sennheiser-accentum",
    brand: "Sennheiser",
    category: "earphone",
    modelName: "Sennheiser Accentum Wireless",
    aliases: ["젠하이저 ACCENTUM", "Sennheiser Accentum"],
    mustContain: [["젠하이저", "sennheiser"], ["accentum", "엑센텀"]],
    mustNotContain: ["hd569", "momentum", ...HEADPHONE_NOISE],
    msrpKrw: 259000,
    released: 2023,
  },
  {
    id: "sennheiser-hd569",
    brand: "Sennheiser",
    category: "earphone",
    modelName: "Sennheiser HD569",
    aliases: ["젠하이저 HD569", "Sennheiser HD569"],
    mustContain: [["젠하이저", "sennheiser"], ["hd569", "hd 569"]],
    mustNotContain: ["accentum", "momentum", ...HEADPHONE_NOISE],
    msrpKrw: 259000,
    released: 2016,
  },

  // ─── Apple Watch ─────────────────────────────────────
  {
    id: "applewatch-se1",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 1st gen",
    aliases: ["애플워치 SE 1세대", "Apple Watch SE 1st gen"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se"], ["1세대", "1 세대", "1st"]],
    mustNotContain: ["se2", "se 2", "se3", "se 3", "ultra", "series", "시리즈"],
    msrpKrw: 359000,
    released: 2020,
  },
  {
    id: "applewatch-se2",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 2nd gen",
    aliases: ["애플워치 SE 2세대", "애플워치 SE2", "Apple Watch SE 2"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se2", "se 2", "se 2세대", "se 2nd"]],
    mustNotContain: ["se3", "se 3", "ultra"],
    msrpKrw: 359000,
    released: 2022,
    confusionNote: "SE 2세대 (2022). 외형 SE3와 거의 동일하지만 SE2는 4G LTE까지 (5G 없음). Nike 에디션 동일 HW, 시세 동일.",
  },
  {
    id: "applewatch-se3",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch SE 3rd gen",
    aliases: ["애플워치 SE3", "애플워치 SE 3세대", "Apple Watch SE 3"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["se3", "se 3", "se 3세대", "se 3rd"]],
    mustNotContain: ["se2", "se 2", "ultra"],
    msrpKrw: 359000,
    confusionNote: "SE 3세대 (2025). 외형 SE2와 거의 동일하지만 5G 추가. 매물 외형으로 SE2/SE3 구분 어려움 — \"세대\" 명시 확인 필수.",
    released: 2025,
  },
  {
    id: "applewatch-series7",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 7",
    aliases: ["애플워치 7", "애플워치 시리즈 7", "Apple Watch Series 7"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 7", "시리즈7", "series 7", "series7", "s7", "워치7", "워치 7", "애플워치7"],
    ],
    // Wave 777 (2026-05-27): Hermès / 스테인리스 narrow SKU 추가 → 차단.
    mustNotContain: ["se", "ultra", "시리즈 8", "시리즈8", "시리즈 9", "시리즈9", "시리즈 10", "시리즈10", "시리즈 11", "시리즈11", "series 8", "series 9", "series 10", "series 11",
      "에르메스", "hermes", "스테인리스", "스테인레스", "stainless"],
    msrpKrw: 539000,
    released: 2021,
  },
  {
    id: "applewatch-series8",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 8",
    aliases: ["애플워치 8", "애플워치 시리즈 8", "Apple Watch Series 8"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 8", "시리즈8", "series 8", "series8", "s8", "워치8", "워치 8", "애플워치8"],
    ],
    // Wave 142 (2026-05-17): Hermes Edition 별도 SKU 격리 (applewatch-series8-hermes).
    // Wave 777 (2026-05-27): 스테인리스 narrow SKU 추가 → 차단.
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈7", "시리즈 9", "시리즈9", "시리즈 10", "시리즈10", "시리즈 11", "시리즈11", "series 7", "series 9", "series 10", "series 11", "에르메스", "hermes",
      "스테인리스", "스테인레스", "stainless"],
    msrpKrw: 599000,
    released: 2022,
  },
  {
    id: "applewatch-series9",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 9",
    aliases: ["애플워치 9", "애플워치 시리즈 9", "Apple Watch Series 9"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 9", "시리즈9", "series 9", "series9", "s9", "워치9", "워치 9", "애플워치9"],
    ],
    // Wave 777 (2026-05-27): Hermès / 스테인리스 narrow SKU 추가 → 차단.
    //   S9 는 이전엔 Hermès block 자체가 없었음 (S8/S10 만 있었음) — leak 13건 fix.
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈7", "시리즈 8", "시리즈8", "시리즈 10", "시리즈10", "시리즈 11", "시리즈11", "series 7", "series 8", "series 10", "series 11",
      "에르메스", "hermes", "스테인리스", "스테인레스", "stainless"],
    msrpKrw: 599000,
    released: 2023,
  },
  {
    id: "applewatch-series10",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 10",
    aliases: ["애플워치 10", "애플워치 시리즈 10", "Apple Watch Series 10"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 10", "시리즈10", "series 10", "series10", "s10", "워치10", "워치 10", "애플워치10"],
    ],
    // Wave 142 (2026-05-17): Hermes Edition 별도 SKU 격리 (applewatch-series10-hermes).
    // Wave 777 (2026-05-27): 티타늄 narrow SKU 추가 → 차단. 시세 dilution ₩230K (177건 영향).
    mustNotContain: ["se", "ultra", "시리즈 7", "시리즈7", "시리즈 8", "시리즈8", "시리즈 9", "시리즈9", "시리즈 11", "시리즈11", "series 7", "series 8", "series 9", "series 11", "에르메스", "hermes",
      "티타늄", "titanium"],
    msrpKrw: 599000,
    released: 2024,
  },
  {
    id: "applewatch-ultra",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Ultra",
    aliases: ["애플워치 울트라", "Apple Watch Ultra"],
    mustContain: [["애플워치", "apple watch", "applewatch"], ["울트라", "ultra"]],
    // Wave 90 (2026-05-15): Ultra 3 차단 추가. 사용자 코멘트로 발견 — Ultra 3 매물이
    // Ultra 1로 잘못 매핑되어 시세 비교에 섞임. Ultra 3 출시 시 별도 SKU 분리 필요.
    // Wave 753 (2026-05-24) Pareto: 1800x audit — 밴드/루프 단품 + Urvoi 호환 brand 차단.
    mustNotContain: [
      "울트라 2", "ultra 2", "울트라2", "ultra2",
      "울트라 3", "ultra 3", "울트라3", "ultra3",
      // Wave 753 — 밴드/루프 단품 차단 (Apple Watch Ultra 500원 outlier)
      "밀레니즈 루프", "밀레니즈루프", "milanese loop",
      "스포츠 루프", "스포츠루프", "sport loop",
      "오션 밴드", "오션밴드", "ocean band", "ocean band단품",
      "트레일 루프", "트레일루프", "trail loop",
      "알파인 루프", "알파인루프", "alpine loop",
      "마그네틱 밴드", "마그네틱밴드", "magnetic band",
      "밴드만", "밴드 단품", "스트랩만", "스트랩 단품",
      "urvoi", "유르보이", "유로보이", // 호환 밴드 brand
      // case/스킨 단품
      "보호 케이스", "보호케이스", "스킨만", "강화유리",
    ],
    msrpKrw: 1149000,
    released: 2022,
    confusionNote: "Ultra 1세대 (2022). 49mm 티타늄. Ultra 2 (2023, S9 chip)/Ultra 3 (2025, S11 chip)와 별도. 시세 ~₩200K씩 차이.",
  },
  // Wave 117d (2026-05-15): Apple Watch Series 11 (2025-09 신상) + Ultra 3 (2025-09 신상)
  // + Series 3/4/5/6 옛 모델 catalog 추가. 14일 매물: Series 11 (136), Ultra 3 (125), Series 4 (115), Series 6 (54), Series 3 (49), Series 5 (21).
  {
    id: "applewatch-series11",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 11",
    aliases: ["애플워치 11", "애플워치 시리즈 11", "Apple Watch Series 11"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 11", "시리즈11", "series 11", "series11", "s11", "워치11", "워치 11", "애플워치11", "애플워치 11"],
    ],
    // Wave 777 (2026-05-27): 티타늄 narrow SKU 추가 → 차단.
    mustNotContain: ["se", "ultra", "울트라", "시리즈 7", "시리즈7", "시리즈 8", "시리즈8", "시리즈 9", "시리즈9", "시리즈 10", "시리즈10", "series 7", "series 8", "series 9", "series 10", "에르메스", "hermes",
      "티타늄", "titanium"],
    msrpKrw: 649000,
    released: 2025,
  },
  {
    id: "applewatch-ultra3",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Ultra 3",
    aliases: ["애플워치 울트라 3", "Apple Watch Ultra 3"],
    mustContain: [
      ["애플워치", "applewatch", "apple watch", "에플워치", "워치"],
      ["울트라 3", "ultra 3", "울트라3", "ultra3"],
    ],
    mustNotContain: ["울트라 2", "ultra 2", "울트라2", "ultra2", "울트라 1", "ultra 1",
      // Wave 646: 에르메스 에디션은 별도 시세군 (1.5-2.1M, 일반 700-900k 대비 2-3배 outlier).
      "에르메스", "hermes", "사티네", "satine",
      // Wave 753 (2026-05-24) Pareto: 20000x audit — 밴드 단품 + 교환 dummy 차단.
      "밀레니즈 루프", "밀레니즈루프", "milanese loop",
      "스포츠 루프", "스포츠루프", "sport loop", "오션 밴드", "오션밴드",
      "트레일 루프", "트레일루프", "알파인 루프", "알파인루프",
      "밴드만", "밴드 단품", "스트랩만", "스트랩 단품", "루프만",
      "urvoi", "유르보이",
      "보호 케이스", "보호케이스", "강화유리",
    ],
    msrpKrw: 1199000,
    released: 2025,
    confusionNote: "Ultra 3 신상 (2025-09). S11 chip, 위성 통신 추가. Ultra 1/2와 외형 거의 동일 (49mm 티타늄). 시세 ~₩200K 차이.",
  },
  {
    id: "applewatch-series3",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 3",
    aliases: ["애플워치 3", "애플워치 시리즈 3", "Apple Watch Series 3"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 3", "series 3", "s3", "워치 3", "워치3", "애플워치 3", "애플워치3"],
    ],
    mustNotContain: ["se", "ultra", "울트라", "시리즈 4", "시리즈 5", "시리즈 6", "시리즈 7", "시리즈 8", "시리즈 9", "시리즈 10", "시리즈 11", "series 4", "series 5", "series 6", "series 7", "series 8", "series 9", "series 10", "series 11"],
    msrpKrw: 459000,
    released: 2017,
  },
  {
    id: "applewatch-series4",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 4",
    aliases: ["애플워치 4", "애플워치 시리즈 4", "Apple Watch Series 4"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 4", "series 4", "s4", "워치 4", "워치4", "애플워치 4", "애플워치4"],
    ],
    mustNotContain: ["se", "ultra", "울트라", "시리즈 3", "시리즈 5", "시리즈 6", "시리즈 7", "시리즈 8", "시리즈 9", "시리즈 10", "시리즈 11", "series 3", "series 5", "series 6", "series 7", "series 8", "series 9", "series 10", "series 11"],
    msrpKrw: 539000,
    released: 2018,
  },
  {
    id: "applewatch-series5",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 5",
    aliases: ["애플워치 5", "애플워치 시리즈 5", "Apple Watch Series 5"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 5", "시리즈5", "series 5", "series5", "s5", "워치 5", "워치5", "애플워치 5", "애플워치5"],
    ],
    mustNotContain: ["se", "ultra", "울트라", "시리즈 3", "시리즈3", "시리즈 4", "시리즈4", "시리즈 6", "시리즈6", "시리즈 7", "시리즈7", "시리즈 8", "시리즈8", "시리즈 9", "시리즈9", "시리즈 10", "시리즈10", "시리즈 11", "시리즈11", "series 3", "series 4", "series 6", "series 7", "series 8", "series 9", "series 10", "series 11"],
    msrpKrw: 539000,
    released: 2019,
  },
  {
    id: "applewatch-series6",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Series 6",
    aliases: ["애플워치 6", "애플워치 시리즈 6", "Apple Watch Series 6"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch"],
      ["시리즈 6", "시리즈6", "series 6", "series6", "s6", "워치 6", "워치6", "애플워치 6", "애플워치6"],
    ],
    mustNotContain: ["se", "ultra", "울트라", "시리즈 3", "시리즈3", "시리즈 4", "시리즈4", "시리즈 5", "시리즈5", "시리즈 7", "시리즈7", "시리즈 8", "시리즈8", "시리즈 9", "시리즈9", "시리즈 10", "시리즈10", "시리즈 11", "시리즈11", "series 3", "series 4", "series 5", "series 7", "series 8", "series 9", "series 10", "series 11"],
    msrpKrw: 539000,
    released: 2020,
  },
  {
    id: "applewatch-ultra2",
    brand: "Apple",
    category: "smartwatch",
    modelName: "Apple Watch Ultra 2",
    aliases: ["애플워치 울트라 2", "Apple Watch Ultra 2"],
    mustContain: [
      ["애플워치", "applewatch", "apple watch", "에플워치", "워치"],
      ["울트라 2", "ultra 2", "울트라2", "ultra2"],
    ],
    mustNotContain: [
      "울트라 1",
      "ultra 1",
      "울트라1",
      "ultra1",
      // Wave 90: Ultra 3 차단 추가
      "울트라 3", "ultra 3", "울트라3", "ultra3",
      "se",
      "series 9",
      "series 10",
      // Wave 647: 에르메스 에디션 차단 (별도 시세군).
      "에르메스", "hermes", "사티네", "satine",
      "케이스만",
      "밴드만",
      "스트랩만",
      "충전기만",
      "부품",
      "고장",
      "매입",
      "삽니다",
      // Wave 666 (2026-05-22): 추가 outlier 차단 (12345원 cross-category 교환 매물).
      // pid 402226912 "티쏘 씨스타2000, 애플워치 울트라2 교환" — Tissot 시계 교환 매물이 잘못 매칭.
      "티쏘", "tissot", "씨스타", "seastar", "씨마스터", "seamaster",
      // 커스텀 키트 (액세서리)
      "커스텀 키트", "커스텀키트", "커스텀 럭셔리", "애차드밀", "ap kit",
      "스틸 럭셔리", "스틸 키트", "럭셔리 키트", "럭셔리 커스텀",
    ],
    msrpKrw: 1149000,
    released: 2023,
    confusionNote: "Ultra 2 (2023). S9 chip, 더블탭 제스처 추가. Ultra 1과 외형 동일 (모두 49mm 티타늄). 시세 ~₩150K 더 비쌈.",
  },
  // Wave 142 (2026-05-17): Apple Watch Hermes Edition narrow lane.
  // 단독 표본: S10 = 42건 median 962k / S8 = 29건 median 528k.
  // 일반 Series 8/10 SKU와는 mustNotContain "에르메스/hermes" 로 격리.
  {
    id: "applewatch-series8-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s8_hermes",
    modelName: "Apple Watch Series 8 Hermès",
    aliases: ["애플워치 8 에르메스", "Apple Watch Series 8 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 8", "series 8", " 8 ", "s8", "워치8", "워치 8", "애플워치8"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "ultra",
      "시리즈 7", "시리즈 9", "시리즈 10", "series 7", "series 9", "series 10",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 1799000,
    released: 2022,
    confusionNote: "Apple Watch Series 8 Hermès Edition (45mm 실버 다수). 일반 S8 대비 시세 ~+₩200K. 가죽 밴드 별매 매물 (밴드만) 차단.",
  },
  {
    id: "applewatch-series10-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s10_hermes",
    modelName: "Apple Watch Series 10 Hermès",
    aliases: ["애플워치 10 에르메스", "Apple Watch Series 10 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 10", "series 10", " 10 ", "s10", "워치10", "워치 10", "애플워치10"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "ultra",
      "시리즈 7", "시리즈 8", "시리즈 9", "series 7", "series 8", "series 9",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 1899000,
    released: 2024,
    confusionNote: "Apple Watch Series 10 Hermès Edition (2024). 일반 S10 대비 시세 ~+₩300~400K. 가죽 밴드 별매 매물 차단.",
  },
  // Wave 777 (2026-05-27): Apple Watch 케이스 재질 + 에디션 narrow split.
  //   audit 결과 S10 titanium 177건이 일반 S10 SKU 와 묶여 시세 dilution ₩230K.
  //   S8 stainless 85건도 동일 패턴. S7~S11 Hermès leak + S7 stainless 까지 일관 정리.
  //   매물 수: S10-Ti 177 / S8-SS 85 / S9-SS 44 / S7-SS 33 / S11-Ti 15 / S9-He 13 / S7-He 8 / Ultra3-He 6 / S11-He 3.
  //   기존 S8/S10 Hermès 와 동일 패턴 (mustContain 3축 + mustNotContain sibling/부품/se/ultra).
  {
    id: "applewatch-series7-stainless",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s7_stainless",
    modelName: "Apple Watch Series 7 Stainless Steel",
    aliases: ["애플워치 7 스테인리스", "Apple Watch Series 7 Stainless"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 7", "series 7", " 7 ", "s7", "워치7", "워치 7", "애플워치7"],
      ["스테인리스", "스테인레스", "stainless"],
    ],
    mustNotContain: [
      "se", "ultra", "에르메스", "hermes", "티타늄", "titanium",
      "시리즈 8", "시리즈 9", "시리즈 10", "시리즈 11", "series 8", "series 9", "series 10", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 749000,
    released: 2021,
    confusionNote: "Series 7 스테인리스 스틸 (단종). 알루미늄 대비 시세 +₩50K.",
  },
  {
    id: "applewatch-series7-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s7_hermes",
    modelName: "Apple Watch Series 7 Hermès",
    aliases: ["애플워치 7 에르메스", "Apple Watch Series 7 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 7", "series 7", " 7 ", "s7", "워치7", "워치 7", "애플워치7"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "ultra",
      "시리즈 8", "시리즈 9", "시리즈 10", "시리즈 11", "series 8", "series 9", "series 10", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 1549000,
    released: 2021,
    confusionNote: "Apple Watch Series 7 Hermès Edition. 일반 S7 대비 시세 ~+₩250K.",
  },
  {
    id: "applewatch-series8-stainless",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s8_stainless",
    modelName: "Apple Watch Series 8 Stainless Steel",
    aliases: ["애플워치 8 스테인리스", "Apple Watch Series 8 Stainless"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 8", "series 8", " 8 ", "s8", "워치8", "워치 8", "애플워치8"],
      ["스테인리스", "스테인레스", "stainless"],
    ],
    mustNotContain: [
      "se", "ultra", "에르메스", "hermes", "티타늄", "titanium",
      "시리즈 7", "시리즈 9", "시리즈 10", "시리즈 11", "series 7", "series 9", "series 10", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 849000,
    released: 2022,
    confusionNote: "Series 8 스테인리스 스틸 (41/45mm Cell only). 알루미늄 대비 시세 +₩88K (DB 실측).",
  },
  {
    id: "applewatch-series9-stainless",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s9_stainless",
    modelName: "Apple Watch Series 9 Stainless Steel",
    aliases: ["애플워치 9 스테인리스", "Apple Watch Series 9 Stainless"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 9", "series 9", " 9 ", "s9", "워치9", "워치 9", "애플워치9"],
      ["스테인리스", "스테인레스", "stainless"],
    ],
    mustNotContain: [
      "se", "ultra", "에르메스", "hermes", "티타늄", "titanium",
      "시리즈 7", "시리즈 8", "시리즈 10", "시리즈 11", "series 7", "series 8", "series 10", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 849000,
    released: 2023,
    confusionNote: "Series 9 스테인리스 스틸. 알루미늄 대비 시세 +₩130K (DB 실측).",
  },
  {
    id: "applewatch-series9-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s9_hermes",
    modelName: "Apple Watch Series 9 Hermès",
    aliases: ["애플워치 9 에르메스", "Apple Watch Series 9 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 9", "series 9", " 9 ", "s9", "워치9", "워치 9", "애플워치9"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "ultra",
      "시리즈 7", "시리즈 8", "시리즈 10", "시리즈 11", "series 7", "series 8", "series 10", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 1799000,
    released: 2023,
    confusionNote: "Apple Watch Series 9 Hermès Edition. 일반 S9 대비 시세 ~+₩710K (DB 실측 median ₩1.0M).",
  },
  {
    id: "applewatch-series10-titanium",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s10_titanium",
    modelName: "Apple Watch Series 10 Titanium",
    aliases: ["애플워치 10 티타늄", "Apple Watch Series 10 Titanium"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 10", "series 10", " 10 ", "s10", "워치10", "워치 10", "애플워치10"],
      ["티타늄", "titanium"],
    ],
    mustNotContain: [
      "se", "ultra", "에르메스", "hermes",
      "시리즈 7", "시리즈 8", "시리즈 9", "시리즈 11", "series 7", "series 8", "series 9", "series 11",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 999000,
    released: 2024,
    confusionNote: "Series 10 티타늄 (42/46mm Cell only). 알루미늄 대비 시세 +₩230K (DB 실측, 가장 큰 dilution 원인).",
  },
  {
    id: "applewatch-series11-titanium",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s11_titanium",
    modelName: "Apple Watch Series 11 Titanium",
    aliases: ["애플워치 11 티타늄", "Apple Watch Series 11 Titanium"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 11", "series 11", " 11 ", "s11", "워치11", "워치 11", "애플워치11"],
      ["티타늄", "titanium"],
    ],
    mustNotContain: [
      "se", "ultra", "에르메스", "hermes",
      "시리즈 7", "시리즈 8", "시리즈 9", "시리즈 10", "series 7", "series 8", "series 9", "series 10",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 999000,
    released: 2025,
    confusionNote: "Series 11 티타늄. 알루미늄 대비 시세 +₩350K (DB 실측 median ₩780K).",
  },
  {
    id: "applewatch-series11-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_s11_hermes",
    modelName: "Apple Watch Series 11 Hermès",
    aliases: ["애플워치 11 에르메스", "Apple Watch Series 11 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["시리즈 11", "series 11", " 11 ", "s11", "워치11", "워치 11", "애플워치11"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "ultra",
      "시리즈 7", "시리즈 8", "시리즈 9", "시리즈 10", "series 7", "series 8", "series 9", "series 10",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 1899000,
    released: 2025,
    confusionNote: "Apple Watch Series 11 Hermès Edition (2025). 일반 S11 대비 시세 ~+₩1M (DB 실측 median ₩1.48M).",
  },
  {
    id: "applewatch-ultra3-hermes",
    brand: "Apple",
    category: "smartwatch",
    laneKey: "applewatch_ultra3_hermes",
    modelName: "Apple Watch Ultra 3 Hermès",
    aliases: ["애플워치 울트라 3 에르메스", "Apple Watch Ultra 3 Hermes"],
    mustContain: [
      ["애플워치", "apple watch", "applewatch", "에플워치"],
      ["울트라 3", "울트라3", "ultra 3", "ultra3"],
      ["에르메스", "hermes"],
    ],
    mustNotContain: [
      "se", "시리즈",
      "ultra 2", "ultra2", "울트라 2", "울트라2",
      "ultra 1", "ultra1", "울트라 1", "울트라1",
      "밴드만", "스트랩만", "케이스만", "충전기만",
      "부품", "고장", "매입", "삽니다",
    ],
    msrpKrw: 2149000,
    released: 2025,
    confusionNote: "Apple Watch Ultra 3 Hermès Edition (2025). 일반 Ultra 3 대비 시세 +₩575K (DB 실측 median ₩1.5M). Apple 공식 정가 ₩2,149K 확인.",
  },

  // ─── Galaxy Watch ─────────────────────────────────────
  // Wave 118: Galaxy Watch 4/5 추가 (매물 14일 261+125 = 386건).
  // Wave 182 Phase 2 chunk 5 (2026-05-17): Watch 3 (2020.8) + Watch Active 2 (2019.9) — 옛 인기.
  {
    id: "galaxywatch-3",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 3",
    aliases: ["갤럭시 워치 3", "갤워치 3", "Galaxy Watch 3"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 3 ", "워치3", "워치 3"],
    ],
    mustNotContain: [" 4 ", "워치4", " 5 ", "워치5", " 6 ", "워치6", " 7 ", "워치7", "ultra", "울트라", "active", "액티브",
      // Wave 670 (2026-05-22): 41mm spread 71x audit — 톰브라운 collab + 부품 차단.
      "톰브라운", "thom browne", "thom-browne", "tb collab",
      "에디션", "edition", "한정 에디션", "limited edition",
      "베젤만", "베젤 부품", "베젤링",
      "스트랩만", "정품 스트랩 ", "스트랩 단품", "줄만",
      "케이스만", "보호 케이스만", "충전기만",
      "부품", "고장", "수리용", "매입", "삽니다",
    ],
    msrpKrw: 459000,
    released: 2020,
  },
  {
    id: "galaxywatch-active-2",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch Active 2",
    aliases: ["갤럭시 워치 액티브 2", "갤워치 액티브 2", "Galaxy Watch Active 2"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      ["액티브 2", "active 2", "active2", "액티브2"],
    ],
    mustNotContain: [" 3 ", "워치3", " 4 ", "워치4", " 5 ", "워치5", " 6 ", "워치6", " 7 ", "워치7", "ultra", "울트라", "액티브 1", "active 1"],
    msrpKrw: 329000,
    released: 2019,
  },
  {
    id: "galaxywatch-4",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 4",
    aliases: ["갤럭시 워치 4", "갤워치 4", "Galaxy Watch 4"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 4 ", "워치4", "워치 4"],
    ],
    mustNotContain: [" 5 ", "워치5", " 6 ", "워치6", " 7 ", "워치7", "ultra", "울트라", "classic",
      // Wave 664 (2026-05-22): 42mm spread 236x audit — 톰브라운 collab + 부품 차단.
      "톰브라운", "thom browne", "thom-browne", "tb collab",
      "디올", "dior", "마틴 마르지엘라",
      "에디션", "edition", "한정 에디션", "limited edition",
      // 부품 단품 (5k 베젤 outlier)
      "베젤 부품", "베젤만", "베젤 단품", "베젤만 판매",
      "케이스만", "케이스 단품", "스트랩만", "줄만", "줄만 판매",
      "프레임만", "보호 케이스만", "tpu 케이스만",
    ],
    msrpKrw: 299000,
    released: 2021,
  },
  {
    id: "galaxywatch-5",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 5",
    aliases: ["갤럭시 워치 5", "갤워치 5", "Galaxy Watch 5"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 5 ", "워치5", "워치 5"],
    ],
    mustNotContain: [" 4 ", "워치4", " 6 ", "워치6", " 7 ", "워치7", "ultra", "울트라",
      // Wave 670: collab/부품 (Watch 3/4/6/7 패턴 spread).
      "톰브라운", "thom browne", "에디션",
      "베젤만", "베젤 부품", "베젤링",
      "스트랩만", "정품 스트랩 ", "줄만",
      "케이스만", "충전기만",
      "부품", "고장", "수리용", "매입", "삽니다",
    ],
    msrpKrw: 319000,
    released: 2022,
  },
  {
    id: "galaxywatch-6",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 6",
    aliases: ["갤럭시 워치 6", "갤워치 6", "Galaxy Watch 6"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 6 ", "워치6", "워치 6"],
    ],
    mustNotContain: [" 7 ", "워치7", "ultra",
      // Wave 668 (2026-05-22): 부품/스트랩 차단 (Watch 7 패턴 spread).
      "베젤만", "베젤 부품", "베젤링",
      "스트랩만", "정품 스트랩 ", "스트랩 단품", "줄만",
      "케이스만", "보호 케이스만", "tpu 케이스만",
      "충전기만", "어댑터만",
      "고장", "부품", "수리용",
      "삽니다", "구합니다", "매입",
      // 호환 스트랩 (Watch 4/5/6 동시 표기)
      "갤럭시워치4 5 6", "워치4 5 6", "4 5 6 호환", "20mm 스트랩", "22mm 스트랩",
      // Wave 778 (2026-05-27): 콜라보 에디션 차단 (owner 우려 — 톰브라운 등 시세 거품).
      "톰브라운", "thom browne", "thombrowne", "tb edition",
      "우영미", "wooyoungmi",
      "메종키츠네", "maison kitsune", "kitsune",
    ],
    msrpKrw: 369000,
    released: 2023,
  },
  {
    id: "galaxywatch-7",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch 7",
    aliases: ["갤럭시 워치 7", "갤워치 7", "Galaxy Watch 7"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      [" 7 ", "워치7", "워치 7"],
    ],
    mustNotContain: [" 6 ", "워치6", "ultra",
      // Wave 668 (2026-05-22): 40mm spread 108x audit — 부품/스트랩만 차단.
      "베젤만", "베젤 부품", "베젤링", "베젤 링",
      "스트랩만", "스트랩 단품", "줄만", "정품 스트랩만",
      "정품 스트랩 네이비", "정품 스트랩 블랙", "정품 스트랩 화이트",
      "스트랩 네이비 40mm", "스트랩 블랙 40mm",
      "케이스만", "보호 케이스만", "tpu 케이스만",
      "충전기만", "어댑터만",
      "고장", "부품", "수리용",
      "삽니다", "구합니다", "매입",
      // Wave 778 (2026-05-27): 콜라보 에디션 차단 (시세 거품).
      "톰브라운", "thom browne", "thombrowne", "tb edition",
      "우영미", "wooyoungmi",
      "메종키츠네", "maison kitsune", "kitsune",
    ],
    msrpKrw: 339000,
    released: 2024,
  },
  {
    id: "galaxywatch-ultra",
    brand: "Samsung",
    category: "smartwatch",
    modelName: "Galaxy Watch Ultra",
    aliases: ["갤럭시 워치 울트라", "Galaxy Watch Ultra"],
    mustContain: [
      ["갤럭시 워치", "갤워치", "galaxy watch", "갤럭시워치"],
      ["울트라", "ultra"],
    ],
    mustNotContain: [],
    msrpKrw: 829000,
    released: 2024,
  },
  // ─── Wave 187 (2026-05-18): 가민 워치 (smartwatch 확장) — 운동 시계 인기 ──
  // Fenix / Forerunner / Instinct / Venu / Epix 시리즈. 단일 옵션 (size 모델별 narrow lane).
  {
    id: "garmin-fenix-7",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_fenix_7",
    modelName: "Garmin Fenix 7 (47mm)",
    aliases: ["Garmin Fenix 7", "가민 페닉스 7", "가민 피닉스 7"],
    mustContain: [["garmin", "가민"], ["fenix 7", "페닉스 7", "피닉스 7", "fenix7"]],
    mustNotContain: ["fenix 7s", "fenix 7x", "페닉스 7s", "페닉스 7x", "fenix 8", "fenix 6", "fenix 5", "epix", "forerunner", "instinct", "venu", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1099000, released: 2022,
  },
  {
    id: "garmin-fenix-7s",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_fenix_7s",
    modelName: "Garmin Fenix 7S (42mm)",
    aliases: ["Garmin Fenix 7S", "가민 페닉스 7S"],
    mustContain: [["garmin", "가민"], ["fenix 7s", "페닉스 7s", "피닉스 7s", "fenix7s"]],
    mustNotContain: ["fenix 7x", "페닉스 7x", "fenix 8", "fenix 6", "fenix 5", "epix", "forerunner", "instinct", "venu", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1099000, released: 2022,
  },
  {
    id: "garmin-fenix-7x",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_fenix_7x",
    modelName: "Garmin Fenix 7X (51mm)",
    aliases: ["Garmin Fenix 7X", "가민 페닉스 7X"],
    mustContain: [["garmin", "가민"], ["fenix 7x", "페닉스 7x", "피닉스 7x", "fenix7x"]],
    mustNotContain: ["fenix 7s", "페닉스 7s", "fenix 8", "fenix 6", "fenix 5", "epix", "forerunner", "instinct", "venu", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1299000, released: 2022,
  },
  {
    id: "garmin-fenix-8",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_fenix_8",
    modelName: "Garmin Fenix 8 (47mm AMOLED)",
    aliases: ["Garmin Fenix 8", "가민 페닉스 8"],
    mustContain: [["garmin", "가민"], ["fenix 8", "페닉스 8", "피닉스 8", "fenix8"]],
    mustNotContain: ["fenix 7", "fenix 6", "epix", "forerunner", "instinct", "venu", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1499000, released: 2024,
  },
  {
    id: "garmin-forerunner-265",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_forerunner_265",
    modelName: "Garmin Forerunner 265 (46mm)",
    aliases: ["Garmin Forerunner 265", "가민 포러너 265"],
    mustContain: [["garmin", "가민"], ["forerunner 265", "포러너 265", "fr 265", "fr265"]],
    mustNotContain: ["forerunner 245", "forerunner 255", "forerunner 745", "forerunner 955", "forerunner 965", "포러너 245", "포러너 255", "포러너 955", "포러너 965", "fenix", "페닉스", "instinct", "venu", "epix", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2023,
  },
  {
    id: "garmin-forerunner-955",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_forerunner_955",
    modelName: "Garmin Forerunner 955",
    aliases: ["Garmin Forerunner 955", "가민 포러너 955"],
    mustContain: [["garmin", "가민"], ["forerunner 955", "포러너 955", "fr 955", "fr955"]],
    mustNotContain: ["forerunner 245", "forerunner 255", "forerunner 265", "forerunner 745", "forerunner 965", "포러너 265", "포러너 965", "fenix", "페닉스", "instinct", "venu", "epix", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 799000, released: 2022,
  },
  {
    id: "garmin-forerunner-965",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_forerunner_965",
    modelName: "Garmin Forerunner 965",
    aliases: ["Garmin Forerunner 965", "가민 포러너 965"],
    mustContain: [["garmin", "가민"], ["forerunner 965", "포러너 965", "fr 965", "fr965"]],
    mustNotContain: ["forerunner 245", "forerunner 255", "forerunner 265", "forerunner 745", "forerunner 955", "forerunner 970", "포러너 265", "포러너 955", "포러너 970", "fenix", "페닉스", "instinct", "venu", "epix", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 899000, released: 2023,
  },
  // Wave 189 (2026-05-18): Forerunner 970 신모델 (2025.05 출시) catalog 누락 발견. raw 76건 중 본품 다수.
  {
    id: "garmin-forerunner-970",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_forerunner_970",
    modelName: "Garmin Forerunner 970",
    aliases: ["Garmin Forerunner 970", "가민 포러너 970"],
    mustContain: [["garmin", "가민"], ["forerunner 970", "포러너 970", "fr 970", "fr970"]],
    mustNotContain: ["forerunner 245", "forerunner 255", "forerunner 265", "forerunner 745", "forerunner 955", "forerunner 965", "포러너 265", "포러너 955", "포러너 965", "fenix", "페닉스", "instinct", "venu", "epix", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 999000, released: 2025,
  },
  {
    id: "garmin-instinct-2",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_instinct_2",
    modelName: "Garmin Instinct 2",
    aliases: ["Garmin Instinct 2", "가민 인스팅트 2"],
    mustContain: [["garmin", "가민"], ["instinct 2", "인스팅트 2", "instinct2"]],
    mustNotContain: ["instinct 3", "instinct crossover", "인스팅트 3", "fenix", "페닉스", "forerunner", "포러너", "venu", "epix", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 399000, released: 2022,
  },
  {
    id: "garmin-venu-3",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_venu_3",
    modelName: "Garmin Venu 3",
    aliases: ["Garmin Venu 3", "가민 비누 3"],
    mustContain: [["garmin", "가민"], ["venu 3", "비누 3", "venu3"]],
    mustNotContain: ["venu 2", "venu sq", "비누 2", "fenix", "페닉스", "forerunner", "포러너", "instinct", "epix", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2023,
  },
  {
    id: "garmin-epix-pro",
    brand: "Garmin", category: "smartwatch", laneKey: "garmin_epix_pro",
    modelName: "Garmin Epix Pro (Gen 2)",
    aliases: ["Garmin Epix Pro", "가민 에픽스 프로"],
    mustContain: [["garmin", "가민"], ["epix pro", "에픽스 프로", "epix"], ["pro", "프로", "gen 2", "gen2"]],
    mustNotContain: ["fenix", "페닉스", "forerunner", "포러너", "instinct", "venu", "vivoactive", "케이스만", "스트랩만", "배터리만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...GARMIN_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1199000, released: 2023,
  },
  ...CORE_SMARTPHONE_CATALOG,
  ...CORE_TABLET_CATALOG,
  ...CORE_LAPTOP_CATALOG,
  ...CORE_LAPTOP_CATALOG_PRO,
  ...GENERATED_CATALOG_WITH_GATES,
  // Wave 67: 신 사업 카테고리 진입 — 시계 (Casio G-Shock + Seiko 5 Sports), 골프 (Titleist TSR2/TSR3), 카메라 보강 (Sony a6400).
  // Wave 58 §11.D 우선순위 + 11 criteria 통과 후보. internal_only로 진입, 측정 후 ready 승격 결정.
  // §12b 정확성 우선: 모델 코드/명시 토큰만 매칭. 변형 흡수만, silent 추정 X.
  {
    id: "watch-casio-gshock-dw5600",
    brand: "Casio",
    category: "watch",
    laneKey: "watch_gshock_dw5600",
    modelName: "Casio G-Shock DW-5600",
    aliases: ["G-Shock DW-5600", "지샥 DW-5600", "DW5600", "스퀘어 지샥"],
    mustContain: [["dw-5600", "dw5600"]],
    mustNotContain: [...WATCH_NOISE, "ga-2100", "ga2100", "gmw-b5000", "gmwb5000"],
    msrpKrw: 159000,
    released: 1996,
  },
  {
    id: "watch-casio-gshock-ga2100",
    brand: "Casio",
    category: "watch",
    laneKey: "watch_gshock_ga2100",
    modelName: "Casio G-Shock GA-2100 (CasiOak)",
    aliases: ["G-Shock GA-2100", "지샥 GA-2100", "GA2100", "지얄오크", "카시오크"],
    mustContain: [["ga-2100", "ga2100", "지얄오크", "카시오크"]],
    // Wave 84: GA-2200 (2022 후속, 전면 라이트 버튼) / GA-B2100 (솔라+BT) /
    // GM-2100 (스테인리스 베젤) / GMA-S2100 (여성용 미드사이즈) 격리.
    // 디자인 매우 유사한 후속/변형 흡수 risk 차단.
    mustNotContain: [...WATCH_NOISE, "dw-5600", "dw5600", "gmw-b5000", "gmwb5000", "ga-2200", "ga2200", "ga 2200", "ga-b2100", "gab2100", "gm-2100", "gm2100", "gma-s2100", "gma s2100"],
    msrpKrw: 169000,
    released: 2019,
  },
  {
    id: "watch-casio-gshock-gmwb5000",
    brand: "Casio",
    category: "watch",
    laneKey: "watch_gshock_gmwb5000",
    modelName: "Casio G-Shock GMW-B5000 (Full Metal)",
    aliases: ["G-Shock GMW-B5000", "지샥 풀메탈", "GMWB5000", "5000풀메탈"],
    mustContain: [["gmw-b5000", "gmwb5000", "풀메탈 5000", "풀메탈5000"]],
    mustNotContain: [...WATCH_NOISE, "dw-5600", "dw5600", "ga-2100", "ga2100",
      // Wave 250 (2026-05-19): CV 1.58 (n=34) — 한정판/collab outlier 차단.
      //   기준 모델 = GMW-B5000D-1 (블랙/풀메탈, ~₩450k). 정상 sub-variants (BT/BPC/PG 일반) 는 유지.
      //   TFC 포터 ₩5.6M / TCM 카모 ₩1.6M / PG-9 신품 한정 ₩950k / 에릭헤이즈 EH ₩600~800k → block.
      //   별도 narrow 가능하지만 매물 수 부족 (각 1~2건). mustNotContain 차단 → CV 정상화 우선.
      "tfc", "포터", "porter\\b", "콜라보", "collab", "collaboration",
      "tcm", "티타늄 카모", "티타늄카모", "titanium camo",
      "에릭헤이즈", "에릭 헤이즈", "eric haze", "ericharze", "eh-9",
      "40주년", "40th", "40 주년", "pg-9", "pg9", "민트급 한정",
      "mrg", "커스텀 블랙", "커스텀블랙",
      // Wave 643: 추가 collab (Ader Error / Evangelion / Manga).
      "아더에러", "ader error", "ader x", "ade-1",
      "에반게리온", "evangelion", "ev-1", "레이", "rei",
      "망가", "manga", "ga-2100",
    ],
    msrpKrw: 990000,
    released: 2018,
  },
  {
    id: "watch-seiko-5-sports-srpd",
    brand: "Seiko",
    category: "watch",
    laneKey: "watch_seiko_5_sports_srpd",
    modelName: "Seiko 5 Sports SRPD (5KX)",
    aliases: ["Seiko 5 Sports SRPD", "세이코 5 스포츠 SRPD", "SRPD51", "SRPD55", "SRPD61", "SRPD65", "SRPD71", "SRPD79", "SRPD83", "5KX"],
    // Wave 86: mustContain 완화 — "세이코"만 명시되고 "5" 명시 안 한 매물 다수.
    // SRPD prefix는 대부분 Seiko 5 Sports 전용이지만 일부 Presage 변형 (SRPD97/99/07 등) 존재 → mustNotContain 강화.
    mustContain: [
      ["세이코", "seiko"],
      ["srpd", "5kx"],
    ],
    mustNotContain: [...WATCH_NOISE, "sbsa", "프로스펙스", "prospex", "프레사지", "presage", "astron", "스노우플레이크", "snowflake", "드레스워치", "skx", "ssk", "킹세이코", "그랜드세이코", "grand seiko"],
    msrpKrw: 350000,
    released: 2019,
  },
  {
    id: "watch-seiko-5-sports-sbsa",
    brand: "Seiko",
    category: "watch",
    laneKey: "watch_seiko_5_sports_sbsa",
    modelName: "Seiko 5 Sports SBSA",
    aliases: ["Seiko 5 Sports SBSA", "세이코 5 스포츠 SBSA"],
    mustContain: [
      ["seiko 5", "세이코 5", "세이코5"],
      ["sbsa"],
    ],
    mustNotContain: [...WATCH_NOISE, "srpd", "5kx", "프로스펙스", "prospex"],
    msrpKrw: 450000,
    released: 2019,
  },
  // Wave 754 (2026-05-24) Pareto: Seiko 991 unmatched. Seiko 5 broad + Prospex broad + general broad.
  {
    id: "watch-seiko-5-broad",
    brand: "Seiko",
    category: "watch",
    laneKey: "watch_seiko_5_broad",
    modelName: "Seiko 5 (broad — SRPD/SBSA 외)",
    aliases: ["Seiko 5", "세이코 5", "세이코 파이브"],
    mustContain: [
      ["seiko 5", "세이코 5", "세이코5", "seiko5", "seiko five", "세이코 파이브"],
    ],
    mustNotContain: [...WATCH_NOISE,
      "srpd", "5kx", "sbsa",
      "프로스펙스", "prospex", "프레사지", "presage",
      "astron", "킹세이코", "king seiko", "그랜드세이코", "grand seiko",
      "skx", "ssk", "스노우플레이크", "snowflake",
      // 케이스/스트랩 단품
      "스트랩만", "밴드만", "케이스만", "베젤만",
    ],
    msrpKrw: 250000,
    released: 2019,
  },
  {
    id: "watch-seiko-prospex-broad",
    brand: "Seiko",
    category: "watch",
    laneKey: "watch_seiko_prospex_broad",
    modelName: "Seiko Prospex (broad — Diver/Turtle/Alpinist/Speedtimer)",
    aliases: ["Seiko Prospex", "세이코 프로스펙스", "프로스펙스"],
    mustContain: [
      ["프로스펙스", "prospex", "터틀", "turtle", "사무라이", "samurai", "알피니스트", "alpinist", "스피드타이머", "speedtimer", "다이버", "diver"],
      ["세이코", "seiko"],
    ],
    mustNotContain: [...WATCH_NOISE,
      "세이코 5", "seiko 5", "세이코5", "seiko5",
      "srpd", "sbsa", "5kx",
      "프레사지", "presage", "astron",
      "킹세이코", "king seiko", "그랜드세이코", "grand seiko",
      "롤렉스", "rolex", "오메가", "omega", "튜더", "tudor",  // 다른 brand
      // 케이스/스트랩 단품
      "스트랩만", "밴드만", "케이스만", "베젤만",
    ],
    msrpKrw: 800000,
    released: 2014,
  },
  {
    id: "watch-seiko-broad",
    brand: "Seiko",
    category: "watch",
    laneKey: "watch_seiko_broad",
    modelName: "Seiko (broad — narrow 미박힘 catch-all)",
    aliases: ["Seiko", "세이코"],
    mustContain: [
      ["세이코", "seiko"],
    ],
    mustNotContain: [...WATCH_NOISE,
      // narrow lane으로 매칭되어야 할 명시
      "세이코 5", "seiko 5", "세이코5", "seiko5", "세이코 파이브",
      "srpd", "sbsa", "5kx",
      "프로스펙스", "prospex", "터틀", "turtle", "사무라이", "samurai", "알피니스트", "alpinist", "스피드타이머", "speedtimer", "다이버",
      "프레사지", "presage", "astron",
      "킹세이코", "king seiko", "그랜드세이코", "grand seiko", "gs ",
      // 다른 brand
      "롤렉스", "rolex", "오메가", "omega", "튜더", "tudor", "지샥", "g-shock",
      // 케이스/스트랩 단품
      "스트랩만", "밴드만", "케이스만", "베젤만",
      // 캡코 SBSA/SBDC/SBDX 같은 모델 코드 — narrow lane으로
      "sbdc", "sbdx",
      // Wave 763 (2026-05-27): 사용자 audit 발견 — 음반/싱글이 시계로 매칭됨 (pid 9002926285481).
      //   "시티팝 일본 가수 7" 싱글" 같은 음반 매물 차단.
      "lp ", "vinyl", "바이닐", "음반", "싱글", "7인치", "12인치",
      "ep ", "음악", "music", "앨범", "album",
      "시티팝", "city pop", "재즈", "jazz", "락 ", "rock band",
    ],
    msrpKrw: 400000,
    released: 1881,
    confusionNote: "Seiko 5/Prospex/Presage/Astron narrow 미박힘 catch-all. Grand Seiko/King Seiko는 명품 정책 skip.",
  },
  {
    id: "sport-golf-titleist-tsr2-driver",
    brand: "Titleist",
    category: "sport_golf",
    laneKey: "sport_golf_titleist_tsr2_driver",
    modelName: "Titleist TSR2 Driver",
    aliases: ["Titleist TSR2 Driver", "타이틀리스트 TSR2 드라이버"],
    mustContain: [
      ["tsr2", "tsr 2"],
      ["드라이버", "driver"],
    ],
    mustNotContain: [...GOLF_DRIVER_NOISE, "tsr3", "tsr 3", "tsr1", "tsi", "ts3", "ts2", "헤드만", "head only"],
    msrpKrw: 950000,
    released: 2022,
  },
  {
    id: "sport-golf-titleist-tsr3-driver",
    brand: "Titleist",
    category: "sport_golf",
    laneKey: "sport_golf_titleist_tsr3_driver",
    modelName: "Titleist TSR3 Driver",
    aliases: ["Titleist TSR3 Driver", "타이틀리스트 TSR3 드라이버"],
    mustContain: [
      ["tsr3", "tsr 3"],
      ["드라이버", "driver"],
    ],
    mustNotContain: [...GOLF_DRIVER_NOISE, "tsr2", "tsr 2", "tsr1", "tsi", "ts3", "ts2", "헤드만", "head only"],
    msrpKrw: 950000,
    released: 2022,
  },
  // Wave 759 (2026-05-24) Golf deep sweep — 11 brand × driver/iron + Scotty Cameron putter + Odyssey putter.
  // Sample 10,628 unique 매물 분석: TaylorMade 1159 / Callaway 1144 / Titleist 1088 / Honma 942 /
  //   XXIO 746 / PXG 736 / Majesty 735 / Mizuno 573 / Srixon 559 / Ping 510 / Bridgestone 412.
  // Catalog 거의 전무 (Titleist TSR2/TSR3 만). 95%+ unmatched.
  // ─── TaylorMade ───
  {
    id: "sport-golf-taylormade-driver-broad",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_driver_broad",
    modelName: "TaylorMade Driver (broad — R7/M/SIM/Stealth/Qi10)",
    aliases: ["TaylorMade Driver", "테일러메이드 드라이버"],
    mustContain: [["테일러메이드", "taylormade", "tm골프"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 600000, released: 2020,
  },
  {
    id: "sport-golf-taylormade-iron-broad",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_iron_broad",
    modelName: "TaylorMade Iron Set (broad — P/M/SIM/Stealth/P770/P790)",
    aliases: ["TaylorMade Iron", "테일러메이드 아이언"],
    mustContain: [["테일러메이드", "taylormade", "tm골프"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 1200000, released: 2020,
  },
  // ─── Callaway ───
  {
    id: "sport-golf-callaway-driver-broad",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_driver_broad",
    modelName: "Callaway Driver (broad — Paradym/Rogue/Epic/MAVRIK/AI Smoke)",
    aliases: ["Callaway Driver", "캘러웨이 드라이버"],
    mustContain: [["캘러웨이", "callaway"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 600000, released: 2020,
  },
  {
    id: "sport-golf-callaway-iron-broad",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_iron_broad",
    modelName: "Callaway Iron Set (broad — Apex/Rogue/Paradym/Mavrik)",
    aliases: ["Callaway Iron", "캘러웨이 아이언"],
    mustContain: [["캘러웨이", "callaway"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 1100000, released: 2020,
  },
  // ─── Titleist (broad, narrow TSR2/TSR3는 기존) ───
  {
    id: "sport-golf-titleist-driver-broad",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_driver_broad",
    modelName: "Titleist Driver (broad — TSi/GT/910/913/915/917)",
    aliases: ["Titleist Driver", "타이틀리스트 드라이버"],
    mustContain: [["타이틀리스트", "titleist"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE, "tsr2", "tsr 2", "tsr3", "tsr 3"],
    msrpKrw: 700000, released: 2020,
  },
  {
    id: "sport-golf-titleist-iron-broad",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_iron_broad",
    modelName: "Titleist Iron Set (broad — T100/T150/T200/T350/AP1/AP2)",
    aliases: ["Titleist Iron", "타이틀리스트 아이언"],
    mustContain: [["타이틀리스트", "titleist"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 1500000, released: 2020,
  },
  // ─── Honma (일본 premium) ───
  {
    id: "sport-golf-honma-driver-broad",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_driver_broad",
    modelName: "Honma Driver (broad — Beres/XP/T//World/Tour World)",
    aliases: ["Honma Driver", "혼마 드라이버", "혼마 베레스"],
    mustContain: [["혼마", "honma"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 900000, released: 2020,
  },
  {
    id: "sport-golf-honma-iron-broad",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_iron_broad",
    modelName: "Honma Iron Set (broad — Beres/TW/Tour World)",
    aliases: ["Honma Iron", "혼마 아이언"],
    mustContain: [["혼마", "honma"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 2000000, released: 2020,
  },
  // ─── XXIO (시니어 인기) ───
  {
    id: "sport-golf-xxio-driver-broad",
    brand: "XXIO", category: "sport_golf", laneKey: "sport_golf_xxio_driver_broad",
    modelName: "XXIO Driver (broad — MP400/MP500/MP600/MP1000/MP1100/XXIO 7~13)",
    aliases: ["XXIO Driver", "젝시오 드라이버", "젝시오 MP"],
    mustContain: [["젝시오", "xxio"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 700000, released: 2020,
  },
  {
    id: "sport-golf-xxio-iron-broad",
    brand: "XXIO", category: "sport_golf", laneKey: "sport_golf_xxio_iron_broad",
    modelName: "XXIO Iron Set (broad — MP series)",
    aliases: ["XXIO Iron", "젝시오 아이언"],
    mustContain: [["젝시오", "xxio"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 1500000, released: 2020,
  },
  // ─── PXG ───
  {
    id: "sport-golf-pxg-driver-broad",
    brand: "PXG", category: "sport_golf", laneKey: "sport_golf_pxg_driver_broad",
    modelName: "PXG Driver (broad — 0311 series)",
    aliases: ["PXG Driver", "PXG 드라이버"],
    mustContain: [["pxg"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 1000000, released: 2020,
  },
  {
    id: "sport-golf-pxg-iron-broad",
    brand: "PXG", category: "sport_golf", laneKey: "sport_golf_pxg_iron_broad",
    modelName: "PXG Iron Set (broad — 0311 T/P/ST/X/XF/GEN5/GEN6)",
    aliases: ["PXG Iron", "PXG 아이언"],
    mustContain: [["pxg"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 2500000, released: 2020,
  },
  // ─── Majesty (시니어 premium) ───
  {
    id: "sport-golf-majesty-driver-broad",
    brand: "Majesty", category: "sport_golf", laneKey: "sport_golf_majesty_driver_broad",
    modelName: "Majesty Driver (broad — Conquest/Prestigio/FL Plus/Verati)",
    aliases: ["Majesty Driver", "마제스티 드라이버"],
    mustContain: [["마제스티", "majesty", "마루망"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 800000, released: 2020,
  },
  {
    id: "sport-golf-majesty-iron-broad",
    brand: "Majesty", category: "sport_golf", laneKey: "sport_golf_majesty_iron_broad",
    modelName: "Majesty Iron Set (broad — Conquest/Prestigio/FL Plus/Verati)",
    aliases: ["Majesty Iron", "마제스티 아이언"],
    mustContain: [["마제스티", "majesty", "마루망"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 2000000, released: 2020,
  },
  // ─── Mizuno Golf ───
  {
    id: "sport-golf-mizuno-driver-broad",
    brand: "Mizuno", category: "sport_golf", laneKey: "sport_golf_mizuno_driver_broad",
    modelName: "Mizuno Driver (broad — ST/MP/JPX)",
    aliases: ["Mizuno Driver", "미즈노 드라이버"],
    mustContain: [["미즈노", "mizuno"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE,
      // 신발 차단 (mizuno alpha shoe와 충돌)
      "alpha", "wave", "monarcida", "morelia", "sala", "런닝", "축구화",
    ],
    msrpKrw: 500000, released: 2020,
  },
  {
    id: "sport-golf-mizuno-iron-broad",
    brand: "Mizuno", category: "sport_golf", laneKey: "sport_golf_mizuno_iron_broad",
    modelName: "Mizuno Iron Set (broad — JPX/MP/Pro/T20)",
    aliases: ["Mizuno Iron", "미즈노 아이언", "jpx", "mp-20"],
    mustContain: [["미즈노", "mizuno"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE,
      "alpha", "wave", "monarcida", "morelia", "sala", "런닝", "축구화",
    ],
    msrpKrw: 1200000, released: 2020,
  },
  // ─── Srixon ───
  {
    id: "sport-golf-srixon-driver-broad",
    brand: "Srixon", category: "sport_golf", laneKey: "sport_golf_srixon_driver_broad",
    modelName: "Srixon Driver (broad — Z series Z565/Z585/Z725/Z765/ZX5/ZX7)",
    aliases: ["Srixon Driver", "스릭슨 드라이버"],
    mustContain: [["스릭슨", "srixon"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE],
    msrpKrw: 500000, released: 2020,
  },
  {
    id: "sport-golf-srixon-iron-broad",
    brand: "Srixon", category: "sport_golf", laneKey: "sport_golf_srixon_iron_broad",
    modelName: "Srixon Iron Set (broad — Z355/Z585/Z785/ZX series)",
    aliases: ["Srixon Iron", "스릭슨 아이언"],
    mustContain: [["스릭슨", "srixon"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE],
    msrpKrw: 1000000, released: 2020,
  },
  // ─── Ping ───
  {
    id: "sport-golf-ping-driver-broad",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_driver_broad",
    modelName: "Ping Driver (broad — G15/G30/G400/G410/G425/G430)",
    aliases: ["Ping Driver", "핑 드라이버"],
    mustContain: [["ping", "핑 ", "핑골프"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE,
      "타핑", "더핑", "어핑", "쵸핑", "쇼핑", "포핑", "핑핑", "핑크",  // 핑 single token false match
    ],
    msrpKrw: 500000, released: 2020,
  },
  {
    id: "sport-golf-ping-iron-broad",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_iron_broad",
    modelName: "Ping Iron Set (broad — i series i210/i230/i500/G410/G425)",
    aliases: ["Ping Iron", "핑 아이언"],
    mustContain: [["ping", "핑 ", "핑골프"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE,
      "타핑", "더핑", "어핑", "쵸핑", "쇼핑", "포핑", "핑핑", "핑크",
    ],
    msrpKrw: 1300000, released: 2020,
  },
  // ─── Bridgestone Golf ───
  {
    id: "sport-golf-bridgestone-driver-broad",
    brand: "Bridgestone", category: "sport_golf", laneKey: "sport_golf_bridgestone_driver_broad",
    modelName: "Bridgestone Driver (broad — B1/B2/B3/Tour B)",
    aliases: ["Bridgestone Driver", "브리지스톤 드라이버"],
    mustContain: [["브리지스톤", "bridgestone"], ["드라이버", "driver"]],
    mustNotContain: [...GOLF_DRIVER_BROAD_NOISE,
      "타이어",  // 자동차 타이어 brand과 같이 박힘
    ],
    msrpKrw: 600000, released: 2020,
  },
  {
    id: "sport-golf-bridgestone-iron-broad",
    brand: "Bridgestone", category: "sport_golf", laneKey: "sport_golf_bridgestone_iron_broad",
    modelName: "Bridgestone Iron Set (broad — V300/201CB/Tour B)",
    aliases: ["Bridgestone Iron", "브리지스톤 아이언"],
    mustContain: [["브리지스톤", "bridgestone"], ["아이언"]],
    mustNotContain: [...GOLF_IRON_BROAD_NOISE,
      "타이어",
    ],
    msrpKrw: 1400000, released: 2020,
  },
  // ─── Putter (Scotty Cameron + Odyssey) ───
  {
    id: "sport-golf-scotty-cameron-putter-broad",
    brand: "Scotty Cameron", category: "sport_golf", laneKey: "sport_golf_scotty_cameron_putter_broad",
    modelName: "Scotty Cameron Putter (broad — Newport/Phantom/Special Select/Studio Style)",
    aliases: ["Scotty Cameron Putter", "스코티 카메론 퍼터"],
    mustContain: [["스코티 카메론", "scotty cameron", "스코티카메론", "scottycameron"], ["퍼터", "putter"]],
    mustNotContain: [...GOLF_PUTTER_BROAD_NOISE],
    msrpKrw: 900000, released: 2020,
  },
  {
    id: "sport-golf-odyssey-putter-broad",
    brand: "Odyssey", category: "sport_golf", laneKey: "sport_golf_odyssey_putter_broad",
    modelName: "Odyssey Putter (broad — White Hot/Stroke Lab/Two Ball/Versa)",
    aliases: ["Odyssey Putter", "오디세이 퍼터"],
    mustContain: [["오디세이", "odyssey"], ["퍼터", "putter"]],
    mustNotContain: [...GOLF_PUTTER_BROAD_NOISE,
      "원피스 오디세이",  // PS5/Switch 게임 오디세이 false match 차단
      "ps5 오디세이", "원피스",
    ],
    msrpKrw: 350000, released: 2020,
  },
  // ─── Wedge brands (각도 같은 모델은 같은 SKU. brand별 분리) ───
  // Wave 759 Phase 2: 웨지 1,449 매물 / 우드 1,925 / 하이브리드 488 / 세트 401 추가 신설.
  {
    id: "sport-golf-vokey-wedge-broad",
    brand: "Vokey (Titleist)", category: "sport_golf", laneKey: "sport_golf_vokey_wedge_broad",
    modelName: "Vokey SM Wedge (broad — SM7/SM8/SM9/SM10)",
    aliases: ["Vokey Wedge", "보키 웨지", "Vokey SM"],
    mustContain: [["보키", "vokey"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "driver", "아이언", "퍼터", "putter", "우드", "하이브리드",
    ],
    msrpKrw: 250000, released: 2020,
  },
  {
    id: "sport-golf-cleveland-wedge-broad",
    brand: "Cleveland", category: "sport_golf", laneKey: "sport_golf_cleveland_wedge_broad",
    modelName: "Cleveland Wedge (broad — RTX/CBX/Smart Sole)",
    aliases: ["Cleveland Wedge", "클리블랜드 웨지"],
    mustContain: [["클리블랜드", "cleveland"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "우드", "하이브리드",
    ],
    msrpKrw: 200000, released: 2020,
  },
  {
    id: "sport-golf-mizuno-wedge-broad",
    brand: "Mizuno", category: "sport_golf", laneKey: "sport_golf_mizuno_wedge_broad",
    modelName: "Mizuno Wedge (broad — T20/T22/T24/S23)",
    aliases: ["Mizuno Wedge", "미즈노 웨지"],
    mustContain: [["미즈노", "mizuno"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "우드", "하이브리드",
      "alpha", "wave", "monarcida", "morelia", "sala",
    ],
    msrpKrw: 220000, released: 2020,
  },
  {
    id: "sport-golf-taylormade-wedge-broad",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_wedge_broad",
    modelName: "TaylorMade Wedge (broad — Milled Grind/MG3/MG4)",
    aliases: ["TaylorMade Wedge", "테일러메이드 웨지"],
    mustContain: [["테일러메이드", "taylormade"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "우드", "하이브리드",
    ],
    msrpKrw: 220000, released: 2020,
  },
  {
    id: "sport-golf-callaway-wedge-broad",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_wedge_broad",
    modelName: "Callaway Wedge (broad — Jaws/MD5/Sure Out)",
    aliases: ["Callaway Wedge", "캘러웨이 웨지", "Jaws"],
    mustContain: [["캘러웨이", "callaway"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "우드", "하이브리드",
    ],
    msrpKrw: 200000, released: 2020,
  },
  {
    id: "sport-golf-pxg-wedge-broad",
    brand: "PXG", category: "sport_golf", laneKey: "sport_golf_pxg_wedge_broad",
    modelName: "PXG Wedge (broad — 0311 Forged/Sugar Daddy/Romeo)",
    aliases: ["PXG Wedge", "PXG 웨지"],
    mustContain: [["pxg"], ["웨지", "wedge"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "우드", "하이브리드",
    ],
    msrpKrw: 400000, released: 2020,
  },
  // ─── Wood/Fairway Wood brands ───
  {
    id: "sport-golf-taylormade-wood-broad",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_wood_broad",
    modelName: "TaylorMade Fairway Wood (broad — Stealth/SIM/Qi10/M)",
    aliases: ["TaylorMade Wood", "테일러메이드 우드"],
    mustContain: [["테일러메이드", "taylormade"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드", "1번 우드",  // 1번 우드 = 드라이버
    ],
    msrpKrw: 350000, released: 2020,
  },
  {
    id: "sport-golf-callaway-wood-broad",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_wood_broad",
    modelName: "Callaway Fairway Wood (broad — Paradym/Rogue/Epic/Mavrik)",
    aliases: ["Callaway Wood", "캘러웨이 우드"],
    mustContain: [["캘러웨이", "callaway"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드", "1번 우드",
    ],
    msrpKrw: 350000, released: 2020,
  },
  {
    id: "sport-golf-titleist-wood-broad",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_wood_broad",
    modelName: "Titleist Fairway Wood (broad — TSi/TSR/GT)",
    aliases: ["Titleist Wood", "타이틀리스트 우드"],
    mustContain: [["타이틀리스트", "titleist"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드", "1번 우드",
    ],
    msrpKrw: 400000, released: 2020,
  },
  {
    id: "sport-golf-honma-wood-broad",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_wood_broad",
    modelName: "Honma Fairway Wood (broad — Beres/Tour World)",
    aliases: ["Honma Wood", "혼마 우드"],
    mustContain: [["혼마", "honma"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드", "1번 우드",
    ],
    msrpKrw: 600000, released: 2020,
  },
  {
    id: "sport-golf-xxio-wood-broad",
    brand: "XXIO", category: "sport_golf", laneKey: "sport_golf_xxio_wood_broad",
    modelName: "XXIO Fairway Wood (broad — MP series)",
    aliases: ["XXIO Wood", "젝시오 우드"],
    mustContain: [["젝시오", "xxio"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드",
    ],
    msrpKrw: 450000, released: 2020,
  },
  {
    id: "sport-golf-ping-wood-broad",
    brand: "Ping", category: "sport_golf", laneKey: "sport_golf_ping_wood_broad",
    modelName: "Ping Fairway Wood (broad — G series)",
    aliases: ["Ping Wood", "핑 우드"],
    mustContain: [["ping", "핑 ", "핑골프"], ["우드", "wood", "페어웨이"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "하이브리드",
      "1번우드",
      "타핑", "더핑", "어핑", "쇼핑", "핑크",
    ],
    msrpKrw: 350000, released: 2020,
  },
  // ─── Hybrid brands ───
  {
    id: "sport-golf-taylormade-hybrid-broad",
    brand: "TaylorMade", category: "sport_golf", laneKey: "sport_golf_taylormade_hybrid_broad",
    modelName: "TaylorMade Hybrid (broad — Stealth/SIM/Qi10/M)",
    aliases: ["TaylorMade Hybrid", "테일러메이드 하이브리드", "유틸리티"],
    mustContain: [["테일러메이드", "taylormade"], ["하이브리드", "hybrid", "유틸리티", "utility"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지", "우드만",
    ],
    msrpKrw: 250000, released: 2020,
  },
  {
    id: "sport-golf-callaway-hybrid-broad",
    brand: "Callaway", category: "sport_golf", laneKey: "sport_golf_callaway_hybrid_broad",
    modelName: "Callaway Hybrid (broad — Paradym/Rogue/Epic)",
    aliases: ["Callaway Hybrid", "캘러웨이 하이브리드"],
    mustContain: [["캘러웨이", "callaway"], ["하이브리드", "hybrid", "유틸리티", "utility"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지",
    ],
    msrpKrw: 250000, released: 2020,
  },
  {
    id: "sport-golf-titleist-hybrid-broad",
    brand: "Titleist", category: "sport_golf", laneKey: "sport_golf_titleist_hybrid_broad",
    modelName: "Titleist Hybrid (broad — TSi/TSR/GT)",
    aliases: ["Titleist Hybrid", "타이틀리스트 하이브리드"],
    mustContain: [["타이틀리스트", "titleist"], ["하이브리드", "hybrid", "유틸리티", "utility"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지",
    ],
    msrpKrw: 300000, released: 2020,
  },
  {
    id: "sport-golf-honma-hybrid-broad",
    brand: "Honma", category: "sport_golf", laneKey: "sport_golf_honma_hybrid_broad",
    modelName: "Honma Hybrid (broad — Beres/Tour World)",
    aliases: ["Honma Hybrid", "혼마 하이브리드"],
    mustContain: [["혼마", "honma"], ["하이브리드", "hybrid", "유틸리티", "utility"]],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "드라이버", "아이언", "퍼터", "웨지",
    ],
    msrpKrw: 500000, released: 2020,
  },
  // ─── Full Set / Half Set (broad — brand 미명시 매물 다 잡음) ───
  {
    id: "sport-golf-full-set-broad",
    brand: "Generic Golf", category: "sport_golf", laneKey: "sport_golf_full_set_broad",
    modelName: "골프 풀세트 (broad — 모든 brand)",
    aliases: ["골프 풀세트", "골프 풀 세트", "골프 클럽 세트", "Full Set"],
    mustContain: [
      ["풀세트", "풀 세트", "골프세트", "골프 세트", "클럽 세트", "클럽세트", "full set"],
      ["골프", "클럽", "아이언", "드라이버", "우드", "퍼터", "웨지", "하이브리드", "유틸리티"],
    ],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "하프세트", "하프 세트", "half set",  // 하프세트는 별도
      "단품", "단일",  // 세트 아님
    ],
    msrpKrw: 1000000, released: 2020,
  },
  {
    id: "sport-golf-half-set-broad",
    brand: "Generic Golf", category: "sport_golf", laneKey: "sport_golf_half_set_broad",
    modelName: "골프 하프세트 (broad — 입문자/여성용 자주)",
    aliases: ["골프 하프세트", "골프 하프 세트", "Half Set"],
    mustContain: [
      ["하프세트", "하프 세트", "half set", "하프 클럽 세트"],
      ["골프", "클럽", "아이언", "드라이버", "우드", "퍼터", "웨지", "하이브리드", "유틸리티"],
    ],
    mustNotContain: [...GOLF_CLUB_COMMON_NOISE,
      "풀세트", "풀 세트", "full set",
    ],
    msrpKrw: 400000, released: 2020,
  },
  {
    id: "camera-sony-a6400",
    brand: "Sony",
    category: "camera",
    laneKey: "camera_body_only_exact_model",
    modelName: "Sony Alpha 6400 (a6400)",
    aliases: ["Sony a6400", "소니 a6400", "ILCE-6400", "알파 6400"],
    mustContain: [["a6400", "ilce-6400", "ilce 6400", "알파 6400", "알파6400"], ["바디", "바디만", "body"]],
    mustNotContain: [...CAMERA_BODY_ONLY_NOISE, "a6300", "a6500", "a6600", "a6700"],
    msrpKrw: 1290000,
    released: 2019,
  },
  // ─── Wave 184 (2026-05-17): 새 카테고리 "drone" — DJI 드론 + DJI 액션캠 + GoPro ─
  // DJI 드론: 본체 only (Fly More Combo 매물은 mustNotContain "fly more" 로 격리 — 본체 시세와 분리).
  // 정품 등록 + DJI 활성화 필수라 짝퉁 거의 없음. GoPro 도 동일.
  // 모두 단일 옵션 (메모리/배터리 별매).
  // DJI 드론
  {
    id: "dji-mini-2",
    brand: "DJI", category: "drone", laneKey: "dji_mini_2",
    modelName: "DJI Mini 2",
    aliases: ["DJI Mini 2", "디제이아이 미니 2"],
    mustContain: [["dji", "디제이아이"], ["mini 2", "mini2", "미니 2", "미니2"]],
    mustNotContain: ["mini 3", "mini 4", "mini se", "mavic", "air", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "프로펠러만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2020,
  },
  {
    id: "dji-mini-3-pro",
    brand: "DJI", category: "drone", laneKey: "dji_mini_3_pro",
    modelName: "DJI Mini 3 Pro",
    aliases: ["DJI Mini 3 Pro", "DJI 미니 3 프로"],
    mustContain: [["dji", "디제이아이"], ["mini 3", "mini3", "미니 3", "미니3"], ["pro", "프로"]],
    mustNotContain: ["mini 4", "mavic", "air", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "프로펠러만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE,
      // Wave 250 (2026-05-19): production sample CV 1.20 (n=8) — 배터리/프로펠러/랜딩기어/조종기 단품 매물 차단 보강.
      //   기존 "배터리만/프롭만" 만 → "배터리 판매" / "프로펠러 14개" / "랜딩기어" 통과.
      //   "미니34프로" / "미니3,4프로" 같은 typo / multi-model 매물도 차단 (3+4 둘 다 매칭 ambiguous).
      //   주의: 단순 "배터리" 단독 차단 시 정상 풀셋 (드론 + 배터리) 도 막힘 → "배터리 판매" 같은 명시 패턴만.
      "배터리 판매", "배터리판매", "프롭 판매", "프롭판매",
      "프로펠러 홀더", "프로펠러 14", "프로펠러 12", "프로펠러 6", "프로펠러 4",
      "랜딩기어", "랜딩 기어",
      "조정기 (중고)", "조정기(중고)", "rc조정기", "rc 조정기", "rc조종기", "rc 조종기",
      "악세사리 모음", "액세서리 모음", "악세사리만", "액세서리만",
      "미니34프로", "미니3,4프로", "미니 3,4 프로", "미니3 4프로", "mini3,4", "미니3,4", "3,4프로",
      "프롭 랜딩"],
    msrpKrw: 1099000, released: 2022,
  },
  {
    // Wave 188 follow-up (2026-05-18): production sweep FP 100% (2/2). 모든 매물이 ND/K&F 필터 키트 단품.
    // → 필터 액세서리 단품 직접 차단 + WAVE188 spread (이미 k&f / nd 필터 / 필터 키트 포함).
    id: "dji-mini-4-pro",
    brand: "DJI", category: "drone", laneKey: "dji_mini_4_pro",
    modelName: "DJI Mini 4 Pro",
    aliases: ["DJI Mini 4 Pro", "DJI 미니 4 프로"],
    mustContain: [["dji", "디제이아이"], ["mini 4", "mini4", "미니 4", "미니4"], ["pro", "프로"]],
    mustNotContain: [
      "mini 3", "mini 2", "mavic", "air", "avata",
      "fly more", "콤보", "combo",
      "배터리만", "프롭만", "프로펠러만", "충전기만", "케이스만",
      "고장", "추락", "파손", "수리", "매입", "삽니다",
      ...DRONE_FILTER_ACCESSORY_NOISE,
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 1199000, released: 2024,
  },
  {
    id: "dji-mavic-3",
    brand: "DJI", category: "drone", laneKey: "dji_mavic_3",
    modelName: "DJI Mavic 3",
    aliases: ["DJI Mavic 3", "DJI 매빅 3"],
    mustContain: [["dji", "디제이아이"], ["mavic 3", "mavic3", "매빅 3", "매빅3"]],
    mustNotContain: ["mavic 3 pro", "mavic 3 classic", "mavic 3 cine", "mavic3pro", "mavic3classic", "매빅 3 프로", "매빅 3 클래식", "mini", "air", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 2399000, released: 2021,
  },
  {
    id: "dji-mavic-3-pro",
    brand: "DJI", category: "drone", laneKey: "dji_mavic_3_pro",
    modelName: "DJI Mavic 3 Pro",
    aliases: ["DJI Mavic 3 Pro", "DJI 매빅 3 프로"],
    mustContain: [["dji", "디제이아이"], ["mavic 3", "mavic3", "매빅 3", "매빅3"], ["pro", "프로"]],
    mustNotContain: ["mavic 3 classic", "mavic 3 cine", "매빅 3 클래식", "mini", "air", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 3099000, released: 2023,
  },
  {
    id: "dji-mavic-3-classic",
    brand: "DJI", category: "drone", laneKey: "dji_mavic_3_classic",
    modelName: "DJI Mavic 3 Classic",
    aliases: ["DJI Mavic 3 Classic", "DJI 매빅 3 클래식"],
    mustContain: [["dji", "디제이아이"], ["mavic 3", "mavic3", "매빅 3", "매빅3"], ["classic", "클래식"]],
    mustNotContain: ["mavic 3 pro", "mavic 3 cine", "매빅 3 프로", "mini", "air", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1899000, released: 2022,
  },
  {
    id: "dji-air-2s",
    brand: "DJI", category: "drone", laneKey: "dji_air_2s",
    modelName: "DJI Air 2S",
    aliases: ["DJI Air 2S", "DJI 에어 2S"],
    mustContain: [["dji", "디제이아이"], ["air 2s", "air2s", "에어 2s", "에어2s"]],
    // Wave 184 fix: "air 2 " (trailing space) 박지 X — tokenHit trim 후 "air 2" 자기차단.
    // dji-air-2 (Mavic Air 2) 는 별도 모델명 매칭 X (catalog 없음). air 3/3s 만 격리.
    mustNotContain: ["air 3", "air 3s", "에어 3", "mini", "mavic", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1199000, released: 2021,
  },
  {
    id: "dji-air-3",
    brand: "DJI", category: "drone", laneKey: "dji_air_3",
    modelName: "DJI Air 3",
    aliases: ["DJI Air 3", "DJI 에어 3"],
    mustContain: [["dji", "디제이아이"], ["air 3", "air3", "에어 3", "에어3"]],
    mustNotContain: ["air 3s", "air3s", "에어 3s", "air 2s", "에어 2s", "mini", "mavic", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1499000, released: 2023,
  },
  {
    id: "dji-air-3s",
    brand: "DJI", category: "drone", laneKey: "dji_air_3s",
    modelName: "DJI Air 3S",
    aliases: ["DJI Air 3S", "DJI 에어 3S"],
    mustContain: [["dji", "디제이아이"], ["air 3s", "air3s", "에어 3s", "에어3s"]],
    mustNotContain: ["air 2s", "에어 2s", "mini", "mavic", "avata", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1599000, released: 2024,
  },
  {
    id: "dji-avata",
    brand: "DJI", category: "drone", laneKey: "dji_avata",
    modelName: "DJI Avata (FPV)",
    aliases: ["DJI Avata", "DJI 아바타"],
    // Wave 185 internal test (2026-05-18): DJI 명시 mustContain — "아바타" 단독 (영화 / PS5 게임) false positive 차단.
    mustContain: [["dji", "디제이아이"], ["dji avata", "dji 아바타", "디제이아이 아바타"]],
    mustNotContain: ["avata 2", "아바타 2", "mini", "mavic", "air", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", "영화", "포스터", "아트카드", "ps5", "ps4", "프론티어", "판도라", "필름", "굿즈", "티켓", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1099000, released: 2022,
  },
  {
    id: "dji-avata-2",
    brand: "DJI", category: "drone", laneKey: "dji_avata_2",
    modelName: "DJI Avata 2",
    aliases: ["DJI Avata 2", "DJI 아바타 2"],
    mustContain: [["dji", "디제이아이"], ["avata 2", "avata2", "dji 아바타 2", "디제이아이 아바타 2"]],
    mustNotContain: ["mini", "mavic", "air", "fly more", "콤보", "combo", "배터리만", "프롭만", "충전기만", "케이스만", "고장", "추락", "파손", "수리", "매입", "삽니다", "영화", "포스터", "아트카드", "ps5", "ps4", "프론티어", "판도라", "필름", "굿즈", "티켓", ...DRONE_FILTER_ACCESSORY_NOISE, ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1299000, released: 2024,
  },
  // DJI 액션캠 / 포켓
  {
    id: "dji-osmo-action-3",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_action_3",
    modelName: "DJI Osmo Action 3",
    aliases: ["DJI Osmo Action 3", "DJI 오즈모 액션 3"],
    mustContain: [["dji", "디제이아이"], ["osmo action 3", "osmoaction3", "오즈모 액션 3"]],
    mustNotContain: ["action 4", "action 5", "액션 4", "액션 5", "pocket", "포켓", "마운트만", "배터리만", "충전기만", "케이스만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 499000, released: 2022,
  },
  {
    id: "dji-osmo-action-4",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_action_4",
    modelName: "DJI Osmo Action 4",
    aliases: ["DJI Osmo Action 4", "DJI 오즈모 액션 4"],
    mustContain: [["dji", "디제이아이"], ["osmo action 4", "osmoaction4", "오즈모 액션 4"]],
    mustNotContain: ["action 3", "action 5", "액션 3", "액션 5", "pocket", "포켓", "마운트만", "배터리만", "충전기만", "케이스만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 519000, released: 2023,
  },
  {
    id: "dji-osmo-action-5-pro",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_action_5_pro",
    modelName: "DJI Osmo Action 5 Pro",
    aliases: ["DJI Osmo Action 5 Pro", "DJI 오즈모 액션 5 프로"],
    mustContain: [["dji", "디제이아이"], ["osmo action 5", "osmoaction5", "오즈모 액션 5"], ["pro", "프로"]],
    mustNotContain: ["action 3", "action 4", "action 6", "액션 3", "액션 4", "액션 6", "pocket", "포켓", "nano", "나노", "마운트만", "배터리만", "충전기만", "케이스만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 559000, released: 2024,
  },
  // Wave 185 internal test (2026-05-18): DJI Osmo Action 6 신모델 (2025).
  {
    id: "dji-osmo-action-6",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_action_6",
    modelName: "DJI Osmo Action 6",
    aliases: ["DJI Osmo Action 6", "DJI 오즈모 액션 6"],
    mustContain: [["dji", "디제이아이"], ["osmo action 6", "osmoaction6", "오즈모 액션 6", "오즈모액션6", "액션6"]],
    mustNotContain: ["action 3", "action 4", "action 5", "액션 3", "액션 4", "액션 5", "pocket", "포켓", "nano", "나노", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2025,
  },
  {
    id: "dji-osmo-pocket-2",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_pocket_2",
    modelName: "DJI Osmo Pocket 2",
    aliases: ["DJI Osmo Pocket 2", "DJI 오즈모 포켓 2"],
    mustContain: [["dji", "디제이아이"], ["osmo pocket 2", "osmopocket2", "오즈모 포켓 2", "포켓 2", "포켓2"]],
    mustNotContain: ["pocket 3", "포켓 3", "포켓3", "action", "액션", "마운트만", "배터리만", "충전기만", "케이스만", "마운트 홀더", "홀더만", "brdrc", "케이지", "케이지 킷", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 439000, released: 2020,
  },
  {
    id: "dji-osmo-pocket-3",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_pocket_3",
    modelName: "DJI Osmo Pocket 3",
    aliases: ["DJI Osmo Pocket 3", "DJI 오즈모 포켓 3"],
    mustContain: [["dji", "디제이아이"], ["osmo pocket 3", "osmopocket3", "오즈모 포켓 3", "포켓 3", "포켓3"]],
    // Wave 188 internal test (2026-05-18): 액세서리 (마운트 홀더 / 케이지 / brdrc) false positive 차단.
    // Wave 885 Part 3 (2026-05-26): Creator Combo (콤보 = 광각렌즈/배터리/ND필터 번들) 차단 → 별도 SKU.
    //   ready pool audit 발견: 9 ready 중 4 콤보 (490-610K) ↔ 5 standard (440-505K). MSRP 차이로 CV 66%.
    mustNotContain: [
      "pocket 2", "포켓 2", "포켓2", "pocket 4", "포켓 4", "포켓4",
      "action", "액션", "nano", "나노",
      "마운트만", "마운트 홀더", "홀더만", "brdrc", "케이지", "케이지 킷",
      "필름만", "보호 필름",
      "배터리만", "충전기만", "케이스만",
      "고장", "파손", "수리", "매입", "삽니다",
      // Wave 885 Part 3 — Creator Combo 별도 SKU
      "크리에이터 콤보", "크리에이터콤보", "creator combo", "creatorcombo",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 769000, released: 2023,
  },
  // Wave 885 Part 3 (2026-05-26): Osmo Pocket 3 Creator Combo (광각렌즈 + 추가 배터리 + ND 필터 + 마이크) 별도 SKU.
  //   Standard 콤보 가격차 ~150K (Standard 769K / Creator Combo 949K MSRP). 시세 별도 lane 으로 분리.
  {
    id: "dji-osmo-pocket-3-creator-combo",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_pocket_3_creator_combo",
    modelName: "DJI Osmo Pocket 3 Creator Combo",
    aliases: ["DJI Osmo Pocket 3 Creator Combo", "DJI 오즈모 포켓 3 크리에이터 콤보"],
    mustContain: [
      ["dji", "디제이아이"],
      ["osmo pocket 3", "osmopocket3", "오즈모 포켓 3", "포켓 3", "포켓3"],
      ["크리에이터 콤보", "크리에이터콤보", "creator combo", "creatorcombo"],
    ],
    mustNotContain: [
      "pocket 2", "포켓 2", "포켓2", "pocket 4", "포켓 4", "포켓4",
      "action", "액션", "nano", "나노",
      "마운트만", "마운트 홀더", "홀더만", "brdrc", "케이지", "케이지 킷",
      "필름만", "보호 필름",
      "배터리만", "충전기만", "케이스만",
      "고장", "파손", "수리", "매입", "삽니다",
      ...WAVE188_NEW_CATEGORY_NOISE,
    ],
    msrpKrw: 949000, released: 2023,
  },
  // Wave 185 internal test (2026-05-18): DJI 신모델 3개 — 매물 sweep 에서 발견.
  {
    id: "dji-osmo-pocket-4",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_pocket_4",
    modelName: "DJI Osmo Pocket 4",
    aliases: ["DJI Osmo Pocket 4", "DJI 오즈모 포켓 4"],
    mustContain: [["dji", "디제이아이"], ["osmo pocket 4", "osmopocket4", "오즈모 포켓 4", "포켓 4", "포켓4"]],
    mustNotContain: ["pocket 2", "포켓 2", "포켓2", "pocket 3", "포켓 3", "포켓3", "action", "액션", "nano", "나노", "마운트만", "배터리만", "충전기만", "케이스만", "마운트 홀더", "홀더만", "brdrc", "케이지", "케이지 킷", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 899000, released: 2025,
  },
  {
    id: "dji-osmo-nano",
    brand: "DJI", category: "drone", laneKey: "dji_osmo_nano",
    modelName: "DJI Osmo Nano",
    aliases: ["DJI Osmo Nano", "DJI 오즈모 나노"],
    mustContain: [["dji", "디제이아이"], ["osmo nano", "osmonano", "오즈모 나노", "나노 액션캠"]],
    mustNotContain: ["pocket", "포켓", "action", "액션 3", "액션 4", "액션 5", "액션 6", "mavic", "mini", "air", "마운트만", "배터리만", "충전기만", "케이스만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 459000, released: 2025,
  },
  // GoPro
  {
    id: "gopro-hero-9",
    brand: "GoPro", category: "drone", laneKey: "gopro_hero_9",
    modelName: "GoPro Hero 9 Black",
    aliases: ["GoPro Hero 9", "고프로 히어로 9", "Hero 9 Black"],
    mustContain: [["gopro", "고프로"], ["hero 9", "hero9", "히어로 9", "히어로9"]],
    mustNotContain: ["hero 10", "hero 11", "hero 12", "hero 13", "히어로 10", "히어로 11", "히어로 12", "히어로 13", "max", "맥스", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 549000, released: 2020,
  },
  {
    id: "gopro-hero-10",
    brand: "GoPro", category: "drone", laneKey: "gopro_hero_10",
    modelName: "GoPro Hero 10 Black",
    aliases: ["GoPro Hero 10", "고프로 히어로 10", "Hero 10 Black"],
    mustContain: [["gopro", "고프로"], ["hero 10", "hero10", "히어로 10", "히어로10"]],
    mustNotContain: ["hero 9", "hero 11", "hero 12", "hero 13", "히어로 9", "히어로 11", "히어로 12", "히어로 13", "max", "맥스", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 649000, released: 2021,
  },
  {
    id: "gopro-hero-11",
    brand: "GoPro", category: "drone", laneKey: "gopro_hero_11",
    modelName: "GoPro Hero 11 Black",
    aliases: ["GoPro Hero 11", "고프로 히어로 11", "Hero 11 Black"],
    mustContain: [["gopro", "고프로"], ["hero 11", "hero11", "히어로 11", "히어로11"]],
    mustNotContain: ["hero 9", "hero 10", "hero 12", "hero 13", "히어로 9", "히어로 10", "히어로 12", "히어로 13", "mini", "max", "맥스", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 649000, released: 2022,
  },
  {
    id: "gopro-hero-12",
    brand: "GoPro", category: "drone", laneKey: "gopro_hero_12",
    modelName: "GoPro Hero 12 Black",
    aliases: ["GoPro Hero 12", "고프로 히어로 12", "Hero 12 Black"],
    mustContain: [["gopro", "고프로"], ["hero 12", "hero12", "히어로 12", "히어로12"]],
    mustNotContain: ["hero 9", "hero 10", "hero 11", "hero 13", "히어로 9", "히어로 10", "히어로 11", "히어로 13", "max", "맥스", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2023,
  },
  {
    id: "gopro-hero-13",
    brand: "GoPro", category: "drone", laneKey: "gopro_hero_13",
    modelName: "GoPro Hero 13 Black",
    aliases: ["GoPro Hero 13", "고프로 히어로 13", "Hero 13 Black"],
    mustContain: [["gopro", "고프로"], ["hero 13", "hero13", "히어로 13", "히어로13"]],
    mustNotContain: ["hero 9", "hero 10", "hero 11", "hero 12", "히어로 9", "히어로 10", "히어로 11", "히어로 12", "max", "맥스", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2024,
  },
  {
    id: "gopro-max",
    brand: "GoPro", category: "drone", laneKey: "gopro_max",
    modelName: "GoPro Max (360)",
    aliases: ["GoPro Max", "고프로 맥스", "GoPro 360"],
    mustContain: [["gopro", "고프로"], ["max", "맥스"]],
    mustNotContain: ["hero", "히어로", "케이스만", "배터리만", "충전기만", "마운트만", "마운트", "케이지", "그립만", "와후", "k엣지", "콤보 마운트", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE,
      // Wave 606: production false positive — 'pid 406573617 미니고프로맥스 60암페어' 4M (전기 부품 매물).
      "암페어", "ampere", "암페아",
      "미니고프로", "미니 고프로",  // 광고/혼합 brand 표기
    ],
    msrpKrw: 599000, released: 2019,
  },
  // ─── Wave 188 (2026-05-18): 새 카테고리 "lego" — 한정판/UCS/모듈러 12 SKU ───
  // 세트 번호로 고유 식별. condition (미개봉 vs 개봉) 시세 핵심 — condition_class 가 처리.
  // 짝퉁 (LEPIN 등 카피본) mustNotContain 으로 차단. 미사용 미개봉 시세 +30~50%.
  {
    id: "lego-75192-millennium-falcon", brand: "LEGO", category: "lego", laneKey: "lego_75192_millennium_falcon",
    modelName: "LEGO 75192 Millennium Falcon (UCS)",
    aliases: ["LEGO 75192", "레고 밀레니엄 팰콘", "Millennium Falcon UCS"],
    mustContain: [["75192", "lego 75192", "레고 75192"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "미니피겨만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1190000, released: 2017,
  },
  {
    id: "lego-75313-at-at", brand: "LEGO", category: "lego", laneKey: "lego_75313_at_at",
    modelName: "LEGO 75313 AT-AT (UCS)",
    aliases: ["LEGO 75313", "레고 AT-AT UCS"],
    mustContain: [["75313", "lego 75313", "레고 75313"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1090000, released: 2021,
  },
  {
    id: "lego-75331-razor-crest", brand: "LEGO", category: "lego", laneKey: "lego_75331_razor_crest",
    modelName: "LEGO 75331 The Razor Crest (UCS)",
    aliases: ["LEGO 75331", "레고 레이저 크레스트", "Razor Crest UCS"],
    mustContain: [["75331", "lego 75331", "레고 75331"]],
    // Wave 240 (2026-05-19): production audit — "75331 만달로리안 만도 몸통+헬멧 부품" 40k 매물 본품 1.1M+ SKU 매칭.
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다",
      "몸통", "헬멧만", "헬멧 부품", "피규어만", "미니피겨만", "minifigure only", "부품 새상품",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 850000, released: 2022,
  },
  {
    id: "lego-75355-x-wing", brand: "LEGO", category: "lego", laneKey: "lego_75355_x_wing",
    modelName: "LEGO 75355 X-Wing Starfighter (UCS)",
    aliases: ["LEGO 75355", "레고 X-윙 UCS"],
    mustContain: [["75355", "lego 75355", "레고 75355"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 350000, released: 2023,
  },
  {
    id: "lego-10297-boutique-hotel", brand: "LEGO", category: "lego", laneKey: "lego_10297_boutique_hotel",
    modelName: "LEGO 10297 Boutique Hotel (Modular)",
    aliases: ["LEGO 10297", "레고 부티크 호텔"],
    mustContain: [["10297", "lego 10297", "레고 10297"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 350000, released: 2022,
  },
  {
    id: "lego-10312-jazz-club", brand: "LEGO", category: "lego", laneKey: "lego_10312_jazz_club",
    modelName: "LEGO 10312 Jazz Club (Modular)",
    aliases: ["LEGO 10312", "레고 재즈 클럽"],
    mustContain: [["10312", "lego 10312", "레고 10312"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 320000, released: 2023,
  },
  {
    id: "lego-10326-natural-history-museum", brand: "LEGO", category: "lego", laneKey: "lego_10326_natural_history_museum",
    modelName: "LEGO 10326 Natural History Museum (Modular)",
    aliases: ["LEGO 10326", "레고 자연사 박물관"],
    mustContain: [["10326", "lego 10326", "레고 10326"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 380000, released: 2024,
  },
  {
    id: "lego-42143-ferrari-daytona", brand: "LEGO", category: "lego", laneKey: "lego_42143_ferrari_daytona",
    modelName: "LEGO 42143 Ferrari Daytona SP3 (Technic)",
    aliases: ["LEGO 42143", "레고 페라리 다이토나"],
    mustContain: [["42143", "lego 42143", "레고 42143"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 590000, released: 2022,
  },
  {
    id: "lego-42115-lamborghini-sian", brand: "LEGO", category: "lego", laneKey: "lego_42115_lamborghini_sian",
    modelName: "LEGO 42115 Lamborghini Sián (Technic)",
    aliases: ["LEGO 42115", "레고 람보르기니 시안"],
    mustContain: [["42115", "lego 42115", "레고 42115"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 549000, released: 2020,
  },
  {
    id: "lego-21319-central-perk", brand: "LEGO", category: "lego", laneKey: "lego_21319_central_perk",
    modelName: "LEGO 21319 Central Perk (Friends, Ideas)",
    aliases: ["LEGO 21319", "레고 센트럴 퍼크", "Friends Central Perk"],
    mustContain: [["21319", "lego 21319", "레고 21319"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 99000, released: 2019,
  },
  {
    id: "lego-21338-a-frame-cabin", brand: "LEGO", category: "lego", laneKey: "lego_21338_a_frame_cabin",
    modelName: "LEGO 21338 A-Frame Cabin (Ideas)",
    aliases: ["LEGO 21338", "레고 A-프레임 캐빈"],
    mustContain: [["21338", "lego 21338", "레고 21338"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 209000, released: 2023,
  },
  {
    id: "lego-21054-white-house", brand: "LEGO", category: "lego", laneKey: "lego_21054_white_house",
    modelName: "LEGO 21054 The White House (Architecture)",
    aliases: ["LEGO 21054", "레고 백악관"],
    mustContain: [["21054", "lego 21054", "레고 21054"]],
    mustNotContain: ["lepin", "카피", "호환", "복제", "짝퉁", "조립도만", "설명서만", "박스만", "부품만", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 130000, released: 2020,
  },
  // ─── Wave 186 (2026-05-18): 새 카테고리 "kickboard" — 전동킥보드/스쿠터 9 SKU ───
  // 한국 인기: 샤오미 Mi Scooter (Pro 2 / 3 / 4 / 4 Pro / 4 Ultra) + 세그웨이 닌봇 (Max G2 / F40 / F30 / E45).
  // 짝퉁 거의 없음 (정품 등록 + 시리얼). 단일 옵션 (배터리/색상 변형 시세 동일).
  {
    id: "xiaomi-mi-scooter-pro-2",
    brand: "Xiaomi", category: "kickboard", laneKey: "xiaomi_mi_scooter_pro_2",
    modelName: "Xiaomi Mi Electric Scooter Pro 2",
    aliases: ["Xiaomi Mi Pro 2", "샤오미 미 스쿠터 프로 2", "샤오미 Pro 2"],
    mustContain: [["샤오미", "xiaomi", "mi "], ["프로 2", "pro 2", "pro2"], ["스쿠터", "scooter", "킥보드", "전동킥보드"]],
    mustNotContain: ["pro 3", "pro 4", "프로 3", "프로 4", "m365", "1s", "ultra", "울트라", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2020,
  },
  {
    id: "xiaomi-mi-scooter-3",
    brand: "Xiaomi", category: "kickboard", laneKey: "xiaomi_mi_scooter_3",
    modelName: "Xiaomi Mi Electric Scooter 3",
    aliases: ["Xiaomi Mi Scooter 3", "샤오미 미 스쿠터 3"],
    mustContain: [["샤오미", "xiaomi", "mi "], ["스쿠터 3", "scooter 3", "scooter3"], ["킥보드", "전동킥보드", "scooter", "스쿠터"]],
    mustNotContain: ["pro", "프로", "scooter 4", "스쿠터 4", "ultra", "울트라", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 499000, released: 2021,
  },
  {
    id: "xiaomi-mi-scooter-4",
    brand: "Xiaomi", category: "kickboard", laneKey: "xiaomi_mi_scooter_4",
    modelName: "Xiaomi Mi Electric Scooter 4",
    aliases: ["Xiaomi Mi Scooter 4", "샤오미 미 스쿠터 4"],
    mustContain: [["샤오미", "xiaomi", "mi "], ["스쿠터 4", "scooter 4", "scooter4"], ["킥보드", "전동킥보드", "scooter", "스쿠터"]],
    mustNotContain: ["pro", "프로", "ultra", "울트라", "scooter 3", "스쿠터 3", "scooter 5", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2022,
  },
  {
    id: "xiaomi-mi-scooter-4-pro",
    brand: "Xiaomi", category: "kickboard", laneKey: "xiaomi_mi_scooter_4_pro",
    modelName: "Xiaomi Mi Electric Scooter 4 Pro",
    aliases: ["Xiaomi Mi Scooter 4 Pro", "샤오미 미 스쿠터 4 프로"],
    mustContain: [["샤오미", "xiaomi", "mi "], ["스쿠터 4", "scooter 4", "scooter4"], ["프로", "pro"]],
    mustNotContain: ["ultra", "울트라", "scooter 3", "scooter 5", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 699000, released: 2023,
  },
  {
    id: "xiaomi-mi-scooter-4-ultra",
    brand: "Xiaomi", category: "kickboard", laneKey: "xiaomi_mi_scooter_4_ultra",
    modelName: "Xiaomi Mi Electric Scooter 4 Ultra",
    aliases: ["Xiaomi Mi Scooter 4 Ultra", "샤오미 미 스쿠터 4 울트라"],
    mustContain: [["샤오미", "xiaomi", "mi "], ["스쿠터 4", "scooter 4", "scooter4"], ["ultra", "울트라"]],
    mustNotContain: ["pro 2", "프로 2", "scooter 3", "scooter 5", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 899000, released: 2024,
  },
  {
    id: "ninebot-max-g2",
    brand: "Segway-Ninebot", category: "kickboard", laneKey: "ninebot_max_g2",
    modelName: "Segway Ninebot KickScooter Max G2",
    aliases: ["Segway Ninebot Max G2", "세그웨이 닌봇 맥스 G2", "Ninebot Max G2"],
    mustContain: [["닌봇", "ninebot", "세그웨이", "segway"], ["max g2", "맥스 g2", "max-g2", "g2"]],
    mustNotContain: ["max g30", "맥스 g30", "g30", "f30", "f40", "f25", "e45", "e25", "e22", "es1", "es2", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 1290000, released: 2023,
  },
  {
    id: "ninebot-f40",
    brand: "Segway-Ninebot", category: "kickboard", laneKey: "ninebot_f40",
    modelName: "Segway Ninebot KickScooter F40",
    aliases: ["Segway Ninebot F40", "닌봇 F40"],
    mustContain: [["닌봇", "ninebot", "세그웨이", "segway"], ["f40"]],
    mustNotContain: ["f30", "f25", "max", "맥스", "e45", "e25", "e22", "es1", "es2", "g2", "g30", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 899000, released: 2022,
  },
  {
    id: "ninebot-f30",
    brand: "Segway-Ninebot", category: "kickboard", laneKey: "ninebot_f30",
    modelName: "Segway Ninebot KickScooter F30",
    aliases: ["Segway Ninebot F30", "닌봇 F30"],
    mustContain: [["닌봇", "ninebot", "세그웨이", "segway"], ["f30"]],
    mustNotContain: ["f40", "f25", "max", "맥스", "e45", "e25", "e22", "es1", "es2", "g2", "g30", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 699000, released: 2021,
  },
  {
    id: "ninebot-e45",
    brand: "Segway-Ninebot", category: "kickboard", laneKey: "ninebot_e45",
    modelName: "Segway Ninebot KickScooter E45",
    aliases: ["Segway Ninebot E45", "닌봇 E45"],
    mustContain: [["닌봇", "ninebot", "세그웨이", "segway"], ["e45"]],
    mustNotContain: ["e25", "e22", "es1", "es2", "f30", "f40", "max", "맥스", "g2", "g30", "배터리만", "타이어만", "충전기만", "고장", "파손", "수리", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 599000, released: 2020,
  },
  // ─── Wave 185 (2026-05-17): 새 카테고리 "perfume" — 명품 향수 22 SKU ───
  // 인기 브랜드 (Jo Malone / Le Labo / Diptyque / Tom Ford / Maison Margiela Replica / Memo Paris) 인기 향.
  // 짝퉁 일부 있으나 명품 가방보다 낮음. mustNotContain: "분주", "소분", "리필", "샘플", "vial", "빈병", "공병".
  // Jo Malone
  {
    id: "jo-malone-wood-sage-sea-salt-100", brand: "Jo Malone", category: "perfume", laneKey: "jo_malone_wood_sage_sea_salt_100",
    modelName: "Jo Malone Wood Sage & Sea Salt 100ml",
    aliases: ["Jo Malone Wood Sage", "조말론 우드세이지 시솔트"],
    mustContain: [["jo malone", "조말론"], ["wood sage", "우드세이지", "우드 세이지"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "50ml", "200ml", "매입", "삽니다",
      // Wave 745 (2026-05-24): spread 3.3x audit — 향수 카피/유사 향 가품 차단.
      // 매물 "퍼퓸홀릭 향 스프레이" / "프리미엄 향 스프레이" / "type" 표기 = Jo Malone 카피/유사 향.
      "퍼퓸홀릭", "perfume holic",
      "프리미엄 향 스프레이", "premium 향 스프레이",
      "type]", "type ]", " type 향", "type 향", "향 카피", "향수 카피",
      "유사향", "유사 향", "동일 향",
      "노트 카피", "카피 향수",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 2014,
  },
  {
    id: "jo-malone-lime-basil-mandarin-100", brand: "Jo Malone", category: "perfume", laneKey: "jo_malone_lime_basil_mandarin_100",
    modelName: "Jo Malone Lime Basil & Mandarin 100ml",
    aliases: ["Jo Malone Lime Basil", "조말론 라임바질 만다린"],
    mustContain: [["jo malone", "조말론"], ["lime basil", "라임바질", "라임 바질"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "50ml", "200ml", "매입", "삽니다",
      // Wave 745 (2026-05-24): spread 3.3x audit — 향수 카피/유사 향 가품 차단.
      // 매물 "퍼퓸홀릭 향 스프레이" / "프리미엄 향 스프레이" / "type" 표기 = Jo Malone 카피/유사 향.
      "퍼퓸홀릭", "perfume holic",
      "프리미엄 향 스프레이", "premium 향 스프레이",
      "type]", "type ]", " type 향", "type 향", "향 카피", "향수 카피",
      "유사향", "유사 향", "동일 향",
      "노트 카피", "카피 향수",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 1999,
  },
  {
    id: "jo-malone-english-pear-freesia-100", brand: "Jo Malone", category: "perfume", laneKey: "jo_malone_english_pear_freesia_100",
    modelName: "Jo Malone English Pear & Freesia 100ml",
    aliases: ["Jo Malone English Pear", "조말론 잉글리쉬페어 프리지아"],
    mustContain: [["jo malone", "조말론"], ["english pear", "잉글리쉬페어", "잉글리쉬 페어"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "50ml", "200ml", "매입", "삽니다",
      // Wave 745 (2026-05-24): spread 3.3x audit — 향수 카피/유사 향 가품 차단.
      // 매물 "퍼퓸홀릭 향 스프레이" / "프리미엄 향 스프레이" / "type" 표기 = Jo Malone 카피/유사 향.
      "퍼퓸홀릭", "perfume holic",
      "프리미엄 향 스프레이", "premium 향 스프레이",
      "type]", "type ]", " type 향", "type 향", "향 카피", "향수 카피",
      "유사향", "유사 향", "동일 향",
      "노트 카피", "카피 향수",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 2010,
  },
  {
    id: "jo-malone-blackberry-bay-100", brand: "Jo Malone", category: "perfume", laneKey: "jo_malone_blackberry_bay_100",
    modelName: "Jo Malone Blackberry & Bay 100ml",
    aliases: ["Jo Malone Blackberry Bay", "조말론 블랙베리 베이"],
    mustContain: [["jo malone", "조말론"], ["blackberry", "블랙베리"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "50ml", "200ml", "매입", "삽니다",
      // Wave 745 (2026-05-24): spread 3.3x audit — 향수 카피/유사 향 가품 차단.
      // 매물 "퍼퓸홀릭 향 스프레이" / "프리미엄 향 스프레이" / "type" 표기 = Jo Malone 카피/유사 향.
      "퍼퓸홀릭", "perfume holic",
      "프리미엄 향 스프레이", "premium 향 스프레이",
      "type]", "type ]", " type 향", "type 향", "향 카피", "향수 카피",
      "유사향", "유사 향", "동일 향",
      "노트 카피", "카피 향수",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 2012,
  },
  {
    id: "jo-malone-peony-blush-suede-100", brand: "Jo Malone", category: "perfume", laneKey: "jo_malone_peony_blush_suede_100",
    modelName: "Jo Malone Peony & Blush Suede 100ml",
    aliases: ["Jo Malone Peony Blush", "조말론 피오니 블러쉬"],
    mustContain: [["jo malone", "조말론"], ["peony", "피오니"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "50ml", "200ml", "매입", "삽니다",
      // Wave 745 (2026-05-24): spread 3.3x audit — 향수 카피/유사 향 가품 차단.
      // 매물 "퍼퓸홀릭 향 스프레이" / "프리미엄 향 스프레이" / "type" 표기 = Jo Malone 카피/유사 향.
      "퍼퓸홀릭", "perfume holic",
      "프리미엄 향 스프레이", "premium 향 스프레이",
      "type]", "type ]", " type 향", "type 향", "향 카피", "향수 카피",
      "유사향", "유사 향", "동일 향",
      "노트 카피", "카피 향수",
      ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 2014,
  },
  // Le Labo
  {
    id: "le-labo-santal-33-50", brand: "Le Labo", category: "perfume", laneKey: "le_labo_santal_33_50",
    modelName: "Le Labo Santal 33 50ml",
    aliases: ["Le Labo Santal 33 50ml", "르라보 산탈 33 50ml"],
    mustContain: [["le labo", "르라보", "르 라보"], ["santal 33", "산탈 33", "산탈33", "santal33"], ["50ml", "50 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "100ml", "15ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 290000, released: 2011,
  },
  {
    id: "le-labo-santal-33-100", brand: "Le Labo", category: "perfume", laneKey: "le_labo_santal_33_100",
    modelName: "Le Labo Santal 33 100ml",
    aliases: ["Le Labo Santal 33 100ml", "르라보 산탈 33 100ml"],
    mustContain: [["le labo", "르라보", "르 라보"], ["santal 33", "산탈 33", "산탈33", "santal33"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "50ml", "15ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 450000, released: 2011,
  },
  {
    id: "le-labo-noir-29-50", brand: "Le Labo", category: "perfume", laneKey: "le_labo_noir_29_50",
    modelName: "Le Labo The Noir 29 50ml",
    aliases: ["Le Labo The Noir 29", "르라보 더 누아 29"],
    mustContain: [["le labo", "르라보", "르 라보"], ["the noir 29", "누아 29", "noir29", "더누아 29"], ["50ml", "50 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "100ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 290000, released: 2015,
  },
  // Diptyque
  {
    id: "diptyque-philosykos-75", brand: "Diptyque", category: "perfume", laneKey: "diptyque_philosykos_75",
    modelName: "Diptyque Philosykos 75ml",
    aliases: ["Diptyque Philosykos", "딥디크 필로시코스"],
    mustContain: [["diptyque", "딥디크"], ["philosykos", "필로시코스"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "50ml", "100ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 220000, released: 1996,
  },
  {
    id: "diptyque-do-son-75", brand: "Diptyque", category: "perfume", laneKey: "diptyque_do_son_75",
    modelName: "Diptyque Do Son 75ml",
    aliases: ["Diptyque Do Son", "딥디크 도손"],
    mustContain: [["diptyque", "딥디크"], ["do son", "도손", "도 손"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "50ml", "100ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 220000, released: 2005,
  },
  {
    id: "diptyque-eau-capitale-75", brand: "Diptyque", category: "perfume", laneKey: "diptyque_eau_capitale_75",
    modelName: "Diptyque Eau Capitale 75ml",
    aliases: ["Diptyque Eau Capitale", "딥디크 오 카피탈"],
    mustContain: [["diptyque", "딥디크"], ["eau capitale", "오 카피탈", "오카피탈"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "50ml", "100ml", "매입", "삽니다", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 250000, released: 2019,
  },
  // Tom Ford
  {
    id: "tom-ford-black-orchid-50", brand: "Tom Ford", category: "perfume", laneKey: "tom_ford_black_orchid_50",
    modelName: "Tom Ford Black Orchid 50ml",
    aliases: ["Tom Ford Black Orchid", "톰포드 블랙 오키드"],
    mustContain: [["tom ford", "톰포드", "톰 포드"], ["black orchid", "블랙 오키드", "블랙오키드"], ["50ml", "50 ml"]],
    // Wave 185 internal test (2026-05-18): Tom Ford 신발 (첼시부츠/스니커즈/캠브리지/로퍼/옥스포드) false positive 차단.
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "100ml", "매입", "삽니다", "스니커즈", "첼시", "부츠", "캠브리지", "로퍼", "오포드", "옥스포드", "신발", "운동화", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 230000, released: 2006,
  },
  {
    id: "tom-ford-tobacco-vanille-50", brand: "Tom Ford", category: "perfume", laneKey: "tom_ford_tobacco_vanille_50",
    modelName: "Tom Ford Tobacco Vanille 50ml",
    aliases: ["Tom Ford Tobacco Vanille", "톰포드 토바코 바닐라"],
    mustContain: [["tom ford", "톰포드", "톰 포드"], ["tobacco vanille", "토바코 바닐라", "토바코바닐라"], ["50ml", "50 ml"]],
    // Wave 185 fix: 신발 (shoe-adidas-tobacco-broad) 와 격리 — "아디다스/adidas/신발/운동화" 박기.
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "100ml", "매입", "삽니다", "아디다스", "adidas", "신발", "운동화", "스니커즈", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 380000, released: 2007,
  },
  {
    id: "tom-ford-lost-cherry-50", brand: "Tom Ford", category: "perfume", laneKey: "tom_ford_lost_cherry_50",
    modelName: "Tom Ford Lost Cherry 50ml",
    aliases: ["Tom Ford Lost Cherry", "톰포드 로스트 체리"],
    mustContain: [["tom ford", "톰포드", "톰 포드"], ["lost cherry", "로스트 체리", "로스트체리"], ["50ml", "50 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "100ml", "매입", "삽니다", "스니커즈", "첼시", "부츠", "캠브리지", "로퍼", "오포드", "옥스포드", "신발", "운동화", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 480000, released: 2018,
  },
  {
    id: "tom-ford-oud-wood-50", brand: "Tom Ford", category: "perfume", laneKey: "tom_ford_oud_wood_50",
    modelName: "Tom Ford Oud Wood 50ml",
    aliases: ["Tom Ford Oud Wood", "톰포드 우드 우드"],
    mustContain: [["tom ford", "톰포드", "톰 포드"], ["oud wood", "우드 우드", "우드우드", "oud", "우드"], ["50ml", "50 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "100ml", "매입", "삽니다", "스니커즈", "첼시", "부츠", "캠브리지", "로퍼", "오포드", "옥스포드", "신발", "운동화", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 380000, released: 2007,
  },
  // Maison Margiela Replica
  {
    id: "replica-jazz-club-100", brand: "Maison Margiela", category: "perfume", laneKey: "replica_jazz_club_100",
    modelName: "Replica Jazz Club 100ml",
    aliases: ["Replica Jazz Club", "메종 마르지엘라 재즈클럽", "Margiela Jazz Club"],
    mustContain: [["margiela", "마르지엘라", "replica"], ["jazz club", "재즈클럽", "재즈 클럽"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "200ml", "매입", "삽니다", "재현향", "type", "필드센트", "마이퍼퓸", "섬유탈취제", "룸스프레이", "오피셜", "더미 향수", "dupe", "dupe향", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 170000, released: 2013,
  },
  {
    id: "replica-by-the-fireplace-100", brand: "Maison Margiela", category: "perfume", laneKey: "replica_by_the_fireplace_100",
    modelName: "Replica By the Fireplace 100ml",
    aliases: ["Replica By the Fireplace", "메종 마르지엘라 바이 더 파이어플레이스", "파이어플레이스"],
    mustContain: [["margiela", "마르지엘라", "replica"], ["fireplace", "파이어플레이스", "바이 더 파이어"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "200ml", "매입", "삽니다", "재현향", "type", "필드센트", "마이퍼퓸", "섬유탈취제", "룸스프레이", "오피셜", "더미 향수", "dupe", "dupe향", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 170000, released: 2015,
  },
  {
    id: "replica-beach-walk-100", brand: "Maison Margiela", category: "perfume", laneKey: "replica_beach_walk_100",
    modelName: "Replica Beach Walk 100ml",
    aliases: ["Replica Beach Walk", "메종 마르지엘라 비치워크"],
    mustContain: [["margiela", "마르지엘라", "replica"], ["beach walk", "비치워크", "비치 워크"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "200ml", "매입", "삽니다", "재현향", "type", "필드센트", "마이퍼퓸", "섬유탈취제", "룸스프레이", "오피셜", "더미 향수", "dupe", "dupe향", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 170000, released: 2012,
  },
  {
    id: "replica-when-the-rain-stops-100", brand: "Maison Margiela", category: "perfume", laneKey: "replica_when_the_rain_stops_100",
    modelName: "Replica When the Rain Stops 100ml",
    aliases: ["Replica When the Rain Stops", "메종 마르지엘라 비온뒤", "When the Rain Stops"],
    mustContain: [["margiela", "마르지엘라", "replica"], ["when the rain", "비 온 뒤", "비온뒤", "when the rain stops"], ["100ml", "100 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "30ml", "200ml", "매입", "삽니다", "재현향", "type", "필드센트", "마이퍼퓸", "섬유탈취제", "룸스프레이", "오피셜", "더미 향수", "dupe", "dupe향", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 170000, released: 2018,
  },
  // Memo Paris
  {
    id: "memo-russian-leather-75", brand: "Memo Paris", category: "perfume", laneKey: "memo_russian_leather_75",
    modelName: "Memo Russian Leather 75ml",
    aliases: ["Memo Russian Leather", "메모 러시안 레더"],
    mustContain: [["memo paris", "memo", "메모"], ["russian leather", "러시안 레더", "러시안레더"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "200ml", "매입", "삽니다", "irish", "italian", "아이리쉬", "이탈리안", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 350000, released: 2014,
  },
  {
    id: "memo-irish-leather-75", brand: "Memo Paris", category: "perfume", laneKey: "memo_irish_leather_75",
    modelName: "Memo Irish Leather 75ml",
    aliases: ["Memo Irish Leather", "메모 아이리쉬 레더"],
    mustContain: [["memo paris", "memo", "메모"], ["irish leather", "아이리쉬 레더", "아이리쉬레더"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "200ml", "매입", "삽니다", "russian", "italian", "러시안", "이탈리안", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 350000, released: 2015,
  },
  {
    id: "memo-italian-leather-75", brand: "Memo Paris", category: "perfume", laneKey: "memo_italian_leather_75",
    modelName: "Memo Italian Leather 75ml",
    aliases: ["Memo Italian Leather", "메모 이탈리안 레더"],
    mustContain: [["memo paris", "memo", "메모"], ["italian leather", "이탈리안 레더", "이탈리안레더"], ["75ml", "75 ml"]],
    mustNotContain: ["분주", "소분", "리필", "샘플", "vial", "빈병", "공병", "테스터", "tester", "방향제", "디퓨저", "디스커버리", "discovery", "200ml", "매입", "삽니다", "russian", "irish", "러시안", "아이리쉬", ...WAVE188_NEW_CATEGORY_NOISE],
    msrpKrw: 350000, released: 2019,
  },
  // Wave 91 (2026-05-15): 일반인 친화 카테고리 확장 — 신발 39 + 가방 34 + 자전거 33 = 106 SKU.
  // 모두 resale ≤200만 (자본 천장 준수). 본품만 정책. 셀러 시세 인식 약한 모델 우선.
  ...SHOE_CATALOG,
  ...SHOE_NARROW_CATALOG,
  ...SHOE_BROAD_CATALOG,
  ...SHOE_BROAD_WAVE138_CATALOG,
  ...SHOE_WAVE140_CATALOG,
  ...SHOE_WAVE266_CATALOG, // Wave 266 — 살로몬/NB/Shox/명품 신발 broad 등 30+ SKU
  ...WAVE_712B_BIAS_FREE_SKUS, // Wave 712b — bias-free 14+21 brand 검증 50+ SKU 일괄 신설
  ...WAVE_712C_SHOE_BULK, // Wave 712c — 신발 추가 100+ SKU (NB vintage / Asics+Onitsuka / Dr.Martens family / Yeezy broad / 등)
  ...WAVE_715_CLOTHING_NARROW, // Wave 715 — 의류 체계적 narrow split (Thom Browne 6 / Moncler 3 / CDG 3 / Polo Vintage / Supreme Box Logo / 등)
  ...WAVE_726_CLOTHING_BRAND_ADD, // Wave 726 — 신규 brand (Alpha Industries / Levi's / Discovery Expedition)
  ...WAVE_727_GOLF_BROAD, // Wave 727 — 골프 6 brand (Titleist/PXG/Malbon/G·FORE/J.Lindeberg/Mark&Lona)
  ...WAVE_728_LEAK_FIX, // Wave 728 — supreme/arcteryx leak fix (collab + 한정 라인 narrow)
  ...WAVE_729_CARHARTT_BROAD, // Wave 729 — Carhartt broad (hoodie_sweat/denim_pants/overall_anorak/shirt_flannel) + double_knee leak fix + matinkim 확장
  ...WAVE_730_NIKE_APPAREL_BROAD, // Wave 730 — Nike apparel broad (Dri-FIT/Windbreaker/Hoodie_Sweat/Tee/Pants_Shorts)
  ...WAVE_731_ADIDAS_APPAREL_BROAD, // Wave 731 — Adidas apparel broad (Tracksuit/Tee/Windbreaker/Hoodie_Sweat/Pants_Shorts/Down_Padding)
  ...WAVE_732_MULTI_BRAND, // Wave 732 — Nike x MLB jersey + Uniqlo collab + Thisisneverthat + Columbia/Blackyak + Barbour quilted
  ...WAVE_733_SHOE_BROAD, // Wave 733 — 신발 broad (Salomon XT-6 + broad / Hoka Bondi + broad / On Running broad / Skechers / Under Armour)
  ...WAVE_734_MEGA_BRAND, // Wave 734 — 거대한 미발견 brand (FOG Essentials/Patagonia/Acne Studios/Nanamica/Tommy Hilfiger)
  ...WAVE_735_GOLF_BROAD_2, // Wave 735 — 골프웨어 추가 (FootJoy/AmazingCree/Callaway)
  ...WAVE_736_MM6_LACOSTE, // Wave 736 — MM6 Margiela / Lacoste broad / Mountain Hardwear
  ...WAVE_746_NEIGHBORHOOD_SCHOTT, // Wave 746 — Neighborhood / Schott (Perfecto)
  ...WAVE_749_SONY_ELECTRONICS, // Wave 749 — Sony 이어폰 신설 (WF-1000XM4/5/6 / LinkBuds Open / MDR Pro)
  ...WAVE_737_SHOE_BROAD_2, // Wave 737 — 신발 broad 추가 (Dr.Martens broad/Timberland/Keen/Fila/Clarks/Clae)
  ...WAVE_760_GAME_TITLES, // Wave 760 — 게임 카트리지/타이틀 SKU 100+ (Pokemon/Mario/Zelda/Animal Crossing 등)
  ...WAVE_805_FASHION_AXIS_SPLITS, // Wave 805 — Arc'teryx/Stussy 의류·신발 가격 축 strict split
  ...WAVE_806_FASHION_SHOE_AXIS_SPLITS, // Wave 806 — 신발 broad spread를 명시 모델 lane으로 분리
  ...WAVE_811_SHOE_EXACT_AXIS_SPLITS, // Wave 811 — Kayano/football broad에서 안전한 exact shoe lane 승격
  ...WAVE_880_FASHION_CURRENT_DRIFT, // Wave 880 — recent current-replay exact/internal fashion lanes
  ...BAG_CATALOG,
  ...BAG_WAVE266_CATALOG, // Wave 266 — 명품 가방 brand-broad fallback 20 SKU
  ...BIKE_CATALOG,
  // ─── Wave 198 (2026-05-18): 새 카테고리 "clothing" — Polo / TNF / Stussy ───
  // 사용자 정책: broad 사이즈 무관, collab narrow 분리, 가품 floor 0.30.
  // production 14d sweep 검증 — 매물량 ≥ 3건 SKU만 catalog 박음.
  // 스투시 Nike collab 109건 (전체 195건 중 56%) → narrow 필수.
  // Polo:
  // Wave 712a (2026-05-23) 신설 — Big Pony Pique 193건/주 black hole 회복.
  //   bias-free 검증: catalog 룰 충돌로 어떤 SKU에도 안 잡힘.
  //   broad mustNotContain "빅포니, big pony, 포니" + pony-tee mustNotContain "카라티" → black hole.
  //   별 narrow SKU로 빅포니 카라티/PK 매물 직접 catch.
  {
    id: "clothing-polo-bigpony-pique",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_bigpony_pique",
    modelName: "Polo Big Pony Pique Polo Shirt (카라티)",
    aliases: ["Polo Big Pony", "폴로 빅포니", "Big Pony Polo"],
    mustContain: [
      ["폴로", "polo", "ralph lauren", "랄프로렌", "랄프 로렌"],
      ["빅포니", "big pony", "빅 포니", "큰 포니", "큰포니"],
      ["피케", "pique", "pk ", "pk티", "pk 티", "카라티", "카라 티", "polo shirt", "폴로 셔츠"],
    ],
    mustNotContain: [
      "키즈", "kids", "여아", "남아", "토들러", "polo boys", "폴로 보이즈", "폴로보이즈", "polo girls", "폴로 girls", "polo kids", "랄프로렌 보이즈", "랄프로렌 키즈", "복각", "rep ", "replica", "fake",
      "RRL", "purple label", "퍼플라벨", "polo bear", "베어",
      // 다른 brand polo 차단
      "라코스테", "lacoste", "헤지스", "hazzys", "타미힐피거", "tommy hilfiger",
      "j.lindeberg", "j lindeberg", "제이린드버그", "마크앤로나", "mark&lona", "마크 앤 로나",
      "waac", "왁 골프", "디스커버리", "discovery expedition", "u.s. polo", "us polo", "미국폴로협회",
      "무신사 스탠다드", "무신사스탠다드", "탑텐", "topten", "닥스", "daks",
      "내셔널지오그래픽", "national geographic", "natgeo",
      "fendi", "펜디", "dior", "디올", "gucci", "구찌", "prada", "프라다", "burberry", "버버리",
      // 가품 시그널
      "미러급", "s급", "sa급", "n급", "1:1", "탭체",
      // RLX 차단
      "rlx", "rlx 골프", "rlx polo",
    ],
    msrpKrw: 159000, released: 2015,
    defaultProductType: "polo_shirt",
  },
  {
    id: "clothing-polo-pique-classic",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_pique_classic",
    modelName: "Polo Pique Classic Fit",
    aliases: ["Polo Pique", "폴로 피케", "Ralph Lauren Pique"],
    // Wave 236 (2026-05-19): brand 강제 — mustContain 첫 그룹이 "폴로/polo" 만이면 다른 brand 매물도 매칭.
    //   사용자 코멘트: 바나나리퍼블릭/타미힐피거/유니클로/나이키 골프/아디다스 스쿼드라/DKNY/무스너클/세터/렉토/캐피탈/빌보콰/폴스미스/헤지스 다 매칭.
    //   fix: mustContain 에 polo "랄프 로렌" / "ralph lauren" 그룹 강제 추가 OR mustNotContain 에 비폴로 brand.
    // Wave 737 leak fix (2026-05-24): group 2 ["랄프", "포니", "rl"] 제거 — group 0의 "폴로/polo/랄프로렌"으로 충분.
    //   462건 unmatched 분석: 매물 "폴로 피케티 카라티 네이비"는 group 0/1 매칭하지만 group 2 없어 leak.
    //   mustNotContain에 이미 비폴로 brand 모두 차단되어 있어 false positive 위험 낮음.
    mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌", "랄프 로렌"], ["피케", "pique", "pk ", "pk티", "pk 티", "pk반팔", "pk 반팔", "카라티", "카라 티"]],
    mustNotContain: [
      "RRL", "purple label", "퍼플라벨", "polo bear", "베어", "키즈", "kids", "여아", "남아", "토들러", "polo boys", "폴로 보이즈", "폴로보이즈", "polo girls", "폴로 girls", "polo kids", "랄프로렌 보이즈", "랄프로렌 키즈",
      // Wave 764 (2026-05-24): 보세/sub-brand polo 차단 (사용자 #4 audit 발견).
      //   "에스피오나지 Over Pique Polo Shirt" / "100 폴로 반팔카라티" 같은 보세 한국 브랜드 흡수.
      //   원피스/dress 매물 차단 (Polo Pique = 셔츠 SKU, 원피스 별도 product_type).
      "마론에디션", "에스피오나지", "espionage", "벨리에", "vellie", "투티", "투티/a9",
      "로어즈", "loars",
      "원피스", "dress", "드레스 폴로",
      // Wave 236: 비폴로 brand 매물 차단 (사용자 코멘트 직접 발견 brand 다수).
      "바나나리퍼블릭", "banana republic", "타미힐피거", "tommy hilfiger", "유니클로", "uniqlo",
      // Wave 803: Nike polo shirt wording is a garment type, not Polo Ralph Lauren.
      "나이키", "nike", "나이키 골프", "nike golf", "아디다스 골프", "adidas golf", "아디다스 스쿼드라", "squadra",
      "말본", "malbon", "마크앤로나", "마크앤 로나", "marklona", "mark & lona", "mark and lona",
      "dkny", "디케이엔와이", "무스너클", "moose knuckle", "라코스테", "lacoste",
      "헤지스", "hazzys", "빌보콰", "vilebrequin", "폴스미스", "paul smith",
      "세터", "setter", "렉토", "recto", "캐피탈", "kapital", "마뗑킴", "matin kim", "matinkim",
      "마크 제이콥스", "marc jacobs", "베이프", "bape", "스투시", "stussy",
      // Wave 251.1 (2026-05-19): 사용자 코멘트 (id 195, 196) — "내셔널지오그래픽 반팔 피케 폴로 셔츠" 16k 가 polo-pique-classic 비교군에 섞임.
      //   National Geographic 은 폴로 카라티 자체 라인이 있어 "폴로/pique" 둘 다 만족 → 폴로 SKU 차단 필요.
      "내셔널지오그래픽", "내셔널 지오그래픽", "national geographic", "natgeo", "nat geo",
      // Wave 570 (2026-05-22): production audit — "펜디 로고 피케 폴로 카라 티셔츠" 75만 매물이 polo_pique 비교군 오염.
      //   "피케 폴로" 키워드만으로 catch (펜디는 다른 명품 brand).
      "fendi", "펜디",
      // 다른 명품 brand polo (디올/구찌/프라다 폴로 등도 별도 시세군)
      "dior", "디올", "gucci", "구찌", "prada", "프라다", "burberry", "버버리",
      "hermes", "에르메스", "louis vuitton", "루이비통",
      // Wave 658 (2026-05-22): c_grade spread 6.9x audit (6건) — 빅포니 한정 차단.
      // 일반 polo_pique 45~60k 정상, 빅포니 성조기/USA/벤쿠버 110~145k outlier.
      "빅포니 성조기", "빅포니성조기", "성조기 빅포니", "big pony usa flag",
      "usa 빅포니", "usa빅포니", "미국 빅포니", "미국빅포니", "usa big pony",
      "벤쿠버 한정", "vancouver limited", "벤쿠버한정",
      "희귀 빅포니", "희귀빅포니", "rare big pony",
      // 미국/USA 한정 컬렉션 + 도시 한정 패턴
      "성조기 pk", "성조기pk", "성조기 카라", "성조기카라",
      "올림픽 한정", "team usa", "팀 usa",
      // Wave 763 (2026-05-27): 사용자 발견 audit — 골프 brand + 한국 디자이너 false-positive 흡수.
      //   pid 9000000112031 "ST. ANDREWS 카라티" / 9002662730817 "듀빅 골프 여성 폴로티"
      //   9001826082393 "thisisneverthat 니트 폴로" / 9003810836611 "풋조이 골프 반팔"
      "st andrews", "스트앤드류스", "스트 앤드류스", "세인트 앤드류스", "세인트앤드류스",
      "duvic", "듀빅",
      "thisisneverthat", "this is never that", "tnt",
      "footjoy", "foot joy", "풋조이",
      "j.lindeberg", "j lindeberg", "lindeberg", "제이린드버그", "린드버그",
      "pottery", "포터리",
      "blankroom", "blank room", "블랭크룸",
      "lohnt",
      "mont-bell", "mont bell", "montbell", "몽벨",
      "pearly gates", "파리게이츠", "펄리게이츠",
      // Wave 671 (2026-05-22): RLX 골프 라인 차단 (별도 시세).
      // pid 408213485 "랄프로렌 RLX 반팔카라티" 28k score 56 — RLX는 골프 라인 (별도 SKU 필요).
      "rlx", "rlx 골프", "rlx golf", "rlx 카라", "rlx 반팔",
      "랄프로렌 rlx", "polo rlx", "rlx polo",
      // Wave 715 P2 (2026-05-23): vintage narrow 분리 → broad에서 명확 차단.
      "빈티지", "vintage", "y2k", "올드", "archive", "아카이브",
      "90년대", "00년대", "90's", "00s",
      "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
    ],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "polo_shirt", // Wave 236d — Polo Pique = polo shirt 라인 확정.
  },
  {
    id: "clothing-polo-pony-tee",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_pony_tee",
    modelName: "Polo Pony Logo T-Shirt",
    aliases: ["Polo Pony Tee", "폴로 포니 티셔츠", "Ralph Lauren T-Shirt"],
    // Wave 223 (2026-05-19): "타이틀리스트 골프 폴로티" 매물 잘못 매칭 → mustNotContain 강화.
    //   polo SKU 가 다른 brand 의 "폴로" 단어 매물에 매칭됨. brand 한정 필요.
    // Wave 737 leak fix: group 0 "폴로 랄프로렌" compound → 분리. 한국 셀러 "폴로" 단독 표기 많음.
    //   pony_tee + tee bucket 726건 unmatched. mustNotContain 이미 비폴로 brand 다 차단.
    mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌", "랄프 로렌"], ["반팔", "티셔츠", "tee ", "t-shirt", "t셔츠", "크루넥"]],
    mustNotContain: ["RRL", "purple label", "퍼플라벨", "polo bear", "베어", "피케", "pique", "pk ", "pk티", "pk 티", "pk반팔", "pk 반팔", "긴팔", "롱슬리브", "키즈", "kids", "토들러", "보이즈", "boys", "걸즈", "girls", "주니어", "youth",
      // Wave 812: BAPE shark/polo wording polluted Polo Pony Tee sample groups.
      "bape", "베이프", "a bathing ape", "샤크", "shark",
      // Wave 223: 다른 brand 의 "폴로/Polo" 단어 매물 차단.
      "타이틀리스트", "titleist", "캘러웨이", "callaway", "푸마 폴로", "puma polo",
      "골프 폴로", "골프폴로", "골프티", "골프 티",
      // Wave 802: generic/sub-brand "polo shirt" wording must not imply Polo Ralph Lauren.
      "z pattern", "z패턴", "zpattern", "cos", "코스", "솔리드옴므", "솔리드 옴므", "solid homme",
      "더 니트 컴퍼니", "the knit company", "인더로우", "in the row",
      "라벨 아카이브", "label archive", "브룩스브라더스", "brooks brothers",
      "챕스", "chaps",
      "빈폴", "beanpole", "시스템", "system", "타임", "time", "에피그램", "epigram",
      "코오롱스포츠", "kolon sport", "kolon", "k2", "아미", "ami",
      "스튜디오 톰보이", "톰보이", "studio tomboy", "tomboy",
      "잭니클라우스", "jack nicklaus", "유타", "utar",
      "dancing skeletons", "dancing skeleton",
      "나이키", "nike",
      // Wave 763 (2026-05-27): polo_pique_classic 동일 — false-positive brand 차단 (audit).
      "st andrews", "스트앤드류스", "세인트 앤드류스", "세인트앤드류스",
      "duvic", "듀빅",
      "thisisneverthat", "this is never that", "tnt",
      "footjoy", "foot joy", "풋조이",
      "j.lindeberg", "j lindeberg", "lindeberg", "제이린드버그", "린드버그",
      "pottery", "포터리",
      "blankroom", "blank room", "블랭크룸",
      "lohnt",
      "mont-bell", "mont bell", "montbell", "몽벨",
      "pearly gates", "파리게이츠", "펄리게이츠",
      // Wave 236f (2026-05-19): audit 발견 — polo 카라티 (polo_shirt) 매물 차단.
      //   Polo Pony Tee = 라운드넥 tee + 포니 로고. 카라티 별도 SKU (Polo Pique Classic).
      "카라티", "카라 티", "카라넥", "collar tee", "단추", "카라 셔츠",
      // Wave 492: description mentions of styling tops should not promote shorts/pants/sweats into tee.
      "쇼츠", "shorts", "반바지", "팬츠", "pants", "바지", "치노", "맨투맨", "스웻", "스웨트", "후드", "hoodie"],
    msrpKrw: 89000, released: 2020,
    defaultProductType: "tee", // Wave 236d — Polo Pony Tee = tee 라인 확정 (라운드넥).
  },
  {
    id: "clothing-polo-oxford-shirt",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_oxford_shirt",
    modelName: "Polo Oxford Shirt (Standard)",
    aliases: ["Polo Oxford", "폴로 옥스포드", "Ralph Lauren Oxford"],
    mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌"], ["옥스포드", "oxford"]],
    // RRL 옥스포드는 별도 SKU (가격 5배)
    mustNotContain: ["RRL", "더블 알엘", "double rl", "purple label", "퍼플라벨", "polo bear", "베어", "피케", "키즈", "kids", "보이즈", "boys", "주니어", "youth", "14~16", "14-16",
      "아미", "ami", "ami paris", "아미 파리스",
      "polo 진스 컴퍼니", "폴로 진스 컴퍼니", "polo jeans company", "폴로진스", "폴로(polo)진스", "polo)진스", "polo jeans", "폴로 진스",
      "rugby ralph lauren", "럭비 랄프로렌", "로렌 랄프로렌", "lauren ralph lauren",
      // Wave 593d: BEAMS 한정 collab + 90s 빈티지 outlier 차단.
      "빔즈", "beams", "x beams", "beams x", "리미티드", "limited edition", "한정판",
      "90s ", "90's", "90s 폴로", "vintage polo", "빈티지 폴로",
      // Wave 715 P2 (2026-05-23): vintage narrow SKU 신설 → broad에서 명확 차단.
      "빈티지", "vintage", "y2k", "올드", "archive", "아카이브",
      "90년대", "00년대", "00s",
      "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999",
    ],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "shirt", // Wave 236d — Oxford = 셔츠 라인.
  },
  {
    id: "clothing-polo-bear-collab",
    brand: "Polo Ralph Lauren", category: "clothing", laneKey: "polo_bear_collab",
    modelName: "Polo Bear Print (한정)",
    aliases: ["Polo Bear", "폴로 베어", "Polo Bear Tee"],
    mustContain: [["폴로", "polo", "ralph lauren"], ["베어", "bear"]],
    mustNotContain: ["RRL", "purple label", "키즈", "kids", "토들러", "스티커", "키링",
      // Wave 572 (2026-05-22): 빈티지 90s 폴로베어 (85만 outlier vs 일반 22~30만 +3배).
      "92년", "91년", "90년", "93년", "94년", "95년",
      "92년도", "91년도", "90년도", "93년도",
      "vintage 9", "빈티지 9", "ornament", "오너먼트",
      "이불", "침구", "퀸사이즈", "테디", "teddy",  // 폴로베어 인형/이불
      // Wave 580 (2026-05-22): 텀블러/머그/컵 등 잡화 (의류 아님).
      "텀블러", "tumbler", "머그", "mug", "컵\\b",
      "키체인", "키링", "키 링", "key chain",
      "스티커", "sticker", "패치", "patch",
      // Wave 682 (2026-05-22): spread 26x audit — 추가 product/한정 차단.
      // 의류 X (홈웨어/액세서리)
      "양말", "양말 세트", "socks", "양말세트",
      "파자마", "잠옷", "pajama", "pyjama",
      "타올", "수건", "towel", "잠옷 세트",
      "보이즈", "걸즈", "boys", "girls", "유아", "신생아",
      // 한정 시리즈 (top tier 30~53.5만)
      "패밀리 후디", "베어 패밀리", "polo bear family",
      "아이린 착용", "셀럽 착용",  // 셀럽 매물 (가격 +20%)
      // 가품 시그널 (큐알신형 = 가품 코드)
      "큐알 신형", "큐알신형", "qr 신형",
      // 빈티지 90s/Y2K (별도 시세 라인)
      "y2k 폴로", "y2k polo", "00s polo",
      "키치 테디", "키치 베어", "키치 곰돌이",
      // Wave 715 P2 (2026-05-23): polo_bear_vintage 신설 → 명확 차단.
      "빈티지", "vintage", "archive", "아카이브",
      "96년", "97년", "98년", "99년", "00년",
      "96년도", "97년도", "98년도", "99년도",
      "1990", "1991", "1992", "1993", "1994", "1995",
      // Wave 750 bias-free (2026-05-24): spread 8.4x audit — 한정/시그니처 collab 추가 차단.
      "수면", "수면 바지", "수면바지",  // 잠옷류
      "핸드타올", "손수건",  // 액세서리 (mustNotContain "타올"에 추가 보강)
      "스키 베어", "스키베어", "ski bear",  // 한정 시그니처
      "노르딕", "nordic", "노르딕 베어",  // vintage premium
      "베어포트", "bear sport", "베어 포트",  // premium line
      "쿠션", "cushion",  // 인테리어 잡화
      "골돌이", "곰동이",  // 곰돌이 typo
      "희귀상품", "rare", "희귀",  // 한정
      "헬멧", "tote bear",  // 추가
      // Wave 800 (2026-05-24) bias-free 의류 14 brand sweep Phase 1:
      // bait listing — 모든 collab token을 한꺼번에 박은 셀러 매물 (8K outlier).
      "stc 어항", "어항 진리", "버터플라이 베이비베어", "stc솜",
      "솜버터플라이", "베이비베어항구피클럽", "항구피클럽",
      // 양말 변형 (n켤레)
      "3켤레", "5켤레", "2켤레", "양말 3", "양말 5", "양말 2",
      // 의류 X (브랜드 그릇/접시/잡화)
      "그릇", "접시", "디쉬", "dish", "tray", "트레이",
    ],
    msrpKrw: 159000, released: 2020,
  },
  // Wave 218 (2026-05-19): clothing-polo-rrl narrow 분리.
  //   사용자 지적 — 한 SKU 에 티/팬츠/자켓/액세서리/스니커즈 6+ product type 묶임 → CV 1.56.
  //   product type 별 가격대 완전 다름 (티 60K vs 자켓 280K vs 스니커즈 200K).
  //   각 narrow lane 으로 시세 grouping 정확.
  //   broad clothing-polo-rrl 는 catch-all 로 유지 — narrow 매칭 안 되면 fallback.
  {
    id: "clothing-polo-rrl-tee",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_tee",
    modelName: "Polo RRL Tee / Sweat / Hoodie",
    aliases: ["RRL tee", "RRL 맨투맨", "RRL 후디", "더블알엘 티"],
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["티셔츠", "tee", "맨투맨", "sweat", "후디", "hoodie", "후드", "롱슬리브", "긴팔티", "반팔", "크루넥"]],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "스니커즈", "데님", "denim", "청바지",
      // Wave 491: waffle/knit henleys belong with the RRL knit lane, not tee/sweat.
      "니트", "knit", "와플", "waffle", "스웨터", "sweater", "스위터", "스웻터",
      "벨트", "지갑", "모자", "넥타이", "키링", "클러치", "목걸이",
      // Wave 684 (2026-05-22): spread 13x audit — 파카/자카드/셀럽/리페어 차단.
      "헨리넥", "henley",  // 헨리넥은 니트 라인 (knit lane)
      "마운틴 파카", "mountain parka", "파카", "parka", "후디드 파카",
      "자카드", "jacquard", "인디고 자카드",
      "류준열", "셀럽 착용", "셀럽 매물",
      "리페어", "repair", "가먼트 리페어", "garment repair",
      "와시드", "워시드", "washed", "washing",  // washed/distressed 빈티지 변형
    ],
    msrpKrw: 250000, released: 2020,
  },
  {
    id: "clothing-polo-rrl-denim",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_denim",
    modelName: "Polo RRL Denim (jeans / shirt)",
    aliases: ["RRL 데님", "RRL 청바지", "더블알엘 데님"],
    // Wave 245 (2026-05-19): RRL denim 모델명 보강 — production sample 에서 빈파포/파이브포켓/기빈스/미드랜드/에크루/에이버리/브룸필드/힐스뷰/슬림핏 청바지가 broad 로 잘못 매칭.
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["데님", "denim", "청바지", "셀비지", "jean",
      "빈파포", "파이브포켓", "파이브 포켓", "5포켓", "5 포켓",
      "기빈스", "미드랜드", "이스트웨스트", "이스트 웨스트", "에크루", "에이버리", "브룸필드", "힐스뷰",
      "벤튼", "클리어빌"]],
    // Wave 228 (2026-05-19): jacket/coat 차단 (jacket-coat lane 으로 가야).
    mustNotContain: ["키즈", "kids", "rrl 무드", "스니커즈", "벨트", "지갑", "모자",
      "그리즐리", "grizzly", "자켓", "jacket", "코트", "coat", "재킷", "트러커", "trucker",
      "필드팬츠", "필드 팬츠", "field pants", "field pant", "우븐 필드",
      // Wave 596b: 리미티드 빈티지 한정 라인 (900k outlier vs 일반 230~700k).
      "리미티드 빈티지", "limited vintage", "리미티드 라인",
      // Wave 637: 추가 한정 표기 (pid 402179391 '리미티드에디션 빈티지파이브포켓 올리브' 750k).
      "리미티드 에디션", "limited edition", "리미티드에디션", "limited-edition",
    ],
    msrpKrw: 420000, released: 2020,
    // Wave 408: terse "RRL 데님" rows are jeans by default; explicit 셔츠/쇼츠/pants
    // keywords still win in parseClothingProductType before catalog fallback.
    defaultProductType: "jeans",
  },
  // Wave 247.1 (2026-05-19): Polo RRL shirt-pants narrow 추가 split.
  //   기존 broad clothing-polo-rrl-shirt-pants 는 catch-all 로 유지 (additive only).
  //   production sample 74건 / CV 0.86 측정 (Wave 245 baseline) — shirt 49 / pants 20 / other 5.
  //   shirt median ₩340k (₩13k~215만), pants median ₩370k (₩14만~95만).
  //   narrow 별로 잡으면 시세 grouping 더 정확.
  //
  //   매칭 정책 (Wave 218/245 jacket-coat 패턴):
  //   - narrow shirt mustContain: SPECIFIC subtype 키워드만 (옥스포드/버튼다운/플란넬/샴브레이 등).
  //     일반적 "셔츠" 단독 매물은 catch-all 으로 가야 (ambiguity → null 매칭 회피).
  //   - narrow pants mustContain: SPECIFIC subtype 키워드만 (치노/슬랙스/오피서/카키/조드퍼 등).
  //     일반적 "팬츠" 단독 매물은 catch-all 으로 가야.
  //   - catch-all (broad shirt-pants) mustNotContain: narrow 의 specific 키워드 차단 → narrow lane 우선.
  // Wave 250 (2026-05-19): RRL leather/suede shirt narrow 신설 — production sample 4건 (1.2~2.15M).
  //   broad shirt-pants 의 outlier 매물 (러프아웃 스웨이드 셔츠/오버셔츠/워크 오버 셔츠).
  //   가격이 일반 shirt narrow (p50 ~280k) 의 8x — CV 왜곡 주범.
  {
    id: "clothing-polo-rrl-shirt-leather-suede",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_shirt_leather_suede",
    modelName: "Polo RRL Leather / Suede Shirt (러프아웃/스웨이드 셔츠)",
    aliases: ["RRL 러프아웃 셔츠", "RRL 스웨이드 셔츠", "RRL 가죽 셔츠"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["러프아웃", "러프 아웃", "roughout", "rough out", "스웨이드", "suede", "레더", "leather", "가죽", "염소가죽"],
      ["셔츠", "shirt", "오버셔츠", "오버 셔츠", "워크셔츠", "워크 셔츠", "웨스턴", "western"],
    ],
    // Wave 250.5 (2026-05-19): "rrl스타일" / "rrl무드" 공백 없는 변형 추가 차단 (정품 RRL 아닌 imitation 매물).
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "rrl스타일", "rrl무드",
      // 자켓/코트/팬츠 차단 — leather-suede-jacket lane 으로 가야.
      "자켓", "jacket", "코트", "coat", "재킷", "블레이저", "blazer", "점퍼", "트러커", "trucker",
      "팬츠", "pants", "바지", "치노"],
    msrpKrw: 1800000, released: 2020,
    defaultProductType: "shirt",
  },
  {
    id: "clothing-polo-rrl-shirt",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_shirt",
    modelName: "Polo RRL Shirt (옥스포드/버튼다운/플란넬/샴브레이)",
    aliases: ["RRL 옥스포드", "RRL 체크셔츠", "RRL 플란넬", "더블알엘 옥스포드"],
    // SPECIFIC subtype 키워드만 — "셔츠" 단독은 catch-all 로.
    // Wave 250 (2026-05-19): "오버셔츠"/"오버 셔츠"/"웨스턴" 추가 — broad 의 워크 오버 셔츠 매물 narrow 우선.
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["oxford", "옥스포드", "버튼다운", "버튼 다운", "체크셔츠", "체크 셔츠", "샴브레이", "chambray", "워크셔츠", "워크 셔츠", "오버셔츠", "오버 셔츠", "웨스턴", "western", "린넨 셔츠", "린넨셔츠", "헨리 셔츠", "henley", "헨리넥", "플란넬", "flannel", "남방", "다이아 체크", "윈드페인"]],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "스니커즈",
      "리바이스", "levis", "levi's", "lvc", "rugby", "러그비",
      "h bar c", "hbarc", "h-bar-c", "에이치바씨", "에이치 바 씨",
      // shirt 외 product-type 차단
      "팬츠", "pants", "바지", "치노", "chino", "슬랙스", "트라우저", "trouser", "카펜터", "carpenter", "카고", "cargo", "오피서", "officer", "jodhpur", "조드퍼",
      "자켓", "jacket", "코트", "coat", "재킷", "블레이저", "blazer", "점퍼", "봄버", "bomber", "트러커", "trucker", "카코트", "피코트", "덱자켓", "초어", "chore",
      "데님", "denim", "청바지", "셀비지", "진\\b", "jean",
      "티셔츠", "tee", "맨투맨", "후디", "hoodie", "후드", "롱슬리브", "긴팔티", "반팔",
      "니트", "knit", "카디건", "cardigan", "스웨터", "sweater",
      // Wave 489: leather/suede shirts are a separate high-value lane.
      "러프아웃", "러프 아웃", "roughout", "rough out", "스웨이드", "suede", "레더", "leather", "가죽", "염소가죽",
      "벨트", "지갑", "wallet", "월렛", "모자", "캡\\b", "넥타이", "키링",
      "목걸이", "925", "팔찌", "bracelet", "반지",
      // denim 모델명 (denim lane 으로)
      "빈파포", "파이브포켓", "파이브 포켓", "5포켓", "기빈스", "미드랜드", "이스트웨스트", "에이버리", "브룸필드", "힐스뷰", "벤튼", "클리어빌",
      // Wave 800 (2026-05-24) Phase 3: 40x — Robe/Western Robe (1.5M outlier).
      "로브", "robe", "웨스턴 로브", "western robe",
    ],
    msrpKrw: 290000, released: 2020,
    defaultProductType: "shirt", // Wave 236d — RRL 옥스포드/체크/버튼다운 = shirt 라인.
  },
  {
    id: "clothing-polo-rrl-pants",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_pants",
    modelName: "Polo RRL Pants (치노/슬랙스/오피서/카키/조드퍼)",
    aliases: ["RRL 치노", "RRL 슬랙스", "RRL 카키", "RRL 조드퍼", "더블알엘 치노"],
    // SPECIFIC subtype 키워드만 — "팬츠" 단독은 catch-all 로.
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["치노", "chino", "슬랙스", "오피서 팬츠", "오피서팬츠", "officer pant", "jodhpur", "조드퍼", "조파", "트라우저", "trouser", "카펜터", "carpenter", "카고 팬츠", "cargo pant", "카키 팬츠", "카키팬츠", "필드 치노", "필드치노", "헤링본 팬츠", "헤링본팬츠"]],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "스니커즈",
      "리바이스", "levis", "levi's", "lvc", "rugby", "러그비",
      // pants 외 product-type 차단
      "셔츠", "shirt", "남방", "oxford", "옥스포드", "버튼다운", "체크셔츠", "체크 셔츠", "샴브레이", "chambray", "워크셔츠", "워크 셔츠", "린넨 셔츠", "린넨셔츠", "플란넬", "flannel",
      "자켓", "jacket", "코트", "coat", "재킷", "블레이저", "blazer", "점퍼", "봄버", "bomber", "트러커", "trucker", "카코트", "피코트", "덱자켓", "초어", "chore",
      "데님", "denim", "청바지", "셀비지", "진\\b", "jean",
      "티셔츠", "tee", "맨투맨", "후디", "hoodie", "후드", "롱슬리브", "긴팔티", "반팔",
      "니트", "knit", "카디건", "cardigan", "스웨터", "sweater",
      "벨트", "지갑", "wallet", "월렛", "모자", "캡\\b", "넥타이", "키링",
      "목걸이", "925", "팔찌", "bracelet", "반지",
      // Limited/special RRL pants price far above general chino/pants lane.
      "리미티드 에디션", "limited edition", "리미티드에디션", "limited-edition",
      // denim 모델명 (denim lane 으로)
      "빈파포", "파이브포켓", "파이브 포켓", "5포켓", "기빈스", "미드랜드", "이스트웨스트", "에이버리", "브룸필드", "힐스뷰", "벤튼", "클리어빌"],
    msrpKrw: 380000, released: 2020,
    defaultProductType: "pants", // Wave 236d — RRL 치노/슬랙스 = pants 라인.
  },
  {
    id: "clothing-polo-rrl-shirt-pants",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_shirt_pants",
    modelName: "Polo RRL Shirt / Pants (코튼/코듀로이/워크 — catch-all)",
    aliases: ["RRL 셔츠팬츠", "RRL 코듀로이", "RRL 워크팬츠"],
    // Wave 245 (2026-05-19): production sample 에서 오피서치노/필드치노/카고/트라우저/카펜터/슬림핏/스트레이트핏 매물이 broad 로 잘못 매칭.
    // Wave 247.1 (2026-05-19): shirt / pants narrow 신설 후 catch-all (코듀로이/워크 등 모호한 product-type 매물만).
    //   narrow 의 specific 키워드 (옥스포드/치노/슬랙스 등) 는 mustNotContain 로 차단 → narrow lane 우선.
    //   일반적 "셔츠" / "팬츠" / "shirt" / "pants" 단독 매물은 catch-all 에서 매칭.
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["셔츠", "shirt", "코듀로이", "corduroy", "워크팬츠", "워크 팬츠", "코튼", "린넨", "퀄팅", "져지", "체크", "팬츠", "pants", "바지", "쇼츠", "하프팬츠",
      "슬림핏", "slim fit", "스트레이트핏", "straight fit", "스트레이트 핏"]],
    mustNotContain: ["키즈", "kids", "rrl 무드", "스니커즈", "데님", "denim", "청바지", "셀비지",
      "자켓", "jacket", "코트", "coat", "덱자켓",
      "월렛", "wallet", "지갑",
      "목걸이", "925", "은목걸이", "실버", "silver",
      // Wave 245: denim 모델명 차단 (denim lane 으로 가야)
      "빈파포", "파이브포켓", "파이브 포켓", "5포켓", "기빈스", "미드랜드", "이스트웨스트", "에이버리", "브룸필드", "힐스뷰", "벤튼", "클리어빌",
      // 데님 진 자체 차단
      "진\\b", "jean",
      // Wave 247.1: shirt narrow 키워드 차단 (narrow shirt lane 우선)
      "oxford", "옥스포드", "버튼다운", "버튼 다운", "체크셔츠", "체크 셔츠", "샴브레이", "chambray", "워크셔츠", "워크 셔츠", "린넨 셔츠", "린넨셔츠", "헨리 셔츠", "henley", "헨리넥", "플란넬", "flannel", "남방", "다이아 체크", "윈드페인",
      // Wave 247.1: pants narrow 키워드 차단 (narrow pants lane 우선)
      "치노", "chino", "슬랙스", "오피서", "officer", "jodhpur", "조드퍼", "조파", "트라우저", "trouser", "카펜터", "carpenter", "카고", "cargo", "카키 팬츠", "카키팬츠", "헤링본 팬츠", "헤링본팬츠",
      // Wave 250 (2026-05-19): leather/suede shirt narrow 키워드 차단 (CV 0.85 outlier 매물).
      //   러프아웃/스웨이드/가죽 셔츠는 별도 narrow lane 으로 가야 (avg ~1.8M, 일반 셔츠 ~280k 의 8x).
      //   "오버셔츠"/"웨스턴" 도 narrow shirt 추가 — broad catch 차단.
      "러프아웃", "러프 아웃", "roughout", "rough out", "스웨이드", "suede", "염소가죽",
      "오버셔츠", "오버 셔츠", "웨스턴", "western",
      // Wave 250: 워크팬츠/필드팬츠/플리츠 코듀로이/퍼티그 추가 (pants narrow 우선).
      "워크팬츠", "워크 팬츠", "필드 팬츠", "필드팬츠", "플리츠 코듀로이", "플리츠 코듀로이 팬츠", "퍼티그", "fatigue",
      // Wave 250: 블레이저 (jacket 라인이지만 broad shirt-pants 차단 안 됐던 점) — jacket-coat narrow 로 가야.
      "블레이저", "blazer",
      // Wave 250: 카디건/스웨터 — knit 라인 (narrow polo-rrl-knit 으로 가야).
      "카디건", "cardigan", "스웨터", "sweater"],
    msrpKrw: 350000, released: 2020,
  },
  {
    id: "clothing-polo-rrl-accessory",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_accessory",
    modelName: "Polo RRL Accessory (벨트/지갑/모자/넥타이)",
    aliases: ["RRL 액세서리", "RRL 벨트", "RRL 지갑"],
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["벨트", "belt", "지갑", "wallet", "월렛", "모자", "캡", "cap", "볼캡", "넥타이", "tie", "키링", "키 링", "클러치", "clutch", "장지갑", "뉴스보이", "쉴드", "방패", "더스트", "콘초"]],
    // Wave 228: 팬츠/자켓/코트 차단 (shirt-pants / jacket-coat lane 으로 가야).
    mustNotContain: ["키즈", "kids", "rrl 무드", "스니커즈", "목걸이", "925",
      "팬츠", "pants", "바지", "하프팬츠", "쇼츠",
      "자켓", "jacket", "코트", "coat", "재킷",
      // Wave 691 (2026-05-22): 한정/이그조틱 차단 (spread 33x).
      "리미티드", "limited", "limited edition", "한정", "스페셜 에디션",
      "슈퍼레어", "super rare", "super-rare", "레어", "rare",
      "다크호스", "dark horse", "darkhorse",
      "롱혼 버팔로", "롱혼버팔로", "longhorn buffalo",
      "카이만 크로커다일", "caiman crocodile", "악어 가죽", "alligator", "엘리게이터",
      "라스코", "rasko", "라스코벨트",
      "셀럽 착용", "지디 착용",
      // 카디건/가디건 (apparel — accessory 아님)
      "카디건", "cardigan", "가디건", "숄카라가디건",
    ],
    msrpKrw: 220000, released: 2020,
  },
  {
    id: "shoe-polo-rrl-sneaker",
    brand: "RRL", category: "shoe", laneKey: "polo_rrl_sneaker",
    modelName: "Polo RRL Sneaker (캔버스/메이포트/인디고)",
    aliases: ["RRL 스니커즈", "RRL Sneaker", "더블알엘 스니커즈"],
    mustContain: [["RRL", "rrl", "rrl러프아웃", "더블 알엘", "double rl", "더블알엘"], ["스니커즈", "sneaker", "메이포트", "캔버스", "canvas", "러프아웃"]],
    mustNotContain: ["키즈", "kids", "rrl 무드"],
    msrpKrw: 280000, released: 2020,
  },
  // Wave 250 (2026-05-19): RRL knit narrow 신설 — production sample 11건.
  //   카디건/스웨터/니트 후디/와플 니트/터틀넥 등. price range 63k~2.24M (CV 광범위).
  //   broad RRL 에서 니트 차단 (mustNotContain 에 이미 있음) → null 매칭 → 사용자 풀 진입 X.
  //   별도 narrow lane 으로 매칭 가능하게.
  {
    id: "clothing-polo-rrl-knit",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_knit",
    modelName: "Polo RRL Knit (카디건/스웨터/니트)",
    aliases: ["RRL 카디건", "RRL 스웨터", "RRL 니트", "더블알엘 카디건"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["카디건", "cardigan", "스웨터", "sweater", "니트", "knit", "터틀넥", "turtle neck", "터틀 넥", "와플", "waffle", "헨리 니트", "풀오버", "pullover"],
    ],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이",
      // 스웨터 재킷 = jacket-coat lane 으로 가야.
      "스웨터 재킷", "스웨터재킷", "스웨터 자켓", "스웨터자켓"],
    msrpKrw: 500000, minPriceKrw: 80000, released: 2020,  // Wave 768: RRL knit 가품 floor
    defaultProductType: "knit",
  },
  // Wave 245 (2026-05-19): RRL jacket-coat narrow 신설 — production sample 47건 (broad 42%) 측정.
  //   median 150만, p25/p75 = 82만/264만 (가죽/스웨이드/봄버/피코트/트러커/카코트/덱자켓 등 다양).
  //   broad RRL 에서 자켓이 가장 많은 mismatch → 별도 lane 필수.
  // Wave 250 (2026-05-19): production CV 0.78 (n=41) — leather/suede cluster (avg 2.46M, n=15)
  //   가 canvas/denim/coat (avg 700~840k) 와 가격 3x 차이. 별도 narrow lane 분리.
  //   leather/suede 매물은 새 narrow `clothing-polo-rrl-jacket-leather-suede` 로 캐치.
  //   기존 jacket-coat narrow 는 leather/suede 키워드 차단 (canvas/denim/coat catch-all).
  {
    id: "clothing-polo-rrl-jacket-leather-suede",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_jacket_leather_suede",
    modelName: "Polo RRL Leather / Suede Jacket (러프아웃/시얼링/뉴스보이/G-1/모토)",
    aliases: ["RRL 가죽자켓", "RRL 레더 재킷", "RRL 스웨이드 자켓", "RRL 러프아웃", "RRL 뉴스보이", "RRL 시얼링", "RRL G-1"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["레더", "leather", "가죽", "스웨이드", "suede", "러프아웃", "러프 아웃", "roughout", "rough out", "시얼링", "shearling", "뉴스보이", "newsboy", "모토", "moto", "G-1", "g1", "g 1", "플라이트", "flight", "MA-1", "ma-1", "ma1", "항공 점퍼", "항공점퍼", "나바호 자켓", "버팔로 레더", "buffalo leather"],
    ],
    // 키즈/액세서리/구두/벨트/지갑/주얼리 차단. canvas/denim 만 들어가는 매물 차단 (가죽 키워드 동반 필수).
    // Wave 250.5 (2026-05-19): production sample 검증 후 발견된 catalog gap fix.
    //   1. 블레이저 (헤링본 블레이저 자켓 류준열 RRL 가죽 뉴스보이 — pid 406756050 ₩180k) → jacket-coat narrow 로 가야.
    //      jacket-coat 는 블레이저 mustContain 보유. leather-suede 가 가죽 + 뉴스보이 키워드만으로 catch 했음.
    //   2. "rrl스타일" (공백 없음 변형 — rrl스타일 가죽자켓 3xl, pid 404563540 ₩220k) — 정품 RRL 아닌 imitation 매물.
    //      기존 "rrl 무드" / "rrl 스타일" 은 공백 동반 패턴만 잡음. normalize 가 한글 token 보존 → no-space 변형 통과.
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "rrl스타일", "rrl무드",
      // Wave 250.5: 블레이저는 jacket-coat narrow 로 routing.
      "블레이저", "blazer",
      // Wave 490: Grizzly has its own repeatable jacket lane.
      "그리즐리", "grizzly",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이"],
    msrpKrw: 3000000, minPriceKrw: 300000, released: 2020,  // Wave 768: RRL leather jacket premium floor
  },
  {
    id: "clothing-polo-rrl-browns-beach-jacket",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_browns_beach_jacket",
    modelName: "Polo RRL Brown's Beach / Browns Beach Jacket",
    aliases: ["RRL Brown's Beach Jacket", "RRL 브라운스비치 자켓", "더블알엘 브라운스비치"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["브라운스비치", "브라운스 비치", "brown's beach", "browns beach", "brownsbeach"],
      ["자켓", "jacket", "재킷", "블레이저", "blazer"],
    ],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "rrl스타일", "rrl무드",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이"],
    msrpKrw: 650000, released: 2010,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-polo-rrl-denim-jacket",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_denim_jacket",
    modelName: "Polo RRL Denim Jacket / Trucker",
    aliases: ["RRL Denim Jacket", "RRL 데님 자켓", "더블알엘 데님 트러커"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["데님", "denim", "lot271", "lot 271", "웨스트뷰", "westview", "인디고"],
      ["자켓", "jacket", "재킷", "트러커", "trucker", "필드재킷", "필드 자켓", "field jacket"],
    ],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "rrl스타일", "rrl무드",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이",
      "그리즐리", "grizzly", "브라운스비치", "브라운스 비치", "brown's beach", "browns beach",
      "레더", "leather", "가죽", "스웨이드", "suede", "러프아웃", "러프 아웃", "roughout", "rough out"],
    msrpKrw: 950000, released: 2020,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-polo-rrl-grizzly-jacket",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_grizzly_jacket",
    modelName: "Polo RRL Grizzly Jacket",
    aliases: ["RRL Grizzly Jacket", "RRL 그리즐리 자켓", "더블알엘 그리즐리"],
    mustContain: [
      ["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"],
      ["그리즐리", "grizzly"],
      ["자켓", "jacket", "재킷"],
    ],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일", "rrl스타일", "rrl무드",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이"],
    msrpKrw: 1450000, minPriceKrw: 200000, released: 2020,  // Wave 768: RRL grizzly premium floor
    defaultProductType: "jacket",
  },
  {
    id: "clothing-polo-rrl-jacket-coat",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_jacket_coat",
    modelName: "Polo RRL Jacket / Coat (캔버스/데님/카코트/필드)",
    aliases: ["RRL 자켓", "RRL 재킷", "RRL 코트", "더블알엘 자켓"],
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"], ["자켓", "jacket", "코트", "coat", "재킷", "블레이저", "blazer", "점퍼", "봄버", "bomber", "트러커", "trucker", "카코트", "car coat", "피코트", "pea coat", "필드자켓", "field jacket", "스포츠 자켓", "스포츠자켓", "덱자켓", "초어", "chore", "그리즐리", "grizzly"]],
    mustNotContain: ["키즈", "kids", "rrl 무드", "rrl 스타일",
      "스니커즈", "벨트", "지갑", "모자", "키링", "팔찌", "반지", "목걸이",
      "넥타이", "보타이", "리넨 타이", " 타이", "tie\\b", "머플러", "스카프",
      // Wave 250: leather/suede 키워드 차단 (leather-suede narrow 로 가야).
      "레더", "leather", "가죽", "스웨이드", "suede", "러프아웃", "러프 아웃", "roughout", "rough out",
      "시얼링", "shearling", "뉴스보이", "newsboy", "모토 재킷", "모토재킷", "moto",
      "G-1", "g1", "g 1", "플라이트", "flight", "MA-1", "ma-1", "ma1",
      "항공 점퍼", "항공점퍼", "나바호 자켓", "버팔로 레더", "buffalo leather",
      // Wave 430: high-repeat RRL jacket sub-lines get separate comparable groups.
      "브라운스비치", "브라운스 비치", "brown's beach", "browns beach", "brownsbeach",
      "데님", "denim", "인디고", "셀비지", "selvedge",
      "lot271", "lot 271", "웨스트뷰", "웨스트 뷰", "westview",
      "그리즐리", "grizzly",
      // Wave 593: production sample audit — RRL 한정 라인 + 혼합 브랜드 광고 차단.
      // "리미티드 카우보이" 2.66M outlier 매물 (한정 라인 가격대 분리).
      // "HOUSTON" 일본 빈티지 브랜드 (RRL 아님) — RRL 키워드 같이 박는 광고 패턴.
      "리미티드 카우보이", "limited cowboy",
      "휴스턴 체인스티치", "휴스턴 드리즐러", "houston chainstitch", "houston drizzler",
      // Wave 595: '&' punctuation은 normalize 시 공백으로 변환됨 → 'rrl&' false positive.
      // 대신 brand-mix 표기 'lvc'/'리바이스 빈티지 클로딩' 명시 차단.
      "lvc ", " lvc", "리바이스 빈티지 클로딩", "levis vintage clothing", "levi's vintage clothing",
      // Wave 716 (2026-05-23): 75x spread audit — work_chore/wool_mackinaw narrow 분리.
      "워크", "워크자켓", "초어", "초어자켓", "chore", "chore jacket", "work jacket",
      "wool mackinaw", "맥키노", "wool 자켓",
      "트러커", "trucker", "denim jacket",  // trucker는 별도 SKU (Polo RRL Denim Jacket)
      // Wave 800 (2026-05-24) Pareto 의류 14 brand sweep Phase 1: 124x spread 추가 차단.
      // 셀럽 매물 / 전세계 1개 unique / 모터사이클 라이더 라인.
      "류준열 착용", "류준열착용", "정해인 착용", "공유 착용", "박서준 착용",
      "전세계 1개", "전세계1개", "world's only", "unique piece", "1 of 1",
      "원피스 한정", "single piece", "유일",
      "오웬스 자켓", "rick owens",
      // 라이더 자켓 / 모터사이클 라인 (별도 시세군 ~3M)
      "라이더 자켓", "라이더자켓", "rider jacket",
      "모터사이클 자켓", "모터사이클자켓", "motorcycle jacket",
      "웨스턴 자켓", "western jacket", "카우보이 자켓",
      // RRL 한정 sweater 재킷
      "제프렌-m", "제프렌m", "jeffren", "스웨터 재킷",
    ],
    msrpKrw: 1500000, released: 2020,
    // jacket + coat 둘 다 가능. defaultProductType 안 박음 — text 추출 의존 (regex 가 jacket/coat 구분).
  },
  {
    id: "clothing-polo-rrl",
    brand: "RRL", category: "clothing", laneKey: "polo_rrl_broad",
    modelName: "Polo RRL Double RL (broad)",
    aliases: ["RRL", "Double RL", "더블 알엘"],
    // Wave 218: narrow lane 5개로 분리 후 broad 는 catch-all 만.
    // mustNotContain 으로 narrow 매칭되는 키워드 다 제외 → fallback only.
    mustContain: [["RRL", "rrl", "더블 알엘", "double rl", "더블알엘"]],
    mustNotContain: [
      "키즈", "kids", "rrl 무드", "rrl 스타일",
      // narrow lane 키워드 다 제외 (이미 그쪽으로 매칭됐어야)
      "티셔츠", "tee", "맨투맨", "후디", "후드", "롱슬리브", "헨리넥", "긴팔티", "반팔",
      "데님", "denim", "청바지", "셀비지",
      "셔츠", "shirt", "코듀로이", "워크팬츠", "코튼", "린넨",
      "벨트", "지갑", "모자", "캡", "cap", "넥타이", "키링", "클러치", "장지갑",
      "스니커즈", "sneaker",
      "목걸이", "925",
      // Wave 237 (2026-05-19): production sample audit 발견 — 주얼리 매물 차단 강화.
      //   "RRL 나바호 빈티지 팔찌" 320k 매물 잘못 매칭 (의류 SKU 인데).
      "팔찌", "bracelet", "반지", "ring\\b", "귀걸이", "earring",
      "주얼리", "jewelry", "터콰이즈", "turquoise", "네이티브 어메리칸", "native american",
      "나바호 팔찌", "나바호 반지", "나바호 액세서리", "커프", "cuff", "버클\\b",
      // Wave 245 (2026-05-19): production sample 측정 결과 broad 의 42% (47건) 가 자켓 → narrow 신설 후 broad 차단.
      //   denim 모델명 (빈파포/파이브포켓/기빈스/미드랜드 등) 도 narrow denim lane 으로 가도록 차단.
      //   shirt-pants 모델명 (오피서/필드치노/카고/트라우저/카펜터/슬림핏/스트레이트핏) 도 차단.
      "자켓", "jacket", "코트", "coat", "재킷", "블레이저", "blazer", "점퍼", "봄버", "bomber", "트러커", "trucker",
      "카코트", "car coat", "피코트", "pea coat", "필드자켓", "field jacket", "덱자켓", "초어", "chore",
      "빈파포", "파이브포켓", "파이브 포켓", "5포켓", "기빈스", "미드랜드", "이스트웨스트", "에이버리", "브룸필드", "힐스뷰", "벤튼", "클리어빌", "그리즐리",
      "치노", "chino", "오피서", "필드 치노", "필드치노", "카고", "cargo", "트라우저", "trouser", "카펜터", "carpenter",
      "슬림핏", "slim fit", "스트레이트핏", "straight fit", "스트레이트 핏", "헤링본",
      "진\\b", "jean",
      // knit 도 광범위하게 mustContain 키워드 미박혔지만 broad 에서 차단 (필요 시 추후 narrow lane 신설).
      "니트", "knit", "카디건", "cardigan", "스웨터", "sweater", "풀오버",
      // Wave 247.1 (2026-05-19): shirt / pants narrow specific 키워드 추가 차단.
      //   broad RRL 가 narrow 키워드 매물 잡으면 narrow + broad 충돌 → null 매칭.
      "슬랙스", "jodhpur", "조드퍼", "조파", "카키 팬츠", "카키팬츠",
      "oxford", "옥스포드", "버튼다운", "버튼 다운", "체크셔츠", "체크 셔츠", "샴브레이", "chambray",
      "워크셔츠", "워크 셔츠", "린넨 셔츠", "린넨셔츠", "헨리 셔츠", "henley", "플란넬", "flannel",
      "남방", "다이아 체크", "윈드페인",
      // Wave 800 (2026-05-24) Phase 3: 70x — 가방/액세서리 broad fallback 차단.
      // RRL 시그니처 가방: Overnight bag / Briefcase (의류 SKU 와 시세군 다름)
      "오버나이트백", "오버나이트 백", "overnight bag", "overnight",
      "브리프케이스", "브리프 케이스", "briefcase",
      "rrl 가방", "rrl bag",
      // RRL 무스탕 / 시어링 (premium 라인)
      "무스탕", "시어링", "mustang",
      // RRL 가방류 추가
      "토트", "더플", "duffle", "메신저",
    ],
    msrpKrw: 350000, released: 2020,
  },
  // The North Face:
  {
    id: "clothing-tnf-nuptse-1996",
    brand: "The North Face", category: "clothing", laneKey: "tnf_nuptse_1996",
    modelName: "TNF 1996 Retro Nuptse",
    aliases: ["1996 Nuptse", "1996 눕시", "노스페이스 눕시"],
    mustContain: [["노스페이스", "north face", "tnf"], ["1996"]],
    // collab은 별도 SKU
    // Wave 248 (2026-05-19): 사용자 코멘트 id 192~194 mismatch fix.
    //   - 쇼츠/반바지 (pid 331382713 "빔즈 노스페이스 눕시 쇼츠" 89k) — 다운자켓 아닌 반바지 variant
    //   - 베스트/조끼 (pid 318635782 "노벨티 눕시 다운 베스트" 105k) — 베스트 variant
    //   - 1994/1992/1990/에코 (pid 395757345 "1994 눕시" 130k, 에코눕시 등) — 다른 에디션
    mustNotContain: [
      "supreme", "슈프림", "gucci", "구찌", "mm6", "마르지엘라",
      "화이트라벨", "화이트 라벨", "화이트레이블", "화이트 레이블", "white label", "white-label",
      "노벨티", "novelty",
      "키즈", "kids", "퍼플라벨", "purple label", "뮬", "mule", "슬리퍼",
      // Wave 248: shorts variant — 다운자켓이 아닌 반바지 매물 차단
      "쇼츠", "반바지", "shorts", "short pants", "쇼츠 m", "쇼츠 l",
      // Wave 248: vest variant — 다운자켓이 아닌 베스트/조끼 매물 차단
      "베스트", "조끼", "vest", "푸퍼 베스트", "puffer vest", "다운 베스트", "다운 조끼", "패딩 베스트", "패딩 조끼", "패딩조끼",
      // Wave 248: 다른 에디션 (1996 모델만 강제) — 1994/1992/1990/2000s
      "1994", "1992", "1990", "2000년대", "2000s", "2010", "2012",
      // Wave 248: Eco Nuptse 별도 라인 (재활용 소재, 2023+ 리메이크)
      "에코 눕시", "에코눕시", "eco nuptse", "리메이크", "remake",
      // Wave 574 (2026-05-22): production audit — 포켓몬 루기아 콜라보 83.5만 outlier (정상 30만 +3배).
      "포켓몬", "pokemon", "루기아", "lugia", "피카츄", "pikachu",
      // 다른 brand mix 매물 (k2/아이다/몽벨 등 비교 매물)
      "k2 아이다", "k2아이다", "아이다 몽벨", "몽벨 눕시",
    ],
    msrpKrw: 360000, released: 1996,
    defaultProductType: "down_jacket", // Wave 236d — Nuptse = 다운자켓 라인 확정.
  },
  {
    id: "clothing-tnf-mountain-jacket",
    brand: "The North Face", category: "clothing", laneKey: "tnf_mountain_jacket",
    modelName: "TNF Mountain Jacket (Gore-Tex)",
    aliases: ["Mountain Jacket", "마운틴 자켓", "노스페이스 마운틴"],
    mustContain: [["노스페이스", "north face", "tnf"], ["마운틴 자켓", "mountain jacket", "마운틴자켓"]],
    // Wave 235 (2026-05-19): Cecilie Bahnsen collab 93만, Mountain Light/Mountain Parka 별 모델 차단.
    mustNotContain: [
      "supreme", "슈프림", "키즈", "kids", "purple label", "퍼플라벨", "퍼플 라벨",
      "north face purple", "the north face purple", "tnf purple", "purple mountain",
      "nanamica", "나나미카", "하이마운틴", "high mountain",
      // Wave 235 collab 차단
      "cecilie", "세실리에", "bahnsen", "반센", "세실리에 반센",
      "brain dead", "브레인데드", "junya", "준야", "gucci", "구찌",
      "마운틴 라이트", "mountain light", "마운틴라이트",
      "마운틴 파카", "mountain parka", "마운틴파카",
      "마운틴 가이드", "mountain guide", "안타르티카", "antarctica",
      "안토라", "antora",
      // Wave 640: 화이트라벨 (Korea Limited) + 노벨티 (한정 colorway) — 일반 마운틴 자켓 시세 대비 outlier.
      "화이트라벨", "화이트 라벨", "white label",
      "노벨티 마운틴", "novelty mountain", "novelty",
      "베이덴", "baeden",
    ],
    msrpKrw: 590000, released: 1985,
    defaultProductType: "jacket", // Wave 236d — Mountain Jacket = jacket 라인 확정.
  },
  {
    id: "clothing-tnf-denali-fleece",
    brand: "The North Face", category: "clothing", laneKey: "tnf_denali_fleece",
    modelName: "TNF Denali Fleece",
    aliases: ["Denali", "데날리", "노스페이스 데날리"],
    mustContain: [["노스페이스", "north face", "tnf"], ["denali", "데날리"]],
    mustNotContain: [
      "supreme", "슈프림", "키즈", "kids", "purple label",
      // Wave 407: Denali fleece lane should not absorb pants/bottoms.
      "팬츠", "바지", "pants", "트레이닝", "조거",
    ],
    msrpKrw: 290000, released: 1988,
    defaultProductType: "jacket", // Wave 236d — Denali = 플리스 자켓 라인 확정.
  },
  {
    id: "clothing-tnf-purple-label",
    brand: "The North Face Purple Label", category: "clothing", laneKey: "tnf_purple_label",
    modelName: "TNF Purple Label (Nanamica 일본)",
    aliases: ["Purple Label", "퍼플라벨", "Nanamica", "나나미카"],
    // 일본 라인 별도 SKU — 가격 1.5~2배
    mustContain: [["노스페이스", "north face", "tnf"], ["퍼플라벨", "purple label", "nanamica", "나나미카"]],
    // Wave 229 (2026-05-19) Iter1: clothing SKU 인데 토트백/가방 매물 매칭 → cross-category 차단.
    mustNotContain: ["supreme", "슈프림", "키즈", "kids",
      "가방", "bag", "backpack", "토트백", "tote", "숄더백", "크로스백", "메신저", "messenger", "월렛", "wallet", "지갑",
      "운동화", "sneaker", "스니커즈", "부츠", "boot", "샌들",
      // Wave 683 (2026-05-22): spread 15x — collab/한정 차단 (Purple Label 자체 가격 ±2x이지만 collab은 +50%).
      "몽키타임", "monkey time", "beauty youth",
      "빔스", "beams", "x beams",
      "유나이티드 애로우", "united arrows",
      "fragment", "프래그먼트",
      "셀럽 착용", "지디 착용", "지드래곤",
      // 가품 시그널
      "흑계", "대장급", "정품 택O",
    ],
    msrpKrw: 290000, released: 2003,
  },
  {
    id: "clothing-tnf-supreme-collab",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_collab_broad",
    modelName: "Supreme × The North Face (broad — 기타 자켓/플리스/베스트)",
    aliases: ["Supreme TNF", "슈프림 노스페이스"],
    // Wave 219: product type 분리 후 broad catch-all (자켓/티/맨투맨 만).
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"]],
    mustNotContain: ["키즈", "kids",
      // narrow 키워드 제외 (이미 그쪽 매칭)
      "백팩", "backpack", "숄더백", "토트백", "shoulder bag", "tote bag",
      "웨이스트백", "웨이스트 백", "waist bag", "벨트백", "belt bag",
      "럼바팩", "럼바 팩", "lumbar pack", "roo ii", "roo 2",
      "뮬", "슬리퍼", "샌들", "샌달",
      "지샥", "g-shock", "dw-6900", "dw6900", "카시오",
      // Wave 237 (2026-05-19): production sample audit 발견 — 가방 추가 패턴 누락.
      //   "슈프림 노스 데이팩 데님" 410k 매물 잘못 매칭 (가방 인데 의류 SKU).
      "데이팩", "daypack", "day pack", "메신저", "messenger",
      "더플", "duffle", "duffel", "트래블", "travel bag",
      "크로스백", "cross bag", "crossbody",
      // Wave 241 (2026-05-19): 사용자 코멘트 — "Supreme x TNF Snakeskin bag" 200k 가방 매물 매칭.
      "snakeskin bag", "스네이크스킨 백", "스네이크스킨", "snake skin bag",
      "익스페디션 빅 백", "expedition big bag", "스플릿 백",
      "웨이스트 백", "벨트 백",
      // Wave 245.3 (2026-05-19): production sample 측정 — 자켓 53건 (50%) — 모델별 narrow 분리.
      //   nuptse 14건 median 83만 / mountain jacket 12건 median 68만 / 등.
      //   broad 는 모델 미식별 자켓/플리스/베스트 catch-all 만.
      "눕시", "nuptse", "1996",
      "마운틴 자켓", "mountain jacket", "마운틴자켓",
      "마운틴 라이트", "mountain light", "마운틴라이트",
      "마운틴 파카", "mountain parka", "마운틴파카",
      "마운틴 가이드", "mountain guide",
      "발토로", "baltoro",
      "익스페디션", "expedition",
      // Wave 438: high-repeat Supreme x TNF apparel lines get separate comparable groups.
      "히말라야", "himalaya", "himalayan",
      "아크로고", "아크 로고", "arc logo",
      "테이프심", "테이프 심", "tape seam", "taped seam",
      "트레킹 컨버터블", "trekking convertible",
      "스팁테크", "스팁 테크", "steep tech",
      "스플릿 쉘", "split shell", "스플릿", "split",
      "반다나", "bandana",
      "레더 마운틴", "leather mountain",
      // narrow tee/sweat/pants 키워드 차단 (매물 적어 별도 narrow 신설은 보류)
      "티셔츠", "반팔", "롱슬리브",
      "후디", "hoodie", "맨투맨", "크루넥", "스웻", "sweat",
      "팬츠", "pants", "바지", "쇼츠", "반바지",
      "모자", "캡", "cap", "패널", "panel", "볼캡", "스냅백", "snapback",
      "고글", "goggle", "goggles", "스키 고글"],
    msrpKrw: 380000, released: 2020,
  },
  {
    id: "clothing-tnf-supreme-himalaya-parka",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_himalaya_parka",
    modelName: "Supreme × TNF S Logo Himalayan Parka",
    aliases: ["Supreme TNF Himalayan Parka", "슈프림 노스페이스 히말라야 파카"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["히말라야", "himalaya", "himalayan"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle"],
    msrpKrw: 1500000, released: 2020,
    defaultProductType: "down_jacket",
  },
  {
    id: "clothing-tnf-supreme-arc-logo-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_arc_logo_jacket",
    modelName: "Supreme × TNF Arc Logo Jacket",
    aliases: ["Supreme TNF Arc Logo Jacket", "슈프림 노스페이스 아크로고 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["아크로고", "아크 로고", "arc logo"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle"],
    msrpKrw: 750000, released: 2019,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-tape-seam-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_tape_seam_jacket",
    modelName: "Supreme × TNF Summit Tape Seam Coach Jacket",
    aliases: ["Supreme TNF Tape Seam Jacket", "슈프림 노스페이스 테이프심 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["테이프심", "테이프 심", "tape seam", "taped seam"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle"],
    msrpKrw: 450000, released: 2021,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-trekking-convertible-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_trekking_convertible_jacket",
    modelName: "Supreme × TNF Trekking Convertible Jacket",
    aliases: ["Supreme TNF Trekking Convertible Jacket", "슈프림 노스페이스 트레킹 컨버터블 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["트레킹 컨버터블", "trekking convertible"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle", "셔츠", "shirt", "쇼츠", "shorts", "팬츠", "pants"],
    msrpKrw: 550000, released: 2022,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-steep-tech-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_steep_tech_jacket",
    modelName: "Supreme × TNF Steep Tech Jacket",
    aliases: ["Supreme TNF Steep Tech Jacket", "슈프림 노스페이스 스팁테크 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["스팁테크", "스팁 테크", "steep tech"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle"],
    msrpKrw: 520000, released: 2021,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-split-shell-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_split_shell_jacket",
    modelName: "Supreme × TNF Split Shell Jacket",
    aliases: ["Supreme TNF Split Shell Jacket", "슈프림 노스페이스 스플릿 쉘 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["스플릿 쉘", "split shell"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "패널", "panel", "고글", "goggle"],
    msrpKrw: 750000, released: 2024,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-bandana-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_bandana_jacket",
    modelName: "Supreme × TNF Bandana Jacket / Set",
    aliases: ["Supreme TNF Bandana Jacket", "슈프림 노스페이스 반다나 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["반다나", "bandana"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle", "뮬", "슬리퍼", "샌들", "샌달"],
    msrpKrw: 900000, released: 2014,
  },
  {
    id: "clothing-tnf-supreme-leather-mountain-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_leather_mountain_jacket",
    modelName: "Supreme × TNF Leather Mountain Jacket",
    aliases: ["Supreme TNF Leather Mountain Jacket", "슈프림 노스페이스 레더 마운틴 자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["레더 마운틴", "leather mountain"]],
    mustNotContain: ["키즈", "kids", "백팩", "bag", "가방", "캡", "cap", "고글", "goggle"],
    msrpKrw: 1500000, released: 2018,
    defaultProductType: "jacket",
  },
  // Wave 245.3 (2026-05-19): Supreme × TNF 자켓 모델별 narrow 분리.
  //   production sample 측정 (60 days, 107건):
  //   - Nuptse 14건 median 83만 / Mountain Jacket 12건 median 68만 / Mountain Parka 4건 median 70만
  //   - Mountain Light 3건 median 70만 / Denali Fleece 3건 median 39만 / Expedition 4건 median 107만
  //   - Baltoro 2건 median 84.5만
  //   모델별 가격대 distinct → narrow split 효과 큼. (msrp 50만~110만)
  {
    id: "clothing-tnf-supreme-nuptse",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_nuptse",
    modelName: "Supreme × TNF 1996 Nuptse",
    aliases: ["Supreme TNF Nuptse", "슈프림 노스페이스 눕시"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["눕시", "nuptse", "1996"]],
    mustNotContain: ["키즈", "kids",
      "백팩", "backpack", "숄더백", "토트백", "shoulder bag", "tote bag", "tote", "토트", "shoulder", "숄더",
      "웨이스트백", "벨트백", "데이팩", "duffle", "duffel",
      "뮬", "슬리퍼", "샌들",
      "지샥", "g-shock", "dw-6900",
      // Wave 541 (2026-05-22): production sample audit — variant 가격 폭 20배 spread (24만~500만).
      //   특수 한정 (별도 시세군) + 가품 의심 + 팬츠 격리.
      // 특수 한정 (시세 +3~5배, 별도 SKU 후보):
      "레오파드", "leopard", "치토스", "cheetah",
      "레더 눕시", "leather nuptse", "레더눕시", "가죽 눕시",
      // 가품 의심 표기
      "슈프림맛", "슈프림스럽", "느낌", "노벨티 얼룩", "얼룩 슈프림",
      // 팬츠 (jacket SKU 분리)
      "팬츠", "pants", "스터드 눕시 팬츠",
      // Wave 601 (2026-05-22): 시즌별/colorway별 한정 매물 차단 (가격대 3-4배 차이).
      //   사용자 expected_profit 부풀려질 위험 (예: 23SS 트롱프 뢰유 540k 매물 sku_median 874k 잘못 산정).
      "스웨이드", "suede",   // 1.7M 한정
      "슈노 퍼", "슈노퍼", "shuno fur", "shuno-fur", "snow fur",  // 1.1-1.5M 한정
      "페이퍼", "paper",   // 페이퍼 카모 800k-1.2M 한정
      "트롱프 뢰유", "trompe loeil", "trompe l'oeil", "trompe-loeil", "프린티드 눕시",
      "낙엽", "16fw", "24fw", "23fw", "22fw", "21fw", "20fw", "19fw", "18fw", "17fw", "15fw", "13fw", "12fw",
      "스플릿 카모", "split camo",
      "블리치드 데님", "bleached denim", "데님 프린트", "데님 눕시", "denim print",
      "스터드", "studded",
    ],
    msrpKrw: 830000, released: 2017,
    defaultProductType: "down_jacket",
  },
  {
    id: "clothing-tnf-supreme-mountain-jacket",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_mountain_jacket",
    modelName: "Supreme × TNF Mountain Jacket (Gore-Tex)",
    aliases: ["Supreme TNF Mountain Jacket", "슈프림 노스페이스 마운틴자켓"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["마운틴 자켓", "mountain jacket", "마운틴자켓"]],
    mustNotContain: ["키즈", "kids",
      "마운틴 라이트", "mountain light", "마운틴 파카", "mountain parka",
      "마운틴 가이드", "mountain guide",
      "아크로고", "아크 로고", "arc logo", "반다나", "bandana", "레더 마운틴", "leather mountain",
      // Wave 588 (2026-05-22): 마운틴 + 레더 변형 (공백 없는 형태) 추가.
      "마운틴레더", "mountainleather", "mountain-leather",
      "백팩", "backpack", "숄더백", "토트백", "tote", "토트", "shoulder",
      "뮬", "슬리퍼", "지샥",
      // Wave 601b: 시즌별 한정 colorway/digit 차단 (Nuptse 패턴과 동일 — 시즌별 가격대 2-3배 차이).
      "슈노 닷샷", "슈노닷샷", "snow dot shot",  // 1.0M+ 한정
      "코듀로이", "corduroy",  // 12fw 한정 600k
      "자유의 여신상", "자유 여신상", "statue of liberty",  // 19fw 한정 450-560k
      "파워오렌지", "파워 오렌지", "power orange",  // 한정 색상
      "12fw", "13fw", "15fw", "17fw", "18fw", "19fw", "20fw", "21fw", "22fw",  // 빈티지 시즌
      "데님 마운틴", "denim mountain",  // 슈노 닷샷 데님 1M+
    ],
    msrpKrw: 680000, released: 2017,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-mountain-light",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_mountain_light",
    modelName: "Supreme × TNF Mountain Light Jacket",
    aliases: ["Supreme TNF Mountain Light", "슈프림 노스페이스 마운틴라이트"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["마운틴 라이트", "mountain light", "마운틴라이트"]],
    mustNotContain: ["키즈", "kids",
      "마운틴 자켓", "mountain jacket", "마운틴 파카", "mountain parka",
      "백팩", "토트", "shoulder", "뮬", "슬리퍼", "지샥"],
    msrpKrw: 700000, released: 2018,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-mountain-parka",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_mountain_parka",
    modelName: "Supreme × TNF Mountain Parka",
    aliases: ["Supreme TNF Mountain Parka", "슈프림 노스페이스 마운틴파카"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["마운틴 파카", "mountain parka", "마운틴파카"]],
    mustNotContain: ["키즈", "kids",
      "마운틴 자켓", "마운틴 라이트",
      "아크로고", "아크 로고", "arc logo", "레더 마운틴", "leather mountain",
      "백팩", "토트", "shoulder", "뮬", "슬리퍼", "지샥"],
    msrpKrw: 700000, released: 2018,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-expedition",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_expedition",
    modelName: "Supreme × TNF Expedition (자켓/파카)",
    aliases: ["Supreme TNF Expedition", "슈프림 노스페이스 익스페디션"],
    // Wave 245.3: 백/가방 매물 제외 (Wave 241 의 익스페디션 빅 백 차단과 일치)
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["익스페디션", "expedition"]],
    mustNotContain: ["키즈", "kids",
      // 가방 차단 (Wave 241)
      "빅 백", "big bag", "큰 백", "백팩", "backpack", "토트", "tote", "shoulder", "숄더",
      "뮬", "슬리퍼", "지샥"],
    msrpKrw: 1070000, released: 2017,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-denali-fleece",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_denali_fleece",
    modelName: "Supreme × TNF Denali Fleece",
    aliases: ["Supreme TNF Denali", "슈프림 노스페이스 데날리", "슈프림 노스 플리스"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["데날리", "denali", "플리스", "fleece"]],
    mustNotContain: ["키즈", "kids",
      "아크로고", "아크 로고", "arc logo",
      "백팩", "토트", "shoulder", "숄더", "뮬", "슬리퍼", "지샥"],
    msrpKrw: 390000, released: 2018,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-tnf-supreme-baltoro",
    brand: "Supreme x TNF", category: "clothing", laneKey: "tnf_supreme_baltoro",
    modelName: "Supreme × TNF Baltoro Jacket (다운)",
    aliases: ["Supreme TNF Baltoro", "슈프림 노스페이스 발토로"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["발토로", "baltoro"]],
    mustNotContain: ["키즈", "kids",
      "백팩", "토트", "shoulder", "숄더", "뮬", "슬리퍼", "지샥",
      "드라이로프", "드라이 로프", "dryloft", "dry loft", "원판"],
    msrpKrw: 845000, released: 2017,
    defaultProductType: "down_jacket",
  },
  // Wave 219 (2026-05-19): Supreme × TNF product type 분리 — 자켓 300~400K / 백팩 250~350K / 슬리퍼 250K / 지샥 290K
  {
    id: "bag-tnf-supreme-backpack",
    brand: "Supreme x TNF", category: "bag", laneKey: "tnf_supreme_backpack",
    modelName: "Supreme × TNF Backpack",
    aliases: ["Supreme TNF Backpack", "슈프림 노스페이스 백팩"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["백팩", "backpack"]],
    mustNotContain: ["키즈", "kids", "숄더", "shoulder", "토트", "tote", "웨이스트", "waist", "벨트백", "belt bag", "럼바", "lumbar", "캡", "cap", "패널", "panel"],
    msrpKrw: 320000, released: 2017,
    defaultProductType: "backpack",
  },
  {
    id: "bag-tnf-supreme-shoulder",
    brand: "Supreme x TNF", category: "bag", laneKey: "tnf_supreme_shoulder_bag",
    modelName: "Supreme × TNF Shoulder Bag",
    aliases: ["Supreme TNF Shoulder Bag", "슈프림 노스페이스 숄더백"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["숄더백", "숄더", "shoulder bag"]],
    mustNotContain: ["키즈", "kids", "백팩", "backpack", "토트", "tote", "웨이스트", "waist", "럼바", "lumbar", "캡", "cap", "패널", "panel"],
    msrpKrw: 190000, released: 2018,
    defaultProductType: "shoulder",
  },
  {
    id: "bag-tnf-supreme-tote",
    brand: "Supreme x TNF", category: "bag", laneKey: "tnf_supreme_tote_bag",
    modelName: "Supreme × TNF Tote Bag",
    aliases: ["Supreme TNF Tote Bag", "슈프림 노스페이스 토트백"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["토트백", "토트", "tote bag", "tote"]],
    mustNotContain: ["키즈", "kids", "백팩", "backpack", "숄더", "shoulder", "웨이스트", "waist", "럼바", "lumbar", "캡", "cap", "패널", "panel"],
    msrpKrw: 320000, released: 2018,
    defaultProductType: "tote",
  },
  {
    id: "bag-tnf-supreme-waist",
    brand: "Supreme x TNF", category: "bag", laneKey: "tnf_supreme_waist_bag",
    modelName: "Supreme × TNF Waist / Lumbar Bag",
    aliases: ["Supreme TNF Lumbar Pack", "슈프림 노스페이스 럼바팩"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["웨이스트백", "웨이스트 백", "waist bag", "벨트백", "belt bag", "럼바팩", "럼바 팩", "lumbar pack", "roo ii", "roo 2", "루11"]],
    mustNotContain: ["키즈", "kids", "백팩", "backpack", "숄더", "shoulder", "토트", "tote", "캡", "cap", "패널", "panel"],
    msrpKrw: 220000, released: 2016,
    defaultProductType: "waist",
  },
  {
    id: "shoe-tnf-supreme-slipper",
    brand: "Supreme x TNF", category: "shoe", laneKey: "tnf_supreme_slipper",
    modelName: "Supreme × TNF Mule / Slipper",
    aliases: ["Supreme TNF 뮬", "슈프림 노스페이스 슬리퍼"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["뮬", "슬리퍼", "샌들", "샌달", "mule", "slipper"]],
    mustNotContain: ["키즈", "kids"],
    msrpKrw: 350000, released: 2021,
    defaultProductType: "slipper", // Wave 236e — Supreme TNF Mule = slipper.
  },
  {
    id: "watch-tnf-supreme-gshock-dw6900",
    brand: "Casio x Supreme x TNF", category: "watch", laneKey: "tnf_supreme_gshock",
    modelName: "Supreme × TNF × G-Shock DW-6900 (한정 콜라보)",
    aliases: ["Supreme TNF G-Shock", "슈프림 노스페이스 지샥"],
    mustContain: [["supreme", "슈프림"], ["노스페이스", "north face", "tnf"], ["지샥", "g-shock", "dw-6900", "dw6900", "카시오"]],
    mustNotContain: ["키즈", "kids"],
    msrpKrw: 320000, released: 2022,
  },
  // TNF 백팩 (bag 카테고리):
  {
    id: "bag-tnf-borealis",
    brand: "The North Face", category: "bag", laneKey: "tnf_borealis",
    modelName: "TNF Borealis Backpack",
    aliases: ["Borealis", "보레알리스", "노스페이스 보레알리스"],
    mustContain: [["노스페이스", "north face", "tnf"], ["borealis", "보레알리스"]],
    // Wave 199 정정: 보레알리스 부츠 매물 차단 (신발 카테고리)
    mustNotContain: ["supreme", "슈프림", "키즈", "kids", "purple label",
      "부츠", "boots", "boot ", "운동화", "신발", "슬리퍼", "slipper", "뮬", "mule", "등산화"],
    msrpKrw: 159000, released: 2010,
    defaultProductType: "backpack", // Wave 236d — Borealis = TNF 백팩 라인 확정.
  },
  {
    id: "bag-tnf-hotshot",
    brand: "The North Face", category: "bag", laneKey: "tnf_hotshot",
    modelName: "TNF Hot Shot Backpack",
    aliases: ["Hot Shot", "핫샷", "노스페이스 핫샷"],
    mustContain: [["노스페이스", "north face", "tnf"], ["hot shot", "hotshot", "핫샷"]],
    mustNotContain: ["supreme", "슈프림", "키즈", "kids", "purple label",
      "부츠", "boots", "boot ", "운동화", "신발", "슬리퍼", "slipper", "뮬", "mule"],
    msrpKrw: 189000, released: 2008,
    defaultProductType: "backpack", // Wave 236d — Hot Shot = TNF 백팩 확정.
  },
  {
    id: "bag-tnf-bigshot",
    brand: "The North Face", category: "bag", laneKey: "tnf_bigshot",
    modelName: "TNF Big Shot Backpack",
    aliases: ["Big Shot", "빅샷", "노스페이스 빅샷"],
    mustContain: [["노스페이스", "north face", "tnf"], ["big shot", "bigshot", "빅샷"]],
    mustNotContain: ["supreme", "슈프림", "키즈", "kids", "purple label",
      "부츠", "boots", "boot ", "운동화", "신발", "슬리퍼", "slipper", "뮬", "mule"],
    msrpKrw: 199000, released: 2008,
    defaultProductType: "backpack", // Wave 236d — Big Shot = TNF 백팩 확정.
  },
  // TNF Nuptse Mule (shoe 카테고리):
  {
    id: "shoe-tnf-nuptse-mule",
    brand: "The North Face", category: "shoe", laneKey: "tnf_nuptse_mule",
    modelName: "TNF Nuptse Mule (슬리퍼)",
    aliases: ["Nuptse Mule", "눕시 뮬", "노스페이스 뮬"],
    mustContain: [["노스페이스", "north face", "tnf"], ["뮬", "mule", "슬리퍼", "slipper"]],
    mustNotContain: ["supreme", "슈프림", "키즈", "kids", "1996", "패딩", "down"],
    msrpKrw: 89000, released: 2022,
    defaultProductType: "slipper", // Wave 236e — Nuptse Mule = slipper.
  },
  // Stüssy:
  {
    // Wave 199 정정 — clothing-stussy-nike-collab은 의류만 (fleece pant / hoodie / windrunner / track).
    //   신발 매물 (Spiridon / Benassi / Air Force / Vandal / Air Max 2013 / Air Penny / LD-1000 / 척테일러) 차단.
    // Wave 732 (2026-05-24) leak fix: 51건 unmatched 분석:
    //   1. mustContain[0] "나투시" 누락 — 한국 셀러 합성어 표기 흔함
    //   2. mustContain[2] product type 좁음 — 자켓/팬츠/롱슬리브/워터쇼츠/버킷햇 누락
    id: "clothing-stussy-nike-collab",
    brand: "Nike x Stussy", category: "clothing", laneKey: "stussy_nike_collab",
    modelName: "Nike × Stüssy Apparel (collab)",
    aliases: ["Nike Stussy 의류", "나이키 스투시 fleece", "나투시"],
    mustContain: [
      ["nike", "나이키", "나투시"],
      ["stussy", "스투시", "stüssy", "나투시"],
      ["fleece", "플리스", "windrunner", "윈드러너", "track", "트랙",
       "hoodie", "후드", "맨투맨", "크루넥", "스웻",
       "tee", "반팔", "티셔츠",
       // Wave 732 추가
       "롱슬리브", "long sleeve", "롱 슬리브",
       "자켓", "jacket", "재킷", "스톰핏", "storm fit", "코치자켓", "coach jacket",
       "팬츠", "pants", "바지", "카고",
       "쇼츠", "shorts", "반바지", "비치 팬츠", "비치팬츠", "워터 쇼츠", "워터쇼츠", "water short",
       "풀오버", "pullover",
       "버킷햇", "bucket hat", "비니", "beanie", "헤드밴드",
       "nrg"],
    ],
    mustNotContain: [
      "키즈", "kids", "fragment", "프래그먼트", "dior", "디올", "복각", "이미테이션", "rep ", "replica",
      // 신발 차단 — Nike Stussy collab 매물 56% 신발 (shoe SKU로 별도 분리)
      "에어맥스", "air max", "에어포스", "air force", "스피리돈", "spiridon", "베나시", "benassi",
      "반달", "vandal", "에어 페니", "air penny", "ld-1000", "ld1000",
      "줌", "zoom", "쿠키니", "kukini", "척테일러", "척 70", "chuck",
      "신발", "운동화", "스니커즈", "sneakers", "슬리퍼", "slipper", "슬라이드", "slide",
      // Wave 690 (2026-05-22): release 전 narrow — 묶음/한정 차단.
      "셋업", "set up", "setup", "상하의 세트", "상의 하의", "상하의세트",
      "월드투어", "world tour",  // 한정 시즌 (380k variant)
      "오프 느와르 셋업", "오프 누아르 셋업", "off noir setup",
      // Wave 732 추가: 묶음 brand 매물 차단
      "여성의류", "남성의류", "다양 brand", "여러 brand",
    ],
    msrpKrw: 150000, released: 2020,
  },
  {
    // Wave 199 신규 — Nike × Stüssy 신발 (109건 매물 다수가 신발)
    id: "shoe-stussy-nike-collab",
    brand: "Nike x Stussy", category: "shoe", laneKey: "stussy_nike_shoe_collab",
    modelName: "Nike × Stüssy Footwear (collab)",
    aliases: ["Nike Stussy 신발", "나이키 스투시 신발", "Stussy 스피리돈", "Stussy 베나시", "Stussy LD-1000"],
    mustContain: [
      ["nike", "나이키", "나이키스투시", "나투시"],
      ["stussy", "스투시", "stüssy", "나이키스투시", "나투시"],
      ["신발", "운동화", "스니커즈", "슈즈", "에어맥스", "에어 맥스", "스투시맥스", "air max", "에어포스", "에어 포스", "air force", "airforce", "포스", "af1", "허라취", "허라치", "huarache",
        "에어 페니", "에어페니", "air penny", "페니", "penny", "스피리돈", "스피리톤", "spiridon", "spiriton", "베나시", "benassi",
        "ld-1000", "ld 1000", "ld1000", "반달", "vandal", "쿠키니", "kukini", "발토로", "baltoro", "에어플라이트", "에어 플라이트", "air flight",
        "슬리퍼", "slipper", "슬라이드", "slide", "미드"],
    ],
    mustNotContain: [
      "키즈", "kids", "dior", "디올", "복각", "이미테이션", "rep ", "replica",
      // 의류 차단
      "fleece", "플리스", "windrunner", "윈드러너", "후드", "hoodie", "맨투맨", "반팔만",
      "포스터", "액자", "바람막이", "셋업", "자켓", "재킷", "jacket", "팬츠", "pants", "티셔츠",
    ],
    msrpKrw: 200000, released: 2020,
  },
  {
    id: "clothing-stussy-basic-tee",
    brand: "Stussy", category: "clothing", laneKey: "stussy_basic_tee",
    modelName: "Stüssy Basic Tee (8 Ball / World Tour / Stock)",
    aliases: ["Stussy Tee", "스투시 반팔", "Stussy T-Shirt"],
    // Wave 726 (2026-05-24): "롱슬리브/긴팔티/긴팔" 추가 (agent + foreground 검증 — 209건 unmatched 중 105건이 반팔/롱슬리브 누락).
    mustContain: [["stussy", "스투시", "stüssy"], ["반팔", "티셔츠", "tee ", "t-shirt", "t셔츠", "롱슬리브", "롱 슬리브", "긴팔티", "긴팔 티", "long sleeve", "8 ball", "8ball", "8볼", "world tour", "월드투어", "stock", "스톡", "script", "스크립트"]],
    mustNotContain: ["nike", "나이키", "dior", "디올", "birkenstock", "버켄스탁", "carhartt", "칼하트", "키즈", "kids", "후드", "hoodie", "맨투맨", "복각", "rep ", "replica",
      "니트", "knit", "스웨터", "sweater",
      "자켓", "재킷", "jacket", "코치자켓", "coach jacket", "쉘 자켓", "shell jacket", "바람막이", "윈드브레이커",
      // Wave 712a (2026-05-23) HOTFIX: bias-free 검증 — STOCK WATER SHORT 5건/월드투어 셔츠 2건 false positive 차단.
      "워터 쇼츠", "water short", "비치팬츠", "워터쇼츠", "비치 팬츠", "쇼츠", "shorts", "반바지", "셔츠", "shirt",
      // Wave 593c: 90s/올드 빈티지 + 콜라보 차단 (basic tee 시세 정리).
      "90s ", "90's ", "90s stussy", "올드 스투시", "olds stussy", "old stussy", "빈티지 올드", "킹 사이즈 크라운", "킹사이즈 크라운", "kingsize crown",
      "샤넬", "chanel", "칼 라거펠트", "karl lagerfeld",
      "마크 제이콥스", "marc jacobs",
      "cpfm", "cactus plant flea market",
      "한정판", "limited edition",
      // Wave 594d: Born X Raised collab (Stussy LA collab line).
      "본 앤 레이즈드", "born x raised", "born and raised", "본앤레이즈드",
      // Wave 594e: Stussy DICE 한정 라인 (200k outlier vs basic 5~7만).
      "다이스 반팔", "다이스 티", "퍼지 다이스", "stussy dice", "스투시 다이스",
      // Wave 630: 추가 collab/한정 표기 변형 (Wave 593-596 follow-up).
      "born-raised", "born_raised", "8ball born",
      "마크제이콥스", "marc-jacobs", "marcjacobs",
      "아워 레가시", "ourlegacy", "our legacy", "ourlegacy stussy",
      "빌트 터프", "built tough", "built-tough",
      "8볼 카모", "8 볼 카모", "8볼 티셔츠 카모", "8 ball camo",
      "리빈 라지 하마", "리빈 하마",
      "엔젤 8볼", "angel 8ball", "angel 8 ball",
      // Wave 656 (2026-05-22): a_grade spread 8.25x audit (71건) — 월드투어/도시 한정/collab 추가.
      "월드투어", "world tour", "월드 투어",  // 모든 variant
      "갱스타", "gang starr", "gangstarr",
      "돌리", "dolly", "돌리 블러쉬", "blush pink",
      "오사카", "osaka", "스투시 오사카",
      "도쿄", "tokyo", "스투시 도쿄",
      "파리", "paris", "스투시 파리",
      "런던", "london",
      "뉴욕", "new york", "ny limited",
      "도버스트릿", "도버 스트릿", "도버 스트리트", "도버 스트리트 마켓", "dover street", "dover street market", "dsm",
      "마틴로즈", "martine rose", "martin rose",
      "써멀", "thermal", "thermal tee",
      "썬 페이디드", "썬페이디드", "sun faded", "sunfaded",
      "스투시 ic", "stussy ic", "스투시 ix",
      // Wave 812: sample-key cleanup found Mountain Hardwear collab, pigment, and Dice rows in basic tee.
      "마운틴하드웨어", "마운틴 하드웨어", "mountain hardwear", "mountain hardware",
      "피그먼트", "pigment",
      "주사위", "주사위 반팔", "dice tee",
    ],
    msrpKrw: 89000, released: 2020,
    defaultProductType: "tee", // Wave 236d — Basic Tee = tee 확정.
  },
  {
    id: "clothing-stussy-hoodie",
    brand: "Stussy", category: "clothing", laneKey: "stussy_hoodie",
    modelName: "Stüssy Hoodie (pullover)",
    aliases: ["Stussy Hoodie", "스투시 후드", "스투시 후드티"],
    mustContain: [["stussy", "스투시", "stüssy"], ["후드", "후디", "후드티", "hoodie", "hoody", "hooded"]],
    mustNotContain: ["nike", "나이키", "dior", "디올", "birkenstock", "버켄스탁", "carhartt", "칼하트", "키즈", "kids", "반팔", "복각", "rep ", "replica",
      // Wave 805: crewneck/sweatshirt and zip hoodie are separate price lanes.
      "후드집업", "후드 집업", "집업후드", "집업 후드", "zip up", "zipup", "full zip", "hoodie zip", "zip hoodie",
      "반집업", "반 집업", "하프집업", "하프 집업", "half zip", "half-zip", "quarter zip", "1/2 zip",
      "맨투맨", "크루넥", "crewneck", "sweatshirt", "sweat shirt", "스웻셔츠", "스웨트셔츠", "스웻 셔츠", "스웨트 셔츠",
      "후드자켓", "후드 자켓", "후드재킷", "후드 재킷", "hooded jacket", "자켓", "재킷", "jacket",
      "니트", "knit", "스웨터", "sweater", "유니온", "union",
      // Wave 545 (2026-05-22): 시어링 (양털/가죽 라인, 160만 한정) 차단 — 일반 후드 8~25만 대비 +6배.
      "시어링", "shearling", "쉬어링", "fleece collar shearling",
      "레더", "leather", "가죽 자켓",
      // Wave 596: hoodie b_grade audit — Our Legacy / No Vacancy Inn / 레게맨 / 바카르 collab 차단.
      "아워레가시", "our legacy", "ourlegacy", "아워 레가시",
      "노바디스 홈", "no vacancy inn", "novacancy",
      "바카르 노바디스", "bacar nobody",
      "레게맨",
      // Wave 631: 추가 collab/한정 (Stussy hoodie b_grade IQR 9.7x audit).
      "cpfm", "cactus plant flea market", "x cpfm",
      "stussy paris", "스투시 파리", "스투시 파리 후드",
      "데이비드 카슨", "david carson", "베스파",
      "디지스탁", "digistack",
      "월드투어 후드", "world tour hoodie", "world tour 후드",
      "부아나 피그먼트", "boana pigment",
      // Wave 655 (2026-05-22): c_grade spread 8.4x audit — 월드투어/CPFM/월드 트라이브/SKULL & BONES 등 추가.
      "월드투어", "world tour", "월드 투어",  // Wave 631 "월드투어 후드"만 → 모든 월드투어 variant
      "월드 트라이브", "월드트라이브", "world tribe", "world-tribe",
      "skull & bones", "skull and bones", "skull bones", "skull", "bones", "스컬 본즈", "스컬 앤 본즈",
      "pig. dyed", "pig dyed", "pigdye",
      "id 매거진", "iD 매거진", "id magazine", "스투시 id", "stussy id",
      "스택드", "stacked", "스택드 피그먼트",
      "다이아 후드", "diamond hoodie", "피그먼트 다이아",
      // Wave 745 (2026-05-24): spread 3.0x audit — collab/시그니처 추가 차단.
      // 부아나 (Boana) 한국 표기 / 마틴로즈 (Martine Rose) / 8볼 후드 시그니처 / Soul 1980 / Designs (헤리티지 라인 일부) / 슈페리어
      "부아나", "boana",
      "마틴로즈", "martine rose", "마틴 로즈",
      "8볼 후드", "8 ball hoodie", "8볼 hoodie", "8ball 후드", "8ball hoodie",
      "도버스트릿", "도버 스트릿", "도버 스트리트", "도버 스트리트 마켓", "dover street", "dover street market", "dsm",
      "스탁 서울", "stock seoul", "스투시서울", "스투시 서울", "서울 후드",
      "다이스", "dice", "다이스 아웃", "dice out",
      "futura", "퓨추라",
      "soul 1980", "soul1980",
      "슈페리어", "superior",
      "스프레이 다이드", "spray dyed", "spray-dyed", "sprayed",
      "피그먼트 다이드", "pigment dyed", "피그먼트다이드",
    ],
    msrpKrw: 159000, released: 2020,
    defaultProductType: "hoodie",
  },
  {
    id: "bag-stussy-waist-bag",
    brand: "Stussy", category: "bag", laneKey: "stussy_waist_bag",
    modelName: "Stüssy Waist Bag",
    aliases: ["Stussy Waist Bag", "스투시 웨이스트백", "Stussy Hip Bag", "스투시 힙색"],
    mustContain: [["stussy", "스투시", "stüssy"], ["waist", "웨이스트", "힙색", "힙 색", "hip bag"]],
    mustNotContain: ["nike", "나이키", "dior", "디올", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 89000, released: 2018,
  },
  {
    // Wave 199 신규 — Stüssy 가방 broad (크로스백 / 토트백 / 30주년 / 성조기 / 에코백 / 파우치)
    // Wave 712a (2026-05-23) HOTFIX: bias-free 검증 — 정확도 52% (22건 오분류).
    //   토트/원통/30주년 매물이 시세 다른데 한 SKU에 묶임. crossbody narrow로 좁힘.
    //   토트/30주년/원통은 broad SKU (bag-stussy-broad)로 fallback 또는 별도 narrow 신설 권고.
    id: "bag-stussy-crossbody",
    brand: "Stussy", category: "bag", laneKey: "stussy_crossbody",
    modelName: "Stüssy Crossbody / Sling / Shoulder",
    aliases: ["Stussy Crossbody", "스투시 크로스백", "Stussy Sling"],
    mustContain: [["stussy", "스투시", "stüssy"], ["크로스백", "crossbody", "cross body", "숄더백", "shoulder", "sling", "슬링", "메신저", "messenger"]],
    mustNotContain: ["nike", "나이키", "dior", "디올", "키즈", "kids", "복각", "rep ", "replica", "waist", "웨이스트",
      // Wave 712a: 토트/30주년/원통/스포츠백/잡지부록 미니백 차단 (다른 시세군).
      "토트백", "tote", "원통", "스포츠백", "더플", "duffel", "30주년", "30th", "잡지부록", "미니백",
      "에코백", "성조기", "캔버스 파우치"],
    msrpKrw: 89000, released: 2018,
  },
  {
    id: "clothing-stussy-dior-collab",
    brand: "Dior x Stussy", category: "clothing", laneKey: "stussy_dior_collab",
    modelName: "Dior × Stüssy (FW21 한정)",
    aliases: ["Dior Stussy", "디올 스투시"],
    mustContain: [["dior", "디올"], ["stussy", "스투시", "stüssy"]],
    mustNotContain: [
      "nike", "나이키", "키즈", "kids", "복각", "rep ", "replica",
      // Wave 717 (2026-05-23): pool audit 발견 — 가방 매물 (디올옴므 스투시 새들백/호보백) 흡수 차단.
      // 가방은 별도 시세군 (clothing SKU에 들어오면 안 됨).
      "새들백", "saddle bag", "saddle",
      "호보백", "호보 백", "hobo bag", "hobo",
      "백팩", "backpack", "메신저", "messenger",
      "토트백", "tote bag", "토트 백",
      "숄더백", "shoulder bag", "숄더 백", "크로스백", "crossbody",
      "지갑", "wallet", "월렛", "카드지갑", "card holder",
      "가방", "bag",
    ],
    msrpKrw: 1200000, released: 2021,
  },
  // Wave 199 (2026-05-18): 의류 brand 신발 매물 mining 발견 — 폴로/TNF 신발 SKU 추가.
  {
    id: "shoe-polo-leather-loafer",
    brand: "Polo Ralph Lauren", category: "shoe", laneKey: "polo_leather_loafer",
    modelName: "Polo Leather Loafer / Moccasin / Derby",
    aliases: ["Polo Loafer", "폴로 로퍼", "Polo Moccasin", "폴로 모카신", "Polo Derby"],
    mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌"], ["로퍼", "loafer", "모카신", "moccasin", "더비", "derby", "슬립온", "slip-on", "slipon", "페니"]],
    mustNotContain: ["RRL", "더블 알엘", "purple label", "퍼플라벨", "키즈", "kids", "토들러", "복각", "rep ", "replica"],
    msrpKrw: 250000, released: 2020,
    defaultProductType: "loafer", // Wave 236e — Polo Loafer/Moccasin/Derby.
  },
  {
    id: "shoe-tnf-hiking-boots",
    brand: "The North Face", category: "shoe", laneKey: "tnf_hiking_boots",
    modelName: "TNF Hiking Boots (등산화)",
    aliases: ["TNF 등산화", "노스페이스 등산화", "TNF Hiking", "보레알리스 부츠"],
    mustContain: [["노스페이스", "north face", "tnf"], ["등산화", "hiking", "트레킹", "trekking", "trail", "트레일", "부츠", "부띠", "부티", "bootie", "방한부츠"]],
    mustNotContain: ["supreme", "슈프림", "키즈", "kids", "purple label", "백팩", "backpack", "가방", "bag", "토트", "복각", "rep ", "replica", "뮬", "mule", "슬리퍼"],
    msrpKrw: 200000, released: 2015,
    defaultProductType: "boot", // Wave 236e — Hiking Boots.
  },
  // Wave 199 Tier 2 brand mining 추가:
  // 라코스테 (매물 다수, faved 3~21, 가격 친화):
  {
    id: "shoe-lacoste-sneakers",
    brand: "Lacoste", category: "shoe", laneKey: "lacoste_sneakers",
    modelName: "Lacoste Sneakers (운동화)",
    aliases: ["Lacoste Sneakers", "라코스테 스니커즈", "라코스테 운동화", "라코스테 카나비"],
    mustContain: [["라코스테", "lacoste"], ["스니커즈", "sneakers", "운동화", "카나비", "런스핀", "스톰", "신발", "단화"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "가방", "bag", "토트", "원피스", "시계"],
    msrpKrw: 100000, released: 2020,
  },
  {
    id: "bag-lacoste-tote",
    brand: "Lacoste", category: "bag", laneKey: "lacoste_tote",
    modelName: "Lacoste Tote / Shopper / Backpack",
    aliases: ["Lacoste Tote", "라코스테 토트백", "Lacoste Shopper", "라코스테 백팩"],
    mustContain: [["라코스테", "lacoste"], ["토트백", "tote", "쇼퍼", "shopper", "백팩", "backpack", "캔버스백", "헤리티지 캔버스"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "운동화", "스니커즈", "신발", "원피스", "시계"],
    msrpKrw: 100000, released: 2018,
  },
  {
    id: "clothing-lacoste-pique-polo",
    brand: "Lacoste", category: "clothing", laneKey: "lacoste_pique_polo",
    modelName: "Lacoste Pique Polo Shirt (시그니처)",
    aliases: ["Lacoste Pique", "라코스테 피케", "Lacoste Polo Shirt", "라코스테 폴로셔츠"],
    mustContain: [["라코스테", "lacoste"], ["피케", "pique", "pk", "폴로", "polo", "폴로셔츠", "폴로 셔츠", "폴로티", "카라티", "카라 티"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "스니커즈", "운동화", "가방", "bag", "토트", "원피스", "드레스", "dress", "스커트", "시계", "골프 원피스",
      "린넨", "linen", "체크셔츠", "체크 셔츠", "남방",
      "니트", "knit", "스웨터", "sweater", "가디건", "cardigan",
      "구스다운", "다운", "패딩", "down", "puffer", "베스트", "vest",
      "긴팔", "롱슬리브", "long sleeve", "long-sleeve",
      // Wave 492: CDG Shirt x Lacoste collab is not comparable to plain Lacoste pique.
      "꼼데", "꼼데가르송", "cdg", "comme des", "comme des garcons"],
    msrpKrw: 159000, released: 2020,
  },
  // 아더에러 (한국 디자이너 — 시그니처 쇼퍼백 + 컨버스 collab):
  {
    id: "bag-adererror-shopper",
    brand: "ADER ERROR", category: "bag", laneKey: "adererror_shopper",
    modelName: "ADER ERROR Shopper Bag (시그니처)",
    aliases: ["Ader Error Shopper", "아더에러 쇼퍼백", "아더에러 와이드 쇼퍼"],
    mustContain: [["adererror", "아더에러", "ader error"], ["쇼퍼", "shopper", "토트", "tote", "와이드", "wide bag"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "컨버스", "converse", "신발", "케이스"],
    msrpKrw: 300000, released: 2020,
  },
  {
    id: "shoe-adererror-converse-collab",
    brand: "Converse x ADER ERROR", category: "shoe", laneKey: "adererror_converse_collab",
    modelName: "Converse × ADER ERROR (collab)",
    aliases: ["Ader Error Converse", "아더에러 컨버스", "Adererror x Converse"],
    mustContain: [["adererror", "아더에러", "ader error"], ["컨버스", "converse"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "케이스", "case"],
    msrpKrw: 159000, released: 2022,
  },
  // Wave 200 (2026-05-18): Tier 3 mining — 꼼데가르송 / Stussy×Converse / Polo Big Pony.
  // 꼼데가르송 매물 다수 (faved 30~51), Nike/NB/Vans/Salomon collab 신발 압도적 + 시그니처 PVC 가방.
  // Wave 817 (2026-05-25): broad CDG Nike is blocked; exact model lanes below may release.
  {
    id: "shoe-cdg-nike-dunk-low-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_dunk_low_collab",
    modelName: "Nike × CDG Dunk Low",
    aliases: ["CDG Nike Dunk Low", "꼼데가르송 나이키 덩크 로우", "꼼데 덩크"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["덩크", "dunk"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria", "힐 프리미어", "heel premier", "에어맥스", "air max", "블레이저", "blazer"],
    msrpKrw: 250000, released: 2020, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-terminator-high-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_terminator_high_collab",
    modelName: "Nike × CDG Terminator High",
    aliases: ["CDG Nike Terminator", "꼼데가르송 나이키 터미네이터"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["터미네이터", "terminator"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 200000, released: 2022, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-pegasus-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_pegasus_collab",
    modelName: "Nike × CDG Air Pegasus",
    aliases: ["CDG Nike Pegasus", "꼼데가르송 나이키 페가수스"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["페가수스", "pegasus"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 250000, released: 2020, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-presto-tent-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_presto_tent_collab",
    modelName: "Nike × CDG Presto Foot Tent",
    aliases: ["CDG Nike Presto Tent", "꼼데가르송 나이키 프레스토 텐트", "프레스토풋 텐트"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["프레스토", "presto", "풋 텐트", "foot tent", "텐트"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 220000, released: 2002, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-tennis-classic-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_tennis_classic_collab",
    modelName: "Nike × CDG Tennis Classic",
    aliases: ["CDG Nike Tennis Classic", "꼼데가르송 나이키 테니스 클래식"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["테니스 클래식", "tennis classic"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 220000, released: 2015, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-sense96-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_sense96_collab",
    modelName: "Nike × CDG Sense 96",
    aliases: ["CDG Nike Sense 96", "꼼데가르송 나이키 센스 96"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["센스 96", "sense 96", "sense96"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 300000, released: 2019, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-foamposite-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_foamposite_collab",
    modelName: "Nike × CDG Air Foamposite One",
    aliases: ["CDG Nike Foamposite", "꼼데가르송 나이키 폼포짓"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["폼포짓", "foamposite"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "탈라리아", "talaria"],
    msrpKrw: 550000, released: 2021, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-talaria-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_talaria_collab",
    modelName: "Nike × CDG Air Zoom Talaria SP",
    aliases: ["CDG Nike Talaria", "꼼데가르송 나이키 탈라리아"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["탈라리아", "talaria"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite"],
    msrpKrw: 350000, released: 2017, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-heel-premier-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_heel_premier_collab",
    modelName: "Nike × CDG Heel Premier",
    aliases: ["CDG Nike Heel Premier", "꼼데가르송 나이키 힐 프리미어"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["힐 프리미어", "heel premier"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "덩크", "dunk", "터미네이터", "terminator", "페가수스", "pegasus", "프레스토", "presto", "테니스", "tennis", "센스", "sense", "폼포짓", "foamposite", "탈라리아", "talaria"],
    msrpKrw: 500000, released: 2024, defaultProductType: "sneaker",
  },
  {
    id: "shoe-cdg-nike-collab",
    brand: "Nike x CDG", category: "shoe", laneKey: "cdg_nike_collab",
    modelName: "Nike × CDG Homme Plus (collab 신발)",
    aliases: ["Nike CDG", "나이키 꼼데가르송", "CDG Nike", "꼼데 옴므플러스"],
    mustContain: [["nike", "나이키"], ["꼼데", "cdg", "comme des garcons", "commedesgarcons"]],
    // 폼포짓 / 블레이저 / 에어맥스 / 와플레이서 / 센스 / 에어포스 다 포함
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "newbalance", "뉴발란스", "vans", "반스", "salomon", "살로몬"],
    msrpKrw: 300000, released: 2020,
  },
  {
    id: "bag-cdg-pvc",
    brand: "Comme des Garcons", category: "bag", laneKey: "cdg_pvc_bag",
    modelName: "CDG PVC Bag (시그니처)",
    aliases: ["CDG PVC", "꼼데가르송 PVC", "꼼데 PVC 가방"],
    mustContain: [["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["pvc"]],
    // Wave 235 (2026-05-19): Gucci × CDG 100주년 collab 105만/65만/56만 — 별도 SKU 또는 차단.
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "nike", "나이키", "신발", "스니커즈",
      // Wave 235 collab 차단
      "gucci", "구찌", "구찌 100주년", "지드래곤", "지디", "위버멘쉬",
      "louis vuitton", "lv", "루이비통",
    ],
    msrpKrw: 200000, released: 2018,
  },
  {
    id: "shoe-stussy-converse-collab",
    brand: "Converse x Stussy", category: "shoe", laneKey: "stussy_converse_collab",
    modelName: "Converse × Stüssy (척테일러 70 collab)",
    aliases: ["Stussy Converse", "스투시 컨버스", "Converse Stussy 척70"],
    mustContain: [["stussy", "스투시", "stüssy"], ["컨버스", "converse"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "nike", "나이키", "케이스", "가방", "bag"],
    msrpKrw: 130000, released: 2022,
  },
  {
    id: "bag-polo-big-pony-tote",
    brand: "Polo Ralph Lauren", category: "bag", laneKey: "polo_big_pony_tote",
    modelName: "Polo Big Pony Tote Bag (시그니처)",
    aliases: ["Polo Big Pony Tote", "폴로 빅포니 토트", "Polo Tote"],
    mustContain: [["폴로", "polo", "ralph lauren", "랄프로렌"], ["빅포니", "빅 포니", "big pony"], ["토트", "tote"]],
    mustNotContain: ["RRL", "더블 알엘", "purple label", "퍼플라벨", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 199000, released: 2020,
  },
  // Wave 201 (2026-05-18): 꼼데가르송 collab 추가 분리 — NB / Vans / Salomon.
  // 사용자 정책 "전수조사" — 각 collab별 narrow SKU로 시세 분리.
  {
    id: "shoe-cdg-newbalance-collab",
    brand: "New Balance x CDG Junya Watanabe", category: "shoe", laneKey: "cdg_newbalance_collab",
    modelName: "NB × CDG Junya Watanabe (collab)",
    aliases: ["NB CDG", "뉴발란스 꼼데가르송", "준야 와타나베 NB", "CDG Junya"],
    mustContain: [["꼼데", "cdg", "comme des garcons", "준야", "junya"], ["뉴발란스", "new balance", "newbalance", "nb "]],
    mustNotContain: ["nike", "나이키", "vans", "반스", "salomon", "살로몬", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 250000, released: 2021,
  },
  {
    id: "shoe-cdg-vans-collab",
    brand: "Vans x CDG", category: "shoe", laneKey: "cdg_vans_collab",
    modelName: "Vans × CDG (collab)",
    aliases: ["Vans CDG", "반스 꼼데가르송", "Vans 꼼데"],
    mustContain: [["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["vans", "반스"]],
    mustNotContain: ["nike", "나이키", "newbalance", "뉴발란스", "salomon", "살로몬", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 150000, released: 2020,
  },
  {
    id: "shoe-cdg-salomon-collab",
    brand: "Salomon x CDG", category: "shoe", laneKey: "cdg_salomon_collab",
    modelName: "Salomon × CDG (collab)",
    aliases: ["Salomon CDG", "살로몬 꼼데가르송", "CDG XT-6", "CDG XA Alpine"],
    mustContain: [["꼼데", "cdg", "comme des garcons", "commedesgarcons"], ["salomon", "살로몬"]],
    mustNotContain: ["nike", "나이키", "newbalance", "뉴발란스", "vans", "반스", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 500000, released: 2022,
  },
  // Wave 202 (2026-05-18): On Running 매물 폭발적 — 60건+ 14d sample. 클라우드 시리즈 + collab.
  {
    id: "shoe-onrunning-cloud-monster",
    brand: "On Running", category: "shoe", laneKey: "onrunning_cloud_monster",
    modelName: "On Running Cloud Monster (시그니처)",
    aliases: ["Cloud Monster", "클라우드 몬스터", "On Cloud Monster"],
    mustContain: [["온러닝", "on running", "on cloud"], ["몬스터", "monster"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "loewe", "로에베", "paf", "파프", "pleasures"],
    msrpKrw: 230000, released: 2022,
  },
  {
    id: "shoe-onrunning-cloud-basic",
    brand: "On Running", category: "shoe", laneKey: "onrunning_cloud_basic",
    modelName: "On Running Cloud (5/X/Z5)",
    aliases: ["On Cloud", "온러닝 클라우드", "Cloud 5", "Cloud X"],
    mustContain: [["온러닝", "on running", "on cloud"], ["cloud 5", "클라우드 5", "cloud x", "클라우드 x", "cloud z", "z5", "클라우드 z"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "loewe", "로에베", "paf", "파프", "몬스터", "monster", "서퍼", "surfer"],
    msrpKrw: 169000, released: 2021,
  },
  {
    id: "shoe-onrunning-cloudsurfer",
    brand: "On Running", category: "shoe", laneKey: "onrunning_cloudsurfer",
    modelName: "On Running Cloudsurfer",
    aliases: ["Cloudsurfer", "클라우드 서퍼", "클라우드서퍼"],
    mustContain: [["온러닝", "on running", "on cloud"], ["서퍼", "surfer"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "loewe", "로에베", "paf", "파프"],
    msrpKrw: 200000, released: 2023,
  },
  {
    id: "shoe-onrunning-cloudtilt-loewe-collab",
    brand: "Loewe x On Running", category: "shoe", laneKey: "onrunning_loewe_collab",
    modelName: "Loewe × On Cloudtilt / Cloudventure 2 (한정 collab)",
    aliases: ["Loewe On", "로에베 온러닝", "Loewe Cloudtilt", "Loewe Cloudventure"],
    // Wave 703 (2026-05-23) HOTFIX: cloudventure 추가 + decon 차단.
    //   bias-free 검증 — Loewe collab은 Cloudtilt + Cloudventure 2 둘 다. 기존 regex Cloudtilt만 catch.
    //   "Decon Cloud" (Adidas Stan Smith Decon Cloud) false-positive 차단.
    mustContain: [["loewe", "로에베"], ["온러닝", "on running", "cloudtilt", "클라우드틸트", "cloudventure", "클라우드벤처"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "paf", "파프",
      "decon", "데콘", "스탠스미스", "stan smith", "삼바", "samba"],
    msrpKrw: 750000, released: 2024,
  },
  {
    id: "shoe-onrunning-paf-collab",
    brand: "PAF x On Running", category: "shoe", laneKey: "onrunning_paf_collab",
    modelName: "PAF × On Running (한정 collab)",
    aliases: ["PAF On", "파프 온러닝", "포스트아카이브팩션"],
    mustContain: [["paf", "파프", "포스트아카이브"], ["온러닝", "on running", "on cloud"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "loewe", "로에베", "pleasures"],
    msrpKrw: 450000, released: 2023,
  },
  // 버켄스탁 매물 어마어마 (faved 5~38 다수, 보스턴 시그니처)
  {
    id: "shoe-birkenstock-boston",
    brand: "Birkenstock", category: "shoe", laneKey: "birkenstock_boston",
    modelName: "Birkenstock Boston (시그니처)",
    aliases: ["Boston", "버켄스탁 보스턴"],
    mustContain: [["버켄스탁", "birkenstock"], ["보스턴", "boston"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "stussy", "스투시", "dior", "디올", "아더에러", "adererror", "피어 오브 갓", "fear of god"],
    msrpKrw: 240000, released: 2020,
    defaultProductType: "slipper", // Wave 236e — Boston = closed-toe clog (slipper).
  },
  {
    id: "shoe-birkenstock-arizona",
    brand: "Birkenstock", category: "shoe", laneKey: "birkenstock_arizona",
    modelName: "Birkenstock Arizona (시그니처)",
    aliases: ["Arizona", "버켄스탁 아리조나"],
    mustContain: [["버켄스탁", "birkenstock"], ["아리조나", "arizona"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "dior", "디올", "아더에러",
      // Wave 543 (2026-05-22): production audit — 크롬하츠 콜라보 500만 (정품 15~30만 대비 +20배).
      "크롬하츠", "chrome hearts", "건슬링어", "gunslinger", "rhodium",
      "스투시", "stussy", "manolo blahnik", "manolo",
    ],
    msrpKrw: 159000, released: 1973,
    defaultProductType: "sandal", // Wave 236e — Arizona = 2-strap sandal.
  },
  {
    id: "shoe-birkenstock-zurich",
    brand: "Birkenstock", category: "shoe", laneKey: "birkenstock_zurich",
    modelName: "Birkenstock Zürich",
    aliases: ["Zürich", "취리히", "버켄스탁 취리히"],
    mustContain: [["버켄스탁", "birkenstock"], ["취리히", "zurich", "zürich"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "dior", "디올"],
    msrpKrw: 199000, released: 1995,
    defaultProductType: "sandal", // Wave 236e — Zürich = 3-strap sandal.
  },
  {
    id: "shoe-birkenstock-milano",
    brand: "Birkenstock", category: "shoe", laneKey: "birkenstock_milano",
    modelName: "Birkenstock Milano",
    aliases: ["Milano", "밀라노", "버켄스탁 밀라노"],
    mustContain: [["버켄스탁", "birkenstock"], ["밀라노", "milano"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "dior", "디올", "아더에러"],
    msrpKrw: 159000, released: 1995,
    defaultProductType: "sandal", // Wave 236e — Milano = 3-strap sandal with heel.
  },
  // 룰루레몬 — 백팩 압도적 (faved 91!)
  {
    id: "bag-lululemon-backpack",
    brand: "Lululemon", category: "bag", laneKey: "lululemon_backpack",
    modelName: "Lululemon Backpack / Bag",
    aliases: ["Lululemon Backpack", "룰루레몬 백팩", "룰루레몬 더플", "룰루레몬 슬링백"],
    mustContain: [["룰루레몬", "lululemon"], ["백팩", "backpack", "더플", "duffel", "토트", "tote", "슬링", "sling", "숄더", "shoulder", "파우치", "pouch"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "운동화", "스니커즈", "신발"],
    msrpKrw: 100000, released: 2018,
  },
  // 리바이스 collab — NB × Levis / Nike × Levis 매물 다수
  {
    id: "shoe-newbalance-levis-collab",
    brand: "New Balance x Levis", category: "shoe", laneKey: "newbalance_levis_collab",
    modelName: "NB × Levi's 990v3 (collab)",
    aliases: ["NB Levis", "뉴발란스 리바이스", "990v3 Levis"],
    mustContain: [["뉴발란스", "new balance", "newbalance"], ["리바이스", "levis", "levi's", "levi", "99ov3"]],
    mustNotContain: ["nike", "나이키", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 250000, released: 2022,
  },
  {
    id: "shoe-nike-levis-collab",
    brand: "Nike x Levis", category: "shoe", laneKey: "nike_levis_collab",
    modelName: "Nike × Levi's Air Max 95 (collab)",
    aliases: ["Nike Levis", "나이키 리바이스", "에어맥스 95 Levis"],
    mustContain: [["nike", "나이키"], ["리바이스", "levis", "levi's", "levi"]],
    mustNotContain: ["뉴발란스", "newbalance", "new balance", "키즈", "kids", "복각", "rep ", "replica"],
    msrpKrw: 250000, released: 2018,
  },
  // Wave 203 (2026-05-18): 마르지엘라 매물 압도적 — 타비 신발 / MM6 × Salomon / 글램슬램 / 향수 dupe 차단 강화.
  // 14d sample 80건 거의 다 마르지엘라. "Replica" 라인 (정품 향수) vs "재현향 스프레이" (가품 dupe) 분리.
  {
    id: "shoe-margiela-tabi",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi",
    modelName: "Maison Margiela Tabi (broad — 스플릿토)",
    aliases: ["Tabi", "타비", "마르지엘라 타비"],
    // Wave 219: product type 분리 후 broad catch-all.
    mustContain: [["마르지엘라", "margiela", "maison margiela"], ["타비", "tabi"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "살로몬", "닥터마틴", "dr.martens", "rick owens", "릭 오웬스", "ami",
      // narrow 매칭 키워드 제외
      "스니커즈", "sneaker", "하이탑", "로우", "컨버스", "캔버스", "canvas",
      "부츠", "boot", "앵클",
      "슬리퍼", "slipper", "에스파드류", "뮬", "mule", "mules",
      "플랫", "flat", "발레", "ballet", "메리제인", "mary jane", "슬립온", "slip-on", "slip on",
      "샌들", "sandal", "쪼리", "플립플랍", "플리플랍", "flip flop", "flipflop", "슬라이드", "slide",
      "로퍼", "loafer", "더비", "derby",
      "펌프스", "pump", "pumps", "힐", "heel",
      "리복", "reebok", "인스타펌프", "instapump", "클래식 레더", "classic leather", "비앙게토", "bianchetto",
      "독일군", "german army", "replica trainer",
      "페인팅", "페인트", "paint", "painting",
      "키링", "keyring", "key ring", "에어팟", "airpods", "케이스"],
    msrpKrw: 750000, released: 1989,
  },
  // Wave 219 (2026-05-19): Margiela Tabi product type 분리 — 부츠 100K vs 스니커즈 120~200K vs 슬리퍼 170K
  {
    id: "shoe-margiela-tabi-german-army",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_german_army",
    modelName: "Margiela Tabi German Army / Replica Trainer",
    aliases: ["Tabi German Army", "타비 독일군", "타비 리플리카 트레이너"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["독일군", "german army", "replica trainer"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "슬리퍼", "샌들", "로퍼"],
    msrpKrw: 860000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-margiela-tabi-sneaker",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_sneaker",
    modelName: "Margiela Tabi Sneaker (Lowtop / Hightop)",
    aliases: ["Tabi Sneaker", "타비 스니커즈", "마르지엘라 타비 스니커즈"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["스니커즈", "sneaker", "하이탑", "로우", "lowtop", "hightop", "low", "high", "컨버스", "캔버스", "canvas"]],
    // Wave 228 (2026-05-19): German Army Trainer / Reebok collab / 페인팅 별도 SKU.
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "슬리퍼", "에스파드류", "espadrille", "뮬", "mule", "mules",
      "독일군", "german army", "reebok", "리복", "인스타펌프", "instapump",
      "페인팅", "painting"],
    msrpKrw: 1090000, released: 2018,
  },
  {
    id: "shoe-margiela-tabi-reebok",
    brand: "Maison Margiela x Reebok", category: "shoe", laneKey: "margiela_tabi_reebok",
    modelName: "Margiela x Reebok Tabi (Instapump / Classic Leather)",
    aliases: ["Margiela Reebok Tabi", "마르지엘라 리복 타비", "타비 인스타펌프", "타비 클래식 레더"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["리복", "reebok", "인스타펌프", "instapump", "클래식 레더", "classic leather", "비앙게토", "bianchetto"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "슬리퍼", "샌들"],
    msrpKrw: 480000, released: 2021,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-margiela-tabi-painted-sneaker",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_painted_sneaker",
    modelName: "Margiela Tabi Painted / Paint Drop Sneaker",
    aliases: ["Tabi Paint Drop", "타비 페인팅 슈즈", "타비 페인트 스니커즈"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["페인팅", "페인트", "paint", "painting", "paint drop"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "슬리퍼", "샌들", "로퍼", "loafer"],
    msrpKrw: 980000, released: 2020,
    defaultProductType: "sneaker",
  },
  {
    id: "shoe-margiela-tabi-flat",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_flat",
    modelName: "Margiela Tabi Flat / Mary Jane / Slip-on",
    aliases: ["Tabi Flat", "타비 플랫", "타비 메리제인", "Tabi Mary Jane"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["플랫", "flat", "발레", "ballet", "메리제인", "mary jane", "슬립온", "slip-on", "slip on"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "스니커즈", "sneaker", "슬리퍼", "에스파드류"],
    msrpKrw: 980000, released: 2019,
    defaultProductType: "flat",
  },
  {
    id: "shoe-margiela-tabi-sandal",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_sandal",
    modelName: "Margiela Tabi Sandal / Flip Flop / Slide",
    aliases: ["Tabi Sandal", "타비 샌들", "타비 플립플랍", "Tabi Slide"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["샌들", "sandal", "쪼리", "플립플랍", "플리플랍", "flip flop", "flipflop", "슬라이드", "slide"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "스니커즈", "sneaker", "로퍼", "loafer"],
    msrpKrw: 690000, released: 2020,
    defaultProductType: "sandal",
  },
  {
    id: "shoe-margiela-tabi-loafer",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_loafer",
    modelName: "Margiela Tabi Loafer / Derby",
    aliases: ["Tabi Loafer", "타비 로퍼", "타비 더비"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["로퍼", "loafer", "더비", "derby"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "스니커즈", "sneaker", "슬리퍼", "샌들"],
    msrpKrw: 1290000, released: 2020,
    defaultProductType: "loafer",
  },
  {
    id: "shoe-margiela-tabi-pump",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_pump",
    modelName: "Margiela Tabi Pumps / Heel",
    aliases: ["Tabi Pumps", "타비 펌프스", "타비 힐"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["펌프스", "pump", "pumps", "힐", "heel"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "스니커즈", "sneaker", "슬리퍼", "샌들", "로퍼", "loafer"],
    msrpKrw: 1180000, released: 2020,
    defaultProductType: "pump",
  },
  {
    id: "shoe-margiela-tabi-boot",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_boot",
    modelName: "Margiela Tabi Boot (앵클/롱)",
    aliases: ["Tabi Boot", "타비 부츠", "마르지엘라 타비 부츠"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["부츠", "boot", "앵클부츠"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "스니커즈", "sneaker", "슬리퍼"],
    msrpKrw: 1290000, released: 1989,
    defaultProductType: "boot", // Wave 236e — Tabi Boot.
  },
  {
    id: "shoe-margiela-tabi-slipper",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_tabi_slipper",
    modelName: "Margiela Tabi Slipper / Espadrille",
    aliases: ["Tabi Slipper", "타비 슬리퍼", "Tabi Espadrille"],
    mustContain: [["마르지엘라", "margiela"], ["타비", "tabi"], ["슬리퍼", "slipper", "에스파드류", "espadrille", "뮬", "mule", "mules"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica 라인", "salomon", "닥터마틴", "rick owens", "ami", "부츠", "boot", "샌들", "sandal", "쪼리", "플립플랍", "플리플랍", "flip flop", "flipflop"],
    msrpKrw: 690000, released: 2020,
    defaultProductType: "slipper", // Wave 236e — Tabi Slipper.
  },
  {
    id: "shoe-margiela-german-army",
    brand: "Maison Margiela", category: "shoe", laneKey: "margiela_german_army",
    modelName: "Maison Margiela German Army Trainer (Replica)",
    aliases: ["Margiela German Army", "마르지엘라 독일군", "Replica Trainer"],
    mustContain: [["마르지엘라", "margiela", "maison margiela"], ["독일군", "german army", "replica trainer", "리플리카 트레이너"]],
    mustNotContain: ["키즈", "kids", "복각", "rep만", "salomon", "살로몬", "타비", "tabi"],
    msrpKrw: 590000, released: 2015,
  },
  {
    id: "shoe-mm6-salomon-collab",
    brand: "Salomon x MM6 Maison Margiela", category: "shoe", laneKey: "mm6_salomon_collab",
    modelName: "Salomon × MM6 (X-ALP / ACS / Cross)",
    aliases: ["MM6 Salomon", "살로몬 MM6", "살로몬 마르지엘라"],
    mustContain: [["mm6", "마르지엘라", "margiela"], ["salomon", "살로몬"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "타비", "tabi", "cdg", "꼼데"],
    msrpKrw: 500000, released: 2021,
  },
  {
    id: "bag-margiela-glam-slam",
    brand: "Maison Margiela", category: "bag", laneKey: "margiela_glam_slam",
    modelName: "Maison Margiela Glam Slam (시그니처)",
    aliases: ["Glam Slam", "글램슬램", "마르지엘라 글램슬램"],
    mustContain: [["마르지엘라", "margiela", "maison margiela"], ["글램슬램", "glam slam", "glamslam"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "샘플", "vial", "공병", "재현향", "type", "마이퍼퓸"],
    msrpKrw: 1800000, released: 2018,
    defaultProductType: "shoulder", // Wave 608: Glam Slam 본질 = 숄더백/핸드백.
  },
  {
    id: "clothing-mm6-margiela",
    brand: "MM6 Maison Margiela", category: "clothing", laneKey: "mm6_margiela_apparel",
    modelName: "MM6 Maison Margiela Apparel (broad)",
    aliases: ["MM6", "엠엠식스", "MM6 마르지엘라"],
    mustContain: [["mm6"], ["반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "셔츠", "shirt", "자켓", "jacket", "스웨터", "knit"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "샘플", "vial", "공병", "재현향", "type", "마이퍼퓸", "tabi", "타비", "salomon", "살로몬", "닥터마틴", "가방", "bag", "신발", "shoe",
      "supreme", "슈프림", "north face", "노스페이스", "tnf",
      // Wave 238 (2026-05-19): production audit — "준지 롱야상 MM67" 매물이 MM6 SKU 매칭 (Juun.J 모델).
      "준지", "juun", "juun.j", "juun j",
      // Wave 269 (2026-05-20): API sweep — 39/96 type_unknown 매물 중 mm6 독일군 (Margiela 독일군 sneaker) catch.
      //   독일군 = 신발 (replica/military style) → 의류 SKU에서 격리.
      "독일군", "german army", "리오파", "reproduction", "리프로덕션",
      // 토드백/재패니즈 백 (가방, 별도 SKU 후보)
      "토드백", "토드 백", "재패니즈", "재페니즈", "japanese", "japanese bag",
    ],
    msrpKrw: 290000, released: 2020,
  },
  // Wave 204 (2026-05-18): 슈프림 매물 압도적 (sample 80건 거의 다) — 6 collab + 2 가방 = 8 SKU.
  // Wave 220 (2026-05-19): orphan sku_id cleanup — raw_listings 에 79건 박힌 'shoe-nike-airforce-1-low-black' SKU 가 catalog 에 없었음.
  //   매물 sample: "에어포스1 트리플 블랙" / "올블랙" / "에어포스 1 블랙" / "에어포스1 블랙 스웨이드" 등 명백한 AF1 Low Black 시그니처.
  //   catalog 박아 정상 매칭 + LANE_READINESS 등록. 가품 risk 낮음 (시그니처 모델).
  {
    id: "shoe-nike-airforce-1-low-black",
    brand: "Nike", category: "shoe", laneKey: "nike_airforce_1_low_black",
    modelName: "Nike Air Force 1 Low Black (Triple Black)",
    aliases: ["AF1 Low Black", "에어포스1 블랙", "에어포스 1 블랙", "Air Force 1 Triple Black"],
    mustContain: [["에어포스", "air force", "airforce", "af1"], ["블랙", "black", "검정", "올블랙", "올검", "트리플 블랙", "triple black"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "high", "하이", "mid", "미드",
      "supreme", "슈프림", "구찌", "gucci", "off-white", "오프화이트", "sacai", "사카이", "travis", "트래비스",
      "white", "화이트", "트리플 화이트", "흰색", "블루", "그린", "핑크", "레드", "옐로우",
      // 다른 색 차단 (위 black 외 colorway 매물 제외)
      // Wave 544 (2026-05-22): production audit — HTM 한정 (Hiroshi Tinker Mark, 200만대) 차단.
      "htm", "hiroshi", "tinker hatfield", "마크 파커",
      "앰부쉬", "ambush",
    ],
    msrpKrw: 139000, released: 1982,
  },
  // 사용자 정책: 한정판 narrow 분리. 가품 risk 매우 큼 → mustNotContain 강력.
  {
    id: "shoe-supreme-nike-airforce1-collab",
    brand: "Supreme x Nike", category: "shoe", laneKey: "supreme_nike_airforce1_collab",
    modelName: "Supreme × Nike Air Force 1 (collab)",
    aliases: ["Supreme Nike AF1", "슈프림 에어포스", "슈프림 슈포스", "Supreme Air Force"],
    mustContain: [["supreme", "슈프림"], ["nike", "나이키"], ["에어포스", "air force", "airforce", "슈포스", "af1"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "imitation", "fake", "구찌", "gucci", "팀버랜드", "닥터마틴", "vans", "반스", "sb"],
    msrpKrw: 290000, released: 2018,
  },
  {
    id: "shoe-supreme-nike-airmax-collab",
    brand: "Supreme x Nike", category: "shoe", laneKey: "supreme_nike_airmax_collab",
    modelName: "Supreme × Nike Air Max (collab)",
    aliases: ["Supreme Air Max", "슈프림 에어맥스", "슈프림 휴마라", "슈프림 테일윈드"],
    mustContain: [["supreme", "슈프림"], ["nike", "나이키"], ["에어맥스", "air max", "airmax", "휴마라", "humara", "테일윈드", "tailwind", "샥스", "shox"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "팀버랜드", "닥터마틴", "vans", "반스", "sb 덩크", "sb dunk",
      // Wave 813: Supreme/Nike Air Max wording appears on caps; keep shoe lane footwear-only.
      "캠프캡", "캠프 캡", "camp cap", "모자", "볼캡", "cap", "hat"],
    msrpKrw: 320000, released: 2016,
  },
  {
    id: "shoe-supreme-nike-sb-collab",
    brand: "Supreme x Nike SB", category: "shoe", laneKey: "supreme_nike_sb_collab",
    modelName: "Supreme × Nike SB (덩크 / 블레이저 / 에어포스2)",
    aliases: ["Supreme SB", "슈프림 SB", "Supreme Dunk SB", "슈프림 SB 덩크"],
    mustContain: [["supreme", "슈프림"], ["nike", "나이키", "나이키sb", "nike sb", "nikesb", "sb"], ["sb", "덩크", "dunk", "덩크 sb", "덩크sb", "sb 덩크", "sb덩크", "블레이저 sb", "블레이저sb", "에어포스 2", "airforce 2"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "팀버랜드", "닥터마틴", "vans", "반스", "에어포스 1", "af1",
      // Wave 878: exact Supreme SB Dunk Low lane exists and should own explicit Dunk Low rows.
      "덩크 로우", "덩크로우", "dunk low",
    ],
    msrpKrw: 290000, released: 2018,
  },
  {
    id: "shoe-supreme-timberland-collab",
    brand: "Supreme x Timberland", category: "shoe", laneKey: "supreme_timberland_collab",
    modelName: "Supreme × Timberland (3아이 / 6인치 / 보트슈즈)",
    aliases: ["Supreme Timberland", "슈프림 팀버랜드"],
    mustContain: [["supreme", "슈프림"], ["timberland", "팀버랜드"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "nike", "나이키", "vans", "반스"],
    msrpKrw: 700000, released: 2018,
    defaultProductType: "boot", // Wave 236e — Timberland = boot.
  },
  {
    id: "shoe-supreme-drmartens-collab",
    brand: "Supreme x Dr.Martens", category: "shoe", laneKey: "supreme_drmartens_collab",
    modelName: "Supreme × Dr.Martens (1461 / 2046 / 램지 / 펜톤)",
    aliases: ["Supreme Dr.Martens", "슈프림 닥터마틴"],
    mustContain: [["supreme", "슈프림"], ["닥터마틴", "dr.martens", "dr martens", "doc martens"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "nike", "나이키", "vans", "반스", "팀버랜드"],
    defaultProductType: "boot", // Wave 236e — Dr.Martens = boot.
    msrpKrw: 500000, released: 2018,
  },
  {
    id: "shoe-supreme-vans-collab",
    brand: "Supreme x Vans", category: "shoe", laneKey: "supreme_vans_collab",
    modelName: "Supreme × Vans (올드스쿨 / 스컬 슬립온 / 하프 캡)",
    aliases: ["Supreme Vans", "슈프림 반스"],
    mustContain: [["supreme", "슈프림"], ["vans", "반스"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "nike", "나이키", "팀버랜드", "닥터마틴"],
    msrpKrw: 200000, released: 2018,
  },
  {
    id: "bag-supreme-backpack",
    brand: "Supreme", category: "bag", laneKey: "supreme_backpack",
    modelName: "Supreme Backpack (FW/SS 시그니처)",
    aliases: ["Supreme Backpack", "슈프림 백팩", "Supreme 백팩"],
    mustContain: [["supreme", "슈프림"], ["백팩", "backpack"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake",
      "구찌", "gucci", "노스페이스", "north face", "tnf", "tnf collab",
      // Wave 651: 빈티지/collab 차단 (spread 5.8x outlier).
      // 빈티지 FW2011 박스로그 다미에 코듀라 (pid 404980509, 550k).
      "fw2011", "fw 2011", "2011fw", "2011 fw", "fw2010", "fw 2010", "2010fw",
      "fw2009", "fw 2009", "2009fw", "fw2008", "fw 2008", "2008fw",
      "fw2007", "fw 2007", "2007fw", "fw2006", "fw 2006", "2006fw",
      "fw2005", "fw 2005", "2005fw", "fw2004", "fw 2004", "2004fw",
      "fw2003", "fw 2003", "2003fw", "fw2002", "fw 2002", "2002fw",
      "fw2001", "fw 2001", "2001fw", "fw2000", "fw 2000", "2000fw",
      "ss2010", "ss 2010", "2010ss", "ss2009", "ss 2009", "2009ss",
      "ss2008", "ss 2008", "2008ss", "ss2007", "ss 2007", "2007ss",
      "ss2006", "ss 2006", "2006ss", "ss2005", "ss 2005", "2005ss",
      "다미에", "damier", "다미에코듀라", "damier cordura",
      // B.B Simon collab (pid 396906080, 500k).
      "bb 사이먼", "b.b 사이먼", "b.b. 사이먼", "비비 사이먼", "비비사이먼",
      "bb simon", "b.b simon", "b.b. simon", "bbsimon",
      // Bounty Hunter collab (pid 292777736, 220k).
      "바운티 헌터", "바운티헌터", "bounty hunter", "bountyhunter",
    ],
    msrpKrw: 250000, released: 2018,
    defaultProductType: "backpack", // Wave 236d — Supreme Backpack (mustContain 강제됨).
  },
  {
    id: "bag-supreme-bandana-tarp-side",
    brand: "Supreme", category: "bag", laneKey: "supreme_bandana_tarp_side_bag",
    modelName: "Supreme Bandana Tarp Side Bag",
    aliases: ["Supreme Bandana Tarp Side Bag", "슈프림 반다나 타프 사이드백"],
    mustContain: [["supreme", "슈프림"], ["반다나", "반나다", "bandana"], ["타프", "tarp"], ["사이드", "side"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백"],
    msrpKrw: 190000, released: 2021,
    defaultProductType: "crossbody",
  },
  {
    id: "bag-supreme-field-side",
    brand: "Supreme", category: "bag", laneKey: "supreme_field_side_bag",
    modelName: "Supreme Field Side Bag",
    aliases: ["Supreme Field Side Bag", "슈프림 필드 사이드백"],
    mustContain: [["supreme", "슈프림"], ["필드", "field"], ["사이드", "side"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백"],
    msrpKrw: 190000, released: 2023,
    defaultProductType: "crossbody",
  },
  {
    id: "bag-supreme-puffer-side",
    brand: "Supreme", category: "bag", laneKey: "supreme_puffer_side_bag",
    modelName: "Supreme Puffer Side Bag",
    aliases: ["Supreme Puffer Side Bag", "슈프림 퍼퍼 사이드백"],
    mustContain: [["supreme", "슈프림"], ["퍼퍼", "푸퍼", "puffer"], ["사이드", "side"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백"],
    msrpKrw: 190000, released: 2022,
    defaultProductType: "crossbody",
  },
  {
    id: "bag-supreme-nike-leather-shoulder",
    brand: "Supreme x Nike", category: "bag", laneKey: "supreme_nike_leather_shoulder_bag",
    modelName: "Supreme x Nike Leather Shoulder Bag",
    aliases: ["Supreme Nike Leather Shoulder", "슈프림 나이키 레더 숄더백"],
    mustContain: [["supreme", "슈프림"], ["nike", "나이키"], ["숄더", "shoulder"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백", "더플", "duffle", "토트", "tote", "헤드폰", "headphone"],
    msrpKrw: 180000, released: 2025,
    defaultProductType: "shoulder",
  },
  {
    id: "bag-supreme-mesh-duffle",
    brand: "Supreme", category: "bag", laneKey: "supreme_mesh_duffle_bag",
    modelName: "Supreme Mesh Mini Duffle Bag",
    aliases: ["Supreme Mesh Mini Duffle", "슈프림 메쉬 미니 더플백"],
    mustContain: [["supreme", "슈프림"], ["메쉬", "mesh"], ["더플", "더블백", "더블 백", "double bag", "duffle", "duffel"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백", "토트", "tote", "헤드폰", "headphone"],
    msrpKrw: 190000, released: 2023,
    defaultProductType: "duffle",
  },
  {
    id: "bag-supreme-mesh-tote",
    brand: "Supreme", category: "bag", laneKey: "supreme_mesh_tote_bag",
    modelName: "Supreme Mesh Tote Bag",
    aliases: ["Supreme Mesh Tote", "슈프림 메쉬 토트백"],
    mustContain: [["supreme", "슈프림"], ["메쉬", "mesh"], ["토트", "tote"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백", "더플", "duffle", "duffel", "헤드폰", "headphone"],
    msrpKrw: 230000, released: 2025,
    defaultProductType: "tote",
  },
  {
    id: "bag-supreme-mesh-bag",
    brand: "Supreme", category: "bag", laneKey: "supreme_mesh_bag",
    modelName: "Supreme Mesh Bag (small/heavy/playboy)",
    aliases: ["Supreme Mesh Bag", "슈프림 메쉬백"],
    mustContain: [["supreme", "슈프림"], ["메쉬", "mesh"], ["백", "bag"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack", "캡", "cap", "스냅백", "5패널", "5 패널", "5-패널", "6패널", "6 패널", "6-패널", "5 panel", "6 panel", "토트", "tote", "더플", "더블백", "더블 백", "double bag", "duffle", "duffel", "헤드폰", "headphone"],
    msrpKrw: 160000, released: 2024,
    defaultProductType: "shoulder", // Wave 608: Mesh Bag 본질 = 숄더/크로스.
  },
  {
    id: "bag-supreme-shoulder",
    brand: "Supreme", category: "bag", laneKey: "supreme_shoulder_bag",
    modelName: "Supreme Shoulder / Side Bag",
    aliases: ["Supreme Shoulder", "슈프림 숄더백", "Supreme 사이드백"],
    mustContain: [["supreme", "슈프림"], ["숄더", "shoulder", "사이드", "side bag", "crossbody"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "구찌", "gucci", "백팩", "backpack", "노스페이스", "north face", "tnf",
      "반다나", "반나다", "bandana", "필드", "field", "퍼퍼", "푸퍼", "puffer",
      "5패널", "5 패널", "5-패널", "five panel", "5 panel", "캡", "cap", "스냅백", "snapback",
      "메쉬", "mesh", "나이키", "nike", "헤드폰", "headphone", "포타프로", "porta pro", "portapro",
    ],
    msrpKrw: 200000, released: 2017,
    defaultProductType: "shoulder", // Wave 236d — Supreme Shoulder/Mesh/Side bag (mustContain).
  },
  // Wave 205 (2026-05-18): 가격 친화 brand mining — 크록스/칼하트/아크네/메종키츠네.
  // 사용자 정책 "너무 비싸지만 않으면" — 25K~300K 범위 매물 압도적 brand 박음.

  // 크록스 — faved 48~108!! 가격 25~45K (사용자 친화 ⭐⭐⭐)
  {
    id: "shoe-crocs-classic-clog",
    brand: "Crocs", category: "shoe", laneKey: "crocs_classic_clog",
    modelName: "Crocs Classic Clog (시그니처)",
    aliases: ["Crocs Classic", "크록스 클래식", "Crocs 클래식 클로그"],
    mustContain: [["crocs", "크록스"], ["클래식", "classic", "클로그", "clog"]],
    // Wave 220: 별모델 추가 차단 (디스코/퍼/라이트라이드/딜런/스톰프/베이 글리터/언퍼게터블/스타/별무늬)
    // Wave 751 Pareto: 380x spread — BAPE/Salehe Bembury/Balenciaga 한정 협업 차단.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "바야밴드", "bayaband", "바야 밴드", "크러쉬", "crush", "에코", "eco", "플랫폼", "platform", "발레 플랫", "ballet flat",
      "굿즈", "참이슬", "두꺼비",
      "디스코", "disco", "별무늬", "라이트라이드", "lite ride", "딜런", "dylan", "스톰프", "stomp", "베이 글리터", "글리터", "glitter", "퍼클로그", "퍼 클로그", "fur clog", "언퍼게터블", "스웨이드", "비건",
      // Wave 751 (2026-05-24): 한정 협업 차단 (시세 오염 380x spread)
      "bape", "베이프", "에이프", "베이프스타",
      "salehe", "살레헤", "벰버리", "bembury",
      "balenciaga", "발렌시아가",
      "맥퀸", "alexander mcqueen", "mcqueen",
      "스투시 크록스", "stussy crocs", "kith crocs", "키스 크록스",
      "한정판", "리미티드", "limited",
      // Wave 765 (2026-05-27): All-Terrain variant 차단 — 별도 SKU (정가 40%+ 비쌈).
      "all terrain", "all-terrain", "올터레인", "올 터레인", "올터레인 클로그",
    ],
    msrpKrw: 49000, released: 2002,
    defaultProductType: "slipper", // Wave 236e — Classic Clog = slipper.
  },
  // Wave 765 (2026-05-27): Crocs All-Terrain — Classic Clog 의 outdoor/grip variant. 정가 ~7-8만 (Classic 4-5만 보다 비쌈).
  //   audit pid 9002813599589 "크록스 클래식 올터레인 클로그 290" 발견 — Classic 시세로 잘못 비교됨.
  {
    id: "shoe-crocs-all-terrain",
    brand: "Crocs", category: "shoe", laneKey: "crocs_all_terrain",
    modelName: "Crocs All-Terrain Clog",
    aliases: ["Crocs All Terrain", "크록스 올터레인", "All Terrain Clog"],
    mustContain: [["crocs", "크록스"], ["all terrain", "all-terrain", "올터레인", "올 터레인"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "퍼", "fur", "한정판", "리미티드", "limited",
      "bape", "베이프", "balenciaga", "발렌시아가",
    ],
    msrpKrw: 79000, released: 2018,
    defaultProductType: "slipper",
    confusionNote: "Crocs Classic Clog 와 다른 outdoor 모델 (정가 ~7-8만 vs Classic ~4-5만). \"올터레인\" / \"All-Terrain\" 명시된 매물만.",
  },
  {
    id: "shoe-crocs-bayaband",
    brand: "Crocs", category: "shoe", laneKey: "crocs_bayaband",
    modelName: "Crocs Bayaband Clog",
    aliases: ["Crocs Bayaband", "크록스 바야밴드"],
    mustContain: [["crocs", "크록스"], ["바야밴드", "bayaband"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "클래식 클로그", "classic clog", "크러쉬", "crush", "굿즈", "참이슬"],
    msrpKrw: 49000, released: 2018,
    defaultProductType: "slipper", // Wave 236e
  },
  {
    id: "shoe-crocs-crush",
    brand: "Crocs", category: "shoe", laneKey: "crocs_crush",
    modelName: "Crocs Crush / Mega Crush Clog",
    aliases: ["Crocs Crush", "크록스 크러쉬", "Crocs Mega Crush", "메가크러쉬"],
    mustContain: [["crocs", "크록스"], ["크러쉬", "crush", "메가", "mega"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "클래식 클로그만", "바야밴드", "굿즈"],
    msrpKrw: 79000, released: 2022,
    defaultProductType: "slipper", // Wave 236e
  },
  {
    id: "shoe-crocs-platform",
    brand: "Crocs", category: "shoe", laneKey: "crocs_platform",
    modelName: "Crocs Classic Platform (키높이)",
    aliases: ["Crocs Platform", "크록스 플랫폼", "크록스 키높이"],
    mustContain: [["crocs", "크록스"], ["플랫폼", "platform", "키높이"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "굿즈", "참이슬"],
    msrpKrw: 59000, released: 2019,
    defaultProductType: "slipper", // Wave 236e
  },
  {
    id: "shoe-crocs-eco-clog",
    brand: "Crocs", category: "shoe", laneKey: "crocs_eco_clog",
    modelName: "Crocs Eco Clog",
    aliases: ["Crocs Eco", "크록스 에코"],
    mustContain: [["crocs", "크록스"], ["에코", "eco"], ["클로그", "clog"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "굿즈", "참이슬"],
    msrpKrw: 69000, released: 2023,
    defaultProductType: "slipper", // Wave 236e
  },

  // Wave 700 (2026-05-23): Crocs collab + 부츠/슬리퍼/Light Ride SKU 신설.
  // unmatched 216건 분석 — collab/부츠/털 슬리퍼 등 누락.

  {
    id: "shoe-crocs-salehe-bembury-collab",
    brand: "Crocs x Salehe Bembury", category: "shoe",
    modelName: "Crocs x Salehe Bembury (얼친/팜 한정)",
    aliases: ["Salehe Bembury Crocs", "살레헤 벰버리 크록스"],
    mustContain: [["crocs", "크록스"], ["살레헤", "salehe", "벰버리", "bembury"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "11급", "1:1",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 220000, released: 2022, defaultProductType: "slipper",
  },

  {
    id: "shoe-crocs-bape-collab",
    brand: "Crocs x BAPE", category: "shoe",
    modelName: "Crocs x BAPE Collab (네이비/카모/퍼플)",
    aliases: ["BAPE Crocs", "베이프 크록스"],
    mustContain: [["crocs", "크록스"], ["bape", "베이프", "a bathing ape"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "11급",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 220000, released: 2023, defaultProductType: "slipper",
  },

  {
    id: "shoe-crocs-balenciaga-collab",
    brand: "Crocs x Balenciaga", category: "shoe",
    modelName: "Crocs x Balenciaga (러버부츠/플랫폼 luxury)",
    aliases: ["Balenciaga Crocs", "발렌시아가 크록스"],
    mustContain: [["crocs", "크록스"], ["발렌시아가", "balenciaga"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "11급", "1:1", "미러",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 800000, released: 2022, defaultProductType: "boot",
  },

  {
    id: "shoe-crocs-boots-broad",
    brand: "Crocs", category: "shoe",
    modelName: "Crocs Boots (Classic Boot / Mega Crush / Echo Boot)",
    aliases: ["Crocs Boots", "크록스 부츠"],
    mustContain: [["crocs", "크록스"], ["부츠", "boot", "boots"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake",
      "발렌시아가", "balenciaga",  // luxury collab 별도
      "ocean minded",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 119000, released: 2022, defaultProductType: "boot",
  },

  {
    id: "shoe-crocs-slipper-broad",
    brand: "Crocs", category: "shoe",
    modelName: "Crocs Slipper / 털 슬리퍼 / Sandal (Sanrah/Slide)",
    aliases: ["Crocs Slipper", "크록스 슬리퍼", "크록스 샌들"],
    mustContain: [["crocs", "크록스"], ["슬리퍼", "slipper", "샌들", "sandal", "산라", "sanrah", "슬라이드", "slide", "털"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake",
      "클로그", "clog", "boots", "부츠",
      "나이키", "nike", "조던", "jordan", "아디다스", "adidas", "뉴발란스", "new balance",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 69000, released: 2020, defaultProductType: "slipper",
  },

  {
    id: "shoe-crocs-light-ride-broad",
    brand: "Crocs", category: "shoe",
    modelName: "Crocs LiteRide / Light Ride 360",
    aliases: ["Crocs LiteRide", "크록스 라이트라이드"],
    mustContain: [["crocs", "크록스"], ["라이트라이드", "literide", "light ride", "라이트 라이드", "360"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake",
      "삽니다", "구합니다", "매입"],
    msrpKrw: 89000, released: 2018, defaultProductType: "slipper",
  },
  // 칼하트 — 백팩/메신저/Carhartt WIP collab
  {
    id: "bag-carhartt-backpack",
    brand: "Carhartt WIP", category: "bag", laneKey: "carhartt_backpack",
    modelName: "Carhartt WIP Backpack",
    aliases: ["Carhartt Backpack", "칼하트 백팩"],
    mustContain: [["carhartt", "칼하트"], ["백팩", "backpack"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "메신저", "messenger", "클러치", "clutch"],
    msrpKrw: 89000, released: 2015,
  },
  {
    id: "bag-carhartt-messenger",
    brand: "Carhartt WIP", category: "bag", laneKey: "carhartt_messenger",
    modelName: "Carhartt WIP Messenger / Clutch",
    aliases: ["Carhartt Messenger", "칼하트 메신저", "Carhartt Clutch"],
    mustContain: [["carhartt", "칼하트"], ["메신저", "messenger", "클러치", "clutch", "파우치", "pouch", "사이드백"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "백팩", "backpack"],
    msrpKrw: 59000, released: 2015,
  },
  {
    id: "shoe-carhartt-converse-collab",
    brand: "Converse x Carhartt WIP", category: "shoe", laneKey: "carhartt_converse_collab",
    modelName: "Converse × Carhartt WIP 척 70",
    aliases: ["Converse Carhartt", "컨버스 칼하트"],
    mustContain: [["carhartt", "칼하트"], ["converse", "컨버스"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "salomon", "살로몬", "nike", "나이키"],
    msrpKrw: 130000, released: 2020,
  },
  {
    id: "shoe-carhartt-salomon-collab",
    brand: "Salomon x Carhartt WIP", category: "shoe", laneKey: "carhartt_salomon_collab",
    modelName: "Salomon × Carhartt WIP (한정 등산화)",
    aliases: ["Salomon Carhartt", "살로몬 칼하트"],
    mustContain: [["carhartt", "칼하트"], ["salomon", "살로몬"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "converse", "컨버스", "nike", "나이키"],
    msrpKrw: 450000, released: 2022,
  },
  // 아크네 스튜디오 — 5 SKU
  {
    id: "shoe-acne-triplo",
    brand: "Acne Studios", category: "shoe", laneKey: "acne_triplo",
    modelName: "Acne Studios Triplo",
    aliases: ["Acne Triplo", "아크네 트리플로", "아크네스튜디오 트리플로"],
    mustContain: [["acne", "아크네"], ["트리플로", "triplo"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "베르틴", "bertin", "페리", "perry"],
    msrpKrw: 350000, released: 2020,
  },
  {
    id: "shoe-acne-bertin-boots",
    brand: "Acne Studios", category: "shoe", laneKey: "acne_bertin_boots",
    modelName: "Acne Studios Bertin Ankle Boots",
    aliases: ["Acne Bertin", "아크네 베르틴", "베르틴 부츠"],
    mustContain: [["acne", "아크네"], ["베르틴", "bertin"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "트리플로", "triplo"],
    defaultProductType: "boot", // Wave 236e — Bertin Ankle Boots.
    msrpKrw: 590000, released: 2018,
  },
  {
    id: "shoe-acne-manhattan",
    brand: "Acne Studios", category: "shoe", laneKey: "acne_manhattan",
    modelName: "Acne Studios Manhattan Sneakers",
    aliases: ["Acne Manhattan", "아크네 맨하탄", "아크네 맨해튼"],
    mustContain: [["acne", "아크네"], ["맨하탄", "맨해튼", "manhattan"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake",
      // Wave 537: titles with both Manhattan and Rockaway are search-stuffed/ambiguous.
      "락어웨이", "락 어웨이", "rockaway",
      "가방", "bag", "백", "토트", "tote"],
    defaultProductType: "sneaker",
    msrpKrw: 520000, released: 2018,
  },
  {
    id: "shoe-acne-rockaway",
    brand: "Acne Studios", category: "shoe", laneKey: "acne_rockaway",
    modelName: "Acne Studios Rockaway Sneakers",
    aliases: ["Acne Rockaway", "아크네 락어웨이", "아크네 락어웨이 스니커즈"],
    mustContain: [["acne", "아크네"], ["락어웨이", "락 어웨이", "rockaway"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "맨하탄", "맨해튼", "manhattan", "가방", "bag", "백", "토트", "tote"],
    defaultProductType: "sneaker",
    msrpKrw: 520000, released: 2018,
  },
  {
    id: "bag-acne-pvc-tote",
    brand: "Acne Studios", category: "bag", laneKey: "acne_pvc_tote",
    modelName: "Acne Studios PVC Tote / Logo Tote",
    aliases: ["Acne PVC Tote", "아크네 PVC 토트백", "아크네 토트"],
    // Wave 659 (2026-05-22): mustContain narrow — PVC + 토트 둘 다 강제.
    //   이전: pvc OR 토트/tote — 모든 acne 토트 (나일론/캔버스/프린지) 흡수, spread 8.73x.
    //   now: PVC 라인 단독 — 다른 토트는 broad bag SKU로 fallback.
    mustContain: [["acne", "아크네"], ["pvc"], ["토트", "tote"]],
    // Wave 243 (2026-05-19): production audit — "테디 쇼퍼/테디 데님" 730k~1M 매물 broad PVC 매칭.
    // Wave 245.4 (2026-05-19): "무스비" (Musubi 한국 표기 다른 변형) 추가 차단 — production 220만 매물 발견.
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake",
      "musubi", "무수비", "무스비",
      "클러치",
      "여드름", "진정패치", "포켓몬", "치코리타", "클렌저", "클렌징폼", "폼클렌징", "화장품", "코스메틱",
      "테디 쇼퍼", "teddy shopper", "테디 데님", "teddy denim", "테디\\b",
      // Wave 492: Baker/dog-bag rows are not PVC/logo tote comparables.
      "베이커백", "베이커 백", "baker bag", "댕댕이",
      // Wave 659: 별도 라인 (나일론/캔버스/프린지) — 가격대 별개.
      "나일론 토트", "nylon tote", "캔버스 토트", "canvas tote",
      "프린지", "fringe", "페이퍼리", "papery"],
    msrpKrw: 250000, released: 2019,
    defaultProductType: "tote",
  },
  {
    id: "bag-acne-musubi",
    brand: "Acne Studios", category: "bag", laneKey: "acne_musubi",
    modelName: "Acne Studios Musubi Bag (시그니처)",
    aliases: ["Acne Musubi", "아크네 무수비", "Musubi 클러치"],
    // Wave 245.4 (2026-05-19): "무스비" 추가 (Musubi 한국 표기 변형).
    mustContain: [["acne", "아크네"], ["musubi", "무수비", "무스비"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "pvc", "토트만"],
    msrpKrw: 650000, released: 2017,
    defaultProductType: "shoulder", // Wave 608: Musubi 본질 = 숄더백 (매듭 시그니처).
  },
  {
    id: "clothing-acne-apparel",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_apparel",
    modelName: "Acne Studios Apparel (broad — 기타 의류)",
    aliases: ["Acne Apparel", "아크네 의류"],
    // Wave 441: product type 분리 후 기타 의류 catch-all. 명확한 cross-category만 차단한다.
    mustContain: [["acne", "아크네"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake",
      "티셔츠", "tee", "롱슬리브", "롱 슬리브", "긴팔티", "반팔티",
      "세트", "set", "120-130", "120 130", "dkny", "디케이엔와이", "미니로디니", "mini rodini", "minirodini",
      "자켓", "재킷", "저켓", "jacket", "코트", "coat", "무스탕", "블레이저", "야상", "점퍼", "봄버", "ma-1", "ma1", "후리스", "플리스", "fleece",
      "반바지", "shorts", "쇼츠", "밴딩쇼츠",
      "원피스", "dress",
      "팬츠", "pants", "트라우저", "trouser", "치노팬츠", "치노 팬츠", "슬랙스", "slacks",
      "니트", "knit", "스웨터", "sweater", "가디건", "cardigan",
      "peele",
      "폴로", "polo", "카라", "럭비", "rugby", "모자", "cap", "캡", "셔츠", "shirt", "블라우스", "blouse",
      "데님", "denim", "청바지", "jean", "max", "맥스", "bla konst", "블라 콘스트", "블라콘스트", "super baggy", "슈퍼 배기", "슈퍼배기", "오버롤", "멜빵", "점프수트",
      "2021m", "1992m", "리버진", "플레어진", "워싱진", "그레이 진", "스키니진", "블랙진", "화이트진", "리버스테이", "노스",
      "트리플로", "triplo", "베르틴", "bertin", "페리", "perry", "맨하탄", "맨해튼", "manhattan", "락어웨이", "락 어웨이", "rockaway", "스테피", "steffey", "레이스업",
      "musubi", "무수비", "pvc 토트", "신발", "shoe", "슈즈", "가방", "bag",
      "펌프스", "스틸레토", "로퍼", "더비", "옥스포드화", "부츠", "운동화", "스니커즈", "삭스슈즈", "플립플랍", "플립플롭", "flip flop", "쪼리",
      "선글라스", "안경", "바디백", "쇼퍼백", "멀티포켓백", "멀티 포켓", "마이크로백", "토트백", "숄더백", "백팩", "베이커", "카메로", "카메로백",
      "라펠 핀", "핀", "파우치", "고라파덕", "올리브영",
      "머플러", "목도리", "스카프", "scarf", "프린지",
      "르샵", "leshop", "le shop",
      "향수", "퍼퓸", "오드퍼퓸", "오 드 퍼퓸", "edp", "edt", "프레데릭말", "frederic malle", "frederic", "50ml", "100ml",
      // Wave 264 (2026-05-20): 화장품 false positive 차단 (사용자 발견 — "아크네 클렌징폼/스킨/로션" 매물).
      //   "아크네" 가 의류 brand 외에 여드름 치료 화장품 brand 도 있음 (아크네스 / 닥터아크네 등 + 일반 표현).
      "아크네 프로", "겔제", "젤", "클렌저", "클렌징폼", "클렌징 폼", "폼클렌징", "폼 클렌징", "세안", "브러쉬", "스킨", "로션", "크림", "세럼", "여드름", "기능성", "피지케어", "토너", "에센스", "마스크팩", "선크림", "화장품", "코스메틱", "기초", "비비",
      "동아제약", "블랑네이처", "센카", "마루는 강쥐", "인형",
      // Wave 685 (2026-05-22): spread 17x audit — broad fallback이라 cross-category 추가 차단.
      // bag (변형 표기 — 띄어쓰기 / 동의어)
      "숄더 백", "숄 더백", "크로스 백", "크로스백", "백 백", "탑핸들",
      "뽀글이 크로스", "뽀글이 백", "보스턴", "더플", "duffle",
      // shoe (변형)
      "레이스 업", "loafer", "옥스포드", "더비", "메리제인", "스니커",
      // accessory
      "비니", "beanie", "버킷햇", "bucket hat", "베레모", "헌팅캡",
      "벨트", "넥타이", "포켓치프", "안경", "선글",
      // 묶음
      "셋업", "set up", "setup", "set 업", "상하의 세트", "상의 하의",
      // 별도 narrow 라인 (jacquard face logo / skirt)
      "자카드 플랫", "자카드 백", "자카드 숄더",
      "skirt", "스커트", "미니 스커트", "miniskirt",
      // 향수/cosmetic 추가
      "퍼퓸 50", "퍼퓸 100", "오드뜨왈렛", "디퓨저",
      // Wave 715 P0#5 (2026-05-23): 150x spread broad fallback — 추가 cross-category + bag 모델명 강화.
      // Acne bag 모델명 (musubi 외).
      "plaque", "플라크", "whitley", "휘틀리", "kobenhavn", "코펜하겐", "코벤하븐",
      "banner", "배너", "knot backpack", "노트 백팩", "kobun", "코분",
      "mini musubi", "미니 무수비", "마이크로 무수비", "micro musubi",
      "다리오", "dario", "이미테이션 가죽",
      // archive / 한정 (별도 narrow 필요)
      "raf simons", "라프시몬스", "라프 시몬스",
      "monster face", "몬스터 페이스", "페이스 로고",
      // 1990s vintage (잘못 흡수 시 시세 outlier)
      "1990s", "y2k", "00s vintage",
      // Wave 753 (2026-05-24) Pareto: 270x audit — skincare "아크네" 추가 차단 + 쇼핑백 + 시카/일리윤.
      "핌플", "pimple", "트러블", "패치",
      "바디워시", "body wash", "샴푸", "shampoo", "린스",
      "쇼핑백", "shopping bag", "지퍼백",
      "시카", "cica", "일리윤", "유우주",
      "코스알엑스", "cosrx", "닥터자르트", "닥터아크네",
      "오일 컨트롤", "수딩 젤",
    ],
    msrpKrw: 250000, released: 2020,
  },
  // Wave 219 (2026-05-19): Acne Studios product type 분리 — 티 55~80K vs 맨투맨 79~130K vs 자켓 65~110K vs 셔츠 127K
  {
    id: "clothing-acne-tee",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_tee",
    modelName: "Acne Studios Tee / Long-Sleeve",
    aliases: ["Acne 티셔츠", "Acne 롱슬리브"],
    mustContain: [["acne", "아크네"], ["티셔츠", "tee ", "롱슬리브", "롱 슬리브", "긴팔티", "긴팔 티셔츠", "긴팔티셔츠", "롱슬리브 티셔츠", "long sleeve tee", "반팔티"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep", "replica", "fake",
      // Wave 492: "반팔셔츠/button-up shirt" is a shirt, not a tee.
      "버튼업", "버튼 업", "button up", "button-up", "버튼다운", "남방",
      "맨투맨", "후드", "hoodie", "스웻", "스웨트", "sweat", "포바", "forba", "flogho",
      "자켓", "코트", "데님",
      "폴로", "polo", "카라", "럭비", "rugby",
      "원피스", "dress",
      "모스키노", "moschino", "한섬", "시스템", "system", "헬무트랭", "helmut lang",
      "타임", "time homme", "이자벨마랑", "isabel marant", "마쥬", "maje",
      "아미/", "ami/", "비비안", "vivienne westwood",
      "르샵", "leshop", "le shop",
      // Wave 800 (2026-05-24) Phase 2: 72x — skincare false match + 한정 라인.
      "크리미 폼", "크리미폼", "creamy foam", "여드름", "트러블",
      "페어 아크네", "아크네 케어", "acne care", "acne treatment",
      "레이어드 티셔츠 s", "stockholm long sleeve",  // 한정 라인 (530K-650K)
      "스톡홀름 롱슬리브", "한정 티", "limited tee",
    ],
    msrpKrw: 130000, released: 2020,
    defaultProductType: "tee", // Wave 236d — Acne Tee = tee 확정.
  },
  {
    id: "clothing-acne-sweat",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_sweat",
    modelName: "Acne Studios Sweat / Hoodie (Fairview / 페어뷰)",
    aliases: ["Acne 맨투맨", "Acne 후디", "Acne Fairview"],
    mustContain: [["acne", "아크네"], ["맨투맨", "후드", "hoodie", "후디", "스웻", "스웨트", "스웻셔츠", "스웨트셔츠", "스웨트 셔츠", "sweat", "sweatshirt", "sweat shirt", "포바", "forba", "flogho", "페어뷰", "fairview", "페이셜", "facial", "크루넥"]],
    // Wave 800 (2026-05-24) Phase 2: 68x — skincare "아크네 크리미 폼" false match 차단.
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake", "긴팔티", "긴팔 티셔츠", "긴팔티셔츠", "반팔티", "자켓", "코트", "데님", "버튼다운", "남방",
      // skincare "아크네 (acne 여드름)" - clothing-acne-apparel과 동일 패턴
      "크리미 폼", "크리미폼", "creamy foam", "폼클렌징", "클렌징폼",
      "페어 아크네", "fair acne", // skincare brand
      "핌플", "여드름", "트러블", "패치 2매", "마스터 패치",
      "바디워시", "body wash", "샴푸",
    ],
    msrpKrw: 230000, minPriceKrw: 30000, released: 2020,  // Wave 768: Acne sweat floor (가품 차단)
    // Wave 236d: multi product-type (hoodie + crewneck) — default 안 박음. text 추출 의존.
  },
  {
    id: "clothing-acne-jacket-coat",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_jacket_coat",
    modelName: "Acne Studios Jacket / Coat",
    aliases: ["Acne 자켓", "Acne 코트"],
    // Wave 726 (2026-05-24): 모델명 + 다운/패딩 추가 (agent + sample 검증 — 154건 unmatched 중 46건이 코트/롱패딩/트렌치 누락).
    mustContain: [["acne", "아크네"], ["자켓", "jacket", "jacke", "코트", "coat", "재킷", "저켓", "무스탕", "블레이저", "야상", "점퍼", "봄버", "ma-1", "ma1", "후리스", "플리스", "fleece",
      "후드코트", "롱패딩", "트렌치", "다운", "패딩", "수트",
      // 모델명
      "밀턴", "몬트리올", "마틴파우",
    ]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake", "오르빗", "orbit", "핸메", "jw anderson", "jw 앤더슨", "앤더슨", "loewe", "로에베", "르샵", "leshop", "le shop"],
    msrpKrw: 590000, minPriceKrw: 50000, released: 2020,  // Wave 768: Acne jacket/coat floor
    // Wave 236d: multi (jacket + coat) — default 안 박음. text 추출 의존 (regex 가 jacket/coat 구분).
  },
  {
    id: "clothing-acne-shorts",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_shorts",
    modelName: "Acne Studios Shorts",
    aliases: ["Acne Shorts", "아크네 반바지", "아크네 쇼츠"],
    mustContain: [["acne", "아크네"], ["반바지", "shorts", "쇼츠", "밴딩쇼츠"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep", "replica", "fake", "데님", "denim",
      "두개", "두 개", "2개", "2 개", "세개", "세 개", "3개", "묶음", "일괄",
      "세트", "set", "120-130", "120 130", "dkny", "디케이엔와이", "미니로디니", "mini rodini", "minirodini",
    ],
    msrpKrw: 250000, released: 2020,
    defaultProductType: "shorts",
  },
  {
    id: "clothing-acne-dress",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_dress",
    modelName: "Acne Studios Dress / One-Piece",
    aliases: ["Acne Dress", "아크네 원피스"],
    mustContain: [["acne", "아크네"], ["원피스", "dress"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 350000, released: 2020,
    defaultProductType: "dress",
  },
  {
    id: "clothing-acne-pants",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_pants",
    modelName: "Acne Studios Pants / Trousers",
    aliases: ["Acne Pants", "아크네 팬츠", "아크네 트라우저"],
    mustContain: [["acne", "아크네"], ["팬츠", "pants", "트라우저", "trouser", "치노팬츠", "치노 팬츠", "슬랙스", "slacks"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep", "replica", "fake", "반바지", "shorts", "쇼츠", "데님", "denim", "청바지", "jeans",
      // Wave 872: shoe listings can mention pants in styling text ("슬랙스와 잘 어울림").
      "락어웨이", "락 어웨이", "rockaway", "맨하탄", "맨해튼", "manhattan",
      "정품박스", "정품 박스", "밑창", "아웃솔", "스니커즈", "운동화", "신발",
    ],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "pants",
  },
  {
    id: "clothing-acne-knit",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_knit",
    modelName: "Acne Studios Knit / Cardigan",
    aliases: ["Acne Knit", "아크네 니트", "아크네 가디건", "Acne Peele"],
    mustContain: [["acne", "아크네"], ["니트", "knit", "스웨터", "sweater", "가디건", "cardigan", "peele"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep", "replica", "fake", "머플러", "목도리", "스카프", "scarf",
      // Wave 816: multi-brand listing bait such as "얀13 ... 아크네 듀엘 자라".
      "얀13", "yan13", "오일릴리", "오일 릴리", "oilily", "듀엘", "duel", "자라", "zara",
      "지컷", "g cut", "g-cut", "랑방", "lanvin",
    ],
    msrpKrw: 390000, minPriceKrw: 30000, released: 2020,  // Wave 768: Acne knit 가품 floor (사용자 #6 발견 15K 매물 차단)
  },
  {
    id: "clothing-acne-polo",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_polo",
    modelName: "Acne Studios Polo / Rugby Shirt",
    aliases: ["Acne Polo", "아크네 폴로", "아크네 카라티", "아크네 럭비티"],
    mustContain: [["acne", "아크네"], ["폴로", "polo", "카라", "럭비", "rugby"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake", "니트", "knit", "스웨터", "sweater"],
    msrpKrw: 220000, released: 2020,
    defaultProductType: "polo_shirt",
  },
  {
    id: "clothing-acne-cap",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_cap",
    modelName: "Acne Studios Cap / Hat",
    aliases: ["Acne Cap", "아크네 모자", "아크네 캡"],
    mustContain: [["acne", "아크네"], ["모자", "cap", "캡", "hat"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 150000, released: 2020,
    defaultProductType: "cap",
  },
  {
    id: "clothing-acne-max-denim",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_max_denim",
    modelName: "Acne Studios Max Denim",
    aliases: ["Acne Max Denim", "아크네 맥스 데님"],
    mustContain: [["acne", "아크네"], ["max", "맥스"], ["데님", "denim", "청바지", "팬츠", "pants", "로우", "low"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "jeans",
  },
  {
    id: "clothing-acne-bla-konst-denim",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_bla_konst_denim",
    modelName: "Acne Studios Bla Konst Denim",
    aliases: ["Acne Bla Konst Denim", "아크네 블라 콘스트 데님"],
    mustContain: [["acne", "아크네"], ["bla konst", "블라 콘스트", "블라콘스트", "노스", "north"], ["데님", "denim", "청바지", "팬츠", "pants", "진", "30x32", "32x32", "스키니", "피트"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake", "셔츠", "shirt"],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "jeans",
  },
  {
    id: "clothing-acne-super-baggy-denim",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_super_baggy_denim",
    modelName: "Acne Studios Super Baggy Denim",
    aliases: ["Acne Super Baggy Denim", "아크네 슈퍼배기 데님"],
    mustContain: [["acne", "아크네"], ["super baggy", "슈퍼 배기", "슈퍼배기", "슈퍼배기핏", "슈퍼 배기진", "배기진"], ["데님", "denim", "진", "jean"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 520000, released: 2020,
    defaultProductType: "jeans",
  },
  {
    id: "clothing-acne-denim-shorts",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_denim_shorts",
    modelName: "Acne Studios Denim Shorts",
    aliases: ["Acne Denim Shorts", "아크네 데님 쇼츠"],
    mustContain: [["acne", "아크네"], ["데님", "denim"], ["반바지", "shorts", "쇼츠"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "shorts",
  },
  {
    id: "clothing-acne-denim-overall",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_denim_overall",
    modelName: "Acne Studios Denim Overall",
    aliases: ["Acne Denim Overall", "아크네 데님 오버롤"],
    mustContain: [["acne", "아크네"], ["데님", "denim"], ["오버롤", "멜빵", "점프수트", "overall"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake"],
    msrpKrw: 420000, released: 2020,
    defaultProductType: "jeans",
  },
  {
    id: "clothing-acne-denim",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_denim",
    modelName: "Acne Studios Denim (Jean / Shorts)",
    aliases: ["Acne 데님", "Acne 청바지"],
    // Wave 629: '2021m'/'1992m' 한정 라인은 시세 5-7배 outlier — mustContain 제거 + mustNotContain 추가 (narrow lane 별도).
    mustContain: [["acne", "아크네"], ["데님", "denim", "청바지", "반바지", "shorts", "jean", "플레어진", "플레어 진", "리버진", "리버 진", "워싱진", "그레이 진", "스키니진", "블랙진", "화이트진", "리버스테이"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep", "replica", "fake",
      "max", "맥스", "bla konst", "블라 콘스트", "블라콘스트",
      "super baggy", "슈퍼 배기", "슈퍼배기",
      "반바지", "shorts", "쇼츠", "오버롤", "멜빵", "점프수트", "overall",
      "기프트", "패키지", "쇼핑백", "스카프", "머플러", "목도리", "scarf",
      "river", "리버", "rodeo", "로데오", "1995",
      // Wave 629: 한정 라인 분리 (시세 5-7배 outlier).
      "2021m", "1992m", "2003 ", "2003 데님",
      // Wave 716 (2026-05-23): 50x spread audit — Petit 750k outlier 차단 (premium narrow로 routing).
      "petit", "petit 기장", "쁘띠 기장", "쁘띠",
      // 추가 premium 라인 한정
      "플레어 진 premium", "limited edition denim",
    ],
    msrpKrw: 320000, released: 2020,
    defaultProductType: "jeans", // Wave 236d — Acne Denim = jeans 라인 확정.
  },
  {
    id: "clothing-acne-shirt",
    brand: "Acne Studios", category: "clothing", laneKey: "acne_shirt",
    modelName: "Acne Studios Shirt (button / printed)",
    aliases: ["Acne 셔츠"],
    mustContain: [["acne", "아크네"], ["셔츠", "shirt", "버튼다운", "프린팅", "블라우스", "blouse"]],
    mustNotContain: ["키즈", "kids", "복각", "rep", "replica", "fake", "티셔츠", "tee ", "롱슬리브", "맨투맨", "후드", "hoodie", "후디", "스웻", "스웨트", "스웻셔츠", "스웨트셔츠", "스웨트 셔츠", "sweat", "sweatshirt", "sweat shirt", "포바", "forba", "flogho", "크루넥"],
    msrpKrw: 380000, released: 2020,
    defaultProductType: "shirt", // Wave 236d — Acne Shirt = shirt 확정.
  },
  // 메종키츠네 가방 broad — 의류 매물 적고 가방 다수
  {
    id: "bag-kitsune-tote",
    brand: "Maison Kitsuné", category: "bag", laneKey: "kitsune_tote",
    modelName: "Maison Kitsuné Tote / Eco Bag",
    aliases: ["Kitsune Tote", "메종키츠네 토트", "Café Kitsune Tote", "카페 키츠네 토트"],
    mustContain: [["kitsune", "메종키츠네", "키츠네"], ["토트", "tote", "에코백", "쇼퍼"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "케이스", "케이스티파이", "casetify", "에어팟", "아이폰", "iphone", "갤럭시"],
    msrpKrw: 90000, released: 2018,
  },
  // Wave 206 (2026-05-18): 푸마 매물 폭발적 — 스피드캣/팔레르모/Open YY collab + 축구화/풋살화.
  // 사용자 친화 가격 (25K~150K 다수, collab 200~700K).
  {
    id: "shoe-puma-speedcat",
    brand: "Puma", category: "shoe", laneKey: "puma_speedcat",
    modelName: "Puma Speedcat (시그니처)",
    aliases: ["Puma Speedcat", "푸마 스피드캣", "퓨마 스피드캣"],
    mustContain: [["puma", "푸마", "퓨마"], ["스피드캣", "speedcat", "speed cat"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "balenciaga", "오픈yy", "오픈 yy", "openyy", "open yy", "로제", "rose", "rhude", "팔레르모", "palermo"],
    msrpKrw: 109000, released: 2024,
  },
  {
    id: "shoe-puma-palermo",
    brand: "Puma", category: "shoe", laneKey: "puma_palermo",
    modelName: "Puma Palermo",
    aliases: ["Puma Palermo", "푸마 팔레르모"],
    mustContain: [["puma", "푸마", "퓨마"], ["팔레르모", "palermo"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "balenciaga", "오픈yy", "스피드캣", "speedcat"],
    msrpKrw: 119000, released: 2024,
  },
  {
    id: "shoe-puma-openyy-collab",
    brand: "Puma x Open YY", category: "shoe", laneKey: "puma_openyy_collab",
    modelName: "Puma × Open YY (한국 한정 collab)",
    aliases: ["Puma Open YY", "푸마 오픈와이와이", "오픈 yy 스피드캣"],
    mustContain: [["puma", "푸마", "퓨마"], ["오픈yy", "오픈 yy", "openyy", "open yy", "open_yy"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "balenciaga", "로제", "rose", "rhude"],
    msrpKrw: 200000, released: 2023,
  },
  {
    id: "shoe-puma-suede-classic",
    brand: "Puma", category: "shoe", laneKey: "puma_suede_classic",
    modelName: "Puma Suede / Clyde / GV Special",
    aliases: ["Puma Suede", "푸마 스웨이드", "Puma Clyde", "푸마 클라이드", "GV Special"],
    mustContain: [["puma", "푸마", "퓨마"], ["스웨이드", "suede", "클라이드", "clyde", "gv 스페셜", "gv special"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "balenciaga", "스피드캣", "speedcat", "팔레르모", "palermo", "축구화", "풋살화", "농구화"],
    msrpKrw: 109000, released: 1968,
  },
  {
    id: "shoe-puma-football",
    brand: "Puma", category: "shoe", laneKey: "puma_football_broad",
    modelName: "Puma Football / Futsal (울트라 / 킹 / 퓨처)",
    aliases: ["Puma 축구화", "Puma 풋살화", "푸마 울트라", "푸마 킹", "푸마 퓨처"],
    mustContain: [["puma", "푸마", "퓨마"], ["울트라", "ultra", "킹", "king", "퓨처", "future", "축구화", "풋살화", "ag ", "tf ", "mg ", "퓨전니트로"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "스피드캣", "speedcat", "팔레르모", "palermo", "스웨이드", "suede", "농구화",
      // Wave 807: Future Rider is a lifestyle sneaker, not Puma Future football.
      "퓨처 라이더", "future rider", "라이더", "rider",
      // Wave 811: exact football lanes handle true model rows; block common substring/accessory leaks in broad.
      "퓨처캣", "futurecat", "future cat", "라퓨마", "트래킹화", "트레킹화", "마킹", "풀마킹", "유니폼", "저지", "져지",
      "court ultra", "court", "코트", "75 years", "셀돔", "cell dome", "dua lipa", "두아리파",
      "네이마르", "neymar", "월드컵", "world cup", "한정", "한정판", "limited",
      "런칭", "런칭팩", "launch", "creativity팩", "creativity pack", "크리에이티비티",
      "풀리시치", "pulisic", "크리스티안", "주니어", "유소년",
    ],
    msrpKrw: 150000, released: 2020,
  },
  // Wave 207 (2026-05-18): 미즈노 매물 80건+ 압도적 — 축구화/풋살화 시장 거대.
  // 가품 risk 낮음 ⭐ (재팬/JPN 정품 식별 명확, 축구화는 가품 시장 작음).
  {
    id: "shoe-mizuno-morelia",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_morelia",
    modelName: "Mizuno Morelia (basic / II)",
    aliases: ["Mizuno Morelia", "미즈노 모렐리아", "Morelia II"],
    mustContain: [["mizuno", "미즈노"], ["모렐리아", "morelia"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "네오", "neo", "베타", "beta", "살라", "sala", "알파", "alpha", "모나르시다", "monarcida", "골프", "골프채", "아이언", "골프 채"],
    msrpKrw: 130000, released: 1985,
  },
  {
    id: "shoe-mizuno-morelia-neo",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_morelia_neo",
    modelName: "Mizuno Morelia Neo (III / IV / 베타 / 재팬)",
    aliases: ["Mizuno Morelia Neo", "미즈노 모렐리아 네오", "모렐리아 네오 베타"],
    mustContain: [["mizuno", "미즈노"], ["모렐리아", "morelia"], ["네오", "neo"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "살라", "sala", "알파", "alpha", "모나르시다", "monarcida", "골프", "아이언", "골프 채"],
    msrpKrw: 200000, released: 2014,
  },
  {
    id: "shoe-mizuno-alpha",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_alpha",
    modelName: "Mizuno Alpha (1 / 2 / 3 / 엘리트)",
    aliases: ["Mizuno Alpha", "미즈노 알파", "알파 재팬", "알파 엘리트"],
    mustContain: [["mizuno", "미즈노"], ["알파", "alpha"]],
    // Wave 751b Pareto: 700x audit — "(가격 제시)" 같은 placeholder bait 차단.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "모렐리아", "morelia", "살라", "sala", "모나르시다", "monarcida", "골프", "아이언",
      "(가격 제시)", "가격 제시", "가격제시", "(가격제시)", "가격 제안", "가격제안받", "가격 제안받",
    ],
    msrpKrw: 180000, released: 2022,
  },
  {
    id: "shoe-mizuno-monarcida",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_monarcida",
    modelName: "Mizuno Monarcida (보급 라인)",
    aliases: ["Mizuno Monarcida", "미즈노 모나르시다"],
    mustContain: [["mizuno", "미즈노"], ["모나르시다", "monarcida"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "모렐리아", "morelia", "알파", "alpha", "살라", "sala", "골프"],
    msrpKrw: 80000, released: 2018,
  },
  {
    id: "shoe-mizuno-sala",
    brand: "Mizuno", category: "shoe", laneKey: "mizuno_sala",
    modelName: "Mizuno Morelia Sala (풋살화)",
    aliases: ["Mizuno Sala", "미즈노 살라", "모렐리아 살라"],
    mustContain: [["mizuno", "미즈노"], ["살라", "sala"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "알파", "alpha", "모나르시다", "monarcida", "골프"],
    msrpKrw: 130000, released: 2017,
  },
  // Wave 208 (2026-05-18): 살로몬 본 라인 — 매물 60건+ 압도적 (XT-6 시그니처).
  // 가품 risk 낮음 ⭐ (등산화/트레일 시장, 정품 번호 명확 — 474294 등).
  {
    id: "shoe-salomon-xt-6",
    brand: "Salomon", category: "shoe", laneKey: "salomon_xt_6",
    modelName: "Salomon XT-6 (시그니처)",
    aliases: ["Salomon XT-6", "살로몬 XT-6", "XT-6 익스팬스"],
    mustContain: [["salomon", "살로몬"], ["xt-6", "xt 6", "xt6"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "cdg", "꼼데", "comme des", "mm6", "carhartt", "칼하트", "broken arm", "브로큰암", "kar l'art", "샌디리앙"],
    msrpKrw: 250000, released: 2013,
  },
  {
    id: "shoe-salomon-xt-series",
    brand: "Salomon", category: "shoe", laneKey: "salomon_xt_series",
    modelName: "Salomon XT Series (Quest/Whisper/Wings/PU.RE/4/TX-6)",
    aliases: ["Salomon XT-Quest", "살로몬 XT-퀘스트", "XT-Whisper", "XT-위스퍼", "XT-Wings", "XT-4", "TX-6"],
    mustContain: [["salomon", "살로몬"], ["xt-quest", "xt 퀘스트", "xt-whisper", "xt 위스퍼", "xt-wings", "xt 윙스", "xt-pu", "xt pu", "xt-4", "xt 4", "xt4", "살로몬xt 4", "tx-6", "tx 6"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "xt-6", "xt 6", "xt6", "cdg", "꼼데", "mm6", "carhartt", "칼하트",
      // Wave 641: collab/한정 차단.
      "샌디리앙", "sandy liang",
      "슬램잼", "slam jam",
      "더브로큰암", "the broken arm", "broken arm",
      "x j.l-a.l", "jl-a.l", "and wander", "앤원더",
    ],
    msrpKrw: 220000, released: 2016,
  },
  {
    id: "shoe-salomon-xa-pro",
    brand: "Salomon", category: "shoe", laneKey: "salomon_xa_pro",
    modelName: "Salomon XA Pro / XA-Comp / XA 로그",
    aliases: ["Salomon XA Pro", "살로몬 XA프로", "XA-Comp", "XA 로그"],
    mustContain: [["salomon", "살로몬"], ["xa pro", "xa-pro", "xa프로", "xa-comp", "xa comp", "xa 로그", "xa로그", "xa-roughstone"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "cdg", "꼼데", "mm6", "carhartt"],
    msrpKrw: 199000, released: 2012,
  },
  {
    id: "shoe-salomon-acs-pro",
    brand: "Salomon", category: "shoe", laneKey: "salomon_acs_pro",
    modelName: "Salomon ACS Pro / ACS+OG (Advanced)",
    aliases: ["Salomon ACS", "살로몬 ACS", "ACS 프로", "ACS Pro Advanced", "ACS+OG", "버터컵"],
    mustContain: [["salomon", "살로몬"], ["acs", "버터컵"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "cdg", "꼼데", "mm6", "carhartt", "kar l'art"],
    msrpKrw: 290000, released: 2022,
  },
  {
    id: "shoe-salomon-speedcross",
    brand: "Salomon", category: "shoe", laneKey: "salomon_speedcross",
    modelName: "Salomon Speedcross (3/4/5/6)",
    aliases: ["Salomon Speedcross", "살로몬 스피드크로스"],
    mustContain: [["salomon", "살로몬"], ["스피드크로스", "speedcross", "speed cross"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "cdg", "꼼데", "mm6"],
    msrpKrw: 199000, released: 2009,
  },
  {
    id: "shoe-salomon-x-ultra",
    brand: "Salomon", category: "shoe", laneKey: "salomon_x_ultra",
    modelName: "Salomon X-Ultra GTX (등산화)",
    aliases: ["Salomon X-Ultra", "살로몬 X-Ultra", "X-Ultra 5 GTX"],
    mustContain: [["salomon", "살로몬"], ["x-ultra", "x ultra", "x울트라", "xultra"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "cdg", "꼼데"],
    msrpKrw: 230000, released: 2018,
  },
  // Wave 209 (2026-05-18): 아식스 매물 폭발적 60+건 — Gel-1130 시그니처 + 카야노 + 님버스 + collab.
  // 가품 risk 낮음 ⭐ (본 라인 mainstream). collab은 narrow 분리.
  {
    id: "shoe-asics-gel-1130",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_1130",
    modelName: "Asics Gel-1130 (시그니처)",
    aliases: ["Asics Gel-1130", "아식스 젤 1130", "젤-1130", "Gel1130"],
    // Wave 740 leak fix: 218건 unmatched — 매물 "아식스 1130" 단독 "1130" 표기 흔함. mustContain[1]에 "1130" 단독 추가.
    //   다른 brand "1130" 모델 없음 (NB 1130/1100 없음), false positive 위험 낮음.
    mustContain: [["asics", "아식스"], ["gel-1130", "gel 1130", "젤 1130", "젤-1130", "젤1130", "1130"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "키코", "kiko", "세실리에", "cecilie", "슈슈통", "아트모스", "atmos", "오호스", "ojos"],
    msrpKrw: 159000, released: 2008,
  },
  {
    id: "shoe-asics-gel-kayano",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_kayano_broad",
    modelName: "Asics Gel Kayano (14 / 26 / 27)",
    aliases: ["Asics Gel Kayano", "아식스 카야노", "Kayano 14", "젤 카야노"],
    mustContain: [["asics", "아식스"], ["kayano", "카야노", "캬아노"]],
    // Wave 241 (2026-05-19): 사용자 코멘트 — "톰브라운 에디션인데 뒤질래? 기본적인 에디션 구분도 못해?"
    //   Asics x Thom Browne 카야노 14 590k 가 일반 175k SKU 매칭. 가격 3배 차이.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "비비안", "vivienne westwood",
      // Wave 241: Thom Browne collab 차단 (별도 SKU 또는 가격대 분리)
      "톰브라운", "thom browne", "thom-browne", "thombrowne",
      // 다른 designer collab 도 차단 (Jjjjound / cecilie bahnsen / kiko kostadinov 등)
      "jjjjound", "자운드", "kiko", "kostadinov", "코스타디노프",
      "andersson bell", "앤더슨 벨",
    ],
    defaultProductType: "sneaker",
    msrpKrw: 180000, released: 2007,
  },
  {
    id: "shoe-asics-gel-nimbus",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_nimbus",
    modelName: "Asics Gel Nimbus (9 / 10.1 / 다수)",
    aliases: ["Asics Gel Nimbus", "아식스 님버스", "젤 님버스", "젤님버스"],
    mustContain: [["asics", "아식스"], ["nimbus", "님버스", "넘버스", "젤님버스", "젤 님버스"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      // Wave 600: production sample (IQR 2.27) — collab + 한정 색상 차단.
      "언어펙티드", "unaffected", "x unaffected",
      "민나노", "minnano", "x minnano",
      "윈드앤씨", "wind and sea", "x wind and sea", "windandsea",
      "럼 레이진", "rum raisin",
    ],
    msrpKrw: 199000, released: 1999,
  },
  {
    id: "shoe-asics-gel-kinetic",
    brand: "Asics", category: "shoe", laneKey: "asics_gel_kinetic",
    modelName: "Asics Gel Kinetic / Kinetic Fluent",
    aliases: ["Asics Gel Kinetic", "아식스 키네틱", "젤 키네틱"],
    mustContain: [["asics", "아식스"], ["kinetic", "키네틱"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "슈슈통",
      // Wave 649: SP 한정 라인 차단 (330k outlier vs 일반 ~250k).
      "sp ", " sp", "키네틱 sp", "kinetic sp",
    ],
    msrpKrw: 199000, released: 2018,
  },
  {
    id: "shoe-asics-novablast",
    brand: "Asics", category: "shoe", laneKey: "asics_novablast",
    modelName: "Asics Novablast (러닝)",
    aliases: ["Asics Novablast", "아식스 노바블라스트"],
    mustContain: [["asics", "아식스"], ["novablast", "노바블라스트"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "키코", "kiko", "프로토",
      // Wave 876: Superblast already has a ready exact SKU; keep the price axis out of Novablast.
      "superblast", "슈퍼블라스트", "슈퍼 블라스트",
    ],
    msrpKrw: 199000, released: 2020,
  },
  {
    id: "shoe-asics-jog-100",
    brand: "Asics", category: "shoe", laneKey: "asics_jog_100",
    modelName: "Asics Jog 100 / Life Walker (입문)",
    aliases: ["Asics Jog 100", "아식스 조그 100", "Asics Jog 100S", "아식스 조그 100S", "Asics Life Walker", "아식스 라이프워커"],
    mustContain: [["asics", "아식스"], ["jog 100", "jog 100s", "jog 100t", "조그 100", "조그100", "조그 100s", "조그100s", "조그 100t", "조그100t", "life walker", "라이프워커", "라이프 워커"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake"],
    msrpKrw: 79000, released: 2018,
  },
  // collab narrow:
  {
    id: "shoe-asics-kiko-collab",
    brand: "Kiko Kostadinov x Asics", category: "shoe", laneKey: "asics_kiko_collab",
    modelName: "Asics × Kiko Kostadinov (collab)",
    aliases: ["Asics Kiko", "아식스 키코", "Kiko Asics"],
    mustContain: [["asics", "아식스"], ["키코", "kiko"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "세실리에", "cecilie", "비비안", "아트모스", "atmos", "히스테릭"],
    msrpKrw: 250000, released: 2018,
  },
  {
    id: "shoe-asics-cecilie-bahnsen-collab",
    brand: "Cecilie Bahnsen x Asics", category: "shoe", laneKey: "asics_cecilie_bahnsen_collab",
    modelName: "Asics × Cecilie Bahnsen (한정 collab)",
    aliases: ["Asics Cecilie Bahnsen", "아식스 세실리에 반센", "세실리에 반센"],
    mustContain: [["asics", "아식스"], ["세실리에", "반센", "cecilie", "bahnsen", "cecilie bahnsen"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "키코", "kiko", "비비안", "vivienne"],
    msrpKrw: 400000, released: 2023,
  },
  // Wave 210 (2026-05-18): 호카 추가 4 SKU (기존 Bondi 7~X/Clifton 9~10 외 매물 다수 발견).
  {
    id: "shoe-hoka-mafate-speed",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_mafate_speed",
    modelName: "Hoka Mafate Speed 4 (트레일 러닝화)",
    aliases: ["Hoka Mafate Speed", "호카 마파테 스피드"],
    mustContain: [["hoka", "호카"], ["마파테", "mafate"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "satisfy", "새티스파이", "오프닝세레머니", "opening ceremony",
      // Wave 641b: collab 차단.
      "엑슬림", "x-lim", "xlim",
      "j.l-a.l", "jl-a.l", "jl_a_l",
    ],
    msrpKrw: 240000, released: 2023,
  },
  {
    id: "shoe-hoka-mach",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_mach",
    modelName: "Hoka Mach (5 / 6)",
    aliases: ["Hoka Mach", "호카 마하"],
    mustContain: [["hoka", "호카"], ["마하", "mach"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "마파테", "mafate", "본디", "bondi", "클리프턴", "clifton"],
    msrpKrw: 199000, released: 2022,
  },
  {
    id: "shoe-hoka-kaha-gtx",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_kaha_gtx",
    modelName: "Hoka Kaha 2 GTX (등산화)",
    aliases: ["Hoka Kaha", "호카 카하"],
    mustContain: [["hoka", "호카"], ["카하", "kaha"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "본디", "bondi", "클리프턴", "clifton", "마파테", "mafate"],
    msrpKrw: 290000, released: 2022,
    defaultProductType: "boot",
  },
  {
    id: "shoe-hoka-anacapa",
    brand: "Hoka One One", category: "shoe", laneKey: "hoka_anacapa",
    modelName: "Hoka Anacapa Breeze Low",
    aliases: ["Hoka Anacapa", "호카 아나카파"],
    mustContain: [["hoka", "호카"], ["anacapa", "아나카파"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "본디", "bondi"],
    msrpKrw: 199000, released: 2022,
  },
  // FOG (Fear of God) — Nike/Adidas collab + 자체 라인. 한정판 inflation 큼 — narrow 분리 필수.
  {
    id: "shoe-nike-fog-collab",
    brand: "Nike x Fear of God", category: "shoe", laneKey: "nike_fog_collab",
    modelName: "Nike × Fear of God (Air FOG 1 / 라이트본 / 트리플블랙 / Raid / 스카이론2 / 모카신)",
    aliases: ["Nike FOG", "나이키 피어오브갓", "나이키 피어 오브 갓", "에어 피어오브갓", "피오갓"],
    mustContain: [["nike", "나이키"], ["피어 오브 갓", "피어오브갓", "피오갓", "fear of god", "fog "]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "adidas", "아디다스", "essentials", "에센셜", "벨트백", "캘리포니아 뮬"],
    msrpKrw: 350000, released: 2018,
  },
  {
    id: "shoe-adidas-fog-collab",
    brand: "Adidas x Fear of God", category: "shoe", laneKey: "adidas_fog_collab",
    modelName: "Adidas × Fear of God Athletics (86 / 바스켓볼)",
    aliases: ["Adidas FOG", "아디다스 피어오브갓", "FOG Athletics"],
    mustContain: [["adidas", "아디다스"], ["피어 오브 갓", "피어오브갓", "피오갓", "fear of god"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "nike", "나이키", "essentials", "에센셜"],
    msrpKrw: 250000, released: 2024,
  },
  {
    id: "shoe-fog-fear-of-god-self",
    brand: "Fear of God", category: "shoe", laneKey: "fog_fear_of_god_self",
    modelName: "Fear of God 신발 (캘리포니아 뮬 / 101 / 디스턴스 러너 / 로퍼)",
    aliases: ["FOG 신발", "FOG 캘리포니아 뮬", "FOG 디스턴스 러너"],
    // Wave 220: 의류 (8th 밀라노 티 / v넥 티) 차단 — shoe 카테고리 매물만.
    mustContain: [["피어 오브 갓", "피어오브갓", "피오갓", "fear of god"], ["캘리포니아", "california", "디스턴스 러너", "distance runner", "101 레이스업", "101 lace", "로퍼", "loafer", "뮬", "mule", "스니커즈", "sneaker", "신발", "shoe", "샌들"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "nike", "나이키", "adidas", "아디다스", "essentials", "벨트백", "버켄스탁", "birkenstock",
      // Wave 220: 의류 매물 차단 (티셔츠/맨투맨/후디/8th 밀라노)
      "티셔츠", "tee ", "맨투맨", "후드", "후디", "hoodie", "v넥", "vneck", "v-neck", "밀라노"],
    msrpKrw: 600000, released: 2018,
  },
  // 챔피온 / 토미힐피거 (매물 적음 but 박음 — 가품 risk 낮음, 가격 친화)
  {
    id: "shoe-champion-trainer",
    brand: "Champion", category: "shoe", laneKey: "champion_trainer",
    modelName: "Champion Trainer / Slipper",
    aliases: ["Champion Trainer", "챔피온 트레이너"],
    mustContain: [["champion", "챔피온"], ["트레이너", "trainer", "슈즈", "shoes", "스니커즈", "슬리퍼", "slipper", "스퀴시"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "t1", "world", "월드 챔피언스", "키캡"],
    msrpKrw: 79000, released: 2020,
  },
  {
    id: "bag-tommy-hilfiger",
    brand: "Tommy Hilfiger", category: "bag", laneKey: "tommy_hilfiger_bag",
    modelName: "Tommy Hilfiger Bag (Cross/Tote/Nylon)",
    aliases: ["Tommy Hilfiger Bag", "타미힐피거 가방", "토미힐피거 백"],
    // Wave 269 (2026-05-20): "가방" 단순 매물도 catch — mustContain group 2 확장.
    mustContain: [["tommy hilfiger", "토미힐피거", "타미힐피거"], ["크로스백", "cross", "토트백", "tote", "나일론", "여행가방", "가방", "백팩", "backpack", "숄더", "shoulder"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "시계", "watch",
      // 의류 (Wave 269 API sweep — 39%)
      "반팔", "반팔티", "티셔츠", "tee ", "맨투맨", "후드티", "셔츠 ", "자켓", "벨트",
      // 향수
      "edt", "edp", "오드뚜왈렛", "100ml", "50ml",
    ],
    defaultProductType: "shoulder", // Wave 269: 단순 "가방" 매물 fallback
    msrpKrw: 100000, released: 2020,
  },
  // Wave 211 (2026-05-19): 나이키 Air Max 시리즈 + Blazer 매물 폭발적.
  // 기존 catalog (Jordan/AF1/Dunk/Pegasus) 외 추가. Air Max 1/90/95/97 모두 매물 매우 다수.
  {
    id: "shoe-nike-airmax-1",
    brand: "Nike", category: "shoe", laneKey: "nike_airmax_1",
    modelName: "Nike Air Max 1 (broad)",
    aliases: ["Nike Air Max 1", "나이키 에어맥스 1", "에어맥스 1"],
    mustContain: [["nike", "나이키"], ["에어맥스 1", "에어맥스1", "air max 1", "airmax 1", "airmax1"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "에어맥스 90", "에어맥스 95", "에어맥스 97", "air max 90", "air max 95", "air max 97", "travis scott", "트래비스", "오프화이트", "off-white", "off white", "꼼데", "cdg", "리바이스", "levis", "코르테이즈",
      // Wave 622: 추가 collab/한정 차단 (production audit — 아트모스 엘리펀트 850k, 션 우더스푼 800k).
      "아트모스", "atmos", "엘리펀트", "elephant",
      "션 우더스푼", "sean wotherspoon",
      "1/97", "97/1",  // 션 우더스푼 1/97 변형
      "shima", "시마", "patta", "파타", "stussy x", "x stussy",
      "프린세스 다이아나", "princess diana",
    ],
    msrpKrw: 169000, released: 1987,
  },
  {
    id: "shoe-nike-airmax-90",
    brand: "Nike", category: "shoe", laneKey: "nike_airmax_90",
    modelName: "Nike Air Max 90 (broad)",
    aliases: ["Nike Air Max 90", "나이키 에어맥스 90"],
    mustContain: [["nike", "나이키"], ["에어맥스 90", "에어맥스90", "나이키에어맥스90", "에어맥스90다크", "air max 90", "airmax 90", "airmax90"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "에어맥스 1", "에어맥스 95", "에어맥스 97", "air max 1", "air max 95", "air max 97", "off-white", "오프화이트", "꼼데", "cdg", "지갑", "wallet", "카드",
      // Wave 623: collab/한정 차단.
      "올라올루", "olaolu", "slawn", "올라올루 슬론",
      "밸런타인데이 한정", "qs 밸런타인", "qs valentine",
      "patta", "파타",
    ],
    msrpKrw: 159000, released: 1990,
  },
  {
    id: "shoe-nike-airmax-95",
    brand: "Nike", category: "shoe", laneKey: "nike_airmax_95",
    modelName: "Nike Air Max 95 (broad)",
    aliases: ["Nike Air Max 95", "나이키 에어맥스 95"],
    mustContain: [["nike", "나이키"], ["에어맥스 95", "에어맥스95", "나이키에어맥스95", "에어맥스95og", "에어맥스95se", "에어맥스 95og", "에어맥스 95se", "air max 95", "airmax 95", "airmax95"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "에어맥스 1", "에어맥스 90", "에어맥스 97", "off-white", "오프화이트", "꼼데", "cdg", "리바이스", "levis", "코르테이즈", "카하트", "칼하트", "carhartt", "wip", "fog ",
      // Wave 624: collab/한정 색상 차단.
      "캑터스 플라워", "cactus flower",
      "스투시", "stussy",
      "아트모스", "atmos",
      "사이언", "scion",
      "swarovski", "스와로브스키",
      "데이브린", "dave brian", "davebrian",
    ],
    msrpKrw: 199000, released: 1995,
  },
  {
    id: "shoe-nike-airmax-97",
    brand: "Nike", category: "shoe", laneKey: "nike_airmax_97",
    modelName: "Nike Air Max 97 (broad)",
    aliases: ["Nike Air Max 97", "나이키 에어맥스 97"],
    mustContain: [["nike", "나이키"], ["에어맥스 97", "에어맥스97", "나이키에어맥스97", "air max 97", "airmax 97", "airmax97"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "에어맥스 1", "에어맥스 90", "에어맥스 95", "off-white", "오프화이트", "스켑타", "skepta", "언디핏", "undefeated", "퓨추라", "futura", "clot",
      // Wave 543 (2026-05-22): ASIA 한정 (일본 매장 한정, 정품 가격 380~400만 — 일반 30~50만 대비 +20배).
      "asia 정품", "asia 한정", "asia limited", "japan only", "japan 한정", "일본 한정",
      // Wave 661 (2026-05-22): 270 b_grade spread 5.03x audit — OG 실버불렛 200k outlier 차단.
      //   실버불렛은 Air Max 97 OG 시그니처 (1997 데뷔, retro reissue 한정).
      "실버불렛", "silver bullet", "실버 불렛", "og 실버",
      "1997 og", "1997og", "og 1997",
    ],
    msrpKrw: 219000, released: 1997,
  },
  {
    id: "shoe-nike-blazer-broad",
    brand: "Nike", category: "shoe", laneKey: "nike_blazer_broad",
    modelName: "Nike Blazer (broad fallback)",
    aliases: ["Nike Blazer", "나이키 블레이저"],
    // Wave 219: Mid/Low/High variant 분리 후 broad catch-all.
    mustContain: [["nike", "나이키"], ["블레이저", "blazer"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "sakai", "사카이", "꼼데", "cdg", "supreme", "슈프림", "옷", "자켓", "jacket",
      // narrow variant 키워드 제외
      "미드", "mid",
      "로우", "low",
      "하이", "high", "하이탑",
      "플랫폼", "platform"],
    msrpKrw: 109000, released: 1972,
  },
  // Wave 219 (2026-05-19): Nike Blazer variant 분리 — Mid 77 35K vs Low 40K vs Hi 35K vs Platform 40K
  {
    id: "shoe-nike-blazer-mid",
    brand: "Nike", category: "shoe", laneKey: "nike_blazer_mid",
    modelName: "Nike Blazer Mid / Mid 77",
    aliases: ["Blazer Mid", "블레이저 미드", "Blazer Mid 77"],
    mustContain: [["nike", "나이키"], ["블레이저", "blazer"], ["미드", "mid"]],
    // Wave 235 (2026-05-19): Off-White × Blazer Mid collab 95만/73만/65만 가격대 (별도 SKU).
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "sakai", "사카이", "꼼데", "cdg", "supreme", "슈프림", "로우", "low", "하이", "high", "오프화이트", "off-white", "off white", "offwhite", "버질"],
    msrpKrw: 119000, released: 1973,
  },
  {
    id: "shoe-nike-blazer-low",
    brand: "Nike", category: "shoe", laneKey: "nike_blazer_low",
    modelName: "Nike Blazer Low / Low 77 / Platform",
    aliases: ["Blazer Low", "블레이저 로우", "Blazer Low 77", "Blazer Platform"],
    mustContain: [["nike", "나이키"], ["블레이저", "blazer"], ["로우", "low", "플랫폼", "platform"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "sakai", "사카이", "꼼데", "cdg", "supreme", "슈프림", "미드", "mid", "하이탑"],
    msrpKrw: 99000, released: 1973,
  },
  {
    id: "shoe-nike-blazer-high",
    brand: "Nike", category: "shoe", laneKey: "nike_blazer_high",
    modelName: "Nike Blazer Hi / High / Vintage Hi",
    aliases: ["Blazer Hi", "블레이저 하이", "Blazer High"],
    mustContain: [["nike", "나이키"], ["블레이저", "blazer"], ["하이", "high", "하이탑"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "sakai", "사카이", "꼼데", "cdg", "supreme", "슈프림", "미드", "mid", "로우", "low"],
    msrpKrw: 129000, released: 1972,
  },
  {
    id: "shoe-nike-sakai-collab",
    brand: "Nike x Sacai", category: "shoe", laneKey: "nike_sakai_collab",
    modelName: "Nike × Sacai (Blazer / Vaporwaffle / LDV / Cortez)",
    aliases: ["Nike Sacai", "나이키 사카이", "사카이 블레이저", "Sacai Vaporwaffle"],
    mustContain: [["nike", "나이키"], ["sakai", "sacai", "사카이"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "꼼데", "cdg", "fragment", "프래그먼트",
      // Wave 876: exact Sacai model lanes should beat this old broad fallback.
      "베이퍼와플", "베이퍼 와플", "vaporwaffle", "vapor waffle",
      "ld와플", "ld waffle", "ldwaffle", "ldv", "엘디와플",
      "블레이저 로우", "블레이져 로우", "blazer low", "코르테즈", "cortez",
    ],
    msrpKrw: 350000, released: 2019,
  },
  // Wave 212 (2026-05-19): 아디다스 추가 13 SKU — 매물 폭발적 (셔링백 faved 252~255!).
  // 가방:
  {
    id: "bag-adidas-shering",
    brand: "Adidas", category: "bag", laneKey: "adidas_shering",
    modelName: "Adidas Shering Hobo Bag (시그니처)",
    aliases: ["Adidas Shering", "아디다스 셔링백", "Adidas Hobo", "아디다스 호보백"],
    mustContain: [["adidas", "아디다스"], ["셔링", "shering", "호보", "hobo"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "신발", "스니커즈", "운동화",
      // Wave 269 (2026-05-20): API sweep — "아디다스 백셔링 데님 셔츠 우먼즈" 의류 매물 잘못 매칭.
      //   백셔링 = 의류 셔링 디테일 (러플 셔츠 등). 가방 SKU 격리.
      "데님 셔츠", "데님셔츠", "데님 자켓", "셔츠 우먼즈", "백셔링 데님", "러플 셔츠",
      "반팔", "반팔티", "티셔츠", "tee ", "맨투맨", "후드티",
    ],
    defaultProductType: "shoulder", // Wave 269: 호보백 = shoulder
    msrpKrw: 89000, released: 2023,
  },
  {
    id: "bag-adidas-cross-mini",
    brand: "Adidas", category: "bag", laneKey: "adidas_cross_mini",
    modelName: "Adidas Mini Cross / 힙색 / 웨이스트백",
    aliases: ["Adidas Cross", "아디다스 미니", "아디다스 크로스백", "아디다스 힙색"],
    mustContain: [["adidas", "아디다스"], ["미니 숄더", "mini 숄더", "힙색", "hip bag", "웨이스트", "waist", "사이드백", "크로스 미니"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "신발", "스니커즈", "셔링", "호보"],
    msrpKrw: 79000, released: 2020,
  },
  // 신발 시그니처:
  {
    id: "shoe-adidas-campus",
    brand: "Adidas", category: "shoe", laneKey: "adidas_campus",
    modelName: "Adidas Campus (00s / Japan / 80)",
    aliases: ["Adidas Campus", "아디다스 캠퍼스"],
    mustContain: [["adidas", "아디다스"], ["캠퍼스", "campus"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "balenciaga", "라프시몬스", "raf simons", "베이프", "bape", "제레미 스캇", "키스", "kith"],
    msrpKrw: 119000, released: 1980,
  },
  {
    id: "shoe-adidas-spezial",
    brand: "Adidas", category: "shoe", laneKey: "adidas_spezial",
    modelName: "Adidas Spezial (clear pink/black 등)",
    aliases: ["Adidas Spezial", "아디다스 스페지알", "아디다스 스페셜"],
    mustContain: [["adidas", "아디다스"], ["스페지알", "spezial"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "라프시몬스"],
    msrpKrw: 139000, released: 1979,
  },
  {
    id: "shoe-adidas-forum",
    brand: "Adidas", category: "shoe", laneKey: "adidas_forum",
    modelName: "Adidas Forum (Low / Mid / 84)",
    aliases: ["Adidas Forum", "아디다스 포럼"],
    mustContain: [["adidas", "아디다스"], ["포럼", "forum"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "베이프"],
    msrpKrw: 139000, released: 1984,
  },
  {
    id: "shoe-adidas-sl72",
    brand: "Adidas", category: "shoe", laneKey: "adidas_sl72",
    modelName: "Adidas SL72 (vintage retro)",
    aliases: ["Adidas SL72", "아디다스 SL72"],
    mustContain: [["adidas", "아디다스"], ["sl72", "sl 72"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake"],
    msrpKrw: 99000, released: 1972,
  },
  {
    id: "shoe-adidas-stansmith-broad",
    brand: "Adidas", category: "shoe", laneKey: "adidas_stansmith_broad",
    modelName: "Adidas Stan Smith (broad)",
    aliases: ["Adidas Stan Smith", "아디다스 스탠스미스", "Stan Smith"],
    mustContain: [["adidas", "아디다스"], ["스탠스미스", "스탠 스미스", "stan smith"]],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "발렌시아가", "balenciaga", "양면져지", "져지",
      "케이스스터디", "케이스 스터디", "case study", "casestudy",
      "피터팬", "팅커벨", "tinkerbell", "disney", "디즈니",
      "한정판", "한정", "limited",
    ],
    msrpKrw: 119000, released: 1971,
  },
  {
    id: "shoe-adidas-superstar-broad",
    brand: "Adidas", category: "shoe", laneKey: "adidas_superstar_broad",
    modelName: "Adidas Superstar (broad)",
    aliases: ["Adidas Superstar", "아디다스 슈퍼스타"],
    mustContain: [["adidas", "아디다스"], ["슈퍼스타", "superstar"]],
    // Wave 235 (2026-05-19): collab 한정판 다수 mismatch (Clot/Kith/JJJJound/Wales Bonner/Prada/TMNT/Thug Club).
    //   Wales Bonner 는 별도 SKU 있을 수도 — 일단 broad 에서 차단 후 narrow 추가 필요 시 분리.
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "베이프", "bape", "제레미 스캇",
      // Wave 235 collab 차단
      "클랏", "clot", "prada", "프라다", "jjjjound", "자운드", "kith", "키스",
      "wales bonner", "웨일즈보너", "웨일즈 보너", "pleasure", "플레저", "pleasures",
      "닌자 거북이", "닌자거북이", "tmnt", "거북이 슈퍼스타", "thug club", "떠그클럽", "떠그 클럽",
      "ot-tech", "ot tech", "clot 슈퍼스타", "프라다 슈퍼스타",
      "송포더뮤트", "송 포 더 뮤트", "song for the mute", "songforthemute", "sftm",
      // Wave 422: Superstar 본품 sneaker lane에서 apparel/mule 파생상품 분리.
      "트랙수트", "트랙탑", "져지", "저지", "jersey", "아디폼", "adifom", "뮬", "mule",
      // Wave 457: named Superstar derivatives stay out of the plain broad lane until separately vetted.
      // Wave 699 (2026-05-23): 차단 완화 — 80s/Premium/메탈토는 정상 colorway variant. 광범위 차단으로 253건 매칭 fail (37.6%).
      // narrow SKU 부재한 80s/Premium variant도 broad에서 흡수 → 풀 +250건.
      // "80s", "80's", "80 s", "80S", "80v", "80 v", "dlx",  ← 제거
      // "프리미엄", "premium", "메탈토", "metal toe",  ← 제거
      "farm", "팜", "parley", "팔리",
      "슬립온", "slip-on", "slip on", "slipon", "360",
      "퍼피렛", "pufflet",
      "마운티어링", "mountaineering", "d-mop", "dmop", "디몹",
      "발렌타인", "한정판",
      "레고", "lego", "보네가", "bonega",
      "션 우더스푼", "션우더스푼", "sean wotherspoon", "wotherspoon",
      // Wave 699 추가 차단 (다른 brand 충돌):
      "골든구스", "golden goose", "ggdb",  // 골든구스 슈퍼스타 (다른 brand)
      "y-3", "y3", "요지", "yohji",  // Y-3 collab (별 시세)
      "닌텐도", "nintendo", "마리오", "mario",  // 닌텐도 게임 false positive
      "퍼렐 윌리엄스", "pharrell williams",  // 퍼렐 collab
      "songforthemute", "송포더뮤트",  // 이미 있음 보강
      "30주년", "30 anniversary", "duke", "듀스",  // 30주년/Duke 한정
      "콘 슈퍼스타", "콘슈퍼스타",  // 콘 (콘솔/캐릭터) variant
      // Wave 820: latest broad sample audit — non-shoe/accessory and collab variants.
      "볼캡", "모자", "cap", "골프화", "golf",
      "human made", "humanmade", "휴먼메이드",
      "willy chavarria", "윌리 차바리아", "차바리아",
      "beyonce", "비욘세", "disney", "디즈니",
      "caroline hu", "caroline", "캐롤라인",
    ],
    msrpKrw: 119000, released: 1969,
  },
  {
    id: "shoe-adidas-ultraboost",
    brand: "Adidas", category: "shoe", laneKey: "adidas_ultraboost",
    modelName: "Adidas Ultra Boost (21/24/5.0)",
    aliases: ["Adidas Ultraboost", "아디다스 울트라부스트", "Ultra Boost"],
    mustContain: [["adidas", "아디다스"], ["울트라부스트", "ultraboost", "ultra boost"]],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      // Wave 811: Nemeziz/Tango football trainers often mention Ultra Boost
      // cushioning in the description; keep them in the football broad lane.
      "네메시스", "nemeziz", "탱고", "tango", "축구화", "풋살화", "축구트레이닝화", "football",
    ],
    msrpKrw: 219000, released: 2015,
  },
  {
    id: "shoe-adidas-adilette",
    brand: "Adidas", category: "shoe", laneKey: "adidas_adilette",
    modelName: "Adidas Adilette (슬리퍼 + 플랫폼 클로그)",
    aliases: ["Adidas Adilette", "아디다스 아딜렛"],
    mustContain: [["adidas", "아디다스"], ["아딜렛", "adilette"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake"],
    msrpKrw: 49000, released: 1972,
    defaultProductType: "slipper", // Wave 236e — Adilette = slipper.
  },
  {
    id: "shoe-adidas-football",
    brand: "Adidas", category: "shoe", laneKey: "adidas_football_broad",
    modelName: "Adidas Football (F50 / Predator / Copa / X Crazyfast / Nemeziz / Messi)",
    aliases: ["Adidas F50", "아디다스 F50", "Adidas Predator", "프레데터", "Adidas X Crazyfast"],
    mustContain: [["adidas", "아디다스"], ["f50", "f50tf", "f50ag", "f50fg", "f50엘리트", "f50 elite", "프레데터", "predator", "copa", "코파", "crazyfast", "크레이지패스트", "네메시스", "nemeziz", "메시", "messi", "축구화", "풋살화"]],
    // Wave 265 (2026-05-20): 한정판/시그니처 매물 차단 (사용자 발견 — broad sku_median 99k 인데 매물 35만~110만).
    //   sample: 베이프 F50 / 메시 크레이지페스트 / 프레데터 지단 한정 / 벨링엄 / 토니크로스 / 나나미 / 엑셀레이터 / 아카이브 / 한정판
    //   broad 시세 sample 오염 — 한정/시그니처 별도 시세 (10x). broad SKU 차단 → sku_id=NULL → 시세 sample 제외.
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "스탠스미스", "캠퍼스", "포럼",
      // Wave 265: 한정판/시그니처 (broad 시세 오염 차단)
      "한정", "한정판", "limited", "엑셀레이터", "accelerator", "아카이브", "archive",
      "지단", "zidane", "벨링엄", "bellingham", "토니크로스", "kroos", "메시 한정",
      "나나미", "nanami", "벨라즈", "veloz",
      "베이프", "bape", "비에이프", // 베이프 F50 collab
      "supreme", "슈프림", // Supreme collab
      "정품 보장", "100% 정품 보장",
      // buy intent
      "삽니다", "매입", "구합니다", "구해요", "구함",
      // Wave 545 (2026-05-22): broad football sample wide variant.
      //   주의: "f50 엘리트" 단독은 test fixture 정상 매물 expectation → 차단 X.
      //   대신: 메시 시그니처 라인 + 축구공 동봉 세트만 차단 (variant 분산 큼).
      "축구공 세트", "축구공/가방", "축구공 가방", "축구공 동봉", "축구공포함",
      "축구공", "미니볼", "공인구", "매치볼",
      "메시 튜닛 엘리트", "messi tunit elite", "메시 튜닛",
      "최상급 축구화",
      // Wave 751 (2026-05-24) Pareto: 960x spread audit — goalkeeper gloves false match.
      "골키퍼 장갑", "골키퍼장갑", "키퍼 장갑", "키퍼장갑", "gk 장갑", "goalkeeper",
      // 가격 제안받아요 같은 bait
      "가격 제안받아", "가격제안받아", "가격제시받",
    ],
    msrpKrw: 199000, released: 2014,
  },
  {
    id: "shoe-adidas-adizero",
    brand: "Adidas", category: "shoe", laneKey: "adidas_adizero",
    modelName: "Adidas Adizero (SL2 / Boston / 5 / EvoSL — 러닝)",
    aliases: ["Adidas Adizero", "아디다스 아디제로", "Adizero Boston", "Adizero SL"],
    mustContain: [["adidas", "아디다스"], ["아디제로", "adizero"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake"],
    msrpKrw: 199000, released: 2004,
  },
  // collab 한정 narrow:
  {
    id: "shoe-adidas-balenciaga-collab",
    brand: "Adidas x Balenciaga", category: "shoe", laneKey: "adidas_balenciaga_collab",
    modelName: "Adidas × Balenciaga (Stan Smith/Triple S 한정)",
    aliases: ["Adidas Balenciaga", "아디다스 발렌시아가", "발렌시아가 스탠스미스"],
    mustContain: [["adidas", "아디다스"], ["발렌시아가", "balenciaga"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "라프시몬스", "베이프", "제레미"],
    msrpKrw: 700000, released: 2022,
  },
  {
    id: "shoe-adidas-rafsimons-collab",
    brand: "Adidas x Raf Simons", category: "shoe", laneKey: "adidas_rafsimons_collab",
    modelName: "Adidas × Raf Simons (Matrix Spirit 등)",
    aliases: ["Adidas Raf Simons", "아디다스 라프시몬스"],
    mustContain: [["adidas", "아디다스"], ["라프시몬스", "raf simons", "rafsimons"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "발렌시아가", "베이프", "제레미"],
    msrpKrw: 350000, released: 2013,
  },
  // Wave 214 (2026-05-19): 의류 mainstream 추가 — 사용자 명시 "옷 안 버린다".
  // 매물량 ⭐⭐⭐ + 가품 식별 가능 + 친화 가격 brand 9개.

  // 베이프 (BAPE) — 매물 118건, faved 94! 압도적
  {
    id: "clothing-bape-tee",
    brand: "A Bathing Ape (BAPE)", category: "clothing", laneKey: "bape_tee",
    modelName: "BAPE T-Shirt (basic Ape Head/카모)",
    aliases: ["BAPE Tee", "베이프 티셔츠", "Ape Head Tee"],
    // Wave 726 (2026-05-24): 롱슬리브/긴팔티/슬리브리스 추가 (agent a34e36f9 결과 — 269건 unmatched).
    mustContain: [["bape", "베이프", "a bathing ape"], ["반팔", "티셔츠", "tee ", "t-shirt", "tshirt", "긴팔티", "긴팔 티", "long sleeve", "롱슬리브", "롱 슬리브", "슬리브리스", "sleeveless"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "carbon",
      "후드", "후디", "hoodie", "후드집업", "집업", "zip", "맨투맨", "크루넥", "crewneck", "sweatshirt",
      "샤크", "shark", "yeezy", "스타워즈", "신발", "스니커즈", "운동화",
      // Wave 764/765: BAPE sub-line 차단 — 공통 const 로 다른 BAPE SKU 들과 동일.
      ...BAPE_SUBLINE_NOISE,
      // Wave 241 (2026-05-19): 사용자 코멘트 — BAPE tee SKU 안 콜라보 가격 45~520k 다 한 시세.
      //   collab 별 가격 천차만별 — 별도 SKU 또는 차단 필요.
      "travis scott", "트래비스 스캇", "트래비스스캇", "cactus jack",
      "콜라보", "collab",
      "puma", "푸마 콜라보", "puma collab", "puma x bape",
      "adidas", "아디다스", "aape", "오마주", "fubu", "푸부",
      "lacoste", "라코스테", "tommy", "타미", "자운드", "jound",
      "꼼데가르송", "cdg", "comme des garcons", "오사카 카모 박스",
      "스왈로브스키", "swarovski", "1st 스왈로브스키",
      "뉴진스", "newjeans", "하니 컬리지", "황계",
      "세인트미카엘", "saint michael", "st michael",
      // Wave 593: 띄어쓰기 변형 + 산리오/DSM/한정 collab 추가 차단.
      "세인트 마이클", "세인트마이클", "세인트 베이프", "saint bape", "saint mxxxxxx",
      "산리오", "sanrio", "키티 캐릭터", "헬로키티", "hello kitty",
      "dsm", "dover street market", "도버 스트리트 마켓",
      "힙플페", "힙합플레이어", "hiphopplayer",
      "익스클루시브", "exclusive",
      "한정판", "limited edition", " 한정 ",
      // Wave 593b: 재팬시티/STASH/Russell collab 추가.
      "재팬시티", "재팬 시티", "japan city",
      "stash", "x stash", "스태쉬",
      "러셀", "russell", "x russell",
      // Wave 594: Union LA collab 추가.
      "union", "유니온", "x union", "union x",
      // Wave 594b: COACH collab 추가 (c_grade audit).
      "coach", "코치", "x coach", "coach x", "bape x coach",
      // Wave 632: 추가 한정 collab/패턴.
      "반고흐뮤지엄", "반고흐 뮤지엄", "van gogh", "vangogh", "고흐",
      "abc 도트", "abc dot", "도트 카모", "dot camo",
      "네이버후드", "neighborhood", "바시티",
      "몽클레어", "몽클레르", "moncler",
      "stussy", "스투시 x bape", "스투시x베이프",
      "wtaps", "더블탭스",
      "갓 셀렉션", "god selection", "톰과제리", "tom and jerry", "chocolate", "chocolte",
      // Wave 679 (2026-05-22): 추가 collab/한정/롱슬리브 차단 (bape_tee release 전 narrow).
      // 요시다포터 / 챔피온 collab + 풋볼/사쿠라/빅사루 한정 + 빈티지 시즌 + 묶음 매물.
      "요시다포터", "요시다 포터", "yoshida porter", "포터",
      "챔피온", "champion", "x champion", "champion x",
      "풋볼 티셔츠", "풋볼 져지", "football tee", "football jersey", "풋볼티",
      "사쿠라 포토", "sakura photo", "사쿠라",
      "빅사루", "big saru", "big-saru",
      "베이비 마일로", "baby milo", "babymilo", "milo on",
      // Wave 812 follow-up: sample groups still had high-spread special tees.
      "레이디스", "우먼", "women", "womens", "크롭", "crop",
      "나고야", "nagoya", "go! ape", "go ape",
      "스트로베리", "strawberry",
      "클라우드 카모", "japanese cloud", "재패니즈 클라우드",
      // 빈티지 시즌 (2013~2020 빈티지 시세 별도)
      "2013 베이프", "2014 베이프", "2015 베이프", "2016 베이프",
      "2017 베이프", "2018 베이프", "2019 베이프",
      "베이프 2013", "베이프 2014", "베이프 2015",
      // 롱슬리브 (별도 product_type)
      "롱슬리브", "long sleeve", "long-sleeve", "롱슬리브 티셔츠", "긴팔",
      // 묶음 매물
      "tee-s & tote", "tee-s tote", "tee tote set", "tee 토트 세트",
    ],
    msrpKrw: 199000, released: 1993,
  },
  // Wave 413 (2026-05-20): BAPE basic apparel product-type split.
  // Existing bape_tee was catching hoodie/hoodie_zip/crewneck rows, so keep the
  // split lanes blocked until sample quality is audited separately.
  {
    id: "clothing-bape-hoodie",
    brand: "A Bathing Ape (BAPE)", category: "clothing", laneKey: "bape_hoodie",
    modelName: "BAPE Hoodie (basic/camo, non-Shark)",
    aliases: ["BAPE Hoodie", "베이프 후드", "베이프 후드티"],
    mustContain: [["bape", "베이프", "a bathing ape"], ["후드", "후드티", "후디", "hoodie"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "샤크", "shark", "집업", "zip", "풀집", "풀 집", "풀집업", "풀 집업", "반집업", "half zip", "신발", "스니커즈", "운동화",
      ...BAPE_SUBLINE_NOISE,  // Wave 765
      "콜라보", "collab", "travis scott", "트래비스 스캇", "트래비스스캇", "cactus jack", "puma", "푸마", "adidas", "아디다스", "new balance", "newbalance", "뉴발란스", "뉴발", "aape", "오마주", "fubu", "푸부",
      "lacoste", "라코스테", "tommy", "타미", "자운드", "jound",
      "네이버후드", "neighborhood", "wtaps", "더블탭스", "갓 셀렉션", "god selection",
      "톰과제리", "tom and jerry", "chocolate", "chocolte", "자켓", "재킷", "jacket", "스노우보드자켓", "스노우보드재킷", "snowboard",
      // Wave 680 (2026-05-22): spread 20x audit — collab/한정 추가 차단 + 가품 시그널.
      "ponr", "point of no return", "스페이스 카모",
      "patchwork", "패치워크", "abc camo patchwork", "패치워크 후드",
      "85주년", "85th", "85 anniversary",
      "돌 멀티 인형", "인형 세트", "돌 인형", "인형 2개", "인형 묶음",
      "흑계", "흑계 정품",  // 가품 거래 코드 워딩
      "대장급", "대장 급", "탑급",  // 가품 의심 워딩
      "정품 택O", "정품택 o", "정품 보관",  // 가품 마케팅 표지
      // 시즌 빈티지 (가격대 다름)
      "2013 베이프", "2014 베이프", "2015 베이프", "2016 베이프",
      "2017 베이프", "2018 베이프", "2019 베이프",
      "베이프 2013", "베이프 2014", "베이프 2015"],
    msrpKrw: 320000, released: 1993,
  },
  {
    id: "clothing-bape-hoodie-zip",
    brand: "A Bathing Ape (BAPE)", category: "clothing", laneKey: "bape_hoodie_zip",
    modelName: "BAPE Hoodie Zip (basic/camo, non-Shark)",
    aliases: ["BAPE Hoodie Zip", "베이프 후드집업", "베이프 집업후드"],
    mustContain: [["bape", "베이프", "a bathing ape"], ["후드집업", "집업후드", "집업", "풀집", "풀 집", "풀집업", "풀 집업", "zip up", "zip-up", "full zip"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "샤크", "shark", "신발", "스니커즈", "운동화",
      ...BAPE_SUBLINE_NOISE,  // Wave 765
      "콜라보", "collab", "travis scott", "트래비스 스캇", "트래비스스캇", "cactus jack", "puma", "푸마", "adidas", "아디다스", "new balance", "newbalance", "뉴발란스", "뉴발", "aape", "오마주", "fubu", "푸부",
      "lacoste", "라코스테", "tommy", "타미", "자운드", "jound",
      "네이버후드", "neighborhood", "wtaps", "더블탭스", "갓 셀렉션", "god selection",
      "톰과제리", "tom and jerry", "chocolate", "chocolte",
      // Wave 681: bape_hoodie 패턴 spread (PONR/Patchwork/85주년/가품 시그널/빈티지 시즌).
      "ponr", "point of no return", "스페이스 카모",
      "patchwork", "패치워크",
      "85주년", "85th",
      "흑계", "대장급", "탑급",
      "스타베이프", "star vape", "스웨터", "sweater", "니트", "knit",
      "2013 베이프", "2014 베이프", "2015 베이프", "2016 베이프",
      "2017 베이프", "2018 베이프", "2019 베이프"],
    msrpKrw: 360000, released: 1993,
  },
  {
    id: "clothing-bape-crewneck",
    brand: "A Bathing Ape (BAPE)", category: "clothing", laneKey: "bape_crewneck",
    modelName: "BAPE Crewneck / Sweatshirt",
    aliases: ["BAPE Crewneck", "베이프 맨투맨", "베이프 크루넥"],
    mustContain: [["bape", "베이프", "a bathing ape"], ["맨투맨", "크루넥", "crewneck", "sweatshirt", "스웻셔츠", "스웻 셔츠"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "샤크", "shark", "후드", "hoodie", "집업", "zip", "신발", "스니커즈", "운동화",
      ...BAPE_SUBLINE_NOISE,  // Wave 765
      "콜라보", "collab", "travis scott", "트래비스 스캇", "트래비스스캇", "cactus jack", "puma", "푸마", "adidas", "아디다스", "aape", "오마주", "fubu", "푸부",
      "lacoste", "라코스테", "tommy", "타미", "자운드", "jound",
      "네이버후드", "neighborhood", "wtaps", "더블탭스", "갓 셀렉션", "god selection",
      "톰과제리", "tom and jerry", "chocolate", "chocolte",
      // Wave 591 (2026-05-22): 스와로브스키 OG 한정 (49만 outlier vs 일반 6.5~30만 +6배).
      "스와로브스키", "swarovski", "1st 스와로브스키",
      // Wave 594c: 추가 한정 디자인 차단 (sample audit — a_grade spread 4.3x).
      "라인스톤", "rhinestone", "크리스탈 라인스톤",
      "유니언잭", "union jack",
      "시티 카모", "city camo", "페인팅 크루넥",
      "25ss", "25fw", "아트 카모", "art camo",
      // Wave 681: 추가 collab/한정/가품 시그널 (bape_tee/hoodie 패턴 spread).
      "ponr", "point of no return", "스페이스 카모",
      "patchwork", "패치워크",
      "85주년", "85th",
      "흑계", "대장급",
      "사쿠라", "빅사루", "베이비 마일로", "baby milo",
      "2013 베이프", "2014 베이프", "2015 베이프", "2016 베이프",
      "2017 베이프", "2018 베이프", "2019 베이프",
    ],
    msrpKrw: 280000, released: 1993,
  },
  {
    id: "clothing-bape-shark-hoodie",
    brand: "A Bathing Ape (BAPE)", category: "clothing", laneKey: "bape_shark_hoodie",
    modelName: "BAPE Shark Hoodie (시그니처 한정)",
    aliases: ["BAPE Shark", "베이프 샤크", "Shark Hoodie", "샤크 후드"],
    mustContain: [
      ["bape", "베이프", "a bathing ape"],
      ["샤크", "shark"],
      ["후드", "후드티", "후디", "hoodie", "hooded", "후드집업", "집업후드", "반집업", "half zip", "풀집업", "풀 집업", "full zip", "zip up"],
    ],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "신발", "운동화", "야구", "농구", "축구",
      ...BAPE_SUBLINE_NOISE,  // Wave 765
      "티셔츠", "tee ", "t-shirt", "tshirt", "롱슬리브", "long sleeve", "팬츠", "pants", "바지", "쇼츠", "shorts", "반바지",
      "맨투맨", "크루넥", "crewneck", "sweatshirt",
      "콜라보", "collab", "puma", "푸마", "adidas", "아디다스", "aape", "오마주", "fubu", "푸부",
      "lacoste", "라코스테", "tommy", "타미", "자운드", "jound",
      "네이버후드", "neighborhood", "wtaps", "더블탭스", "갓 셀렉션", "god selection",
      // Wave 635: BAPE Shark 한정 colorway/variant 차단 (시세 600k+ outlier vs 일반 ~250k).
      "스켈레톤 샤크", "skeleton shark", "skeleton",
      "퍼스트 카모", "first camo",
      "스플릿 카모", "split camo",
      "메가 샤크", "mega shark", "메가샤크",
      "보아 후드", "boa hoodie", "보아샤크",
      "네온 카모", "neon camo",
      // Wave 638: 추가 한정 (Japanese Tattoo / 야광 시티카모).
      "재패니즈 타투", "japanese tattoo", "tattoo shark",
      "야광 시티", "야광시티", "야광 카모", "글로우 인 더 다크", "glow in the dark",
    ],
    msrpKrw: 450000, released: 2005,
    // Wave 236f (2026-05-19): audit 발견 — BAPE Shark 패턴이 pants/tee/조거에도 출시 (multi-line model).
    //   사용자 코멘트: "이게 왜 같은 sample?" — Shark 패딩 SKU 에 조거팬츠 매칭.
    //   defaultProductType 제거 → text 미명시 매물 needsReview 차단 (사용자 정책).
    //   text 명시 매물 (e.g. "BAPE 샤크 후드티") 은 정상 통과 (regex 가 hoodie 추출).
  },
  // 마뗑킴 (Matin Kim) — 한국 디자이너, 매물 63건
  // Wave 729 (2026-05-24): unmatched sweep — apparel-only sample 결과 다음 product 누락:
  //   니트/코트/다운/패딩/점퍼/푸퍼/베스트/조끼/탱크탑/카디건/바람막이/팬츠/데님 = 75% miss.
  //   casetify 폰케이스 collab은 phone accessory → 차단.
  {
    id: "clothing-matinkim",
    brand: "Matin Kim", category: "clothing", laneKey: "matinkim_apparel",
    modelName: "Matin Kim Apparel (티/후드/맨투맨/니트/코트/다운/팬츠)",
    aliases: ["Matin Kim", "마뗑킴", "마틴킴"],
    mustContain: [
      ["matin kim", "마뗑킴", "마틴킴"],
      [
        // 기존
        "반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "크루넥", "자켓", "jacket", "셔츠", "가디건",
        // Wave 729 추가
        "니트", "knit", "스웨터", "sweater", "카디건", "cardigan",
        "코트", "coat", "트렌치", "trench",
        "다운", "패딩", "푸퍼", "puffer", "점퍼", "jumper",
        "베스트", "vest", "조끼",
        "탱크탑", "tank top", "탱크 탑", "슬리브리스", "sleeveless",
        "바람막이", "windbreaker", "윈드브레이커",
        "팬츠", "pants", "바지", "데님", "denim", "청바지",
        "쇼츠", "shorts",
        "스커트", "skirt", "원피스", "dress",
      ],
    ],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      // Wave 729: 가방/지갑/액세서리 (사용자 정책 — bag ready X)
      "가방", "bag", "백팩", "지갑", "wallet", "키링", "키 링", "key chain",
      "버킷햇", "bucket hat", "토트", "tote", "파우치", "pouch",
      "슬링백", "숄더백", "크로스백", "버클백", "쇼퍼",
      // Wave 729: casetify 폰케이스 collab — phone accessory (별 시세)
      "casetify", "케이스티파이", "아이폰", "iphone", "갤럭시", "galaxy",
      "폰 케이스", "폰케이스", "phone case", "카드홀더",
      "신발",
    ],
    msrpKrw: 119000, released: 2020,
  },
  // 리복 — 매물 47건, 의류 (트랙수트 / 빅로고 티)
  {
    id: "clothing-reebok-apparel",
    brand: "Reebok", category: "clothing", laneKey: "reebok_apparel",
    modelName: "Reebok Apparel (트랙수트 / 빅로고 티 / 자켓)",
    aliases: ["Reebok Apparel", "리복 의류", "리복 트랙수트"],
    mustContain: [["reebok", "리복"], ["반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "자켓", "jacket", "트랙수트", "trackuit", "윈드브레이커"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "운동화", "스니커즈", "신발", "shoe"],
    msrpKrw: 89000, released: 2020,
  },
  // 아크테릭스 — Wave 218 (2026-05-19) 모델별 narrow 분리.
  //   사용자 지적: clothing-arcteryx CV 0.67 — Beta SL/AR 180~600K vs Gamma MX/SL 185~330K
  //   vs Atom LT 290K vs Vertex 280K vs Squamish 190K. 모델 가격대 X 3-5.
  //   broad clothing-arcteryx 는 catch-all 유지.
  {
    id: "clothing-arcteryx-beta",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_beta",
    modelName: "Arc'teryx Beta (SL / AR / LT) Gore-Tex 자켓",
    aliases: ["Beta Jacket", "베타 자켓", "Beta SL", "Beta AR", "Beta LT", "Beta Globe"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["beta", "베타"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      // Wave 540 (2026-05-22): production sample audit — 22건 오염 발견.
      //   사용자 명령 "파서 더 강화". DB sweep + supabase로 확인.
      //   sample 가격 폭이 변동 큰 variant 차단:
      //   - 빔즈/Beams 콜라보 (가격 +40~50% premium)
      //   - 바이탈리티/VITALITY 한정 컬러 (60~140만, +30~50%)
      //   - Beta SV (Severe Weather, top tier, +30%)
      //   - Beta Insulated (다운자켓 변형, 970만대)
      //   - 팬츠/pants (jacket SKU에 팬츠 매물 잘못)
      "빔즈", "beams", "나고미", "nagomi",
      "바이탈리티", "vitality",
      "베타 sv", "beta sv", " sv ",
      "인슐레이티드", "insulated",
      "다운 인슐레이티드", "다운 자켓", "다운자켓",
      "팬츠", "pants",
      // Wave 584 (2026-05-22): Beta 변형/콜라보 narrow 차단 (다른 세션 narrow 좁힘 패턴).
      "솔레스", "soles",  // Soles Beta = 별도 variant
      "카딘", "cardin",  // Cardin x Arc'teryx 변형
      "하이브리드", "hybrid",  // Beta SL Hybrid 별도 라인 (가격 +20%)
      "데이즈", "daze",  // Daze 한정 컬러
      // 여성 size 별도 시세 (남성과 가격 변동) — Wave 539 패턴 (Polo boys hold)
      "여성 2xl", "여성2xl", "우먼스 2xl", "women's 2xl",  // 여성 큰 사이즈 narrow
      // Wave 805: SL/LT/AR have different price bands. Explicit sub-line
      // rows must go to strict lanes; ambiguous "Beta jacket" can stay here.
      "베타 lt", "베타lt", "beta lt", "betalt",
      "베타 sl", "베타sl", "beta sl", "betasl",
      "베타 ar", "베타ar", "beta ar", "betaar",
    ],
    msrpKrw: 590000, released: 1998,
    defaultProductType: "jacket", // Wave 236d — Beta = Gore-Tex 자켓 라인 확정.
  },
  {
    id: "clothing-arcteryx-gamma",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_gamma",
    modelName: "Arc'teryx Gamma (broad — sub-line 미명시)",
    aliases: ["Gamma Jacket", "감마 자켓", "Gamma Hoody"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["gamma", "감마"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      // Wave 765 (2026-05-27): MX/SL/LT/Lightweight sub-line 별도 SKU 로 분리.
      "감마 mx", "감마mx", "gamma mx", "gammamx",
      "감마 sl", "감마sl", "gamma sl", "gammasl",
      "감마 lt", "감마lt", "gamma lt", "gammalt",
      "lightweight", "라이트웨이트",
    ],
    msrpKrw: 350000, released: 1998,
    defaultProductType: "jacket",
  },
  // Wave 765 (2026-05-27): Gamma MX (Mid-weight, $350+) — Gamma 의 가장 일반적 variant.
  {
    id: "clothing-arcteryx-gamma-mx",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_gamma_mx",
    modelName: "Arc'teryx Gamma MX",
    aliases: ["Gamma MX", "감마 MX"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["gamma mx", "gammamx", "감마 mx", "감마mx"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      "감마 sl", "감마sl", "감마 lt", "감마lt"],
    msrpKrw: 450000, released: 2007,
    defaultProductType: "jacket",
  },
  // Wave 765: Gamma SL (Super Light, 가벼움 — Gamma 라인 중 가장 가벼움).
  {
    id: "clothing-arcteryx-gamma-sl",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_gamma_sl",
    modelName: "Arc'teryx Gamma SL",
    aliases: ["Gamma SL", "감마 SL"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["gamma sl", "gammasl", "감마 sl", "감마sl"]],
    mustNotContain: ["키즈", "kids", "복각", "replica", "fake", "veilance",
      "감마 mx", "감마mx", "감마 lt", "감마lt"],
    msrpKrw: 280000, released: 2020,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-alpha",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_alpha",
    modelName: "Arc'teryx Alpha (broad — sub-line 미명시)",
    aliases: ["Alpha Jacket", "알파 자켓"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["alpha", "알파"]],
    // Wave 229 (2026-05-19) Iter10: 다른 brand 매물 차단.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      "몽벨", "montbell", "콜롬비아", "columbia", "마운틴 하드웨어", "mountain hardware",
      "포지션", "포지셔닝", "비교", "vs",
      // Wave 572 (2026-05-22): LEAF Alpha G2 멀티캠 (군용, 345만)
      "leaf", "리프", "리프 알파", "leaf alpha", "alpha g2", "alpha g 2", "멀티캠", "multicam", "law enforcement",
      "law enforcement and armed forces",
      // Wave 765 (2026-05-27): SV/AR/LT/FL/SL sub-line 별도 SKU.
      "알파 sv", "알파sv", "alpha sv", "alphasv",
      "알파 ar", "알파ar", "alpha ar", "alphaar",
      "알파 lt", "알파lt", "alpha lt", "alphalt",
      "알파 fl", "알파fl", "alpha fl", "alphafl",
      "알파 sl", "알파sl", "alpha sl", "alphasl",
    ],
    msrpKrw: 850000, released: 1998,
    defaultProductType: "jacket",
  },
  // Wave 765 (2026-05-27): Alpha SV (Severe weather, flagship — 정가 ~110-130만).
  {
    id: "clothing-arcteryx-alpha-sv",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_alpha_sv",
    modelName: "Arc'teryx Alpha SV (Severe Weather)",
    aliases: ["Alpha SV", "알파 SV"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["alpha sv", "alphasv", "알파 sv", "알파sv"]],
    mustNotContain: ["키즈", "kids", "복각", "replica", "fake", "veilance",
      "leaf", "리프", "alpha g2", "멀티캠",
      "알파 ar", "알파ar", "alpha ar", "alphaar",
      "알파 lt", "알파lt", "alpha lt", "alphalt",
      "알파 fl", "알파fl", "알파 sl", "알파sl"],
    msrpKrw: 1100000, released: 1998,
    defaultProductType: "jacket",
    confusionNote: "Alpha SV (Severe Weather) — Alpha 라인 플래그십. AR/LT/FL/SL 보다 비싸.",
  },
  // Wave 765: Alpha AR (All-Round, ~80-100만).
  {
    id: "clothing-arcteryx-alpha-ar",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_alpha_ar",
    modelName: "Arc'teryx Alpha AR (All-Round)",
    aliases: ["Alpha AR", "알파 AR"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["alpha ar", "alphaar", "알파 ar", "알파ar"]],
    mustNotContain: ["키즈", "kids", "복각", "replica", "fake", "veilance",
      "leaf", "리프", "alpha g2",
      "알파 sv", "알파sv", "alpha sv", "alphasv",
      "알파 lt", "알파lt", "알파 fl", "알파 sl"],
    msrpKrw: 900000, released: 2000,
    defaultProductType: "jacket",
  },
  // Wave 765: Alpha LT (LightweighT, ~55-75만).
  {
    id: "clothing-arcteryx-alpha-lt",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_alpha_lt",
    modelName: "Arc'teryx Alpha LT (LightweighT)",
    aliases: ["Alpha LT", "알파 LT"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["alpha lt", "alphalt", "알파 lt", "알파lt"]],
    mustNotContain: ["키즈", "kids", "복각", "replica", "fake", "veilance",
      "leaf", "리프",
      "알파 sv", "알파sv", "alpha sv", "alphasv",
      "알파 ar", "알파ar", "알파 fl", "알파 sl"],
    msrpKrw: 700000, released: 2005,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-arcteryx-atom",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_atom",
    modelName: "Arc'teryx Atom (LT / SL / Heavyweight) insulated",
    aliases: ["Atom LT", "아톰 LT", "Atom Heavyweight", "Atom Hoody"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["atom", "아톰"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      // Wave 805: Atom LT hoody/non-hood, SL, and AR/Heavyweight split.
      // If LT has no hood/jacket signal, hold it instead of broad-pooling.
      "아톰 lt", "아톰lt", "atom lt", "atomlt",
      "아톰 sl", "아톰sl", "atom sl", "atomsl",
      "아톰 ar", "아톰ar", "atom ar", "atomar", "heavyweight", "헤비웨이트",
    ],
    msrpKrw: 320000, released: 2010,
    defaultProductType: "jacket", // Wave 236d — Atom = insulated 자켓 확정.
  },
  {
    id: "clothing-arcteryx-vertex-squamish",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_vertex_squamish",
    modelName: "Arc'teryx Vertex Alpine / Squamish",
    aliases: ["Vertex Alpine", "버텍스 알파인", "Squamish", "스쿼미시"],
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"], ["vertex", "버텍스", "squamish", "스쿼미시"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      // Wave 533 (2026-05-22): Arc'teryx Vertex is also a shoe line in listings.
      // Do not let trail/running shoe rows enter the Squamish/Vertex clothing lane.
      "트레일런닝화", "트레일 러닝화", "trail running", "러닝화", "런닝화", "등산화", "운동화", "신발", "슈즈", "shoe"],
    msrpKrw: 280000, released: 2015,
    defaultProductType: "jacket", // Wave 236d — Vertex/Squamish = lightweight 자켓 확정.
  },
  {
    id: "clothing-arcteryx",
    brand: "Arc'teryx", category: "clothing", laneKey: "arcteryx_broad",
    modelName: "Arc'teryx Apparel (broad — 모델 미식별)",
    aliases: ["Arc'teryx", "아크테릭스"],
    // Wave 218: narrow 5개 (Beta/Gamma/Alpha/Atom/Vertex-Squamish) 박은 후 broad 는 catch-all.
    // Wave 738 leak fix: mustContain[1] 확장 — 비니/롱슬리브/셔츠/바지/플리스/베스트/조끼/토륨 등 누락.
    //   99_other bucket 234건 분석 결과 다수 매물 missing keyword.
    mustContain: [["arcteryx", "arc'teryx", "아크테릭스"],
      ["반팔", "티셔츠", "tee", "후드", "hoodie", "후디", "맨투맨", "크루넥",
       "자켓", "jacket", "재킷",
       "팬츠", "pants", "바지", "쇼츠", "shorts",
       "windbreaker", "윈드브레이커", "바람막이",
       // Wave 738 추가
       "비니", "beanie", "모자", "cap", "캡",
       "셔츠", "shirt", "남방",
       "롱슬리브", "long sleeve", "긴팔",
       "플리스", "fleece",
       "베스트", "vest", "조끼",
       // 시그니처 narrow 모델명 (narrow가 우선이지만 broad에서도 catch)
       "토륨", "thorium", "토리움",
       "노바", "nova", "코바트", "covert",
       "엠바", "ember"],  // narrow 안 박힌 라인
    ],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "veilance",
      // narrow 매칭되는 키워드 제외
      "beta", "베타", "gamma", "감마", "alpha", "알파", "atom", "아톰", "vertex", "버텍스", "squamish", "스쿼미시",
      // Wave 269 (2026-05-20): API sweep 발견 — Mantis Waistpack 같은 가방 매물이 의류 SKU에 잡힘.
      //   가방 시세군 (15~30만) ≠ 의류 시세군 (30~60만). 별도 차단.
      "mantis", "만티스", "waistpack", "웨이스트팩", "waist pack",
      "백팩", "backpack", "가방", "토트", "tote", "숄더 백", "shoulder bag", "크로스백",
      "슬링", "sling",
      // Wave 269c (2026-05-20): 신발 모델 추가 차단 (Norvan/Aerios/Vertex shoe etc)
      "norvan", "노르반", "aerios", "에어리오스", "konseal", "콘실",
      "트레일 러닝화", "trail running shoe", "러닝화",
      "크래그", "crag",  // 크래그는 보행 신발 라인
      // Wave 548 (2026-05-22): 다른 brand cross-catch 차단.
      //   "프라다 x 아디다스 리나일론 트랙수트 정품 아크테릭스 빔즈" 240만 — Prada/Adidas 매물인데 아크테릭스 broad에 catch.
      "프라다 x", "x 프라다", "prada x", "x prada",
      "아디다스 x", "x 아디다스", "adidas x", "x adidas",
      "발렌시아가 x", "x 발렌시아가", "balenciaga x",
      "빔즈", "beams",  // BEAMS 콜라보 (별도 시세군)
      "정품 아크테릭스 빔즈",
      // Wave 688 (2026-05-22): 특수 라인 / 군용 차단 (broad fallback에 흘러옴).
      "리프", "leaf", "리프 콜드", "leaf cold", "리프 알파", "leaf alpha",  // LEAF (군용/방산)
      "시스템 a", "system a", "오지 인슐레이티드", "ogi insulated",
      "피션", "fission",  // Fission 고어텍스 한정
      "솔라노", "solano", "솔라노 후디",
      "베일런스", "veilance", "베일런 스",  // 이미 있음, 변형
      "랄로", "라로", "rallo",
      // Gen 2.1 같은 generation 표기 (한정/특수)
      "gen2", "gen 2", "gen2.1", "2.1 gen",
      // Wave 715 P1 (2026-05-23): LEAF/Veilance 별도 narrow 박음 → 명확 차단.
      // (Wave 688 enrich)
      "cerium", "세륨", "세리움", "thorium", "토륨", "쏘리움", "소리움", "nuclei", "누클리아이", "뉴클리", "therma", "써마",  // → arcteryx_down
    ],
    msrpKrw: 400000, released: 1989,
  },
  // 휠라 — 매물 27건, 친화 가격
  {
    id: "clothing-fila-apparel",
    brand: "Fila", category: "clothing", laneKey: "fila_apparel",
    modelName: "Fila Apparel (트랙수트 / 빅로고 티)",
    aliases: ["Fila Apparel", "휠라 의류"],
    mustContain: [["fila", "휠라"], ["반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "자켓", "jacket", "트랙수트", "윈드브레이커"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "운동화", "스니커즈", "신발", "디스럽터",
      // Wave 268 (2026-05-20): API sweep 발견 — 휠라 골프웨어 26/40 (65%) 일반 의류 SKU 잘못 매칭.
      //   골프웨어 시세군 (택가 50~150만) ≠ 일반 휠라 의류 (3~10만). 별도 차단.
      "골프", "골프웨어", "골프 의류", "골프 셔츠", "골프 셋업", "골프채", "퍼터", "드라이버", "아이언",
      // Wave 269c (2026-05-20): "남성의류 휠라 운동화" 같은 신발 매물도 격리.
      "운동화", "러닝화", "트레일", "신발",
    ],
    msrpKrw: 69000, released: 2018,
  },
  // Wave 712a (2026-05-23) 신설 — Synchilla / Snap-T 162건/주 black hole 회복.
  //   bias-free 검증: Wave 654가 broad에서 신칠라/snap-t 차단했지만 fallback narrow 안 박음 → 131건 retro-x 잘못 매칭 + 30건 drop.
  {
    id: "clothing-patagonia-synchilla",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_synchilla",
    modelName: "Patagonia Synchilla / Snap-T Fleece Pullover",
    aliases: ["Patagonia Synchilla", "파타고니아 신칠라", "Patagonia Snap-T", "스냅티", "Snap T"],
    mustContain: [["patagonia", "파타고니아"], ["synchilla", "신칠라", "snap-t", "snap t", "스냅티", "스냅 t", "스냅 풀오버", "snap pullover", "신찰라", "싱칠라", "신질라", "신키라"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "retro x", "레트로 엑스", "레트로엑스", "classic retro",
      "deep pile", "딥파일", "레트로파일", "레트로 파일", "retro pile",
      // 40주년/50주년 한정 차단
      "40주년", "50주년", "anniversary", "레거시", "legacy", "sacajawea",
      // 셀럽 outlier 차단
      "gd", "지디", "지드래곤", "안소희", "손나은",
      // Nike collab 차단 (의류 단일)
      "나이키", "nike", "머큐리얼", "mercurial", "컨버스", "converse", "airmax", "에어맥스",
      // Wave 800 (2026-05-24) Phase 2: 72x — Mars edition + 90s vintage + 모음 bundle 차단.
      "mars", "마스 신칠라", "patagonia mars",
      "reversible snap", "리버서블 스냅", "리버시블",
      "90s 신칠라", "90s synchilla", "y2k 신칠라", "vintage 신칠라", "vintage synchilla",
      "모음", "묶음", "bundle", "x장", "장 일괄",  // multi-piece bundle (1M outlier)
      "핫핑크", "hot pink",  // 한정 color 라인 (별도 시세)
    ],
    msrpKrw: 365000, released: 1985,
  },
  // 파타고니아 — 매물 17건, faved 19, outdoor
  {
    id: "clothing-patagonia",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_apparel",
    modelName: "Patagonia Apparel (broad)",
    aliases: ["Patagonia", "파타고니아"],
    // Wave 219: 모델별 분리 후 broad catch-all.
    mustContain: [["patagonia", "파타고니아"], ["반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "가방", "backpack",
      "retro", "레트로", "fleece", "플리스", "synchilla", "신칠라", "snap-t",
      "레트로파일", "레트로 파일", "retro pile", "retro-pile",
      "다운", "down", "패딩",
      "torrentshell", "토렌쉘", "바람막이", "shell",
      // Wave 687: 한정/빈티지/가방 추가 차단.
      "40주년", "50주년", "anniversary", "레거시", "legacy",
      "80s patagonia", "90s patagonia", "00s patagonia",
      "us made", "usa made", "made in usa",
      "딥파일", "deep pile", "레트로파일",
    ],
    msrpKrw: 99000, released: 1973,
  },
  // Wave 219 (2026-05-19): Patagonia 모델별 분리 — Retro X 플리스 65~150K vs 다운 100K vs 셸 110K
  // Wave 251.2 (2026-05-19): Deep Pile narrow split.
  //   사용자 코멘트 (id 197 — pid 402789240 Synchilla 오트밀 ₩190k) — 비교군에 "진짜 다른 상품들"(Pull 190k / Snap-T 249k / Reversible 400k).
  //   production sample (14d, n=164) 측정:
  //     - mainstream Synchilla/Snap-T/Retro X — n=149 / p50 ₩165k / spread 색상-연도-사이즈 자연스러움.
  //     - 딥파일 (Deep Pile, 90s 빈티지 콜렉터) — n=10 / p50 ₩390k / max ₩780k (시세 2.4배).
  //     - 쉘드 신칠라 — n=4 / Reversible — n=1 / 40주년 — n=1 (narrow 임계 미달).
  //   결론: 딥파일만 narrow 신설. 나머지는 mustNotContain 으로 broad fallback.
  //   Wave 251.4 의 sub_model 필터 (비교군 list) 가 색상/연도 spread 의 대부분을 흡수.
  {
    id: "clothing-patagonia-deep-pile",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_deep_pile",
    modelName: "Patagonia Deep Pile (90s 빈티지 콜렉터 / Mesclun 40주년)",
    aliases: ["Deep Pile", "딥파일", "Patagonia 딥파일", "Mesclun", "40주년"],
    mustContain: [["patagonia", "파타고니아"], ["딥파일", "deep pile", "mesclun", "40주년", "legacy"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "가방", "backpack"],
    msrpKrw: 390000, released: 1990,
    defaultProductType: "jacket",
  },
  {
    id: "clothing-patagonia-retro-x",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_retro_x",
    modelName: "Patagonia Retro X / Classic Retro",
    aliases: ["Retro X", "레트로 X", "Classic Retro X"],
    // Wave 654 (2026-05-22): mustContain에서 "synchilla"/"신칠라"/"snap-t"/"fleece"/"플리스" 제거.
    //   이전: 합쳐서 broad — spread 8.75x b_grade (49건), 신칠라(16~22만) vs 레트로X(25~35만) 별도 라인.
    //   now: Retro X 단독 — 신칠라는 별도 broad SKU로 흘림 (fallback).
    mustContain: [["patagonia", "파타고니아"], ["retro x", "retro-x", "레트로x", "레트로 x", "classic retro", "클래식 레트로"]],
    // Wave 251.2: 딥파일 narrow 로 routing.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "가방", "backpack",
      "딥파일", "deep pile", "mesclun", "40주년", "legacy",
      "레트로파일", "레트로 파일", "retro pile", "retro-pile",
      // Wave 654: 별도 라인 (synchilla / snap-t / 일반 fleece) 차단.
      "synchilla", "신칠라", "snap-t", "스냅t", "스냅 t",
      "신칠라 스냅", "신칠라스냅",
      // Wave 549 (2026-05-22): 레어 빈티지/50주년/내추럴 블렌드/모음 차단 (390만, 100만 outlier).
      "레어", "희귀", "희소", "rare",
      "50주년", "내추럴 블렌드", "natural blend",
      "us made", "usa made", "1990", "1989", "1992", "1998", "1999",  // 빈티지 us made (가격 +20배)
      // Wave 714t (2026-05-23): 빈티지 연도 표기 확장 (사용자 발견 — pid 388991127 "99년도 빈티지" 매칭됨)
      "99년", "99년도", "99s", "98년", "98년도", "00s", "2000년대", "y2k", "90's", "90s",
      // Wave 634: 추가 한정 colorway 차단.
      "sacajawea", "사카자위아", "아즈텍 나바호", "aztec navajo", "navajo print",
      "안소희", "celebrity wear", "셀럽 착용",
      // Wave 642: 추가 셀럽 + 다중 가방 표기 (한 매물에 여러 가방).
      "손나은", "셀럽 픽", "celeb pick",
      "토트백 보스턴백", "토트 보스턴 세일러", "다중백",
      "모음", "세트 모음", "set 모음",
      "지디", "지드래곤",  // 셀럽 착용 (가격 inflated)
      // Wave 715 P2 (2026-05-23): 28% synchilla 흡수 잔여 추가 차단 (parser bug + catalog 다중 방어).
      "신찰라", "싱칠라", "신질라", "신키라",  // 신칠라 오탈자
      "스냅풀오버", "스냅 풀오버", "snap pullover",
      "파일", "pile", "레트로 파일",  // 일반 fleece (다른 시세)
    ],
    msrpKrw: 199000, released: 1985,
    defaultProductType: "jacket", // Wave 236d — Retro X/Synchilla = 플리스 자켓 라인 확정.
  },
  {
    id: "clothing-patagonia-down",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_down",
    modelName: "Patagonia Down (Nano Puff / Down Sweater / 경량 다운)",
    aliases: ["Patagonia Down", "파타고니아 다운", "Nano Puff", "Down Sweater"],
    mustContain: [["patagonia", "파타고니아"], ["다운", "down", "nano puff", "패딩", "구스다운"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "가방", "backpack", "retro", "레트로",
      // Wave 687 (2026-05-22): 한정/빈티지 차단.
      "40주년", "50주년", "40th", "50th", "anniversary", "레거시", "legacy",
      "80s patagonia", "90s patagonia", "00s patagonia",
      "80s 파타고니아", "90s 파타고니아", "00s 파타고니아",
      "빈티지 파타고니아", "vintage patagonia", "us made", "usa made",
      // Wave 844: Nike/Nocta down listings sometimes append Patagonia as
      // reference wording; keep them out of Patagonia down comparisons.
      "나이키", "nike", "녹타", "nocta", "acg",
    ],
    msrpKrw: 290000, released: 2004,
    defaultProductType: "down_jacket", // Wave 236d — Patagonia Down = 다운 자켓 라인.
  },
  {
    id: "clothing-patagonia-shell",
    brand: "Patagonia", category: "clothing", laneKey: "patagonia_shell",
    modelName: "Patagonia Shell (Torrentshell / 바람막이 / H2No)",
    aliases: ["Torrentshell", "토렌쉘", "Patagonia Shell"],
    mustContain: [["patagonia", "파타고니아"], ["torrentshell", "토렌쉘", "바람막이", "shell", "h2no", "윈드"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "가방", "backpack", "retro", "레트로", "다운", "down",
      "아동", "유아", "베이비", "baby", "3t", "4t", "5t", "infant",
      // Brand-stuffed outdoor listings. Patagonia keyword is often used as style bait.
      "나이키", "nike", "acg", "몽벨", "montbell", "로아", "roa"],
    msrpKrw: 199000, released: 1980,
  },
  // MLB 모자 + 의류 mainstream
  {
    id: "clothing-mlb-cap",
    brand: "MLB", category: "clothing", laneKey: "mlb_apparel",
    modelName: "MLB Cap (broad)",
    aliases: ["MLB Cap", "MLB 모자", "엠엘비 모자"],
    // Wave 492: generic MLB apparel now has clothing-mlb-apparel-broad; keep this lane cap-only.
    // Wave 712a (2026-05-23) HOTFIX: bias-free 검증 — "엠엘비 모자" 한글 매물 47건/주 NULL.
    //   mustContain `["mlb"]` only → 한국 표기 매물 catch 못함. apparel-broad는 이미 박혀있는데 cap만 누락.
    mustContain: [["mlb", "엠엘비"], ["모자", "cap", "캡", "볼캡", "ballcap"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "ml b", "신발", "스니커즈", "양말", "에어팟", "케이스",
      "구찌", "gucci", "무라카미", "murakami", "카이카이", "kaikai", "nike x mlb", "nike × mlb", "나이키 x mlb", "나이키 × mlb"],
    msrpKrw: 49000, released: 2020,
  },
  // Wave 219 (2026-05-19): MLB collab 분리 — 가격 X 5-10 (일반 45K vs Gucci 320K)
  {
    id: "clothing-mlb-cap-gucci-collab",
    brand: "MLB", category: "clothing", laneKey: "mlb_cap_gucci_collab",
    modelName: "Gucci × MLB Cap (한정/명품)",
    aliases: ["Gucci MLB", "구찌 MLB", "구찌 MLB 콜라보"],
    // Wave 223 (2026-05-19): "구찌 mlb 반지갑" 매물 잘못 매칭 → mustContain 강제 (cap/모자/볼캡만).
    mustContain: [["gucci", "구찌"], ["mlb"], ["cap", "캡", "모자", "볼캡", "ballcap"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake",
      // Wave 223: 지갑/벨트/가방/시계 등 cap 외 제품 차단
      "지갑", "wallet", "반지갑", "장지갑",
      "벨트", "belt", "가방", "bag", "백팩", "backpack",
      "시계", "watch", "운동화", "스니커즈", "sneaker"],
    msrpKrw: 480000, released: 2018,
  },
  {
    id: "clothing-mlb-cap-nike-collab",
    brand: "MLB", category: "clothing", laneKey: "mlb_cap_nike_collab",
    modelName: "Nike × MLB Cap (LA Dodgers / NY Yankees 등)",
    aliases: ["Nike MLB", "나이키 MLB", "Nike x MLB"],
    mustContain: [["nike", "나이키"], ["mlb"], ["cap", "캡", "모자"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "구찌", "gucci", "무라카미",
      // Wave 269 (2026-05-20): API sweep 발견 — 46/96 (48%) 유니폼/져지 의류 매물 잘못 매칭.
      //   nike x mlb 유니폼은 cap (모자) ≠ 의류 (jersey/uniform) 시세군 완전 다름.
      "유니폼", "uniform", "져지", "jersey", "베이퍼리미티드", "vapor limited", "vapor",
      "스넬", "snell", "리미티드",
    ],
    msrpKrw: 79000, released: 2022,
  },
  {
    id: "clothing-mlb-cap-murakami-collab",
    brand: "MLB", category: "clothing", laneKey: "mlb_cap_murakami_collab",
    modelName: "Murakami × MLB Cap (한정 9twenty)",
    aliases: ["Murakami MLB", "무라카미 MLB", "카이카이 키키 MLB"],
    // Wave 228 (2026-05-19): cap 강제 + 야구공/유니폼/카드/저지/토트백/도쿄시리즈 제외.
    mustContain: [["murakami", "무라카미", "카이카이", "kaikai"], ["mlb"], ["cap", "캡", "모자", "볼캡", "9twenty", "뉴에라"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "구찌", "gucci",
      // 야구공/유니폼/카드/저지/토트백/티셔츠 등 cap 외 제품 차단
      "야구공", "baseball", "유니폼", "uniform", "저지", "jersey",
      "토트백", "tote", "tote bag", "백팩", "backpack", "지갑", "wallet",
      "카드", "card", "탑스", "topps",
      "도쿄시리즈", "도쿄 시리즈", "tokyo series"],
    msrpKrw: 220000, released: 2023,
  },
  // 디스커버리 익스페디션 — 매물 11건, outdoor 친화
  {
    id: "clothing-discovery-expedition",
    brand: "Discovery Expedition", category: "clothing", laneKey: "discovery_apparel",
    modelName: "Discovery Expedition Apparel (자켓/패딩/플리스)",
    aliases: ["Discovery Expedition", "디스커버리 익스페디션"],
    mustContain: [["discovery", "디스커버리"], ["반팔", "티셔츠", "tee", "후드", "hoodie", "맨투맨", "자켓", "jacket", "패딩", "플리스", "fleece", "다운", "down"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "신발", "운동화", "discovery channel"],
    msrpKrw: 119000, released: 2018,
  },
  // Wave 233 (2026-05-19): Vans 시리즈 누락 narrow 추가 — 사용자 명시 "정확한 매물".
  //   측정 unmatched: Vans Old Skool/Authentic/SK8/Era 239 매물. 일반인 친화 (15~60K).
  // Wave 235 (2026-05-19): Vault/한정판/Vintage/collab mustNotContain 강화 — sample sweep 발견:
  //   Old Skool: BAPE 499k / Vault Mastermind 500k / FDMTL 279k / Bottega 520k / Souvenir LX 799k
  //   Slip-On: 빈티지 70s/90s 한정판 360k~930k / Taka Hayashi Vault 350k
  //   Era: 사토시 95 850k~1.08M / Fear of God 600k~850k / 빈티지 70s/80s 700k
  {
    id: "shoe-vans-old-skool",
    brand: "Vans", category: "shoe", laneKey: "vans_old_skool",
    modelName: "Vans Old Skool (Classic Black / Color Theory)",
    aliases: ["Vans Old Skool", "반스 올드스쿨", "올드 스쿨", "Old Skool"],
    mustContain: [["반스", "vans"], ["올드스쿨", "올드 스쿨", "old skool", "oldskool"]],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품", "미러",
      // Wave 235 한정판/Vault/collab
      "vault", "볼트", "lx", "베이프", "bape", "마스터마인드", "mastermind", "fdmtl", "펀더멘탈",
      "보테가", "bottega", "수베니어", "souvenir", "end.", "end ", "fragment", "프래그먼트",
    ],
    msrpKrw: 89000, minPriceKrw: 30000, released: 1977,  // Wave 768: Vans Old Skool 가품 floor (9K outlier 차단)
  },
  {
    id: "shoe-vans-sk8-hi",
    brand: "Vans", category: "shoe", laneKey: "vans_sk8_hi",
    modelName: "Vans SK8-Hi (Classic / Reissue)",
    aliases: ["Vans SK8", "반스 sk8", "SK8 Hi"],
    mustContain: [["반스", "vans"], ["sk8", "스케이트"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품",
      "vault", "볼트", "lx", "베이프", "bape", "마스터마인드", "mastermind",
      "보테가", "bottega", "fragment", "프래그먼트",
    ],
    msrpKrw: 99000, released: 1978,
  },
  {
    id: "shoe-vans-authentic",
    brand: "Vans", category: "shoe", laneKey: "vans_authentic",
    modelName: "Vans Authentic (Canvas Classic)",
    aliases: ["Vans Authentic", "반스 어센틱", "Authentic"],
    mustContain: [["반스", "vans"], ["어센틱", "authentic"]],
    // Wave 753 (2026-05-24) Pareto: 266x audit — 양말/뮬/vintage 차단.
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품",
      "vault", "볼트", "lx", "베이프", "bape", "fragment", "프래그먼트",
      "양말", "삭스", "socks", "크루삭스", "크루 삭스",
      "뮬", "mule", // Vans Authentic Mule은 별도 라인
      "빈티지 어센틱", "vintage authentic", "두하빈티지",
    ],
    msrpKrw: 79000, released: 1966,
  },
  {
    id: "shoe-vans-era",
    brand: "Vans", category: "shoe", laneKey: "vans_era",
    modelName: "Vans Era (Classic Canvas Low)",
    aliases: ["Vans Era", "반스 에라", "Era"],
    mustContain: [["반스", "vans"], ["에라", " era ", "era\\b"]],
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품", "벨크로",
      // Wave 235 한정판 (Era 95 Vault/Sato/FoG/Vintage)
      "vault", "볼트", "lx", "사토시", "satoshi", "사토시 나카모토",
      "fear of god", "fog", "피오갓", "피어오브갓", "era 95", "에라95", "에라 95",
      "fdmtl", "더블탭스", "double taps", "wtaps",
      "70s 반스", "80s 반스", "70s반스", "80s반스", "독타운", "dogtown",
    ],
    msrpKrw: 79000, released: 1976,
  },
  {
    id: "shoe-vans-slip-on",
    brand: "Vans", category: "shoe", laneKey: "vans_slip_on",
    modelName: "Vans Slip-On (Checkerboard / Classic)",
    aliases: ["Vans Slip-On", "반스 슬립온", "Slip On", "체커보드"],
    mustContain: [["반스", "vans"], ["슬립온", "slip on", "slip-on", "체커보드", "checkerboard"]],
    // Wave 753 (2026-05-24) Pareto: 256x audit — 양말/체커보드 양말 false match + 뮬.
    mustNotContain: [
      "키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품",
      // Wave 235 Vault/Vintage/collab
      "vault", "볼트", "lx", "타카 하야시", "taka hayashi", "타카하야시",
      "70s 반스", "80s 반스", "90s 반스", "70s반스", "80s반스", "90s반스",
      "fear of god", "fog", "피오갓", "피어오브갓", "fragment", "프래그먼트",
      // Wave 753: 양말/뮬 false match
      "양말", "삭스", "socks", "크루삭스", "크루 삭스", "체커보드 양말", "체커보드 삭스",
      "체커보드 미드", "체커보드 크루", // 체커보드 삭스 (Vans 양말)
      "뮬", "mule",
    ],
    msrpKrw: 79000, released: 1979,
  },
  // Wave 235 (2026-05-19): collab variant 분리 — broad SKU stddev 진단 후 mismatch 색출.
  //   추가 기준: 매물 5+ 건 + 일반 친화 + 가품 risk 낮음 (명품 collab 제외).
  //   1) Off-White × Blazer Mid 5매물 65만~95만 (Lugano/Hallows Eve/Serena/Wood)
  //   2) BAPE × Vans 4매물 50만 (Old Skool/Sk8-Hi TB LX)
  //   3) Adidas × Clot Superstar 3매물 30만~90만 (Clot collab)
  //   4) Adidas × Thug Club Superstar 3매물 25만~33만 (떠그클럽 — 한국 인기)
  //   5) Vans × Sato (Satoshi Nakamoto) Era 95 3매물 85만~108만
  //   skip: Miu Miu × NB530 (1매물), Denim Tears × Marc Jacobs (2매물), Gucci × CDG (명품 가품 risk), Balenciaga × Adidas (200만 cap 초과).
  {
    id: "shoe-offwhite-nike-blazer-mid",
    brand: "Off-White x Nike", category: "shoe", laneKey: "offwhite_blazer_mid_collab",
    modelName: "Off-White × Nike Blazer Mid (Lugano/Serena/Hallows Eve/Wood)",
    aliases: ["Off-White Blazer", "오프화이트 블레이저", "Virgil Blazer"],
    mustContain: [["off-white", "off white", "offwhite", "오프화이트"], ["블레이저", "blazer"], ["미드", "mid"], ["nike", "나이키"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품", "미러", "1:1", "low", "high", "로우", "하이"],
    msrpKrw: 220000, released: 2018,
  },
  {
    id: "shoe-bape-vans-collab",
    brand: "Bape x Vans", category: "shoe", laneKey: "bape_vans_collab",
    modelName: "BAPE × Vans (Old Skool TB LX / Sk8-Hi)",
    aliases: ["BAPE Vans", "베이프 반스", "Bape Vans collab"],
    mustContain: [["베이프", "bape", "a bathing ape"], ["반스", "vans"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품", "미러", "1:1", "supreme", "슈프림"],
    msrpKrw: 350000, released: 2020,
  },
  {
    id: "shoe-clot-adidas-superstar",
    brand: "Clot x Adidas", category: "shoe", laneKey: "clot_superstar_collab",
    modelName: "Clot × Adidas Superstar (Clot collab)",
    aliases: ["Clot Superstar", "클랏 슈퍼스타", "Clot Adidas"],
    mustContain: [["클랏", "clot", "edison chen"], ["슈퍼스타", "superstar"], ["adidas", "아디다스"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품", "미러", "1:1"],
    msrpKrw: 220000, released: 2023,
  },
  {
    id: "shoe-thugclub-adidas-superstar",
    brand: "Thug Club x Adidas", category: "shoe", laneKey: "thugclub_superstar_collab",
    modelName: "Thug Club × Adidas Superstar (떠그클럽 collab)",
    aliases: ["Thug Club Superstar", "떠그클럽 슈퍼스타", "떠그다스", "Thug Adidas"],
    mustContain: [["떠그", "thug club", "thugclub", "떠그다스"], ["슈퍼스타", "superstar"], ["adidas", "아디다스"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품", "미러", "1:1"],
    msrpKrw: 250000, released: 2024,
  },
  {
    id: "shoe-vans-sato-era-95",
    brand: "Vans x Sato", category: "shoe", laneKey: "vans_sato_era_collab",
    modelName: "Vans × Sato Era 95 (Satoshi Nakamoto collab)",
    aliases: ["Vans Sato Era", "반스 사토시", "Satoshi Era 95"],
    mustContain: [["사토시", "satoshi", "sato"], ["반스", "vans"], ["에라", "era"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품", "미러", "1:1"],
    msrpKrw: 350000, released: 2024,
  },
  // Wave 226 (2026-05-19): 누락 인기 SKU 추가 — 사용자 명시 "Nike/Adidas/뉴발 narrow".
  //   측정 결과: NB iconic 718 / Samba 218 / Cortez 206 매물 unmatched.
  //   진단: NB 530 mustContain "뉴발란스 530" (띄어쓰기) → "뉴발란스530" (붙임) 누락 / NB 574/2002R/9060/990v1~v4 catalog 없음 / Samba collab (KITH/Wales Bonner/Pharrell/Sporty Rich) narrow 없음 / Cortez catalog 없음.
  {
    id: "shoe-newbalance-574-broad",
    brand: "New Balance", category: "shoe", laneKey: "newbalance_574_broad",
    modelName: "New Balance 574 (broad)",
    aliases: ["NB 574", "뉴발란스 574", "뉴발 574"],
    mustContain: [["574"], ["뉴발란스", "newbalance", "new balance", "nb ", "뉴발"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "짭", "가품", "미러", "샘플", "1:1", "11급", "삽니다", "구합니다", "매입",
      "miu miu", "miumiu", "미우미우", "미우 미우",
      "stray rats", "스트레이 랫츠", "스트레이랫츠"],
    msrpKrw: 99000, released: 1988,
  },
  {
    id: "shoe-newbalance-2002r",
    brand: "New Balance", category: "shoe", laneKey: "newbalance_2002r",
    modelName: "New Balance 2002R (Protection Pack 등)",
    aliases: ["NB 2002R", "뉴발란스 2002R", "2002R", "M2002RAW", "2002 RAW"],
    mustContain: [["2002r", "2002 r", "2002raw", "2002 raw", "m2002raw"], ["뉴발란스", "newbalance", "new balance", "nb ", "nb2002r", "뉴발"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "짭", "가품", "미러", "샘플", "1:1", "11급", "삽니다", "구합니다", "매입"],
    msrpKrw: 219000, released: 2010,
  },
  {
    id: "shoe-newbalance-9060",
    brand: "New Balance", category: "shoe", laneKey: "newbalance_9060",
    modelName: "New Balance 9060 (Y2K 시그니처)",
    aliases: ["NB 9060", "뉴발란스 9060", "9060"],
    mustContain: [["9060"], ["뉴발란스", "newbalance", "new balance", "nb ", "뉴발"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "짭", "가품", "미러", "샘플", "1:1", "11급", "삽니다", "구합니다", "매입"],
    msrpKrw: 239000, released: 2022,
  },
  {
    id: "shoe-newbalance-990v3",
    brand: "New Balance", category: "shoe", laneKey: "newbalance_990v3",
    modelName: "New Balance 990v3 (Made in USA)",
    aliases: ["NB 990v3", "뉴발란스 990v3", "990 v3"],
    mustContain: [["990v3", "990 v3", "m990v3", "m990gl3"], ["뉴발란스", "newbalance", "new balance", "nb ", "뉴발"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "짭", "가품", "미러", "샘플", "1:1", "11급", "삽니다", "구합니다", "매입",
      "990v4", "990v5", "990v6", "v4", "v5", "v6"],
    msrpKrw: 299000, released: 2012,
  },
  {
    id: "shoe-newbalance-990v4",
    brand: "New Balance", category: "shoe", laneKey: "newbalance_990v4",
    modelName: "New Balance 990v4 (Made in USA)",
    aliases: ["NB 990v4", "뉴발란스 990v4", "990 v4"],
    mustContain: [["990v4", "990 v4", "m990v4"], ["뉴발란스", "newbalance", "new balance", "nb ", "뉴발"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "짭", "가품", "미러", "샘플", "1:1", "11급", "삽니다", "구합니다", "매입",
      "990v3", "990v5", "990v6", "v3", "v5", "v6"],
    msrpKrw: 299000, released: 2017,
  },
  // Wave 697 (2026-05-23): nike_cortez SKU 제거 — catalog-wave266-shoe.ts의 shoe-nike-cortez-broad와 duplicate.
  // ruleMatch ambiguity로 chooseUniqueCandidate가 null 반환 → 231 매물 매칭 fail (매칭률 6.9%).
  // catalog-wave266-shoe.ts의 broad SKU 단일 활성 + 룰 확장으로 대체.
  // Samba collab narrow (Wave 226)
  {
    id: "shoe-adidas-samba-kith",
    brand: "Adidas x KITH", category: "shoe", laneKey: "adidas_samba_kith",
    modelName: "KITH × Adidas Samba (collab)",
    aliases: ["KITH Samba", "키스 삼바", "Kith Samba"],
    mustContain: [["kith", "키스"], ["삼바", "samba"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 290000, released: 2023,
  },
  {
    id: "shoe-adidas-samba-wales-bonner",
    brand: "Adidas x Wales Bonner", category: "shoe", laneKey: "adidas_samba_wales_bonner",
    modelName: "Wales Bonner × Adidas Samba (collab)",
    aliases: ["Wales Bonner Samba", "웨일스 보너 삼바", "웨일즈 보너", "웨일즈보너 삼바"],
    mustContain: [["wales bonner", "웨일스 보너", "웨일즈 보너", "웨일즈보너", "웨일스보너"], ["삼바", "samba"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 290000, released: 2020,
  },
  {
    id: "shoe-adidas-samba-pharrell",
    brand: "Adidas x Pharrell", category: "shoe", laneKey: "adidas_samba_pharrell",
    modelName: "Pharrell × Adidas Samba (Humanrace)",
    aliases: ["Pharrell Samba", "퍼렐 삼바", "Humanrace Samba"],
    mustContain: [["pharrell", "퍼렐", "humanrace", "휴먼레이스"], ["삼바", "samba"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 270000, released: 2023,
  },
  {
    id: "shoe-adidas-samba-sporty-rich",
    brand: "Adidas x Sporty & Rich", category: "shoe", laneKey: "adidas_samba_sporty_rich",
    modelName: "Sporty & Rich × Adidas Samba (collab)",
    aliases: ["Sporty Rich Samba", "스포티 리치 삼바"],
    mustContain: [["sporty", "스포티"], ["삼바", "samba"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 250000, released: 2024,
  },
  // Wave 227 (2026-05-19): 의류/가방 누락 narrow 추가 — 사용자 명시 "의류/가방 카테고리도 누락 측정".
  //   측정 unmatched: Nike apparel 355 / Adidas apparel 105 / FOG Essentials 75 /
  //   Coach 114 / Longchamp 35 / Adidas Trefoil/Track 일부 / Tailwind 79 등.
  //   가품 risk 큰 명품 (LV/구찌/디올/샤넬/Celine) skip — 사용자 정책.
  {
    id: "clothing-fog-essentials",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_broad",
    modelName: "Fear of God Essentials (broad — 베스트/니트/플리스/카라티/모자 등)",
    aliases: ["FOG Essentials", "피오갓 에센셜", "피어오브갓 에센셜", "에센셜"],
    // Wave 779: "에센셜"은 Adidas/Nike 등 mass-line generic word라 brand signal mandatory.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"]],
    // FOG Main Line (3rd-7th 시즌별) 한정/명품 - mustNotContain 차단.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품",
      // Main Line (시즌 번호) 차단 — 별도 SKU 또는 가격대 다름.
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "ermenegildo",
      // Nike 콜라보 차단 (별도)
      "nike", "나이키",
      // Wave 734: 다른 brand essentials 차단 (FOG signal mandatory 제거로 false 위험 증가)
      "calvin klein", "캘빈클라인", "ck essentials",
      "polo essentials", "랄프로렌 essentials",
      "essential oil", "에센셜 오일",
      "기타 ", "guitar",
      "essential foods", "essential nutrition",
      "캘리포니아", "california mule", "디스턴스 러너", "distance runner", "101 lace", "로퍼", "loafer",
      // Wave 245.2 (2026-05-19): production sample 측정 — narrow split 후 broad 는 catch-all fallback.
      //   narrow 키워드 매물은 narrow 로 매칭 → broad mustNotContain 으로 차단 (fallback only).
      //   hoodie/tee/pants/shorts/crewneck/jacket 매물 차단. 다른 product-type (베스트/니트/플리스/카라티/모자) 만 broad.
      "후디", "hoodie", "후드티", "후드",
      "맨투맨", "크루넥", "스웻", "sweat",
      "티셔츠", "반팔", "롱슬리브", "긴팔티",
      "팬츠", "pants", "바지", "조거", "jogger", "sweatpants", "트레이닝",
      "쇼츠", "shorts", "반바지", "하프팬츠", "숏팬츠",
      "자켓", "jacket", "재킷", "블레이저", "점퍼", "코트", "coat",
      // 신발 차단 (cross-category) — 컨버스 척70 콜라보 같은 거.
      "컨버스", "converse", "척70", "chuck 70", "신발", "운동화",
      // Wave 686 (2026-05-22): broad fallback 추가 차단 (narrow 6개 다 ready).
      "데님 팬츠", "denim pants", "청바지", "데님",  // 별도 라인 (FOG denim 없음 — 다른 brand)
      "뉴에라", "new era", "59fifty", "59 fifty",  // 캡 (accessory)
      "벨트백", "belt bag", "벨트 백", "백",  // bag
      "스트레치 리모", "리모", "remo",  // 별도 라인 (의류 X 가능성)
      "아노락", "anorak", "풀오버 아노락",  // 별도 product_type
    ],
    msrpKrw: 99000, released: 2018,
  },
  // Wave 245.2 (2026-05-19): FOG Essentials product-type 별 narrow 분리.
  //   production sample 측정 (60 days, 100건):
  //   - hoodie 19건 median 16만 / crewneck 10건 median 7.2만 / tee 19건 median 5.5만
  //   - pants 18건 median 9.5만 / shorts 4건 median 6만 / jacket 5건 median 18.2만
  //   product-type 별 가격대 2~3배 차이 → narrow split 효과 큼.
  {
    id: "clothing-fog-essentials-hoodie",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_hoodie",
    modelName: "FOG Essentials Hoodie",
    aliases: ["FOG Essentials 후디", "피오갓 에센셜 후드", "에센셜 후디"],
    // Wave 779: generic "에센셜 후드"만으로 Adidas Essentials가 흡수됨 → FOG brand signal mandatory.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["후디", "hoodie", "후드티", "후드"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      // Wave 734: 다른 brand essentials 차단
      "calvin klein", "캘빈클라인", "ck essentials",
      "polo essentials", "랄프로렌 essentials",
      "essential oil", "에센셜 오일",
      "기타 ", "guitar",
      // 다른 product-type 차단 (각 narrow lane 으로 가게).
      "맨투맨", "크루넥", "팬츠", "바지", "쇼츠", "반바지", "자켓", "재킷",
      // Wave 812: zip hoodie has a different comparison axis than pullover hoodie.
      "후드집업", "후드 집업", "집업후드", "집업 후드", "zip-up", "zip up", "zipup", "full zip", "zip hoodie", "hoodie zip"],
    msrpKrw: 160000, released: 2018,
    defaultProductType: "hoodie",
  },
  {
    id: "clothing-fog-essentials-crewneck",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_crewneck",
    modelName: "FOG Essentials Crewneck / Sweat (스웻셔츠/맨투맨)",
    aliases: ["FOG Essentials 맨투맨", "피오갓 에센셜 스웻", "에센셜 크루넥"],
    // Wave 779: generic "에센셜" brand leak 방지.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["맨투맨", "크루넥", "crewneck", "스웻", "sweat"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      "calvin klein", "캘빈클라인", "polo essentials", "essential oil", "에센셜 오일",
      "후디", "hoodie", "후드티", "후드", "팬츠", "바지", "쇼츠", "반바지", "자켓", "재킷",
      "sweatpants", "스웻팬츠", "스웻 팬츠"],
    msrpKrw: 72000, released: 2018,
    defaultProductType: "crewneck",
  },
  {
    id: "clothing-fog-essentials-tee",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_tee",
    modelName: "FOG Essentials Tee / T-Shirt / Long-Sleeve",
    aliases: ["FOG Essentials 티", "피오갓 에센셜 반팔", "에센셜 티"],
    // Wave 779: generic "에센셜" brand leak 방지.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["티셔츠", "반팔", "롱슬리브", "긴팔티", "tee shirt", "t-shirt"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      "calvin klein", "캘빈클라인", "polo essentials", "essential oil", "에센셜 오일",
      "후디", "hoodie", "후드티", "후드", "맨투맨", "크루넥", "스웻", "sweat", "팬츠", "바지", "쇼츠", "반바지", "자켓", "재킷",
      "폴로", "polo", "카라", "카라티", "피케", "pique",
      // Wave 492: vest listings often mention a tee only as layering context.
      "베스트", "vest", "조끼"],
    msrpKrw: 55000, released: 2018,
    defaultProductType: "tee",
  },
  {
    id: "clothing-fog-essentials-pants",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_pants",
    modelName: "FOG Essentials Pants (스웻팬츠/조거/트레이닝)",
    aliases: ["FOG Essentials 팬츠", "피오갓 에센셜 조거", "에센셜 스웻팬츠"],
    // Wave 779: generic "에센셜" brand leak 방지.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["팬츠", "pants", "바지", "조거", "jogger", "스웻팬츠", "sweatpants", "트레이닝"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      "calvin klein", "캘빈클라인", "polo essentials", "essential oil", "에센셜 오일",
      "후디", "hoodie", "후드티", "후드", "맨투맨", "크루넥", "티셔츠", "반팔",
      "쇼츠", "shorts", "반바지", "하프팬츠", "숏팬츠", "자켓", "재킷"],
    msrpKrw: 95000, released: 2018,
    defaultProductType: "pants",
  },
  {
    id: "clothing-fog-essentials-shorts",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_shorts",
    modelName: "FOG Essentials Shorts (반바지/하프팬츠)",
    aliases: ["FOG Essentials 쇼츠", "피오갓 에센셜 반바지", "에센셜 하프팬츠"],
    // Wave 779: generic "에센셜" brand leak 방지.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["쇼츠", "shorts", "반바지", "하프팬츠", "숏팬츠"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      "후디", "hoodie", "맨투맨", "크루넥", "티셔츠", "반팔", "긴팔",
      "조거", "jogger", "스웻팬츠", "sweatpants", "자켓", "재킷",
      // Wave 250 (2026-05-19): CV 0.87 (n=20) — outlier 차단.
      //   "주니어/10Y" 키즈 매물 / "코어 컬렉션" 한정판 / "1977/그라미치/알파 카고" collab 차단.
      //   세트 매물 (후드+반바지) 도 single shorts 시세 왜곡 → 차단.
      "주니어", "junior", "10y", "10Y", "12y", "12Y", "8y", "8Y",
      "코어 컬렉션", "코어컬렉션", "core collection",
      "1977", "그라미치", "gramicci", "알파", "alpha", "카고 쇼츠", "카고쇼츠",
      "후드 반바지 세트", "후드반바지 세트", "셋업", "set up", "세트 팝니다", "세트팝니다"],
    msrpKrw: 60000, released: 2018,
    defaultProductType: "shorts",
  },
  {
    id: "clothing-fog-essentials-jacket",
    brand: "Fear of God Essentials", category: "clothing", laneKey: "fog_essentials_jacket",
    modelName: "FOG Essentials Jacket (자켓/아노락/봄버)",
    aliases: ["FOG Essentials 자켓", "피오갓 에센셜 아노락"],
    // Wave 779: generic "에센셜" brand leak 방지.
    mustContain: [FOG_ESSENTIALS_BRAND_SIGNAL, ["essentials", "에센셜"], ["자켓", "jacket", "재킷", "블레이저", "점퍼", "코트", "coat", "아노락"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "fake", "짭", "가품",
      "3rd", "4th", "5th", "6th", "7th", "1st", "2nd",
      "제냐", "zegna", "nike", "나이키",
      "adidas", "아디다스", "terrex", "테렉스", "멀티에센셜",
      "new balance", "newbalance", "뉴발란스", "뉴발",
      "리바이스", "levis", "levi's", "셀비지", "selvedge", "스타일", "style",
      "후디", "hoodie", "맨투맨", "크루넥", "티셔츠", "반팔", "팬츠", "바지", "쇼츠", "반바지"],
    msrpKrw: 180000, released: 2018,
    // multi (jacket + coat + 아노락) — defaultProductType 안 박음.
  },
  {
    id: "bag-coach-broad",
    brand: "Coach", category: "bag", laneKey: "coach_broad",
    modelName: "Coach Bag (broad — 토트/숄더/크로스/호보/보스턴/시그니처)",
    aliases: ["Coach", "코치 가방"],
    // Wave 262 (2026-05-20): mustContain 보강 — 사용자 SQL 발견 ~25건 매물 sku_id=NULL.
    //   누락: 보스턴/시그니처/스웨거/쇼퍼/스테이션/캔틴/탑핸들/소호 등 Coach 모델 라인.
    mustContain: [
      ["coach", "코치"],
      ["가방", "bag", "토트", "tote", "크로스", "cross", "숄더", "shoulder", "호보", "hobo", "사첼", "satchel", "버킷", "bucket", "체인", "chain", "핸드백", "boston", "보스턴", "더플", "duffle", "duffel", "시그니처", "signature", "캔틴", "canteen", "스웨거", "swagger", "쇼퍼", "shopper", "스테이션", "station", "탑핸들", "top handle", "소호", "soho", "쿼리", "quarry", "롤리", "rowley", "월렛백", "wallet bag"],
    ],
    // tabby/signature-tote/wallet 별도 SKU. 시계/잡화/의류 차단.
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "짭", "가품",
      "tabby", "태비",
      "signature tote", "시그니처 토트",
      "wallet", "지갑", "반지갑", "장지갑", "카드지갑", "카드 지갑",
      "시계", "watch", "쿼츠", "벨트", "belt", "스니커즈", "운동화", "신발",
      "티셔츠", "맨투맨", "후드", "자켓", "재킷", "트레이닝 코치",  // "토트넘 Pony 트레이닝 코치 자켓" 같은 의류 차단
      "삽니다", "매입", "구합니다", "구해요", "구함",
      // 다른 brand
      "coccinelle", "코치넬레"],
    msrpKrw: 290000, released: 1941,
    defaultProductType: "shoulder", // Wave 614: Coach broad 본질 = 숄더/크로스 (대다수 모델).
  },
  {
    id: "bag-coach-tabby",
    brand: "Coach", category: "bag", laneKey: "coach_tabby",
    modelName: "Coach Tabby (시그니처 — 체인/숄더)",
    aliases: ["Coach Tabby", "코치 태비", "코치 Tabby"],
    mustContain: [["coach", "코치"], ["tabby", "태비"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품",
      // Wave 660 (2026-05-22): 폴리쉬드 페블 레더 (top tier 680~820k) 차단.
      //   일반 태비 100~205k 대비 +4배. 별도 narrow SKU로 분리 검토.
      "폴리쉬드 페블", "polished pebble", "폴리쉬드페블",
      "페블 레더", "pebble leather", "페블레더",
      // Wave 660: 타임스퀘어 퀼팅 한정 (CW629 — 별도 라인)
      "cw629", "b4mer",  // SKU 코드 단독은 정확한 매칭만
    ],
    msrpKrw: 590000, released: 2021,
    defaultProductType: "shoulder", // Wave 236d — Tabby = 숄더백 시그니처 (체인/숄더).
  },
  {
    id: "bag-longchamp-le-pliage",
    brand: "Longchamp", category: "bag", laneKey: "longchamp_le_pliage",
    modelName: "Longchamp Le Pliage (시그니처 나일론)",
    aliases: ["Longchamp Le Pliage", "롱샴 르 플리아쥬", "롱샴 플리아쥬"],
    mustContain: [["longchamp", "롱샴"], ["pliage", "플리아쥬", "플리 아쥬", "르 플리아쥬"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 169000, released: 1993,
    defaultProductType: "tote", // Wave 236d — Le Pliage = 토트백 시그니처 라인.
  },
  {
    id: "shoe-nike-tailwind-79",
    brand: "Nike", category: "shoe", laneKey: "nike_tailwind_79",
    modelName: "Nike Tailwind 79 (Vintage Runner)",
    aliases: ["Tailwind 79", "테일윈드 79"],
    mustContain: [["nike", "나이키"], ["테일윈드", "tailwind"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품"],
    msrpKrw: 109000, released: 2018,
  },
  {
    id: "clothing-adidas-trefoil",
    brand: "Adidas", category: "clothing", laneKey: "adidas_trefoil",
    // Wave 763 (2026-05-27): modelName 정리 — "Track Suit" 빼기 (상하의 세트 별도 mustNotContain).
    //   Track Jacket + Hoodie + Tee 만 keep. 슬랙스/조거 같은 바지류는 mustNotContain 추가로 차단.
    modelName: "Adidas Trefoil Track Jacket / Hoodie / Tee",
    aliases: ["Adidas Trefoil", "아디다스 트레포일", "아디다스 트랙수트", "아디다스 3선"],
    mustContain: [["adidas", "아디다스"], ["trefoil", "트레포일", "3-stripe", "3선", "삼선", "track", "트랙", "트랙수트", "오리지널스", "originals"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "fake", "짭", "가품",
      // 신발 차단 (의류만)
      "스니커즈", "sneaker", "운동화", "삼바", "samba", "가젤", "gazelle", "스탠", "stan", "이지", "yeezy",
      "campus", "캠퍼스", "superstar", "슈퍼스타", "spezial", "스페지알",
      // 한정판 차단
      "wales bonner", "웨일스", "웨일즈보너", "웨일즈 보너", "kith", "pharrell", "퍼렐", "sporty rich",
      // Wave 712a (2026-05-23) HOTFIX: bias-free 검증 spread 31.80x. Thug Club 109건 + SFTM 125건 + Y-3 68건 + FOG 65건 콜라보 trefoil 흡수로 시세 오염.
      "thug club", "떠그클럽", "떠그 클럽", "팀가이스트", "team geist",
      "sftm", "송포더뮤트", "송 포 더 뮤트", "song for the mute",
      "y-3", "y3", "요지", "yohji", "yamamoto", "야마모토",
      "fear of god", "피어오브갓", "피오갓", "fog ", "에센셜", "essentials", "fg athletics",
      "raf simons", "라프시몬스", "raf simon",
      "alexander wang", "알렉산더왕", "alexander 왕",
      "clot", "에디슨첸", "edison chen",
      // Wave 235 (2026-05-19): Balenciaga × Adidas collab 200만~270만 8건 mismatch 발견 (별도 SKU 또는 차단).
      "balenciaga", "발렌시아가", "demna", "뎀나",
      // Wave 235: Gucci × Adidas Trefoil 자켓 62만 mismatch.
      "gucci", "구찌",
      // Wave 546 (2026-05-22): production audit — 프라다/베이프 콜라보 100~200만 추가 차단.
      "prada", "프라다", "사피아노",
      "bape", "베이프", "비에이프",
      // Wave 715 P0#2 (2026-05-23): bape 콜라보 흡수 강화. 샤크/ape head/colab 시리즈.
      "샤크", "ape head", "에이프헤드", "ape sta", "에이프 스타",
      "ape", "에이프", "베이핑", "bape sta", "베이프스타",
      // Wave 715: 추가 adidas 콜라보 차단 (trefoil spread 77x).
      "kerwin frost", "커윈프로스트", "커윈 프로스트", "kerwin",
      "stella mccartney", "스텔라매카트니", "스텔라 매카트니",
      "ivy park", "아이비파크", "비욘세",
      "off-white", "오프화이트", "off white", "버질",
      "moncler", "몽클레르", "몽클레어",
      "포플린 트랙", "포플린 자켓", "포플린", // 발렌시아가 포플린 트랙 시리즈
      // Wave 652 (2026-05-22): 레더/세트 outlier 차단 (b_grade spread 13.3x).
      // 레더 자켓 200k outlier (포우 레더 아디컬러 3S 루즈 파이어버드 pid 407184117).
      "포우 레더", "leather 트랙", "레더 트랙", "가죽 트랙", "가죽 자켓", "leather jacket",
      "포 레더", "faux leather", "포레더", "fau leather",
      // 트랙수트 상하의 세트 (자켓 단품 시세와 다름).
      "상하의 세트", "상하의세트", "셋업", "set up", "트랙수트 상하", "[세트]", "[set]",
      "상하의", "상하 세트", "상하세트", "두벌세트", "투피스", "상하 트랙",
      "트랙수트 세트", "트랙 세트", "트랙세트", "tracksuit set",
      // Wave 676 (2026-05-22): adidas_trefoil v30 b_grade spread 8.9x audit.
      // 누빔/퀼팅 (padded variant), 플라워 한정 컬러, 빈티지 블루종 차단.
      "누빔", "누빔 바람막이", "누빔 자켓", "퀼팅 트랙", "퀼팅 자켓",
      "플라워 삼선", "플라워자켓", "꽃무늬 자켓", "플라워 트랙",
      "빈티지 블루종", "빈티지블루종", "올드스쿨 블루종", "제펜 올드스쿨", "japan old school",
      // Wave 816: tee/tank rows were polluting the jacket comparable key.
      "티셔츠", "반팔티", "반팔 티", "반팔 카라", "tank top", "탱크탑", "민소매", "t-shirt", "tee",
      // Wave 763 (2026-05-27): 사용자 발견 — pid 9003606834511 "아디다스 블랙 슬랙스 32칫수"가
      //   adidas_trefoil|pants|b 로 박힘. 바지류 (슬랙스/조거/청바지/면바지) 차단.
      "슬랙스", "slacks", "slack ",
      "조거팬츠", "조거 팬츠", "조거", "jogger", "joggers",
      "면바지", "청바지", "데님 바지", "데님바지",
      "chino", "치노", "치노 바지", "치노바지",
      "와이드 팬츠", "와이드팬츠", "스트레이트 팬츠",
      // 가방 차단
      "가방", "bag", "backpack", "백팩",
      // Wave 715 P2 (2026-05-23): adidas_trefoil_archive 신설 → vintage 명확 차단.
      "빈티지", "vintage", "archive", "아카이브", "y2k", "올드", "old school", "올드스쿨",
      "90년대", "00년대", "90s", "90's", "00s",
      "1990", "1991", "1992", "1993", "1994", "1995", "1996", "1997", "1998", "1999"],
    msrpKrw: 119000, released: 1949,
  },
  // Wave 215 (2026-05-19): Yeezy 신발 + BAPE STA + Stussy 8 Ball — 매물 검증.
  // Yeezy: 신발 매물 매우 많음 (Boost 350 21 / Slide 8 / Foam 8). 가품 risk 큼 — mustNotContain 강력.
  {
    id: "shoe-yeezy-boost-350",
    brand: "Yeezy x Adidas", category: "shoe", laneKey: "yeezy_boost_350",
    modelName: "Yeezy Boost 350 (V1/V2)",
    aliases: ["Yeezy Boost 350", "이지 부스트 350", "Yeezy 350"],
    mustContain: [["yeezy", "이지"], ["350", "boost 350"]],
    mustNotContain: [
      "키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake",
      "이지페이", "이지카", "이지쉐어", "이지팟", "이지에어웨이",
      "boost 500", "boost 700", "slide", "슬라이드", "foam", "폼",
      // Wave 824: multi-size order / dropship style rows are not trustworthy market comps.
      "주문방법", "요청사항", "주문가능사이즈", "색상/사이즈", "해외발송", "배송완료 5-7",
    ],
    msrpKrw: 290000, released: 2015, defaultProductType: "sneaker",
  },
  // Wave 767 (2026-05-27): broad "shoe-yeezy-boost-500-700" deprecate.
  //   문제: 500 vs 700은 다른 silhouette/다른 모델인데 한 SKU에 합본 → narrow (`shoe-yeezy-boost-500-broad` + 신규 `shoe-yeezy-boost-700-broad`)와 collision으로 ruleMatch null 반환.
  //   해결: mustContain "500 700" 명시 매물만 매칭 (현실에서 거의 없음) → 사실상 dead lane. 신규 매물은 narrow가 흡수.
  //   DB의 228 stale raws는 Wave 767 SQL로 500-broad / 700-broad에 재분배.
  {
    id: "shoe-yeezy-boost-500-700",
    brand: "Yeezy x Adidas", category: "shoe", laneKey: "yeezy_boost_500_700",
    modelName: "Yeezy Boost 500 / 700 (deprecated — Wave 767, 분리 narrow 사용)",
    aliases: [],
    mustContain: [["yeezy", "이지"], ["500 700", "700 500", "500/700", "500-700"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "이지페이", "이지카", "boost 350", "350", "slide", "슬라이드", "foam", "폼"],
    msrpKrw: 320000, released: 2017,
  },
  {
    id: "shoe-yeezy-slide",
    brand: "Yeezy x Adidas", category: "shoe", laneKey: "yeezy_slide",
    modelName: "Yeezy Slide",
    aliases: ["Yeezy Slide", "이지 슬라이드", "이지슬라이드"],
    mustContain: [["yeezy", "이지"], ["slide", "슬라이드"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "이지페이", "이지카", "boost", "350", "500", "700", "foam", "폼"],
    msrpKrw: 110000, released: 2019,
  },
  {
    id: "shoe-yeezy-foam-runner",
    brand: "Yeezy x Adidas", category: "shoe", laneKey: "yeezy_foam_runner",
    modelName: "Yeezy Foam Runner",
    aliases: ["Yeezy Foam Runner", "이지 폼 러너", "이지 폼", "Foam RNR"],
    mustContain: [["yeezy", "이지"], ["foam", "폼 러너", "폼러너"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "이지페이", "이지카", "boost", "350", "500", "700", "slide", "슬라이드"],
    msrpKrw: 110000, released: 2020,
  },
  // BAPE STA — 신발 한정
  {
    id: "shoe-bape-sta",
    brand: "A Bathing Ape (BAPE)", category: "shoe", laneKey: "bape_sta",
    modelName: "BAPE STA (Bapesta 시그니처 신발)",
    aliases: ["BAPE STA", "Bapesta", "베이프스타", "베이프 스타"],
    // Wave 810: generic "sta/스타" was catching caps, keychains, Superstar and Instapump rows.
    // Require the Bapesta model phrase as a single intent token.
    mustContain: [["bape sta", "bapesta", "베이프스타", "베이프 스타"]],
    mustNotContain: ["키즈", "kids", "토들러", "복각", "rep ", "replica", "이미테이션", "fake", "샤크 후드", "shark hoodie", "후드", "hoodie", "티셔츠",
      // Wave 636: 한정 variant 차단 (Skull Sta + 새상품 한정 컬러).
      "스컬 스타", "skull sta", "skullsta",
      // Wave 810: BAPE STA sample-pool pollution from non-Bapesta goods or distinct BAPE shoe families.
      "키체인", "키 체인", "keychain", "key chain",
      "리복", "reebok", "인스타 펌프", "인스타펌프", "insta pump", "instapump",
      "슈퍼스타", "superstar",
      "스케이트스타", "스케이트 스타", "sk8", "sk8 sta", "sk8sta",
      "매드 스타", "매드스타", "mad sta", "madsta",
      "apestation", "ape station",
      "솔박스", "solebox",
      // Wave 823: "베이프 스타벅스" contains the loose Korean phrase "베이프 스타";
      // keep BAPE STA shoes, reject goods/accessories and custom non-comparable rows.
      "스타벅스", "스벅", "starbucks",
      "베이비마일로", "베이비 마일로", "baby milo", "milo",
      "피규어", "figure", "toy", "토이",
      "머그", "mug", "코스터", "coaster",
      "목베개", "목쿠션", "neck pillow", "pillow", "쿠션", "cushion",
      "머리핀", "헤어핀", "hairpin", "핀",
      "컨버스", "converse",
      "커스텀", "custom",
      "한정", "limited",
    ],
    msrpKrw: 390000, released: 2002, defaultProductType: "sneaker",
  },
  // Stussy 8 Ball Knit — 한정
  {
    id: "clothing-stussy-8ball-knit",
    brand: "Stussy", category: "clothing", laneKey: "stussy_8ball_knit",
    modelName: "Stüssy 8 Ball Knit Sweater (한정)",
    aliases: ["Stussy 8 Ball Knit", "스투시 8볼 니트", "8 Ball Knit"],
    mustContain: [["stussy", "스투시", "stüssy"], ["8 ball", "8ball", "8볼", "에잇볼"], ["knit", "니트", "sweater", "스웨터"]],
    mustNotContain: ["키즈", "kids", "복각", "rep ", "replica", "이미테이션", "fake", "nike", "나이키", "converse", "컨버스", "dior"],
    msrpKrw: 290000, released: 2018,
  },
  // ─── Wave 266 (2026-05-20): clothing catalog 대폭 보강 — 폴로 broad / 베이프 자켓 /
  //     스투시 broad / 슈프림 broad / 아크네 broad / 꼼데가르송 broad / 칼하트 broad /
  //     톰브라운 broad / 챔피온 broad / MLB apparel / 디스커버리 broad /
  //     TNF 눕시·발토로·맥머도·히말라야 / 파타고니아 broad / 스톤아일랜드 / Moncler / Canada Goose
  ...CLOTHING_WAVE266_CATALOG,
];

// Wave 94: CATALOG 전체 SKU에도 카테고리별 NOISE 자동 spread (GENERATED + CORE + Wave 91 신규 다 포함).
// 이미 박힌 mustNotContain은 union으로 보존.
const CATALOG_WITH_NOISE_W94: Sku[] = CATALOG.map((sku) => {
  const noise = CATEGORY_NOISE_MAP_W94[sku.category];
  if (!noise) return sku;
  return { ...sku, mustNotContain: [...new Set([...sku.mustNotContain, ...noise])] };
});

const SKU_MAP = new Map(CATALOG_WITH_NOISE_W94.map((s) => [s.id, s]));
export function skuById(id: string): Sku | undefined {
  return SKU_MAP.get(id);
}

// Wave 196 (2026-05-18): catalog SKU 의 search query 자동 매핑.
//   각 SKU 의 `searchQueries` (수동) 또는 `aliases` (자동 fallback) 를 모아 dedupe.
//   pipeline-config.ts 의 envQueries() 가 DEFAULT_SEARCH_QUERIES 와 병합.
//   효과: 신발 (specific query 30+) fresh_28h 80%+ 처럼 다른 카테고리도 SKU 별 매물 cover ↑.
//   policy: searchQueries 빈 배열 []  명시 → noise 위험 SKU 자동 매핑 차단 (Wave 86 ILCE-7C 94% noise 학습).
//   undefined → aliases 자동 매핑. searchQueries 있으면 aliases 무시.
export function buildCatalogSearchQueries(): string[] {
  return buildCatalogSearchQueryEntries().map((entry) => entry.query);
}

export type CatalogSearchQueryEntry = {
  query: string;
  category: Sku["category"];
};

function normalizeCatalogSearchQuery(raw: string) {
  return raw.trim().toLowerCase();
}

export function buildCatalogSearchQueryEntries(): CatalogSearchQueryEntry[] {
  const seen = new Set<string>();
  const entries: CatalogSearchQueryEntry[] = [];
  for (const sku of CATALOG) {
    const list = sku.searchQueries ?? sku.aliases;
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      const q = typeof raw === "string" ? raw.trim() : "";
      if (!q) continue;
      // alias 짧으면 noise 위험 (예: "X" 단독). 4자 미만 skip.
      if (q.length < 4) continue;
      const key = normalizeCatalogSearchQuery(q);
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ query: q, category: sku.category });
    }
  }
  return entries;
}

let catalogSearchQueryCategoryMap: Map<string, Sku["category"]> | null = null;

export function catalogCategoryForSearchQuery(query: string): Sku["category"] | null {
  if (!catalogSearchQueryCategoryMap) {
    catalogSearchQueryCategoryMap = new Map(
      buildCatalogSearchQueryEntries().map((entry) => [
        normalizeCatalogSearchQuery(entry.query),
        entry.category,
      ]),
    );
  }
  return catalogSearchQueryCategoryMap.get(normalizeCatalogSearchQuery(query)) ?? null;
}

const NORMALIZATIONS: [RegExp, string][] = [
  [/usb[\s\-_]*c/gi, " usbc "],
  [/c[\s\-_]*type/gi, " usbc "],
  [/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/gi, " usbc "],
  [/1\s*세대|일\s*세대|first|1st/gi, " 1세대 "],
  [/2\s*세대|이\s*세대|second|2nd/gi, " 2세대 "],
  [/3\s*세대|삼\s*세대|third|3rd/gi, " 3세대 "],
  [/4\s*세대|사\s*세대|fourth|4th/gi, " 4세대 "],
  // `(?!\d)` prevents "프로 14" / "프로14" from being consumed as "프로 1" + leftover "4",
  // which previously destroyed any "14"/"15"/etc digit after "프로".
  [/프로\s*2(?!\d)/gi, " 프로 프로2 2세대 "],
  [/프로\s*1(?!\d)/gi, " 프로 프로1 1세대 "],
  [/\bpro\s*2\b/gi, " pro pro2 2세대 "],
  [/\bpro\s*1\b/gi, " pro pro1 1세대 "],
  [/에어팟\s*([234])/g, " 에어팟 $1세대 "],
  [/에어팟프로\s*([123])/g, " 에어팟 프로$1 "],
  [/애어팟/g, " 에어팟 "],
  // Wave 108: (?!\d) lookahead 추가. 이전 `/울트라\s*2/`가 "울트라 256기가"의 "2"를 잡아
  // "울트라 2 56기가"로 분리 → Galaxy S Ultra 256GB 자급제 narrow lane 매칭 전부 실패.
  [/울트라\s*2(?!\d)/gi, " 울트라 2 "],
  [/ultra\s*2(?!\d)/gi, " ultra 2 "],
  [/se\s*([123])(?!\d)/gi, " se$1 "],
  [/시리즈\s*([0-9]+)/g, " 시리즈 $1 "],
  [/series\s*([0-9]+)/gi, " series $1 "],
  [/애플\s*워치/g, " 애플워치 "],
  [/갤럭시\s*워치/g, " 갤럭시워치 "],
  [/아이\s*패드/g, " 아이패드 "],
  [/아이패드\s*(프로|에어|미니)/g, " 아이패드 $1 "],
  [/갤럭시\s*탭/g, " 갤럭시탭 "],
  [/갤\s*탭/g, " 갤탭 "],
  [/air\s*pods/gi, " airpods "],
  // Wave 111 (2026-05-15): 모델명-suffix 공백 비대칭 정규화. iPhone 15 Pro lane이 49% 매칭에 그친 근본 원인.
  // "아이폰 15프로" / "아이폰15 프로" / "iphone 15pro" 같은 매물 표기를 "아이폰 15 프로"로 통일.
  // 영향: Galaxy S Ultra / Plus, iPad Pro/Air/Mini 동일 패턴 해결.
  [/아이폰\s*(\d{1,2}e?)\s*프로\s?맥스/g, " 아이폰 $1 프로맥스 "],
  [/iphone\s*(\d{1,2}e?)\s*pro\s?max/gi, " iphone $1 pro max "],
  [/아이폰\s*(\d{1,2}e?)\s*프로(?!\s?맥)/g, " 아이폰 $1 프로 "],
  [/iphone\s*(\d{1,2}e?)\s*pro(?!\s?max)/gi, " iphone $1 pro "],
  [/아이폰\s*(\d{1,2}e?)\s*플러스/g, " 아이폰 $1 플러스 "],
  [/iphone\s*(\d{1,2}e?)\s*plus/gi, " iphone $1 plus "],
  [/갤럭시\s*s\s?(\d{1,2})\s*울트라/gi, " 갤럭시 s$1 울트라 "],
  [/galaxy\s*s\s?(\d{1,2})\s*ultra/gi, " galaxy s$1 ultra "],
  [/갤럭시\s*s\s?(\d{1,2})\s*플러스/gi, " 갤럭시 s$1 플러스 "],
  [/galaxy\s*s\s?(\d{1,2})\s*plus/gi, " galaxy s$1 plus "],
  [/갤럭시\s*z\s*(플립|폴드)\s?(\d{1,2})/gi, " 갤럭시 z$1 $2 "],
  [/galaxy\s*z\s*(flip|fold)\s?(\d{1,2})/gi, " galaxy z$1 $2 "],
  // Wave 111b: iPad 인치 normalize — "아이패드 프로 13 M4" 같이 인치 명시 없는 매물도 매칭.
  // iPad mini는 8.3인치 (별도). Pro/Air만 11/13 적용.
  [/(아이패드\s*(?:프로|에어))\s*13(?!\d|\.|인치)/gi, " $1 13인치 "],
  [/(아이패드\s*(?:프로|에어))\s*11(?!\d|\.|인치)/gi, " $1 11인치 "],
  [/(ipad\s*(?:pro|air))\s*13(?!\d|\.|in)/gi, " $1 13in "],
  [/(ipad\s*(?:pro|air))\s*11(?!\d|\.|in)/gi, " $1 11in "],
  // Wave 114c (2026-05-15): iPad Pro 12.9 → 13인치 변환 (같은 모델 다른 표기).
  // 발견: 7일 매물 1204건 중 "12.9" 315건 vs "13인치" 86건 (12.9가 4배 많음).
  // Apple은 M4 (2024)부터 12.9 → 13인치 명칭 변경했으나 매물 표기는 12.9 압도적.
  // M2/M4 모두 같은 12.9인치 디스플레이라 narrow lane 매칭 가능 (변형 흡수, 의미 동일).
  [/(아이패드\s*프로)\s*12\.9/g, " $1 13인치 "],
  [/(ipad\s*pro)\s*12\.9/gi, " $1 13in "],
  // Wave 111e (2026-05-15): Galaxy S "갤럭시" 명시 없는 매물 brand-less normalize.
  // lookbehind에 "갤럭시" 명시 검사 추가 — 이미 brand 있으면 변환 X (token 이중 변환 차단).
  [/(?<!갤럭시\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*울트라/gi, " 갤럭시 s$1 울트라 "],
  [/(?<!갤럭시\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*플러스/gi, " 갤럭시 s$1 플러스 "],
  [/(?<!galaxy\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*ultra/gi, " galaxy s$1 ultra "],
  [/(?<!galaxy\s)(?<![가-힣a-z0-9])s\s?(\d{2})\s*plus/gi, " galaxy s$1 plus "],
  // Wave 118b (2026-05-15): catalog token 보호 + brand lookbehind.
  // (?<=\s) — 단어 시작 변환 X (catalog token "플립6" 자체는 normalize 영향 X).
  // (?<!jbl\s)(?<!sony\s) — JBL/Sony 매물 보존.
  [/(?<=\s)(?<!갤럭시\s)(?<!갤럭시\sz)(?<!jbl\s)(?<!sony\s)(?<!bose\s)플립\s?(\d{1,2})/gi, " 갤럭시 z플립 $1 "],
  [/(?<=\s)(?<!갤럭시\s)(?<!갤럭시\sz)(?<!jbl\s)(?<!sony\s)(?<!bose\s)폴드\s?(\d{1,2})/gi, " 갤럭시 z폴드 $1 "],
  // Wave 111c: iPad mini 7 표기 변형 normalize.
  // "아이패드7 미니" / "아이패드 7미니" / "아이패드 미니 7" / "아이패드미니7" → "아이패드 미니 7"
  [/아이패드\s*7\s+미니/g, " 아이패드 미니 7 "],
  [/아이패드\s+7미니/g, " 아이패드 미니 7 "],
  [/아이패드\s*미니\s*7\b/g, " 아이패드 미니 7 "],
  [/아이패드미니\s*7\b/g, " 아이패드 미니 7 "],
  [/ipad\s*7\s+mini/gi, " ipad mini 7 "],
  [/ipad\s+7mini/gi, " ipad mini 7 "],
  // Wave 113 (2026-05-15): MacBook 모델명+인치 공백 비대칭 normalize.
  // "맥북에어13" / "맥북 에어13" / "맥북에어 13" → "맥북 에어 13인치"
  // 발견: macbook-air broad 145건 reclassify 후 audit, 모델명+숫자 붙은 매물이
  // narrow lane mustContain "13인치" 매칭 못 함 → broad만 흡수. 변형 흡수.
  [/맥북\s*에어\s*13(?!\d|\.|인치|in)/g, " 맥북 에어 13인치 "],
  [/맥북\s*에어\s*15(?!\d|\.|인치|in)/g, " 맥북 에어 15인치 "],
  [/맥북\s*프로\s*13(?!\d|\.|인치|in)/g, " 맥북 프로 13인치 "],
  [/맥북\s*프로\s*14(?!\d|\.|인치|in)/g, " 맥북 프로 14인치 "],
  [/맥북\s*프로\s*16(?!\d|\.|인치|in)/g, " 맥북 프로 16인치 "],
  [/macbook\s*air\s*13(?!\d|\.|in)/gi, " macbook air 13in "],
  [/macbook\s*air\s*15(?!\d|\.|in)/gi, " macbook air 15in "],
  [/macbook\s*pro\s*13(?!\d|\.|in)/gi, " macbook pro 13in "],
  [/macbook\s*pro\s*14(?!\d|\.|in)/gi, " macbook pro 14in "],
  [/macbook\s*pro\s*16(?!\d|\.|in)/gi, " macbook pro 16in "],
  // Wave 189 (2026-05-18): production sweep 결과 garmin/gopro raw 138건 중 detail_queue 진입 0건.
  // 원인: "피닉스7x" / "고프로 12" 같은 공백/축약 표기를 catalog mustContain이 매칭 못 함.
  // 정규화로 공통 표기 통일.
  // Garmin Fenix 시리즈: "피닉스7x" / "페닉스 7s" / "fenix8" → "피닉스 7x" / "fenix 8"
  [/(피닉스|페닉스)\s*(7s|7x|7|8|6s|6x|6)/gi, " 페닉스 $2 "],
  [/fenix\s*(7s|7x|7|8|6s|6x|6)/gi, " fenix $1 "],
  // Garmin Forerunner: "포러너970" / "fr 965" → "포러너 970" / "fr 965"
  [/(포러너|forerunner)\s*(\d{3})/gi, " $1 $2 "],
  [/\bfr\s*(\d{3})/gi, " fr $1 "],
  // GoPro Hero 시리즈: "고프로 12" / "gopro12" → "고프로 히어로 12" (12 단독 매물에서 SKU 분리 가능)
  // 조건: "고프로/gopro" 뒤 9~13 숫자만 (다른 의미 "고프로 12개월" 매물 보호 위해 word boundary).
  [/(고프로|gopro)\s*(9|10|11|12|13)(?!\d)/gi, " $1 히어로 $2 hero $2 "],
  [/(고프로|gopro)\s*맥스/gi, " $1 맥스 max "],
];

export function normalize(text: string): string {
  let t = (text ?? "").toLowerCase();
  t = t.replace(/\+/g, " plus ");
  for (const [pat, repl] of NORMALIZATIONS) {
    t = t.replace(pat, repl);
  }
  t = t.replace(/[^0-9a-z가-힣]+/g, " ");
  // Wave 268 (2026-05-20): 한글-숫자 경계 공백 강제 → "조던1" / "조던 1" canonical 통합.
  //   사용자 발견 (API sweep): 매물 "나이키 조던 1 로우 스캇 모카" → SKU mustContain "조던1" (공백 없음) 매칭 X.
  //   systemic 해결: normalize 단계에서 한글-숫자 경계 공백 강제 → 모든 SKU/매물 같은 canonical form.
  //   효과: shoe-nike-jordan-1-* / dunk-low-* / af1 등 수십~수백건 catch.
  //   영문 단어 (jordan 1) 는 이미 공백 있어 영향 X.
  t = t.replace(/([가-힣])(\d)/g, "$1 $2");
  t = t.replace(/(\d)([가-힣])/g, "$1 $2");
  t = t.replace(/\s+/g, " ").trim();
  return ` ${t} `;
}

function tokenHit(normalizedText: string, token: string): boolean {
  const normalizedToken = normalize(token);
  const n = normalizedToken.trim();
  if (!n) return false;
  // Bag broad uses "백 " as a Korean suffix signal (레이디백/게임백/에르백).
  // Keep suffix matching, but do not let department-store or beauty-line words
  // like "백화점판" / "백스테이지" become a bag product-type signal.
  if (n === "백") return /백(?!화점|스테이지)/.test(normalizedText);
  // "부츠컷/bootcut" is a denim silhouette, not a shoe/boot listing.
  if (n === "부츠") return /부츠(?!컷)/.test(normalizedText);
  if (n === "boot") return /\bboot\b/.test(normalizedText);
  // Wave 463: bare Korean substring matching made "판매입니다" look like "매입".
  // Treat 매입 as an actual word/service phrase, not a cross-syllable fragment.
  if (n === "매입") return /(?:^|[^가-힣])매입(?:$|[^가-힣]|하|합|문|상|가|진|약|제|글|도|을|은|원)/.test(normalizedText);
  if (/^\s|\s$/.test(token)) return normalizedText.includes(normalizedToken);
  if (/^\d+$/.test(n)) return normalizedText.includes(` ${n} `);
  // Short latin tokens such as "lv", "nb", "ps", "se" should not hit inside
  // longer model strings (e.g. Nike AF1 LV8 was leaking into Louis Vuitton).
  if (/^[a-z0-9]{1,3}$/.test(n)) return normalizedText.includes(` ${n} `);
  if (/\s\d+$/.test(n)) return normalizedText.includes(normalizedToken);
  return normalizedText.includes(n);
}

// Wave 230 (2026-05-19): GLOBAL fashion noise — 모든 shoe/clothing/bag SKU 에 자동 적용.
//   사용자 명시 "야구공 같은 거 들어오는 건 파서가 병신이란 것".
//   각 catalog 별 mustNotContain 박는 것보다 parser 단에서 globally 차단이 안전.
//   product-type cross-category noise (저지/유니폼/카드/야구공 등) +
//   weak signal (무드/스타일/닮은) + 매입글/단품 noise.
const GLOBAL_FASHION_NOISE: string[] = [
  // cross-product (의류/신발/가방 SKU 에 매칭되면 안 되는 단어)
  "야구공", "baseball", "유니폼", "uniform", "저지", "jersey",
  "카드", "topps", "탑스", "도쿄시리즈", "도쿄 시리즈", "tokyo series",
  // 매물 비교 (brand A 의 매물명에 brand B 가 나옴 — false match)
  "포지션", "포지셔닝", "느낌", "vs",
  // weak signal — "rrl 무드" / "polo 스타일" 같은 가짜 brand 매물
  "무드", "스타일 매물", "비슷한 디자인", "닮은 디자인",
  // 단품 / 손상 / 매입
  "한짝", "한 짝", "한쪽만", "왼발", "오른발", "왼 쪽", "오른 쪽", "한쪽",
  "삽니다", "구합니다", "구해요", "매입", "살게요", "찾아요",
  "찢어짐", "파손", "곰팡이", "구멍 있", "크랙 큼", "훼손",
  // Wave 235 (2026-05-19): 역경매 (구매 요청) 매물 차단.
  //   sample sweep 발견 — "(구매) rrl 반다나" 9,999,999 / "RRL 콩그레스 구매 원합니다" 11,111,111 등.
  //   셀러가 사는 매물 = 미뇨이 candidate pool 에 들어오면 안 됨 (시세 inflation).
  "구매 원함", "구매원함", "구매원해요", "구매 원해요", "구매원합니다", "구매 원합니다",
  // Bracketed "(구매)" is handled in classifyListing using raw title punctuation.
  // Keeping it here normalizes to bare "구매" and blocks purchase-proof text
  // such as "백화점구매인증가능".
  "구매희망", "구매 희망", "구매합니다", "구해 봅니다", "사고 싶어요", "사고싶어요",
  // Wave 235: SOLD / 판매완료 마커 차단 — 1B/placeholder 가격 동반 빈도 높음.
  "sold", "판매완료", "판완료", "거래완료", "예약완료", "판매됨",
  // Wave 492: multi-item bundles distort fashion comparable prices.
  "일괄", "묶음", "벌 일괄", "셋업", "set up", "setup",
  // Wave 603b: 다중 묶음 매물 추가 패턴 (clothing/shoe/bag 모두 적용).
  //   production: pid 371937927 '샤넬 정품가방 3개랑 생로랑1개 선착순 현재가로 2500넘죠' 10M.
  //   주의: '선착순' 단독은 단일 매물 광고에도 자주 등장 (false positive 위험) — 제외.
  "가방 2개", "가방 3개", "가방 4개", "가방2개", "가방3개", "가방4개",
  "옷 2벌", "옷 3벌", "옷 4벌", "2벌 일괄", "3벌 일괄",
  "신발 2켤레", "신발 3켤레",
  "신발 2개", "신발2개", "신발 3개", "신발3개", "신발 4개", "신발4개",
  "운동화 2개", "운동화2개", "운동화 3개", "운동화3개",
  "스니커즈 2개", "스니커즈2개", "스니커즈 3개", "스니커즈3개",
  "슈즈 2개", "슈즈2개", "슈즈 3개", "슈즈3개",
  "1개랑", "2개랑", "3개랑", "4개랑",
  // Wave 619: 추가 묶음 패턴 — production 발견 (pid 395485532 '개당가격입니다').
  "개당가격", "개당 가격", "각 5만", "각 10만", "각 20만", "각 30만", "각 50만",
  "전체 가죽가방", "전체 가방", "전체 옷", "전체 신발",
  // Wave 626: 다중 대수 표기 (전자기기 — pid 339641057 '아이폰16 프로맥스 2대 판매').
  "2대 판매", "3대 판매", "4대 판매", "5대 판매",
  "2대판매", "3대판매", "4대판매", "5대판매",
  "2대 일괄", "3대 일괄",
  // Wave 627: 대량 묶음 (pid 361551659 '갤럭시 탭 S9 FE+ 미개봉 10대').
  //   주의: '5대'/'10대' 단독은 '20대 여성' 같은 정상 매물 false positive — 동사/수식어 필수.
  "10대 판매", "20대 판매", "30대 판매",
  "미개봉 5대", "미개봉 10대", "미개봉 20대",
  "5대 일괄", "10대 일괄", "20대 일괄",
  // Wave 644: 추가 다중 대수 (pid 407612792 '에어팟 맥스 c타입 4대 예약').
  "2대 예약", "3대 예약", "4대 예약", "5대 예약", "4대 미개봉", "5대 미개봉",
  "헤드폰 에어팟 에어팟맥스 버즈",  // 다중 brand 표기 광고 패턴
  // Wave 628: 다중 가방 묶음 표기 (pid 408522830 '샤넬 코코핸들 클래식 가브리엘 세트 정품 1800만 가방한개가격').
  "가방한개가격", "가방 한개 가격", "가방한개 가격", "한개가격",
  "세트 정품", "세트정품 1800",
  "코코핸들 클래식 가브리엘", "코코핸들 가브리엘",
  // 사이즈 미상
  "사이즈 미상", "사이즈 불명", "사이즈 확인불가", "사이즈 모름",
  // 아동
  "아동", "유아", "3t", "4t", "5t", "infant", "toddler", "어린이",
  // 짝퉁 명시
  "짝퉁", "복각", "레플", "reps", "이미테이션", "imitation", "fake", "미러급", "1:1",
  // Wave 542 (2026-05-22): production audit — "슈프림 맛" (공백) / "슈프림맛" 가품 표기 차단.
  //   사용자 본 매물 "슈프림 맛 노스페이스 마운틴 자켓 미시착 새상품" 17.5만 (정품 60~70만) 가품.
  //   주의: "스럽" / "느낌" / "감성" 단독은 "디스럽트" (Nike Dunk Disrupt) / "느낌 좋음" 같은 정상 매물과
  //   substring collision. 명시적 "X 맛" 패턴만 차단.
  "슈프림 맛", "노스 맛", "베이프 맛", "구찌 맛", "프라다 맛", "디올 맛", "롤렉스 맛",
  "사카이 맛", "sacai 맛", "sakai 맛",
  "슈프림맛", "노스페이스맛", "베이프맛", "구찌맛", "프라다맛", "사카이맛", "sacai맛", "sakai맛",
  "맛 슈프림", "맛 노스",
  "사카이 스타일", "sacai style", "sakai style",
  // X 스럽 (한글 어미) — 공백 있는 형태만 (디스럽트 collision 차단)
  "슈프림 스럽", "노스 스럽", "베이프 스럽", "구찌 스럽",
  // Wave 231 (2026-05-19): alteration — 사이즈/형태 변형 매물 (시세 다름).
  //   "노수선" / "무수선" 은 정상 매물 → 정확한 alteration 단어만.
  "기장수선", "기장 수선", "발볼 늘림", "밑창 수리", "재봉 보수", "리사이즈",
  "커스텀 슬림핏", "커스텀 사이즈", "커스텀 변형", "커스텀 핏", "커스텀 페인팅",
  "커스터마이징", "customized", "custom painted", "리폼", "reform",
  // Wave 231: 매물 신뢰도 약함 — 출처 모호 / 비전문
  "지인이 받은", "지인에게 받은", "친구한테 받은", "선물 받은", "받은 거", "받은 선물",
  "대신 판매", "대신판매", "대신 팔아", "판매 대행", "판매대행",
  "재고 사진", "사진 도용", "썸네일만", "썸네일 만",
  // Wave 231: 시즌 outlet / 박물관 / 샘플
  "샘플", "박물관", "전시품", "디스플레이용", "display only",
  // Wave 231: 단순 옵션/사이즈 변형/리워크
  "리워크", "rework", "리메이크", "remake", "업사이클링", "upcycling",
  // Wave 653 (2026-05-22): 가품 거래 코드 워딩 (combined match path 차단).
  //   pid 408135119 Arc'teryx Beta SL 130k 가품 발견 ("느낌 아시니깐 연락주세요").
  //   주의: "느낌" 단독은 line 10792에 박혀 있지만 substring collision 위험 — 명시 패턴만.
  "느낌 아시", "느낌아시", "느낌 알", "느낌알",
  "느낌 오시", "느낌오시",
  "저렴하게 판매", "저렴하게드려요", "저렴하게 드려요",
  "오시면 압니다", "와서 보시면", "사진 보시면", "사진보시면",
  // Wave 671 (2026-05-22): 짭/짝퉁 코드 워딩 (탭체/택체 — 정품 표기 모방).
  //   pid 409056204 꼼데 컨버스 60k 발견 ("탭체 새제품" — 정상 12-18만 대비 1/3).
  //   "탭체"는 정품 표기처럼 보이게 한 한국 fake 마켓 코드.
  "탭체", "탭 체", "택체", "택 체",
  "택1급", "1급 정품", "1:1 정품",
  "스급정품", "s급 정품", "ss급정품", "ss급 정품",
  "11급", "정품 11", "고급 1:1",
];

// Wave 230: CATEGORY-specific cross-category noise.
//   clothing SKU 인데 가방/신발 단어 — bag/shoe 매물 차단.
const CATEGORY_FASHION_NOISE: Partial<Record<NonNullable<Sku["category"]>, string[]>> = {
  clothing: [
    "가방", "backpack", "백팩", "토트백", "tote bag", "숄더백", "크로스백", "메신저", "messenger",
    "월렛", "wallet", "지갑", "장지갑",
    // Wave 424: paper shopping-bag accessory-only rows were leaking into clothing broad.
    // Keep plain "쇼핑백 포함" allowed for full-set clothing listings.
    "쇼핑백 미사용", "쇼핑백만", "쇼핑백 단품", "종이백", "종이 백", "paper bag",
    "운동화", "sneaker", "스니커즈", "부츠", "boot", "샌들", "슬리퍼", "뮬",
    // Wave 235 (2026-05-19): 모자/캡 매물이 의류 SKU 매칭 차단.
    //   sample sweep 발견 — Stussy x Bape 트러커 캡이 bag-stussy-crossbody 매칭.
    //   동일 brand clothing SKU 도 같은 risk → 차단.
    "트러커 캡", "trucker cap", "메쉬캡", "메쉬 캡", "볼캡", "ball cap",
    "벙거지", "버킷햇", "bucket hat", "비니", "beanie", "야구모자",
    // Wave 238 (2026-05-19): production audit — Acne 신발 매물 (바틸다 삭스슈즈/네오프렌 부티) 의류 SKU 매칭.
    "부티", "booties", "삭스슈즈", "삭스 슈즈", "sock shoes",
    "러너 슈즈", "runner shoe", "러닝화", "트레이너", "trainer",
    "슈즈", "shoes",
  ],
  shoe: [
    "자켓", "jacket", "코트", "coat", "재킷",
    "티셔츠", "tee ", "맨투맨", "후드", "후디", "hoodie", "셔츠", "shirt",
    // Wave 809: operator sample audit — BAPE/MM6/ADER shoe buckets were polluted
    // by same-brand caps, collar tees, and Starbucks cup/tumbler goods.
    "카라티", "카라 티", "피케", "pique", "폴로티", "폴로 티",
    "볼캡", "볼 캡", "메쉬캡", "메쉬 캡", "트러커캡", "트러커 캡",
    "러닝캡", "러닝 캡", "캠프캡", "캠프 캡", "running cap", "camp cap",
    " 캡 ", "cap", "mesh cap", "모자", "hat",
    " 컵 ", "리유저블 컵", "텀블러", "tumbler", "mug",
    "팬츠", "pants", "바지", "쇼츠",
    "니트", "knit", "패딩", "down jacket", "롱슬리브",
    "가방", "backpack", "백팩", "토트백", "월렛", "지갑",
    // Wave 703 (2026-05-23) HOTFIX: Crocs 비신발 + 가품 lookalike 차단.
    //   bias-free 검증 — Crocs 28건 비신발 noise (지비츠 단품/iPhone 케이스/Crocs bag) + 11건 가품 (크록스st)
    "지비츠 단품", "지비츠만", "지비츠 세트", "led 지비츠", "체인 지비츠", "꽃지비츠", "실리콘 참",
    "아이폰 케이스", "iphone 케이스", "폰 케이스", "폰케이스", "iphone case",
    "크록스백", "크록스 백", "크록스 쇼퍼", "크록스 토트", "크록스 메신저",
    // 가품 lookalike (크록스 외 brand에도 안 나옴 — 안전)
    "크록스st", "크록스 st", "크록샌들", "eva슬리퍼", "eva 슬리퍼", "크록스 스타일", "크록스 느낌", "크록스킨",
  ],
  bag: [
    // Wave 232 (2026-05-19): bag SKU 에 시계/신발/의류 차단 강화.
    //   사용자 명시 "프라다 빈티지 시계가 bag-prada SKU 매칭" — Wave 230 noise 부족.
    "뷰티", "beauty", "코스메틱", "cosmetic", "화장품",
    "백스테이지", "backstage", "블러셔", "blusher", "팔레트", "palette", "아이크림", "하이라이터",
    "립스틱", "립밤", "어딕트", "홀리데이",
    "운동화", "sneaker", "스니커즈", "부츠", "boot", "샌들", "sandal",
    "슈즈", "shoes", "메리제인", "mary jane", "더비", "derby", "펌프스", "pumps",
    "플랫슈즈", "flat shoes", "로퍼", "loafer", "옥스포드", "oxford",
    "뮬", "mule", "슬리퍼", "slipper", "에스파드류", "espadrille",
    "자켓", "jacket", "코트", "coat", "재킷",
    "티셔츠", "tee ", "맨투맨", "후드", "후디", "hoodie", "셔츠", "shirt",
    "팬츠", "pants", "바지", "쇼츠",
    // Wave 232: 시계/주얼리 차단
    "시계", "watch", "시계줄", "watch strap", "팔찌", "bracelet", "목걸이", "necklace",
    "반지", "ring", "귀걸이", "earring", "925",
    // Wave 235 (2026-05-19): 모자/캡 매물 차단 (bag SKU 와 cross-category 매칭).
    //   sample sweep 발견 — "스투시x베이프 30주년 카모 메쉬캡 트러커" 가 bag-stussy-crossbody 매칭.
    "트러커 캡", "trucker cap", "메쉬캡", "메쉬 캡", "볼캡", "ball cap",
    "벙거지", "버킷햇", "bucket hat", "비니", "beanie", "야구모자",
  ],
};

// Wave 236 (2026-05-19): 모든 카테고리 공통 — 역경매/구함 패턴.
//   사용자 코멘트 pid 397387660: "갤탭 s9 fe 플러스 구함" → galaxy-tab-s9-fe-plus 매칭 (smartphone/tablet 통과).
//   기존 GLOBAL_FASHION_NOISE 의 "구매 원함" 등은 fashion 카테고리만 적용 → 다른 카테고리 누락.
//   근본 fix: 의미 자체가 역경매인 패턴은 모든 카테고리 차단.
const UNIVERSAL_BUY_REQUEST_NOISE: string[] = [
  "구함\\b", "구해요", "구합니다", "구해봅니다", "구해 봅니다", "구매글",
  "구매 원함", "구매원함", "구매원해요", "구매 원해요", "구매원합니다", "구매 원합니다",
  // Wave 237 (2026-05-19): production audit — Apple Watch Ultra "구매합니다(가격상의)" 500k 매물 통과.
  "구매합니다", "구매 합니다",
  // Bracketed "(구매)" is raw-punctuation sensitive; see pipeline.buyingHits.
  "구매희망", "구매 희망",
  "사고 싶어요", "사고싶어요", "사고싶습니다", "삽니다", "살게요", "매입",
];

// Wave 237 (2026-05-19): production audit — 액세서리/단품 매물이 본품 SKU 매칭 (cross-cutting).
//   smartwatch 사례: "정품 스포츠 실리콘밴드" 50k / "스포츠루프 스타라이트" 17k → applewatch-series4 매칭.
//   본품 매물 (애플워치 시리즈4 13~16만) 가격대와 10배 차이 → 시세 왜곡 큼.
//   사용자 코멘트 발단 패턴 (Wave 235): DJI 렌즈 단품 / 에어팟 한쪽 / 시계 밴드 단품 다 cross-cutting.
const UNIVERSAL_ACCESSORY_ONLY_NOISE: string[] = [
  // 시계 / 스마트워치 밴드 단품 (smartwatch 카테고리만 적용 가능 but 다른 카테고리 영향 X)
  "밴드만", "밴드 단품", "스트랩만", "스트랩 단품", "줄만", "워치줄만", "워치 스트랩만",
  "스포츠 ?루프", "sport ?loop",
  "버클만", "버클 단품",
];

function isPurchaseHistoryText(rawText: string): boolean {
  const raw = rawText.toLowerCase();
  return (
    /(?:백화점|매장|국내\s*매장|공홈|공식\s*사이트|온라인|크림|kream|스탁엑스|스턱엑스|stockx|고트|goat|아디다스코리아|신세계|현대무역|더현대|현대닷컴|온유어마크|live\s*stock|노클레임|직구|구매처|구입처|아울렛|편집샵|스토어|발매가|정가|구매가).{0,16}구매/.test(raw) ||
    /(?:당첨|라플|raffle).{0,16}구매/.test(raw) ||
    /구매\s*(?:영수증|내역|처|처는|처가|완료|후|당시|했습니다|했어요|함|한\s*제품|제품|가격|가는|가|대행|내역서)/.test(raw) ||
    /\d{4}\s*[./-]\s*\d{1,2}\s*구매/.test(raw) ||
    /구매\s*\d{4}\s*년?\s*\d{0,2}\s*월?/.test(raw) ||
    /구매\s*\d{1,4}\s*(?:초반|중반|후반|만원|만|원|때)|\d[\d,]*\s*원에\s*구매/.test(raw) ||
    /(?:^|[\s/.-])\d{1,2}\s*\/\s*\d{1,2}\s*구매/.test(raw) ||
    /\d{1,3}\s*(?:중|만원|만).{0,8}구매/.test(raw) ||
    /구매\s*(?:관련\s*문의|시\s*요청|전\s*채팅|전\s*문의)/.test(raw) ||
    /구매\s*시.{0,16}(?:무료\s*배송|배송|택배|할인)/.test(raw)
  );
}

function isSellerPurchaseServiceText(rawText: string): boolean {
  const raw = rawText.toLowerCase();
  return /(?:명품\s*)?매입\s*문의|최고가\s*매입|위탁\s*매입|매입\s*,?\s*위탁\s*판매|매입\s*판매\s*상담|매입\s*상담|매입\s*가능|방문\s*매입|현금\s*매입|당일\s*매입|항시\s*매입|매입\s*진행|매입\s*약속|매입\s*제품/.test(raw);
}

function isScarcityText(rawText: string): boolean {
  return /못\s*구해요|못\s*구함|못\s*구합니다|구하기\s*힘든|구하기\s*어려운/.test(rawText.toLowerCase());
}

// Wave 242 (2026-05-19): system-wide designer collab 자동 차단 (사용자 지적 — 패턴 fashion 전반).
//   "왜 특정 옷들만? 해당 패턴이 다른 SKU/lane 에서도 발생할 것" — 그대로 정확.
//   broad fashion SKU 가 designer collab 매물 (Thom Browne / Travis Scott / JJJJound 등) 매칭 시
//   가격대 3~10배 차이 → 시세 왜곡.
//   skuMatches 안에서 intersect-aware 차단: sku.mustContain 토큰과 겹치는 brand 는 skip
//     (의도된 collab SKU 는 mustContain 에 brand 박혀있어서 skip → 정상 통과).
//     broad SKU 는 그 brand mustContain 에 없으면 차단 → 자동 정확.
// Wave 254.6 (2026-05-20): clothing jacket/down_jacket/coat SKU 의 product_type variant 매물 차단 (intersect-aware).
//   사용자 발견 root: parseClothingProductType regex 가 모델명 (눕시/nuptse) 을 product_type 키워드 (쇼츠/shorts) 보다 먼저 매칭.
//   1차 fix: parser regex 우선순위 정정 (wave92-fashion-mobility.ts).
//   2차 fix: catalog 에서도 명백 product_type 불일치 매물 차단 (이 list).
//   policy: SKU defaultProductType 이 jacket/down_jacket/coat 인데 매물 text 에 명백 product_type
//     키워드 (쇼츠/모자/벨트/지갑/스커트/원피스) 매치 시 reject. mustContain 토큰에 있으면 skip
//     (예: Polo RRL 의 belt SKU 매칭은 통과).
//   효과: clothing-tnf-nuptse-1996 / mountain-jacket / denali-fleece / arcteryx-* /
//     patagonia-* / supreme-* 등 17 jacket SKU 일괄 보강 (1타 N피).
const CLOTHING_JACKET_PRODUCT_TYPE_MISMATCH_NOISE: string[] = [
  // shorts variant (눕시 쇼츠 / 마운틴 쇼츠 / RRL 쇼츠)
  "쇼츠", "반바지", "shorts", "버뮤다", "bermuda", "쇼츠 m", "쇼츠 l", "쇼츠 s",
  // cap/hat variant (Supreme 모자 / TNF 모자 / 비니)
  "모자", "비니", "beanie", "볼캡", "ball cap", "야구모자", "버킷햇", "bucket hat",
  "벙거지", "스냅백", "snapback", "메쉬캡", "트러커캡", "trucker cap",
  "5패널", "파이브패널", "five panel", "5 panel",
  // belt variant (Supreme 벨트 / Polo RRL 벨트)
  "벨트", "belt",
  // wallet variant (지갑 / 카드지갑 / 콘초 월렛)
  "지갑", "wallet", "월렛", "장지갑", "카드지갑", "반지갑",
  // skirt / dress variant
  "스커트", "skirt", "원피스", "드레스",
  // shirt / tee / polo variants should not price against outerwear/down jacket lanes.
  "셔츠", "shirt", "티셔츠", "t-shirt", "tee", "반팔티", "긴팔티",
  "폴로", "polo", "카라티", "카라 티", "피케", "pique", "pk티", "pk 티",
];

// Wave 260 (2026-05-20): shoe 본품 SKU 가 clothing 매물 매칭 차단 (사용자 발견 systemic).
//   사용자 SQL 검증: ~280건 매물 — Adidas 슈퍼스타 트랙팬츠/트랙탑/티셔츠 / Nike collab 자켓 / NB 992 티셔츠 등
//   shoe 카테고리에 박힘 (query "아디다스 슈퍼스타" → bunjang/cron 가 자동 shoe category).
//   원인: shoe SKU mustContain (슈퍼스타/스탠스미스/덩크) 매물 title 매칭 통과 → sku_id 박힘 → 시세 비교군 진입.
//   policy: shoe SKU defaultProductType=sneaker/boot/sandal/loafer/slipper + 매물 text 에 clothing keyword 매치 시 reject.
//   intersect-aware: 자기 mustContain 에 clothing token 박혀있으면 skip (예외 없음 — shoe SKU 는 clothing keyword mustContain X).
//   효과: ~280건 shoe sku_id=NULL clothing 매물 차단 → 시세 sample 분리 + 사용자 화면 노출 X.
const SHOE_CATEGORY_MISMATCH_NOISE: string[] = [
  // pants
  "트랙팬츠", "트랙 팬츠", "track pants", "트레이닝 팬츠", "조거팬츠", "조거 팬츠", "스웻팬츠", "스웻 팬츠",
  "바지", "팬츠", "pants",
  // tops
  "트랙탑", "트랙 탑", "track top", "트랙수트", "tracksuit", "츄리닝",
  "져지", "저지", "jersey", "유니폼", "uniform",
  "티셔츠", "t-shirt", "tee", "반팔", "롱슬리브", "long sleeve", "맨투맨", "후드티", "후드집업", "후드 집업",
  // jackets / coats
  "자켓", "재킷", "jacket", "패딩", "코트", "coat", "바람막이", "windbreaker", "파카", "parka",
  // Wave 414 (2026-05-20): bare "다운"은 Prada Downtown 같은 정상 신발명을 오염시켜서 compound만 차단.
  "다운자켓", "다운 자켓", "다운재킷", "다운 재킷", "다운패딩", "다운 패딩", "다운점퍼", "다운 점퍼",
  "다운베스트", "다운 베스트", "패딩베스트", "패딩 베스트", "니트베스트", "니트 베스트", "조끼", "vest",
  // shorts
  "반바지", "쇼츠", "shorts", "버뮤다",
  // shirts
  "셔츠", "shirt", "남방",
  // jeans / denim
  "청바지", "데님", "denim", "jeans", "트러커",
  // bag (shoe SKU 매칭 잘못 시 차단)
  "토트백", "토트 백", "tote bag", "백팩", "backpack", "백팩 단품",
  "크로스백", "크로스 백", "crossbody", "cross bag",
  "숄더백", "숄더 백", "shoulder bag",
  "웨이스트백", "웨이스트 백", "waist bag", "웨이스트팩", "waist pack",
  "메신저백", "메신저 백", "messenger bag",
];

const GLOBAL_DESIGNER_COLLAB_NOISE: string[] = [
  // Wave 241 발견 — 즉시 단기 fix 시 박은 patterns 일반화
  "톰브라운", "thom browne", "thom-browne", "thombrowne",
  "jjjjound", "자운드",
  "kiko kostadinov", "kiko", "코스타디노프",
  "andersson bell", "앤더슨 벨", "anderson bell",
  // designer / 럭셔리 collab brand (가격 3~10배)
  "travis scott", "트래비스 스캇", "트래비스스캇", "cactus jack", "트래비스",
  "tom sachs", "톰 삭스", "톰삭스",
  "off-white", "오프화이트", "offwhite", "off white", "virgil", "버질",
  "sacai", "사카이",
  "fragment", "프래그먼트", "후지와라",
  "dior", "디올",
  "tiffany", "티파니",
  "louis vuitton", "lv x", "루이비통",
  "mm6", "maison margiela", "margiela", "마르지엘라",
  "comme des garcons", "comme garcons", "cdg x", "꼼데가르송",
  "kaws", "카우스",
  // streetwear collab
  "supreme", "슈프림",
  "fear of god", "fog x", "피오갓", "피어오브갓",
  "stussy", "스투시",
  "wtaps", "더블탭스",
  "neighborhood", "네이버후드",
  "fragment x", "프래그먼트 x",
  // 신발 designer collab
  "wales bonner", "웨일즈보너", "웨일즈 보너", "웨일스",
  "pharrell", "퍼렐",
  "sporty rich", "스포티앤리치", "sporty&rich", "sporty & rich",
  "kith", "키스",
  "aime leon dore", "ald", "에메레옹도레",
  "joe freshgoods", "조 프레쉬굿즈", "조 프레시굿즈",
  "salehe bembury", "살레 벰버리",
  "teddy santis",
  "ronnie fieg", "로니피그", "로니 피그",
  // 한정 한국 / 일본 designer
  "세인트미카엘", "saint michael", "saintmichael",
  "스왈로브스키", "swarovski",
  "newjeans", "뉴진스",
  // 명품 collab (clothing-tnf 등 fashion 일반)
  "moncler", "몽클레어", "몽클레르",
  "rhuigi",
  "cecilie bahnsen", "세실리에", "bahnsen", "반센",
  "brain dead", "브레인데드",
  "junya", "준야", "watanabe",
  "denim tears", "데님티어스", "데님 티어스",
  "balenciaga x", "발렌시아가 x",
  "miu miu x", "미우미우 x",
  "gucci x", "구찌 x",
  // Wave 243 (2026-05-19): outlier 매물 sample sweep 발견 추가 brand.
  // 떠그클럽 / 팔라스 / 코트와일러 / 캐피탈 / 마스터마인드 (streetwear/일본 designer)
  "thug club", "thugclub", "떠그클럽", "떠그 클럽", "떠그",
  "palace", "팔라스",
  "cottweiler", "코트와일러",
  "kapital", "캐피탈",
  "mastermind", "마스터마인드", "mastermind japan", "mastermind world",
  "raf simons", "라프시몬스", "라프 시몬스",
  // 럭셔리 (fashion 일반)
  "fendi", "펜디",
  "burberry", "버버리",
  "valentino", "발렌티노",
  "balmain", "발맹",
  "celine homme", "셀린 옴므",
  "saint laurent", "생로랑",
  "givenchy", "지방시",
  "loewe", "로에베",
  "prada x", "프라다 x",
  // 골프 brand (polo-pique false positive 빈번)
  "g/fore", "gfore", "지포어",
  "titleist", "타이틀리스트",
  "callaway", "캘러웨이",
  "hazzys", "헤지스",
  "vilebrequin", "빌보콰",
  "paul smith", "폴스미스",
  // 한정/collab patterns
  "chief keef", "치프키프", "치프 키프",
  "hellraiser",
  // Wave 243: Trefoil/RRL 한정 패턴 (Adidas x ?)
  "tom sachs x", "톰삭스 x",
  "trefoil firebird x", "파이어버드 x",
  // Acne Studios 한정/별 라인 (broad acne SKU mismatch)
  "골드마인", "goldmine",
  "트롱프뢰유", "trompe loeil", "trompe-loeil",
  "키제인", "keissen",
  "테디 쇼퍼", "teddy shopper", "테디 데님",
  "트라팔가", "trafalgar",
];

function isFullBoxShoeSetText(normalizedText: string): boolean {
  const hasFullBoxSignal =
    /(?:풀\s*박\s*세트|풀박세트|풀\s*박스|풀박스|풀\s*구성|풀구성|풀\s*패키지|풀패키지|full\s*(?:box|set|package)|fullbox|fullset)/i.test(normalizedText);
  const hasStrongShoeSignal =
    /스니커즈|스니커|운동화|러닝화|런닝화|신발(?!\s*(?:상자|박스))|슈즈|구두|로퍼|샌들|슬리퍼|sneaker|shoes?|loafer|sandal|slipper/i.test(normalizedText);
  const accessoryOnly =
    /(?:박스만|상자만|더스트백만|신발\s*상자|신발\s*박스|박스\s*단품|상자\s*단품|더스트백\s*단품)/i.test(normalizedText);
  return hasFullBoxSignal && hasStrongShoeSignal && !accessoryOnly;
}

function isVansVaultCapLxShoeText(sku: Sku, normalizedText: string): boolean {
  if (sku.id !== "shoe-vans-vault-broad") return false;
  const hasVansVault =
    /(?:vans|반스).{0,24}(?:vault|볼트)|(?:vault|볼트).{0,24}(?:vans|반스)/i.test(normalizedText);
  const hasCapModel = /(?:cap\s*lx|캡\s*lx|old\s*skool|올드\s*스쿨|sk8|skate|스케이트|authentic|어센틱)/i.test(normalizedText);
  const hatOnly = /(?:모자|볼캡|ball\s*cap|트러커|메쉬캡|hat)/i.test(normalizedText);
  return hasVansVault && hasCapModel && /(?:\bcap\b|캡)/i.test(normalizedText) && !hatOnly;
}

function skuMatches(sku: Sku, normalizedText: string): boolean {
  for (const group of sku.mustContain) {
    if (!group.some((token) => tokenHit(normalizedText, token))) return false;
  }
  for (const token of sku.mustNotContain) {
    if (tokenHit(normalizedText, token)) return false;
  }
  // Wave 236 (2026-05-19): 모든 카테고리 — 역경매/구함 패턴 차단 (smartphone/tablet 등 포함).
  for (const token of UNIVERSAL_BUY_REQUEST_NOISE) {
    if (token === "매입" && isSellerPurchaseServiceText(normalizedText)) continue;
    if (tokenHit(normalizedText, token)) return false;
  }
  // Wave 237 (2026-05-19): smartwatch 밴드 단품 매물 차단 (production audit 발견).
  //   applewatch-series4 SKU 에 "스포츠 실리콘밴드 50k" / "스포츠루프 17k" 매물 잘못 매칭.
  if (sku.category === "smartwatch") {
    for (const token of UNIVERSAL_ACCESSORY_ONLY_NOISE) {
      if (tokenHit(normalizedText, token)) return false;
    }
  }
  // Wave 230: shoe/clothing/bag 카테고리는 자동 global noise + category noise 차단.
  if (sku.category === "clothing" || sku.category === "shoe" || sku.category === "bag") {
    for (const token of GLOBAL_FASHION_NOISE) {
      if (token === "느낌" && /(?:빈티지한|좋은|멋진|이쁜|예쁜)\s*느낌/.test(normalizedText)) continue;
      if ((token === "구해요" || token === "구합니다") && isScarcityText(normalizedText)) continue;
      if (
        sku.category === "shoe" &&
        token === "카드" &&
        /카드\s*(?:포함|있|동봉)|보증\s*카드|개런티\s*카드|정품\s*카드/.test(normalizedText)
      ) continue;
      // Wave 851: "풀박세트/풀박스 + 정품" is a shoe full-package phrase,
      // while "세트 정품" noise was added for multi-bag bundle pollution.
      if (sku.category === "shoe" && token === "세트 정품" && isFullBoxShoeSetText(normalizedText)) continue;
      if (tokenHit(normalizedText, token)) return false;
    }
    const catNoise = CATEGORY_FASHION_NOISE[sku.category];
    if (catNoise) {
      for (const token of catNoise) {
        if (sku.category === "shoe" && (token === " 캡 " || token === "cap") && isVansVaultCapLxShoeText(sku, normalizedText)) continue;
        if (
          sku.id === "shoe-lacoste-sneakers" &&
          (token === "피케" || token === "pique") &&
          /(?:카나비|canaby)/i.test(normalizedText)
        ) continue;
        if (tokenHit(normalizedText, token)) return false;
      }
    }
    // Wave 242 (2026-05-19): system-wide designer collab 자동 차단 (intersect-aware).
    //   사용자 지적: "왜 특정 옷들만? 패턴이 다른 SKU 에서도 발생". 모든 fashion SKU 자동.
    //   policy:
    //     - sku.mustContain 토큰 set 추출 (자기 brand)
    //     - GLOBAL_DESIGNER_COLLAB_NOISE 의 brand 가 mustContain 에 있으면 skip (의도된 collab)
    //     - 그 외 brand 가 매물 text 에 있으면 차단 (broad SKU 가 다른 collab 매물 매칭)
    //   효과: shoe-asics-gel-kayano 의 "톰브라운 카야노" 자동 차단 (모든 designer 동일).
    //         shoe-supreme-vans-collab 의 mustContain ["supreme/슈프림", "vans/반스"] → supreme/슈프림 skip → 정상.
    //
    // Wave 267 (2026-05-20): partial match 보강.
    //   API sweep 발견 — shoe-nike-jordan-1-low-travis-scott-mocha 의 mustContain "트래비스" 박혀있는데
    //   COLLAB_NOISE 의 "트래비스 스캇" 이 매물에 hit → skuTokens.has("트래비스 스캇") false (정확매치) →
    //   intended collab SKU 인데 자기 mustContain 만족 매물에서도 차단됨.
    //   fix: skuTokens 의 어떤 토큰이 COLLAB_NOISE 토큰의 substring (3자+) 이면 skip.
    //   safety: 3자+ 제한 — "th"/"sa" 같은 짧은 토큰 false skip 차단.
    const skuTokens = new Set<string>();
    for (const group of sku.mustContain) {
      for (const t of group) skuTokens.add(t.toLowerCase());
    }
    const skuTokensArr = [...skuTokens];
    const skuIdentityText = [sku.brand, ...sku.aliases].join(" ").toLowerCase();
    const isStrongSkuToken = (skuTok: string) => skuTok.length >= 3 || /^[가-힣]{2,}$/.test(skuTok);
    for (const token of GLOBAL_DESIGNER_COLLAB_NOISE) {
      const tokenLower = token.toLowerCase();
      // 정확 매치 또는 sku 토큰이 collab noise 토큰의 substring 이면 skip.
      // Korean brand abbreviations such as "꼼데" are meaningful at 2 chars.
      if (skuTokens.has(tokenLower)) continue;
      if (tokenLower.length >= 3 && skuIdentityText.includes(tokenLower)) continue;
      if (skuTokensArr.some((skuTok) => isStrongSkuToken(skuTok) && (tokenLower.includes(skuTok) || skuTok.includes(tokenLower)))) continue;
      if (
        sku.id === "shoe-adidas-balenciaga-collab" &&
        (token === "off-white" || token === "오프화이트" || token === "offwhite" || token === "off white" || token === "virgil" || token === "버질") &&
        /(?:스탠스미스|stan\s*smith|triple\s*s|트리플\s*s|트리플s).{0,24}(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite).{0,24}(?:스탠스미스|stan\s*smith|triple\s*s|트리플\s*s|트리플s)/.test(normalizedText) &&
        !/(?:x|×)\s*(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite)\s*(?:x|×)/.test(normalizedText)
      ) continue;
      if (
        sku.id === "shoe-adidas-adizero" &&
        (token === "off-white" || token === "오프화이트" || token === "offwhite" || token === "off white") &&
        /(?:아디제로|adizero|아디오스|adios).{0,28}(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite).{0,28}(?:아디제로|adizero|아디오스|adios)/.test(normalizedText) &&
        !/(?:x|×)\s*(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite)\s*(?:x|×)/.test(normalizedText)
      ) continue;
      if (
        (sku.id === "shoe-salomon-acs-pro-broad" || sku.id === "shoe-salomon-acs-pro") &&
        (token === "off-white" || token === "오프화이트" || token === "offwhite" || token === "off white") &&
        /(?:살로몬|salomon).{0,24}(?:acs|acs\s*pro|acs프로).{0,24}(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite).{0,24}(?:살로몬|salomon).{0,24}(?:acs|acs\s*pro|acs프로)/.test(normalizedText) &&
        !/(?:x|×)\s*(?:오프화이트|off\s*white|off-white|offwhite)|(?:오프화이트|off\s*white|off-white|offwhite)\s*(?:x|×)/.test(normalizedText)
      ) continue;
      if (tokenHit(normalizedText, token)) return false;
    }
    // Wave 254.6 (2026-05-20): clothing jacket/down_jacket/coat SKU 가 다른 product_type 매물 매칭 차단.
    //   사용자 발견: pid 331382713 "빔즈 노스페이스 눕시 쇼츠" → clothing-tnf-nuptse-1996 (down_jacket) 잘못 매칭.
    //   systemic 사례: clothing-tnf-purple-label + 쇼츠 / clothing-tnf-supreme-collab + 모자 / clothing-polo-rrl-denim + 쇼츠 등.
    //   policy: SKU defaultProductType 이 jacket/down_jacket/coat 이고 매물 text 가 다른 명백 product_type 키워드 (쇼츠/모자/벨트/지갑/원피스/스커트) 매치 시 reject.
    //   intersect-aware: 매물이 "마운틴 자켓 + 허리 벨트 포함" 같이 자켓 본품 + 벨트 부속이면 false positive 위험 OK (broad fallback).
    //   효과: 17 jacket SKU 일괄 보강 (per-SKU mustNotContain 17번 박는 대신 1번 박음 — 1타 N피).
    if (
      sku.category === "clothing" &&
      sku.defaultProductType &&
      (sku.defaultProductType === "jacket" || sku.defaultProductType === "down_jacket" || sku.defaultProductType === "coat")
    ) {
      for (const token of CLOTHING_JACKET_PRODUCT_TYPE_MISMATCH_NOISE) {
        if (skuTokens.has(token.toLowerCase())) continue; // 자기 brand mustContain 에 있으면 skip
        if (tokenHit(normalizedText, token)) return false;
      }
    }
    // Wave 256 (2026-05-20): bag SKU 도 같은 intersect-aware safety net (systemic 확장).
    //   사용자 발견 (보테가베네타 카세트백 비교 매물): "카세트 카드지갑/반지갑" 이 cassette-mini (crossbody) SKU 매칭.
    //   bag-bottega-cassette-mini mustNotContain 에 "지갑/wallet/카드지갑" 누락 → 매칭 통과 → 시세 비교군 진입.
    //   systemic: 모든 bag 본품 SKU (crossbody/shoulder/tote/backpack/duffle/messenger/waist) 가 같은 위험.
    //   policy: defaultProductType 이 본품 (백) + 매물 text 가 wallet/카드지갑/지갑 매치 시 reject.
    //   intersect-aware: 자기 mustContain 에 wallet/지갑 박혀있으면 skip (bag-prada-saffiano-card-wallet 등 정상 매칭).
    //   효과: 모든 bag 본품 SKU 일괄 보강 (1타 N피, per-SKU mustNotContain 30+ 박는 대신 1번).
    if (
      sku.category === "bag" &&
      sku.defaultProductType &&
      (sku.defaultProductType === "crossbody"
        || sku.defaultProductType === "shoulder"
        || sku.defaultProductType === "tote"
        || sku.defaultProductType === "backpack"
        || sku.defaultProductType === "duffle"
        || sku.defaultProductType === "messenger"
        || sku.defaultProductType === "waist")
    ) {
      for (const token of CLOTHING_JACKET_PRODUCT_TYPE_MISMATCH_NOISE) {
        if (skuTokens.has(token.toLowerCase())) continue;
        if (tokenHit(normalizedText, token)) return false;
      }
    }
    // Wave 260 (2026-05-20): shoe 본품 SKU 가 clothing keyword 매물 매칭 차단 (사용자 발견 systemic, ~280건 영향).
    //   사용자 SQL: Adidas/NB/Nike collab clothing 매물 (트랙팬츠/티셔츠/자켓) 가 shoe category 박힘.
    //   query "아디다스 슈퍼스타" → bunjang 자동 shoe category → shoe SKU mustContain "슈퍼스타" 매칭 통과.
    //   policy: shoe SKU defaultProductType=sneaker/boot/sandal/loafer/slipper + 매물 text 가 clothing keyword 매치 시 reject.
    //   효과: clothing keyword 매물 sku_id=NULL → 시세 비교군 제외 + pool 차단.
    if (
      sku.category === "shoe"
    ) {
      const hasStrongShoeSignal = /스니커즈|스니커|운동화|러닝화|런닝화|신발(?!\s*상자|박스|용\s*더스트백)|슈즈|구두|로퍼|샌들|슬리퍼|sneaker|shoes?|loafer|sandal|slipper/.test(normalizedText);
      for (const token of SHOE_CATEGORY_MISMATCH_NOISE) {
        if (skuTokens.has(token.toLowerCase())) continue;
        // Wave 415 (2026-05-20): denim 소재 스니커즈(LV Trainer Denim 등)는 정상 신발.
        // 단, "부츠컷 데님"처럼 shoe word 없이 boot substring만 있는 의류는 계속 차단한다.
        if ((token === "데님" || token === "denim") && hasStrongShoeSignal) continue;
        if ((token === "데님" || token === "denim") && (sku.id === "shoe-newbalance-levis-collab" || sku.id === "shoe-nike-levis-collab" || sku.id === "shoe-puma-palermo" || sku.id === "shoe-onrunning-cloudtilt-loewe-collab" || sku.id === "shoe-vans-authentic")) continue;
        if (token === "파카" && /알파카|alpaca/.test(normalizedText)) continue;
        if (tokenHit(normalizedText, token)) return false;
      }
    }
  }
  return true;
}

function stripLinkLikeText(text: string): string {
  return String(text ?? "")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi, " ");
}

function directSpecificMatch(text: string): Sku | null {
  const normalizedText = normalize(text);
  const compact = normalizedText.replace(/\s+/g, "");
  const rawLower = String(text ?? "").toLowerCase();
  const rawCompact = rawLower.replace(/\s+/g, "");
  const converseChuck70WhiteText =
    /(?:컨버스|converse).{0,32}(?:척\s*70|척70|척테일러\s*70|chuck\s*70|chuck70|ct\s*70|ct70|162439c).{0,32}(?:화이트|white|162439c)|(?:컨버스|converse).{0,32}(?:화이트|white).{0,32}(?:척\s*70|척70|척테일러\s*70|chuck\s*70|chuck70|ct\s*70|ct70|162439c)/i.test(normalizedText);
  const converseChuck70WhiteVariant =
    /(?:미션\s*v|mission\s*v|at\s*-?\s*cx|스케치\s*화이트|sketch\s*white|화이트\s*팩|white\s*pack|컬러\s*체인지|color\s*change|이자벨\s*마랑|isabel\s*marant|슬램잼|slam\s*jam|cdg|꼼데|sacai|사카이|콜라보|collab|한정판?)/i.test(normalizedText);
  if (converseChuck70WhiteText && !converseChuck70WhiteVariant) {
    return skuById("shoe-converse-chuck70-white") ?? null;
  }
  const hokaBondi7Text =
    /(?:호카|hoka).{0,32}(?:본디\s*7|본디7|bondi\s*7|bondi7)|(?:본디\s*7|본디7|bondi\s*7|bondi7).{0,32}(?:호카|hoka)/i.test(normalizedText);
  const hokaBondi7Variant =
    /(?:본디\s*8|본디8|bondi\s*8|bondi8|본디\s*9|본디9|bondi\s*9|bondi9|본디\s*x|본디x|bondi\s*x|새티스파이|satisfy|콜라보|collab)/i.test(normalizedText);
  if (hokaBondi7Text && !hokaBondi7Variant) {
    return skuById("shoe-hoka-bondi-7") ?? null;
  }
  const rawWithoutHashtags = rawLower.replace(/#[^\s]+/g, " ");
  const normalizedWithoutHashtags = normalize(rawWithoutHashtags);
  if (
    /(?:뉴발란스|뉴발|new\s*balance|newbalance|\bnb\b)/i.test(normalizedWithoutHashtags) &&
    /(?:에임\s*레온\s*도르|에임레온도르|에메레온도르|aime\s*leon\s*dore|aimé\s*leon\s*dore|\bald\b)/i.test(normalizedWithoutHashtags) &&
    !/(?:조\s*프레(?:시|쉬)굿즈|joe\s*freshgoods|자운드|jjjjound|jound|kith|키스|오라리|auralee|카사블랑카|casablanca|러닝캡|모자|cap)/i.test(normalizedWithoutHashtags)
  ) {
    return skuById("shoe-newbalance-aime-leon-dore-collab") ?? null;
  }
  // Wave 429 (2026-05-21): "에어팟 4세대 노캔 ㄴㄴ/안됨"은 ANC 모델이 아니라
  // 일반 AirPods 4다. airpods-4 mustNotContain 의 bare "노캔" 안전장치를 우회하되,
  // 부정 표현이 명확한 경우에만 direct match 한다.
  const airpods4NoAnc =
    /(?:에어팟|airpods).{0,12}(?:4세대|4\s*세대|4th|에어팟4|airpods\s*4).{0,24}(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc).{0,8}(?:x|×|❌|ㄴㄴ|노노|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)/i.test(normalizedText) ||
    /(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc).{0,8}(?:x|×|❌|ㄴㄴ|노노|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원).{0,24}(?:에어팟|airpods).{0,12}(?:4세대|4\s*세대|4th|에어팟4|airpods\s*4)/i.test(normalizedText) ||
    /(?:에어팟|airpods).{0,12}(?:4세대|4\s*세대|4th|에어팟4|airpods\s*4).{0,24}(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc).{0,8}(?:x|×|❌|ㄴㄴ|노노|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원)/i.test(rawLower) ||
    /(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc).{0,8}(?:x|×|❌|ㄴㄴ|노노|없|아님|아니|안됨|안\s*됨|안\s*돼|안돼|안\s*되는|미지원).{0,24}(?:에어팟|airpods).{0,12}(?:4세대|4\s*세대|4th|에어팟4|airpods\s*4)/i.test(rawLower) ||
    /(?:에어팟4|airpods4).{0,24}(?:노캔ㄴㄴ|노캔x|노캔안됨|노캔안돼|노캔없는|노캔아님|ancx)/i.test(compact) ||
    /(?:에어팟4|airpods4).{0,24}(?:노캔ㄴㄴ|노캔x|노캔안됨|노캔안돼|노캔없는|노캔아님|ancx)/i.test(rawCompact);
  if (airpods4NoAnc) return skuById("airpods-4") ?? null;
  if (/(아이폰16e|iphone16e)/i.test(compact) || /iphone\s*16e/i.test(normalizedText)) {
    return skuById("iphone-16e") ?? null;
  }
  if (/(아이패드|ipad).{0,24}a17pro/i.test(compact) || /(아이패드|ipad).{0,32}a17\s*pro/i.test(normalizedText)) {
    return skuById("ipad-mini") ?? null;
  }
  // Wave 804: PS5 game-title broad has to accept "PS5 디스크" game discs,
  // but body listings also say "PS5 디스크 팝니다". Strong body/edition
  // signals get pinned to the console SKU before broad game candidates collide.
  if (
    /(?:ps5|플스\s*5|플스5|플레이스테이션\s*5|playstation\s*5)/i.test(normalizedText) &&
    /(?:디스크|disc)/i.test(normalizedText) &&
    /(?:초기형|구형|스탠다드|standard|본체|콘솔|풀박|풀박스|디스크\s*(?:에디션|버전)|disc\s*(?:edition|version)|cfi|10[01]8|11[01]8|12[01]8)/i.test(normalizedText) &&
    !/(?:슬림|slim|프로|pro)/i.test(normalizedText) &&
    !/(?:디스크\s*드라이브|disc\s*drive|게임\s*디스크|게임\s*타이틀|타이틀|스파이더맨|갓\s*오브\s*워|라스트\s*오브\s*어스|호라이즌|엘든\s*링|철권|파이널\s*판타지|파판|발더스|원피스|오디세이)/i.test(normalizedText)
  ) {
    return skuById("ps5-disc-standard") ?? null;
  }
  if (
    /(?:prada|프라다)/i.test(normalizedText) &&
    /(?:아메리카\s*컵|아메리카컵|아메리칸\s*컵|america'?s?\s*cup)/i.test(normalizedText) &&
    /(?:스니커즈|sneaker|운동화|신발|shoe)/i.test(normalizedText) &&
    !/(?:가방|백팩|토트|숄더|크로스백|지갑|wallet|카드지갑|키링|캡|모자|박스만|더스트백만)/i.test(normalizedText)
  ) {
    return skuById("shoe-prada-america-cup") ?? null;
  }
  if (
    /(?:hermes|에르메스)/i.test(normalizedText) &&
    /(?:오란|oran)/i.test(normalizedText) &&
    /(?:샌들|sandal)/i.test(normalizedText) &&
    !/(?:가방|백팩|토트|숄더|크로스백|지갑|wallet|카드지갑|키링|캡|모자|박스만|더스트백만)/i.test(normalizedText)
  ) {
    return skuById("shoe-hermes-oran-sandal") ?? null;
  }
  const arcteryxText = /(?:arcteryx|arc\s*teryx|아크테릭스)/i.test(normalizedText) || /(?:arcteryx|arcteryx|아크테릭스)/i.test(compact);
  if (arcteryxText) {
    const hasAtom = /(?:atom|아톰)/i.test(normalizedText) || /(?:atom|아톰)/i.test(compact);
    const atomLt = /(?:아톰\s*lt|atom\s*lt)/i.test(normalizedText) || /(?:아톰lt|atomlt)/i.test(compact);
    const atomSl = /(?:아톰\s*sl|atom\s*sl)/i.test(normalizedText) || /(?:아톰sl|atomsl)/i.test(compact);
    const atomArHeavy = /(?:아톰\s*ar|atom\s*ar|heavyweight|헤비웨이트)/i.test(normalizedText) || /(?:아톰ar|atomar)/i.test(compact);
    if (hasAtom && atomSl) return skuById("clothing-arcteryx-atom-sl") ?? null;
    if (hasAtom && atomArHeavy) return skuById("clothing-arcteryx-atom-ar-heavyweight") ?? null;
    if (hasAtom && atomLt) {
      const explicitNoHood = /(?:논\s*후드|노\s*후드|no\s*hood|non\s*hood|후드\s*없|후드없)/i.test(normalizedText) ||
        /(?:논후드|노후드|nohood|nonhood|후드없)/i.test(compact);
      const hoodSignal = /(?:후디|후드티|후드|hoodie|hoody|hooded)/i.test(normalizedText);
      const jacketSignal = /(?:자켓|재킷|jacket)/i.test(normalizedText);
      if (explicitNoHood || (!hoodSignal && jacketSignal)) return skuById("clothing-arcteryx-atom-lt-jacket") ?? null;
      if (hoodSignal) return skuById("clothing-arcteryx-atom-lt-hoody") ?? null;
      return null;
    }

    const hasBeta = /(?:beta|베타)/i.test(normalizedText) || /(?:beta|베타)/i.test(compact);
    const betaBlocked = /(?:베타\s*sv|beta\s*sv|인슐레이티드|insulated|하이브리드|hybrid|팬츠|pants|beams|빔즈|vitality|바이탈리티)/i.test(normalizedText) ||
      /(?:베타sv|betasv)/i.test(compact);
    if (hasBeta && !betaBlocked) {
      if (/(?:베타\s*lt|beta\s*lt)/i.test(normalizedText) || /(?:베타lt|betalt)/i.test(compact)) return skuById("clothing-arcteryx-beta-lt") ?? null;
      if (/(?:베타\s*sl|beta\s*sl)/i.test(normalizedText) || /(?:베타sl|betasl)/i.test(compact)) return skuById("clothing-arcteryx-beta-sl") ?? null;
      if (/(?:베타\s*ar|beta\s*ar)/i.test(normalizedText) || /(?:베타ar|betaar)/i.test(compact)) return skuById("clothing-arcteryx-beta-ar") ?? null;
    }

    const hasProton = /(?:proton|프로톤)/i.test(normalizedText) || /(?:proton|프로톤)/i.test(compact);
    if (hasProton && !/(?:팬츠|pants|veilance|베일런스|leaf|리프)/i.test(normalizedText)) {
      if (/(?:프로톤\s*lt|proton\s*lt)/i.test(normalizedText) || /(?:프로톤lt|protonlt)/i.test(compact)) return skuById("clothing-arcteryx-proton-lt") ?? null;
      if (/(?:프로톤\s*fl|proton\s*fl)/i.test(normalizedText) || /(?:프로톤fl|protonfl)/i.test(compact)) return skuById("clothing-arcteryx-proton-fl") ?? null;
      if (/(?:프로톤\s*sv|proton\s*sv)/i.test(normalizedText) || /(?:프로톤sv|protonsv)/i.test(compact)) return skuById("clothing-arcteryx-proton-sv") ?? null;
      if (/(?:프로톤\s*ar|proton\s*ar)/i.test(normalizedText) || /(?:프로톤ar|protonar)/i.test(compact)) return skuById("clothing-arcteryx-proton-ar") ?? null;
    }
  }

  const stussyText = /(?:stussy|stüssy|스투시)/i.test(normalizedText) || /(?:stussy|스투시)/i.test(compact);
  const nikeText = /(?:nike|나이키|나투시)/i.test(normalizedText) || /(?:nike|나이키|나투시)/i.test(compact);
  if (
    stussyText &&
    nikeText &&
    (/(?:에어\s*페니|air\s*penny|페니\s*2|penny\s*(?:2|ii))/i.test(normalizedText) || /(?:에어페니|페니2)/i.test(compact)) &&
    !/(?:후드|후디|hoodie|맨투맨|티셔츠|자켓|재킷|팬츠|spiridon|스피리돈|af1|에어포스|air\s*force|베나시|benassi|허라취|허라치|huarache|ld\s*1000|ld-1000)/i.test(normalizedText)
  ) {
    return skuById("shoe-stussy-nike-air-penny") ?? null;
  }
  if (stussyText && !nikeText && !/(?:dior|디올|birkenstock|버켄스탁)/i.test(normalizedText)) {
    const stussySpecialAxis = /(?:8\s*ball|8ball|8\s*볼|8볼|에잇볼|피그먼트|pigment|pig\.?\s*dyed|skull|bones|cpfm|cactus\s*plant|월드\s*투어|월드투어|world\s*tour|도버\s*스트릿|도버\s*스트리트|dover\s*street|dsm|아워\s*레가시|아워레가시|our\s*legacy|ourlegacy|마틴\s*로즈|마틴로즈|martine\s*rose|martin\s*rose|futura|퓨추라|스탁\s*서울|stock\s*seoul|스투시\s*서울|스투시서울|다이스|dice|stars\s*hoodie|스타즈\s*후드|더블\s*페이스|double\s*face|soul\s*1980|soul1980|유니온|union|니트|knit|스웨터|sweater|후드\s*자켓|후드\s*재킷|hooded\s*jacket|자켓|재킷|jacket|반\s*집업|하프\s*집업|half[-\s]*zip|quarter\s*zip|1\/2\s*zip)/i.test(normalizedText);
    if (stussySpecialAxis) return null;
    if (/(?:후드\s*집업|집업\s*후드|zip\s*up\s*hoodie|zipup\s*hoodie|hoodie\s*zip|zip\s*hoodie|full\s*zip\s*hoodie|풀\s*집업\s*후드)/i.test(normalizedText) || /(?:후드집업|집업후드)/i.test(compact)) {
      return skuById("clothing-stussy-zip-hoodie") ?? null;
    }
    if (/(?:맨투맨|크루넥|crewneck|sweat\s*shirt|sweatshirt|스웻\s*셔츠|스웨트\s*셔츠)/i.test(normalizedText)) {
      return skuById("clothing-stussy-crewneck-sweat") ?? null;
    }
    if (/(?:후드티|후디|후드|hoodie|hoody|hooded)/i.test(normalizedText)) {
      return skuById("clothing-stussy-hoodie") ?? null;
    }
  }
  if (
    /(?:metaspeed|메타\s*스피드|메타스피드)/i.test(normalizedText) &&
    /(?:sky|스카이|edge|엣지|ray|레이|tokyo|도쿄|paris|파리|ekiden|에키덴|\+)/i.test(normalizedText) &&
    !/(?:싱글렛|singlet|하프\s*타이즈|타이즈|tights|shirt|셔츠|티셔츠|반팔|나시|웨어|의류|apparel|top|스파이크|spike|중거리|육상|track\s*and\s*field)/i.test(normalizedText)
  ) {
    return skuById("shoe-asics-metaspeed") ?? null;
  }
  const hokaSatisfyText =
    /(?:hoka|호카|호카원원)/i.test(normalizedText) &&
    /(?:satisfy|새티스파이|세티스파이|사티스파이)/i.test(normalizedText);
  if (hokaSatisfyText) {
    const hokaSatisfyOtherModel = /(?:clifton|클리프톤|클리프턴|bondi|본디|mach|마하|xlim|엑슬림)/i.test(normalizedText);
    if (/(?:clifton|클리프톤|클리프턴)/i.test(normalizedText)) {
      return skuById("shoe-hoka-satisfy-clifton-ls-collab") ?? null;
    }
    if (
      !hokaSatisfyOtherModel &&
      /(?:mafate|마파테|light\s*coffee|라이트\s*커피|라이트커피|\bcoffee\b|커피|light\s*rubber|라이트\s*러버|라이트러버|light\s*bone|라이트\s*본|라이트본|sulfur|sulphur|설퍼)/i.test(normalizedText)
    ) {
      return skuById("shoe-hoka-mafate-satisfy-collab") ?? null;
    }
  }
  const asicsText = /(?:asics|아식스)/i.test(normalizedText);
  if (asicsText) {
    if (/(?:cecilie|bahnsen|세실리에|반센)/i.test(normalizedText)) {
      return skuById("shoe-asics-cecilie-bahnsen-collab") ?? null;
    }
    const kikoText = /(?:키코|kiko|kostadinov|코스타디노프)/i.test(normalizedText);
    if (kikoText) {
      if (/(?:젤\s*키릴|젤키릴|gel\s*-?\s*kiril|gelkiril)/i.test(normalizedText)) return skuById("shoe-asics-kiko-gel-kiril") ?? null;
      if (/(?:젤\s*소켓|젤소켓|gel\s*-?\s*sokat|sokat)/i.test(normalizedText)) return skuById("shoe-asics-kiko-gel-sokat") ?? null;
      if (/(?:젤\s*코리카|젤코리카|gel\s*-?\s*korika|korika)/i.test(normalizedText)) return skuById("shoe-asics-kiko-gel-korika") ?? null;
      if (/(?:로크로스|gel\s*-?\s*lokros|lokros)/i.test(normalizedText)) return skuById("shoe-asics-kiko-gel-lokros") ?? null;
      if (/(?:테레모아|teremoa|gel\s*-?\s*teremoa)/i.test(normalizedText)) return skuById("shoe-asics-kiko-novalis-gel-teremoa") ?? null;
      if (/(?:heaven|헤븐)/i.test(normalizedText)) return skuById("shoe-asics-kiko-heaven") ?? null;
    }
    if (/(?:nimbus|님버스|젤님버스|젤\s*님버스)/i.test(normalizedText)) {
      if (/(?:10\.1|10\s*1|10-1)/i.test(normalizedText)) return skuById("shoe-asics-gel-nimbus-10-1") ?? null;
      if (/(?:ub3\s*-?\s*s|젤\s*님버스\s*9|젤님버스\s*9|nimbus\s*9)/i.test(normalizedText)) return skuById("shoe-asics-gel-nimbus-9") ?? null;
    }
    if (/(?:quantum|퀀텀|kinetic|키네틱)/i.test(normalizedText)) {
      if (/(?:kinetic|키네틱)/i.test(normalizedText) && /(?:\bsp\b|sp\s|키네틱\s*sp)/i.test(normalizedText)) return skuById("shoe-asics-gel-kinetic-sp") ?? null;
      if (/(?:cp\s*company|c\.p\.|cp컴퍼니|c\.p\.\s*company)/i.test(normalizedText)) return skuById("shoe-asics-gel-quantum-cp-company") ?? null;
      if (/(?:quantum|퀀텀)/i.test(normalizedText) && /(?:360)/i.test(normalizedText)) return skuById("shoe-asics-gel-quantum-360") ?? null;
      if (/(?:quantum|퀀텀)/i.test(normalizedText) && /(?:90)/i.test(normalizedText)) return skuById("shoe-asics-gel-quantum-90") ?? null;
    }
  }
  const pumaText = /(?:puma|푸마|퓨마)/i.test(normalizedText);
  if (pumaText && /(?:nitro|나이트로)/i.test(normalizedText)) {
    if (/(?:deviate|디비에이트)/i.test(normalizedText) && /(?:elite|엘리트)/i.test(normalizedText)) return skuById("shoe-puma-deviate-nitro-elite") ?? null;
    if (/(?:deviate|디비에이트)/i.test(normalizedText)) return skuById("shoe-puma-deviate-nitro") ?? null;
    if (/(?:velocity|벨로시티)/i.test(normalizedText)) return skuById("shoe-puma-velocity-nitro") ?? null;
  }
  const mizunoText = /(?:mizuno|미즈노)/i.test(normalizedText);
  if (mizunoText && /(?:prophecy|프로페시|프로페서)/i.test(normalizedText)) {
    if (/(?:graphpaper|그라프페이퍼)/i.test(normalizedText)) return skuById("shoe-mizuno-wave-prophecy-graphpaper") ?? null;
    if (/(?:blankof|블랭코브)/i.test(normalizedText)) return skuById("shoe-mizuno-wave-prophecy-blankof") ?? null;
    if (/(?:moc|\b목\b|프로페시\s*목)/i.test(normalizedText)) return skuById("shoe-mizuno-wave-prophecy-moc") ?? null;
    if (/(?:beta|베타)/i.test(normalizedText)) return skuById("shoe-mizuno-wave-prophecy-beta") ?? null;
    if (/(?:\bls\b|ls\s)/i.test(normalizedText)) return skuById("shoe-mizuno-wave-prophecy-ls") ?? null;
  }
  if (
    /(?:carhartt|칼하트)/i.test(normalizedText) &&
    /(?:active\s*work|active\s*jacket|액티브\s*워크|액티브\s*자켓|액티브\s*후드\s*자켓|j130)/i.test(normalizedText) &&
    /(?:jacket|자켓|재킷|점퍼|후드)/i.test(normalizedText)
  ) {
    return skuById("clothing-carhartt-active-jacket") ?? null;
  }
  if (
    /(?:converse|컨버스)/i.test(normalizedText) &&
    /(?:carhartt|칼하트)/i.test(normalizedText)
  ) {
    if (/(?:one\s*star|onestar|원스타)/i.test(normalizedText)) return skuById("shoe-carhartt-converse-one-star") ?? null;
    if (/(?:jack\s*purcell|jackpurcell|잭퍼셀)/i.test(normalizedText)) return skuById("shoe-carhartt-converse-jack-purcell") ?? null;
    if (/(?:chuck\s*70|chuck70|척\s*70|척70|척테일러|chuck\s*taylor)/i.test(normalizedText)) return skuById("shoe-carhartt-converse-chuck70") ?? null;
  }
  const lvWalletText = /(?:루이비통|louis\s*vuitton|louisvuitton|lv)/i.test(normalizedText) || /(?:루이비통|louisvuitton|lv)/i.test(compact);
  const lvWalletBlocked = /(?:다미에|damier|앙프렝뜨|empreinte|에삐|epi|코인|coin|콤팩트|compact|그래피티|graffiti)/i.test(normalizedText) ||
    /(?:다미에|damier|앙프렝뜨|empreinte|에삐|epi|코인|coin|콤팩트|compact|그래피티|graffiti)/i.test(compact);
  if (
    lvWalletText &&
    /(?:알마\s*bb|alma\s*bb|알마bb|almabb)/i.test(normalizedText) &&
    /(?:모노그램|monogram|m53152|캔버스|canvas)/i.test(normalizedText) &&
    !/(?:\bpm\b|\bmm\b|\bgm\b|네오|neo|버블그램|bubblegram|백팩|backpack|에삐|epi|베르니|vernis|다미에|damier|앙프렝뜨|empreinte|넥타이핀|키링|키체인|스트랩\s*단품|체인만|장식만|스트로공|벨트)/i.test(normalizedText)
  ) {
    return skuById("bag-lv-monogram-alma-bb") ?? null;
  }
  if (lvWalletText && !lvWalletBlocked && /(?:지피월릿|지피장지갑|zippywallet)/i.test(compact)) {
    return skuById("bag-lv-zippy-wallet-monogram") ?? null;
  }
  if (lvWalletText && !lvWalletBlocked && /(?:사라월릿|사라장지갑|sarahwallet)/i.test(compact)) {
    return skuById("bag-lv-sarah-wallet-monogram") ?? null;
  }
  const gucciText = /(?:구찌|구치|gucci)/i.test(normalizedText) || /(?:구찌|구치|gucci)/i.test(compact);
  if (
    gucciText &&
    /(?:마몽|마몬트|마몽트|marmont)/i.test(normalizedText) &&
    /(?:스몰|small|443497)/i.test(normalizedText) &&
    /(?:숄더|shoulder|크로스|cross|마틀라세|matelasse)/i.test(normalizedText) &&
    !/(?:미니|mini|슈퍼미니|supermini|카메라|camera|카드지갑|반지갑|지갑|wallet|탑핸들|tophandle|백팩|backpack|벨트백|beltbag|버킷백|버킷|bucket|토트|tote)/i.test(compact)
  ) {
    return skuById("bag-gucci-gg-marmont-small-shoulder") ?? null;
  }
  if (
    gucciText &&
    /(?:오피디아|ophidia)/i.test(normalizedText) &&
    /(?:탑핸들|탑\s*핸들|top\s*handle|핸들백)/i.test(normalizedText) &&
    !/(?:토트|tote|라지|large|카드지갑|반지갑|지갑|wallet)/i.test(normalizedText)
  ) {
    return skuById("bag-gucci-ophidia-top-handle") ?? null;
  }
  if (
    gucciText &&
    /(?:오피디아|ophidia)/i.test(normalizedText) &&
    /(?:토트|tote|쇼퍼|shopper)/i.test(normalizedText) &&
    !/(?:탑핸들|탑\s*핸들|top\s*handle|카드지갑|반지갑|지갑|wallet)/i.test(normalizedText)
  ) {
    return skuById("bag-gucci-ophidia-tote") ?? null;
  }
  const chanelText = /(?:샤넬|chanel)/i.test(normalizedText) || /(?:샤넬|chanel)/i.test(compact);
  const chanelPaperOnly = /(?:종이백|paperbag|쇼핑백만|쇼핑백단품|쇼핑백미사용)/i.test(compact) ||
    /(?:종이\s*백|paper\s*bag|쇼핑백\s*(?:만|단품|미사용))/i.test(normalizedText);
  if (
    chanelText &&
    !chanelPaperOnly &&
    /(?:코스메틱|cosmetic)/i.test(normalizedText) &&
    /(?:백|가방|체인|박스|bag|box)/i.test(normalizedText)
  ) {
    return skuById("bag-chanel-cosmetic-box") ?? null;
  }
  if (chanelText && !chanelPaperOnly && /(?:참월렛|참월렛|체인월렛|체인 월렛|walletonchain|woc)/i.test(compact)) {
    return skuById("bag-chanel-woc-charm-wallet") ?? null;
  }
  if (chanelText && !chanelPaperOnly && /(?:뉴서프|newsurf|쇼퍼백|shopper)/i.test(compact)) {
    return skuById("bag-chanel-shopper-new-surf") ?? null;
  }
  if (
    /(?:구찌|gucci)/i.test(normalizedText) &&
    /(?:\bmlb\b|엠엘비)/i.test(normalizedText) &&
    /(?:캡|모자|볼캡|cap|ball\s*cap|ballcap)/i.test(normalizedText) &&
    !/(?:지갑|wallet|반지갑|장지갑|벨트|belt|가방|bag|백팩|backpack|시계|watch|운동화|스니커즈|sneaker)/i.test(normalizedText)
  ) {
    return skuById("clothing-mlb-cap-gucci-collab") ?? null;
  }
  // Wave 712a (2026-05-23) HOTFIX: Nike × MLB cap self-block 우회 path.
  //   bias-free 검증 — clothing-mlb-cap-nike-collab mustContain `볼캡` 박혔는데
  //   CATEGORY_FASHION_NOISE.clothing 의 unconditional 차단에 `볼캡` 포함 → 자기 자신 차단.
  //   113건/주 Nike × MLB cap NULL. Gucci 패턴 미러로 directSpecificMatch 우회.
  if (
    /(?:나이키|nike)/i.test(normalizedText) &&
    /(?:\bmlb\b|엠엘비)/i.test(normalizedText) &&
    /(?:캡|모자|볼캡|cap|ball\s*cap|ballcap)/i.test(normalizedText) &&
    !/(?:유니폼|uniform|져지|jersey|베이퍼리미티드|vapor\s*limited|구찌|gucci|무라카미|murakami|지갑|wallet|벨트|belt|가방|bag|백팩|backpack|시계|watch|운동화|스니커즈|sneaker)/i.test(normalizedText)
  ) {
    return skuById("clothing-mlb-cap-nike-collab") ?? null;
  }
  if (
    /(?:무라카미|murakami|카이카이|kaikai)/i.test(normalizedText) &&
    /(?:\bmlb\b|엠엘비)/i.test(normalizedText) &&
    /(?:캡|모자|볼캡|cap|ball\s*cap|ballcap|9twenty|뉴에라)/i.test(normalizedText) &&
    !/(?:야구공|baseball|유니폼|uniform|저지|jersey|토트|tote|백팩|backpack|지갑|wallet|카드|card|탑스|topps|도쿄시리즈|tokyo\s*series|구찌|gucci|운동화|스니커즈|sneaker)/i.test(normalizedText)
  ) {
    return skuById("clothing-mlb-cap-murakami-collab") ?? null;
  }
  if (
    /(?:\bmlb\b|엠엘비)/i.test(normalizedText) &&
    /(?:캡|모자|볼캡|cap|ball\s*cap|ballcap)/i.test(normalizedText) &&
    !/(?:구찌|gucci|무라카미|murakami|카이카이|kaikai|nike\s*x\s*mlb|나이키\s*(?:x|×)\s*mlb|나이키|nike|지갑|wallet|반지갑|장지갑|벨트|belt|가방|bag|백팩|backpack|시계|watch|운동화|스니커즈|sneaker)/i.test(normalizedText)
  ) {
    return skuById("clothing-mlb-cap") ?? null;
  }
  if (
    /(?:\bmlb\b|엠엘비)/i.test(normalizedText) &&
    /(?:반팔|반팔티|티셔츠|tee\b|t-shirt|후드|hoodie|후드티|맨투맨|스웻|스웨트|조거|팬츠|pants|바지|쇼츠|shorts|반바지|폴로티|카라티)/i.test(normalizedText) &&
    !/(?:일괄|묶음|셋업|구찌|gucci|무라카미|murakami|카이카이|kaikai|nike\s*x\s*mlb|나이키\s*(?:x|×)\s*mlb|나이키|nike|아디다스|adidas|슈프림|supreme|퓨마|푸마|puma|리복|reebok|캡|모자|볼캡|cap|지갑|wallet|반지갑|장지갑|벨트|belt|가방|bag|백팩|backpack|시계|watch|운동화|스니커즈|sneaker)/i.test(normalizedText)
  ) {
    return skuById("clothing-mlb-apparel-broad") ?? null;
  }
  if (
    /(?:피어오브갓|피오갓|fear\s*of\s*god|fog)/i.test(normalizedText) &&
    /(?:essentials|에센셜)/i.test(normalizedText) &&
    /(?:카라티|카라\s*티|폴로티|폴로\s*티|폴로|polo|피케|pique)/i.test(normalizedText) &&
    !/(?:일괄|묶음|셋업|후디|hoodie|후드|맨투맨|크루넥|스웻|sweat|팬츠|pants|바지|쇼츠|shorts|반바지|자켓|재킷|jacket|코트|coat|나이키|nike|제냐|zegna|키즈|kids|주니어|junior)/i.test(normalizedText)
  ) {
    return skuById("clothing-fog-essentials") ?? null;
  }
  const acneText = /(?:acne|아크네)/i.test(normalizedText);
  if (
    acneText &&
    /(?:셔츠|shirt|버튼업|버튼\s*업|button\s*up|button-up|버튼다운|남방)/i.test(normalizedText) &&
    !/(?:티셔츠|t-shirt|tshirt|tee\b|맨투맨|후드|hoodie|스웻|스웨트|sweat|포바|forba|flogho|원피스|dress|자켓|재킷|코트|데님)/i.test(normalizedText)
  ) {
    return skuById("clothing-acne-shirt") ?? null;
  }
  if (
    acneText &&
    /(?:니트|knit|스웨터|sweater|가디건|cardigan)/i.test(normalizedText) &&
    !/(?:머플러|목도리|스카프|scarf|원피스|dress|얀13|yan13|오일릴리|오일\s*릴리|oilily|듀엘|duel|자라|zara|지컷|g\s*cut|g-cut|랑방|lanvin)/i.test(normalizedText)
  ) {
    return skuById("clothing-acne-knit") ?? null;
  }
  if (
    acneText &&
    /(?:반팔|티셔츠|긴팔티|긴팔\s*티셔츠|롱슬리브\s*티셔츠|tee\b|t-shirt|tshirt)/i.test(normalizedText) &&
    !/(?:버튼업|버튼\s*업|button\s*up|button-up|버튼다운|남방|니트|knit|스웨터|sweater|가디건|cardigan|폴로|polo|카라|럭비|rugby|후드|hoodie|맨투맨|스웻|스웨트|sweat|포바|forba|flogho|원피스|dress|모스키노|moschino|한섬|시스템|system|헬무트랭|helmut\s*lang|타임|time\s*homme|이자벨마랑|isabel\s*marant|마쥬|maje|아미\/|ami\/|비비안|vivienne\s*westwood|르샵|leshop|le\s*shop)/i.test(normalizedText)
  ) {
    return skuById("clothing-acne-tee") ?? null;
  }
  // Wave 482 (2026-05-21): "pvc가방/pvc백" 처럼 붙어 있으면 tokenHit("pvc")가
  // narrow/mustNot 양쪽에서 약해져 CDG broad가 먼저 잡힌다. CDG+PVC는 좁은 lane으로 고정.
  const cdgPvcText =
    /(?:꼼데|꼼데가르송|cdg|comme\s*des\s*garcons|commedesgarcons).{0,40}pvc/i.test(normalizedText) ||
    /pvc.{0,40}(?:꼼데|꼼데가르송|cdg|comme\s*des\s*garcons|commedesgarcons)/i.test(normalizedText) ||
    /(?:꼼데|꼼데가르송|cdg|commedesgarcons).{0,40}pvc/i.test(compact) ||
    /pvc.{0,40}(?:꼼데|꼼데가르송|cdg|commedesgarcons)/i.test(compact);
  const cdgPvcBlocked =
    /(gucci|구찌|구찌100주년|지드래곤|지디|위버멘쉬|louisvuitton|루이비통|nike|나이키|신발|스니커즈|컨버스|converse)/i.test(compact) ||
    /(gucci|구찌|구찌\s*100주년|지드래곤|지디|위버멘쉬|louis\s*vuitton|루이비통|nike|나이키|신발|스니커즈|컨버스|converse)/i.test(normalizedText);
  if (cdgPvcText && !cdgPvcBlocked) return skuById("bag-cdg-pvc") ?? null;
  const rrlText = /(?:\brrl\b|더블\s*알엘|더블알엘|double\s*rl)/i.test(normalizedText);
  if (
    rrlText &&
    /(?:그리즐리|grizzly)/i.test(normalizedText) &&
    /(?:자켓|재킷|jacket)/i.test(normalizedText) &&
    !/(?:rrl\s*스타일|rrl스타일|rrl\s*무드|rrl무드|스니커즈|sneaker|신발|벨트|belt|지갑|wallet|월렛|파우치|pouch|모자|캡|cap|팔찌|bracelet|목걸이|반지)/i.test(normalizedText)
  ) {
    return skuById("clothing-polo-rrl-grizzly-jacket") ?? null;
  }
  // Wave 490: RRL leather/suede jackets often collide with denim/jacket broad
  // lanes because of "인디고" or generic jacket wording. Strong leather + jacket
  // wording gets fixed to the high-value jacket lane.
  if (
    rrlText &&
    /(?:러프\s*아웃|러프아웃|rough\s*out|roughout|스웨이드|suede|레더|leather|가죽|시얼링|shearling|쉐르파|sherpa|뉴스보이|newsboy|버팔로\s*레더|buffalo\s*leather|g-?1|플라이트|flight)/i.test(normalizedText) &&
    /(?:자켓|재킷|jacket|코트|coat|카코트|피코트|초어|chore|플라이트|flight|봄버|bomber|나바호|뉴스보이|newsboy|시얼링|shearling|쉐르파|sherpa)/i.test(normalizedText) &&
    !/(?:rrl\s*스타일|rrl스타일|rrl\s*무드|rrl무드|블레이저|blazer|그리즐리|grizzly|팬츠|pants|바지|치노|chino|스니커즈|sneaker|신발|벨트|belt|지갑|wallet|월렛|파우치|pouch|모자|캡|cap|팔찌|bracelet|목걸이|반지)/i.test(normalizedText)
  ) {
    return skuById("clothing-polo-rrl-jacket-leather-suede") ?? null;
  }
  // Wave 489: RRL roughout/suede shirts are high-value outliers. Direct them
  // before generic RRL shirt/broad candidates can collide.
  if (
    rrlText &&
    /(?:러프\s*아웃|러프아웃|rough\s*out|roughout|스웨이드|suede|레더|leather|가죽|염소가죽)/i.test(normalizedText) &&
    /(?:셔츠|shirt|오버\s*셔츠|오버셔츠|워크\s*셔츠|워크셔츠|웨스턴|western)/i.test(normalizedText) &&
    !/(?:자켓|재킷|jacket|코트|coat|팬츠|pants|바지|치노|chino|스니커즈|sneaker|신발|벨트|belt|지갑|wallet|월렛|파우치|pouch|모자|캡|cap|팔찌|bracelet)/i.test(normalizedText)
  ) {
    return skuById("clothing-polo-rrl-shirt-leather-suede") ?? null;
  }
  return null;
}

function chooseUniqueCandidate(candidates: Sku[]): Sku | null {
  if (candidates.length === 1) return candidates[0];
  const uniqueIds = [...new Set(candidates.map((sku) => sku.id))];
  if (uniqueIds.length === 1) {
    return candidates.find((sku) => Boolean(sku.laneKey)) ?? candidates[0] ?? null;
  }

  const fashionLaneCandidates = candidates.filter(
    (sku) => FASHION_PROMOTE_CATEGORIES.has(sku.category) && Boolean(skuReadyLaneKey(sku)) && !isFashionBroadPromotionTarget(sku),
  );
  if (
    fashionLaneCandidates.length === 1 &&
    candidates.every((sku) => sku.id === fashionLaneCandidates[0].id || isFashionBroadPromotionTarget(sku))
  ) {
    return fashionLaneCandidates[0];
  }

  // Clothing lanes do not inherit category-level public readiness. If a single
  // exact/internal clothing lane matches alongside broad siblings, prefer that
  // lane instead of dropping to null; the pool gate will keep it internal until
  // the lane is explicitly promoted.
  const clothingInternalLaneCandidates = candidates.filter(
    (sku) => sku.category === "clothing" && Boolean(sku.laneKey) && !isFashionBroadPromotionTarget(sku),
  );
  if (
    clothingInternalLaneCandidates.length === 1 &&
    candidates.every((sku) => sku.id === clothingInternalLaneCandidates[0].id || isFashionBroadPromotionTarget(sku))
  ) {
    return clothingInternalLaneCandidates[0];
  }

  // Wave 881: sport_golf exact lanes can overlap brand/product broad lanes
  // (ex. Mizuno JPX iron also matches Mizuno Iron broad). Prefer the single
  // exact ready lane when every other hit is a broad sibling.
  const sportGolfExactLaneCandidates = candidates.filter(
    (sku) => sku.category === "sport_golf" &&
      Boolean(sku.laneKey) &&
      !sku.id.endsWith("-broad") &&
      !sku.laneKey?.endsWith("_broad"),
  );
  if (
    sportGolfExactLaneCandidates.length === 1 &&
    candidates.every((sku) =>
      sku.id === sportGolfExactLaneCandidates[0].id ||
      sku.id.endsWith("-broad") ||
      sku.laneKey?.endsWith("_broad")
    )
  ) {
    return sportGolfExactLaneCandidates[0];
  }

  // Narrow lane SKUs are stricter than generated broad family SKUs. If exactly
  // one lane SKU matched alongside broad siblings, prefer the lane instead of
  // dropping the listing as ambiguous. Keep true multi-lane collisions blocked.
  const laneCandidates = candidates.filter(
    (sku) => Boolean(sku.laneKey) && ["laptop", "tablet", "smartphone", "watch", "sport_golf"].includes(sku.category),
  );
  if (laneCandidates.length === 1) return laneCandidates[0];

  return null;
}

function requiresCombinedLaneVeto(sku: Sku | null): sku is Sku {
  return sku !== null && Boolean(sku.laneKey) && ["laptop", "tablet", "smartphone", "watch", "sport_golf"].includes(sku.category);
}

// Wave 108 (2026-05-15): title-only ruleMatch가 broad SKU 우선 잡고 narrow lane 무시하는 문제 fix.
// 이전: title이 "갤럭시 s23 울트라 256gb 블랙" (자급제 명시 description만) → broad 매칭하고 즉시 return,
// narrow lane(_self)이 description의 자급제 token 못 봄 → narrow ready 0건.
// 변경: title에서 broad만 잡혔으면 description 포함 combined로 narrow lane 재시도. 1개 narrow 매칭 시 narrow 우선.
// 정책 위반 X — narrow mustContain (자급제 + 용량) 둘 다 명시되어야 매칭 (precision 보존).
// Wave 223 (2026-05-19): clothing/shoe/bag 추가 — Wave 218/219 narrow SKU 박았는데
//   promotion 흐름에 카테고리 없어서 broad 매물 다수 잘못 매칭 (Arcteryx Gamma/Beta 매물이 broad에).
//   사용자 지적 "ready 매물 분류 이상한 거 다 찾아내".
const NARROW_PROMOTE_CATEGORIES = new Set(["smartphone", "laptop", "tablet", "watch", "sport_golf", "game_console", "clothing", "shoe", "bag"]);
const FASHION_PROMOTE_CATEGORIES = new Set(["clothing", "shoe", "bag"]);

function isFashionBroadPromotionTarget(sku: Sku) {
  const laneKey = sku.laneKey ?? "";
  return (
    laneKey.endsWith("_broad") ||
    laneKey.endsWith("_apparel") ||
    laneKey === "cdg_nike_collab" ||
    sku.id.endsWith("-broad")
  );
}

function skuReadyLaneKey(sku: Sku): string | null {
  const fallbackKey = sku.id.replace(/-/g, "_");
  const key = [sku.laneKey, fallbackKey].find((candidate): candidate is string =>
    Boolean(candidate && LANE_READINESS[candidate]?.status === "ready")
  );
  return key ?? null;
}

function tryNarrowLanePromotion(broad: Sku, combined: string, titleNorm: string): Sku | null {
  // Wave 223 (2026-05-19): `_broad` 또는 `_apparel` 접미사 lane key 는 broad lane —
  //   narrow promotion 대상으로 인정. (Wave 218/219 broad SKU 가 LANE_READINESS 등록
  //   위해 laneKey 박았는데 그게 narrow promotion 차단했음.)
  if (broad.laneKey && !broad.laneKey.endsWith("_broad") && !broad.laneKey.endsWith("_apparel") && broad.laneKey !== "tnf_supreme_collab" && broad.laneKey !== "margiela_tabi") return null; // 이미 narrow
  if (!NARROW_PROMOTE_CATEGORIES.has(broad.category)) return null;
  if (combined === titleNorm) return null; // description 없으면 의미 X
  let narrowCandidates = CATALOG_WITH_NOISE_W94.filter(
    (s) => (
      Boolean(skuReadyLaneKey(s)) &&
      s.category === broad.category &&
      (!FASHION_PROMOTE_CATEGORIES.has(broad.category) || !isFashionBroadPromotionTarget(s)) &&
      skuMatches(s, combined)
    ),
  );
  if (broad.id === "shoe-adidas-gazelle-og-broad") {
    narrowCandidates = narrowCandidates.filter((s) => {
      const candidateTokens = s.mustContain.flat().map((token) => token.toLowerCase());
      return candidateTokens.some((token) => (token === "가젤" || token === "gazelle") && tokenHit(titleNorm, token));
    });
  }
  if (narrowCandidates.some((s) => s.id === "shoe-nike-dunk-low-seoul")) {
    narrowCandidates = narrowCandidates.filter((s) => {
      if (s.id !== "shoe-nike-dunk-low-seoul") return true;
      return tokenHit(titleNorm, "서울") || tokenHit(titleNorm, "seoul") || tokenHit(titleNorm, "south korea");
    });
  }
  if (narrowCandidates.length === 1) return narrowCandidates[0];
  return null;
}

function hasBuyRequestMarker(rawText: string, normalizedText: string): boolean {
  const raw = rawText.toLowerCase();
  const sellerCta = /구매\s*희망\s*(?:시|하시면|하실\s*분|하시는\s*분)|구매희망(?:시|하시면)/.test(raw);
  const purchaseHistory = isPurchaseHistoryText(raw);
  const safeSellBuyCredo = /판매\s*(?:\/|및|,|&)\s*구매\s*합니다|판매\s*구매\s*합니다/.test(raw);
  if (!sellerCta && !purchaseHistory && !safeSellBuyCredo && /(?:^|[\s([{])구매\s*(?:\d|원함|원합니다|원해요|희망|합니다|\)|\]|})/.test(raw)) return true;
  for (const token of UNIVERSAL_BUY_REQUEST_NOISE) {
    if (sellerCta && (token === "구매희망" || token === "구매 희망")) continue;
    if (safeSellBuyCredo && (token === "구매합니다" || token === "구매 합니다")) continue;
    if (token === "매입" && isSellerPurchaseServiceText(raw)) continue;
    if ((token === "구해요" || token === "구합니다") && isScarcityText(raw)) continue;
    if (tokenHit(normalizedText, token)) return true;
  }
  return false;
}

function hasExchangeRequestMarker(rawText: string, normalizedText: string): boolean {
  const raw = rawText.toLowerCase();
  const safeAftercare =
    /(?:교환|교신|반품|환불)(?:\s*(?:\/|및|,|&)?\s*(?:교환|교신|반품|환불|취소)){0,3}.{0,16}(?:불가|x|×|❌|사절|사양|안|않|차단|어려|어렵)|교환\s*불가|교환불가|교신\s*불가|교신불가|교환.{0,12}환불.{0,16}(?:불가|x|×|❌|사절|사양|안|어려|어렵)|환불.{0,12}교환.{0,16}(?:불가|x|×|❌|사절|사양|안|어려|어렵)|(?:교환|교신)\s*(?:안|않)(?:해|합|받|되)|(?:교환|교신)[\s\S]{0,40}(?:문의|문의시|제안)[\s\S]{0,40}(?:차단|사절|사양|안\s*받|받지\s*않|불가)/.test(raw);
  if (safeAftercare) return false;

  if (/(?:판\s*\/\s*교|판매\s*\/\s*교환|교환\s*\/\s*판매|교신(?:가|가능|합니다|해요|원함|원해|구함|받|위주)?)/.test(raw)) return true;
  if (/(?:^|[\s([{])교환\s*(?:글|원함|원합니다|원해요|해요|합니다|하고\s*싶|하실\s*분|해주실\s*분|구함|구해요|만)(?:$|[\s)\]}!.,]|하|원|구)/.test(raw)) {
    return true;
  }
  if (/^\s*(?:\[교환\]|\(교환\)|교환글)\s*/.test(raw)) {
    return true;
  }
  if (/추가금.{0,24}교환|교환.{0,24}추가금/.test(normalizedText)) return true;
  if (/(?:<-->|<->|↔|→|->).{0,80}(?:교환|구합니다|구해요|원합니다|원해요)/.test(raw)) return true;
  if (/(?:교환|구합니다|구해요|원합니다|원해요).{0,80}(?:<-->|<->|↔|→|->)/.test(raw)) return true;
  return false;
}

function hasFashionReferenceOnlyFalsePositive(titleNorm: string): boolean {
  const styleRef = /(?:맛|스타일|무드|느낌|대체|st\.?|st\)|st$)/i.test(titleNorm);
  if (
    styleRef &&
    /(?:아크테릭스|arcteryx|arc'teryx).{0,24}(?:베일런스|veilance)|(?:베일런스|veilance).{0,24}(?:아크테릭스|arcteryx|arc'teryx)/i.test(titleNorm) &&
    /(?:유니클로|uniqlo|데상트|descente|블레이저|브라운자켓|브라운\s*자켓)/i.test(titleNorm)
  ) {
    return true;
  }
  if (
    /(?:\brrl\b|더블\s*알엘|더블알엘|double\s*rl)/i.test(titleNorm) &&
    (
      /(?:맛|스타일|무드|느낌|대체)/i.test(titleNorm) ||
      /(?:랭글러|wrangler|lvc|리바이스|levi'?s).{0,40}(?:\brrl\b|더블\s*알엘|더블알엘)|(?:\brrl\b|더블\s*알엘|더블알엘).{0,40}(?:랭글러|wrangler|lvc|리바이스|levi'?s)/i.test(titleNorm)
    )
  ) {
    return true;
  }
  return false;
}

export function ruleMatch(title: string, description = ""): Sku | null {
  const titleNorm = normalize(title);
  const combinedRaw = `${title} ${stripLinkLikeText(description).slice(0, 200)}`;
  const combined = normalize(combinedRaw);
  if (hasBuyRequestMarker(combinedRaw, combined)) return null;
  if (hasExchangeRequestMarker(combinedRaw, combined)) return null;
  if (hasFashionReferenceOnlyFalsePositive(titleNorm)) return null;
  const titleDirect = directSpecificMatch(title);
  if (titleDirect) return requiresCombinedLaneVeto(titleDirect) && !skuMatches(titleDirect, combined) ? null : titleDirect;

  const titleCandidates = CATALOG_WITH_NOISE_W94.filter((s) => skuMatches(s, titleNorm));
  const titleChoice = chooseUniqueCandidate(titleCandidates);
  if (titleChoice) {
    const combinedDirect = directSpecificMatch(combinedRaw);
    if (titleChoice.id === "airpods-4-anc" && combinedDirect?.id === "airpods-4") return combinedDirect;
    if (combinedDirect && isFashionAxisDirectOverrideCompatible(titleChoice, combinedDirect)) return combinedDirect;
    // Wave 108: title이 broad만 잡혔으면 narrow lane 재시도
    const narrowPromoted = tryNarrowLanePromotion(titleChoice, combined, titleNorm);
    if (narrowPromoted) {
      return requiresCombinedLaneVeto(narrowPromoted) && !skuMatches(narrowPromoted, combined) ? null : narrowPromoted;
    }
    return requiresCombinedLaneVeto(titleChoice) && !skuMatches(titleChoice, combined) ? null : titleChoice;
  }
  if (titleCandidates.length > 1) return null;

  const combinedDirect = directSpecificMatch(combinedRaw);
  if (combinedDirect) return combinedDirect;

  const descCandidates = CATALOG_WITH_NOISE_W94.filter((s) => skuMatches(s, combined));
  return chooseUniqueCandidate(descCandidates);
}
