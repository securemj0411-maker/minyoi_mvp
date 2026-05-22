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
 * 마케팅/광고 boilerplate 제거 — "사용감 X 새상품 같은" 같이 강조 표현 흡수 위함.
 *
 * (현재는 minimal. 추후 sample 보고 추가.)
 */
function stripMarketingBoilerplate(text: string): string {
  // "100% 정품 보장" / "정품 보장 X" 등은 grading axis 영향 적음 — 일단 패스.
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
  text = stripMarketingBoilerplate(text);
  return text;
}
