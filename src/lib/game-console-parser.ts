import { normalize } from "@/lib/catalog";

export type GameConsoleListingType =
  | "normal"
  | "accessory"
  | "damaged_or_modded"
  | "buying"
  | "game_title"
  | "multi_bundle"
  | "unknown";

export type GameConsoleParsed = {
  listingType: GameConsoleListingType;
  platform: string | null;
  model: string | null;
  edition: string | null;
  bodyConfig: "full_set" | "body_only" | "unknown_body";
  bundleRisk: boolean;
  moddedOrDamaged: boolean;
  comparableKey: string | null;
  parseConfidence: number;
  needsReview: boolean;
  reasons: string[];
};

function compact(value: string) {
  return normalize(value).replace(/\s+/g, "");
}

function slug(value: string | null | undefined) {
  return normalize(value ?? "")
    .replace(/[^0-9a-z가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

function detectModel(text: string, dense: string) {
  if (/(스위치|switch).{0,24}(oled|올레드)|(?:oled|올레드).{0,24}(스위치|switch)/.test(text)) {
    return { platform: "nintendo_switch", model: "nintendo_switch_oled", edition: "oled" };
  }
  if (/스위치\s*2|switch\s*2/.test(text)) {
    return { platform: "nintendo_switch", model: "nintendo_switch_2", edition: "switch_2" };
  }
  if (/스위치\s*라이트|switch\s*lite|switchlite/.test(text)) {
    return { platform: "nintendo_switch", model: "nintendo_switch_lite", edition: "lite" };
  }
  if (/배터리\s*개선|신형\s*스위치|switch\s*v2|스위치\s*v2|had/.test(text)) {
    return { platform: "nintendo_switch", model: "nintendo_switch_v2", edition: "v2" };
  }
  if (/닌텐도\s*스위치|nintendo\s*switch|switch/.test(text)) {
    return { platform: "nintendo_switch", model: "nintendo_switch_unknown", edition: "unknown_edition" };
  }

  const ps5 = /ps5|플스\s*5|플레이스테이션\s*5/.test(text);
  if (ps5) {
    const ps5Token = "(?:ps5|플스\\s*5|플스5|플레이스테이션\\s*5)";
    const pro = new RegExp(`${ps5Token}\\s*(?:pro|프로)|(?:pro|프로)\\s*${ps5Token}`).test(text);
    const slim = new RegExp(`${ps5Token}.{0,16}(?:슬림|slim)|(?:슬림|slim).{0,16}${ps5Token}`).test(text);
    const digital = new RegExp(`${ps5Token}.{0,16}(?:디지털|digital)|(?:디지털|digital).{0,16}${ps5Token}|디지털\\s*에디션`).test(text);
    const cfiDigital = /cfi[-\s]?\d{4}\s*b\b/.test(text);
    const cfiDisc = /cfi[-\s]?\d{4}\s*a\b/.test(text);
    const disc = new RegExp(`${ps5Token}.{0,16}(?:디스크|disc)|(?:디스크|disc).{0,16}${ps5Token}|디스크\\s*에디션|디스크버전`).test(text);
    const edition = pro
      ? "pro"
      : slim && digital
        ? "slim_digital"
        : slim && disc
          ? "slim_disc"
          : slim
            ? "slim_unknown"
            : (digital || cfiDigital) && (disc || cfiDisc)
              ? "mixed_disc_digital"
              : digital || cfiDigital
                ? "digital"
                : disc || cfiDisc
                  ? "disc"
                  : "unknown_edition";
    return { platform: "playstation_5", model: `playstation_5_${edition}`, edition };
  }

  if (/ps4\s*pro|플스\s*4\s*프로|플레이스테이션\s*4\s*프로/.test(text)) {
    return { platform: "playstation_4", model: "playstation_4_pro", edition: "pro" };
  }
  if (/ps4|플스\s*4|플레이스테이션\s*4/.test(text)) {
    return { platform: "playstation_4", model: "playstation_4_unknown", edition: "unknown_edition" };
  }
  if (/xbox\s*series\s*x|엑스박스\s*시리즈\s*x/.test(text)) {
    return { platform: "xbox", model: "xbox_series_x", edition: "series_x" };
  }
  if (/xbox\s*series\s*s|엑스박스\s*시리즈\s*s/.test(text)) {
    return { platform: "xbox", model: "xbox_series_s", edition: "series_s" };
  }
  if (/steam\s*deck\s*oled|스팀덱\s*oled/.test(text)) {
    return { platform: "steam_deck", model: "steam_deck_oled", edition: "oled" };
  }
  if (/steam\s*deck|스팀덱/.test(text)) {
    return { platform: "steam_deck", model: "steam_deck_unknown", edition: "unknown_edition" };
  }
  if (/ps\s*vita|psvita|비타/.test(dense)) {
    return { platform: "playstation_vita", model: "playstation_vita", edition: "unknown_edition" };
  }
  if (/3ds/.test(text)) return { platform: "nintendo_3ds", model: "nintendo_3ds", edition: "unknown_edition" };
  if (/(?:^|[^a-z])ds(?:[^a-z]|$)|닌텐도\s*ds/.test(text)) {
    return { platform: "nintendo_ds", model: "nintendo_ds", edition: "unknown_edition" };
  }
  return { platform: null, model: null, edition: null };
}

export function parseGameConsoleListing(title: string, description = "", price = 0): GameConsoleParsed {
  const text = normalize(`${title}\n${description.slice(0, 1000)}`);
  const dense = compact(`${title}\n${description.slice(0, 1000)}`);
  const model = detectModel(text, dense);
  const reasons: string[] = [];
  const addReason = (reason: string) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  const bodySignal = /(본체|기기|콘솔|풀박|풀박스|풀세트|풀구성|박스포함|독\s*포함|조이콘\s*포함|듀얼센스\s*포함)/.test(text);
  const sealedFullSet =
    /(미개봉|새상품).{0,32}(박스|본체|정품)|박스.{0,16}(비닐|미개봉)|박스\s*풀\s*셋|박스풀셋|박스\s*풀\s*세트|박스풀세트/.test(text);
  const sealedDomesticBody =
    model.platform === "nintendo_switch" &&
    /(미개봉|새상품)/.test(text) &&
    /(본체|정품)/.test(text) &&
    !/(칩|타이틀|게임|설치|포함|드림|드립니다)/.test(text);
  const bodyWithMinorAccessoryOnly =
    /구성\s*[:：]?\s*(?:닌텐도\s*스위치\s*)?본체\s*(?:\+|plus)\s*(파우치|케이스|sd|필름)/.test(text) ||
    /본체\s*(?:\+|plus)\s*(파우치|케이스|sd\s*\d+|sd카드|필름|충전기|전원\s*선|전원선)\s*(판매|포함)?/.test(text) ||
    /(본체(?:\+|plus)파우치|본체(?:\+|plus)케이스|본체(?:\+|plus)sd|본체(?:\+|plus)필름|본체(?:\+|plus)충전기)/.test(dense);
  const liteBodyOnly =
    model.edition === "lite" &&
    /(구성품|구성).{0,24}본체|박스.{0,12}(없|x)|충전기.{0,12}(없|x)|충전기랑\s*케이스는\s*추가/.test(text);
  const liteBoxAndCharger =
    model.edition === "lite" &&
    /(박스.{0,16}충전기|충전기.{0,16}박스).{0,24}(같이|포함|드려|있)/.test(text);
  const allComponentsSignal =
    /(구성품|내용품).{0,18}(모두|전부|다|빠짐없이)|(?:모두|전부|다|빠짐없이).{0,18}(구성품|내용품)/.test(text);
  const switchFullHardware =
    model.platform === "nintendo_switch" &&
    /본체/.test(text) &&
    /조이콘|조이\s*콘/.test(text) &&
    /독/.test(text) &&
    /(충전기|어댑터|전원\s*선|전원선)/.test(text);
  const switchBodyWithCoreAccessories =
    model.platform === "nintendo_switch" &&
    /본체/.test(text) &&
    /조이콘|조이\s*콘/.test(text) &&
    /(충전기|어댑터|전원\s*선|전원선|그립)/.test(text) &&
    !/(독|풀박|풀박스|풀세트|풀구성)/.test(text) &&
    !/박스(?!\s*(없|x|미포함))/.test(text);
  const playstationFullHardware =
    model.platform === "playstation_5" &&
    /본체/.test(text) &&
    /(듀얼센스|패드|컨트롤러)/.test(text) &&
    /(박스|전원\s*선|전원선|hdmi|케이블|구성품)/.test(text);
  const bodyOnly = !liteBoxAndCharger && (
    /(본체만|본체\s*만|기기\s*단품|기기단품|본체\s*단품|본체단품|화면만|본체화면만)/.test(dense) ||
    bodyWithMinorAccessoryOnly ||
    liteBodyOnly ||
    switchBodyWithCoreAccessories
  );
  const fullSet =
    /(풀박|풀박스|풀세트|풀구성|박스포함|독\s*포함|조이콘\s*포함|듀얼센스\s*포함)/.test(text) ||
    sealedFullSet ||
    sealedDomesticBody ||
    allComponentsSignal ||
    switchFullHardware ||
    playstationFullHardware ||
    liteBoxAndCharger;
  const bodyConfig = bodyOnly ? "body_only" : fullSet ? "full_set" : bodySignal ? "unknown_body" : "unknown_body";

  const buying = /(매입|삽니다|구매합니다|구합니다|최고가|구매원함)/.test(text);
  if (buying) addReason("buying_signal");

  const damageSignal =
    /(커펌|밴\s*기기|ban\s*기기|고장|부품용|수리용|액정\s*파손|파손|불량|와이파이\s*에러|와이파이에러|걸쇠\s*이상|걸쇠이상|인식\s*불량|인식불량|충전\s*불량|충전불량)/.test(text);
  const negatedDamage =
    /(하자|불량|기스|파손|쏠림).{0,16}(없|없는|없습니다|전혀|아님|아닙니다)|(?:없|없는|없습니다|전혀).{0,16}(하자|불량|기스|파손|쏠림)/.test(text);
  const moddedOrDamaged = damageSignal && !negatedDamage;
  if (moddedOrDamaged) addReason("modded_or_damaged");

  const bodyAbsent = /본체\s*x|본체없|본체\s*없/.test(text);
  const lowPriceAccessory =
    price > 0 &&
    price < 30_000 &&
    /(케이스|실리콘\s*케이스|파우치|필름|스킨|그립캡|스틱\s*커버|스틱커버|터치펜|하우징|쉘)/.test(text);
  const hardAccessoryOnly =
    bodyAbsent ||
    dense.includes("본체케이스") ||
    lowPriceAccessory ||
    /(그립캡|스틱\s*커버|스틱커버|터치펜|하우징|쉘)/.test(text);
  const accessoryOnly =
    /(듀얼쇼크|조이콘|조이\s*콘|프로콘|컨트롤러|패드|독|충전기|케이블|케이스|파우치|거치대|그립캡|스틱\s*커버|스틱커버|터치펜|하우징|쉘).{0,16}(단독|만|판매|팝니다)|(?:단독|만|판매|팝니다).{0,16}(듀얼쇼크|조이콘|조이\s*콘|프로콘|컨트롤러|패드|독|충전기|케이블|케이스|파우치|거치대|그립캡|스틱\s*커버|스틱커버|터치펜|하우징|쉘)/.test(text) ||
    hardAccessoryOnly;
  const protectedBodyListing = bodySignal && !bodyAbsent && !hardAccessoryOnly;
  const effectiveAccessoryOnly = accessoryOnly && !bodyOnly && !protectedBodyListing;
  if (effectiveAccessoryOnly) addReason("accessory_only_signal");

  // 2026-05-17 (사용자 5-iteration #3): "디스크" 단독 매칭 제거 — PS5 본품 "디스크 에디션/디스크 버전" false positive 차단.
  // 게임 디스크는 "게임 디스크" / "디스크 N장" 같이 명시된 표현만 매칭. PS5/플스 본품 의미는 normal 유지.
  // 게임 title keyword 도 "에디션/한정판/콘솔/본체/풀세트" 결합 시 본품 (예: "스위치 OLED 동물의숲 에디션") → titleOnly 제외.
  const titleOnly =
    /(타이틀|칩|팩|소프트|게임\s*카드|게임카드|카트리지|cd).{0,16}(판매|팝니다|일괄|세트|종)|(?:판매|팝니다|일괄|세트|종).{0,16}(타이틀|칩|팩|소프트|게임\s*카드|게임카드|카트리지|cd)/.test(text) ||
    (/(?:게임\s*디스크|게임디스크|디스크\s*[1-9]\s*(?:장|개)|[1-9]\s*(?:장|개)\s*디스크)/.test(text) && !/(?:디스크\s*에디션|디스크\s*버전|디스크에디션|디스크버전)/.test(text)) ||
    /(nds|3ds|psp|ps\s*vita|ps2|ps3|ps4|ps5).{0,24}(게임|타이틀|소프트|cd)/.test(text) ||
    (/(포켓몬스터|파타퐁|트라이앵글\s*스트래티지|슈퍼마리오|젤다의\s*전설|몬스터헌터|동물의\s*숲|커비|스플래툰|마리오\s*파티|브라더스|레전드\s*za)/.test(text) && !/(에디션|한정판|콘솔|본체|풀세트|풀박스|풀구성)/.test(text));
  if (titleOnly && !bodySignal) addReason("game_title_signal");

  const bundleRisk =
    /(?:타이틀|칩|게임).{0,16}[2-9]\s*(?:개|종)|[2-9]\s*(?:개|종).{0,16}(?:타이틀|칩|게임)|일괄|묶음|게임\s*다수|게임다수/.test(text) ||
    /(본체).{0,32}(?:타이틀|칩|게임\s*칩|게임칩|게임\s*디스크|게임디스크).{0,16}[1-9]?\s*(?:개|종)?/.test(text) ||
    /(게임칩|게임\s*칩|타이틀|게임\s*디스크|게임디스크|게임\s*cd).{0,24}(포함|드림|드립니다|같이)/.test(text);
  if (bundleRisk) addReason("bundle_risk");

  let listingType: GameConsoleListingType = "unknown";
  if (buying) listingType = "buying";
  else if (moddedOrDamaged && model.model) listingType = "damaged_or_modded";
  else if (effectiveAccessoryOnly && price > 0 && price < 180_000) listingType = "accessory";
  else if (titleOnly && !bodySignal) listingType = "game_title";
  else if (bundleRisk && !bodyOnly) listingType = "multi_bundle";
  else if (model.model && bodySignal) listingType = "normal";
  else if (model.model && !bodySignal) listingType = "unknown";

  if (!model.model) addReason("unknown_model");
  if (!bodySignal) addReason("unknown_body");
  if (model.edition === "unknown_edition" || model.edition === "mixed_disc_digital") addReason("unknown_or_mixed_edition");
  if (model.edition === "switch_2") addReason("switch_2_owner_review_required");

  const comparableKey = listingType === "normal" && model.platform && model.edition
    ? [
        "game_console",
        model.platform,
        model.edition,
        bodyConfig,
      ].map(slug).join("|")
    : null;

  let parseConfidence = 0.35;
  if (model.platform) parseConfidence += 0.25;
  if (model.edition && model.edition !== "unknown_edition" && model.edition !== "mixed_disc_digital") parseConfidence += 0.2;
  if (bodySignal) parseConfidence += 0.12;
  if (bodyConfig !== "unknown_body") parseConfidence += 0.06;
  if (bundleRisk || moddedOrDamaged) parseConfidence -= 0.18;
  parseConfidence = Math.max(0, Math.min(1, Math.round(parseConfidence * 100) / 100));

  const needsReview =
    listingType !== "normal" ||
    !comparableKey ||
    parseConfidence < 0.72 ||
    bodyConfig === "unknown_body" ||
    model.edition === "unknown_edition" ||
    model.edition === "mixed_disc_digital" ||
    model.edition === "switch_2" ||
    bundleRisk;

  return {
    listingType,
    platform: model.platform,
    model: model.model,
    edition: model.edition,
    bodyConfig,
    bundleRisk,
    moddedOrDamaged,
    comparableKey,
    parseConfidence,
    needsReview,
    reasons,
  };
}
