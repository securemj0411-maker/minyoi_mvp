import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type Gate = "normal" | "accessory" | "parts" | "damaged" | "multi" | "buying" | "logistics_risk" | "unknown";

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "home_appliance_tech_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function nrm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compact(value: string): string {
  return nrm(value).replace(/[\s_\-./,+]+/g, "");
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

function classifyHomeAppliance(title: string, description: string, price: number): Gate {
  const text = nrm(`${title}\n${description}`);
  const titleText = nrm(title);
  const applianceSignal = /(청소기|로봇청소기|무선청소기|침구청소기|다이슨|dyson|로보락|roborock|드리미|dreame|에어랩|슈퍼소닉|드라이기|에어프라이|블렌더|제조기|커피머신|인덕션|마사지기|부스터프로|고주파|갈바닉)/i.test(text);

  if (/(삽니다|구합니다|매입|구매합니다|구매원함)/.test(text)) return "buying";
  if (price <= 0 || price < 5_000) return "unknown";
  if (/(대형|설치|철거|방문설치|렌탈|임대|정수기|에어컨|냉장고|세탁기|건조기)/.test(text)) return "logistics_risk";
  if (/(물걸레|청소포|필터|브러쉬|브러시|배터리|밧데리|충전기|충전독|거치대|크래들|홀더|파우치|키링|스탬프|젤|세럼|팩).{0,20}(단독|단품|만|판매|팝니다|부품)|(?:단독|단품|만|판매|팝니다|부품).{0,20}(물걸레|청소포|필터|브러쉬|브러시|배터리|밧데리|충전기|충전독|거치대|크래들|홀더|파우치|키링|스탬프|젤|세럼|팩)/.test(text)) {
    return "accessory";
  }
  if (/(고장|불량|수리용|부품용|작동\s*안|작동안|전원\s*안|전원안|흡입\s*약|흡입약)/.test(text)) return /(수리용|부품용)/.test(text) ? "parts" : "damaged";
  if (/(일괄|묶음|여러개|여러 개|2개|3개|세트|폐업|가게\s*문닫|정리합니다)/.test(text) && !/(풀박스|풀구성|구성품|본체)/.test(text)) return "multi";
  if (!applianceSignal) return "unknown";
  if (/(파우치|키링|스탬프|세럼|팩|화장품)/.test(titleText) && price > 0 && price < 80_000) return "accessory";
  return "normal";
}

function parseHomeApplianceKey(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/(?:dyson|다이슨)v([0-9]{1,2})/, (m) => `dyson-v${m[1]}`],
    [/(?:dyson|다이슨)(?:airwrap|에어랩)/, () => "dyson-airwrap"],
    [/(?:dyson|다이슨)(?:supersonic|슈퍼소닉)/, () => "dyson-supersonic"],
    [/(?:samsung|삼성)(?:비스포크)?제트(?:ai)?/, () => "samsung-bespoke-jet"],
    [/(?:lg|엘지)(?:코드제로|codezero)a9/, () => "lg-codezero-a9"],
    [/(?:roborock|로보락)s([0-9]{1,2})/, (m) => `roborock-s${m[1]}`],
    [/(?:roborock|로보락)q([0-9]{1,2})/, (m) => `roborock-q${m[1]}`],
    [/(?:dreame|드리미)([xl]?[0-9]{1,2})/, (m) => `dreame-${m[1]}`],
    [/(?:cleanclean|클리엔)r([0-9])/, (m) => `clean-r${m[1]}`],
    [/(?:ninja|닌자)(?:블렌더|초퍼|blender|chopper)/, () => "ninja-blender"],
    [/(?:dolcegusto|돌체구스토)/, () => "dolce-gusto-machine"],
    [/(?:medicube|메디큐브)(?:에이지알)?(?:부스터프로|boosterpro)/, () => "medicube-booster-pro"],
    [/(?:klieben|클리벤|칼만).{0,12}dk([0-9]{4})/, (m) => `kalman-dk-${m[1]}`],
  ];
  for (const [pattern, toKey] of patterns) {
    const match = text.match(pattern);
    if (match) return toKey(match);
  }
  if (/로봇청소기/.test(text)) return "robot-vacuum-generic";
  if (/에어프라이/.test(text)) return "air-fryer-generic";
  if (/무선청소기|청소기/.test(text)) return "vacuum-generic";
  if (/커피머신|에스프레소/.test(text)) return "coffee-machine-generic";
  if (/마사지기|고주파|갈바닉|ems/.test(text)) return "beauty-device-generic";
  return null;
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let modelReady = 0;
  let generic = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const gate = classifyHomeAppliance(title, description, price);
    inc(gateCounts, gate);
    if (gate !== "normal") continue;

    normal += 1;
    const key = parseHomeApplianceKey(title, description);
    if (key) {
      inc(keyCounts, key);
      if (key.includes("generic")) generic += 1;
      else modelReady += 1;
    }
    if ((!key || key.includes("generic")) && examples.length < 20) {
      examples.push({ pid: sample.pid ?? null, title, price, key });
    }
  }

  const summary = {
    category: "home_appliance_tech_discovered",
    generatedAt: new Date().toISOString(),
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    modelReady,
    modelReadyRate: pct(modelReady, normal),
    generic,
    genericRate: pct(generic, normal),
    gateCounts: rows(gateCounts),
    keyCounts: rows(keyCounts),
    examples,
    recommendation:
      pct(modelReady, normal) >= 50
        ? "parser_candidate_report_only: model-coded appliance keys usable, logistics/risk policy still missing"
        : "hold_report_only: home appliance samples remain broad/generic/logistics-risk heavy",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "home-appliance-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Home Appliance Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["model_ready", `${summary.modelReadyRate}% (${summary.modelReady}/${summary.normal})`],
        ["generic", `${summary.genericRate}% (${summary.generic}/${summary.normal})`],
        ["recommendation", summary.recommendation],
      ],
    ),
    "",
    "## Gate Counts",
    "",
    markdownTable(["type", "count"], summary.gateCounts.map((row) => [row.key, row.count])),
    "",
    "## Key Counts",
    "",
    markdownTable(["key", "count"], summary.keyCounts.map((row) => [row.key, row.count])),
    "",
    "## Generic Examples",
    "",
    markdownTable(["pid", "title", "price", "key"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.key ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "home-appliance-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/home-appliance-parser-latest.json");
  console.log("wrote reports/home-appliance-parser-latest.md");
  console.log(`${summary.recommendation}; model_ready=${summary.modelReadyRate}%, generic=${summary.genericRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
