import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Sample = {
  pid?: string;
  title?: string;
  name?: string;
  description?: string;
  price?: number;
};

type Gate = "normal" | "accessory" | "damaged" | "parts" | "multi" | "buying" | "unknown";
type PackageConfig = "body_only" | "lens_kit" | "fixed_lens" | "unknown_package";

const appDir = process.cwd();
const samplesPath = path.join(appDir, "category-intelligence", "camera_discovered", "normalized_samples.json");
const reportsDir = path.join(appDir, "reports");

function nrm(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function compact(value: string): string {
  return nrm(value).replace(/[\s_\-./]+/g, "");
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
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rowsValue.map((row) => `| ${row.join(" | ")} |`),
  ];
  return lines.join("\n");
}

function classifyCameraListing(title: string, description: string, price: number): Gate {
  const text = nrm(`${title}\n${description}`);
  const titleText = nrm(title);
  const cameraSignal = /(카메라|미러리스|dslr|eos|powershot|파워샷|소니|sony|캐논|canon|니콘|nikon|후지|fujifilm|후지필름|leica|라이카|lumix|루믹스|pentax|펜탁스)/i.test(text);

  if (/(삽니다|구합니다|매입|구매합니다|구매원함)/.test(text)) return "buying";
  if (price <= 0 || price < 5_000) return "unknown";
  if (/(바디캡|렌즈\s*캡|렌즈캡|뒷캡|앞캡|소프트\s*버튼|소프트버튼)/.test(text)) return "accessory";

  const accessoryTerm =
    /(가방|스트랩|케이스|필터|uv필터|배터리|충전기|충전독|핸드그립|세로그립|탑핸들|케이지|캡|렌즈캡|바디캡|메모리카드|sd카드|리모컨|삼각대|플래시|마운트|어댑터)/;
  const bodySignal = /(바디|본체|body|카메라|미러리스|dslr|디카|하이엔드|컴팩트|콤팩트)/i.test(text);
  const lensOnlySignal =
    /(렌즈|lens).{0,20}(단독|단품|만|판매|팝니다)|(?:단독|단품|만|판매|팝니다).{0,20}(렌즈|lens)/i.test(text) ||
    (/렌즈/.test(titleText) && !/(바디|본체|카메라|camera|body|\+)/i.test(titleText));
  if (lensOnlySignal) return "accessory";

  const accessoryOnlySignal =
    accessoryTerm.test(titleText) &&
    !bodySignal &&
    (!/(포함|드림|드립니다|같이|세트|풀박|풀구성)/.test(text) || price < 100_000);
  if (accessoryOnlySignal) return "accessory";

  if (/(부품용|수리용|셔터막|센서|메인보드|액정).{0,20}(부품|고장|불량|교체)|(?:부품|고장|불량|교체).{0,20}(셔터막|센서|메인보드|액정)/.test(text)) {
    return "parts";
  }
  if (/(하자있|하자 있음|고장|불량|작동안|작동 안|전원안|전원 안|초점불량|af불량|액정깨짐|액정 깨짐|침수)/.test(text)) {
    return "damaged";
  }
  if (/(일괄|묶음|2대|두대|여러대|여러 대|매장정리|매장 정리)/.test(text)) return "multi";
  if (!cameraSignal) return "unknown";

  return "normal";
}

function parseCameraModel(title: string, description: string): string | null {
  const text = compact(`${title}\n${description}`);

  const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/sony(?:alpha|알파)?a7r?m?([2-5])/, (m) => (text.includes("a7r") ? `sony-a7r${m[1]}` : `sony-a7m${m[1]}`)],
    [/소니(?:알파)?a7r?m?([2-5])/, (m) => (text.includes("a7r") ? `sony-a7r${m[1]}` : `sony-a7m${m[1]}`)],
    [/(?:sony|소니)(?:alpha|알파)?a7c(?:ii|2)?/, () => (/(a7cii|a7c2)/.test(text) ? "sony-a7c2" : "sony-a7c")],
    [/(?:sony|소니)(?:alpha|알파)?a7cr/, () => "sony-a7cr"],
    [/(?:sony|소니)(?:alpha|알파)?a([56][0-9]{3})/, (m) => `sony-a${m[1]}`],
    [/(?:sony|소니)zve10|(?:sony|소니)zv\-?e10/, () => "sony-zv-e10"],
    [/(?:sony|소니)rx100m?([1-7])?/, (m) => (m[1] ? `sony-rx100m${m[1]}` : "sony-rx100")],
    [/(?:sony|소니)dscw?([0-9]{3,4})/, (m) => `sony-dsc-w${m[1]}`],

    [/(?:canon|캐논)(?:eos)?r6(?:mark2|mk2|ii|m2|2|막투)?/, () => (/(mark2|mk2|ii|m2|막투)/.test(text) ? "canon-eos-r6-mark-ii" : "canon-eos-r6")],
    [/(?:canon|캐논)(?:eos)?r8/, () => "canon-eos-r8"],
    [/(?:canon|캐논)(?:eos)?r10/, () => "canon-eos-r10"],
    [/(?:canon|캐논)(?:eos)?r50/, () => "canon-eos-r50"],
    [/(?:canon|캐논)(?:eos)?rp/, () => "canon-eos-rp"],
    [/(?:canon|캐논)(?:eos)?m([0-9]{1,2})/, (m) => `canon-eos-m${m[1]}`],
    [/(?:canon|캐논)(?:eos|eod)?5d(?:mark|mk)?([2-4]|ii|iii|iv)/, (m) => `canon-eos-5d-mark-${({ ii: "2", iii: "3", iv: "4" } as Record<string, string>)[m[1]] ?? m[1]}`],
    [/(?:canon|캐논)(?:eos)?([0-9]{2,4})d/, (m) => `canon-eos-${m[1]}d`],
    [/(?:canon|캐논)(?:g7x|g7xmark)(?:mark|mk)?([2-3]|ii|iii)?/, (m) => `canon-g7x-mark-${({ ii: "2", iii: "3" } as Record<string, string>)[m[1] ?? ""] ?? m[1] ?? "1"}`],
    [/(?:canon|캐논)(?:powershot|파워샷)v10/, () => "canon-powershot-v10"],
    [/(?:canon|캐논)(?:ixus|익서스)([0-9]{3,4})/, (m) => `canon-ixus-${m[1]}`],

    [/(?:nikon|니콘)zfc/, () => "nikon-zfc"],
    [/(?:nikon|니콘)z([5-9])/, (m) => `nikon-z${m[1]}`],
    [/(?:nikon|니콘)d([0-9]{3,4})/, (m) => `nikon-d${m[1]}`],
    [/(?:nikon|니콘)1j([0-9])/, (m) => `nikon-1-j${m[1]}`],

    [/(?:fujifilm|후지필름|후지)x([steh][0-9]{1,3})/, (m) => `fujifilm-x-${m[1]}`],
    [/(?:fujifilm|후지필름|후지)x100([a-z])?/, (m) => (m[1] ? `fujifilm-x100${m[1]}` : "fujifilm-x100")],
    [/(?:fujifilm|후지필름|후지)x70/, () => "fujifilm-x70"],
    [/(?:leica|라이카)m6ttl/, () => "leica-m6-ttl"],
    [/(?:leica|라이카)m6/, () => "leica-m6"],
    [/(?:panasonic|파나소닉)?(?:lumix|루믹스)s9/, () => "panasonic-lumix-s9"],
    [/(?:sony|소니)nex([0-9][a-z]?)/, (m) => `sony-nex-${m[1]}`],
    [/(?:samsung|삼성)nx([0-9]{2,4})/, (m) => `samsung-nx${m[1]}`],
    [/(?:samsung|삼성)ex2f/, () => "samsung-ex2f"],
  ];

  for (const [pattern, toKey] of patterns) {
    const match = text.match(pattern);
    if (match) return toKey(match);
  }
  return null;
}

function parsePackageConfig(title: string, description: string, modelKey: string | null): PackageConfig {
  const text = nrm(`${title}\n${description}`);
  const compactText = compact(`${title}\n${description}`);
  if (modelKey && /(powershot|ixus|rx100|dsc|x100|ex2f|leica-m6)/.test(modelKey)) return "fixed_lens";
  if (/(렌즈\s*포함|렌즈포함|렌즈\s*킷|렌즈킷|번들렌즈|번들\s*렌즈|18\-?55|24\-?70|20\-?50|16\-?50|[0-9]{2,3}\s*mm\s*렌즈|렌즈.{0,16}(같이|포함|드림|드립니다)|\+.{0,30}렌즈)/i.test(text)) return "lens_kit";
  if (/(바디만|바디\s*단품|바디\s*온리|bodyonly|본체만|본체\s*단품|렌즈\s*미포함|렌즈없|렌즈\s*없|바디|본체)/i.test(compactText)) return "body_only";
  return "unknown_package";
}

async function main(): Promise<void> {
  const samples = JSON.parse(await readFile(samplesPath, "utf8")) as Sample[];
  const gateCounts = new Map<string, number>();
  const modelCounts = new Map<string, number>();
  const packageCounts = new Map<string, number>();
  const examples: Array<Record<string, string | number | null>> = [];

  let normal = 0;
  let modelMatched = 0;
  let parserReady = 0;
  let unknownPackage = 0;

  for (const sample of samples) {
    const title = sample.title ?? sample.name ?? "";
    const description = sample.description ?? "";
    const price = sample.price ?? 0;
    const gate = classifyCameraListing(title, description, price);
    inc(gateCounts, gate);
    if (gate !== "normal") continue;

    normal += 1;
    const modelKey = parseCameraModel(title, description);
    const packageConfig = parsePackageConfig(title, description, modelKey);
    if (modelKey) {
      modelMatched += 1;
      inc(modelCounts, modelKey);
      inc(packageCounts, packageConfig);
      if (packageConfig !== "unknown_package") {
        parserReady += 1;
      } else {
        unknownPackage += 1;
      }
    }

    if ((!modelKey || packageConfig === "unknown_package") && examples.length < 20) {
      examples.push({
        pid: sample.pid ?? null,
        title,
        price,
        model_key: modelKey,
        package_config: packageConfig,
      });
    }
  }

  const summary = {
    category: "camera_discovered",
    generatedAt: new Date().toISOString(),
    total: samples.length,
    normal,
    normalRate: pct(normal, samples.length),
    modelMatched,
    modelMatchedRate: pct(modelMatched, normal),
    parserReady,
    parserReadyRate: pct(parserReady, normal),
    parserReadyOfMatchedRate: pct(parserReady, modelMatched),
    unknownPackage,
    unknownPackageRate: pct(unknownPackage, modelMatched),
    gateCounts: rows(gateCounts),
    modelCounts: rows(modelCounts),
    packageCounts: rows(packageCounts),
    examples,
    recommendation:
      pct(parserReady, normal) >= 70
        ? "parser_candidate_report_only: camera body model/package keys look usable, runtime parser still missing"
        : "hold_report_only: camera runtime parser/category is missing and package split remains review-heavy",
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "camera-parser-latest.json"), JSON.stringify(summary, null, 2));

  const md = [
    "# Camera Parser Spot Check",
    "",
    `Generated: ${summary.generatedAt}`,
    "",
    markdownTable(
      ["metric", "value"],
      [
        ["total", summary.total],
        ["normal", `${summary.normalRate}% (${summary.normal})`],
        ["model_matched", `${summary.modelMatchedRate}% (${summary.modelMatched}/${summary.normal})`],
        ["parser_ready", `${summary.parserReadyRate}% (${summary.parserReady}/${summary.normal})`],
        ["parser_ready_of_matched", `${summary.parserReadyOfMatchedRate}% (${summary.parserReady}/${summary.modelMatched})`],
        ["unknown_package", `${summary.unknownPackageRate}% (${summary.unknownPackage}/${summary.modelMatched})`],
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
    "## Package Counts",
    "",
    markdownTable(["package", "count"], summary.packageCounts.map((row) => [row.key, row.count])),
    "",
    "## Review Examples",
    "",
    markdownTable(["pid", "title", "price", "model_key", "package_config"], summary.examples.map((row) => [row.pid ?? "", row.title ?? "", row.price ?? "", row.model_key ?? "", row.package_config ?? ""])),
  ].join("\n");

  await writeFile(path.join(reportsDir, "camera-parser-latest.md"), `${md}\n`);
  console.log("wrote reports/camera-parser-latest.json");
  console.log("wrote reports/camera-parser-latest.md");
  console.log(`${summary.recommendation}; parser_ready=${summary.parserReadyRate}%, model_matched=${summary.modelMatchedRate}%`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
