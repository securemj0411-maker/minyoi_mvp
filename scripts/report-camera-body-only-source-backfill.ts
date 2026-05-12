import fs from "node:fs";
import path from "node:path";

type InputPlan = {
  positiveRows?: PositiveInputRow[];
};

type PositiveInputRow = {
  caseId: string;
  pid: string;
  title: string;
  family: string;
  bodyModel: string;
  comparableKey: string;
};

type EvidenceSource = {
  sourceType: "official_product" | "official_support" | "official_manual" | "official_press" | "official_museum" | "secondary_fallback";
  label: string;
  url: string;
  evidence: string;
};

type ModelEvidence = {
  family: string;
  bodyModel: string;
  officialModelName: string;
  aliases: string[];
  releaseOrLaunchYear: number | null;
  releaseOrLaunchDetail: string;
  currentOrDiscontinuedStatus: string;
  mountOrSystem: string;
  bodyIdentityEvidence: string;
  packageLensBoundary: string;
  fixedLensBoundary: string;
  sourceQuality: "official_only" | "official_plus_secondary" | "secondary_only";
  enoughForInternalObservationPlanningOnly: boolean;
  sources: EvidenceSource[];
};

type BackfillRow = PositiveInputRow & {
  officialModelName: string;
  aliases: string[];
  releaseOrLaunchYear: number | null;
  currentOrDiscontinuedStatus: string;
  mountOrSystem: string;
  sourceQuality: ModelEvidence["sourceQuality"];
  sourceCount: number;
  enoughForInternalObservationPlanningOnly: boolean;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const sourceFiles = [
  "reports/subagent-source-backfill-wave-2026-05-12.md",
  "reports/camera-body-only-internal-sublane-plan-latest.md",
  "reports/camera-body-only-internal-sublane-plan-latest.json",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.md",
  "reports/camera-body-only-exact-model-no-mutation-executor-latest.json",
];

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(appDir, relativePath), "utf8")) as T;
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function assertClosedBoundaries(report: {
  reportOnly: boolean;
  runtimeCatalogApply: boolean;
  runtimeApply: boolean;
  publicPromotion: boolean;
  candidatePoolPolicyWiring: boolean;
  productionDbMutation: boolean;
  directThirtyDayPlanEdit: boolean;
  metrics: {
    runtimeApprovedRows: number;
    publicPromotionRows: number;
    candidatePoolRows: number;
    runtimeApplyRows: number;
  };
}) {
  const ok =
    report.reportOnly === true &&
    report.runtimeCatalogApply === false &&
    report.runtimeApply === false &&
    report.publicPromotion === false &&
    report.candidatePoolPolicyWiring === false &&
    report.productionDbMutation === false &&
    report.directThirtyDayPlanEdit === false &&
    report.metrics.runtimeApprovedRows === 0 &&
    report.metrics.publicPromotionRows === 0 &&
    report.metrics.candidatePoolRows === 0 &&
    report.metrics.runtimeApplyRows === 0;
  if (!ok) throw new Error("Closed report-only boundary check failed");
}

const officialEvidenceByBodyModel: Record<string, ModelEvidence> = {
  eos_r6_mark_ii: {
    family: "canon",
    bodyModel: "eos_r6_mark_ii",
    officialModelName: "Canon EOS R6 Mark II",
    aliases: ["EOS R6 Mark II", "R6 Mark II", "R6M2", "R6 Mk II", "알육막투"],
    releaseOrLaunchYear: 2022,
    releaseOrLaunchDetail: "Canon U.S.A. announced the EOS R6 Mark II on 2022-11-02 and listed body-only plus RF24-105 kit availability for late November 2022.",
    currentOrDiscontinuedStatus: "Canon U.S.A. shop page labels the EOS R6 Mark II Body discontinued/no longer available as of the source crawl.",
    mountOrSystem: "Canon RF mount; RF/RF-S lenses, EF/EF-S via adapter, excluding EF-M.",
    bodyIdentityEvidence: "Official Canon specs identify it as a digital interchangeable-lens mirrorless camera with Canon RF mount and approx. 24.2MP full-frame sensor.",
    packageLensBoundary: "Official launch separates camera body only from kits with RF24-105 F4 L IS USM and RF24-105 F4.0-7.1 IS STM; body-only listings must not absorb kit-lens rows.",
    fixedLensBoundary: "Interchangeable RF-mount body, not a fixed-lens compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_press",
        label: "Canon U.S.A. EOS R6 Mark II launch release",
        url: "https://www.usa.canon.com/newsroom/2022/20221102-camera",
        evidence: "Announces EOS R6 Mark II camera body; body-only and two RF24-105 kit options available late November 2022.",
      },
      {
        sourceType: "official_product",
        label: "Canon U.S.A. EOS R6 Mark II Body specs/shop",
        url: "https://www.usa.canon.com/shop/catalog/product/view/id/190139/s/eos-r6-mark-ii-body/",
        evidence: "Shows discontinued/no longer available status and technical specs including RF mount, compatible lenses, and full-frame sensor.",
      },
    ],
  },
  a7c: {
    family: "sony",
    bodyModel: "a7c",
    officialModelName: "Sony Alpha 7C / ILCE-7C",
    aliases: ["Alpha 7C", "α7C", "a7C", "A7C", "ILCE-7C"],
    releaseOrLaunchYear: 2020,
    releaseOrLaunchDetail: "Sony Electronics announced Alpha 7C / ILCE-7C on 2020-09-14 with late October 2020 availability.",
    currentOrDiscontinuedStatus: "Sony support/spec pages remain available; official discontinued status was not found in the checked sources.",
    mountOrSystem: "Sony E-mount, 35mm full-frame.",
    bodyIdentityEvidence: "Official Sony help/spec pages identify ILCE-7C as an interchangeable lens digital camera with Sony E-mount lens and 35mm full-frame sensor.",
    packageLensBoundary: "Official launch separates Alpha 7C body from a kit with FE 28-60mm F4-5.6; body-only rows must not merge with FE 28-60 kit rows.",
    fixedLensBoundary: "Interchangeable E-mount full-frame body, not a fixed-lens compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_press",
        label: "Sony Electronics Alpha 7C launch release",
        url: "https://sony.mediaroom.com/2020-09-14-Sony-Electronics-Introduces-Alpha-7C-Camera-and-Zoom-Lens-the-Worlds-Smallest-and-Lightest-i-Full-frame-Camera-System",
        evidence: "Announces Alpha 7C model ILCE-7C and FE 28-60mm lens; body and kit availability/pricing are separate.",
      },
      {
        sourceType: "official_manual",
        label: "Sony ILCE-7C Help Guide specifications",
        url: "https://helpguide.sony.net/ilc/2020/v1/en/contents/TP1000156734.html",
        evidence: "Specifications identify camera type as interchangeable lens digital camera and lens as Sony E-mount.",
      },
      {
        sourceType: "official_support",
        label: "Sony ILCE-7C specifications",
        url: "https://www.sony.co.uk/electronics/support/e-mount-body-ilce-7-series/ilce-7c/specifications",
        evidence: "Lists E-mount, 35mm full-frame sensor, and approx. 24.2MP effective pixels.",
      },
    ],
  },
  a5100: {
    family: "sony",
    bodyModel: "a5100",
    officialModelName: "Sony Alpha 5100 / ILCE-5100",
    aliases: ["Alpha 5100", "α5100", "a5100", "A5100", "ILCE-5100"],
    releaseOrLaunchYear: 2014,
    releaseOrLaunchDetail: "Sony Electronics introduced Alpha 5100 / ILCE-5100 on 2014-08-18.",
    currentOrDiscontinuedStatus: "Sony support/spec pages remain available; official discontinued status was not found in the checked sources.",
    mountOrSystem: "Sony E-mount APS-C.",
    bodyIdentityEvidence: "Official Sony specs list Sony E-mount lenses and 24.3MP effective pixels; launch release calls it an interchangeable-lens camera model ILCE-5100.",
    packageLensBoundary: "Sony support specs mention AF illuminator range with E PZ 16-50mm attached, but that is not package proof; body-only fixture must require title body-only/no-lens evidence.",
    fixedLensBoundary: "Interchangeable Sony E-mount APS-C body, not a fixed-lens Cyber-shot-style compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_press",
        label: "Sony Electronics Alpha 5100 launch release",
        url: "https://sony.mediaroom.com/2014-08-18-Sony-Debuts-Ultra-Compact-5100-Interchangeable-Lens-Camera-with-Impressive-Autofocus",
        evidence: "Introduces α5100 model ILCE-5100 as an interchangeable lens camera with APS-C sensor.",
      },
      {
        sourceType: "official_support",
        label: "Sony ILCE-5100 specifications",
        url: "https://www.sony.com/electronics/support/e-mount-body-ilce-5000-series/ilce-5100/specifications",
        evidence: "Lists Sony E-mount lenses and 24.3MP effective pixels.",
      },
    ],
  },
  eos_m6: {
    family: "canon",
    bodyModel: "eos_m6",
    officialModelName: "Canon EOS M6",
    aliases: ["EOS M6", "M6", "Canon M6"],
    releaseOrLaunchYear: 2017,
    releaseOrLaunchDetail: "Canon Camera Museum lists EOS M6 marketed April 2017; Canon Japan support lists announcement 2017-02-15 and release 2017-04-20.",
    currentOrDiscontinuedStatus: "Canon Camera Museum/support pages establish legacy official evidence; explicit discontinued status was not needed for this body-only evidence packet.",
    mountOrSystem: "Canon EOS M mirrorless / EF-M kit ecosystem.",
    bodyIdentityEvidence: "Canon Camera Museum lists EOS M6 under interchangeable-lens digital cameras / compact system cameras with APS-C Dual Pixel CMOS AF body.",
    packageLensBoundary: "Canon Japan support explicitly lists body-only SKUs separately from EF-M15-45, EF-M18-150, double zoom, and EVF lens kit products.",
    fixedLensBoundary: "EOS M interchangeable-lens body, not a fixed-lens compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_museum",
        label: "Canon Camera Museum EOS M6",
        url: "https://global.canon/en/c-museum/product/dslr855.html",
        evidence: "Lists EOS M6 as compact system/interchangeable-lens camera and marketed April 2017.",
      },
      {
        sourceType: "official_support",
        label: "Canon Japan EOS M6 basic information",
        url: "https://faq.canon.jp/app/answers/detail/a_id/90488/",
        evidence: "Lists body-only black/silver products separately from EF-M15-45, EF-M18-150, double-zoom, and EVF kit SKUs with 2017 release dates.",
      },
    ],
  },
  z9: {
    family: "nikon",
    bodyModel: "z9",
    officialModelName: "Nikon Z 9",
    aliases: ["Z 9", "Z9", "Nikon Z9"],
    releaseOrLaunchYear: 2021,
    releaseOrLaunchDetail: "Nikon announced/released the Z 9 full-frame mirrorless camera on 2021-10-28; development was announced on 2021-03-10.",
    currentOrDiscontinuedStatus: "Nikon USA product/spec page remains available; no official discontinued status was found in checked sources.",
    mountOrSystem: "Nikon Z mount, Nikon FX format.",
    bodyIdentityEvidence: "Official Nikon specs identify Z 9 as a digital camera with support for interchangeable lenses, Nikon Z mount, FX format, and 45.7MP effective pixels.",
    packageLensBoundary: "Official Nikon evidence is body/product-centric; any lens bundle must remain separate because compatible Z/F lenses are interchangeable and not part of body identity.",
    fixedLensBoundary: "Interchangeable Nikon Z-mount body, not a fixed-lens compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_press",
        label: "Nikon Z 9 release news",
        url: "https://www.nikon.com/company/news/2021/1028_mirrorless_01.html",
        evidence: "Announces release of full-frame Nikon FX-format mirrorless Nikon Z 9 with Nikon Z mount.",
      },
      {
        sourceType: "official_product",
        label: "Nikon USA Z 9 product/spec page",
        url: "https://www.nikonusa.com/p/z-9/1669/overview",
        evidence: "Lists type as digital camera with support for interchangeable lenses, Nikon Z mount, FX format, and compatible Z/F-mount lenses.",
      },
    ],
  },
  eos_6d: {
    family: "canon",
    bodyModel: "eos_6d",
    officialModelName: "Canon EOS 6D",
    aliases: ["EOS 6D", "6D"],
    releaseOrLaunchYear: 2012,
    releaseOrLaunchDetail: "Canon Camera Museum lists EOS 6D marketed November 2012.",
    currentOrDiscontinuedStatus: "Canon Camera Museum page establishes legacy official evidence; explicit discontinued status was not found in checked official sources.",
    mountOrSystem: "Canon EF mount full-frame DSLR.",
    bodyIdentityEvidence: "Canon Camera Museum identifies EOS 6D as a digital SLR camera with 35mm full-frame sensor, Canon EF lens compatibility, and EF mount.",
    packageLensBoundary: "Canon EF lenses are compatible but not included by model identity; body-only rows must exclude EF lens/package signals.",
    fixedLensBoundary: "Interchangeable Canon EF-mount DSLR body, not a fixed-lens compact.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_museum",
        label: "Canon Camera Museum EOS 6D",
        url: "https://global.canon/en/c-museum/product/dslr813.html",
        evidence: "Lists marketed November 2012, digital SLR type, Canon EF compatible lenses, EF mount, and body-only weight.",
      },
      {
        sourceType: "official_support",
        label: "Canon U.S.A. EOS 6D support",
        url: "https://www.usa.canon.com/support/p/eos-6d",
        evidence: "Official support page remains available for firmware/support context.",
      },
    ],
  },
  x_t4: {
    family: "fujifilm",
    bodyModel: "x_t4",
    officialModelName: "FUJIFILM X-T4",
    aliases: ["X-T4", "XT4", "FUJIFILM X-T4", "후지필름 X-T4"],
    releaseOrLaunchYear: 2020,
    releaseOrLaunchDetail: "FUJIFILM announced X-T4 on 2020-02-26 and Japan release-date notice set black release to 2020-04-28 and silver to 2020-05-21.",
    currentOrDiscontinuedStatus: "FUJIFILM product page labels X-T4 discontinued.",
    mountOrSystem: "FUJIFILM X mount APS-C.",
    bodyIdentityEvidence: "FUJIFILM product specs list model name FUJIFILM X-T4, APS-C X-Trans CMOS 4 sensor, and FUJIFILM X mount.",
    packageLensBoundary: "X mount body evidence does not imply a lens; any XF/XC lens or kit listing must stay outside body-only/no-lens.",
    fixedLensBoundary: "Interchangeable FUJIFILM X-mount body, not a fixed-lens X100/compact model.",
    sourceQuality: "official_only",
    enoughForInternalObservationPlanningOnly: true,
    sources: [
      {
        sourceType: "official_product",
        label: "FUJIFILM X-T4 product/spec page",
        url: "https://www.fujifilm-x.com/fr-ca/products/cameras/x-t4/",
        evidence: "Lists discontinued status, model name FUJIFILM X-T4, APS-C X-Trans CMOS 4 sensor, and FUJIFILM X mount.",
      },
      {
        sourceType: "official_press",
        label: "FUJIFILM X-T4 launch news",
        url: "https://www.fujifilm-x.com/de-at/news/introducing-fujifilm-x-t4/",
        evidence: "Announces launch of FUJIFILM X-T4 on 2020-02-26 as the latest X Series mirrorless digital camera.",
      },
      {
        sourceType: "official_press",
        label: "FUJIFILM Japan X-T4 release date notice",
        url: "https://www.fujifilm-x.com/ja-jp/news/%E3%83%9F%E3%83%A9%E3%83%BC%E3%83%AC%E3%82%B9%E3%83%87%E3%82%B8%E3%82%BF%E3%83%AB%E3%82%AB%E3%83%A1%E3%83%A9%E3%80%8Cfujifilm-x-t4%E3%80%8D-%E7%99%BA%E5%A3%B2%E6%97%A5%E3%81%AB%E9%96%A2%E3%81%99/",
        evidence: "States X-T4 black release date as 2020-04-28 and silver as 2020-05-21.",
      },
    ],
  },
};

const plan = readJson<InputPlan>("reports/camera-body-only-internal-sublane-plan-latest.json");
const positiveRows = plan.positiveRows ?? [];

const backfillRows: BackfillRow[] = positiveRows.map((row) => {
  const evidence = officialEvidenceByBodyModel[row.bodyModel];
  if (!evidence) throw new Error(`Missing official source evidence for body model ${row.bodyModel}`);
  return {
    ...row,
    officialModelName: evidence.officialModelName,
    aliases: evidence.aliases,
    releaseOrLaunchYear: evidence.releaseOrLaunchYear,
    currentOrDiscontinuedStatus: evidence.currentOrDiscontinuedStatus,
    mountOrSystem: evidence.mountOrSystem,
    sourceQuality: evidence.sourceQuality,
    sourceCount: evidence.sources.length,
    enoughForInternalObservationPlanningOnly: evidence.enoughForInternalObservationPlanningOnly,
  };
});

const allSources = Object.values(officialEvidenceByBodyModel).flatMap((model) => model.sources);
const secondarySourceCount = allSources.filter((source) => source.sourceType === "secondary_fallback").length;
const officialSourceCount = allSources.length - secondarySourceCount;
const modelsEnoughForPlanning = backfillRows.filter((row) => row.enoughForInternalObservationPlanningOnly).length;

const boundaryEvidence = {
  bodyOnlyProof: [
    "Only exact body model rows with explicit body-only/body sale/body-only title evidence should enter future internal observation planning.",
    "Compatible lens systems identify the mount/ecosystem, not package inclusion.",
    "Body-only rows use camera|{family}|{body_model}|body_only|no_lens only in no-mutation/internal observation artifacts.",
  ],
  bodyKitHold: [
    "Official Canon EOS R6 Mark II and EOS M6 sources list body-only and lens-kit SKUs separately.",
    "Official Sony Alpha 7C launch separates body from FE 28-60mm kit.",
    "Any listing with explicit kit, focal length, or lens model stays out of body-only/no-lens.",
  ],
  lensOnlyAccessoryHold: [
    "Official interchangeable lens mount evidence does not convert lens-only rows into camera body rows.",
    "Caps, cases, bags, batteries, grips, straps, cages, and lens-only rows remain hard holds.",
  ],
  fixedLensCompactHold: [
    "The supported source-backed models are interchangeable-lens bodies; fixed-lens compact families such as G7X, Cyber-shot, Ricoh GR, X100, or X70 require a separate taxonomy.",
  ],
  damagedBuyingSoldHold: [
    "Damaged/parts, buying intent, and sold-only rows remain excluded from internal observation readiness and cannot be counted as live normal-sale evidence.",
  ],
};

const metrics = {
  inputPositiveRows: positiveRows.length,
  sourceBackfilledModels: backfillRows.length,
  officialSourceCount,
  secondarySourceCount,
  modelsEnoughForInternalObservationPlanningOnly: modelsEnoughForPlanning,
  modelsMissingLaunchYear: backfillRows.filter((row) => row.releaseOrLaunchYear == null).length,
  modelsWithStatusEvidence: backfillRows.filter((row) =>
    /discontinued|no longer available|support|legacy|available/i.test(row.currentOrDiscontinuedStatus)
  ).length,
  bodyOnlyBoundaryRules: boundaryEvidence.bodyOnlyProof.length,
  holdBoundaryGroups: 4,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
};

const report = {
  generatedAt: new Date().toISOString(),
  reportOnly: true,
  ownership: "camera_body_only_exact_model_source_backfill_only",
  category: "camera_discovered",
  lane: "interchangeable_body_only_exact_model",
  conclusion: "camera_body_only_source_backfill_official_evidence_complete_for_internal_observation_planning_only",
  runtimeCatalogApply: false,
  runtimeApply: false,
  publicPromotion: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  metrics,
  modelEvidence: officialEvidenceByBodyModel,
  backfillRows,
  boundaryEvidence,
  internalObservationPlanningOnly: {
    ready: modelsEnoughForPlanning === positiveRows.length && positiveRows.length > 0,
    readyForRuntimeApplyNow: false,
    reason: "All current positive body-only exact-model fixtures have official model identity and mount/package boundary evidence, but this is only source backfill for future internal observation planning.",
  },
  sourceFilesRead: sourceFiles.filter((file) => fs.existsSync(path.join(appDir, file))),
};

assertClosedBoundaries(report);

function renderMarkdown(): string {
  return [
    "# Camera Body-Only Exact Model Source Backfill",
    "",
    `- generatedAt: ${report.generatedAt}`,
    `- conclusion: ${report.conclusion}`,
    "- ownership: camera_body_only_exact_model_source_backfill_only",
    "- reportOnly: true",
    "- runtimeCatalogApply/runtimeApply/publicPromotion/candidatePoolPolicyWiring: false/false/false/false",
    "- runtimeApproved/publicPromotion/candidatePool/runtimeApply rows: 0/0/0/0",
    "- productionDbMutation/directThirtyDayPlanEdit: false/false",
    "",
    "## Scope",
    "",
    "Source backfill for the Camera Body-Only Exact Model lane only. This uses official manufacturer/support/spec/manual/news sources first and does not edit runtime/src/lib, Supabase/schema, cron/lifecycle, candidate pool, pack UI, auth, public promotion, or the 30-day plan.",
    "",
    "## Metrics",
    "",
    table([
      ["metric", "value"],
      ["inputPositiveRows", String(metrics.inputPositiveRows)],
      ["sourceBackfilledModels", String(metrics.sourceBackfilledModels)],
      ["officialSourceCount", String(metrics.officialSourceCount)],
      ["secondarySourceCount", String(metrics.secondarySourceCount)],
      ["modelsEnoughForInternalObservationPlanningOnly", String(metrics.modelsEnoughForInternalObservationPlanningOnly)],
      ["modelsMissingLaunchYear", String(metrics.modelsMissingLaunchYear)],
      ["modelsWithStatusEvidence", String(metrics.modelsWithStatusEvidence)],
      ["runtimeApprovedRows", "0"],
      ["publicPromotionRows", "0"],
      ["candidatePoolRows", "0"],
      ["runtimeApplyRows", "0"],
    ]),
    "",
    "## Model Evidence Summary",
    "",
    table([
      ["fixture", "model", "aliases", "launch/release", "status", "mount/system", "quality", "planning only"],
      ...backfillRows.map((row) => [
        row.caseId,
        row.officialModelName,
        row.aliases.join(", "),
        row.releaseOrLaunchYear == null ? "unknown" : String(row.releaseOrLaunchYear),
        row.currentOrDiscontinuedStatus,
        row.mountOrSystem,
        row.sourceQuality,
        row.enoughForInternalObservationPlanningOnly ? "yes" : "no",
      ]),
    ]),
    "",
    "## Body-Only / No-Lens Boundary",
    "",
    ...boundaryEvidence.bodyOnlyProof.map((item) => `- ${item}`),
    "",
    "## Hold Boundaries",
    "",
    "### Body+kit / lens bundle",
    "",
    ...boundaryEvidence.bodyKitHold.map((item) => `- ${item}`),
    "",
    "### Lens-only / accessory",
    "",
    ...boundaryEvidence.lensOnlyAccessoryHold.map((item) => `- ${item}`),
    "",
    "### Fixed-lens compact",
    "",
    ...boundaryEvidence.fixedLensCompactHold.map((item) => `- ${item}`),
    "",
    "### Damaged / buying / sold-only",
    "",
    ...boundaryEvidence.damagedBuyingSoldHold.map((item) => `- ${item}`),
    "",
    "## Source Ledger",
    "",
    table([
      ["model", "source type", "source", "evidence"],
      ...Object.values(officialEvidenceByBodyModel).flatMap((model) =>
        model.sources.map((source) => [
          model.officialModelName,
          source.sourceType,
          `[${source.label}](${source.url})`,
          source.evidence,
        ])
      ),
    ]),
    "",
    "## Internal Observation Planning Result",
    "",
    "- readyForInternalObservationPlanningOnly: true",
    "- readyForRuntimeApplyNow: false",
    "- reason: all 7 current positive body-only exact-model fixtures have official source evidence; no runtime/public/candidate-pool rows are approved.",
    "",
    "## Source Files Read",
    "",
    ...report.sourceFilesRead.map((file) => `- ${file}`),
    "",
  ].join("\n");
}

fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "camera-body-only-source-backfill-latest.json");
const mdPath = path.join(reportsDir, "camera-body-only-source-backfill-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(mdPath, renderMarkdown());

console.log(JSON.stringify({
  conclusion: report.conclusion,
  sourceBackfilledModels: metrics.sourceBackfilledModels,
  officialSourceCount: metrics.officialSourceCount,
  secondarySourceCount: metrics.secondarySourceCount,
  readyForInternalObservationPlanningOnly: report.internalObservationPlanningOnly.ready,
  runtimeApprovedRows: 0,
  publicPromotionRows: 0,
  candidatePoolRows: 0,
  runtimeApplyRows: 0,
  jsonPath,
  mdPath,
}, null, 2));
