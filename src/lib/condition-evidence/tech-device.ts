export const TECH_DEVICE_CONDITION_EVIDENCE_VERSION = "tech-device-condition-evidence-v4";

export type TechDeviceConditionSignal =
  | "display_panel_issue"
  | "body_or_back_glass_damage"
  | "foldable_hinge_or_inner_damage"
  | "touch_issue"
  | "screen_replaced_or_repaired"
  | "faceid_or_biometric_issue"
  | "camera_issue"
  | "camera_lens_or_glass_damage"
  | "speaker_or_mic_issue"
  | "charging_or_sensor_issue"
  | "account_or_activation_lock"
  | "carrier_or_finance_risk"
  | "water_damage"
  | "parts_or_repair_only"
  | "unofficial_or_partial_repair"
  | "battery_service_needed"
  | "low_battery_health"
  | "high_battery_cycles"
  | "cosmetic_wear"
  | "missing_parts"
  | "applecare_or_warranty"
  | "factory_refurbished"
  | "battery_high_health"
  | "battery_perfect"
  | "unlocked_reset_positive"
  | "normal_function_positive"
  | "negated_defect";

export type TechDeviceConditionSeverity =
  | "block_candidate"
  | "warning"
  | "positive"
  | "negation";

export type TechDeviceConditionEvidence = {
  signal: TechDeviceConditionSignal;
  severity: TechDeviceConditionSeverity;
  source: "title" | "description";
  confidence: number;
  evidence: string;
};

export type TechDeviceConditionEvidenceResult = {
  version: typeof TECH_DEVICE_CONDITION_EVIDENCE_VERSION;
  signals: TechDeviceConditionSignal[];
  facts: TechDeviceConditionEvidence[];
  hardBlockCandidates: TechDeviceConditionSignal[];
  warningSignals: TechDeviceConditionSignal[];
  positiveSignals: TechDeviceConditionSignal[];
};

type TextSource = {
  source: TechDeviceConditionEvidence["source"];
  normalized: string;
  compact: string;
};

function normalizeTechDeviceText(text: string) {
  return (text ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/face[\s_-]*id/g, "faceid")
    .replace(/touch[\s_-]*id/g, "touchid")
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ%./\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceOf(source: TechDeviceConditionEvidence["source"], raw: string): TextSource {
  const normalized = normalizeTechDeviceText(raw);
  return {
    source,
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
): Pick<TechDeviceConditionEvidence, "source" | "evidence"> | null {
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

function parsePercentFromText(allText: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);
    const match = re.exec(allText);
    const num = Number(match?.[1]);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function parseCyclesFromText(allText: string) {
  const match = /(?:사이클|cycle).{0,8}?(\d{1,4})\s*(?:회|번)?/.exec(allText);
  const num = Number(match?.[1]);
  return Number.isFinite(num) ? num : null;
}

const BACK_BODY_SURFACE =
  "(?:뒷판|뒤판|뒷면|후면\\s*유리|후면유리|백\\s*글라스|백글라스|후면)";
const BODY_FRAME_SURFACE = "(?:프레임|테두리|하우징|외관)";
const EDGE_SURFACE = "(?:모서리|코너|상단부|하단부|좌측\\s*하단|오른쪽\\s*하단|우측\\s*하단|왼쪽\\s*하단|상단|하단)";
const STRONG_BREAKAGE =
  "(?:깨졌|깨져|깨진|깨짐|깨져서|깨져\\s*있|깨져있|파손|크랙|금\\s*갔|금\\s*감|금이\\s*갔|금이\\s*감)";
const STRUCTURAL_FRAME_DAMAGE =
  "(?:찌그러|휘어|함몰|벌어짐|들뜸|파손|크랙|금\\s*갔|금이\\s*갔)";
const HINGE_SURFACE = "(?:힌지|흰지|접히는\\s*부분|접는\\s*부분|가운데|내부\\s*액정|내부액정|안쪽\\s*액정)";
const HINGE_DAMAGE =
  "(?:검은\\s*(?:색\\s*)?(?:점|반점)|검은점|흑점|반점|주름|멍|세로줄|가로줄|줄\\s*감|액정\\s*불빛|화면\\s*나가|화면나가|불량|파손|크랙|벌어짐|들뜸|안\\s*펴|안펴|안\\s*접|안접|유격|헐거)";
const CAMERA_LENS_SURFACE =
  "(?:카메라\\s*(?:렌즈|유리|커버|보호\\s*유리|보호유리)|카메라렌즈|렌즈\\s*(?:유리|커버|부)?|렌즈부)";
const CAMERA_LENS_DAMAGE =
  "(?:깨졌|깨져|깨진|깨짐|깨져서|파손|크랙|금\\s*갔|금\\s*감|금이\\s*갔|금이\\s*감|큰\\s*흠집|흠집\\s*(?:크|심|깊)|찍힘\\s*(?:크|심)|멍\\s*\\d*\\s*개|멍\\s*(?:있|있음|생|보))";

function re(source: string) {
  return new RegExp(source);
}

export function parseTechDeviceConditionEvidence(input: {
  title: string;
  description?: string | null;
}): TechDeviceConditionEvidenceResult {
  const title = sourceOf("title", input.title ?? "");
  const description = sourceOf("description", input.description ?? "");
  const sources = [title, description].filter((source) => source.normalized.length > 0);
  const allText = `${title.normalized} ${description.normalized}`.trim();
  const facts: TechDeviceConditionEvidence[] = [];

  const add = (
    signal: TechDeviceConditionSignal,
    severity: TechDeviceConditionSeverity,
    confidence: number,
    evidence: Pick<TechDeviceConditionEvidence, "source" | "evidence"> | null,
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

  add("negated_defect", "negation", 0.8, firstEvidence(sources, [
    /(?:잔상|번인|멍|흑점|데드\s*픽셀|터치|페이스\s*아이디|faceid|카메라|스피커|마이크|침수|분실|도난|잠금|락|하자|고장|불량|문제|수리|교체).{0,30}(?:없|없음|없습니다|전혀\s*없|아예\s*없|아님|아닙니다|정상|이상무|잘\s*(?:됨|됩니다|작동))/,
    /(?:기능|전기능|모든\s*기능).{0,18}(?:정상|문제\s*없|이상\s*없|이상무)/,
  ]));

  const displayNegated = hasAny(sources, [
    /무잔상|잔상\s*(?:없|없음|없습니다|전혀\s*없|양호|정상)|잔상을\s*제외|잔상\s*제외|번인\s*(?:없|없음|없습니다|전혀\s*없)|(?:액정|화면|디스플레이).{0,18}(?:하자|문제|파손|깨짐|깨진\s*곳|깨진곳|멍|흑점|검은\s*(?:색\s*)?(?:점|반점)|불량\s*화소|불량|기스|손상).{0,12}(?:없|없음|없습니다|없이|아님)/,
    /(?:잔상|백화|노화\s*증상).{0,24}(?:없|없음|없습니다|전혀\s*없|없이)/,
    /(?:액정|화면|디스플레이|스크린).{0,18}(?:깨진\s*것|깨진거|깨짐|파손).{0,16}(?:아니|아님|아닙|필름)|(?:깨진\s*것|깨진거|깨짐|파손).{0,12}(?:필름).{0,16}(?:액정\s*x|액정\s*아님|액정\s*아니)/,
    /(?:화면|액정|디스플레이|스크린).{0,12}깨진\s*거\s*처럼.{0,40}(?:없|없음|없습니다|아님|아니)|(?:화면|액정|디스플레이|스크린).{0,20}깨지거나.{0,20}(?:없|없음|없습니다)/,
    /(?:고객\s*부주의|본인\s*과실|기능\s*문제가\s*아닌).{0,50}(?:액정\s*나감|액정나감|꺼짐|멍).{0,50}(?:교환|환불|반품).{0,12}불가/,
    /(?:액정|화면|디스플레이|스크린).{0,12}(?:멀쩡|정상|깨끗).{0,30}(?:보호\s*)?(?:필름|강화\s*유리).{0,14}(?:깨짐|깨져|파손|크랙|기스|금)/,
  ]);
  const protectiveScreenOnly = /(?:보호\s*)?(?:필름|강화\s*유리).{0,14}(?:깨짐|파손|크랙|기스|금)/.test(allText)
    && /(?:본체\s*)?(?:액정|화면|디스플레이|스크린).{0,12}(?:정상|멀쩡|깨끗)/.test(allText);
  const displaySurfaceHint = /액정|화면|디스플레이|스크린|패널|lcd|oled|내부|전면|바탕/;
  const nonDisplaySurfaceHint = /뒷면|후면|뒷판|뒤판|백글라스|테두리|프레임|하우징/;
  const removeNonDisplaySurfaceNoise = (evidence: Pick<TechDeviceConditionEvidence, "source" | "evidence"> | null) => {
    if (!evidence) return null;
    if (nonDisplaySurfaceHint.test(evidence.evidence) && !displaySurfaceHint.test(evidence.evidence)) return null;
    return evidence;
  };
  const removeNegatedDisplayEvidence = (evidence: Pick<TechDeviceConditionEvidence, "source" | "evidence"> | null) => {
    if (!evidence) return null;
    if (/(?:하자|문제|파손|깨짐|불량|멍|흑점|잔상|번인|색\s*번짐|색번짐).{0,12}(?:없|없음|없습니다|없이|아님)/.test(evidence.evidence)) return null;
    if (/크랙\s*버전|크랙버전|crack\s*version/.test(evidence.evidence)) return null;
    if (/(?:측면|모서리|프레임|테두리).{0,24}(?:이\s*가\s*나가|이가나가)/.test(evidence.evidence)) return null;
    return evidence;
  };
  const visibleDisplayIssue = removeNegatedDisplayEvidence(removeNonDisplaySurfaceNoise(firstEvidence(sources, [
    /(?:접으면|접을\s*때|접힌\s*상태).{0,24}(?:화면\s*나가|화면나가|꺼짐|안\s*나오|나오지\s*않|불량)/,
    /(?:검은\s*(?:색\s*)?(?:점|반점)|검은점|흑점|붉은\s*(?:점|반점)|붉은점|반점|불량\s*화소).{0,12}(?:있|생|보|발견|나타)|(?:있|생|보|발견|나타).{0,12}(?:검은\s*(?:색\s*)?(?:점|반점)|검은점|흑점|붉은\s*(?:점|반점)|붉은점|반점|불량\s*화소)/,
    /멍.{0,8}(?:있|생|보|발견|나타)|(?:있|생|보|발견|나타).{0,8}멍/,
    /액정\s*불빛|불빛\s*나타/,
    /(?:액정|화면|디스플레이|스크린|패널).{0,18}(?:나감|나갔|나가|먹통|불량|색\s*번짐|색번짐)/,
  ])));
  if (!displayNegated && !protectiveScreenOnly) {
    add("display_panel_issue", "block_candidate", 0.9, removeNegatedDisplayEvidence(removeNonDisplaySurfaceNoise(firstEvidence(sources, [
      /(?:접으면|접을\s*때|접힌\s*상태).{0,24}(?:화면\s*나가|화면나가|꺼짐|안\s*나오|나오지\s*않|불량)/,
      /잔상|번인|burn\s*in|녹조|흑점|검은\s*(?:색\s*)?(?:점|반점)|검은점|붉은\s*(?:점|반점)|붉은점|반점|(?:액정|화면|디스플레이|스크린|패널).{0,18}멍|멍.{0,18}(?:액정|화면|디스플레이|스크린|패널)|색\s*번짐|색번짐|흰\s*점|흰\s*영역|흰\s*스팟|데드\s*픽셀|dead\s*pixel|불량\s*화소|화면\s*황변|액정\s*황변|액정\s*불빛|불빛\s*나타|화면\s*x|화면.{0,12}들어오지\s*않|화면.{0,12}안\s*들어/,
      /(?:액정|화면|디스플레이|스크린|유리|패널).{0,18}(?:깨짐|깨졌|깨진|깨져|파손|크랙|금\s*갔|나감|나갔|나가|먹통|불량)/,
      /(?:깨짐|깨졌|깨진|깨져|파손|크랙|금\s*갔|나감|나갔|나가|먹통|불량).{0,18}(?:액정|화면|디스플레이|스크린|유리|패널)/,
    ]))));
  } else if (!protectiveScreenOnly && visibleDisplayIssue) {
    add("display_panel_issue", "block_candidate", 0.9, visibleDisplayIssue);
  }

  const bodyDamageNegated = hasAny(sources, [
    /(?:파손|깨짐|고장).{0,12}(?:동의|면책).{0,18}(?:택배|배송)|(?:택배|배송).{0,18}(?:파손|깨짐|고장).{0,12}(?:동의|면책|우려|위험)/,
    /(?:고객\s*부주의|본인\s*과실|단순\s*변심).{0,30}(?:파손|침수|충격).{0,30}(?:교환|환불|반품).{0,12}불가/,
    re(`${BACK_BODY_SURFACE}.{0,24}(?:깨끗|깔끔|정상|${STRONG_BREAKAGE}\\s*(?:없|없음|없습니다|없고|없이|아님|아닙니다)|기스\\s*(?:없|없음)|찍힘\\s*(?:없|없음))`),
    re(`(?:${STRONG_BREAKAGE}|기스|찍힘).{0,16}(?:없|없음|없습니다|없고|없이|아님|아닙니다).{0,18}${BACK_BODY_SURFACE}`),
    re(`${BODY_FRAME_SURFACE}.{0,30}(?:깨끗|깔끔|정상|파손\\s*(?:없|없음|전혀\\s*없)|찍힘.{0,12}파손.{0,12}(?:없|전혀\\s*없)|크랙\\s*(?:없|없음)|유격\\s*(?:없|없음))`),
    re(`${EDGE_SURFACE}.{0,24}(?:깨끗|깔끔|정상|${STRONG_BREAKAGE}\\s*(?:없|없음|없습니다|없고|없이|아님|아닙니다)|찍힘\\s*(?:없|없음)|기스\\s*(?:없|없음)|파손\\s*(?:없|없음))`),
    /휨.{0,12}(?:없|없음|없습니다|없이|아님)|휘어.{0,12}(?:없|없음|없습니다|있지\s*않)/,
  ]);
  if (!bodyDamageNegated) {
    const bodyDamageEvidence = firstEvidence(sources, [
      re(`${BACK_BODY_SURFACE}.{0,20}${STRONG_BREAKAGE}`),
      re(`${STRONG_BREAKAGE}.{0,20}${BACK_BODY_SURFACE}`),
      re(`${BODY_FRAME_SURFACE}.{0,20}${STRUCTURAL_FRAME_DAMAGE}`),
      re(`${STRUCTURAL_FRAME_DAMAGE}.{0,20}${BODY_FRAME_SURFACE}`),
      /(?:측면|모서리|테두리|프레임).{0,18}(?:이\s*가\s*나가|이가나가)/,
      /(?:이\s*가\s*나가|이가나가).{0,18}(?:측면|모서리|테두리|프레임)/,
      re(`${EDGE_SURFACE}.{0,16}${STRONG_BREAKAGE}`),
      re(`${STRONG_BREAKAGE}.{0,16}${EDGE_SURFACE}`),
      /휨\s*증상|휘어\s*있|휘었|휜\s*상태/,
    ]);
    const displayOnlyDamage = bodyDamageEvidence
      && displaySurfaceHint.test(bodyDamageEvidence.evidence)
      && !nonDisplaySurfaceHint.test(bodyDamageEvidence.evidence);
    add("body_or_back_glass_damage", "block_candidate", 0.9, displayOnlyDamage ? null : bodyDamageEvidence);
  }

  const hingeDamageNegated = hasAny(sources, [
    re(`${HINGE_SURFACE}.{0,28}(?:정상|문제\\s*없|이상\\s*없|깨끗|깔끔|유격\\s*없|벌어짐\\s*없|반점\\s*없|검은\\s*(?:색\\s*)?(?:점|반점)\\s*없)`),
    re(`(?:정상|문제\\s*없|이상\\s*없|깨끗|깔끔).{0,16}${HINGE_SURFACE}`),
  ]);
  if (!hingeDamageNegated) {
    add("foldable_hinge_or_inner_damage", "block_candidate", 0.92, firstEvidence(sources, [
      re(`${HINGE_SURFACE}.{0,28}${HINGE_DAMAGE}`),
      re(`${HINGE_DAMAGE}.{0,28}${HINGE_SURFACE}`),
      /(?:접으면|접을\s*때|접힌\s*상태).{0,24}(?:화면\s*나가|화면나가|꺼짐|안\s*나오|나오지\s*않|불량)/,
      /(?:내부\s*액정|내부액정|안쪽\s*액정|메인\s*액정).{0,24}(?:하부|고무|베젤).{0,16}(?:없|없음|떨어짐|분리)/,
    ]));
  }

  const touchNegated = hasAny(sources, [
    /터치.{0,20}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|먹))/,
    /터치.{0,24}(?:오작동|불량|문제).{0,8}(?:x|없|없음|없습니다|아님)/,
    /터치\s*(?:바|패드).{0,24}(?:a급|s급|정상|깨끗|깔끔|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동)|사용한\s*적\s*없)/,
    /(?:확인|눈으로\s*확인).{0,12}안\s*됨.{0,16}터치\s*바/,
    /(?:기능|기능적|기능적으로|전기능|모든\s*기능).{0,30}문제\s*(?:전혀|아예)?\s*없.{0,30}터치.{0,20}(?:반응\s*)?(?:완벽|정상|잘\s*됨|잘\s*됩니다)/,
  ]);
  if (!touchNegated) {
    add("touch_issue", "block_candidate", 0.9, firstEvidence(sources, [
      /터치(?!\s*(?:바|패드)).{0,20}(?:불량|안\s*됨|안됨|먹통|문제|이상|안\s*먹|오작동)/,
      /(?:터치\s*바|터치바|터치\s*패드|터치패드).{0,20}(?:불량|안\s*됨|안됨|먹통|문제|이상|안\s*먹|오작동)/,
      /(?:불량|안\s*됨|안됨|먹통|문제|이상|안\s*먹|오작동).{0,20}터치(?!\s*(?:바|패드))/,
    ]));
  }

  const protectiveFilmContext = /(?:보호\s*)?(?:필름|강화\s*유리).{0,12}(?:깨짐|파손|크랙|기스|금)/.test(allText);
  const screenRepairNegated = hasAny(sources, [
    /(?:수리|교체|사설\s*수리|자가\s*수리).{0,18}(?:없|없음|없습니다|없고|무|x|안\s*함|안함)|(?:수리\s*내역|수리내역|수리\s*이력|수리이력).{0,12}(?:없|없음|없습니다|없고|무|x)/,
    /(?:공식|애플\s*스토어|애플스토어|공식\s*센터|서비스\s*센터).{0,30}(?:배터리|키캡|키보드).{0,20}교체.{0,36}(?:화면|액정|디스플레이|스크린).{0,20}(?:잘\s*나오|정상|깨끗|기스\s*없)/,
    /(?:시계줄|워치\s*줄|줄|스트랩|밴드).{0,28}(?:교체|바꾸|변경)/,
  ]);
  const filmOrProtectorReplacementOnly =
    /(?:보호\s*)?(?:필름|강화\s*유리|강화유리|액정필름|유리필름).{0,18}(?:교체|붙|부착)/.test(allText)
    && !/(?:액정|화면|디스플레이|패널|유리).{0,18}(?:사설\s*)?(?:교체|수리)/.test(
      allText.replace(/(?:보호\s*)?(?:필름|강화\s*유리|강화유리|액정필름|유리필름).{0,24}(?:교체|붙|부착)/g, ""),
    );
  if (!protectiveFilmContext && !screenRepairNegated && !filmOrProtectorReplacementOnly) {
    add("screen_replaced_or_repaired", "block_candidate", 0.88, firstEvidence(sources, [
      /(?:액정|화면|디스플레이|스크린|패널|유리).{0,18}(?:교체|수리|사설\s*수리|자가\s*수리)/,
      /(?:교체|수리|사설\s*수리|자가\s*수리).{0,18}(?:액정|화면|디스플레이|스크린|패널|유리)/,
    ]));
  }

  const biometricNegated = hasAny(sources, [
    /(?:페이스\s*아이디|faceid|터치\s*아이디|touchid|지문(?!\s*방지)).{0,28}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동))/,
    /(?:키보드|외관|상판|하판|액정|화면|필름).{0,18}지문|지문.{0,18}(?:닦|묻|자국|흔적|방지\s*필름|필름)/,
  ]);
  if (!biometricNegated) {
    add("faceid_or_biometric_issue", "block_candidate", 0.9, firstEvidence(sources, [
      /(?:페이스\s*아이디|faceid|터치\s*아이디|touchid|지문(?!\s*방지)).{0,24}(?:안\s*됨|안됨|불가|고장|불량|문제|수리|먹통)/,
      /(?:안\s*됨|안됨|불가|고장|불량|문제|수리|먹통).{0,24}(?:페이스\s*아이디|faceid|터치\s*아이디|touchid|지문(?!\s*방지))/,
    ]));
  }

  const cameraNegated = hasAny(sources, [
    /(?:카메라|전면|후면|초점).{0,24}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동)|무음)|(?:기능|전기능|모든\s*기능).{0,18}(?:정상|문제\s*없|이상\s*없|이상무)/,
    /(?:카메라|전면|후면|초점).{0,24}(?:이상|문제|불량|고장).{0,12}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)/,
    /(?:문제|하자).{0,8}(?:없|없는|없음|없습니다|없어요)|(?:기능|전기능|모든\s*기능).{0,30}(?:문제|하자).{0,8}(?:없|없는|없음|없습니다|없어요)/,
  ]);
  if (!cameraNegated) {
    add("camera_issue", "block_candidate", 0.88, firstEvidence(sources, [
      /(?:카메라|전면|후면).{0,24}(?:안\s*됨|안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량|먹통|문제)/,
      /(?:안\s*됨|안됨|불가|고장|불량|흔들림|초점\s*불량|초점불량|먹통).{0,24}(?:카메라|전면|후면)/,
    ]));
  }

  const cameraLensDamageNegated = hasAny(sources, [
    /(?:카메라|렌즈).{0,28}(?:기스|흠집|찍힘|깨짐|깨진|깨져|파손|크랙|금|멍|문제|이상|불량).{0,14}(?:없|없음|없습니다|없어요|없이|아님|아닙니다|x)/,
    /(?:카메라|렌즈).{0,18}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동)|무음)/,
    /카메라\s*보호\s*필름|카메라보호필름|렌즈\s*보호\s*필름|렌즈보호필름/,
    /카메라\s*섬\s*주변.{0,16}(?:생활\s*기스|기스\s*정도|미세\s*기스)/,
  ]);
  if (!cameraLensDamageNegated) {
    add("camera_lens_or_glass_damage", "block_candidate", 0.88, firstEvidence(sources, [
      re(`${CAMERA_LENS_SURFACE}.{0,24}${CAMERA_LENS_DAMAGE}`),
      re(`${CAMERA_LENS_DAMAGE}.{0,24}${CAMERA_LENS_SURFACE}`),
      /(?:카메라|렌즈).{0,18}멍.{0,16}(?:있|있음|나|보|생|\d+\s*개)/,
      /(?:카메라|렌즈).{0,20}(?:커버|유리).{0,20}(?:크게|큰|심한|깊은).{0,12}(?:흠집|기스|찍힘)/,
    ]));
  }

  const audioNegated = hasAny(sources, [
    /(?:스피커|마이크|통화|소리|음성).{0,24}(?:정상|문제\s*없|이상\s*없|이상무|잘\s*(?:됨|됩니다|들|들림|작동))|(?:기능|전기능|모든\s*기능).{0,18}(?:정상|문제\s*없|이상\s*없|이상무)/,
  ]);
  if (!audioNegated) {
    add("speaker_or_mic_issue", "block_candidate", 0.82, firstEvidence(sources, [
      /(?:스피커|마이크|통화|소리|음성).{0,24}(?:안\s*됨|안됨|불량|고장|문제|먹통|잡음|지지직)/,
      /(?:소리|음성|통화).{0,12}이상|이상한\s*(?:소리|음성)|(?:스피커|마이크).{0,8}이상\s*(?:있|있음|발생|생김|납니다|나요)/,
      /(?:스피커|마이크|소리|음성).{0,24}(?:찢어지|찢어지는|잡음|지지직)|(?:찢어지|찢어지는|잡음|지지직).{0,24}(?:스피커|마이크|소리|음성)/,
      /(?:안\s*됨|안됨|불량|고장|문제|먹통|잡음|지지직).{0,24}(?:스피커|마이크|통화|소리|음성)/,
    ]));
  }

  const chargingOrSensorNegated = hasAny(sources, [
    /(?:충전기|충전\s*기|충전독|충전\s*독|충전케이블|충전\s*케이블|케이블).{0,16}(?:없|없음|없습니다|분실|미포함|제외)/,
    /(?:충전|충전\s*단자|충전단자|센서|주변광).{0,24}(?:정상|문제\s*없|이상\s*없|잘\s*(?:됨|됩니다|작동))/,
    /(?:썬더볼트|thunderbolt|usb).{0,16}(?:단자|포트).{0,16}(?:\d+\s*개|지원|가능|있|구성)|(?:단자|포트).{0,12}\d+\s*개/,
    /(?:기능|기능적|기능적으로|전기능|모든\s*기능).{0,30}(?:정상|문제\s*없|이상\s*없|이상무)/,
  ]);
  if (!chargingOrSensorNegated) {
    add("charging_or_sensor_issue", "block_candidate", 0.86, firstEvidence(sources, [
      /(?:충전\s*단자|충전단자|충전\s*포트|충전포트).{0,24}(?:고장|불량|문제|안\s*됨|안됨|안\s*되|인식\s*불|수리)/,
      /충전(?!기|기없|기\s*없|케이블|어댑터|젠더|독|독은|독\s*은|dock)[^.\n]{0,24}(?:안\s*됨|안됨|안\s*되|불량|고장|문제|인식\s*불)/,
      /(?:주변광|광\s*센서|광센서|센서).{0,24}(?:문제|불량|고장|안\s*됨|안됨|안\s*되)/,
    ]));
  }

  const unlockPositive = firstEvidence(sources, [
    /정상\s*해지|확정\s*기변|선택\s*약정\s*(?:가능|됨)|선약\s*(?:가능|됨)/,
    /(?:아이클라우드|icloud|구글\s*계정|삼성\s*계정).{0,18}(?:로그아웃|해제).{0,18}(?:완료|됨|했습니다)/,
    /초기화\s*완료|공장\s*초기화\s*완료/,
  ]);
  add("unlocked_reset_positive", "positive", 0.9, unlockPositive);

  const lockNegated = hasAny(sources, [
    /분실\s*(?:없|없음|신고\s*없)|도난\s*(?:없|없음)|분실.{0,8}도난.{0,16}검수\s*완료|정상\s*해지|확정\s*기변|초기화\s*완료/,
    /(?:아이클라우드|icloud|구글\s*계정|삼성\s*계정).{0,18}(?:로그아웃|해제).{0,18}(?:완료|됨|했습니다)/,
  ]);
  if (!lockNegated) {
    add("account_or_activation_lock", "block_candidate", 0.95, firstEvidence(sources, [
      /(?:아이클라우드|icloud|구글\s*계정|삼성\s*계정|계정).{0,24}(?:잠김|락|락걸림|해제\s*불가|초기화\s*불가|로그아웃\s*불가)/,
      /(?:잠김|락|락걸림|해제\s*불가|초기화\s*불가|로그아웃\s*불가).{0,24}(?:아이클라우드|icloud|구글\s*계정|삼성\s*계정|계정)/,
      /활성화\s*잠금|활성화.{0,18}(?:해제\s*안|해제가\s*안|해제\s*불가|잠금|락)/,
      /분실폰|도난폰|분실\s*신고|도난\s*신고/,
    ]));
  }

  const carrierRiskNegated = hasAny(sources, [
    /자급제.{0,24}가\s*개통\s*같은\s*거.{0,16}신경\s*안\s*쓰|가\s*개통\s*같은\s*거.{0,16}신경\s*안\s*쓰/,
  ]);
  if (!carrierRiskNegated) {
    add("carrier_or_finance_risk", "block_candidate", 0.85, firstEvidence(sources, [
      /(?:할부|미납|요금).{0,16}(?:남|있|미납|잔여)|(?:남은|잔여).{0,10}할부/,
      /(?:확정\s*기변|정상\s*해지|선택\s*약정|선약).{0,12}(?:불가|안\s*됨|안됨)/,
      /(?:유심|sim).{0,20}(?:인식\s*불|인식불|안\s*됨|안됨|불가|락)/,
      /가\s*개통|가개통|개통된\s*단말기|개통된단말기|선약\s*불가|선택약정.{0,8}불가능/,
    ]));
  }

  const waterNegated = hasAny(sources, [
    /침수(?:폰)?\s*(?:없|없음|없습니다|아님|취급하지|취급\s*안)|침수.{0,12}(?:이력|내역).{0,12}(?:없|없음|없습니다|전혀\s*없)|침수\s*라벨\s*(?:정상|깨끗)/,
    /(?:고객\s*부주의|본인\s*과실|단순\s*변심).{0,30}(?:파손|침수|충격).{0,30}(?:교환|환불|반품).{0,12}불가/,
  ]);
  if (!waterNegated) {
    add("water_damage", "block_candidate", 0.9, firstEvidence(sources, [
      /침수|물\s*들어|물먹|물\s*먹/,
    ]));
  }

  add("parts_or_repair_only", "block_candidate", 0.96, firstEvidence(sources, [
    /부품\s*용|부품용|파트\s*만|리퍼\s*부품|단자\s*만|힌지\s*부품|수리\s*용|수리용|셀러\s*용|셀러용|업자\s*용|업자용|보상\s*판매용|보상판매용/,
  ]));

  const unofficialRepairNegated = hasAny(sources, [
    /(?:사설|부분|일부|자가)\s*수리\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|안\s*함|안함|없이|절대\s*없이|한\s*적\s*없|한적\s*없)|(?:사설수리|부분수리|일부수리|자가수리)\s*(?:내역|이력)?\s*(?:당연히|전혀|아예)?\s*(?:없|없음|없습니다|x|무|안\s*함|안함|없이|절대\s*없이|한\s*적\s*없|한적\s*없)/,
  ]);
  if (!unofficialRepairNegated) {
    add("unofficial_or_partial_repair", "block_candidate", 0.86, firstEvidence(sources, [
      /(?:사설|부분|일부|자가)\s*수리|사설수리|부분수리|일부수리|자가수리/,
    ]));
  }

  const batteryHealth = parsePercentFromText(allText, [
    /(?:배터리|성능|효율|배터리\s*성능|배터리\s*효율).{0,10}(\d{2,3})\s*%/,
    /(\d{2,3})\s*%.{0,10}(?:배터리|성능|효율)/,
    /신품\s*대비.{0,10}(\d{2,3})\s*%?/,
  ]);
  const cycles = parseCyclesFromText(allText);
  if (batteryHealth != null) {
    const evidence = { source: "description" as const, evidence: `battery ${batteryHealth}%` };
    if (batteryHealth >= 100) add("battery_perfect", "positive", 0.95, evidence);
    else if (batteryHealth >= 95) add("battery_high_health", "positive", 0.9, evidence);
    else if (batteryHealth < 85) add("low_battery_health", "warning", 0.9, evidence);
  }
  if (cycles != null && cycles > 500) {
    add("high_battery_cycles", "warning", 0.8, { source: "description", evidence: `cycles ${cycles}` });
  }

  add("battery_service_needed", "warning", 0.82, firstEvidence(sources, [
    /배터리.{0,24}(?:서비스|교체\s*요망|교체\s*필요|광탈|빨리\s*닳|방전|오래\s*못|상태\s*나쁨)/,
  ]));

  const cosmeticNegated = hasAny(sources, [
    /(?:기스|스크래치|찍힘|흠집|외관).{0,16}(?:없|없음|없습니다|깨끗|깔끔)|사용감\s*(?:거의\s*)?(?:없|없음|적음|적은|미세)/,
  ]);
  if (!cosmeticNegated) {
    add("cosmetic_wear", "warning", 0.65, firstEvidence(sources, [
      /사용감\s*(?:있|많|심)|생활\s*기스|생활기스|기스|스크래치|찍힘|흠집|도장\s*까짐/,
    ]));
  }

  add("missing_parts", "warning", 0.7, firstEvidence(sources, [
    /(?:박스|충전기|케이블|스트랩|밴드|펜슬|구성품).{0,12}(?:없|없음|미포함|분실|제외)/,
    /본체만|단품/,
  ]));

  add("applecare_or_warranty", "positive", 0.82, firstEvidence(sources, [
    /애플\s?케어|애케플|애캐플|apple\s?care|ac\+|삼성\s?케어|보증\s*(?:남|있|가능)|무상\s*보증/,
  ]));

  const notRefurbished = /리퍼\s*(?:제품\s*)?(?:아님|아닙니다|아닌|아니고|아니며)/.test(allText);
  if (!notRefurbished) {
    add("factory_refurbished", "positive", 0.74, firstEvidence(sources, [
      /공식\s*리퍼|애플\s*리퍼|리퍼\s*(?:미개봉|제품|폰|교체)/,
    ]));
  }

  add("normal_function_positive", "positive", 0.75, firstEvidence(sources, [
    /(?:기능|전기능|모든\s*기능).{0,18}(?:정상|문제\s*없|이상\s*없|이상무)|정상\s*작동|작동\s*정상/,
    /(?:페이스\s*아이디|faceid|카메라|전면|후면|스피커|마이크|터치|액정|화면|디스플레이).{0,12}(?:정상|이상무)/,
  ]));

  const signals = unique(facts.map((fact) => fact.signal));
  return {
    version: TECH_DEVICE_CONDITION_EVIDENCE_VERSION,
    signals,
    facts,
    hardBlockCandidates: unique(facts.filter((fact) => fact.severity === "block_candidate").map((fact) => fact.signal)),
    warningSignals: unique(facts.filter((fact) => fact.severity === "warning").map((fact) => fact.signal)),
    positiveSignals: unique(facts.filter((fact) => fact.severity === "positive").map((fact) => fact.signal)),
  };
}
