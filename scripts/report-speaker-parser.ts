import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type Gate = "normal" | "accessory" | "damaged" | "parts" | "multi" | "buying" | "cross_category" | "unknown";

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "speaker_audio_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function nrm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compact(value: string): string {
  return nrm(value).replace(/[\s_\-./+]+/g, "");
}

function inc(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Number(((part / total) * 100).toFixed(1));
}

function rows(map: Map<string, number>): Array<{ key: string; count: number }> {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function markdownTable(headers: string[], rowsValue: Array<Array<string | number>>): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rowsValue.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function classifySpeakerListing(title: string, description: string, price: number): Gate {
  const text = nrm(`${title}\n${description}`);
  const titleText = nrm(title);
  const speakerSignal = /(스피커|speaker|사운드바|soundbar|앰프|amplifier|리시버|receiver|튜너|오디오|마샬|marshall|jbl|보스|bose|브리츠|britz|lg|엑스붐|xboom|마란츠|marantz)/i.test(text);

  if (/(삽니다|구합니다|매입|구매합니다|구매원함)/.test(text)) return "buying";
  if (price <= 0 || price < 5_000) return "unknown";
  if (/(이어폰|헤드폰|헤드셋|earphone|headphone|headset|520bt|720bt|노캔|노이즈캔슬링)/i.test(titleText)) return "cross_category";
  if (/(마이크|무선마이크|무선\s*마이크|microphone).{0,24}(단독|단품|만|판매|팝니다)|(?:단독|단품|만|판매|팝니다).{0,24}(마이크|무선마이크|무선\s*마이크|microphone)/i.test(text)) return "cross_category";
  if (/(노래방\s*기계|노래방기계|반주기|금영|tj미디어|태진)/.test(titleText)) return "cross_category";
  if (/(포카|포토\s*카드|포토카드|음반류|앨범).{0,24}(스피커|speaker)|(?:스피커|speaker).{0,24}(포카|포토\s*카드|포토카드|음반류|앨범)/.test(text) && price > 0 && price < 30_000) return "accessory";
  if (/(하드쉘\s*케이스|하드쉘케이스|케이스|파우치)/.test(titleText) && price > 0 && price < 60_000) return "accessory";
  if (/(케이블|리모컨|스탠드|브라켓|거치대|전원\s*어댑터|전원어댑터|어댑터|충전기|충전선|케이스|파우치).{0,18}(단독|단품|만|판매|팝니다)|(?:단독|단품|만|판매|팝니다).{0,18}(케이블|리모컨|스탠드|브라켓|거치대|전원\s*어댑터|전원어댑터|어댑터|충전기|충전선|케이스|파우치)/.test(text)) {
    return "accessory";
  }
  if (/(고장|불량|소리\s*안|소리안|잡음|찢어짐|찢어졌|우퍼\s*나감|트위터\s*나감|전원\s*안|전원안|수리용|부품용)/.test(text)) {
    return /(수리용|부품용)/.test(text) ? "parts" : "damaged";
  }
  if (/(일괄|묶음|2대|두대|한쌍|한\s*쌍|여러대|여러 대|매장정리|매장 정리)/.test(text)) return "multi";
  if (!speakerSignal) return "unknown";
  return "normal";
}

function parseSpeakerModel(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/marshall(?:stanmore|스탠모어)([1-3]|i{1,3})?|마샬스탠모어([1-3]|i{1,3})?/, (m) => `marshall-stanmore-${romanOrDefault(m[1] ?? m[2], "unknown")}`],
    [/marshall(?:acton|액톤)([1-3]|i{1,3})?|마샬액톤([1-3]|i{1,3})?/, (m) => `marshall-acton-${romanOrDefault(m[1] ?? m[2], "unknown")}`],
    [/marshall(?:woburn|워번)([1-3]|i{1,3})?|마샬워번([1-3]|i{1,3})?/, (m) => `marshall-woburn-${romanOrDefault(m[1] ?? m[2], "unknown")}`],
    [/marshall(?:emberton|엠버튼)([1-3]|i{1,3})?|마샬엠버튼([1-3]|i{1,3})?/, (m) => `marshall-emberton-${romanOrDefault(m[1] ?? m[2], "unknown")}`],
    [/marshall(?:willen|윌렌)([1-3]|i{1,3})?|마샬윌렌([1-3]|i{1,3})?/, (m) => `marshall-willen-${romanOrDefault(m[1] ?? m[2], "unknown")}`],
    [/jblgo([2-4])/, (m) => `jbl-go-${m[1]}`],
    [/jblflip([4-7])/, (m) => `jbl-flip-${m[1]}`],
    [/jblcharge([4-6])/, (m) => `jbl-charge-${m[1]}`],
    [/jblclip([3-5])/, (m) => `jbl-clip-${m[1]}`],
    [/jblboombox([1-3])|jbl붐박스([1-3])/, (m) => `jbl-boombox-${m[1] ?? m[2]}`],
    [/jbl(?:xtreme|익스트림)([1-4])?/, (m) => `jbl-xtreme-${m[1] ?? "unknown"}`],
    [/jbl(?:authentics|어센틱)([0-9]{3})/, (m) => `jbl-authentics-${m[1]}`],
    [/jblpartybox([0-9]{2,4})/, (m) => `jbl-partybox-${m[1]}`],
    [/bose(?:soundlink|사운드링크)(?:mini)?([1-3]|i{1,3})?/, (m) => `bose-soundlink-${romanOrDefault(m[1], "unknown")}`],
    [/(?:lg|엘지)(?:xboom|엑스붐)?(?:go)?pk([0-9])/, (m) => `lg-xboom-pk${m[1]}`],
    [/(?:britz|브리츠).{0,12}(ba|br|bz)([a-z0-9]{2,})/, (m) => `britz-${m[1]}-${m[2]}`],
    [/(?:marantz|마란츠)(?:model)?([0-9]{1,4}[a-z]?(?:mki{1,3})?)/, (m) => `marantz-model-${m[1]}`],
    [/(?:marantz|마란츠)(sr|pm|nr)([0-9]{3,4}[a-z]?)/, (m) => `marantz-${m[1]}-${m[2]}`],
    [/(?:audio-technica|오디오테크니카)atsp([0-9]{3})/, (m) => `audio-technica-at-sp${m[1]}`],
    [/(?:roiche|로이체)bts([0-9]{3})/, (m) => `roiche-bts-${m[1]}`],
    [/(?:eric|에릭)(?:partybox|파티박스)/, () => "eric-partybox"],
    [/(?:mackie|맥키)showbox/, () => "mackie-showbox"],
    [/(?:kanals|카날스)bs([0-9]{3,4})/, (m) => `kanals-bs-${m[1]}`],
    [/(?:krk)?rokit([0-9])g([0-9])|(?:krk)rokit([0-9])/, (m) => `krk-rokit-${m[1] ?? m[3]}${m[2] ? `-g${m[2]}` : ""}`],
    [/(?:audioengine|오디오엔진)(?:s|a)([0-9])/, (m) => `audioengine-${text.includes("audios") || text.includes("오디오엔진s") ? "s" : "a"}${m[1]}`],
    [/(?:yamaha|야마하)nsc([0-9]{2,3})/, (m) => `yamaha-ns-c${m[1]}`],
    [/(?:sharp|샤프)cp([0-9]{3}[a-z]?)/, (m) => `sharp-cp-${m[1]}`],
    [/(?:sony|소니)strde([0-9]{3,4})/, (m) => `sony-str-de${m[1]}`],
    [/(?:vincent|빈센트)sp([0-9]{3})/, (m) => `vincent-sp-${m[1]}`],
    [/(?:qualitycast|퀄리티캐스트)coco([0-9]i?)/, (m) => `qualitycast-coco-${m[1]}`],
    [/(?:logitech|로지텍).*(?:dock|도킹)/, () => "logitech-dock-speaker"],
    [/(?:orange|오렌지)(?:mini|미니)(?:amp|앰프)/, () => "orange-mini-amp"],
    [/(?:samsung|삼성)(?:aura|오라)(?:studio|스튜디오)([0-9])/, (m) => `samsung-aura-studio-${m[1]}`],
    [/(?:yamaha|야마하)hs([0-9])/, (m) => `yamaha-hs${m[1]}`],
    [/(?:vincent|빈센트).{0,20}sp([0-9]{3})/, (m) => `vincent-sp-${m[1]}`],
    [/(?:laney|레이니)cubsuper([0-9]{1,2})/, (m) => `laney-cub-super-${m[1]}`],
    [/(?:phonic|포닉)sep([0-9]{3})/, (m) => `phonic-sep-${m[1]}`],
    [/(?:chaccone|샤콘).{0,12}sis([0-9]{4})/, (m) => `chaccone-sis-${m[1]}`],
    [/(?:nakamichi|나카미치)([0-9]{3,4})/, (m) => `nakamichi-${m[1]}`],
    [/jbleononecompact/, () => "jbl-eon-one-compact"],
    [/(?:microlab|마이크로랩)fc([0-9]{2})/, (m) => `microlab-fc-${m[1]}`],
    [/(?:divoom|디붐)bluetunebean/, () => "divoom-bluetune-bean"],
    [/(?:clova|클로바)(?:friends|프렌즈)/, () => "naver-clova-friends"],
    [/(?:leto|레토)/, () => "leto-speaker"],
    [/vivox/, () => "vivox-speaker"],
  ];

  for (const [pattern, toKey] of patterns) {
    const match = text.match(pattern);
    if (match) return toKey(match);
  }
  return null;
}

function romanOrDefault(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  if (normalized === "i") return "1";
  if (normalized === "ii") return "2";
  if (normalized === "iii") return "3";
  return normalized;
}

function familyKey(modelKey: string | null, title: string, description: string): string {
  if (modelKey) return modelKey.split("-").slice(0, 2).join("-");
  const text = nrm(`${title}\n${description}`);
  if (/사운드바|soundbar/.test(text)) return "soundbar-generic";
  if (/앰프|amplifier|리시버|receiver|튜너/.test(text)) return "amp-receiver-generic";
  if (/블루투스|bluetooth|스피커|speaker/.test(text)) return "speaker-generic";
  return "unknown";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let modelMatched = 0;
  let genericFamily = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const gate = classifySpeakerListing(title, description, price);
    inc(gateCounts, gate);
    if (gate !== "normal") continue;

    normal += 1;
    const modelKey = parseSpeakerModel(title, description);
    const family = familyKey(modelKey, title, description);
    inc(familyCounts, family);
    if (modelKey) {
      modelMatched += 1;
      inc(modelCounts, modelKey);
    } else {
      genericFamily += 1;
    }
    if (!modelKey && examples.length < 20) {
      examples.push({ pid: sample.pid ?? null, title, price, family });
    }
  }

  const summary = {
    category: "speaker_audio_discovered",
    generatedAt: new Date().toISOString(),
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    modelMatched,
    modelMatchedRate: pct(modelMatched, normal),
    genericFamily,
    genericFamilyRate: pct(genericFamily, normal),
    gateCounts: rows(gateCounts),
    modelCounts: rows(modelCounts),
    familyCounts: rows(familyCounts),
    examples,
    recommendation:
      pct(modelMatched, normal) >= 55
        ? "parser_candidate_report_only: known speaker model keys are usable, generic speaker/amp families still need policy"
        : "hold_report_only: speaker/audio model coverage is too generic for promotion",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "speaker-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Speaker Audio Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["model_matched", `${summary.modelMatchedRate}% (${summary.modelMatched}/${summary.normal})`],
        ["generic_family", `${summary.genericFamilyRate}% (${summary.genericFamily}/${summary.normal})`],
        ["recommendation", summary.recommendation],
      ],
    ),
    "",
    "## Gate Counts",
    "",
    markdownTable(["type", "count"], summary.gateCounts.map((row) => [row.key, row.count])),
    "",
    "## Model Counts",
    "",
    markdownTable(["model", "count"], summary.modelCounts.map((row) => [row.key, row.count])),
    "",
    "## Family Counts",
    "",
    markdownTable(["family", "count"], summary.familyCounts.map((row) => [row.key, row.count])),
    "",
    "## Generic Examples",
    "",
    markdownTable(["pid", "title", "price", "family"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.family ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "speaker-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/speaker-parser-latest.json");
  console.log("wrote reports/speaker-parser-latest.md");
  console.log(`${summary.recommendation}; model_matched=${summary.modelMatchedRate}%, generic_family=${summary.genericFamilyRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
