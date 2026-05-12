import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type Gate = "normal" | "accessory" | "parts" | "damaged" | "multi" | "buying" | "commercial" | "unknown";

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "desktop_pc_discovered", "normalized_samples.json");
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

function classifyDesktopListing(title: string, description: string, price: number): Gate {
  const text = nrm(`${title}\n${description}`);
  const titleText = nrm(title);
  const pcSignal = /(컴퓨터|데스크탑|데스크톱|조립pc|조립\s*pc|게이밍pc|gaming\s*pc|본체|pc팝니다|아이맥|imac|맥미니|mac\s*mini|맥스튜디오|mac\s*studio)/i.test(text);
  const fullPcSignal = /(컴퓨터|데스크탑|데스크톱|조립pc|조립\s*pc|게이밍pc|gaming\s*pc|본체|완본체|pc팝니다|아이맥|imac|맥미니|mac\s*mini|맥스튜디오|mac\s*studio)/i.test(titleText);

  if (/(삽니다|구합니다|매입|출장매입|구매합니다|구매원함)/.test(text)) return "buying";
  if (price <= 0 || price < 10_000) return "unknown";
  if (/(윈도우\s*11|윈도우\s*10|오피스\s*2021|정품키|제품키|시디키|라이센스|라이선스)/.test(text)) return "accessory";
  if (/(pc방|피시방|사무실|대량|여러대|여러 대|일괄|묶음|풀셋|풀세트|모니터.{0,16}(포함|세트)|키보드.{0,16}마우스)/.test(text)) return "multi";
  if (/(전국최저가|번장최저가|한정수량|이벤트|카드결제|현금영수증|세금계산서|사업자|업체|조립pc정석|인증 업체|최저가pc)/.test(text)) return "commercial";
  if (/(그래픽카드|gpu|cpu|메인보드|램|ram|ssd|hdd|파워|쿨러|케이스).{0,20}(단독|단품|만|판매|팝니다|부품)|(?:단독|단품|만|판매|팝니다|부품).{0,20}(그래픽카드|gpu|cpu|메인보드|램|ram|ssd|hdd|파워|쿨러|케이스)/i.test(text)) {
    if (fullPcSignal && !/(케이스만|그래픽카드만|cpu만|메인보드만|램만|ssd만|hdd만|파워만|쿨러만)/i.test(text)) return "normal";
    return "parts";
  }
  if (/(고장|불량|부품용|수리용|전원\s*안|전원안|화면\s*안|화면안|채굴)/.test(text)) return "damaged";
  if (!pcSignal) return "unknown";
  if (/케이스/.test(titleText) && !/(본체|pc|컴퓨터|데스크탑|데스크톱)/.test(titleText)) return "parts";
  return "normal";
}

function parseCpu(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/(?:i)([3579])([1-9][0-9]{3,4})(f|k|kf)?/, (m) => `intel-i${m[1]}-${m[2]}${m[3] ?? ""}`],
    [/intel(?:core)?i([3579])([1-9][0-9]{3,4})(f|k|kf)?|인텔i([3579])([1-9][0-9]{3,4})(f|k|kf)?/, (m) => `intel-i${m[1] ?? m[4]}-${m[2] ?? m[5]}${m[3] ?? m[6] ?? ""}`],
    [/(?:ryzen|라이젠)([3579])([0-9]{3,4})(x3d|x)?/, (m) => `ryzen-${m[1]}-${m[2]}${m[3] ?? ""}`],
    [/([79]8?00x3d)/, (m) => `ryzen-${m[1]}`],
    [/([67]500f)/, (m) => `ryzen-${m[1]}`],
  ];
  for (const [pattern, toKey] of patterns) {
    const match = text.match(pattern);
    if (match) return toKey(match);
  }
  return null;
}

function parseGpu(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);
  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/rtx(30[56789]0|40[56789]0|50[56789]0)(ti|super)?/, (m) => `rtx-${m[1]}${m[2] ?? ""}`],
    [/gtx(10[5678]0|16[056]0)(ti|super)?/, (m) => `gtx-${m[1]}${m[2] ?? ""}`],
    [/rx(6[5-9]00|7[6-9]00)(xt)?/, (m) => `radeon-rx-${m[1]}${m[2] ?? ""}`],
  ];
  for (const [pattern, toKey] of patterns) {
    const match = text.match(pattern);
    if (match) return toKey(match);
  }
  return null;
}

function parseDesktopKey(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);
  if (/imac|아이맥/.test(text)) return "apple-imac";
  if (/macmini|맥미니/.test(text)) return "apple-mac-mini";
  if (/macstudio|맥스튜디오/.test(text)) return "apple-mac-studio";

  const cpu = parseCpu(title, description);
  const gpu = parseGpu(title, description);
  if (cpu && gpu) return `${cpu}|${gpu}`;
  if (gpu) return `unknown-cpu|${gpu}`;
  if (cpu) return `${cpu}|unknown-gpu`;
  if (/게이밍|gaming/.test(text)) return "gaming-desktop-generic";
  if (/사무용|office/.test(text)) return "office-desktop-generic";
  return null;
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let parserReady = 0;
  let generic = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const gate = classifyDesktopListing(title, description, price);
    inc(gateCounts, gate);
    if (gate !== "normal") continue;

    normal += 1;
    const key = parseDesktopKey(title, description);
    if (key) {
      inc(keyCounts, key);
      if (key.includes("generic") || key.includes("unknown-")) {
        generic += 1;
      } else {
        parserReady += 1;
      }
    }
    if ((!key || key.includes("generic") || key.includes("unknown-")) && examples.length < 20) {
      examples.push({ pid: sample.pid ?? null, title, price, key });
    }
  }

  const summary = {
    category: "desktop_pc_discovered",
    generatedAt: new Date().toISOString(),
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    parserReady,
    parserReadyRate: pct(parserReady, normal),
    generic,
    genericRate: pct(generic, normal),
    gateCounts: rows(gateCounts),
    keyCounts: rows(keyCounts),
    examples,
    recommendation:
      pct(parserReady, normal) >= 60
        ? "parser_candidate_report_only: CPU/GPU desktop keys are useful, public policy still missing"
        : "hold_report_only: desktop PC samples remain commercial/multi/generic-heavy",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "desktop-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Desktop PC Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["parser_ready", `${summary.parserReadyRate}% (${summary.parserReady}/${summary.normal})`],
        ["generic_or_partial", `${summary.genericRate}% (${summary.generic}/${summary.normal})`],
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
    "## Review Examples",
    "",
    markdownTable(["pid", "title", "price", "key"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.key ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "desktop-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/desktop-parser-latest.json");
  console.log("wrote reports/desktop-parser-latest.md");
  console.log(`${summary.recommendation}; parser_ready=${summary.parserReadyRate}%, generic=${summary.genericRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
