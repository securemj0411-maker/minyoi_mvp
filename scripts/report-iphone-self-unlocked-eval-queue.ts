import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Sample = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  parse_ready?: unknown;
};

type EvalRow = {
  lane: string;
  total: number;
  explicitSelfUnlocked: number;
  cleanExplicitSelfUnlocked: number;
  carrierAmbiguous: number;
  accessoryOrParts: number;
  buyingOrCommercial: number;
  examples: {
    explicit: string[];
    ambiguous: string[];
    blocked: string[];
  };
  decision: string;
};

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, "reports");
const INTEL_DIR = path.join(ROOT, "category-intelligence");
const OUT_JSON = path.join(REPORT_DIR, "iphone-self-unlocked-eval-queue-latest.json");
const OUT_MD = path.join(REPORT_DIR, "iphone-self-unlocked-eval-queue-latest.md");
const LANES = ["iphone_12_pro_128gb_self", "iphone_13_pro_128gb_self"] as const;

function readJson<T>(file: string, fallback: T): T {
  if (!existsSync(file)) return fallback;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function text(sample: Sample): string {
  return `${String(sample.name ?? sample.title ?? "")} ${String(sample.description ?? "")}`.trim();
}

function title(sample: Sample): string {
  return String(sample.name ?? sample.title ?? "").trim();
}

function hasExplicitSelfUnlocked(value: string): boolean {
  return /자급제|공기계|정상\s*해지|정상해지|확정\s*기변\s*가능|확정기변\s*가능|언락|unlocked/i.test(value);
}

function hasCarrierAmbiguity(value: string): boolean {
  return /선약|선택\s*약정|약정|확정\s*기변|확정기변|유심|통신사|SKT|KT|LGU|엘지유플|완납폰|기변|번호이동/i.test(value);
}

function hasBlocked(value: string): boolean {
  return /케이스|필름|액정\s*(깨|파손|불량|고장|교체)|부품|배터리\s*(교체|부품|불량|고장|수리)|고장|파손|삽니다|구매|매입|업자|대량|렌탈/i.test(value);
}

function pushExample(list: string[], value: string) {
  if (value && list.length < 8) list.push(value.slice(0, 120));
}

function analyze(lane: string): EvalRow {
  const samples = readJson<Sample[]>(path.join(INTEL_DIR, lane, "samples.json"), []);
  let explicitSelfUnlocked = 0;
  let cleanExplicitSelfUnlocked = 0;
  let carrierAmbiguous = 0;
  let accessoryOrParts = 0;
  let buyingOrCommercial = 0;
  const examples = { explicit: [] as string[], ambiguous: [] as string[], blocked: [] as string[] };

  for (const sample of samples) {
    const value = text(sample);
    const rowTitle = title(sample);
    const explicit = hasExplicitSelfUnlocked(value);
    const ambiguous = hasCarrierAmbiguity(value) && !explicit;
    const blocked = hasBlocked(value);

    if (explicit) {
      explicitSelfUnlocked += 1;
      pushExample(examples.explicit, rowTitle);
    }
    if (ambiguous) {
      carrierAmbiguous += 1;
      pushExample(examples.ambiguous, rowTitle);
    }
    if (blocked) {
      accessoryOrParts += /케이스|필름|액정\s*(깨|파손|불량|고장|교체)|부품|배터리\s*(교체|부품|불량|고장|수리)|고장|파손/i.test(value) ? 1 : 0;
      buyingOrCommercial += /삽니다|구매|매입|업자|대량|렌탈/i.test(value) ? 1 : 0;
      pushExample(examples.blocked, rowTitle);
    }
    if (explicit && !ambiguous && !blocked) cleanExplicitSelfUnlocked += 1;
  }

  return {
    lane,
    total: samples.length,
    explicitSelfUnlocked,
    cleanExplicitSelfUnlocked,
    carrierAmbiguous,
    accessoryOrParts,
    buyingOrCommercial,
    examples,
    decision: "deterministic_explicit_only__silent_or_ambiguous_goes_ai_l2",
  };
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

const rows = LANES.map(analyze);
const generatedAt = new Date().toISOString();
const output = {
  generatedAt,
  reportOnly: true,
  runtimeMutation: false,
  rows,
  policy: {
    deterministicAllowed: "Only explicit 자급제/공기계/정상해지/언락 wording.",
    aiL2: "Silent carrier state, weak hints, and carrier ambiguity.",
    forbidden: "Do not remove self/unlocked requirement and do not infer 자급제 from price or seller wording.",
  },
};

const md = [
  "# iPhone Self-Unlocked Evaluation Queue",
  "",
  `- generatedAt: ${generatedAt}`,
  "- mode: report_only_no_runtime_mutation",
  "",
  "## Counts",
  "",
  mdTable(
    ["lane", "total", "explicit", "clean explicit", "carrier ambiguous", "parts/accessory", "buying/commercial", "decision"],
    rows.map((row) => [
      row.lane,
      String(row.total),
      String(row.explicitSelfUnlocked),
      String(row.cleanExplicitSelfUnlocked),
      String(row.carrierAmbiguous),
      String(row.accessoryOrParts),
      String(row.buyingOrCommercial),
      row.decision,
    ]),
  ),
  "",
  "## Policy",
  "",
  `- Deterministic allowed: ${output.policy.deterministicAllowed}`,
  `- AI L2: ${output.policy.aiL2}`,
  `- Forbidden: ${output.policy.forbidden}`,
  "",
  "## Examples",
  "",
  ...rows.flatMap((row) => [
    `### ${row.lane}`,
    "",
    `- explicit: ${row.examples.explicit.join(" / ") || "-"}`,
    `- ambiguous: ${row.examples.ambiguous.join(" / ") || "-"}`,
    `- blocked: ${row.examples.blocked.join(" / ") || "-"}`,
    "",
  ]),
].join("\n");

mkdirSync(REPORT_DIR, { recursive: true });
writeFileSync(OUT_JSON, `${JSON.stringify(output, null, 2)}\n`);
writeFileSync(OUT_MD, md);

console.log(`wrote ${OUT_MD}`);
console.log(`wrote ${OUT_JSON}`);
console.log(`rows=${rows.length}`);
