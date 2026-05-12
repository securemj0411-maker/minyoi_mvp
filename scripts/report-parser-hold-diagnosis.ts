import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type CountRow = { key: string; count: number };

type SourceReport = {
  category?: string;
  total?: number;
  normal?: number;
  parserReadyRate?: number;
  modelMatchedRate?: number;
  modelReadyRate?: number;
  genericRate?: number;
  consoleCandidateRate?: number;
  knownModelCandidateRate?: number;
  unknownPackageRate?: number;
  strapSuspect?: number;
  lowBatteryNormalRate?: number;
  gateCounts?: CountRow[];
  packageCounts?: CountRow[];
  familyCounts?: CountRow[];
  examples?: unknown;
  recommendation?: string;
};

type Diagnosis = {
  category: string;
  sourceReport: string;
  status: "hold_report_only" | "hold_or_split";
  blockerClass: string;
  primaryMetrics: Record<string, number | string | undefined>;
  splitAxes: string[];
  requiredEvidence: string[];
  nextReportOnlyExperiments: string[];
  doNotDo: string[];
};

const reportsDir = path.join(process.cwd(), "reports");

const sources = [
  "camera-parser-latest.json",
  "smartwatch-parser-latest.json",
  "speaker-parser-latest.json",
  "home-appliance-parser-latest.json",
  "game-console-narrowing-latest.json",
];

const diagnosisByCategory: Record<string, Omit<Diagnosis, "category" | "sourceReport" | "status" | "primaryMetrics">> = {
  camera_discovered: {
    blockerClass: "runtime-category-missing-plus-package-split",
    splitAxes: [
      "body_only vs lens_kit vs fixed_lens vs unknown_package",
      "interchangeable-lens body vs compact/fixed-lens camera",
      "camera body vs cage/bag/lens/accessory contamination",
      "brand/model family coverage gaps such as Ricoh GR, Olympus PEN, Leica D-Lux, Sony Cyber-shot",
    ],
    requiredEvidence: [
      "model_key confidence",
      "package_config confidence",
      "accessory exclusion reason",
      "body/lens/kit/fixed-lens class",
    ],
    nextReportOnlyExperiments: [
      "build package-split confusion report from camera examples",
      "rank unknown_package examples by model family for parser design",
      "separate fixed-lens compact camera policy draft from interchangeable-lens bodies",
    ],
    doNotDo: [
      "Do not create runtime camera category from this report",
      "Do not compare body-only and lens-kit rows in one key",
      "Do not public-promote despite parserReadyRate above 60%",
    ],
  },
  smartwatch_discovered: {
    blockerClass: "accessory-strap-network-generation-ambiguity",
    splitAxes: [
      "watch body vs strap/accessory/parts",
      "Apple Watch SE generation",
      "cellular vs GPS/network unknown",
      "battery health and damaged/parts rows",
    ],
    requiredEvidence: [
      "sku/generation confidence",
      "case size",
      "network type",
      "strap/accessory exclusion",
      "battery health threshold",
    ],
    nextReportOnlyExperiments: [
      "produce SE-generation ambiguity examples",
      "separate strap/accessory suspects from normal rows",
      "summarize network unknown distribution by SKU",
    ],
    doNotDo: [
      "Do not copy operating-map smartwatch ready status to smartwatch_discovered",
      "Do not approve strap/accessory rows",
      "Do not infer SE generation without explicit text",
    ],
  },
  speaker_audio_discovered: {
    blockerClass: "generic-family-dominates",
    splitAxes: [
      "portable Bluetooth speaker vs bookshelf/studio monitor",
      "amp/receiver vs speaker",
      "soundbar vs party speaker vs PA equipment",
      "model-coded rows vs speaker-generic rows",
    ],
    requiredEvidence: [
      "brand + concrete model code",
      "device class",
      "single unit vs set/bundle",
      "amp/receiver/speaker separation",
    ],
    nextReportOnlyExperiments: [
      "rank model-coded families for narrow candidate drafts",
      "separate Marshall/JBL/Britz/Marantz known-model rows",
      "build generic-family hold examples for exclusion rules",
    ],
    doNotDo: [
      "Do not promote speaker/audio whole category",
      "Do not compare generic speaker rows by family alone",
      "Do not mix amp/receiver and speaker comparable keys",
    ],
  },
  home_appliance_tech_discovered: {
    blockerClass: "generic-appliance-and-logistics-risk-dominates",
    splitAxes: [
      "robot vacuum vs stick/handheld vacuum vs bedding cleaner",
      "model-coded appliance vs generic appliance",
      "local pickup/logistics-risk rows",
      "accessory/charger/parts rows",
    ],
    requiredEvidence: [
      "brand + concrete model code",
      "appliance subtype",
      "logistics risk signal",
      "accessory/parts exclusion",
    ],
    nextReportOnlyExperiments: [
      "split robot-vacuum model-coded subset from generic vacuum rows",
      "summarize logistics-risk examples by subtype",
      "rank model-ready appliance rows for future narrow policy draft",
    ],
    doNotDo: [
      "Do not promote home_appliance_tech_discovered",
      "Do not use generic vacuum keys for candidate pool",
      "Do not ignore logistics risk for bulky appliances",
    ],
  },
  game_console_discovered: {
    blockerClass: "broad-contamination-map-only",
    splitAxes: [
      "console body vs game title/chip/card/CD",
      "buying posts vs selling posts",
      "controller/accessory-only vs body/full-set",
      "Switch/PS5 body_narrow split",
    ],
    requiredEvidence: [
      "console body signal",
      "sale listing signal",
      "model and edition",
      "accessory/title exclusion reason",
    ],
    nextReportOnlyExperiments: [
      "keep broad report as contamination map only",
      "continue body_narrow strict parser validation separately",
      "add split candidates only in report, not runtime",
    ],
    doNotDo: [
      "Do not use game_console_discovered as ready source",
      "Do not public-promote broad console report",
      "Do not merge broad and body_narrow metrics",
    ],
  },
};

function pctMetric(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

async function readReport(file: string): Promise<SourceReport> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as SourceReport;
}

function topRows(rows: CountRow[] | undefined, limit = 5): CountRow[] {
  return [...(rows ?? [])].slice(0, limit);
}

async function main(): Promise<void> {
  const diagnoses: Diagnosis[] = [];
  const sourceSnapshots: Record<string, unknown> = {};

  for (const file of sources) {
    const report = await readReport(file);
    const category = String(report.category ?? (file === "game-console-narrowing-latest.json" ? "game_console_discovered" : file));
    const base = diagnosisByCategory[category];
    if (!base) throw new Error(`missing diagnosis for ${category}`);
    const recommendation = String(report.recommendation ?? "");
    diagnoses.push({
      category,
      sourceReport: file,
      status: recommendation.startsWith("hold_or_split") ? "hold_or_split" : "hold_report_only",
      primaryMetrics: {
        total: report.total,
        normal: report.normal,
        parserReadyRate: pctMetric(report.parserReadyRate),
        modelMatchedRate: pctMetric(report.modelMatchedRate),
        modelReadyRate: pctMetric(report.modelReadyRate),
        genericRate: pctMetric(report.genericRate),
        consoleCandidateRate: pctMetric(report.consoleCandidateRate),
        knownModelCandidateRate: pctMetric(report.knownModelCandidateRate),
        unknownPackageRate: pctMetric(report.unknownPackageRate),
        strapSuspect: report.strapSuspect,
      },
      ...base,
    });
    sourceSnapshots[category] = {
      gateCounts: topRows(report.gateCounts),
      packageCounts: topRows(report.packageCounts),
      familyCounts: topRows(report.familyCounts),
    };
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    diagnosisCount: diagnoses.length,
    diagnoses,
    sourceSnapshots,
    guardrails: [
      "Hold-only diagnosis, not runtime design approval",
      "No public promotion",
      "No runtime catalog apply",
      "No candidate pool policy wiring",
      "Do not edit 30일_실행계획.md from this subagent phase",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-hold-diagnosis-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| category | status | blocker_class | metrics | split_axes | next_report_only_experiments | do_not_do |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...diagnoses.map((row) => {
      const metrics = Object.entries(row.primaryMetrics)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${key}=${value}`)
        .join("<br>");
      return [
        row.category,
        row.status,
        row.blockerClass,
        metrics,
        row.splitAxes.map((item) => `- ${item}`).join("<br>"),
        row.nextReportOnlyExperiments.map((item) => `- ${item}`).join("<br>"),
        row.doNotDo.map((item) => `- ${item}`).join("<br>"),
      ].join(" | ");
    }).map((line) => `| ${line} |`),
  ].join("\n");

  const md = [
    "# Parser Hold Diagnosis",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only diagnosis for hold-only categories. This is not public promotion and not runtime wiring.",
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-hold-diagnosis-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-hold-diagnosis-latest.json");
  console.log("wrote reports/parser-hold-diagnosis-latest.md");
  console.log(`hold_diagnosis rows=${diagnoses.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
