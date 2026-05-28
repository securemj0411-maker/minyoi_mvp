export const EARPHONE_CONDITION_EVIDENCE_VERSION = "earphone-condition-evidence-v1";

export type EarphoneConditionSignal =
  | "single_side_unit"
  | "charging_case_only"
  | "protective_case_only"
  | "audio_output_issue"
  | "anc_or_transparency_issue"
  | "mic_issue"
  | "pairing_or_connection_issue"
  | "battery_degraded"
  | "hygiene_or_stain"
  | "physical_damage"
  | "missing_parts"
  | "full_set_positive"
  | "new_positive"
  | "no_anc_variant"
  | "negated_defect";

export type EarphoneConditionSeverity =
  | "block_candidate"
  | "warning"
  | "positive"
  | "variant"
  | "negation";

export type EarphoneConditionEvidence = {
  signal: EarphoneConditionSignal;
  severity: EarphoneConditionSeverity;
  source: "title" | "description";
  confidence: number;
  evidence: string;
};

export type EarphoneConditionEvidenceResult = {
  version: typeof EARPHONE_CONDITION_EVIDENCE_VERSION;
  signals: EarphoneConditionSignal[];
  facts: EarphoneConditionEvidence[];
  hardBlockCandidates: EarphoneConditionSignal[];
  warningSignals: EarphoneConditionSignal[];
  positiveSignals: EarphoneConditionSignal[];
};

type TextSource = {
  source: EarphoneConditionEvidence["source"];
  raw: string;
  normalized: string;
  compact: string;
};

function normalizeEarphoneText(text: string) {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/usb[\s_-]*c/g, " usbc ")
    .replace(/c[\s_-]*type/g, " usbc ")
    .replace(/c\s*타입|타입\s*c|씨\s*타입|타입\s*씨/g, " usbc ")
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceOf(source: EarphoneConditionEvidence["source"], raw: string): TextSource {
  const normalized = normalizeEarphoneText(raw);
  return {
    source,
    raw,
    normalized,
    compact: normalized.replace(/\s+/g, ""),
  };
}

function snippet(text: string, match: RegExpExecArray) {
  const start = Math.max(0, match.index - 18);
  const end = Math.min(text.length, match.index + match[0].length + 18);
  return text.slice(start, end).trim();
}

function firstEvidence(
  sources: TextSource[],
  patterns: RegExp[],
  useCompact = false,
): Pick<EarphoneConditionEvidence, "source" | "evidence"> | null {
  for (const source of sources) {
    const haystack = useCompact ? source.compact : source.normalized;
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
      const match = re.exec(haystack);
      if (match) {
        return {
          source: source.source,
          evidence: snippet(haystack, match),
        };
      }
    }
  }
  return null;
}

function hasAny(sources: TextSource[], patterns: RegExp[], useCompact = false) {
  return Boolean(firstEvidence(sources, patterns, useCompact));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function hasFullSizeHeadphoneContext(allText: string) {
  return /헤드폰|헤드셋|airpods\s*max|에어팟\s*맥스|wh\s*-?\s*1000|wh1000|xm[3-6]|qc\s*(?:울트라|ultra|\d{2})|보스|bose|소니|sony|beats\s*studio|비츠\s*스튜디오/.test(allText);
}

export function parseEarphoneConditionEvidence(input: {
  title: string;
  description?: string | null;
}): EarphoneConditionEvidenceResult {
  const title = sourceOf("title", input.title ?? "");
  const description = sourceOf("description", input.description ?? "");
  const titleOnly = [title];
  const sources = [title, description].filter((source) => source.normalized.length > 0);
  const allText = `${title.normalized} ${description.normalized}`.trim();
  const allCompact = allText.replace(/\s+/g, "");
  const fullSizeHeadphone = hasFullSizeHeadphoneContext(allText);
  const facts: EarphoneConditionEvidence[] = [];

  const add = (
    signal: EarphoneConditionSignal,
    severity: EarphoneConditionSeverity,
    confidence: number,
    evidence: Pick<EarphoneConditionEvidence, "source" | "evidence"> | null,
  ) => {
    if (!evidence) return;
    if (facts.some((fact) => fact.signal === signal)) return;
    facts.push({
      signal,
      severity,
      confidence,
      source: evidence.source,
      evidence: evidence.evidence,
    });
  };

  const noAncVariantEvidence = firstEvidence(sources, [
    /노캔\s*(?:x|없|아님|아니|ㄴㄴ|노노|미지원|안\s*되는|안되는|안\s*됨|안됨)/,
    /노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)\s*(?:x|없|아님|아니|미지원|안\s*되는|안되는|안\s*됨|안됨)/,
    /anc\s*(?:x|no|없|미지원)/,
    /비\s*노캔|비노캔/,
  ]);
  if (noAncVariantEvidence || /노캔(?:안되는|안돼|없는|x|ㄴㄴ|노노|미지원)|노이즈캔슬링(?:안되는|안돼)|ancx/.test(allCompact)) {
    add("no_anc_variant", "variant", 0.95, noAncVariantEvidence ?? { source: "description", evidence: "no_anc compact signal" });
  }

  add("negated_defect", "negation", 0.8, firstEvidence(sources, [
    /(?:하자|고장|불량|문제|이상|잡음|지지직|노캔|마이크|페어링|연결|충전).{0,24}(?:없|없음|없습니다|없어요|아님|아닙니다|정상|잘\s*(?:됨|됩니다|작동))/,
    /(?:정상|문제\s*없|이상\s*없).{0,24}(?:작동|페어링|연결|소리|음질|마이크|노캔|충전)/,
  ]));

  add("single_side_unit", "block_candidate", 0.98, firstEvidence(titleOnly, [
    /(?:^|[\s/[,(])(?:왼쪽(?:만)?|오른쪽(?:만)?|좌측(?:만)?|우측(?:만)?|왼유닛|오른유닛|left\s*only|right\s*only|l\s*유닛|r\s*유닛|한\s*쪽만|한쪽만)(?:[\s\]/,).]|$)/,
  ]));
  add("single_side_unit", "block_candidate", 0.9, firstEvidence(sources, [
    /(?:왼쪽|오른쪽|좌측|우측).{0,16}(?:잃어|분실|없|미포함|고장|불량)/,
    /(?:잃어|분실|없|미포함).{0,16}(?:왼쪽|오른쪽|좌측|우측)/,
  ]));

  add("charging_case_only", "block_candidate", 0.98, firstEvidence(sources, [
    /(?:충전\s*)?케이스\s*(?:만|단품|판매|팝니다)/,
    /유닛\s*(?:없|미포함|분실).{0,18}(?:충전\s*)?케이스/,
    /(?:충전\s*)?케이스.{0,18}유닛\s*(?:없|미포함|분실)/,
  ]));

  const protectiveCaseEvidence = firstEvidence(titleOnly, [
    /보호\s*케이스|케이스\s*커버|실리콘\s*케이스|케이스티파이|case\s*cover/,
  ]);
  const hasChargingCaseContext = /충전\s*케이스|charging\s*case/.test(allText);
  if (!hasChargingCaseContext) {
    add("protective_case_only", "block_candidate", 0.9, protectiveCaseEvidence);
  }

  const audioEvidence = firstEvidence(sources, [
    /지지직|잡음|화이트\s*노이즈|소리.{0,18}(?:안\s*나|안나|안\s*들|작게\s*나|먹먹|끊|튀|깨짐|이상\s*있|문제\s*있|불량)|(?:한쪽|왼쪽|오른쪽).{0,18}(?:안\s*들|소리\s*안|소리\s*작)|음질.{0,16}(?:이상\s*있|문제\s*있|깨짐|먹먹|불량)/,
  ]);
  const audioNegated = hasAny(sources, [
    /(?:소리|음질|스피커|좌우).{0,28}(?:이상\s*(?:없|전혀\s*없|아예\s*없)|문제\s*(?:없|전혀\s*없|아예\s*없)|정상|잘\s*(?:됨|됩니다|들|들립|나|납니다)|좋|깨끗)/,
  ]);
  if (!audioNegated) {
    add("audio_output_issue", "block_candidate", 0.86, audioEvidence);
  }

  const ancEvidence = firstEvidence(sources, [
    /(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc|주변음|투명\s*모드).{0,28}(?:불량|고장|문제\s*있|이상\s*있|안\s*됨|안됨|작동\s*안|지지직|잡음|먹통)/,
    /(?:불량|고장|문제\s*있|이상\s*있|안\s*됨|안됨|작동\s*안|지지직|잡음|먹통).{0,28}(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc|주변음|투명\s*모드)/,
  ]);
  const ancNegated = hasAny(sources, [
    /(?:노캔|노이즈\s*(?:캔슬링|켄슬링|캔슬|켄슬)|anc|주변음|투명\s*모드).{0,40}(?:정상|문제\s*(?:없|전혀\s*없|아예\s*없)|이상\s*(?:없|전혀\s*없|아예\s*없)|잘\s*(?:됨|됩니다|되|되고|작동))/,
  ]);
  if (!facts.some((fact) => fact.signal === "no_anc_variant") && !ancNegated) {
    add("anc_or_transparency_issue", "block_candidate", 0.86, ancEvidence);
  }

  const micEvidence = firstEvidence(sources, [
    /마이크.{0,24}(?:이상|불량|안\s*됨|안됨|문제|고장|먹통|소리\s*작|작동\s*안)/,
    /(?:통화|전화).{0,24}(?:불량|안\s*됨|안됨|문제|상대방.{0,8}안\s*들)/,
  ]);
  const micNegated = hasAny(sources, [
    /(?:마이크|통화|전화).{0,20}(?:정상|문제\s*없|이상\s*없|잘\s*됨|잘\s*됩니다)/,
  ]);
  if (!micNegated) {
    add("mic_issue", "block_candidate", 0.88, micEvidence);
  }

  const pairingEvidence = firstEvidence(sources, [
    /(?:페어링|연결|블루투스).{0,24}(?:안\s*됨|안됨|불량|문제|끊김|끊겨|먹통|인식\s*불|불안정)/,
    /(?:안\s*됨|안됨|불량|문제|끊김|끊겨|먹통|인식\s*불|불안정).{0,24}(?:페어링|연결|블루투스)/,
  ]);
  const pairingNegated = hasAny(sources, [
    /(?:페어링|연결|블루투스).{0,20}(?:정상|문제\s*없|이상\s*없|잘\s*됨|잘\s*됩니다)/,
  ]);
  if (!pairingNegated) {
    add("pairing_or_connection_issue", "block_candidate", 0.88, pairingEvidence);
  }

  const batteryEvidence = firstEvidence(sources, [
    /배터리.{0,24}(?:빨리\s*닳|광탈|방전|오래\s*못|짧|효율\s*(?:낮|나쁨|안\s*좋))/,
    /충전.{0,24}(?:안\s*됨|안됨|불량|문제|인식\s*불|안\s*되|느림)/,
    /광탈|방전\s*(?:됨|됩니다|심|빠름)/,
  ]);
  const batteryNegated = hasAny(sources, [
    /(?:배터리|충전).{0,20}(?:정상|문제\s*없|이상\s*없|잘\s*됨|잘\s*됩니다|오래\s*감)/,
  ]);
  if (!batteryNegated) {
    add("battery_degraded", "block_candidate", 0.82, batteryEvidence);
  }

  const physicalEvidence = firstEvidence(sources, [
    /깨졌|깨짐|깨진|깨져|파손|크랙|금\s*갔|부러|휘어|침수|찍힘\s*심|떨어(?:뜨|트)림|떨어트(?:려|린)|안\s*닫|안닫|닫힘\s*불량|닫히지\s*(?:않|안)/,
    /(?:이어팁|쿠션|헤드밴드|케이블|충전|힌지|유닛|본체|케이스).{0,18}(?:깨졌|깨짐|깨진|깨져|파손|크랙|부러|찢어|안\s*닫|안닫)/,
  ]);
  const physicalNegated = hasAny(sources, [
    /(?:깨짐|파손|크랙|찍힘|침수|수리|하자).{0,16}(?:없|없음|없습니다|아님)|(?:기스|스크래치).{0,12}(?:없|없음|없습니다)|(?:외관|본체|케이스|상태).{0,16}(?:깨끗|깔끔)|깨끗(?:하게|한|합니다)?/,
  ]);
  if (!physicalNegated) {
    add("physical_damage", "block_candidate", 0.86, physicalEvidence);
  }

  const hygieneEvidence = firstEvidence(sources, [
    /오염|이염|얼룩|때\s*탐|때탐|화장품|냄새|담배|땀|이어팁.{0,12}(?:더러|오염)|쿠션.{0,12}(?:더러|오염)|헤드밴드.{0,12}(?:더러|오염)/,
  ]);
  const hygieneNegated = hasAny(sources, [
    /(?:오염|이염|얼룩|냄새|때\s*탐|때탐).{0,16}(?:없|없음|없습니다|아님|깨끗)/,
  ]);
  if (!hygieneNegated) {
    add("hygiene_or_stain", "warning", 0.75, hygieneEvidence);
  }

  const missingPartsEvidence = firstEvidence(sources, [
    /(?:박스|케이블|이어팁|구성품|충전기|파우치|케이스).{0,12}(?:없|없음|미포함|분실|제외)/,
    /풀박\s*(?:x|아님|아니)|구성품\s*(?:일부|없)/,
    /본체만|단품/,
  ]);
  add("missing_parts", "warning", fullSizeHeadphone ? 0.65 : 0.74, missingPartsEvidence);

  add("full_set_positive", "positive", 0.88, firstEvidence(sources, [
    /풀박스|풀박|풀구성|풀세트|구성품\s*(?:전부|모두)|박스\s*포함|케이블\s*포함|이어팁\s*포함/,
  ]));

  add("new_positive", "positive", 0.84, firstEvidence(sources, [
    /미개봉|미\s*개봉|새상품|미사용|단순개봉|박스\s*미개봉|개봉\s*안\s*함|한번도\s*사용/,
  ]));

  if (/유닛없이충전케이스|유닛없(?:는|음)?충전케이스/.test(allCompact)) {
    add("charging_case_only", "block_candidate", 0.98, { source: "description", evidence: "유닛 없이 충전케이스" });
  }

  const hardBlockCandidates = facts
    .filter((fact) => fact.severity === "block_candidate")
    .map((fact) => fact.signal);
  const warningSignals = facts
    .filter((fact) => fact.severity === "warning")
    .map((fact) => fact.signal);
  const positiveSignals = facts
    .filter((fact) => fact.severity === "positive")
    .map((fact) => fact.signal);

  return {
    version: EARPHONE_CONDITION_EVIDENCE_VERSION,
    signals: unique(facts.map((fact) => fact.signal)),
    facts,
    hardBlockCandidates: unique(hardBlockCandidates),
    warningSignals: unique(warningSignals),
    positiveSignals: unique(positiveSignals),
  };
}
