// 수집 파이프라인:
//   검색 → 분류(listing_type) → 정상 매물만 상세 enrich → 배송비 파싱 → 점수 계산 → Supabase upsert
//
// Python PoC 09_airpods_filter_refine.py + 10_shipping_fee_test.py 포팅.

import { createHash } from "node:crypto";

import { shouldReviewByPolicy } from "@/lib/ai-l2-policy";
import { applyEscrowTransition } from "@/lib/ai-l2-escrow";
import { collectSearchItems, fetchDetail } from "@/lib/bunjang";
import { CATALOG, normalize, ruleMatch, skuById, type Sku } from "@/lib/catalog";
import { parseGameConsoleListing } from "@/lib/game-console-parser";
import { GENERATED_NOISE_RULES } from "@/lib/generated/noise-rules";
import { loadPipelineRuntimeConfig } from "@/lib/pipeline-config";
import { soldOutTextHits } from "@/lib/sold-out";
import { jsonBody } from "@/lib/supabase-rest";

// ─── 분류 키워드 ─────────────────────────────────────────────────────────────
const BUYING_KEYWORDS = [
  "구합니다", "구해요", "삽니다", "급구", "매입", "최고가", "전국출장", "구매합니다",
  "구매만 합니다", "매입전문", "매입업체", "출장매입", "매입합니다", "구매원함", "매입문의",
  "구합니", "구해봅니다", "구해 봅니다", "구매함",
  ...GENERATED_NOISE_RULES.buying,
];
const CALLOUT_KEYWORDS = [
  "사지마세요", "사기당함", "사기꾼", "저격", "도용", "짝퉁", "조심",
  "타오바오", "타오바이", "taobao", "짭", "가품", "레플", "레플리카",
  "이미테이션", "정품아님", "정품 아님", "비정품", "차이팟",
  ...GENERATED_NOISE_RULES.callout,
];
const PARTS_KEYWORDS = [
  "부품용", "본체만", "유닛만", "좌측", "우측", "한쪽", "한짝", "한 쪽", "한알", "낱개", "단품",
  "케이스만", "충전케이스만", "충전 케이스만", "액정만", "배터리만",
  "교체용", "호환", "익스텐션", "연장",
  ...GENERATED_NOISE_RULES.parts,
];
const DAMAGED_KEYWORDS = [
  "고장", "작동안됨", "작동 안됨", "안켜짐", "안 켜짐",
  "먹통", "충전안됨", "충전 안됨", "충전이 안됨", "충전이 안되는",
  "충전이안됨", "충전이안되는", "충전불량", "충전 불량",
  "툭툭", "끊김", "잡음", "소리 안", "소리가 안", "노캔 안됨",
  "노캔키면", "알갱이 소리", "소리 들리는",
  "수리이력", "찍힘 심", "기스 심", "파손", "액정파손", "액정 파손",
  "액정깨짐", "액정 깨짐", "액정 멍", "액정에 멍", "화면 멍", "디스플레이 멍",
  "멍있음", "멍 있음", "잠김", "초기화불가",
  "배터리 광탈", "배터리효율 낮", "방전",
  "잔상", "번인", "터치불량", "터치 불량", "페이스아이디 안됨", "face id 안됨",
  "줄감", "세로줄", "가로줄", "불량화소",
  "카메라불량", "카메라 불량", "유심인식불량", "유심 인식 불량", "침수",
  "분실폰", "도난폰", "아이클라우드 잠김", "icloud 잠김", "미납폰",
  ...GENERATED_NOISE_RULES.damaged,
];
const ACCESSORY_TITLE_KEYWORDS = [
  "스트랩", "밴드", "파우치", "키링", "거치대", "충전기", "어댑터",
  "브레이슬릿", "루프", "필름", "강화유리", "커버", "실리콘",
  "악세사리", "악세서리", "이어팁", "보호캡", "메탈밴드", "나토밴드",
  "이어패드", "이어 패드", "이어쿠션", "이어 쿠션", "헤드쿠션", "헤드 쿠션",
  "스탠드", "충전독", "충전 독",
  "모니터암", "모니터 암", "받침대", "브라켓",
  "밀레니즈", "밀레니즈 루프", "가죽스트랩", "시계줄", "충전기케이블",
  "보호필름", "메탈스트랩", "나토 스트랩", "퀵체인지 스트랩", "스포츠밴드", "d버클",
  "링크브레이슬릿", "링크 브레이슬릿", "링블", "싱글투어", "싱글 투어",
  ...GENERATED_NOISE_RULES.accessory,
];
const MULTI_KEYWORDS = ["일괄", "묶음", "각각", "선택", "여러개", "재고", ...GENERATED_NOISE_RULES.multi];
// 업자성/미끼성 매물 — 1개라도 있으면 commercial. 정상 본품 가격 분포에 절대 들어가면 안 됨.
// 스마트폰 샘플 300건에서 직접 관찰됨: 재고정리·완납폰·제휴카드·유심 그대로 류는
// 개인 판매자는 거의 쓰지 않고 통신사 대리점/도매상 매물에 집중됨.
const COMMERCIAL_STRONG_KEYWORDS = [
  "재고정리", "재고 정리", "선착순특가", "선착순 특가", "선착순 한정",
  "한정판매", "한정 판매", "마지막입고", "마지막 입고",
  "극소량보유", "극소량 보유", "완납폰", "제휴카드",
  "유심 그대로", "유심그대로",
  "재고 유무", "재고유무", "재고확인", "전색상", "재입고", "품절임박",
  "상품번호", "대량구매", "대량 판매", "대량판매", "도매", "세금계산서", "매장방문", "중고폰 구매", "부산중고폰",
  "단기 렌탈", "장기 렌탈", "렌탈", "임대", "대여",
  "1년에 딱 한번", "저렴한시기", "저렴한 시기", "전색상입고", "전색상 입고",
  ...GENERATED_NOISE_RULES.commercialStrong,
];
// 단독으로는 정상 매물에도 나올 수 있으나 가격 왜곡 의심. AI 검토용 플래그만 부여.
const COMMERCIAL_WEAK_KEYWORDS = [
  "통신사 특가", "신규개통", "번호이동", "개통 조건", "2년 약정",
  "자급제 신규", "선착순",
  ...GENERATED_NOISE_RULES.commercialWeak,
];
const NORMAL_SIGNALS = [
  "미개봉", "새상품", "풀박스", "풀구성", "풀세트", "정상작동",
  "정상 작동", "기능 정상", "기능에는 아무런 문제", "문제 없이",
  "문제없", "정품", "시리얼", "구매내역", "구매 영수증",
  "상자", "박스", "구성품", "양쪽", "노이즈 캔슬링", "노캔",
  "기능적으로 문제", "문제되는 부분은 하나도", "상태양호", "상태 양호",
];
const RISK_KEYWORDS = [
  "직거래만", "현금만", "박스없음", "박스 없음", "보증서없음",
  "수리이력", "수리 이력", "배터리교체", "배터리 교체",
  "충전안됨", "충전 안됨", "충전이 안됨", "충전이 안되는",
  "기능이상", "외관손상", "액정깨짐", "잠김", "분실신고",
  "초기화불가", "고장", "불량", "먹통", "작동안됨",
];
const SHORT_TITLE_MIN = 9;
const AI_CLASSIFIER_MODEL = process.env.OPENAI_CLASSIFIER_MODEL ?? "gpt-4.1-mini";
const AI_CLASSIFIER_PROMPT_VERSION = "ai_l2_parser_metadata_v1";
const AI_CLASSIFIER_INPUT_USD_PER_1M = Number(process.env.OPENAI_CLASSIFIER_INPUT_USD_PER_1M ?? 0.4);
const AI_CLASSIFIER_OUTPUT_USD_PER_1M = Number(process.env.OPENAI_CLASSIFIER_OUTPUT_USD_PER_1M ?? 1.6);

function nrm(text: unknown): string {
  return normalize(String(text ?? ""));
}

function containsAny(text: string, keywords: string[]): string[] {
  const n = nrm(text);
  return keywords.filter((kw) => nrm(kw).trim() && n.includes(nrm(kw).trim()));
}

function compactLen(text: unknown): number {
  return String(text ?? "").replace(/\s+/g, "").length;
}

function hasNormalSignal(title: string, desc: string): boolean {
  return containsAny(`${title}\n${desc}`, NORMAL_SIGNALS).length > 0;
}

function buyingHits(title: string, desc: string): string[] {
  const hits = containsAny(title, BUYING_KEYWORDS);
  const normalizedTitle = nrm(title);
  const normalizedText = nrm(`${title}\n${desc}`);
  const historicalPurchaseSignal =
    /(구매\s*(?:내역|영수증|인증|시기|날짜|일자|처|당시|후|한|했|했습니다)|\d{2,4}\s*년.{0,8}구매|구매한지|구매하고|구매하여|구매해서|구매했던|구매해놓고)/.test(normalizedText);

  if (
    !historicalPurchaseSignal &&
    /(구매\s*합니다|구매합니다|구매\s*원합니다|구매원합니다|구매\s*원함|구매원함|정품만\s*구매|삽니다|급구|매입\s*합니다|매입합니다|(?:정품만|가격|선에서|\d+\s*만원).{0,16}(구합니다|구해요|구해봅니다|구해\s*봅니다))/.test(normalizedText)
  ) {
    hits.push("buying_intent_text");
  }

  if (
    !historicalPurchaseSignal &&
    /(?:^|[\s/])구매$/.test(normalizedTitle) &&
    !/(판매|팝니다|급처|처분|미개봉|새상품|풀박|풀박스|정상|상태)/.test(normalizedText)
  ) {
    hits.push("buying_title_suffix");
  }

  return [...new Set(hits)];
}

function accessoryTitleHits(title: string): string[] {
  let hits = containsAny(title, ACCESSORY_TITLE_KEYWORDS);
  const tn = nrm(title);
  const compact = tn.replace(/\s+/g, "");
  if (/후지\s*필름|fujifilm/i.test(tn)) {
    hits = hits.filter((hit) => hit !== "필름");
  }
  const fullSetTokens = ["풀세트", "풀구성", "풀박스"];
  const productToken = "(에어팟|airpods|소니|sony|보스|bose|비츠|beats|젠하이저|sennheiser|헤드폰|헤드셋|맥스|max|wh|xm|qc)";
  const accessoryToken = "(케이스|파우치|거치대|충전선|케이블|이어쿠션|이어패드|헤드쿠션|스마트케이스|커버)";
  const includedAccessorySignal =
    fullSetTokens.some((t) => compact.includes(t)) ||
    new RegExp(`${accessoryToken}(?:포함|있|있음|o|같이|드림|드립니다|까지)`, "i").test(compact) ||
    (isFullSizeHeadphoneText(tn) && new RegExp(`(?:\\+|plus|및|랑|와|과)${accessoryToken}$`, "i").test(compact)) ||
    new RegExp(`${productToken}.{0,50}(?:\\+|plus|및|랑|와|과)${accessoryToken}$`, "i").test(compact) ||
    new RegExp(`${productToken}.{0,50}${accessoryToken}(?:\\+|까지|포함|같이|드림|드립니다|있|있음|o)`, "i").test(compact) ||
    new RegExp(`${accessoryToken}(?:\\+|까지|포함|같이).{0,24}${productToken}`, "i").test(compact) ||
    /(?:구성품|본품|본체).{0,16}(케이스|파우치|거치대|충전선|케이블|스마트케이스)/.test(tn);
  if (includedAccessorySignal) {
    hits = hits.filter((hit) => !["케이스", "파우치", "거치대", "스탠드", "이어패드", "이어 패드", "이어쿠션", "이어 쿠션", "헤드쿠션", "헤드 쿠션", "커버", "케이블", "충전기"].includes(hit));
  }
  if (isEarbudProtectiveCaseOnlyTitle(tn, compact)) {
    hits.push("케이스");
  } else if (tn.includes("케이스") && !includedAccessorySignal) {
    hits.push("케이스");
  }
  if (
    !fullSetTokens.some((t) => compact.includes(t)) &&
    (/(?:에어팟|airpods|애플워치|applewatch|갤럭시워치|galaxywatch).{0,12}박스(?:만|판매|팝니다|삽니다|구함|$)/i.test(tn) ||
      /(?:박스만|박스판매|박스팝니다|박스삽니다|박스구함)/.test(compact))
  ) {
    hits.push("box_only");
  }
  return hits;
}

function isEarphoneLikeText(text: string): boolean {
  return /(에어팟|airpods|버즈|buds|이어버드|이어폰)/i.test(text);
}

function isFullSizeHeadphoneText(text: string): boolean {
  return /(에어팟\s*맥스|airpods\s*max|헤드폰|헤드셋|headphone|headset|소니|sony|보스|bose|비츠|beats|젠하이저|sennheiser|wh[-\s]?\d|xm[3-6]|qc\s*(?:울트라|ultra|45)|quietcomfort)/i.test(text);
}

function isGameConsoleFullUnitText(text: string): boolean {
  return /(ps5|플스\s*5|플스5|플레이스테이션\s*5|playstation\s*5|닌텐도\s*스위치|스위치\s*oled|switch\s*oled|switch\s*2)/i.test(text) &&
    /(본체|풀박|풀박스|풀구성|풀세트|디스크\s*에디션|디지털\s*에디션|disc\s*edition|digital\s*edition)/i.test(text);
}

function hasCompleteEarphoneSetSignal(normalized: string, compact: string): boolean {
  if (/(풀박|풀박스|풀세트|풀구성|본품\s*전체|구성품\s*전부|케이스\s*포함|충전케이스\s*포함)/.test(normalized)) {
    return true;
  }
  return /(양쪽|좌우|둘다|둘 다)/.test(normalized) && /(본체|케이스|충전케이스)/.test(compact);
}

function isEarbudProtectiveCaseOnlyTitle(normalizedTitle: string, compactTitle: string, normalizedText = normalizedTitle, compactText = compactTitle): boolean {
  if (!isEarphoneLikeText(normalizedTitle) || isFullSizeHeadphoneText(normalizedTitle)) return false;
  if (!/(케이스|case|커버)/i.test(normalizedTitle)) return false;
  if (/(충전\s*케이스|충전케이스)/.test(normalizedTitle)) return false;
  if (hasCompleteEarphoneSetSignal(normalizedText, compactText)) return false;
  if (/(풀박|풀박스|풀세트|풀구성|본품전체|구성품전부)/.test(compactText)) return false;

  return (
    /(?:케이스|case|커버)(?:단독|단품|만|판매|팝니다|새상품|미개봉|급처|처분)?$/i.test(compactTitle) ||
    /(?:단독|단품|만).{0,8}(?:케이스|case|커버)|(?:케이스|case|커버).{0,8}(?:단독|단품|만|새상품|미개봉)/i.test(normalizedTitle)
  );
}

export function isSideOnlyEarbudListing(title: string, desc = ""): boolean {
  const text = `${title}\n${desc}`;
  const normalized = nrm(text);
  const compact = normalized.replace(/\s+/g, "");
  if (isFullSizeHeadphoneText(normalized)) return false;
  const isEarbud = isEarphoneLikeText(normalized);
  if (!isEarbud) return false;

  const sideSignal =
    /(왼쪽|오른쪽|좌측|우측|좌유닛|우유닛|좌\s*유닛|우\s*유닛|left|right)/i.test(normalized) ||
    /(?:^|[^a-z가-힣])(l|r)(?:쪽|유닛|unit|낱개|단품|만|$)/i.test(normalized);
  if (!sideSignal) return false;

  const fullProductSignal = hasCompleteEarphoneSetSignal(normalized, compact);
  const explicitUnitSignal = /(유닛|이어버드|낱개|단품|한쪽|한짝|한알|쪽만|만\s*판매)/.test(normalized);

  // "에어팟 프로 2세대 왼쪽 8핀"처럼 유닛이라는 단어가 없어도
  // 좌/우 방향만 제목에 뜨면 대부분 단품 판매다. 풀세트 신호가 강한 경우만 살린다.
  if (!fullProductSignal) return true;
  if (explicitUnitSignal && !/(양쪽|좌우|둘다|둘 다)/.test(compact)) return true;
  return false;
}

function partsHits(title: string, desc: string): string[] {
  const text = `${title}\n${desc}`;
  let hits = containsAny(text, PARTS_KEYWORDS);
  const compactTitle = nrm(title).replace(/\s+/g, "");
  const normalizedTitle = nrm(title);
  const compactText = nrm(text).replace(/\s+/g, "");
  const normalizedText = nrm(text);
  const fullSizeHeadphone = isFullSizeHeadphoneText(normalizedText);
  const explicitEarbudPart =
    /(유닛|이어버드|충전케이스|충전\s*케이스|왼쪽|오른쪽|좌측|우측|한쪽|한짝|한알|l\s*유닛|r\s*유닛|left|right)/i.test(normalizedText);
  const protectiveCaseOnly = isEarbudProtectiveCaseOnlyTitle(normalizedTitle, compactTitle, normalizedText, compactText);

  if (fullSizeHeadphone && !explicitEarbudPart) {
    hits = hits.filter((hit) => hit !== "단품" && hit !== "본체만");
  }
  if (protectiveCaseOnly) {
    hits = hits.filter((hit) => !["케이스만", "단품", "낱개", "호환"].includes(hit));
  }
  if (isGameConsoleFullUnitText(normalizedText)) {
    hits = hits.filter((hit) => hit !== "본체만");
  }

  if (/(왼쪽|오른쪽|좌측|우측).{0,8}(유닛|이어버드)|(?:유닛|이어버드).{0,8}(왼쪽|오른쪽|좌측|우측)/.test(compactText)) {
    hits.push("side_unit");
  }
  if (isEarphoneLikeText(normalizedText) && !fullSizeHeadphone && /(본체|충전케이스).{0,8}(단품|만|판매|팝니다)|(?:단품|만).{0,8}(본체|충전케이스)/.test(compactText)) {
    hits.push("case_only");
  }
  if (/(l|r)\s*\/?\s*(유닛|unit)|\b(l|r)\b.{0,8}(낱개|단품)/i.test(title)) {
    hits.push("lr_unit");
  }
  if (isSideOnlyEarbudListing(title, desc)) {
    hits.push("side_only_earbud");
  }
  if (
    isEarphoneLikeText(normalizedTitle) &&
    /(유닛|unit)/i.test(normalizedTitle) &&
    !hasCompleteEarphoneSetSignal(normalizedTitle, compactTitle)
  ) {
    hits.push("title_unit_only");
  }
  if (!fullSizeHeadphone && !isGameConsoleFullUnitText(normalizedText) && compactTitle.includes("본체") && !containsAny(text, ["양쪽", "풀박", "풀박스", "풀세트", "풀구성"]).length) {
    hits.push("title_case_only");
  }
  if (
    isEarphoneLikeText(nrm(text)) &&
    /(유닛|이어버드).{0,12}(잃어버|분실|없|없음)|(?:잃어버|분실|없|없음).{0,12}(유닛|이어버드)/.test(nrm(text))
  ) {
    hits.push("missing_earbud_unit");
  }
  if (
    isEarphoneLikeText(normalizedText) &&
    !fullSizeHeadphone &&
    /(왼쪽|오른쪽|좌측|우측|left|right).{0,18}(잃어\s*버|잃어버|분실|없(?:습니다|어요|음|다)?)/i.test(normalizedText) &&
    !/(왼쪽|오른쪽|좌측|우측).{0,18}(기스|흠집|찍힘|스크래치|하자|문제).{0,12}없|(?:기스|흠집|찍힘|스크래치|하자|문제).{0,12}없.{0,18}(왼쪽|오른쪽|좌측|우측)/.test(normalizedText)
  ) {
    hits.push("missing_side_earbud");
  }

  return [...new Set(hits)];
}

function calloutHits(title: string, desc: string): string[] {
  const text = `${title}\n${desc}`;
  const normalized = nrm(text);
  return containsAny(text, CALLOUT_KEYWORDS).filter((hit) => {
    if (
      (hit === "가품" || hit === "짝퉁" || hit === "레플" || hit === "정품아님" || hit === "정품 아님" || hit === "비정품") &&
      /(가품|짝퉁|레플|비정품|정품\s*아님).{0,12}(?:일\s*경우|이면|시).{0,20}(?:환불|보상)|(?:가품|짝퉁|레플|비정품)\s*아닙니다|정품만\s*판매|100%\s*정품/.test(normalized)
    ) {
      return false;
    }
    return true;
  });
}

function damagedHits(title: string, desc: string): string[] {
  const text = `${title}\n${desc}`;
  const normalized = nrm(text);
  const hits = containsAny(text, DAMAGED_KEYWORDS).filter((hit) => {
    if (hit === "잔상" && /무잔상|잔상\s*(?:없|없음|없습니다|전혀\s*없)/.test(normalized)) return false;
    if (hit === "고장" && /고장\s*(?:없|없음|없습니다|아님|아닙니다)|고장없/.test(normalized)) return false;
    if (hit === "고장" && /고장품(?:이나)?\s*불량품은\s*판매하지|고장품.*판매하지\s*않/.test(normalized)) return false;
    if ((hit === "파손" || hit.includes("파손")) && /파손\s*(?:없|없음|없습니다|아님|아닙니다|안|우려|우려\s*없|우려\s*없이)|파손없|파손안/.test(normalized)) return false;
    if (hit.includes("멍") && /멍\s*(?:없|없음|없습니다|아님|아닙니다)|멍없/.test(normalized)) return false;
    if (hit === "침수" && /침수(?:폰)?\s*(?:없|없음|없습니다|아님|일절\s*취급하지|취급하지\s*않)|침수\s*라벨\s*(?:정상|깨끗)/.test(normalized)) return false;
    if ((hit === "분실폰" || hit === "도난폰") && /분실\s*도난\s*침수폰?\s*일절\s*취급하지|분실\s*(?:없|없음|신고\s*없)|도난\s*(?:없|없음)/.test(normalized)) return false;
    return true;
  });
  const compactText = nrm(text).replace(/\s+/g, "");

  const hasNegatedOrContingentDefect =
    /(하자없|하자전혀없|하자없이|무하자|하자는없|하자없습|하자없습니다|하자도없|큰하자없|큰하자가없|기능하자없|기능하자없고|하자전혀없이|하자x)/i.test(compactText) ||
    /(택배|배송|보내면|보낼\s*경우).{0,24}(하자|파손|문제).{0,16}(발생할\s*수|생길\s*수|우려|위험)|(?:하자|파손|문제).{0,16}(발생할\s*수|생길\s*수|우려|위험).{0,24}(택배|배송|보내면|보낼\s*경우)/.test(normalized);

  if (compactText.includes("하자") && !hasNegatedOrContingentDefect) {
    hits.push("하자");
  }
  if (compactText.includes("불량") && !/(불량없|불량없이|불량이슈로없습니다|불량품은판매하지|기능불량시.*(?:환불|반품)|불량시.*(?:환불|반품))/.test(compactText)) {
    hits.push("불량");
  }
  if (
    /(안들림|안 들림|소리안남|소리 안남|한쪽안들림|한쪽 안들림)/.test(text) ||
    /(소리|오디오|음성|사운드).{0,8}(안\s*나오|안\s*남|나오지\s*않|출력\s*안|출력\s*불가)/.test(normalized)
  ) {
    hits.push("sound_failure");
  }
  if (/(작동\s*여부|작동여부).{0,12}(모름|모릅니다|불명|확인\s*불가)|작동\s*확인.{0,12}(안|못|불가)/.test(normalized)) {
    hits.push("function_unverified");
  }
  if (/(배터리(?:효율|성능)?|배터리\s*(?:효율|성능)).{0,8}([0-7][0-9])\s*%/.test(text)) {
    hits.push("low_battery_under_80");
  }
  if (/배터리(?:효율|성능)?\s*80\s*%\s*미만/.test(compactText)) {
    hits.push("low_battery_under_80");
  }
  if (/배터리(?:효율|성능)?(?:은|는|:)?[0-7][0-9](?!\d)(?:%|프로|퍼|입니다|사진|$)/.test(compactText)) {
    hits.push("low_battery_under_80");
  }

  return [...new Set(hits)];
}

function suspiciousModelText(title: string, desc: string): boolean {
  const text = nrm(`${title}\n${desc}`).replace(/\s+/g, "");
  return /에어팟프로[34]|airpodspro[34]/i.test(text);
}

function multiModelHits(title: string): string[] {
  const raw = String(title ?? "").toLowerCase();
  const normalized = nrm(title);
  const compact = normalized.replace(/\s+/g, "");
  const hasChoiceSeparator = /[/|,·+]|또는|선택|중에|중 택|중택|가격\s*상이|가격상이/.test(raw);
  if (!hasChoiceSeparator) return [];

  const hits: string[] = [];
  const add = (hit: string) => {
    if (!hits.includes(hit)) hits.push(hit);
  };

  if (compact.includes("에어팟맥스") || normalized.includes("airpods max")) add("airpods_max");
  if (compact.includes("에어팟프로") || normalized.includes("airpods pro")) add("airpods_pro");
  if (/(에어팟|airpods).{0,6}(2세대|2nd)|에어팟2/.test(normalized)) add("airpods_2");
  if (/(에어팟|airpods).{0,6}(3세대|3rd)|에어팟3/.test(normalized)) add("airpods_3");
  if (/(에어팟|airpods).{0,6}(4세대|4th)|에어팟4/.test(normalized)) add("airpods_4");

  if (compact.includes("애플워치울트라") || normalized.includes("applewatch ultra")) add("applewatch_ultra");
  if (compact.includes("애플워치se") || normalized.includes("applewatch se")) add("applewatch_se");
  for (const n of ["7", "8", "9", "10", "11"]) {
    if (new RegExp(`애플워치(?:시리즈)?${n}|시리즈${n}|series${n}|applewatch${n}`).test(compact)) add(`applewatch_${n}`);
  }

  if (compact.includes("갤럭시워치울트라") || normalized.includes("galaxywatch ultra")) add("galaxywatch_ultra");
  if (compact.includes("클래식") || normalized.includes("classic")) add("galaxywatch_classic");
  for (const n of ["4", "5", "6", "7", "8"]) {
    if (new RegExp(`갤럭시워치${n}|갤워치${n}|galaxywatch${n}|워치${n}`).test(compact)) add(`galaxywatch_${n}`);
  }

  return hits.length >= 2 ? hits : [];
}

export type ListingType = "normal" | "parts" | "multi" | "buying" | "callout" | "damaged" | "accessory" | "commercial" | "unknown";

type ClassifyResult = { listingType: ListingType; sku: Sku | null };

function monitorPreSkuNoise(title: string, desc: string, price: number): ListingType | null {
  const textN = nrm(`${title}\n${desc}`);
  const titleN = nrm(title);
  const compactText = textN.replace(/\s+/g, "");
  const monitorSignal = /(모니터|monitor|울트라기어|오디세이|odyssey|벤큐|benq|zowie|조위|alienware|에일리언웨어)/i.test(textN);
  if (!monitorSignal) return null;

  const accessoryOnly =
    /(모니터\s*암|모니터암|스탠드|받침대|브라켓|어댑터|전원선|케이블|hdmi|dp케이블|dp\s*케이블).{0,16}(단독|단품|만|판매|팝니다)|(?:단독|단품|만|판매|팝니다).{0,16}(모니터\s*암|모니터암|스탠드|받침대|브라켓|어댑터|전원선|케이블|hdmi|dp케이블|dp\s*케이블)/i.test(textN);
  if (accessoryOnly && price > 0 && price < 180_000) return "accessory";

  const damagedPanel =
    /(액정|패널|화면|디스플레이).{0,16}(파손|깨짐|불량|고장|나감)|(?:줄감|세로줄|가로줄|멍|번인|불량화소|백라이트\s*불량|백라이트불량)/.test(textN);
  if (damagedPanel) return "damaged";

  const pcBundle =
    /(본체|데스크탑|데스크톱|pc|컴퓨터|키보드|마우스).{0,24}(모니터)|(?:모니터).{0,24}(본체|데스크탑|데스크톱|pc|컴퓨터|키보드|마우스)/i.test(textN);
  if (pcBundle && !/(모니터\s*단품|모니터만|모니터\s*만)/.test(compactText)) return "multi";

  const multiMonitor = /\b[2-9]\s*대\b/.test(titleN) || /(듀얼\s*모니터|모니터\s*2대|모니터두대|2대\s*일괄)/.test(compactText);
  if (multiMonitor) return "multi";

  return null;
}

function categoryScopedNoise(title: string, desc: string, price: number, sku: Sku): ListingType | null {
  const titleN = nrm(title);
  const textN = nrm(`${title}\n${desc}`);
  const compactTitle = titleN.replace(/\s+/g, "");
  const compactText = textN.replace(/\s+/g, "");
  const fullBoxSignal = /(풀박스|풀박|풀구성|풀세트|박스포함|박스 포함)/.test(compactText);

  if (sku.category === "earphone") {
    const merchOnlySignal =
      /(포카|포토\s*카드|포토카드|특전|럭드|미공포|미개봉\s*특전|키링|스티커).{0,24}(에어팟\s*맥스|에어팟맥스|airpods\s*max)|(?:에어팟\s*맥스|에어팟맥스|airpods\s*max).{0,24}(포카|포토\s*카드|포토카드|특전|럭드|미공포|미개봉\s*특전|키링|스티커)/i.test(textN);
    if (merchOnlySignal && price > 0 && price < 80_000) {
      return "accessory";
    }

    const boxOnlySignal = !fullBoxSignal && /(박스만(?!없)|박스판매|박스팝니다|박스구함|박스삽니다|에어팟(?:프로|맥스)?박스)/.test(compactText);
    if (boxOnlySignal || (!fullBoxSignal && titleN.includes("박스") && price > 0 && price < 30_000)) {
      return "accessory";
    }

    const includedAccessoryContext =
      /(케이스|파우치|거치대|충전선|케이블|이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|헤드\s*쿠션|스마트케이스).{0,24}(포함|있|있음|같이|드림|드립니다|까지)|(?:구성품|풀구성|풀세트).{0,40}(케이스|파우치|거치대|충전선|케이블|이어패드|이어쿠션|헤드쿠션|스마트케이스)/.test(textN);
    const accessoryOnlyTitle =
      /(스탠드|충전독|충전\s*독|거치대|이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|헤드\s*쿠션|스펀지)/.test(titleN) &&
      !includedAccessoryContext;
    const accessoryOnlyContext =
      /(이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|헤드\s*쿠션|스펀지|거치대|스탠드).{0,12}(단독|단품|만|판매|팝니다)|(?:단독|단품|만|판매|팝니다).{0,12}(이어패드|이어\s*패드|이어쿠션|이어\s*쿠션|헤드쿠션|헤드\s*쿠션|스펀지|거치대|스탠드)/.test(textN);
    const protectiveCaseOnly = isEarbudProtectiveCaseOnlyTitle(titleN, compactTitle, textN, compactText) && !includedAccessoryContext;
    if (protectiveCaseOnly) {
      return "accessory";
    }
    if (accessoryOnlyTitle || (accessoryOnlyContext && !includedAccessoryContext)) {
      return /(스펀지)/.test(textN) ? "parts" : "accessory";
    }
    if (/(배터리|교체\s*부품|교체부품).{0,12}(단독|단품|만|판매|팝니다|부품)|(?:단독|단품|만|판매|팝니다|부품).{0,12}(배터리|교체\s*부품|교체부품)/.test(textN)) {
      return "parts";
    }

    if (/(케이스|충전케이스).{0,20}(유닛|이어버드).{0,20}(잃어버|분실|없)|(?:유닛|이어버드).{0,20}(잃어버|분실|없).{0,20}(케이스|충전케이스)/.test(textN)) {
      return "parts";
    }
  }

  if (sku.category === "speaker") {
    const accessoryOnly =
      /(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블).{0,16}(단독|단품|만|판매|팝니다|구함|삽니다)|(?:단독|단품|만|판매|팝니다|구함|삽니다).{0,16}(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블)/.test(textN)
      || /(케이스|하드쉘|파우치|가방|커버|스탠드|거치대|충전기|케이블)/.test(titleN);
    if (accessoryOnly && !fullBoxSignal) return "accessory";

    const wrongDeviceClass =
      /(무선\s*마이크|마이크|노래방|karaoke|pa\s*스피커|eon|리시버|receiver|앰프|amp|마란츠|marantz|사운드바|soundbar|북쉘프|패시브\s*스피커|인티앰프)/.test(textN);
    if (wrongDeviceClass) return "unknown";

    const mixedOrRental =
      /(일괄|묶음|세트).{0,24}(스피커|마이크|앰프|리시버)|(?:스피커|마이크|앰프|리시버).{0,24}(일괄|묶음|세트)|대여|렌탈/.test(textN);
    if (mixedOrRental) return "multi";
  }

  if (sku.category === "camera") {
    const cameraHardExclusion =
      /(구매|삽니다|구합니다|업자x|사기꾼|하자|수리\s*필요|수리필요|부품용|고장|바디캡|렌즈캡|뒷캡|케이스|가방)/.test(textN);
    if (cameraHardExclusion) return /(구매|삽니다|구합니다)/.test(textN) ? "buying" : "accessory";

    const fixedLensCompact = /(g7x|powershot|파워샷|cyber\s*shot|사이버샷)/.test(textN);
    if (fixedLensCompact) return "unknown";

    const noLensSignal = /(렌즈\s*(별도|미포함|없|없음|제외)|렌즈는?\s*별도)/.test(textN);
    const lensOrBundleSignal =
      !noLensSignal && /(렌즈|번들|번들킷|키트|세트|풀셋|풀셋트|탐론|시그마|삼양|ttartisan|\bmm\b|f[0-9.]+)/.test(textN)
      || /\+\s*[0-9]/.test(`${title} ${desc}`);
    if (lensOrBundleSignal) return "multi";
  }

  if (sku.category === "game_console") {
    const game = parseGameConsoleListing(title, desc, price);
    if (game.listingType === "accessory" || game.listingType === "game_title") return "accessory";
    if (game.listingType === "damaged_or_modded") return "damaged";
    if (game.listingType === "buying") return "buying";
    if (game.listingType === "multi_bundle") return "multi";
    if (game.listingType !== "normal" || game.needsReview) return "unknown";
  }

  if (sku.category === "smartphone") {
    if (sku.id === "iphone-16" && /(아이폰16e|iphone16e|iphone\s*16e)/i.test(compactTitle)) {
      return "unknown";
    }
    const boxOnlySignal = !fullBoxSignal && /(빈박스|박스만|박스판매|박스팝니다|박스구함|박스삽니다|아이폰박스|갤럭시박스)/.test(compactText);
    if (boxOnlySignal || (!fullBoxSignal && titleN.includes("박스") && price > 0 && price < 50_000)) {
      return "accessory";
    }
    const phoneAccessorySignal = /(case|케이스|폰케이스|그립톡|스마트톡|맥세이프|파인우븐|슬림아머|슈피겐|어반소피스티케이션|모란카노|tyreus|토라스|torras|switcheasy|스위치이지|브리즈피|와일드플라워|wildflower|디월렛|다이어리|청량\s*글라스|청량글라스|보호필름|강화유리|필름|줄이어폰|이어폰|충전기|어댑터|beats)/i.test(textN);
    if (phoneAccessorySignal && price > 0 && price < 150_000) {
      return "accessory";
    }
    if (/(터치\s*스크린|터치스크린|oled\s*터치|s\s*펜|s펜|스타일러스)/i.test(titleN) && price > 0 && price < 180_000) {
      return "parts";
    }
    const phonePartsSignal = /(백글라스|후면\s*유리|후면유리|후면판|카메라\s*렌즈|카메라렌즈|충전\s*단자|충전단자|액정|터치\s*스크린|터치스크린|oled\s*터치|배터리|메인보드|하우징|s\s*펜|s펜|스타일러스).{0,16}(판매|팝니다|교체|부품|정품|펜)|(?:판매|팝니다|교체|부품|정품).{0,16}(백글라스|후면\s*유리|후면유리|후면판|카메라\s*렌즈|카메라렌즈|충전\s*단자|충전단자|액정|터치\s*스크린|터치스크린|oled\s*터치|배터리|메인보드|하우징|s\s*펜|s펜|스타일러스)/.test(textN);
    if (phonePartsSignal && price > 0 && price < 180_000) {
      return "parts";
    }
  }

  if (sku.category === "smartwatch") {
    const boxOnlySignal = !fullBoxSignal && /(박스만|박스판매|박스팝니다|박스구함|박스삽니다|애플워치박스|갤럭시워치박스)/.test(compactText);
    if (boxOnlySignal || (!fullBoxSignal && titleN.includes("박스") && price > 0 && price < 50_000)) {
      return "accessory";
    }
    if (/(충전독|충전\s*독|충전기|케이블|스트랩|밴드|브레이슬릿|루프|시계줄|필름|강화유리|커버|거치대|스탠드)/.test(titleN)) {
      return "accessory";
    }
  }

  if (sku.category === "tablet") {
    const hasTabletStorage = /(?:^|[^0-9])(32|64|128|256|512)\s*(?:gb|g|기가)|(?:1|2)\s*(?:tb|테라)/.test(textN);
    const boxOnlySignal = !fullBoxSignal && /(빈박스|빈\s*박스|박스만|박스판매|박스팝니다|박스구함|박스삽니다|아이패드박스|갤럭시탭박스|갤탭박스)/.test(compactText);
    const strongTabletAccessory =
      /(매직\s*키보드|magic\s*keyboard|스마트\s*폴리오|smart\s*folio|북커버|북\s*커버|키보드\s*케이스|키보드케이스|종이질감|보호필름|강화유리|케이스|파우치|거치대|스탠드)/i.test(titleN);
    const pencilOnly =
      /(애플\s*펜슬|애플펜슬|apple\s*pencil|s펜|s\s*pen)/i.test(titleN) &&
      !/(아이패드|ipad|갤럭시\s*탭|갤럭시탭|갤탭|galaxy\s*tab).{0,8}(?:\+|와|과|랑|및|포함)/i.test(titleN);

    if (boxOnlySignal || (!fullBoxSignal && titleN.includes("박스") && price > 0 && price < 60_000)) return "accessory";
    if (strongTabletAccessory && (!hasTabletStorage || price < 500_000)) return "accessory";
    if (pencilOnly && price < 250_000) return "accessory";
  }

  if (sku.category !== "laptop") return null;

  const boxOnlySignal = !fullBoxSignal && /(박스만|박스판매|박스팝니다|박스구함|박스삽니다|맥북박스|맥북에어박스|맥북프로박스)/.test(compactText);

  if (boxOnlySignal || (!fullBoxSignal && titleN.includes("박스") && price > 0 && price < 100_000)) {
    return "accessory";
  }

  if (/(전용\s*ssd|ssd\s*저장\s*장치|저장\s*장치|외장\s*ssd|ssd\s*교체용)/.test(titleN)) {
    return "parts";
  }

  if (/(액정|디스플레이|상판|하판|키보드|트랙패드|배터리).{0,16}(교체용|부품용|부품|전용)|(?:교체용|부품용|부품|전용).{0,16}(액정|디스플레이|상판|하판|키보드|트랙패드|배터리)/.test(titleN)) {
    return "parts";
  }

  const accessoryOnly =
    /(어댑터|충전기|케이블|파우치|케이스|하드쉘|슬리브|인케이스|incase|가방|키스킨|필름|보호필름|스탠드|거치대|허브|독|dock|hub|마우스|매직마우스|키보드|트랙패드|터치패드|trackpad|touchpad|모니터|monitor)/i.test(titleN);
  const hasMacbookSpec = /(m[1-5]|i[3579]|13\s*인치|14\s*인치|15\s*인치|16\s*인치|8\s*gb|16\s*gb|24\s*gb|32\s*gb|256\s*gb|512\s*gb|1\s*tb|1\s*테라)/.test(textN);
  if (accessoryOnly && !hasMacbookSpec) return "accessory";

  const accessoryDominant =
    /(케이스|하드쉘|슬리브|인케이스|incase|가방|파우치|키스킨|필름|보호필름|스탠드|거치대|허브|독|dock|hub|마우스|매직마우스|키보드|트랙패드|터치패드|trackpad|touchpad|모니터|monitor)/i.test(titleN);
  const strongAccessoryDominant =
    /(케이스|하드쉘|슬리브|인케이스|incase|가방|파우치|키스킨|필름|보호필름|키보드\s*가드|키보드가드|트랙패드|터치패드|trackpad|touchpad|허브|독|dock|hub|모니터|monitor)/i.test(titleN);
  const fullUnitSignal =
    /(정상작동|정상 작동|풀박|풀박스|풀구성|풀세트|박스포함|구성품|본품|노트북)/.test(textN);
  if (accessoryDominant && !fullUnitSignal && (!hasMacbookSpec || price < 150_000 || strongAccessoryDominant)) {
    return "accessory";
  }

  const titlePartOnly =
    /(배터리|액정|디스플레이|상판|하판|키보드|트랙패드|터치패드|로직보드|보드)/i.test(titleN) &&
    !/(배터리\s*(?:성능|효율|사이클)|배터리.{0,12}(?:좋|정상|양호))/.test(textN);
  if (titlePartOnly && !fullUnitSignal && price < 150_000) return "parts";

  if (compactTitle.includes("맥북") && /(삽니다|구합니다|매입|박스구함|박스삽니다)/.test(compactText)) {
    return "buying";
  }

  return null;
}

export function classifyListing(title: string, desc: string, price: number): ClassifyResult {
  const text = `${title}\n${desc}`;
  const normalizedText = nrm(text);
  const normalizedTitle = nrm(title);
  const accessoryWords = /(case|케이스|폰케이스|그립톡|스마트톡|맥세이프|파인우븐|슬림아머|슈피겐|어반소피스티케이션|모란카노|tyreus|디월렛|다이어리|보호필름|강화유리|필름)/i;
  const accessoryTitleSignal = accessoryWords.test(normalizedTitle);
  const accessoryStandaloneTextSignal =
    /(?:case|케이스|폰케이스|그립톡|스마트톡|맥세이프|파인우븐|슬림아머|슈피겐|어반소피스티케이션|모란카노|tyreus|디월렛|다이어리|보호필름|강화유리|필름).{0,12}(?:단독|단품|만|판매|팝니다|새상품|미개봉|급처|처분)|(?:단독|단품|만|판매|팝니다).{0,12}(?:case|케이스|폰케이스|그립톡|스마트톡|맥세이프|보호필름|강화유리|필름)/i.test(normalizedText);
  const includedAccessoryTextSignal =
    /(?:케이스|박스|충전기|케이블|필름|스트랩|밴드).{0,18}(?:포함|같이|드려요|드립니다|드림|있|있음|붙여|보관)|(?:본품|본체|풀박|풀박스|기기|제품).{0,24}(?:케이스|박스|충전기|케이블|필름|스트랩|밴드)/.test(normalizedText);

  if (soldOutTextHits(title, desc).length > 0) return { listingType: "callout", sku: null };
  if (buyingHits(title, desc).length > 0) return { listingType: "buying", sku: null };
  if (price <= 0 || price < 5000) return { listingType: "callout", sku: null };
  if (calloutHits(title, desc).length > 0) return { listingType: "callout", sku: null };
  if (containsAny(text, COMMERCIAL_STRONG_KEYWORDS).length > 0) return { listingType: "commercial", sku: null };
  const monitorNoise = monitorPreSkuNoise(title, desc, price);
  if (monitorNoise) return { listingType: monitorNoise, sku: null };
  if (
    !isEarphoneLikeText(normalizedText) &&
    (accessoryTitleSignal || (accessoryStandaloneTextSignal && !includedAccessoryTextSignal)) &&
    price > 0 &&
    price < 150_000
  ) {
    return { listingType: "accessory", sku: null };
  }
  if (partsHits(title, desc).length > 0) return { listingType: "parts", sku: null };
  if (damagedHits(title, desc).length > 0) return { listingType: "damaged", sku: null };
  if (accessoryTitleHits(title).length > 0) return { listingType: "accessory", sku: null };

  const multiHits = containsAny(title, MULTI_KEYWORDS);
  if (/\b[2-9]\s*개\b/.test(title)) multiHits.push("N개");
  multiHits.push(...multiModelHits(title));
  if (multiHits.length > 0) return { listingType: "multi", sku: null };

  const sku = ruleMatch(title, desc);
  if (!sku) return { listingType: "unknown", sku: null };
  const scopedNoise = categoryScopedNoise(title, desc, price, sku);
  if (scopedNoise) return { listingType: scopedNoise, sku: null };
  if (compactLen(title) < SHORT_TITLE_MIN && !hasNormalSignal(title, desc) && !["monitor", "camera"].includes(sku.category)) {
    return { listingType: "unknown", sku: null };
  }
  return { listingType: "normal", sku };
}

// ─── 배송비 파싱 ─────────────────────────────────────────────────────────────
function moneyToInt(raw: string): number | null {
  const text = raw.replace(/,/g, "").trim();
  if (!text) return null;
  if (/\d+\s*만/.test(raw)) return null;
  const v = parseInt(text, 10);
  if (!Number.isFinite(v) || v < 1000 || v > 20000) return null;
  return v;
}

function compactStr(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

const HALF_HINTS = ["반값", "반택", "gs반값", "gs", "cu", "끼리"];
const GENERAL_HINTS_STR = ["일반", "일반택배", "택배", "우체국", "편의점택배", "cj", "대한통운"];

function contextKind(ctx: string): "half" | "general" | "unknown" {
  const c = compactStr(ctx);
  if (HALF_HINTS.some((h) => c.includes(compactStr(h)))) return "half";
  if (GENERAL_HINTS_STR.some((h) => c.includes(compactStr(h)))) return "general";
  return "unknown";
}

type ShippingOption = { kind: "free" | "general" | "half" | "unknown"; amount: number };
type ShippingParsed = { min: number | null; general: number | null; options: ShippingOption[] };

export function parseShippingFromDescription(description: string): ShippingParsed {
  const text = description || "";
  const FREE_PATTERNS = [
    /무료\s*배송|무료배송|택배비\s*무료|배송비\s*무료|택배비\s*포함|택배비포함|배송비\s*포함|배송비포함|무료로\s*배송|제가\s*부담|내드릴께요|내드릴게요/,
  ];
  const hasFree = FREE_PATTERNS.some((p) => p.test(text));

  const options: ShippingOption[] = [];
  const seen = new Set<string>();

  const kwRe = /(일반\s*택배|일반|반값\s*택배|반값|반택|gs\s*반값|gs|cu|끼리|편의점\s*택배|편의점택배|우체국|택배|배송|배송비|택배비)/gi;
  const amRe = /([+]?\s*\d{1,2},?\d{3})\s*원?/;
  const combinedRe = new RegExp(kwRe.source + `[^0-9가-힣a-zA-Z]{0,12}` + amRe.source, "gi");

  for (const m of text.matchAll(combinedRe)) {
    const ctx = m[0];
    const amount = moneyToInt(m[2]);
    if (amount == null) continue;
    const kind = contextKind(ctx);
    const key = `${kind}:${amount}`;
    if (!seen.has(key)) { seen.add(key); options.push({ kind, amount }); }
  }

  const shortRe = /(택배|반택|반값|배송비|택배비)\s*([+]?\s*\d{4,5})\s*원?/gi;
  for (const m of text.matchAll(shortRe)) {
    const amount = moneyToInt(m[2]);
    if (amount == null) continue;
    const kind = contextKind(m[1]);
    const key = `${kind}:${amount}`;
    if (!seen.has(key)) { seen.add(key); options.push({ kind, amount }); }
  }

  if (hasFree && options.length === 0) {
    return { min: 0, general: 0, options: [{ kind: "free", amount: 0 }] };
  }

  const all = options.map((o) => o.amount);
  const generals = options.filter((o) => o.kind === "general").map((o) => o.amount);
  return {
    min: all.length > 0 ? Math.min(...all) : null,
    general: generals.length > 0 ? generals[0] : (all.length > 0 ? Math.max(...all) : null),
    options,
  };
}

export function parseShippingFromTrade(trade: unknown, trades: unknown): ShippingParsed {
  const options: ShippingOption[] = [];

  if (trade && typeof trade === "object") {
    const t = trade as Record<string, unknown>;
    if (t.freeShipping) {
      return { min: 0, general: 0, options: [{ kind: "free", amount: 0 }] };
    }
    const specs = t.shippingSpecs;
    if (specs && typeof specs === "object") {
      for (const [key, spec] of Object.entries(specs as Record<string, unknown>)) {
        if (!spec || typeof spec !== "object") continue;
        const s = spec as Record<string, unknown>;
        const amount = moneyToInt(String(s.fee ?? ""));
        if (amount == null) continue;
        const kind = key === "DEFAULT" ? "general" : "half";
        options.push({ kind, amount });
      }
    }
  }

  if (options.length === 0 && Array.isArray(trades)) {
    for (const block of trades) {
      if (!block || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b.title !== "배송비") continue;
      for (const content of (b.contents as string[]) ?? []) {
        const parsed = parseShippingFromDescription(String(content));
        options.push(...parsed.options);
      }
    }
  }

  const all = options.map((o) => o.amount);
  const generals = options.filter((o) => o.kind === "general").map((o) => o.amount);
  return {
    min: all.length > 0 ? Math.min(...all) : null,
    general: generals.length > 0 ? generals[0] : null,
    options,
  };
}

const DEFAULT_SHIPPING_FEE = 3500;

type ShippingResult = {
  shippingFee: number;
  shippingFeeGeneral: number | null;
  shippingSource: string;
  estimatedBuyCost: number;
  grossResellGap: number;
  netGapAfterShipping: number;
};

export function resolveShipping(
  price: number,
  skuMedian: number,
  freeShipping: boolean,
  apiParsed: ShippingParsed,
  descParsed: ShippingParsed,
): ShippingResult {
  let fee: number;
  let source: string;

  if (freeShipping) {
    fee = 0; source = "search_api_free_shipping";
  } else if (apiParsed.min != null) {
    fee = apiParsed.min; source = "detail_api_trade";
  } else if (descParsed.min != null) {
    fee = descParsed.min; source = "description_parse";
  } else {
    fee = DEFAULT_SHIPPING_FEE; source = "default";
  }

  const generalFee = apiParsed.general ?? descParsed.general ?? null;
  const gross = Math.max(0, skuMedian - price);
  return {
    shippingFee: fee,
    shippingFeeGeneral: generalFee,
    shippingSource: source,
    estimatedBuyCost: price + fee,
    grossResellGap: gross,
    netGapAfterShipping: Math.max(0, gross - fee),
  };
}

// ─── 점수 계산 ───────────────────────────────────────────────────────────────
function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

function percentileRank(values: number[], value: number): number {
  if (values.length === 0) return 0;
  return values.filter((v) => v <= value).length / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ─── 메인 파이프라인 ─────────────────────────────────────────────────────────
export type PipelineRow = {
  pid: string;
  url: string;
  name: string;
  price: number;
  skuId: string;
  skuName: string;
  skuMedian: number;
  saleStatus?: string | null;
  descriptionPreview: string;
  imageUrlTemplate?: string | null;
  imageCount?: number;
  thumbnailUrl?: string | null;
  priceGap: number;
  numFaved: number;
  velocity: number;
  reviewRating: number | null;
  reviewCount: number;
  safety: number;
  riskHits: number;
  score: number;
  scoreFlags: string[];
  parseConfidence?: number | null;
  parserNeedsReview?: boolean | null;
  comparableKey?: string | null;
  parserUnknownParts?: string[];
  parserCriticalUnknown?: string[];
  aiEscrowKind?: string | null;
  shippingFee: number;
  shippingFeeGeneral: number | null;
  shippingSource: string;
  estimatedBuyCost: number;
  grossResellGap: number;
  netGapAfterShipping: number;
};

export type PipelineResult = {
  collected: number;
  titleNormal: number;
  enriched: number;
  scored: number;
  aiReviewRequested: number;
  aiCacheHits: number;
  aiApiCalls: number;
  aiUnavailable: number;
  aiFiltered: number;
  aiKeptNormal: number;
  aiKeptLowConfidence: number;
  normal: number;
  upserted: number;
};

type AiListingType = "normal" | "counterfeit" | "parts" | "buying" | "callout" | "damaged" | "accessory" | "multi" | "commercial" | "unknown";
type AiConfidence = "high" | "medium" | "low";
type AiDecision = "pass" | "hold" | "reject";
type AiClassification = {
  listingType: AiListingType;
  decision: AiDecision | null;
  confidence: AiConfidence;
  reason: string;
  riskKeywords: string[];
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  cached?: boolean;
};
type AiReviewStats = {
  requested: number;
  cacheHits: number;
  apiCalls: number;
  unavailable: number;
  filtered: number;
  keptNormal: number;
  keptLowConfidence: number;
  // Wave 34 — escrow transitions (gate OFF default → 모두 0).
  escrowResolvedPass: number;
  escrowHeld: number;
  escrowUnavailableRetry: number;
};
type AiReviewResult = {
  rows: PipelineRow[];
  stats: AiReviewStats;
  // Wave 34 — caller (scoreStage)가 score_dirty 재마킹할 pid 목록.
  escrowUnavailablePids: string[];
};
type AiClassifyOutcome = {
  result: AiClassification | null;
  source: "cache" | "api" | "unavailable";
};
export type PipelineOptions = {
  searchQueries?: string[];
  searchDelayMs?: number;
  detailLimit?: number;
  detailConcurrency?: number;
  detailDelayMs?: number;
  aiReviewTopN?: number;
  aiReviewConcurrency?: number;
  aiReviewEnabled?: boolean;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runPipeline(pagesPerQuery?: number, options: PipelineOptions = {}): Promise<PipelineResult> {
  const config = loadPipelineRuntimeConfig();
  const resolvedPagesPerQuery = Math.max(1, Math.min(config.maxPagesPerQuery, pagesPerQuery ?? config.pagesPerQuery));
  const searchQueries = options.searchQueries?.length ? options.searchQueries : config.searchQueries;
  const searchDelayMs = Math.max(0, options.searchDelayMs ?? config.searchDelayMs);
  const detailLimit = Math.max(0, Math.min(config.maxDetailLimit, options.detailLimit ?? config.detailLimit));
  const detailConcurrency = Math.max(1, Math.min(config.maxDetailConcurrency, options.detailConcurrency ?? config.detailConcurrency));
  const detailDelayMs = Math.max(0, options.detailDelayMs ?? config.detailDelayMs);
  const aiReviewEnabled = options.aiReviewEnabled ?? true;
  const aiReviewTopN = Math.max(0, Math.min(config.maxAiReviewTopN, options.aiReviewTopN ?? config.aiReviewTopN));
  const aiReviewConcurrency = Math.max(1, Math.min(config.maxAiReviewConcurrency, options.aiReviewConcurrency ?? config.aiReviewConcurrency));

  // 1. 검색
  const searchItems = await collectSearchItems(searchQueries, resolvedPagesPerQuery, searchDelayMs);

  // 2. 분류 — 검색 결과에서 normal만 추출 (상세 API 없이 제목만으로 1차 필터)
  type NormalCandidate = { pid: string; skuId: string; skuName: string };
  const normalCandidates: NormalCandidate[] = [];
  for (const item of searchItems.values()) {
    const { listingType, sku } = classifyListing(item.name, "", item.price);
    if (listingType === "normal" && sku) {
      normalCandidates.push({ pid: item.pid, skuId: sku.id, skuName: sku.modelName });
    }
  }

  // 3. 상세 enrich
  type Enriched = { pid: string; skuId: string; skuName: string; detail: NonNullable<Awaited<ReturnType<typeof fetchDetail>>>; freeShipping: boolean; price: number; numFaved: number; };
  const enriched: Enriched[] = [];
  const enrichTargets = normalCandidates.slice(0, detailLimit);
  let enrichCursor = 0;
  async function enrichNext() {
    const c = enrichTargets[enrichCursor++];
    if (!c) return;
    const item = searchItems.get(c.pid)!;
    const detail = await fetchDetail(c.pid);
    if (detailDelayMs > 0) await sleep(detailDelayMs);
    if (detail) {
      // 2차 필터: 상세 description 포함해 재분류
      const { listingType } = classifyListing(item.name, detail.description, item.price);
      if (listingType === "normal") {
        enriched.push({ pid: c.pid, skuId: c.skuId, skuName: c.skuName, detail, freeShipping: item.freeShipping, price: item.price, numFaved: item.numFaved });
      }
    }
    await enrichNext();
  }
  await Promise.all(
    Array.from({ length: Math.min(detailConcurrency, enrichTargets.length) }, () => enrichNext()),
  );

  // 4. SKU별 시세 계산 (normal 매물 가격 중앙값)
  const pricesBySku = new Map<string, number[]>();
  const favsBySku = new Map<string, number[]>();
  for (const r of enriched) {
    if (!pricesBySku.has(r.skuId)) pricesBySku.set(r.skuId, []);
    pricesBySku.get(r.skuId)!.push(r.price);
    if (!favsBySku.has(r.skuId)) favsBySku.set(r.skuId, []);
    favsBySku.get(r.skuId)!.push(r.numFaved);
  }

  // SKU 중앙값이 적으면 MSRP*0.5 fallback
  const skuMsrpMap = new Map(CATALOG.map((s) => [s.id, s.msrpKrw]));
  function skuMedianFor(skuId: string): number {
    const prices = pricesBySku.get(skuId) ?? [];
    if (prices.length >= 5) return median(prices);
    return (skuMsrpMap.get(skuId) ?? 300000) * 0.5;
  }

  // 5. 점수 계산 + 배송비 결정
  const scored: PipelineRow[] = [];
  for (const r of enriched) {
    const skuMed = skuMedianFor(r.skuId);
    const priceGap = skuMed <= 0 ? 0 : clamp((skuMed - r.price) / skuMed);
    const velocity = percentileRank(favsBySku.get(r.skuId) ?? [], r.numFaved);

    const ratingRaw = r.detail.shopReviewRating;
    const safetyBase = ratingRaw == null ? 0.5 : clamp(ratingRaw / 5);
    const reviewBonus = r.detail.shopReviewCount >= 100 ? 0.05 : 0;
    const riskHits = RISK_KEYWORDS.filter((kw) =>
      r.detail.description.toLowerCase().includes(kw.toLowerCase())
    ).length;
    const safety = clamp(safetyBase + reviewBonus - Math.min(0.5, riskHits * 0.1));
    const score = (priceGap * 0.5 + velocity * 0.4 + safety * 0.1) * 100;

    const flags: string[] = [];
    if (priceGap >= 0.75) flags.push("extreme_discount_review");
    if (priceGap >= 0.55) flags.push("deep_discount_review");
    if (suspiciousModelText(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("suspicious_model_review");
    if (multiModelHits(searchItems.get(r.pid)?.name ?? "").length > 0) flags.push("multi_model_review");
    if (compactLen(r.detail.description === "" ? (searchItems.get(r.pid)?.name ?? "") : r.detail.description) < SHORT_TITLE_MIN) {
      if (!hasNormalSignal(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("short_title");
    }
    if (!hasNormalSignal(searchItems.get(r.pid)?.name ?? "", r.detail.description)) flags.push("weak_normal_signal");
    if (containsAny(`${searchItems.get(r.pid)?.name ?? ""}\n${r.detail.description}`, COMMERCIAL_WEAK_KEYWORDS).length > 0) flags.push("commercial_review");

    const apiParsed = parseShippingFromTrade(r.detail.tradeData, r.detail.tradesData);
    const descParsed = parseShippingFromDescription(r.detail.description);
    const shipping = resolveShipping(r.price, skuMed, r.freeShipping, apiParsed, descParsed);

    scored.push({
      pid: r.pid,
      url: searchItems.get(r.pid)!.url,
      name: searchItems.get(r.pid)!.name,
      price: r.price,
      skuId: r.skuId,
      skuName: r.skuName,
      skuMedian: Math.round(skuMed),
      descriptionPreview: r.detail.description.slice(0, 200),
      priceGap,
      numFaved: r.numFaved,
      velocity,
      reviewRating: ratingRaw,
      reviewCount: r.detail.shopReviewCount,
      safety,
      riskHits,
      score,
      scoreFlags: flags,
      ...shipping,
    });
  }

  // 6. Tier 2 AI — 상위권 애매 후보만 판정. 실패/키 없음이면 룰 기반 결과 유지.
  const aiReview = await applyAiReview(scored, { enabled: aiReviewEnabled, topN: aiReviewTopN, concurrency: aiReviewConcurrency });

  // 7. Supabase upsert
  const upserted = await upsertToSupabase(aiReview.rows);

  return {
    collected: searchItems.size,
    titleNormal: normalCandidates.length,
    enriched: enriched.length,
    scored: scored.length,
    aiReviewRequested: aiReview.stats.requested,
    aiCacheHits: aiReview.stats.cacheHits,
    aiApiCalls: aiReview.stats.apiCalls,
    aiUnavailable: aiReview.stats.unavailable,
    aiFiltered: aiReview.stats.filtered,
    aiKeptNormal: aiReview.stats.keptNormal,
    aiKeptLowConfidence: aiReview.stats.keptLowConfidence,
    normal: aiReview.rows.length,
    upserted,
  };
}

// ─── Supabase upsert ─────────────────────────────────────────────────────────
function supabaseHeaders() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
    prefer: "resolution=merge-duplicates",
  };
}

function supabaseUrl(table: string): string {
  const raw = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const base = raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  return `${base}/rest/v1/${table}`;
}

async function upsertRows(table: string, rows: unknown[]): Promise<void> {
  if (rows.length === 0) return;
  const res = await fetch(supabaseUrl(table), {
    method: "POST",
    headers: supabaseHeaders(),
    body: jsonBody(rows),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table} upsert failed: ${res.status} ${body}`);
  }
}

function contentHash(row: PipelineRow): string {
  return createHash("sha256")
    .update(JSON.stringify({
      promptVersion: AI_CLASSIFIER_PROMPT_VERSION,
      name: row.name,
      price: row.price,
      skuName: row.skuName,
      descriptionPreview: row.descriptionPreview,
      flags: row.scoreFlags,
      parser: {
        comparableKey: row.comparableKey ?? null,
        parseConfidence: row.parseConfidence ?? null,
        needsReview: row.parserNeedsReview ?? null,
        unknownParts: row.parserUnknownParts ?? [],
        criticalUnknown: row.parserCriticalUnknown ?? [],
        escrowKind: row.aiEscrowKind ?? null,
      },
    }))
    .digest("hex");
}

function shouldAiReview(row: PipelineRow): boolean {
  return shouldReviewByPolicy({
    priceGap: row.priceGap,
    scoreFlags: row.scoreFlags,
    category: skuById(row.skuId)?.category ?? null,
    legacySuspicious: suspiciousModelText(row.name, row.descriptionPreview),
  });
}

const AI_HARD_RISK_KEYWORDS = [
  "case_only",
  "charging_case_only",
  "protective_case_only",
  "cover_only",
  "unit_only",
  "one_side",
  "parts",
  "broken",
  "damaged",
  "counterfeit",
  "fake",
  "replica",
  "buying",
  "wanted",
  "sold_out",
  "reserved",
  "multi_sku",
  "commercial",
  "dealer",
  "케이스단독",
  "케이스 단독",
  "유닛단독",
  "유닛 단독",
  "단품",
  "가품",
  "짝퉁",
  "삽니다",
  "구매",
  "판매완료",
  "거래완료",
];

function aiHasHardRisk(result: AiClassification): boolean {
  const text = result.riskKeywords.map((keyword) => nrm(keyword)).join(" ");
  return AI_HARD_RISK_KEYWORDS.some((keyword) => text.includes(nrm(keyword)));
}

function aiSecondOpinionDecision(result: AiClassification): AiDecision {
  if (result.decision) return result.decision;
  if (result.listingType === "normal") {
    return result.confidence === "high" ? "pass" : "hold";
  }
  if (result.listingType === "unknown" || result.confidence === "low") return "hold";
  return "reject";
}

async function fetchAiCache(row: PipelineRow, hash: string): Promise<AiClassification | null> {
  const url = `${supabaseUrl("mvp_listing_ai_classifications")}?select=listing_type,confidence,reason,risk_keywords,model&pid=eq.${encodeURIComponent(row.pid)}&content_hash=eq.${encodeURIComponent(hash)}&limit=1`;
  const res = await fetch(url, { headers: supabaseHeaders() });
  if (!res.ok) return null;
  const rows = await res.json() as Array<{
    listing_type: AiListingType;
    confidence: AiConfidence;
    reason: string | null;
    risk_keywords: string[] | null;
    model: string | null;
  }>;
  const cached = rows[0];
  if (!cached) return null;
  return {
    listingType: cached.listing_type,
    decision: null,
    confidence: cached.confidence,
    reason: cached.reason ?? "",
    riskKeywords: cached.risk_keywords ?? [],
    model: cached.model ?? "cache",
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
    cached: true,
  };
}

async function upsertAiCache(row: PipelineRow, hash: string, result: AiClassification): Promise<void> {
  try {
    await upsertRows("mvp_listing_ai_classifications", [{
      pid: parseInt(row.pid, 10),
      content_hash: hash,
      listing_type: result.listingType,
      confidence: result.confidence,
      reason: result.reason,
      risk_keywords: result.riskKeywords,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd,
      classified_at: new Date().toISOString(),
    }]);
  } catch {
    // Cache is an optimization. Do not fail collection if the table is absent.
  }
}

function parseAiClassification(raw: unknown): AiClassification | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const listingType = String(obj.listing_type ?? obj.listingType ?? "unknown") as AiListingType;
  const decision = String(obj.decision ?? "") as AiDecision;
  const confidence = String(obj.confidence ?? "low") as AiConfidence;
  const allowedTypes: AiListingType[] = ["normal", "counterfeit", "parts", "buying", "callout", "damaged", "accessory", "multi", "commercial", "unknown"];
  const allowedDecisions: AiDecision[] = ["pass", "hold", "reject"];
  const allowedConfidence: AiConfidence[] = ["high", "medium", "low"];
  return {
    listingType: allowedTypes.includes(listingType) ? listingType : "unknown",
    decision: allowedDecisions.includes(decision) ? decision : null,
    confidence: allowedConfidence.includes(confidence) ? confidence : "low",
    reason: String(obj.reason ?? ""),
    riskKeywords: Array.isArray(obj.risk_keywords)
      ? obj.risk_keywords.map(String).slice(0, 8)
      : (Array.isArray(obj.riskKeywords) ? obj.riskKeywords.map(String).slice(0, 8) : []),
    model: AI_CLASSIFIER_MODEL,
    inputTokens: null,
    outputTokens: null,
    costUsd: null,
  };
}

async function classifyWithAi(row: PipelineRow): Promise<AiClassification | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      signal: controller.signal,
      body: jsonBody({
        model: AI_CLASSIFIER_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a conservative second-opinion reviewer for Korean secondhand resale candidates. Return only JSON with decision, listing_type, confidence, reason, risk_keywords. decision must be pass, hold, or reject. pass is allowed only when the listing is clearly a full working unit, the SKU/options match, it is currently sellable, and no unresolved risk remains. If there is any doubt, choose hold. Reject clear counterfeit/parts/buying/callout/damaged/accessory/multi/commercial listings. Positive bias is forbidden.",
          },
          {
            role: "user",
            content: JSON.stringify({
              allowed_decision: ["pass", "hold", "reject"],
              allowed_listing_type: ["normal", "counterfeit", "parts", "buying", "callout", "damaged", "accessory", "multi", "commercial", "unknown"],
              allowed_confidence: ["high", "medium", "low"],
              policy: "This is not a primary classifier. It is an escrow check for candidates that rules already found suspicious or unusually profitable. If the listing explicitly says fake/replica/Taobao/counterfeit, classify counterfeit and reject. If it is only a charging case/body/unit/one side/protective case/cover/pouch/accessory, classify parts or accessory and reject. If it is a buying post, classify buying and reject. If the title lists multiple different models/SKUs or selectable models with one price, classify multi and reject. If it is a commercial/dealer-style listing — stock liquidation (재고정리), first-come specials (선착순특가), telco bundle deals (완납폰/제휴카드/유심 그대로/통신사 특가), bait-style new-product clearance with multiple model options — classify commercial and reject. If status, SKU, options, condition, or sellability is not clear enough, choose hold. Only choose pass with high confidence.",
              parser_policy: "Parser metadata is context, not permission to rescue a listing. If model identity is missing, SKU/options conflict, or parser critical unknowns remain unresolved from the text, choose hold. AI pass must not override deterministic sold/inactive, buying, damaged, counterfeit, accessory-only, or category-readiness blocks.",
              listing: {
                title: row.name,
                price: row.price,
                sku: row.skuName,
                sku_median: row.skuMedian,
                price_gap: row.priceGap,
                shipping_fee: row.shippingFee,
                general_shipping_fee: row.shippingFeeGeneral,
                estimated_buy_cost: row.estimatedBuyCost,
                gross_resell_gap: row.grossResellGap,
                net_gap_after_shipping: row.netGapAfterShipping,
                seller_review_rating: row.reviewRating,
                seller_review_count: row.reviewCount,
                risk_hits: row.riskHits,
                sale_status: row.saleStatus,
                flags: row.scoreFlags,
                parser: {
                  comparable_key: row.comparableKey ?? null,
                  parse_confidence: row.parseConfidence ?? null,
                  needs_review: row.parserNeedsReview ?? null,
                  unknown_parts: row.parserUnknownParts ?? [],
                  critical_unknown: row.parserCriticalUnknown ?? [],
                  escrow_kind: row.aiEscrowKind ?? null,
                },
                description: row.descriptionPreview.slice(0, 500),
              },
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    const parsed = parseAiClassification(JSON.parse(content));
    if (!parsed) return null;
    parsed.inputTokens = Number.isFinite(json.usage?.prompt_tokens) ? json.usage.prompt_tokens : null;
    parsed.outputTokens = Number.isFinite(json.usage?.completion_tokens) ? json.usage.completion_tokens : null;
    if (parsed.inputTokens != null || parsed.outputTokens != null) {
      parsed.costUsd = (
        ((parsed.inputTokens ?? 0) * AI_CLASSIFIER_INPUT_USD_PER_1M) +
        ((parsed.outputTokens ?? 0) * AI_CLASSIFIER_OUTPUT_USD_PER_1M)
      ) / 1_000_000;
    }
    return parsed;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function classifyWithCache(row: PipelineRow): Promise<AiClassifyOutcome> {
  const hash = contentHash(row);
  const cached = await fetchAiCache(row, hash);
  if (cached) return { result: cached, source: "cache" };
  if (!process.env.OPENAI_API_KEY) return { result: null, source: "unavailable" };
  const fresh = await classifyWithAi(row);
  if (!fresh) return { result: null, source: "unavailable" };
  if (fresh) await upsertAiCache(row, hash, fresh);
  return { result: fresh, source: "api" };
}

export async function applyAiReview(
  rows: PipelineRow[],
  options: { enabled: boolean; topN: number; concurrency: number },
): Promise<AiReviewResult> {
  const emptyStats: AiReviewStats = {
    requested: 0,
    cacheHits: 0,
    apiCalls: 0,
    unavailable: 0,
    filtered: 0,
    keptNormal: 0,
    keptLowConfidence: 0,
    escrowResolvedPass: 0,
    escrowHeld: 0,
    escrowUnavailableRetry: 0,
  };
  if (!options.enabled || options.topN <= 0) {
    return { rows, stats: emptyStats, escrowUnavailablePids: [] };
  }

  // Wave 44 — AI review topN sort에만 적용하는 boost. row.score는 변경하지 않음 (pool/listings/analysis
  // 출력 + 사용자 노출 rank 무관 유지). escrow pending row가 starvation으로 AI까지 못 가는 문제 해결용.
  // pool-policy는 ai_escrow_pending을 hard block하므로 AI verdict 전까지 user-facing 노출 차단 유지.
  const ESCROW_AI_REVIEW_PRIORITY_BOOST = 1e6;
  const reviewPriority = (row: PipelineRow): number =>
    row.score + (row.scoreFlags.includes("ai_escrow_pending") ? ESCROW_AI_REVIEW_PRIORITY_BOOST : 0);
  const sorted = [...rows].sort((a, b) => reviewPriority(b) - reviewPriority(a));
  const reviewRows = sorted.slice(0, options.topN).filter(shouldAiReview);
  const reviewPids = new Set(reviewRows.map((row) => row.pid));
  const stats: AiReviewStats = { ...emptyStats, requested: reviewPids.size };
  const escrowUnavailablePids: string[] = [];
  if (reviewPids.size === 0) return { rows, stats, escrowUnavailablePids };

  const reviewed = new Map<string, PipelineRow | null>();
  let cursor = 0;
  async function reviewNext() {
    const row = reviewRows[cursor++];
    if (!row) return;
    const { result, source } = await classifyWithCache(row);
    if (source === "cache") stats.cacheHits += 1;
    if (source === "api") stats.apiCalls += 1;
    if (source === "unavailable") stats.unavailable += 1;

    const hasEscrowPending = row.scoreFlags.includes("ai_escrow_pending");

    if (!result) {
      // Wave 34: escrow row의 AI 호출이 실패한 경우 pending → unavailable으로 전환,
      // caller가 raw_listings.score_dirty=true로 다시 마킹해 다음 tick에 재시도.
      const base = hasEscrowPending
        ? applyEscrowTransition(row.scoreFlags, "unavailable")
        : [...row.scoreFlags, "ai_review_unavailable"];
      if (hasEscrowPending) {
        stats.escrowUnavailableRetry += 1;
        escrowUnavailablePids.push(row.pid);
      }
      reviewed.set(row.pid, { ...row, scoreFlags: base });
      await reviewNext();
      return;
    }

    const decision = aiSecondOpinionDecision(result);
    const hardRisk = aiHasHardRisk(result);

    if (decision === "pass" && result.listingType === "normal" && result.confidence === "high" && !hardRisk) {
      stats.keptNormal += 1;
      // Wave 34: escrow row가 AI pass면 pending flag 제거 → pool 진입 허용.
      const baseFlags = hasEscrowPending
        ? applyEscrowTransition(row.scoreFlags, "pass")
        : [...row.scoreFlags];
      if (hasEscrowPending) stats.escrowResolvedPass += 1;
      reviewed.set(row.pid, { ...row, scoreFlags: [...baseFlags, "ai_normal", "ai_second_opinion_pass"] });
      await reviewNext();
      return;
    }

    if (decision === "reject" && result.confidence !== "low") {
      // AI-confirmed noise: do not upsert as a visible candidate.
      stats.filtered += 1;
      reviewed.set(row.pid, null);
      await reviewNext();
      return;
    }

    stats.keptLowConfidence += 1;
    // Wave 34: escrow row가 hold이면 pending → held로 전환. pool은 계속 차단.
    const baseFlags = hasEscrowPending
      ? applyEscrowTransition(row.scoreFlags, "hold")
      : [...row.scoreFlags];
    if (hasEscrowPending) stats.escrowHeld += 1;
    reviewed.set(row.pid, {
      ...row,
      scoreFlags: [
        ...baseFlags,
        "ai_second_opinion_hold",
        `ai_${result.listingType}_${result.confidence}_confidence`,
      ],
    });
    await reviewNext();
  }

  await Promise.all(
    Array.from({ length: Math.min(options.concurrency, reviewRows.length) }, () => reviewNext()),
  );

  const output: PipelineRow[] = [];
  for (const row of rows) {
    if (!reviewPids.has(row.pid)) {
      output.push(row);
      continue;
    }
    const reviewedRow = reviewed.get(row.pid);
    if (reviewedRow) output.push(reviewedRow);
  }
  return { rows: output, stats, escrowUnavailablePids };
}

async function upsertToSupabase(rows: PipelineRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const now = new Date().toISOString();

  // rank by score desc
  const sorted = [...rows].sort((a, b) => b.score - a.score);

  const listings = sorted.map((r) => ({
    pid: parseInt(r.pid, 10),
    url: r.url,
    name: r.name,
    price: r.price,
    sku_name: r.skuName,
    sku_median: r.skuMedian,
    description_preview: r.descriptionPreview,
    shipping_fee: r.shippingFee,
    shipping_fee_general: r.shippingFeeGeneral,
    shipping_source: r.shippingSource,
    estimated_buy_cost: r.estimatedBuyCost,
    gross_resell_gap: r.grossResellGap,
    net_gap_after_shipping: r.netGapAfterShipping,
    source_json: {},
    generated_at: now,
    updated_at: now,
  }));

  const analyses = sorted.map((r, i) => ({
    pid: parseInt(r.pid, 10),
    price_gap: r.priceGap,
    num_faved: r.numFaved,
    velocity: r.velocity,
    review_rating: r.reviewRating,
    review_count: r.reviewCount,
    safety: r.safety,
    risk_hits: r.riskHits,
    score: r.score,
    score_flags: r.scoreFlags,
    candidate_rank: i + 1,
    source_json: {},
    analyzed_at: now,
    updated_at: now,
  }));

  await upsertRows("mvp_listings", listings);
  await upsertRows("mvp_listing_analysis", analyses);
  return sorted.length;
}
