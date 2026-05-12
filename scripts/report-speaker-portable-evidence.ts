import fs from "node:fs";
import path from "node:path";

type EvidenceStrength = "official_confirmed" | "vendor_durable_needs_official_backfill";
type SelectedDecision = "first_subset_reference_candidate" | "manual_until_official_source";
type BoundaryDecision = "hold_not_portable_speaker" | "manual_not_first_subset";

type SampleRow = {
  pid: string;
  title?: string;
  name?: string;
  price: number;
  condition: string;
  url: string;
  description?: string;
};

type EvidenceLink = {
  label: string;
  url: string;
  sourceType: "official_product" | "official_support_pdf" | "support_article" | "vendor_catalog";
  confirms: string[];
};

type SelectedModelSeed = {
  caseId: string;
  pid: string;
  brand: string;
  exactModel: string;
  normalizedModel: string;
  deviceClass: "portable_bluetooth_speaker";
  evidenceStrength: EvidenceStrength;
  decision: SelectedDecision;
  evidence: EvidenceLink[];
  notes: string[];
};

type BoundarySeed = {
  caseId: string;
  pid: string;
  observedClass: string;
  decision: BoundaryDecision;
  reason: string;
};

const samplesPath = "category-intelligence/speaker_audio_discovered/normalized_samples.json";
const samples = JSON.parse(fs.readFileSync(samplesPath, "utf8")) as SampleRow[];

const selectedSeeds: SelectedModelSeed[] = [
  {
    caseId: "SPEAKER-PORTABLE-POS-01",
    pid: "355504111",
    brand: "JBL",
    exactModel: "GO 3",
    normalizedModel: "jbl_go_3",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "official_confirmed",
    decision: "first_subset_reference_candidate",
    evidence: [
      {
        label: "JBL Go 3 official spec sheet",
        url: "https://www.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dwa76628cf/pdfs/JBL_Go3_SpecSheet_English.pdf",
        sourceType: "official_support_pdf",
        confirms: ["Portable Waterproof Speaker", "JBL Go 3 model name", "Bluetooth 5.1", "5 hours playtime", "IP67"],
      },
    ],
    notes: ["Listing title is exact-model and sealed/new; no bundle, repair, rental, or accessory token."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-02",
    pid: "407052243",
    brand: "JBL",
    exactModel: "GO 4",
    normalizedModel: "jbl_go_4",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "official_confirmed",
    decision: "first_subset_reference_candidate",
    evidence: [
      {
        label: "JBL Go 4 official product page",
        url: "https://www.jbl.com/bluetooth-speakers/GO-4.html?dwvar_GO-4_color=Black-AM-Current",
        sourceType: "official_product",
        confirms: ["Ultra-Portable Bluetooth Speaker", "JBL Go 4 model name", "IP67", "portable speaker"],
      },
    ],
    notes: ["Listing title and description both include GO4/portable Bluetooth speaker; color-random sale needs owner policy but model identity is clean."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-03",
    pid: "406363021",
    brand: "JBL",
    exactModel: "Boombox 2",
    normalizedModel: "jbl_boombox_2",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "official_confirmed",
    decision: "first_subset_reference_candidate",
    evidence: [
      {
        label: "JBL Boombox 2 official spec sheet",
        url: "https://www.jbl.com/on/demandware.static/-/Sites-masterCatalog_Harman/default/dw9944cb9a/pdfs/JBL_BoomBox2_SpecSheet_English.pdf",
        sourceType: "official_support_pdf",
        confirms: ["Portable Bluetooth Speaker", "JBL Boombox 2 model name", "24 hours playtime", "IPX7"],
      },
    ],
    notes: ["Listing is used but describes normal operation and includes body plus charger; keep separate from PA/partybox/karaoke systems."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-04",
    pid: "405502044",
    brand: "LG",
    exactModel: "PK5",
    normalizedModel: "lg_pk5",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "official_confirmed",
    decision: "first_subset_reference_candidate",
    evidence: [
      {
        label: "LG PK5 official product page",
        url: "https://www.lg.com/us/home-audio/lg-PK5-portable-bluetooth-speaker",
        sourceType: "official_product",
        confirms: ["PK5 model name", "Water-Resistant Bluetooth Speaker", "18 hours playback", "Grab & Go handle", "IPX5"],
      },
    ],
    notes: ["Listing says PK5 model, working battery, Meridian, and camping/car-camping use; no dock-only or accessory-only signal."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-05",
    pid: "402436888",
    brand: "LG",
    exactModel: "PK7W",
    normalizedModel: "lg_pk7w",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "official_confirmed",
    decision: "first_subset_reference_candidate",
    evidence: [
      {
        label: "LG PK7W official product page",
        url: "https://www.lg.com/us/speakers/lg-pk7w-portable-bluetooth-speaker",
        sourceType: "official_product",
        confirms: ["PK7W model name", "Water-Resistant Bluetooth Speaker", "22 hours playback", "Grab & Go handle", "IPX5"],
      },
    ],
    notes: ["Listing title is exact-model and sealed/new; description repeats PK7W, waterproof, long battery, and portable use."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-06",
    pid: "406715641",
    brand: "Britz",
    exactModel: "BZ-JB9600",
    normalizedModel: "britz_bz_jb9600",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "vendor_durable_needs_official_backfill",
    decision: "manual_until_official_source",
    evidence: [
      {
        label: "Compuzone BZ-JB9600 vendor catalog",
        url: "https://compuzone.co.kr/product/product_detail.htm?ProductNo=1152997",
        sourceType: "vendor_catalog",
        confirms: ["BZ-JB9600 model name", "portable Bluetooth speaker"],
      },
      {
        label: "Enuri BZ-JB9600 price/spec page",
        url: "https://www.enuri.com/detail.jsp?modelno=125541087",
        sourceType: "vendor_catalog",
        confirms: ["Britz manufacturer", "wireless Bluetooth speaker", "18 hours playtime", "4,400mAh"],
      },
    ],
    notes: ["Portable model evidence is durable but not manufacturer/support canonical; keep manual until official Britz page or manual is attached."],
  },
  {
    caseId: "SPEAKER-PORTABLE-POS-07",
    pid: "399146598",
    brand: "Britz",
    exactModel: "BZ-LV2200",
    normalizedModel: "britz_bz_lv2200",
    deviceClass: "portable_bluetooth_speaker",
    evidenceStrength: "vendor_durable_needs_official_backfill",
    decision: "manual_until_official_source",
    evidence: [
      {
        label: "Danawa BZ-LV2200 vendor catalog",
        url: "https://prod.danawa.com/info/?pcode=75377888",
        sourceType: "vendor_catalog",
        confirms: ["Britz BZ-LV2200 model name", "Bluetooth speaker", "built-in battery", "18 hours use", "handle"],
      },
      {
        label: "SSG BZ-LV2200 vendor listing",
        url: "https://www.ssg.com/item/itemView.ssg?itemId=1000645784691",
        sourceType: "vendor_catalog",
        confirms: ["BZ-LV2200 model name", "Britz manufacturer/importer", "Bluetooth speaker"],
      },
    ],
    notes: ["Listing text gives BZ-LV2200, FM radio, USB/microSD, battery and portable use; official source is still missing."],
  },
];

const boundarySeeds: BoundarySeed[] = [
  {
    caseId: "SPEAKER-PORTABLE-HOLD-01",
    pid: "394918886",
    observedClass: "pa_speaker_system",
    decision: "hold_not_portable_speaker",
    reason: "JBL EON ONE COMPACT is a PA speaker with mixer/pro-audio signals; do not compare with consumer portable Bluetooth speakers.",
  },
  {
    caseId: "SPEAKER-PORTABLE-HOLD-02",
    pid: "406271183",
    observedClass: "karaoke_microphone_set",
    decision: "hold_not_portable_speaker",
    reason: "JBL AS3 PARTYBOX row is a two-channel wireless microphone/karaoke set, not a portable speaker body comparable.",
  },
  {
    caseId: "SPEAKER-PORTABLE-HOLD-03",
    pid: "403590950",
    observedClass: "accessory_case",
    decision: "hold_not_portable_speaker",
    reason: "Hard-shell case for JBL speaker is accessory-only; never create a speaker comparable key.",
  },
  {
    caseId: "SPEAKER-PORTABLE-HOLD-04",
    pid: "404612902",
    observedClass: "bundle_damaged_mixed_set",
    decision: "hold_not_portable_speaker",
    reason: "Flip6 plus unknown speaker plus broken Flip5 is mixed bundle/damaged inventory; keep out of exact-model rows.",
  },
  {
    caseId: "SPEAKER-PORTABLE-MANUAL-05",
    pid: "407303378",
    observedClass: "home_smart_speaker",
    decision: "manual_not_first_subset",
    reason: "JBL Authentics 200 is exact-model but home/smart tabletop class; not part of the first portable subset without owner policy.",
  },
  {
    caseId: "SPEAKER-PORTABLE-MANUAL-06",
    pid: "402646887",
    observedClass: "home_ac_powered_bluetooth_speaker",
    decision: "manual_not_first_subset",
    reason: "Marshall Acton III is official Bluetooth home speaker and should not share portable battery-speaker keys.",
  },
  {
    caseId: "SPEAKER-PORTABLE-MANUAL-07",
    pid: "404152520",
    observedClass: "home_ac_powered_bluetooth_speaker_with_optional_stand",
    decision: "manual_not_first_subset",
    reason: "Marshall Stanmore III is a home Bluetooth speaker; listing also offers speaker+stand pricing, requiring package policy.",
  },
  {
    caseId: "SPEAKER-PORTABLE-HOLD-08",
    pid: "407189403",
    observedClass: "amp_receiver_large_speaker_bundle",
    decision: "hold_not_portable_speaker",
    reason: "Marantz integrated amp plus JBL 15-inch cabinet bundle is amp/bookshelf/PA-adjacent, not portable Bluetooth.",
  },
];

function requireSample(pid: string) {
  const row = samples.find((sample) => sample.pid === pid);
  if (!row) throw new Error(`Missing speaker sample pid=${pid}`);
  return row;
}

function oneLine(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

const selectedRows = selectedSeeds.map((seed) => {
  const sample = requireSample(seed.pid);
  return {
    ...seed,
    title: sample.title ?? sample.name ?? "",
    price: sample.price,
    condition: sample.condition,
    listingUrl: sample.url,
    listingSignals: {
      exactModelInTitle: oneLine(sample.title ?? sample.name ?? "").toLowerCase().includes(seed.exactModel.toLowerCase().replace(/\s+/g, "")) ||
        oneLine(`${sample.title ?? sample.name ?? ""} ${sample.description ?? ""}`).toLowerCase().includes(seed.exactModel.toLowerCase()),
      hasAccessoryOnlySignal: /케이스|하드쉘|리모컨만|충전기만|부품|고장|수리/.test(`${sample.title ?? ""} ${sample.description ?? ""}`),
      hasBundleSignal: /일괄|세트|묶음|\\+/.test(`${sample.title ?? ""} ${sample.description ?? ""}`),
    },
  };
});

const boundaryRows = boundarySeeds.map((seed) => {
  const sample = requireSample(seed.pid);
  return {
    ...seed,
    title: sample.title ?? sample.name ?? "",
    price: sample.price,
    condition: sample.condition,
    listingUrl: sample.url,
  };
});

const officialConfirmedRows = selectedRows.filter((row) => row.evidenceStrength === "official_confirmed");
const vendorOnlyRows = selectedRows.filter((row) => row.evidenceStrength === "vendor_durable_needs_official_backfill");

const report = {
  generatedAt: new Date().toISOString(),
  category: "speaker_audio_discovered",
  prefix: "speaker-portable-evidence",
  reportOnly: true,
  publicPromotion: false,
  runtimeCatalogApply: false,
  candidatePoolPolicyWiring: false,
  productionDbMutation: false,
  directThirtyDayPlanEdit: false,
  scope: "portable Bluetooth speaker exact-model evidence packet; implementation prep only",
  inputFiles: [
    "reports/speaker-device-class-runtime-prep-latest.md",
    "reports/speaker-model-family-device-class-fixture-packet-latest.md",
    "reports/speaker-no-mutation-runtime-dry-run-latest.md",
    samplesPath,
  ],
  metrics: {
    selectedRows: selectedRows.length,
    officialConfirmedRows: officialConfirmedRows.length,
    vendorOnlyRows: vendorOnlyRows.length,
    firstSubsetReferenceRows: selectedRows.filter((row) => row.decision === "first_subset_reference_candidate").length,
    manualUntilOfficialRows: selectedRows.filter((row) => row.decision === "manual_until_official_source").length,
    boundaryRows: boundaryRows.length,
    runtimeApprovedRows: 0,
    candidatePoolReadyRows: 0,
    publicReadyRows: 0,
  },
  selectedRows,
  boundaryRows,
  firstSubsetRecommendation: {
    rows: officialConfirmedRows.map((row) => row.caseId),
    status: "reference_only_for_main_agent_review",
    rationale: "These rows have exact listing model tokens, portable Bluetooth class, and official JBL/LG product or support evidence. They are still not runtime-approved.",
  },
  holdManualBoundaries: [
    "Do not merge PA, karaoke/microphone, partybox, amp/receiver, bookshelf/desktop, soundbar, home smart/tabletop, accessory-only, rental, damaged, or bundle rows into portable Bluetooth speaker comparable keys.",
    "Britz portable rows are useful fixture rows but need official Britz support/manual/product evidence before joining an official-backed first runtime subset.",
    "Marshall Acton/Stanmore and JBL Authentics rows are exact-model Bluetooth speakers but are home/tabletop classes, not the first portable battery-speaker subset.",
  ],
  ownerDecisionsBlocked: [
    "Owner/main agent must decide whether first speaker runtime review is limited to official-confirmed JBL/LG portable Bluetooth rows only.",
    "Owner/main agent must decide whether vendor-only Britz rows may proceed with retailer/catalog evidence or require manufacturer/support backfill.",
    "Owner/main agent must decide whether home Bluetooth speakers such as Marshall Acton/Stanmore and JBL Authentics get a separate lane.",
    "Owner/main agent must decide final policy for rentals, mixed bundles, optional stand pricing, and color-random sealed inventory before any parser automation.",
    "Direct 30-day plan decision log update is blocked because this work order explicitly forbids editing /Users/iminje/Documents/Claude/Projects/미뇨이/30일_실행계획.md.",
  ],
  nextAction: "Main agent can review the five official-confirmed JBL/LG portable exact-model rows as a narrow reference subset; no runtime/catalog/candidate-pool wiring is approved by this packet.",
};

const reportsDir = path.join(process.cwd(), "reports");
fs.mkdirSync(reportsDir, { recursive: true });

const jsonPath = path.join(reportsDir, "speaker-portable-evidence-latest.json");
const mdPath = path.join(reportsDir, "speaker-portable-evidence-latest.md");

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const selectedTable = selectedRows.map((row) => [
  row.caseId,
  row.brand,
  row.exactModel,
  row.evidenceStrength,
  row.decision,
  `${row.price}`,
  row.title.replace(/\|/g, "\\|"),
  row.evidence.map((source) => `[${source.label}](${source.url})`).join("<br>"),
].join(" | "));

const boundaryTable = boundaryRows.map((row) => [
  row.caseId,
  row.observedClass,
  row.decision,
  `${row.price}`,
  row.title.replace(/\|/g, "\\|"),
  row.reason.replace(/\|/g, "\\|"),
].join(" | "));

const md = [
  "# Speaker Portable Evidence Packet",
  "",
  `- generatedAt: ${report.generatedAt}`,
  `- category: ${report.category}`,
  "- reportOnly: true",
  "- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false",
  "- productionDbMutation/directThirtyDayPlanEdit: false/false",
  "",
  "## Metrics",
  "",
  `- selectedRows: ${report.metrics.selectedRows}`,
  `- officialConfirmedRows: ${report.metrics.officialConfirmedRows}`,
  `- vendorOnlyRows: ${report.metrics.vendorOnlyRows}`,
  `- firstSubsetReferenceRows: ${report.metrics.firstSubsetReferenceRows}`,
  `- manualUntilOfficialRows: ${report.metrics.manualUntilOfficialRows}`,
  `- boundaryRows: ${report.metrics.boundaryRows}`,
  `- runtimeApprovedRows: ${report.metrics.runtimeApprovedRows}`,
  `- candidatePoolReadyRows/publicReadyRows: ${report.metrics.candidatePoolReadyRows}/${report.metrics.publicReadyRows}`,
  "",
  "## Selected Portable Exact-Model Rows",
  "",
  "| caseId | brand | exactModel | evidenceStrength | decision | price | title | evidence |",
  "| --- | --- | --- | --- | --- | ---: | --- | --- |",
  ...selectedTable.map((line) => `| ${line} |`),
  "",
  "## First Subset Recommendation",
  "",
  `- status: ${report.firstSubsetRecommendation.status}`,
  `- rows: ${report.firstSubsetRecommendation.rows.join(", ")}`,
  `- rationale: ${report.firstSubsetRecommendation.rationale}`,
  "",
  "## Hold / Manual Boundaries",
  "",
  "| caseId | observedClass | decision | price | title | reason |",
  "| --- | --- | --- | ---: | --- | --- |",
  ...boundaryTable.map((line) => `| ${line} |`),
  "",
  "## Boundary Rules",
  "",
  ...report.holdManualBoundaries.map((rule) => `- ${rule}`),
  "",
  "## Owner Decisions Blocked",
  "",
  ...report.ownerDecisionsBlocked.map((decision) => `- ${decision}`),
  "",
  "## Next Action",
  "",
  `- ${report.nextAction}`,
  "",
].join("\n");

fs.writeFileSync(mdPath, `${md}\n`);

console.log(JSON.stringify({
  prefix: report.prefix,
  selectedRows: report.metrics.selectedRows,
  officialConfirmedRows: report.metrics.officialConfirmedRows,
  vendorOnlyRows: report.metrics.vendorOnlyRows,
  boundaryRows: report.metrics.boundaryRows,
  jsonPath,
  mdPath,
}, null, 2));
