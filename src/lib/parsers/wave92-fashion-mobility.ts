// Wave 92 (2026-05-15): shoe/bag/bike 카테고리 parser.
// 테크와 다른 결정 변수 — 사이즈/컨디션/era/사고이력이 가격 결정 핵심.
// 단순 모델 매칭만으론 시세 비교 불가능 → comparable_key 신규 설계.
//
// 정책:
// - 셀러 표기 grade는 1단계 깎아 인식 (셀러 항상 자기 매물 과대평가).
// - 사이즈 추출 못 하면 needs_review (사용자 체형/발 매칭 위험).
// - 자전거 사고/크랙은 즉시 reject (가격 시세 무의미).

import type { ParsedListingOptions, ConditionClass, ParseInput } from "@/lib/option-parser";
import {
  bunjangLabelToConditionClass,
  resolveConditionClass,
  conditionFromTextFashion,
  extractConditionClass,
  CONDITION_RANK,
} from "@/lib/option-parser";

// Wave 236f (2026-05-19): ParseInput type 통합 — option-parser 가 source of truth.
//   audit 발견: 두 별도 정의 → drift risk. 통합 import 로 fix.

// ─── 공통 헬퍼 ───────────────────────────────────────────────────────

export type ConditionTier = "s_grade" | "a_grade" | "b_grade" | "c_grade" | "reject" | null;

// 컨디션 표현 텍스트 → 정량 grade.
// 셀러 표기는 1단계 깎음 (관용적 인플레 보정).
// Wave 146-156: 신발 매물 흔한 표현 다수 추가.
// Wave 147: 객관 vs 셀러 주장 분리 (LAUNCH_PLAN §12b 강화).
// Wave 157 (2026-05-16): 모순 매물 처리 — 객관 S급 + 사용감 표현 같이 있으면 lower grade로.
//   - 검사 순서: reject → 박스만 손상 제외 → C → B → 객관 S → 셀러 표기 → A
//   - 박스 손상은 신발 자체 손상 X → reject 차단
export function parseConditionTier(text: string): ConditionTier {
  const t = text.toLowerCase();
  // 부적격 (reject) — 신발 자체 손상만 (박스만 손상은 제외)
  // Wave 157: "박스 (약간) 찌그러짐/손상" 등 박스만 손상은 reject 아님
  // Wave 166 (2026-05-17): negation 처리 + 디자인 의도 제외
  const isBoxOnlyDamage = /박스\s*(?:약간\s*)?(?:찌그러짐|손상)|박스\s*배송\s*손상|박스\s*컷|박스만\s*손상/.test(t);
  // negation 패턴 — "찢어짐 없습니다" / "구멍 없" / "크랙 없" 등
  const hasNegation = /(?:찢어짐|구멍|크랙|하자|손상)(?:이나|이|가|도)?\s*(?:눈에\s*띄는\s*큰\s*)?(?:없|x|X)|찢어짐\s*없|구멍\s*없|크랙\s*없|하자\s*없|손상\s*없|특별한\s*사용\s*하자는\s*없/.test(t);
  // 디자인 의도 — 통풍구멍/의도된 크랙/크랙이 가면
  // Wave 167: 한정판/에디션 크랙(스카치 디테일) / 셀러 등급 설명 (파손 오염등은)
  const isDesignIntent = /통풍\s*구멍|크랙이?\s*가면|크랙이?\s*가서|크랙이?\s*나면|소재\s*특성|소장\s*가치|한정판[가-힣\s,]*크랙|에디션[가-힣\s,]*크랙|크랙[가-힣\s,]*디테일|크랙[가-힣\s,]*있는\s*신발|디테일이?\s*있는\s*신발/.test(t);
  // 셀러 등급 설명 — "파손 오염등은 ... 확인" / "파손 오염 등은" (실제 하자 명시 아님)
  const isGradeExplanation = /파손\s*오염\s*등은?|파손[\s,]*오염[\s,]*등(?:은|이|을)?\s*(?:제품등급|사진|확인|등급)|제품등급|컨디션\s*등급|상태\s*등급\s*표|등급\s*관리/.test(t);
  if (!isBoxOnlyDamage && !hasNegation && !isDesignIntent && !isGradeExplanation && /파손(?!\s*오염\s*등)|크랙(?!\s*가)(?!\s*,?\s*스카치)|찢어짐|얼룩\s*심함|변색\s*심함|곰팡이|악취|냄새\s*심함|수리\s*필요|수선\s*필요|찌그러짐|변형\s*심함|밑창\s*벗겨|본드로\s*붙여|깔창\s*분실|내부\s*깔창\s*분실|튿어짐\s*있어서|찢어짐\s*있어서|가수분해|작은\s*구멍/.test(t)) return "reject";
  // Wave 157: 객관 S급 검사 전 C/B 신호 우선 — 모순 매물 (객관 S표현 + 사용감) 처리.
  // 사용감 명시되면 그게 더 신뢰 (LAUNCH_PLAN §12b precision).
  // Wave 168: 셀러 안전 disclaimer ("있을수 있으며 / 있을 수 있") 제외 — 매물 자체 상태 표현 아님
  // Wave 170: "얼룩 묻을까봐 ... 얼룩 하나 없" 같은 우려/부정 표현 추가
  const isSellerDisclaimer = /있을수?\s*있으?며|있을\s*수?\s*있\s*으니|있을\s*수?\s*있습니다|있을\s*수?\s*있고|있을\s*수?\s*있어요|중고상품\s*특성상.*있을|얼룩\s*묻을까봐|기스\s*날까봐|손상될까봐|찢어질까봐|얼룩\s*하나\s*없|얼룩\s*없고\s*깨끗|얼룩\s*없습니다/.test(t);
  // Wave 169: 기스 N 있 (변형) + 보풀 추가
  // Wave 170: 10회 미만 (명시 횟수 c급) / 부정 negation 추가
  const hasCSignal = !isSellerDisclaimer && /사용감(?:\s*있|\s*많|\s*좀\s*있|이?\s*많|은?\s*많|이?\s*있|은?\s*있)|착용감\s*있|약간의?\s*오염|얼룩(?!\s*(?:없|x|X|묻을까봐|하나\s*없))|스크래치|스크레치|기스\s*있|기스\s*[가-힣\s]{0,5}?있|코부위\s*기스|튿어짐|갈라짐|헤짐|로고\s*지워|많이\s*신|많이\s*사용|뒷굽\s*사용|밑창\s*닳|밑창\s*마모|뒤꿈치\s*닳|구멍\s*하나|보풀\s*있|보풀이?\s*있|신발끈\s*보풀|물\s*빠짐|생활\s*먼지|(?:^|[^0-9])[1-9][0-9]\s*회\s*미만\s*(?:으로?|착|신)|10\s*회\s*미만/.test(t);
  // 객관 S급 (s_grade) — 셀러 주장 아닌 객관 명시 신호 (kream 정품인증/택 부착 등)
  // Wave 157: 사용감 신호 없을 때만 s_grade 인정. 있으면 fall-through → C로 분류.
  if (
    !hasCSignal &&
    /미개봉|봉인|택\s*달[린림힌]|택\s*부착|택\s*그대로|택째\s*그대로|tag\s*on|tagon|박스컷|나코탭|kream\s*택|크림\s*택|크림\s*인증|풀박스\s*\+?\s*택|박스\s*\+?\s*택|박스\s*및\s*택째\s*그대로|박스째\s*그대로|택\s*있/.test(t)
  ) return "s_grade";
  // Wave 166: 명시 횟수 매물 우선 (모순 매물 처리)
  // "10번 정도 착용 + 거의 새상품" 같이 모순 표현에서 명시 횟수 (10번)가 더 정확.
  // 10+ 회 = c_grade, 4-9회 = b_grade를 셀러 표기보다 우선.
  const explicitHighCount = /(?:^|[^0-9])[1-9][0-9]\s*(?:번|회)\s*[가-힣\s]{0,5}?(?:신|착|입)/.test(t);
  if (explicitHighCount) return "c_grade";
  const explicitMidCount = /(?:^|[^0-9])[4-9]\s*(?:번|회)\s*[가-힣\s]{0,5}?(?:신|착|입)/.test(t);
  if (explicitMidCount) return "b_grade";
  // 셀러 표기 — 1단계 깎음
  if (/[sS]급|[sS]\s*그레이드|급[sS]급|특[sS]급|특[aA]급|최상급|탑급|s\+/.test(text)) return "a_grade";
  if (/[aA]급|[aA]\s*그레이드|상태\s*최상/.test(text)) return "b_grade";
  if (/[bB]급|[bB]\s*그레이드/.test(text)) return "c_grade";
  // A급 (거의 새거) — 셀러 주장 S급 + 실착 1-3회 / 한두번 / 시착만 / 사이즈 미스
  // Wave 150 추가: 새제품 단독, 1-2회 착용 변형
  if (
    /미사용|미착용|미시착|새상품(?!\s*[abc])|새제품|민트|한\s*번도\s*안\s*(신음|입음|멤|탐|사용|신|입|착)|신은?\s*적\s*없|신어\s*본?\s*적\s*없|신지\s*않은|신지를\s*않|착용해본\s*적\s*없|착용한\s*적\s*없|박스\s*그대로|박스채로|포장\s*그대로|포장\s*그대로|박스\s*개봉\s*안|풀박\s*새상품|보관만|예비용으로\s*구매|구입만\s*하고\s*보관|신상품|매장\s*정품|거의\s*(새|안\s*신|안\s*입|안\s*들|안\s*탐|새것|새신발)|1\s*[~-]?\s*2\s*번\s*(신|입|들|탐)|한\s*두?\s*번\s*(신|입|착)|한두번|시착\s*(만|함)|시신음|착용\s*해?\s*본다고|사이즈\s*(미스|실패|안\s*맞|틀|가\s*안\s*맞)|실착\s*[1-3]\s*회|단\s*[1-3]\s*회|구매\s*후\s*[1-3]\s*회|보관용|잠깐\s*(신|착용|시\s*신|밖에\s*안)|1\s*회\s*시착|1\s*회\s*착용|[1-3]\s*회\s*착용|1\s*[~-]\s*[2-3]\s*회\s*착용|1\s*번\s*(신|착)|2\s*번\s*(신|착)|3\s*번\s*(신|착)|두\s*번\s*신|세\s*번\s*신|선물용으로\s*받|실내에서만\s*신|집에서만\s*신어|집에서만\s*신음|구매\s*후\s*[1-7]\s*일|발에\s*너무\s*맞지\s*않|선물받|박스\s*및\s*택째\s*그대로\s*보관|마음에\s*들지\s*않아\s*판매|시착\s*[1-3]\s*회|시착\s*[~-]?\s*[1-3]\s*회|잠깐[가-힣\s]{0,5}?(신|착|입)|잘\s*안\s*(?:신|입|착)|안\s*신는|몇\s*회\s*(?:안|미만)\s*(?:신|착|입)|안\s*신게\s*되|드물게\s*신|커서\s*팔|작아서\s*판매|크림에서?\s*구매[가-힣\s]{0,10}?시착|두세번\s*실착|두\s*세\s*번\s*(?:신|착|입)|두세번\s*(?:신|착|입)|[1-3]\s*회\s*사용|거의\s*신지\s*않|거의\s*신은\s*적\s*없|한번?밖에\s*안\s*(?:신|입|착)|딱\s*한번?밖에\s*안\s*(?:신|입|착)|시착했|시신했|안\s*신어서\s*처분|안\s*신어서\s*판매|안\s*입어서\s*판매|안\s*입어서\s*처분|길들이기\s*위해\s*실내에서|[1-5]\s*번\s*(?:신|착|입)\b|[1-5]\s*번\s*실착|[1-3]\s*회\s*미만\s*시착|헬스장에서만\s*(?:신|착)|실내에서만\s*신었|많이\s*안\s*(?:신|착|입|했)|단시간\s*(?:신|착|입|착용)|단기간\s*(?:신|착|입|착용)|밖에서는\s*착용\s*안|밖에서\s*안\s*신|단\s*N?\s*시간\s*착용|별로\s*안\s*(?:신|착|입|입었|신었)|10?\s*번\s*안으로\s*신|착용\s*횟수\s*적|미품\s*상태|사용감\s*:\s*거의\s*없|손이\s*잘\s*안\s*가|손이\s*가질\s*않|아치핏\s*인솔로\s*교체|인솔로\s*교체|10\s*번\s*이내로?\s*착|10\s*번\s*이내|[1-9]\s*번\s*신고\s*나갔|어느\s*순간\s*안\s*신|손이\s*잘\s*안\s*가\s*서|오죽\s*안\s*(?:신|입|착)|오죽\s*안\s*신음|자주신지\s*않/.test(t)
  ) return "a_grade";
  // Wave 150 정정: C 먼저 검사 (specific 우선). 같은 매물에 "굽 슈구칠 + 거의 그대로" 있으면 C 우선.
  // C급 (사용감 많음): 사용감 있/오염/스크레치/10회+ 착용
  if (
    /사용감\s*있|사용감\s*좀\s*있|사용감\s*많|사용감이\s*많|사용감은\s*많|사용감\s*많음|사용감(?:은|이|도)\s*있|얼룩과\s*사용감|적당한\s*얼룩|적당한\s*사용감|착용감\s*있|착용감\s*많|착용감\s*좀\s*있|많이\s*사용|많이\s*신|보풀|색바램|변색|황변|미세\s*황변|약간의?\s*오염|약간의?\s*얼룩|약간의?\s*스크\w*|앞코\s*스크\w*|미드솔\s*오염|밑창\s*닳|밑창\s*마모|(?:^|[^0-9])[1-9][0-9]\s*회\s*[가-힣\s]{0,5}?(신|착|입)|발자국|기스\s*있|스크래치|스크레치|굽\s*닳|굽이\s*닳|굽\s*마모|굽\s*슈구|슈구\s*칠|사용\s*흔적|뒤꿈치\s*닳|(?:가죽|앞코|뒤꿈치|밑창|매쉬|어퍼|바닥|내부)[가-힣\s]{0,12}?(?:까짐|갈라짐|튿어짐|찢어짐|헤짐)|(?:가죽|앞코|뒤꿈치|매쉬|어퍼)[가-힣\s]{0,12}?해짐|매쉬\s*닳|로고\s*지워|로고\s*지웠|먼지가\s*조금\s*묻|약간의\s*까짐|까짐\s*조금|까짐\s*있|튿어짐|튿어짐\s*있|갈라짐|경련변화|사용있|사용\s*있\s*습|뒷굽\s*사용|뒷굽\s*쪽\s*사용|밑창\s*지저분|발\s*까진|뒷꿈치\s*닳음|굽\s*쪽\s*사용|헤짐\s*일부|헤짐\s*있|기스나\s*자국|이염|쓸린자국|쓸린\s*자국|뜯김|뜯어짐|사용감\s*꽤\s*있|사용감\s*약간\s*있|사용감\s*존재|약간의?\s*사용감|앞부븐\s*약간의\s*사용감|약간의\s*뜯김|뒷꿈치[가-힣\s]{0,12}?(?:까짐|닳|마모)|뒷꿈치쪽만\s*조금\s*까졌|밑창\s*닦|밑창\s*닦았|신발\s*안쪽\s*튿어|생활오염|생활\s*오염|오염\s*살짝\s*존재|사용감(?:도|은|이)\s*많|일년\s*신|1\s*년\s*신|일년\s*착|1년\s*착|핌\s*있|핌이\s*있|핌\s*제거|조금\s*오염|손세탁|에이징\s*시켜|10\s*회\s*정도\s*(?:신|착|입)|실제\s*착용\s*10\s*회|단순\s*쓸림|아치핏\s*인솔로/.test(t)
  ) return "c_grade";
  // B급 (사용감 적음): 4-9회 단독 착용 / 상태 양호 / 컨디션 좋 / 9-10/10
  if (
    /사용감\s*적|약간\s*사용|잔기스|컨디션\s*좋|상태\s*양호|상태양호|상태\s*좋|상태좋|상태\s*우수|컨디션\s*우수|상태\s*괜찮|상태괜찮|상태\s*가\s*좋|excellent|excellent\s*condition|9\s*\/\s*10|10\s*\/\s*10|9[5-9]\s*%\s*수준|95\s*%\s*수준|(?:^|[^0-9])[4-9]\s*회\s*[가-힣\s]{0,5}?(신|착|입)|깨끗|깔끔|관리\s*잘|사용감\s*거의\s*없|사용감\s*없|마모\s*없|마모\s*거의\s*없|기스\s*없|기스\s*거의\s*없|외관\s*깨끗|외부\s*깨끗|상태\s*깨끗|상태\s*완전\s*좋|상태\s*정말\s*좋|상태\s*전반\s*양호|전반\s*양호|전반적으로\s*[가-힣\s]{0,8}?좋|상태\s*매우\s*좋|상태\s*아주\s*좋|거의\s*그대로|거이\s*그대로|쿠션감\s*좋|착화감\s*좋|착용감\s*좋|상태(?:는|이|가|도|만|도)\s*좋|상태\s*는\s*좋|컨디션(?:는|이|가|도)\s*좋|상태(?:는|이|가|도)?[가-힣\s]{0,5}?좋|사용감\s*별로\s*없|사용감\s*거의\s*없|상태\s*훌륭|상태\s*매우\s*훌륭|상태아주좋|단시간\s*착용해서\s*상태|굽\s*까짐\s*거의\s*없|굽\s*안\s*닳|굽까짐은\s*거의없|상태\s*매우\s*좋은\s*편|상태\s*아주\s*좋은\s*편/.test(t)
  ) return "b_grade";
  return null;
}

// ─── 신발 ────────────────────────────────────────────────────────────

// 신발 사이즈 추출 (220~309mm). 부적격: 진짜 키즈/유아 (130~215).
// Wave 137 (2026-05-16): UK 사이즈 → mm 변환 추가.
// Wave 138 (2026-05-16): 사이즈 범위 220~309 확장 (여성 220/225 일반 사이즈).
export function parseShoeSizeMm(text: string): number | null {
  // "270mm", "270 사이즈", "사이즈 270", "270" (3자리 숫자)
  // 진짜 키즈 차단: 130~215 범위는 제외 (220+는 여성 일반)
  const patterns: RegExp[] = [
    /(?:사이즈|size|싸이즈)\s*[:\-]?\s*(2[2-9]\d|30\d)(?!\d)/i,
    /(2[2-9]\d|30\d)\s*(?:mm|사이즈|size|싸이즈)/i,
    /\b(2[2-9]\d|30\d)\b(?![\d.])/, // bare 3-digit
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const n = Number(m[1]);
      if (n >= 220 && n <= 309) return n;
    }
  }
  // Wave 137: UK 사이즈 → mm 변환 (닥마식 기준, ±10mm 오차 OK)
  // UK 3=220, UK 4=230, UK 5=240, UK 6=250, UK 7=260, UK 8=270, UK 9=280, UK 10=290, UK 11=300
  // 정수 UK만 — 6.5, 7.5 등 부동소수점은 무시 (정확도 우선)
  // 명시 anchored: "UK 6", "UK6", "uk6" (반드시 "uk" 다음 정수)
  const ukMatch = text.match(/(?:^|[^a-z0-9])uk\s*([3-9]|1[0-2])(?![\d.])/i);
  if (ukMatch) {
    const uk = Number(ukMatch[1]);
    const UK_TO_MM: Record<number, number> = {
      3: 220, 4: 230, 5: 240, 6: 250, 7: 260,
      8: 270, 9: 280, 10: 290, 11: 300, 12: 310,
    };
    const mm = UK_TO_MM[uk];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
  }
  // Wave 138: cm 표기 → mm 변환 (예: "26cm" → 260, "25.5cm" → 255)
  // 230~309mm 범위만 (23~30.9cm)
  const cmMatch = text.match(/\b(2[2-9](?:\.\d)?|30(?:\.\d)?)\s*cm\b/i);
  if (cmMatch) {
    const cm = Number(cmMatch[1]);
    const mm = Math.round(cm * 10);
    if (mm >= 220 && mm <= 309) return mm;
  }
  // Wave 139 (2026-05-16): EU 사이즈 → mm 변환 (어그/닥마/유럽 브랜드 매물 흔함)
  // 35-46 → 220-300mm. 명시 "EU 38" / "eu39" / "유로 40" 또는 어그 매물 "(35)" 같은 단독 표기.
  // 보수적: "EU" prefix 있을 때만 (false positive 차단). 단독 35-46은 미국/유럽 미구분.
  const euMatch = text.match(/(?:eu|유로|유럽|europe)\s*(3[5-9]|4[0-6])\b/i);
  if (euMatch) {
    const eu = Number(euMatch[1]);
    const EU_TO_MM: Record<number, number> = {
      35: 220, 36: 230, 37: 235, 38: 240, 39: 245,
      40: 250, 41: 260, 42: 265, 43: 275, 44: 280, 45: 285, 46: 290,
    };
    const mm = EU_TO_MM[eu];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
  }
  // Wave 139: US 사이즈 → mm 변환 (보수적 unisex 매핑, "US" prefix 명시 필요)
  // US 5-13 → mm. 남/녀 미구분 = 남성 기준 (정확도 우선, ±10mm 오차 받아들임).
  const usMatch = text.match(/(?:us|미국)\s*([5-9]|1[0-3])\b/i);
  if (usMatch) {
    const us = Number(usMatch[1]);
    const US_TO_MM: Record<number, number> = {
      5: 230, 6: 240, 7: 250, 8: 260, 9: 270,
      10: 280, 11: 290, 12: 300, 13: 310,
    };
    const mm = US_TO_MM[us];
    if (mm !== undefined && mm >= 220 && mm <= 309) return mm;
  }
  return null;
}

// 신발 박스/영수증 상태.
export function parseShoeBoxStatus(text: string): "with_box" | "without_box" | "box_only" | null {
  const t = text.toLowerCase();
  if (/박스만|box\s*only/.test(t)) return "box_only";
  if (/박스\s*(없음|x|없)/.test(t)) return "without_box";
  if (/풀박|풀\s*박스|박스\s*포함|박스있/.test(t)) return "with_box";
  return null;
}

function parseShoeOptions(text: string) {
  const sizeMm = parseShoeSizeMm(text);
  const conditionTier = parseConditionTier(text);
  const boxStatus = parseShoeBoxStatus(text);
  // 키즈/유아 사이즈 오염 차단
  const isKids = /\b(키즈|유아|아동|td|ps|kids|toddler)\b/i.test(text);
  return { sizeMm, conditionTier, boxStatus, isKids };
}

// ─── 가방 ────────────────────────────────────────────────────────────

export type BagEra = "vintage" | "current" | null;

// 빈티지 식별 — datecode/연도/세기 키워드.
// 빈티지 vs 현행 가격대 매우 다름 (LV 스피디 25: 빈티지 40~90만 / 현행 150만+).
export function parseBagEra(text: string): BagEra {
  const t = text.toLowerCase();
  // 명시 빈티지
  if (/빈티지|vintage|올드|구형|구\s*모델/.test(t)) return "vintage";
  // 연도 — 2010년 이전 또는 90~00년대 명시
  if (/(199\d|200\d)\s*년|90년대|00년대|1990s|2000s/.test(t)) return "vintage";
  // LV datecode (3~4자리 영문+숫자, "VI", "SR", "AR" 등 옛 코드)
  if (/datecode|date\s*code|시리얼\s*[A-Z]{2}\d{4}/i.test(text)) return "vintage";
  // 명시 현행
  if (/현행|신상|최신|신모델|new\s*model/.test(t)) return "current";
  return null; // 불명 → 시세 비교 시 두 그룹 합치지 않음 (low confidence)
}

// 가방 사이즈 변형.
export function parseBagSizeVariant(text: string): string | null {
  // 스피디 25/30/35 같은 명시 사이즈
  const numSize = text.match(/\b(20|22|24|25|26|28|30|32|35|40)\b(?!\s*(원|만|기가|gb))/i);
  if (numSize) return numSize[1];
  // 영문 사이즈
  const wordMap: Record<string, string> = {
    "미니": "mini", "mini": "mini", "초미니": "nano",
    "스몰": "small", "small": "small", "small size": "small",
    "미디움": "medium", "medium": "medium", "medium size": "medium",
    "라지": "large", "large": "large",
    "맥시": "maxi", "max": "maxi",
    "pm": "pm", "mm": "mm", "gm": "gm",  // LV 사이즈 코드
    "bb": "bb",
  };
  const t = text.toLowerCase();
  for (const [k, v] of Object.entries(wordMap)) {
    if (new RegExp(`\\b${k}\\b`, "i").test(t)) return v;
  }
  return null;
}

function parseBagOptions(text: string) {
  const era = parseBagEra(text);
  const sizeVariant = parseBagSizeVariant(text);
  const conditionTier = parseConditionTier(text);
  // 가품 의심
  const fakeFlags = /미러|짭|짝퉁|이미테이션|복각|오라리|미러급|sa급/i.test(text);
  return { era, sizeVariant, conditionTier, fakeFlags };
}

// ─── 자전거 ──────────────────────────────────────────────────────────

// 프레임 사이즈 — 가장 중요한 가격/매칭 결정 변수.
// cm, 인치, S/M/L/XL 모두 처리.
export function parseBikeFrameSize(text: string): string | null {
  // 명시 cm 사이즈 (예: "54cm 프레임", "프레임 사이즈 54")
  const cm = text.match(/(?:프레임|frame)?\s*(?:사이즈|size)?\s*[:\-]?\s*(4[2-9]|5[0-9]|6[0-2])\s*(?:cm|센티)/i);
  if (cm) return `${cm[1]}cm`;
  // 인치 (MTB)
  const inch = text.match(/(\d{2}(?:\.5)?)\s*(?:인치|"|inch|in)\b/i);
  if (inch) {
    const n = Number(inch[1]);
    if (n >= 13 && n <= 29) return `${n}in`;
  }
  // 영문 사이즈
  const word = text.match(/\b(XS|S|M|L|XL|XXL)\s*(?:사이즈|size|프레임|frame)?\b/);
  if (word) return word[1].toUpperCase();
  return null;
}

// 사고/크랙 이력. 명시되면 reject.
export function parseBikeCrashHistory(text: string): "no_crash" | "crash" | null {
  const t = text.toLowerCase();
  if (/사고|크랙|crack|프레임\s*깨|도색만|도색\s*함|넘어진|넘어짐|충격|박살/.test(t)) return "crash";
  if (/무사고|사고\s*없음|크랙\s*없|단순\s*변속|새차/.test(t)) return "no_crash";
  return null;
}

// 년식 추출. 5년 이상 → older (가격 ↓).
export function parseBikeYearTier(text: string, nowYear: number = 2026): "recent" | "mid" | "older" | null {
  // "2023년식", "23년식", "2022 모델"
  const m = text.match(/(?:^|\D)(20[12]\d|2026)\s*(?:년|모델|식)/);
  if (m) {
    const year = Number(m[1]);
    const age = nowYear - year;
    if (age <= 2) return "recent";
    if (age <= 5) return "mid";
    return "older";
  }
  return null;
}

function parseBikeOptions(text: string) {
  const frameSize = parseBikeFrameSize(text);
  const conditionTier = parseConditionTier(text);
  const crashHistory = parseBikeCrashHistory(text);
  const yearTier = parseBikeYearTier(text);
  // 부품 단품 차단
  const partsOnly = /프레임만|포크만|휠셋만|안장만|스템만|드레일러만/.test(text);
  return { frameSize, conditionTier, crashHistory, yearTier, partsOnly };
}

// Wave 236 (2026-05-19): product-type 추출 — 근본 fix.
//   문제: catalog SKU 가 brand+모델 level → 같은 brand 의 다른 product-type (후드/맨투맨/티/자켓/바지)
//     매물이 한 sku_id 매칭 → 사용자 reveal 비교군에 다른 product-type 다 섞임.
//   사용자 코멘트 22건 중 17건 동일 패턴 ("후드티랑 맨투맨 다른거 아닌가" / "지갑이랑 벨트 모자 ㅋㅋㅋ").
//
//   fix: parser 가 product-type 추출 → comparable_key 에 추가 → 시세 daily 자동 분리.
//   카테고리별 우선순위 (먼저 매칭되는 거):
//     clothing: hoodie / crewneck / tee / shirt / jacket / coat / down_jacket / pants / jeans /
//               shorts / dress / cap / belt / wallet / cardigan / vest / knit / polo_shirt
//     bag: backpack / shoulder / tote / crossbody / waist / clutch / messenger / duffle / wallet / pouch
//     shoe: 이미 catalog SKU level 에서 product-type 거의 분리됨 → 추출은 하되 critical X
//   매칭 못 함 = "type_unknown" 박힘 (시세 비교 약하지만 일관성 유지).
type ClothingProductType =
  | "hoodie"
  | "crewneck"
  | "tee"
  | "shirt"
  | "polo_shirt"
  | "jacket"
  | "coat"
  | "down_jacket"
  | "pants"
  | "jeans"
  | "shorts"
  | "skirt"
  | "dress"
  | "cap"
  | "belt"
  | "wallet"
  | "cardigan"
  | "vest"
  | "knit"
  | "type_unknown";

type BagProductType =
  | "backpack"
  | "shoulder"
  | "tote"
  | "crossbody"
  | "waist"
  | "clutch"
  | "messenger"
  | "duffle"
  | "wallet"
  | "pouch"
  | "card_holder"
  | "type_unknown";

type ShoeProductType =
  | "sneaker"
  | "boot"
  | "sandal"
  | "loafer"
  | "slipper"
  | "type_unknown";

function parseClothingProductType(text: string): ClothingProductType {
  const t = text.toLowerCase();
  // Wave 254.6 (2026-05-20) — 우선순위 정정 (사용자 발견 root cause):
  //   기존: down_jacket 모델명 (눕시/nuptse) 가 shorts 보다 먼저 매칭 →
  //     pid 331382713 "빔즈 노스페이스 눕시 쇼츠" → down_jacket 잘못.
  //   systemic 사례:
  //     - clothing-tnf-nuptse-1996 + 쇼츠 (model = down_jacket, 매물 = shorts)
  //     - clothing-tnf-purple-label + 쇼츠
  //     - clothing-tnf-supreme-collab + 모자
  //     - clothing-polo-rrl-denim + 쇼츠
  //   fix: product_type 명시 키워드 (쇼츠/모자/벨트/지갑/원피스/스커트/팬츠/jeans) 가 모델명 기반 패턴보다 먼저.
  //   기존 패턴 모두 유지 — 순서만 변경 (additive, 비파괴).
  //
  // ── PRIORITY 1: 명시적 product_type 키워드 (모델명과 충돌 가능) ──
  // shorts — "눕시 쇼츠" / "마운틴 쇼츠" / "RRL 쇼츠" 등 (down_jacket/jacket/jeans 모델명 + 쇼츠 매물).
  // Wave 268 (2026-05-20): 배기스 / baggies (파타고니아 쇼츠) / 5인치 / 7인치 (사이즈 표기 = 쇼츠) 보강.
  if (/반바지|쇼츠|shorts\b|버뮤다|bermuda|배기스|baggies|5\s?인치|7\s?인치|5인치|7인치/.test(t)) return "shorts";
  // dress — "원피스" 단독 (셔츠 등과 다름).
  if (/원피스|dress\b|드레스(?!\s*셔츠)|미니 ?원피스|롱 ?원피스/.test(t)) return "dress";
  // skirt.
  if (/스커트|skirt/.test(t)) return "skirt";
  // cap/hat — "Supreme 모자" / "TNF 모자" 등 (collab brand 모자).
  //   Wave 254.6: 기존 "모자\b" 패턴 bug 정정 — JavaScript \b 가 Korean 한글 매칭 안 됨
  //   ("모자" 단독 / "모자가" / "모자에" 매칭 실패). fix: bare "모자" (자켓에 모자 부속 등 false positive 낮음).
  //   "모자이크/모자보호" 등 false positive 차단 — 명시적 negative lookahead.
  // Wave 264 (2026-05-20): 캡모자/베이스볼 캡/풋볼캡 보강 — 사용자 발견 type_unknown 매물.
  if (/볼캡|ball ?cap|야구모자|버킷햇|bucket hat|벙거지|비니|beanie|메쉬캡|메쉬 ?캡|트러커 ?캡|trucker cap|cap\b|모자(?!이크|보호)|스냅백|snapback|캡모자|베이스볼 ?캡|baseball ?cap|풋볼 ?캡|football ?cap|6 ?패널/.test(t)) return "cap";
  // belt — "Supreme 벨트" / "Polo RRL 벨트" 등.
  if (/벨트|belt\b/.test(t)) return "belt";
  // wallet — "콘초 월렛" / "장지갑" 등.
  if (/지갑|wallet|반지갑|장지갑|카드지갑|머니 ?클립|콘초 ?월렛|콘초 ?지갑/.test(t)) return "wallet";
  // jeans — 청바지 명시 (데님 팬츠보다 specific).
  // Wave 264: "워싱진/슬림내로우 진/데님 와이드/와이드 진" 보강 (RRL/TNF Purple Label sample 발견).
  if (/청바지|진(?:즈)?\b|jean(?:s)?\b|데님 ?팬츠|데님 ?진|denim ?jean|빈파포|빈티지 ?파이브 ?포켓|파이브 ?포켓|five ?pocket|5 ?포켓|5-pocket|기빈스|미드랜드|이스트웨스트|힐스뷰|에이버리|키팅진|워싱진|슬림 ?내로우 ?진|슬림내로우 ?진|데님 ?와이드|와이드 ?진|데님 ?스트레이트|스트레이트 ?진/.test(t)) return "jeans";
  // pants — "RRL 데님 팬츠" 등 (jeans 보다 narrow 한 데님은 위에서 잡힘).
  if (/팬츠|pants\b|바지(?!\s*받침)|trouser|치노|chino|슬랙스|slacks|조거|jogger|카고|cargo|트랙 ?팬츠|track ?pants|카펜터|carpenter|워크팬츠|workwear ?pants/.test(t)) return "pants";

  // ── PRIORITY 2: 모델명 기반 / 일반 product_type 키워드 ──
  // down jacket — 눕시 / 푸퍼 / 다운 라이너 등.
  if (/패딩|다운 ?재킷|다운 ?자켓|down ?jacket|푸퍼|puffer|nano puff|nanopuff|구스다운|덕다운|눕시|nuptse|다운 ?베스트|다운 ?베어|다운 ?재킷|다운 ?파카|down ?parka/.test(t)) return "down_jacket";
  if (/코트(?!\s*디테일)|coat\b|trench|트렌치|체스터필드|chesterfield|피코트|peacoat|카코트|발마칸|balmacaan|울 ?코트/.test(t)) return "coat";
  // Wave 264: 가디건 (한글 변형) 추가.
  if (/카디건|cardigan|가디건|니트 ?집업|knit ?zip/.test(t)) return "cardigan";
  // Wave 236b: 터틀넥/폴라넥/모크넥 추가.
  if (/니트(?!\s*집업)|knit(?! ?zip)|스웨터|sweater|터틀넥|turtleneck|폴라넥|모크넥|mockneck|crewneck ?knit/.test(t)) return "knit";
  if (/조끼|베스트(?!\s*조끼)|vest\b|gilet/.test(t)) return "vest";
  if (/플리스|fleece|레트로 ?x|retro ?x|덴알리|denali|숄카라|숄 ?카라|shawl/.test(t)) return "jacket"; // 플리스/베스트 자켓 류
  // Wave 236b: windbreaker/바람막이/아노락/안타르티카/마운틴 라이트 등 자켓 류.
  // Wave 264: 윈드러너/스팁 테크/패딩 자켓 보강 (TNF Supreme collab).
  // Wave 266 (2026-05-20): 베이스볼 저지/야구점퍼/바시티 자켓/코치자켓/하드쉘/소프트쉘/푸퍼 자켓 보강.
  //   번개장터 sweep 발견 — BAPE 베이스볼 저지/베이프 야구점퍼/Stussy varsity 등 jacket 잘못 분류.
  //   하드쉘/소프트쉘 (아크테릭스 변형) / 푸퍼 자켓 (다운자켓 위에서 잡힘) / 패딩베스트 (이미 vest)
  if (/자켓|재킷|jacket|아노락|anorak|봄버|bomber|블레이저(?!\s*미드)|윈드 ?브레이커|windbreaker|바람막이|마운틴 ?라이트|mountain ?light|마운틴 ?파카|mountain ?parka|마운틴 ?자켓|mountain ?jacket|트랙 ?탑|track ?top|트랙수트|tracksuit|덱 ?자켓|deck ?jacket|쉴드|shield|윈드러너|windrunner|스팁 ?테크|steep ?tech|패딩 ?자켓|padded ?jacket|베이스볼 ?저지|baseball ?jersey|야구 ?점퍼|야구점퍼|바시티|varsity|코치자켓|코치 ?자켓|coach ?jacket|하드쉘|hardshell|소프트쉘|softshell|sherpa ?자켓|셰르파 ?자켓|레터맨|letterman|스타디움 ?자켓|stadium ?jacket|MA-1|ma-1|MA1\b/.test(t)) return "jacket";
  if (/후드(?!\s*티 ?셔츠)|후디|hoodie|hooded sweat/.test(t)) return "hoodie";
  if (/맨투맨|크루넥|crewneck|sweatshirt|스웻 ?셔츠|스웻\(맨투맨\)|풀오버(?!\s*조끼)|스웻 ?셔트|sweat ?shirt/.test(t)) return "crewneck";
  // Wave 269c (2026-05-20): 긴팔 / 반집업 / 1/4 zip 추가 (API sweep — 아크네/스튜시 매물 type_unknown).
  //   반집업/half zip = pullover style jacket (Patagonia Better Sweater 등).
  if (/롱슬리브|long sleeve|롱 ?티|장 ?티|long sleeved|긴팔|long ?sleeve\b/.test(t)) return "tee"; // 롱슬리브/긴팔 = tee 류
  if (/반집업|반 ?집업|half ?zip|1\/?4 ?zip|쿼터 ?집업|쿼터 ?지퍼|1\/?4 ?집업|풀오버 ?집업/.test(t)) return "jacket";
  // Wave 269d (2026-05-20): "기모 집업/풀집업/집업" 단독 (니트 집업/반집업/카디건이 위에서 캐치된 후).
  if (/기모 ?집업|풀집업|풀 ?집업|집업(?!\s*가능)|zip ?up/.test(t)) return "jacket";
  // Wave 236b: 반팔 단독 + 탱크탑/민소매 추가.
  // Wave 264: 블라우스 추가 (acne-apparel sample 발견).
  if (/티 ?셔츠|tee\b|반팔 ?티|반팔티|t-shirt|tshirt|t ?셔츠|반팔(?!\s*티 ?셔츠)|탱크 ?탑|tank ?top|민소매|sleeveless|반 ?소매|블라우스|blouse/.test(t)) return "tee";
  // Wave 254.6: polo_shirt lookahead group bug fix — `(?!\s*rrl|랄프)` 의 alternation
  //   파싱: `\s*rrl` OR `랄프` (모두 from 같은 시작점). 실제는 `\s*rrl|랄프` 가 `\s*` 만 첫 번째에 적용.
  //   "폴로 랄프로렌" → 폴로 + 공백 + 랄프 → 폴로 match 후 lookahead "\s*rrl|랄프" 검사 →
  //     "\s*rrl" 공백 0~N + "rrl" 안 맞음 / "랄프" 위치는 ' '에서 시작 ≠ '랄' → 둘 다 fail → polo_shirt match (잘못).
  //   fix: (?:\s*rrl|\s*랄프|옥스포드|oxford|셔츠) — 그룹화 + 옥스포드 셔츠/shirt 제외.
  if (/폴로(?!\s*(?:rrl|랄프|옥스포드|oxford|셔츠))|polo shirt|폴로 ?티|피케 ?폴로|피케 ?셔츠|pique/.test(t)) return "polo_shirt";
  // Wave 236b: 남방 추가.
  if (/셔츠(?!\s*ZIP)|shirt(?! sleeve)|남방|button ?up|버튼 ?다운|button ?down|옥스포드 ?셔츠|oxford ?shirt/.test(t)) return "shirt";
  return "type_unknown";
}

function parseBagProductType(text: string): BagProductType {
  const t = text.toLowerCase();
  // Wave 254.6 (2026-05-20) — accessory 우선순위 강화 + Borealis/Big Shot 모델명 false positive 차단.
  //   사용자 발견 사례: "Borealis 키링" → backpack 잘못. 모델명 단독 매칭 risk.
  //   기존 패턴 유지 — accessory keyword 더 명확히 top, backpack 모델명은 backpack/배낭 키워드 동반 시만.
  //
  // ── PRIORITY 1: accessory (지갑/파우치/카드지갑) — 모델명 충돌 차단 ──
  if (/카드지갑|반지갑|머니 ?클립|card ?holder|card ?case|카드 ?케이스|콘초 ?지갑/.test(t)) return "card_holder";
  if (/장지갑|long wallet|월렛|지갑(?!\s*케이스)|wallet\b|포켓 ?오거나이저|pocket ?organizer|콘초 ?월렛/.test(t)) return "wallet";
  if (/파우치|pouch|미니 ?파우치|cosmetic|화장품 ?파우치|포쉐트|pochette/.test(t)) return "pouch";
  if (/클러치|clutch/.test(t)) return "clutch";
  // Wave 254.6: 키링/스트랩/참 등 액세서리 단독 → type_unknown (backpack 모델명 false positive 차단).
  if (/^\s*(?:키링|key ?ring|스트랩|strap|참|charm|네임 ?태그|name ?tag)\s*$|^\s*[가-힣A-Za-z0-9\s]*\s+(?:키링|key ?ring|스트랩|strap|참|charm)\s*$/.test(t)) return "type_unknown";

  // ── PRIORITY 2: 형태 명시 (메신저/더플/허리/숄더 등) ──
  if (/메신저|messenger/.test(t)) return "messenger";
  if (/더플|duffle|duffel|보스턴 ?백|boston ?bag|여행 ?가방|트래블/.test(t)) return "duffle";
  // Wave 268 (2026-05-20): Mantis Waistpack / 웨이스트팩 (Arc'teryx 모델) 보강 + 크로스 슬링 보강.
  if (/웨이스트|허리|힙색|waist ?bag|waist ?pack|웨이스트 ?팩|fanny ?pack|벨트 ?백|fanny|슬링 ?백|sling ?bag|sling\b|보레알리스 ?슬링|borealis ?sling|mantis ?2|mantis ?waist|만티스 ?웨이스트/.test(t)) return "waist";
  // shoulder — 호보백/버킷백/체인백 추가.
  if (/숄더|shoulder ?bag(?!\s*backpack)|어깨 ?가방|호보 ?백|hobo ?bag|hobo\b|버킷 ?백|bucket ?bag|체인 ?백|chain ?bag|chain ?미니/.test(t)) return "shoulder";
  // crossbody — 카메라백/미니체인백/사이드백.
  if (/크로스(?!\s*?백 ?팩)|crossbody|cross ?bag|크로스 ?백(?!팩)|카메라 ?백|camera ?bag|사이드 ?백|side ?bag/.test(t)) return "crossbody";
  // tote — 탑핸들/핸드백.
  // Wave 266 (2026-05-20): 캔버스 백 / 토트 백 영문 / 빈티지 토트 보강.
  // Wave 267b (2026-05-20): 토드백/japanese bag/재패니즈/명품 쇼핑백 보강 (API sweep 발견).
  // Wave 268 (2026-05-20): 서류 가방/비즈니스 백/세컨 백/세컨드 백/포트폴리오/도큐먼트 케이스 보강 (API sweep).
  // Wave 269 (2026-05-20): PVC 백 (CDG/구찌 콜라보) + 라피아 백 / 스트로 백 (여름 토트) 보강.
  if (/토트|tote\b|쇼퍼|shopper|탑 ?핸들|top ?handle|핸드 ?백|handbag|캔버스 ?백|canvas ?bag|마트 ?백|쇼핑 ?백|토드 ?백|todd ?bag|재패니즈 ?백|japanese ?bag|명품 ?쇼핑백|쇼핑백|서류 ?가방|서류 ?백|business ?bag|비즈니스 ?백|세컨 ?백|세컨드 ?백|포트폴리오 ?백|portfolio ?bag|도큐먼트 ?케이스|document ?case|브리프 ?케이스|briefcase|pvc ?백|pvc ?bag|투명 ?백|투명 ?가방|라피아 ?백|raffia|스트로 ?백|straw ?bag|왁스 ?백|wax ?bag/.test(t)) return "tote";
  // backpack — 빅샷/보레알리스 (TNF 모델명).
  // Wave 266: 백오프 ?팩 / 데이팩 / 캠퍼 백 / 트래블 백 / 캐리 백 / 학생 가방 (school bag) / 책가방 보강.
  if (/백팩|backpack|배낭|knapsack|빅샷|big ?shot|보레알리스|borealis(?!\s*sling)|핫샷|hot ?shot|데이 ?팩|day ?pack|캠퍼 ?백|camper ?bag|책 ?가방|학생 ?가방|school ?bag|학생가방/.test(t)) return "backpack";
  return "type_unknown";
}

function parseShoeProductType(text: string): ShoeProductType {
  const t = text.toLowerCase();
  // Wave 266 (2026-05-20): 등산화/트레킹화 → boot (등산화는 발목 보호 부츠류).
  //   번개장터 deep sweep 발견 — Salomon X Ultra/Quest/Speedcross 등산화 매물 다수 type_unknown.
  //   "노스페이스 워킹화 hiking boot", "살로몬 X 울트라 등산화" 등 sample.
  if (/부츠|boot\b|첼시|chelsea|앵클 ?부츠|ankle ?boot|컴뱃|combat ?boot|콤뱃|등산화|트레킹화|hiking ?boot|hiking ?shoe|hiking ?shoes|워킹화 ?미드|미드 ?컷 ?신발|등산 ?신발|등산 ?슈즈/.test(t)) return "boot";
  if (/샌들|sandal|쪼리|아쿠아 ?슈즈|aqua ?shoe|아쿠아슈즈/.test(t)) return "sandal";
  if (/로퍼|loafer|페니|penny|드라이빙 ?슈즈|driving ?shoe|모카신|moccasin/.test(t)) return "loafer";
  // Wave 264 (2026-05-20): 슬라이드 (Yeezy Slide) / 클로그 한글 / 아딜렛 (Adidas Adilette) / 폼러너 보강.
  //   사용자 발견 type_unknown sample: "이지슬라이드" / "아디다스 아딜렛 클로그 플랫폼" / "Crocs 클로그".
  // Wave 266: 플립플롭 / 우프 (Ugg slipper)도 보강.
  if (/슬리퍼|slipper|뮬\b|mule\b|에스파드류|espadrille|크록스|crocs|clog|클로그|슬라이드|slide|이지 ?슬라이드|yeezy ?slide|아딜렛|adilette|adilet|adilete|폼 ?러너|foam ?runner|푸쉬 ?에어|nb 슬리퍼|플립 ?플롭|flip ?flop|어그 ?슬리퍼|ugg ?slipper|아디다스 ?슬리퍼/.test(t)) return "slipper";
  // Wave 264: 축구화/풋살화 (F50/프레데터/코파/네메지즈/메시/crazyfast) — sneaker 분류 (운동화 광의).
  // Wave 266: 트레일러닝/러닝화/스피드 트레이너/스피드러너/골프화/테니스화/농구화/배드민턴화/탁구화/볼링화/배구화/태권도화 등.
  //   번개장터 sweep — 위 카테고리 매물 type_unknown 다수 (NB/아식스/Nike Pegasus 등).
  if (/스니커즈|sneaker|운동화|단화\b|러닝화|러닝 ?화|런닝화|블레이저|blazer|에어맥스|airmax|에어포스|airforce|덩크|dunk|조던|jordan|올드스쿨|sk8|에라\b|어센틱|슬립온|체커보드|축구화|풋살화|풋볼화|football ?boot|football ?shoes|f50|프레데터|predator|코파(?:\s|$)|copa\b|네메지즈|nemeziz|메시|messi|crazyfast|크레이지 ?패스트|트레일 ?러닝|trail ?running|트레일러닝|러닝 ?슈즈|running ?shoes|running ?shoe|스피드 ?러너|speed ?runner|스피드 ?트레이너|speed ?trainer|골프화|golf ?shoes|테니스화|tennis ?shoes|농구화|basketball ?shoes|배드민턴화|배구화|볼링화|탁구화|핸드볼화|태권도화|핸드 ?스티치 ?슈즈|승마 ?부츠 ?없는|훈련화|trainer ?shoe|trainer ?shoes/.test(t)) return "sneaker";
  return "type_unknown";
}

// ─── 통합 dispatcher ─────────────────────────────────────────────────

// Wave 217 (2026-05-19): v2 — bunjang_condition_label + resolveConditionClass 활용.
//   shoe/bag/bike 모두 metadata 기반 condition_class 박힘 → 시세 grouping 정확.
// Wave 232 (2026-05-19): v3 — bag parser confidence base 강화 (model 보너스 + era/size unknown 도 +0.05).
//   80% bag 매물 차단 (0.5 < 0.55) → fix 후 대부분 통과.
// Wave 236 (2026-05-19): v4 — product-type 추출 추가 (clothing/bag/shoe).
//   사용자 코멘트 22건 중 17건 "같은 SKU 다른 product-type 섞임" 근본 fix.
//   comparable_key 에 product-type 박혀 시세 daily 자동 분리.
// Wave 236b (2026-05-19): v5 — regex 보완 (반팔/남방/빈파포/눕시/터틀넥/탱크탑/트랙탑/윈드/호보/버킷/카메라/슬링/탑핸들/포쉐트).
//   in-memory simulate 측정: clothing 17%/bag 22% type_unknown → 보완 후 5% 목표.
// Wave 236c (2026-05-19): v6 — defaultProductType fallback 제거 + type_unknown → needsReview=true.
// Wave 236d (2026-05-19): v7 — catalog defaultProductType narrow model 만 박혀있으면 fallback.
//   사용자 의도: "노스페이스 빅샷 블랙 이런것만 보고 티셔츠인지 추정이 확실히 되면 그 이름이 티셔츠밖에
//     없는 이름이면 당연히 넣어야되는데 그런게 아닌 매물들은 탈락시켜야" — Goldilocks policy.
//   - narrow model (Borealis/Nuptse/Galleria 등) defaultProductType 박힘 → fallback (안전)
//   - broad SKU (RRL/FOG/Supreme collab) 미박힘 → 차단 (needsReview)
// Wave 254.5 step 1+2+3 (2026-05-20): 사용자 root fix 정정 — fashion 3 카테고리 일괄 v8.
//   사용자 SQL 검증: fashion 17,646건 condition_notes = 0% 채움 (vs earphone 80.9%/tablet 84.1%/phone 86.4%).
//   8,191건 suspicious_high_grade (mint/clean/unopened + notes []) 잘못 추천 가능.
//   점진 rollout 폐기 — bike 제외하고 shoe/bag/clothing 모두 v8 통합.
//   bike (wave92-fashion-mobility-v7) 만 옛 path 유지 (자전거는 conditionFromTextFashion 미적용).
const PARSER_VERSION_W92 = "wave92-fashion-mobility-v7";
// Wave 264 (2026-05-20) v9: parser regex 보강 (사용자 SQL 검증 — type_unknown 320건 영향).
//   clothing: 블라우스/가디건/윈드러너/캡모자/베이스볼캡/풋볼캡/6패널/워싱진/슬림내로우/데님 와이드 등
//   shoe: 슬라이드/이지 슬라이드/클로그/아딜렛/폼러너/축구화/풋살화/F50/프레데터/코파/네메지즈/메시
//   ~320건 type_unknown 매물 자동 product_type 추출 → comparable_key 정확 분리.
// Wave 266 (2026-05-20) v10: 번개장터 deep sweep 결과 — 추가 regex 보강.
//   shoe: 등산화/트레킹화/hiking boot → boot, 트레일러닝/러닝슈즈/스피드러너/골프화/테니스화/농구화/배드민턴화/볼링화/탁구화/태권도화 → sneaker, 플립플롭/Ugg slipper → slipper, 아쿠아슈즈 → sandal, 드라이빙슈즈/모카신 → loafer
//   clothing: 베이스볼 저지/야구점퍼/바시티/코치자켓/하드쉘/소프트쉘/MA-1/레터맨/스타디움자켓 → jacket
//   bag: 캔버스백/쇼핑백/마트백 → tote, 데이팩/캠퍼백/책가방/학생가방 → backpack
//   ~500+건 type_unknown 추가 catch 추정.
const PARSER_VERSION_W92_SHOE_V8 = "wave92-shoe-v10";
const PARSER_VERSION_W92_BAG_V8 = "wave92-bag-v10";
// Wave 216 (2026-05-19): clothing 카테고리 분기 신규 추가.
//   기존: parseFashionMobility 가 shoe/bag/bike 만 처리 → clothing 1253건 dispatcher
//   다른 분기에서 default 0.45 confidence + needs_review=true 박힘 → market_price_daily 0건 → pool 0건.
//   사용자 명시 "사이즈마다 가격이 다르진 않으니까 일단 괜찮지 않을까" — 의류는 사이즈 무관.
//   condition tier (가품/택그대로/사용감/오염) 만 정확히 추출하면 시세 비교 OK.
//   parser version 별도 박아 clothing 만 자동 re-parse (shoe/bag/bike 영향 X).
// v2 (2026-05-19): modelFromSku brand 포함 (polo/stussy/tnf/arcteryx 구분).
// Wave 217 v3 (2026-05-19): bunjang_condition_label + resolveConditionClass 활용.
// Wave 236 v4 (2026-05-19): product-type 추출 추가 (hoodie/tee/jacket/pants/cap/belt/wallet 등).
// Wave 236b v5 (2026-05-19): regex 보완 (반팔/남방/빈파포/눕시/터틀넥 등).
// Wave 236c v6 (2026-05-19): fallback 제거 + type_unknown → needsReview (사용자 정책).
// Wave 236d v7 (2026-05-19): catalog narrow model defaultProductType fallback OK + broad 차단.
// Wave 254.5 step 3 v8 (2026-05-20): conditionFromTextFashion 통합 (의류 specific signals).
const PARSER_VERSION_W216_CLOTHING = "wave216-clothing-v7";
// Wave 264 v9: 블라우스/가디건/윈드러너/캡모자/베이스볼캡/풋볼캡/6패널/워싱진/슬림내로우 regex 보강.
// Wave 266 v10: 베이스볼 저지/야구점퍼/바시티/코치자켓/하드쉘/소프트쉘/MA-1/레터맨/스타디움자켓 regex 보강.
const PARSER_VERSION_W216_CLOTHING_V8 = "wave216-clothing-v10";

function slug(token: string): string {
  return token.toLowerCase().replace(/[^a-z0-9가-힣_]/g, "").replace(/__+/g, "_");
}

function modelFromSku(
  skuId: string | null | undefined,
  _skuName: string | null | undefined,
  category?: string | null,
): string | null {
  // shoe/bag/bike: `category-brand-model` → brand 빼고 model (jordan_1_high 등 model 자체에 식별성 충분).
  // Wave 216 (2026-05-19): clothing 은 brand 가 가격 결정 핵심 (polo vs tnf vs stussy vs arcteryx
  //   가격대 완전 다름). slice(2) 로 brand 빼면 acne-apparel/reebok-apparel/fila-apparel 다
  //   `apparel` 한 key 로 묶여 시세 망가짐. clothing 만 slice(1) → brand 포함.
  if (!skuId) return null;
  const sliceFrom = category === "clothing" ? 1 : 2;
  const parts = skuId.split("-").slice(sliceFrom);
  return parts.length > 0 ? parts.join("_") : null;
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export function parseFashionMobility(input: ParseInput): ParsedListingOptions {
  const title = input.title ?? "";
  const description = input.description ?? "";
  const text = `${title}\n${description.slice(0, 1200)}`;
  const category = input.category ?? null;
  if (category !== "shoe" && category !== "bag" && category !== "bike" && category !== "clothing") {
    throw new Error(`parseFashionMobility called with non-fashion-mobility category: ${category}`);
  }

  const model = modelFromSku(input.skuId, input.skuName, category);
  const family = category;

  const unknownParts: string[] = [];
  const partsForKey: string[] = [family, model ?? "unknown_model"];
  const criticalUnknown: string[] = [];
  let parseConfidence = 0.45;
  const parsedJson: Record<string, unknown> = {
    raw_sku_id: input.skuId ?? null,
    raw_sku_name: input.skuName ?? null,
  };
  let needsReview = false;
  // Wave 134 (2026-05-16): shoe condition_tier → condition_class 매핑.
  // 이전: 모든 신발 conditionClass = "normal" (Wave 130까지 미구현).
  // 변경: s_grade → unopened / a_grade → mint / b_grade → clean / c_grade → worn / reject → flawed.
  let conditionClassResult: ConditionClass = "normal";
  // Wave 254.5 step 1 (2026-05-20): shoe conditionFromTextFashion 결과 — score/notes worst-of merge 용.
  //   bag/clothing (step 2/3) 까지는 빈 배열 유지 (Wave 130 정책).
  let fashionConditionScore: number | null = null;
  let fashionConditionNotes: string[] = [];

  if (category === "shoe") {
    const opt = parseShoeOptions(text);
    parsedJson.shoe_size_mm = opt.sizeMm;
    parsedJson.shoe_condition_tier = opt.conditionTier;
    parsedJson.shoe_box_status = opt.boxStatus;
    parsedJson.shoe_is_kids = opt.isKids;
    // Wave 236 (2026-05-19): product-type 추출 — 다른 product-type 매물 차단.
    //   예: shoe-margiela-tabi-sneaker SKU 인데 매물이 "타비 부츠" → product-type 다름 → 다른 시세.
    // Wave 236d (2026-05-19): catalog defaultProductType 정확 정책.
    //   - text 추출 성공 → 그 값
    //   - text 실패 + catalog defaultProductType 박힘 → fallback (model=type 1개 확정 SKU)
    //   - text 실패 + 미박힘 → needsReview=true (pool 차단)
    // Wave 236e (2026-05-19): shoe 카테고리는 SKU 매칭 자체 = product-type 1개 확정 (catalog 가 model-level narrow).
    //   매물 text 에 "운동화/스니커즈" 단어 없어도 (sample 58% — "나이키 페가수스 39 블랙" 같이)
    //   catalog SKU (shoe-nike-pegasus-41 등) 매칭 자체로 product-type 추론 가능.
    //   따라서 shoe category 한정 — catalog 미박힘 시 "sneaker" default (99% shoe = sneaker).
    //   예외 (boot/sandal/loafer/slipper) SKU 는 catalog 명시 박힘.
    let productType: string = parseShoeProductType(text);
    let typeFromCatalog = false;
    let typeFromShoeDefault = false;
    if (productType === "type_unknown" && input.defaultProductType) {
      productType = input.defaultProductType;
      typeFromCatalog = true;
    } else if (productType === "type_unknown" && input.skuId) {
      // Wave 236e: shoe + SKU 매칭 자체 = product-type 추론 가능 → "sneaker" default.
      productType = "sneaker";
      typeFromShoeDefault = true;
    }
    parsedJson.shoe_product_type = productType;
    parsedJson.shoe_product_type_from_catalog = typeFromCatalog;
    parsedJson.shoe_product_type_from_shoe_default = typeFromShoeDefault;
    partsForKey.push(productType);
    if (productType !== "type_unknown") {
      parseConfidence += typeFromCatalog ? 0.03 : (typeFromShoeDefault ? 0.02 : 0.05);
    } else {
      // 사용자 정책: SKU 매칭 자체도 안 됨 → pool 차단.
      needsReview = true;
      criticalUnknown.push("shoe_product_type_unknown");
    }
    if (opt.isKids) {
      needsReview = true;
      criticalUnknown.push("shoe_kids_size_mismatch");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("shoe_damage_reject");
    }
    if (opt.sizeMm != null) {
      partsForKey.push(String(opt.sizeMm));
      parseConfidence += 0.3;
    } else {
      partsForKey.push("unknown_size");
      unknownParts.push("unknown_size");
      criticalUnknown.push("unknown_size");
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.15;
      // Wave 134: condition_tier → condition_class 매핑.
      const tierMap: Record<string, ConditionClass> = {
        s_grade: "unopened",
        a_grade: "mint",
        b_grade: "clean",
        c_grade: "worn",
        reject: "flawed",
      };
      conditionClassResult = tierMap[opt.conditionTier] ?? "normal";
    } else {
      partsForKey.push("unknown_condition");
      unknownParts.push("unknown_condition");
    }
    if (opt.boxStatus) {
      partsForKey.push(opt.boxStatus);
      parseConfidence += 0.05;
      // Wave 134: 박스 미개봉이면 condition tier 없어도 unopened 가능성.
      if (opt.boxStatus === "with_box" && opt.conditionTier === "s_grade") {
        conditionClassResult = "unopened";
      }
    }
    // Wave 254.5 step 1 (2026-05-20): shoe 카테고리 conditionFromTextFashion 통합.
    //   기존: parseConditionTier (tier-only regex) — Wave 203~209 negation/objective override 누락.
    //   사용자 매물 pid 408858108 가젤 볼드 "새상품 + 약간 하자가있어" → mint 잘못 (a_grade match).
    //   fix: conditionFromText 의 repair_or_defect_signal 감지 + worst-of merge.
    //   bag/clothing 은 step 2/3 (점진 rollout, 사용자 결정).
    const fashion = conditionFromTextFashion(text, "shoe");
    fashionConditionScore = fashion.conditionScore;
    fashionConditionNotes = fashion.conditionNotes;
    parsedJson.shoe_condition_notes = fashion.conditionNotes;
    parsedJson.shoe_condition_score_fashion = fashion.conditionScore;
    parsedJson.shoe_fashion_condition_applied = true;
    // notes-based ConditionClass — Wave 203~209 정책 (flawed > worn > unopened > clean > normal).
    const fashionNotesClass = extractConditionClass(fashion.conditionNotes);
    // worst-of merge — tier-based conditionClassResult 와 fashion notes-based class 둘 중 낮은 등급.
    //   normal 인 쪽은 무시 (실제 signal 없음). low_batt 는 fashion 미사용 (battery health 없음).
    if (
      fashionNotesClass !== "normal" &&
      fashionNotesClass !== "low_batt" &&
      conditionClassResult !== "low_batt"
    ) {
      const currentRank = CONDITION_RANK[conditionClassResult];
      const fashionRank = CONDITION_RANK[fashionNotesClass];
      if (fashionRank < currentRank) {
        conditionClassResult = fashionNotesClass;
      }
    }
    // needsReview 보강 — strong negative signals (Wave 204/207/208).
    const strongNegativeSignals = ["buying_post", "single_side_only", "accessory_compatible_for_other_product", "parts_only"];
    if (fashion.conditionNotes.some((n) => strongNegativeSignals.includes(n))) {
      needsReview = true;
      criticalUnknown.push("shoe_strong_negative_signal");
    }
  } else if (category === "bag") {
    const opt = parseBagOptions(text);
    parsedJson.bag_era = opt.era;
    parsedJson.bag_size_variant = opt.sizeVariant;
    parsedJson.bag_condition_tier = opt.conditionTier;
    parsedJson.bag_fake_flags = opt.fakeFlags;
    // Wave 236 (2026-05-19): product-type 추출 — bag 가장 큰 영향 (TNF×Supreme 백팩/숄더/토트 섞임).
    //   사용자 코멘트: "백팩이랑 숄더백이랑 다른거 아닌가???" / "지갑이랑 뭐하냐?"
    // Wave 236d (2026-05-19): catalog defaultProductType 정확 정책 (narrow model 만 박힘).
    let productType: string = parseBagProductType(text);
    let typeFromCatalog = false;
    if (productType === "type_unknown" && input.defaultProductType) {
      productType = input.defaultProductType;
      typeFromCatalog = true;
    }
    parsedJson.bag_product_type = productType;
    parsedJson.bag_product_type_from_catalog = typeFromCatalog;
    partsForKey.push(productType);
    if (productType !== "type_unknown") {
      parseConfidence += typeFromCatalog ? 0.05 : 0.1; // bag 은 product-type 가격 차 큼.
    } else {
      needsReview = true;
      criticalUnknown.push("bag_product_type_unknown");
    }
    if (opt.fakeFlags) {
      needsReview = true;
      criticalUnknown.push("bag_fake_suspect");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("bag_damage_reject");
    }
    // Wave 232 (2026-05-19): bag parser confidence 강화.
    //   기존: base 0.45 + era unknown +0.05 + size unknown +0 + condition unknown +0 = 0.5 → needsReview.
    //   80% bag 매물 차단 (Wave 232 측정 397/1287). 사용자 의도 "ready 진입" 충족 못 함.
    //   fix: model 박힘 보너스 +0.25 (sku 매칭됐다는 신호 — clothing parser 처럼). era/size 미명시도 +0.05.
    if (model) {
      parseConfidence += 0.25;
    }
    if (opt.era) {
      partsForKey.push(opt.era);
      parseConfidence += 0.15;
    } else {
      partsForKey.push("era_unknown");
      unknownParts.push("unknown_era");
      parseConfidence += 0.05;
    }
    if (opt.sizeVariant) {
      partsForKey.push(opt.sizeVariant);
      parseConfidence += 0.15;
    } else {
      partsForKey.push("unknown_size_variant");
      unknownParts.push("unknown_size_variant");
      parseConfidence += 0.05;
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.1;
      // Wave 217 (2026-05-19): bag condition_tier → condition_class 매핑 추가.
      //   사용자 지적 (Wave 217): 가방 매물 260건 100% condition_class='normal' →
      //   시세 grouping (comparable_key, condition_class) 한 bucket 으로 묶임 →
      //   가품 + 새상품 + 사용감 매물 평균 = 시세 망가짐. shoe 와 동일 매핑.
      const tierMap: Record<string, ConditionClass> = {
        s_grade: "unopened",
        a_grade: "mint",
        b_grade: "clean",
        c_grade: "worn",
        reject: "flawed",
      };
      conditionClassResult = tierMap[opt.conditionTier] ?? "normal";
    }
    // Wave 254.5 step 2 (2026-05-20): bag conditionFromTextFashion 통합 (사용자 systemic 결정).
    //   사용자 SQL 검증: bag 1,705 매물 condition_notes 0% 채움 (vs tech 80%+).
    //   fix: bag 분기에서도 conditionFromTextFashion 호출 + bag-specific signals 추가.
    //   bag-specific: 내피 끈적/오염 / 가죽 까짐 / 손잡이 마모 / 코너 닳음 / 페인팅 벗겨짐 / 곰팡이.
    const fashion = conditionFromTextFashion(text, "bag");
    fashionConditionScore = fashion.conditionScore;
    fashionConditionNotes = fashion.conditionNotes;
    parsedJson.bag_condition_notes = fashion.conditionNotes;
    parsedJson.bag_condition_score_fashion = fashion.conditionScore;
    parsedJson.bag_fashion_condition_applied = true;
    const fashionNotesClassBag = extractConditionClass(fashion.conditionNotes);
    if (
      fashionNotesClassBag !== "normal" &&
      fashionNotesClassBag !== "low_batt" &&
      conditionClassResult !== "low_batt"
    ) {
      const currentRank = CONDITION_RANK[conditionClassResult];
      const fashionRank = CONDITION_RANK[fashionNotesClassBag];
      if (fashionRank < currentRank) {
        conditionClassResult = fashionNotesClassBag;
      }
    }
    const strongNegativeSignalsBag = ["buying_post", "accessory_compatible_for_other_product", "parts_only"];
    if (fashion.conditionNotes.some((n) => strongNegativeSignalsBag.includes(n))) {
      needsReview = true;
      criticalUnknown.push("bag_strong_negative_signal");
    }
  } else if (category === "bike") {
    const opt = parseBikeOptions(text);
    parsedJson.bike_frame_size = opt.frameSize;
    parsedJson.bike_condition_tier = opt.conditionTier;
    parsedJson.bike_crash_history = opt.crashHistory;
    parsedJson.bike_year_tier = opt.yearTier;
    parsedJson.bike_parts_only = opt.partsOnly;
    if (opt.partsOnly) {
      needsReview = true;
      criticalUnknown.push("bike_parts_only_reject");
    }
    if (opt.crashHistory === "crash") {
      needsReview = true;
      criticalUnknown.push("bike_crash_reject");
    }
    if (opt.conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("bike_damage_reject");
    }
    if (opt.frameSize) {
      partsForKey.push(opt.frameSize);
      parseConfidence += 0.25;
    } else {
      // frame_size 미명시도 흔함 (특히 폴딩/하이브리드) → unknown 표기만, critical 아님.
      // 사용자 UI에서 "프레임 사이즈 확인 필요" 뱃지 표시 권장.
      partsForKey.push("frame_size_unknown");
      unknownParts.push("unknown_frame_size");
      parseConfidence += 0.1;
    }
    if (opt.crashHistory === "no_crash") {
      partsForKey.push("no_crash");
      parseConfidence += 0.1;
    } else if (opt.crashHistory == null) {
      partsForKey.push("crash_unknown");
      unknownParts.push("unknown_crash_history");
    }
    if (opt.conditionTier) {
      partsForKey.push(opt.conditionTier);
      parseConfidence += 0.1;
    }
  } else {
    // Wave 216 (2026-05-19): clothing 신규 분기.
    //   - 사용자 명시 "사이즈마다 가격이 다르진 않으니까 일단 괜찮지" → 사이즈 추출 안 함.
    //   - condition tier (택그대로/S급/사용감/오염/reject) 만 정확히 추출.
    //   - reject 패턴 (얼룩 심함/곰팡이/구멍) 만 needsReview.
    //   - model 박혔으면 confidence 부스트 (sku_id 매칭됐다는 사실 자체가 강한 신호).
    // Wave 236 (2026-05-19): product-type 추출 — clothing 가장 큰 영향 (Stussy hoodie / RRL / Polo Pique).
    //   사용자 코멘트 22건 중 12건 clothing product-type 섞임.
    //   "후드티랑 맨투맨 다른거 아닌가" / "지갑이랑 벨트랑 모자랑 ㅋㅋㅋ" / "롱슬리브랑 반팔 지랄났네"
    // Wave 236d (2026-05-19): catalog defaultProductType 정확 정책 (narrow model 만 박힘).
    //   "노스페이스 빅샷 블랙" 같은 model=type 확정 매물만 fallback, broad SKU 매물은 needsReview 차단.
    let productType: string = parseClothingProductType(text);
    let typeFromCatalog = false;
    if (productType === "type_unknown" && input.defaultProductType) {
      productType = input.defaultProductType;
      typeFromCatalog = true;
    }
    parsedJson.clothing_product_type = productType;
    parsedJson.clothing_product_type_from_catalog = typeFromCatalog;
    partsForKey.push(productType);
    if (productType !== "type_unknown") {
      parseConfidence += typeFromCatalog ? 0.05 : 0.1;
    } else {
      needsReview = true;
      criticalUnknown.push("clothing_product_type_unknown");
    }

    const conditionTier = parseConditionTier(text);
    parsedJson.clothing_condition_tier = conditionTier;
    if (conditionTier === "reject") {
      needsReview = true;
      criticalUnknown.push("clothing_damage_reject");
    }
    if (conditionTier) {
      partsForKey.push(conditionTier);
      parseConfidence += 0.2;
      // shoe 와 동일 condition_class 매핑 (UI 일관성).
      const tierMap: Record<string, ConditionClass> = {
        s_grade: "unopened",
        a_grade: "mint",
        b_grade: "clean",
        c_grade: "worn",
        reject: "flawed",
      };
      conditionClassResult = tierMap[conditionTier] ?? "normal";
    } else {
      // condition 미명시도 흔함 — 가격 결정 핵심 아니라 critical 아님.
      partsForKey.push("unknown_condition");
      unknownParts.push("unknown_condition");
      parseConfidence += 0.05;
    }
    // model 박힘 = sku_id catalog 매칭 됐다는 강한 신호 → confidence 큰 부스트.
    if (model) {
      parseConfidence += 0.25;
    }
    // Wave 254.5 step 3 (2026-05-20): clothing conditionFromTextFashion 통합 (사용자 systemic 결정).
    //   사용자 SQL 검증: clothing 4,437 매물 condition_notes 0% 채움 (vs tech 80%+).
    //   2,686건 suspicious_high_grade (60.5%) 즉시 정정 대상.
    //   clothing-specific: 보풀 / 색바램 / 늘어남 / 봉제 풀림 / 트임 / 인쇄 갈라짐 / 얼룩.
    const fashion = conditionFromTextFashion(text, "clothing");
    fashionConditionScore = fashion.conditionScore;
    fashionConditionNotes = fashion.conditionNotes;
    parsedJson.clothing_condition_notes = fashion.conditionNotes;
    parsedJson.clothing_condition_score_fashion = fashion.conditionScore;
    parsedJson.clothing_fashion_condition_applied = true;
    const fashionNotesClassClothing = extractConditionClass(fashion.conditionNotes);
    if (
      fashionNotesClassClothing !== "normal" &&
      fashionNotesClassClothing !== "low_batt" &&
      conditionClassResult !== "low_batt"
    ) {
      const currentRank = CONDITION_RANK[conditionClassResult];
      const fashionRank = CONDITION_RANK[fashionNotesClassClothing];
      if (fashionRank < currentRank) {
        conditionClassResult = fashionNotesClassClothing;
      }
    }
    const strongNegativeSignalsClothing = ["buying_post", "accessory_compatible_for_other_product", "parts_only"];
    if (fashion.conditionNotes.some((n) => strongNegativeSignalsClothing.includes(n))) {
      needsReview = true;
      criticalUnknown.push("clothing_strong_negative_signal");
    }
  }

  const comparableKey = partsForKey.map(slug).join("|");
  const variantKey = partsForKey.slice(2).join(" / ");
  parseConfidence = Math.min(1, Math.max(0, parseConfidence));

  // critical unknown 있으면 needsReview (시세 비교 무의미).
  if (criticalUnknown.length > 0) needsReview = true;
  if (parseConfidence < 0.55) needsReview = true;

  // Wave 217 (2026-05-19): bunjang_condition_label (NEW/LIKE_NEW/...) + parseConditionTier 결합.
  //   사용자 지적: shoe/bag/clothing 매물 8000+ 건에 bunjang 자체 등급 박혀있는데
  //   parseFashionMobility 가 무시 → condition_class normal 비율 비정상 (bag 100% / shoe 25%).
  //   기존 인프라 (bunjangLabelToConditionClass + resolveConditionClass — 전자기기 사용중) 그대로 적용.
  //   policy: meta 와 notes (parseConditionTier) 둘 다 있으면 worse-of (낮은 등급 우선).
  const fromMeta = bunjangLabelToConditionClass(input.bunjangConditionLabel);
  conditionClassResult = resolveConditionClass(fromMeta, conditionClassResult, false);

  // Wave 175 (2026-05-17): condition_class → conditionScore 매핑.
  // 옛 코드는 0.5 hardcode — 신발 매물 2,189건 전부 conditionScore < 0.65 →
  // tick scoreStage 'condition_review' flag → pool 차단. mint/clean도 박힘.
  // 다른 카테고리 parser는 condition_notes 기반 score 박는 로직 있음.
  // 신발/가방/자전거는 condition_notes 미구현 → class 기반 fallback.
  const conditionScoreMap: Record<ConditionClass, number> = {
    unopened: 1.0,
    mint: 0.95,
    clean: 0.85,
    normal: 0.75,
    worn: 0.55,
    flawed: 0.35,
    low_batt: 0.4,
  };
  const tierConditionScore = conditionScoreMap[conditionClassResult] ?? 0.5;
  // Wave 254.5 step 1 (2026-05-20): shoe 한정 — fashion score 와 worst-of merge.
  //   객관적 negative signal (repair_or_defect_signal etc.) 감지 시 tier 보다 낮은 score 적용.
  const conditionScore = fashionConditionScore !== null
    ? Math.min(tierConditionScore, fashionConditionScore)
    : tierConditionScore;

  return {
    // Wave 254.5 step 1+2+3 (2026-05-20): fashion 3 카테고리 일괄 v8.
    //   shoe → wave92-shoe-v8 / bag → wave92-bag-v8 / clothing → wave216-clothing-v8.
    //   bike 만 v7 유지 (conditionFromTextFashion 미적용 — 자전거 specific signal 별도 wave).
    parserVersion:
      category === "clothing"
        ? PARSER_VERSION_W216_CLOTHING_V8
        : category === "shoe"
          ? PARSER_VERSION_W92_SHOE_V8
          : category === "bag"
            ? PARSER_VERSION_W92_BAG_V8
            : PARSER_VERSION_W92,
    contentHash: hashText(text),
    category,
    family,
    model,
    variantKey,
    comparableKey,
    storageGb: null,
    ramGb: null,
    ssdGb: null,
    screenSizeIn: null,
    chip: null,
    releaseYear: null,
    batteryHealth: null,
    batteryCycles: null,
    carrier: null,
    connectivity: null,
    conditionScore,
    // Wave 254.5 step 1 (2026-05-20): shoe 만 conditionFromTextFashion notes 사용 (bag/clothing/bike: [] 유지).
    conditionNotes: fashionConditionNotes,
    // Wave 130 (2026-05-16): fashion/mobility는 condition_notes 추출 미구현 → default normal.
    // Wave 134 (2026-05-16): 신발 condition_tier → condition_class 매핑 추가. 가방/자전거는 normal 유지.
    // Wave 254.5 step 1 (2026-05-20): shoe 만 conditionFromTextFashion notes 채움 (Wave 203~209 정책 + shoe-specific).
    conditionClass: conditionClassResult,
    parseConfidence,
    needsReview,
    parsedJson: {
      ...parsedJson,
      unknown_parts: unknownParts,
      critical_unknown: criticalUnknown,
      wave92_parser: true,
    },
  };
}
