// Wave 714 (2026-05-23): grading 매처용 raw text 전처리 (boilerplate 등급표 제거).
//
// 발견 (의류 cross-tab agent a2d7c17a34f40235e, 2026-05-23):
//   A1_unworn × D3_major n=82 (1.75x) 모순 cell 의 raw sample 분석 결과:
//   - 셀러 boilerplate 등급표 "S: 새상품 / A: 자연사용감 / B: 스크래치 이염 ..."
//     가 description 에 그대로 박혀 D3_major keyword 매칭됨.
//   - "오래 입을 수 있습니다" (durable, +) vs "오래 입었습니다" (heavily used)
//     시제 구분 실패 — A5_heavily_used false positive.
//
// 해결: keyword 매칭 전 sanitize 단계 — 노이즈 패턴 제거.
// 신발/의류 grading 양쪽에 적용.

/**
 * Boilerplate 등급표 line 제거.
 *
 * 예: "S : 새상품에 가까운 / A : 자연스러운 사용감 / B : 스크래치, 미세 이염 / C : ..."
 *     또는 줄바꿈으로:
 *     S : 새상품
 *     A : 자연스러운 사용감
 *     B : 스크래치, 이염
 *
 * 패턴:
 *   [S|A|B|C|D|N]\s*[:：·-]\s*<설명>
 *   2회 이상 연속 출현 시 등급표로 간주 → 제거.
 */
function stripGradeRubric(text: string): string {
  // 줄 단위 분리 + grade rubric line 식별.
  const lines = text.split(/[\n\r]+/);
  const isRubricLine = (line: string): boolean => {
    const trimmed = line.trim();
    // "S : ..." / "S- ..." / "[A] ..." / "A급:" 등.
    return /^(\[?\s*[NSABCD]\s*[\]\-:：·]\s*\+?)|^[NSABCD]급\s*[:：·]/i.test(trimmed);
  };
  const rubricCount = lines.filter(isRubricLine).length;
  // 2회 이상 연속 rubric line → 등급표 — 모두 제거.
  if (rubricCount >= 2) {
    return lines.filter((l) => !isRubricLine(l)).join("\n");
  }

  // 한 줄에 다중 rubric (예: "S : 새상품 / A : 사용감 / B : 스크래치")
  // 슬래시/세미콜론으로 분리해서 2회 이상 매칭 시 줄 자체 제거.
  return lines
    .map((line) => {
      const parts = line.split(/\s*[/·;|]\s*/);
      const partRubricCount = parts.filter(isRubricLine).length;
      if (partRubricCount >= 2) return "";
      return line;
    })
    .filter((l) => l !== "")
    .join("\n");
}

/**
 * 시제/modal 기반 false positive 제거.
 *
 * 예: "오래 입을 수 있" / "오래 신을 수 있" → durable (positive)
 *     → A5_heavily_used / A6_vintage 매칭 차단 위해 keyword "오래 입" 자체를 마스킹.
 */
function maskFalseDurabilityClaims(text: string): string {
  // future modal + verb 패턴: "오래 (입|신|쓸|사용)을 수 있"
  return text.replace(/오래\s*(입|신|쓸|사용|착용)([을를])?\s*수\s*있/g, "(durable)");
}

/**
 * Wave launch-79 (사용자 보고 pid 7000939590067 — RRL 필드치노 gas station green):
 * "빈티지한 그린계열 색상" 의 "빈티지" 한 단어가 wear=vintage(낡음) 로 매칭 → D tier 오분류.
 *
 * 의류 reseller 들은 "빈티지" 단어를 색상/스타일/디자인 묘사로 매우 자주 사용:
 *   - "빈티지한 그린", "빈티지 색감", "빈티지 무드", "빈티지룩",
 *     "빈티지한 분위기", "빈티지 스타일", "빈티지 디자인"
 * 이 표현들은 의류 자체의 낡음/archive 와 무관한 marketing copy.
 *
 * 패턴: "빈티지" (선택적 어미 "한"/"스러운"/"의") + 색상/스타일/디자인 명사 → "(style)" 으로 마스킹.
 * 차단 대상은 명확히 "색감/스타일" 맥락만. "빈티지 의류", "빈티지 매물" 같은 진짜 wear 신호는 그대로 통과.
 */
function maskVintageStyleDescriptions(text: string): string {
  // 색상 단어 + 일반 명사 (색/톤/무드/룩/스타일/디자인/감성/분위기/색감/색상/핏/실루엣/미감/감각/감/매력).
  const styleNoun = "(그린|블루|네이비|카키|브라운|올리브|머스타드|버건디|레드|핑크|옐로우|와인|민트|코랄|아이보리|크림|차콜|그레이|베이지|블랙|화이트|퍼플|오렌지|색|색상|색감|컬러|톤|분위기|무드|감성|스타일|디자인|룩|핏|실루엣|미감|감각|매력|느낌|모델|디테일|소재|원단|라인|아이템|패턴|프린트|로고|마감|디자이너)";
  // Wave launch-80 (audit 후): vintage/archive 영문 + "오래된" + "아카이브" 모두 포함.
  // 의류/신발 reseller 들이 형용사/관형사로 매우 자주 사용 — 진짜 wear=vintage 신호와 분리.
  const vintageWord = "(빈티지(한|스러운|의|풍|풍의|틱|틱한)?|vintage|아카이브|archive|오래된)";
  const re = new RegExp(`${vintageWord}\\s*${styleNoun}`, "gi");
  return text.replace(re, "(style)");
}

/**
 * 마케팅/광고 boilerplate 제거 — "사용감 X 새상품 같은" 같이 강조 표현 흡수 위함.
 *
 * Wave 720 (2026-05-23): 17K sample sweep 발견 — 명품 reseller boilerplate 다수.
 *   - "쇼룸방문구매" / "쇼룸 진열" 표기가 36/44건 명품 reseller boilerplate (실제 진열품 아님)
 *   - "수도권 퀵 가능" / "당일 매입" / "오프라인 매장 운영" 등도 boilerplate
 *   - 추가하지 않으면 "쇼룸" 키워드를 axis A의 S 신호로 잘못 매칭할 risk.
 *   - 차단 후 reseller boilerplate가 wear/auth 신호 오염 X.
 */
function stripMarketingBoilerplate(text: string): string {
  // Wave 720: 명품 reseller boilerplate line 제거 (line 단위)
  const RESELLER_BOILERPLATE_PATTERNS: RegExp[] = [
    /쇼룸\s*방문\s*구매/g,
    /쇼룸\s*진열/g,
    /수도권\s*퀵\s*(가능|배송)?/g,
    /당일\s*매입/g,
    /오프라인\s*매장\s*운영/g,
    /실재고\s*보유중/g,
    /모든\s*제품\s*퀵\s*가능/g,
    // 명품 reseller 컨디션 표 (sanitize 안 되면 axis 오염)
    /컨디션\s*기준표/g,
    // Wave 721 (2026-05-23): launch-79/80 후속 — D-tier "빈티지" 단독 매칭 371건 audit.
    //   30 sample 분석 결과 60-70%가 "빈티지 매장 boilerplate" (셀러 disclaimers).
    //   실제 매물 상태와 무관하지만 axis A의 wear=vintage 매칭 → D tier 강제.
    //   진짜 vintage (연도/decade 명시) 는 보존, 매장 disclaimers만 마스킹.
    /빈티지\s*(?:제품)?\s*특성상.{0,80}/g,    // "빈티지 특성상 교환/반품 불가능합니다 미처 발견하지 못한 하자나"
    /빈티지\s*\/\s*세컨핸드/g,                // "판매되는 모든 제품은 빈티지/세컨핸드"
    /빈티지의류\s*예민\s*하신/g,              // "빈티지의류 예민 하신분은 구매 하지마세요"
    /빈티지\s*나\s*중고에\s*민감/g,           // "빈티지나 중고에 민감하신 분들은 패스"
    /빈티지\s*샵에서\s*구매/g,                // "일본 빈티지 샵에서 구매했으며"
    /정품\s*빈티지\s*구매\s*후/g,             // "정품 빈티지 구매 후 시착조차"
    /빈티지\s*박스(?:입니다|예요)?/g,         // "(빈티지박스)" — 매장 표시
    /#\s*빈티지\w*/g,                         // "#빈티지만냥" / "#빈티지샵" 해시태그
    /빈티지의?\s*특성/g,                      // "빈티지 특성"
    /빈티지\s*컨디션\s*사진\s*참고/g,         // "빈티지 컨디션 사진 참고해주세요"
    // 매장 disclaimers 일반
    /최저가로\s*주\s*\d\s*일\s*업데이트/g,    // "최저가로 주6일 업데이트중"
    /낱개\s*구매시\s*바로\s*안전결제/g,       // 매장 boilerplate
  ];
  for (const re of RESELLER_BOILERPLATE_PATTERNS) {
    text = text.replace(re, "(reseller)");
  }
  return text;
}

/**
 * Grading matcher 전용 sanitize.
 *
 * Pipeline:
 *   1. lowercase
 *   2. boilerplate 등급표 (S:.., A:.., B:.. 다중 라인) 제거
 *   3. "오래 입을 수 있" 같은 durable positive copy 마스킹
 *   4. (향후) 마케팅 boilerplate 제거
 *
 * 출력: keyword 매칭 가능한 정제 텍스트.
 */
export function sanitizeForGrading(rawText: string | null | undefined): string {
  if (!rawText) return "";
  let text = rawText.toLowerCase();
  text = stripGradeRubric(text);
  text = maskFalseDurabilityClaims(text);
  // Wave launch-79: "빈티지한 그린" 같은 색감/스타일 묘사 → wear=vintage false positive 차단.
  text = maskVintageStyleDescriptions(text);
  text = stripMarketingBoilerplate(text);
  return text;
}
