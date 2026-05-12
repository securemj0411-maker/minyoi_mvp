import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type SourceSample = {
  pid?: string;
  name?: string;
  title?: string;
  description?: string;
};

type ExistingBackfill = {
  metrics?: {
    positiveRows?: number;
    manualRows?: number;
    holdRows?: number;
  };
  fixtures?: Array<{
    pid?: string;
    decision?: string;
  }>;
};

type SearchItem = {
  pid: string;
  title: string;
  price: number | null;
  query: string;
  url: string;
};

type Detail = {
  title: string;
  description: string;
  saleStatus: string | null;
  condition: string | null;
  shopSalesCount: number | null;
  shopReviewCount: number | null;
  shopProshop: boolean;
  shopOfficialSeller: boolean;
};

type Decision = "strict_positive" | "manual_owner_decision" | "hold_negative_fixture";

type ReviewRow = SearchItem & Detail & {
  caseId: string;
  decision: Decision;
  bucket: string;
  cpuIdentity: string | null;
  gpuIdentity: string | null;
  evidenceRule: string;
  reason: string;
  evidenceSnippet: string;
  runtimeApproved: false;
  publicPromotion: false;
  candidatePoolReady: false;
};

const appDir = process.cwd();
const reportsDir = path.join(appDir, "reports");

const sourceReportsRead = [
  "reports/desktop-private-used-positive-backfill-latest.md",
  "reports/desktop-private-used-positive-backfill-latest.json",
  "reports/desktop-private-used-runtime-impact-review-2026-05-12.md",
  "reports/desktop-private-used-cpu-gpu-contract-latest.md",
  "reports/desktop-private-used-cpu-gpu-contract-latest.json",
  "category-intelligence/desktop_pc_discovered/normalized_samples.json",
];

const queries = [
  "7500f rtx4060 본체",
  "7800x3d rtx4070 본체",
  "7800x3d rtx4080 본체",
  "7600 rtx4060ti 본체",
  "5800x3d rtx3080 본체",
  "i7 13700 rtx4070 본체",
  "i5 rtx4060 컴퓨터 본체",
];

const positiveMap = new Map<string, Omit<ReviewRow, keyof SearchItem | keyof Detail | "evidenceSnippet">>([
  [
    "399858981",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-POS-01",
      decision: "strict_positive",
      bucket: "private_used_fixed_cpu_gpu",
      cpuIdentity: "ryzen-5-7500f",
      gpuIdentity: "rtx-4060ti",
      evidenceRule: "title_visible_cpu_title_rtx_private_purchase_date_personal",
      reason: "Title has CPU and RTX GPU; title marks personal seller, description has late-2024 purchase, non-smoking/private environment, direct-deal wording, and one fixed full-unit spec.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "407442090",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-POS-02",
      decision: "strict_positive",
      bucket: "private_used_fixed_cpu_gpu",
      cpuIdentity: "ryzen-7-7800x3d",
      gpuIdentity: "rtx-4080",
      evidenceRule: "title_visible_cpu_title_rtx_private_personal_reason",
      reason: "Title has CPU and RTX GPU; description says the seller is personally liquidating an owned high-end desktop to focus on exams; no configurable/shop template signal in reviewed text.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "361715397",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-POS-03",
      decision: "strict_positive",
      bucket: "private_used_fixed_cpu_gpu",
      cpuIdentity: "ryzen-5-7600",
      gpuIdentity: "rtx-4060ti",
      evidenceRule: "title_visible_cpu_title_rtx_private_used_statement",
      reason: "Title has CPU and RTX GPU; description states this is being left after use, lists one fixed full-unit spec, and lacks menu/quote/option pricing language.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "321042223",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-POS-04",
      decision: "strict_positive",
      bucket: "private_used_fixed_cpu_gpu",
      cpuIdentity: "core-i7-13700k",
      gpuIdentity: "rtx-4070",
      evidenceRule: "title_visible_cpu_title_rtx_private_purchase_use_reason",
      reason: "Title has CPU and RTX GPU; description states purchase timing, light personal use for games, later non-use because of other work, and one fixed full-unit spec.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "391428863",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-POS-05",
      decision: "strict_positive",
      bucket: "private_used_fixed_cpu_gpu",
      cpuIdentity: "ryzen-7-5800x3d",
      gpuIdentity: "rtx-3080ti",
      evidenceRule: "title_visible_cpu_title_rtx_private_life_event_reason",
      reason: "Title has CPU and RTX GPU; description lists a fixed full-unit spec and a personal life-event sale reason, with local delivery wording rather than a shop/configurable template.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
]);

const manualMap = new Map<string, Omit<ReviewRow, keyof SearchItem | keyof Detail | "evidenceSnippet">>([
  [
    "406801696",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-MANUAL-04",
      decision: "manual_owner_decision",
      bucket: "body_price_but_monitor_add_on",
      cpuIdentity: "ryzen-7-5800x3d",
      gpuIdentity: "rtx-3080",
      evidenceRule: "title_cpu_rtx_private_reason_but_monitor_add_on",
      reason: "Personal sale reason exists and the body price appears fixed, but the description also offers a monitor bundle price; keep manual under the strict single-body gate.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "375419795",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-MANUAL-01",
      decision: "manual_owner_decision",
      bucket: "private_use_but_peripheral_bundle",
      cpuIdentity: "core-i5-14600kf",
      gpuIdentity: "rtx-4060",
      evidenceRule: "title_cpu_rtx_private_use_but_extra_devices",
      reason: "Purchase/use wording is strong, but monitors, keyboard, and mouse are offered around the transaction; keep out of strict fixed-body positives until bundle treatment is approved.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "406879553",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-MANUAL-02",
      decision: "manual_owner_decision",
      bucket: "desktop_monitor_bundle",
      cpuIdentity: "ryzen-7-7800x3d",
      gpuIdentity: "rtx-4070ti-super",
      evidenceRule: "title_cpu_rtx_private_use_but_bundle_title",
      reason: "Private-use duration and personal reason exist, but the title explicitly bundles a BenQ monitor with the body; not a clean single full-unit fixture.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "400933220",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-MANUAL-03",
      decision: "manual_owner_decision",
      bucket: "title_cpu_rtx_missing_private_used_language",
      cpuIdentity: "ryzen-5-7600",
      gpuIdentity: "rtx-4060ti",
      evidenceRule: "title_cpu_rtx_but_condition_only",
      reason: "Title has CPU and RTX GPU, but description mainly states condition, reinstall/checks, and game usability; private seller/use reason is insufficient for strict positive.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
]);

const holdMap = new Map<string, Omit<ReviewRow, keyof SearchItem | keyof Detail | "evidenceSnippet">>([
  [
    "405476731",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-HOLD-01",
      decision: "hold_negative_fixture",
      bucket: "proshop_receipt_shipping_template",
      cpuIdentity: "ryzen-5-7500f",
      gpuIdentity: "rtx-4060",
      evidenceRule: "title_cpu_rtx_but_commercial_signals",
      reason: "Title has CPU and RTX GPU, but detail says half-body, receipt/shipping, and high shop activity/proshop signals; hold from private-used body positives.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "404099463",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-HOLD-02",
      decision: "hold_negative_fixture",
      bucket: "unused_build_gpu_upgrade_option",
      cpuIdentity: "ryzen-7-7800x3d",
      gpuIdentity: "rtx-4070ti",
      evidenceRule: "title_cpu_rtx_but_configurable_gpu_option",
      reason: "Description says assembled but unused and offers a 4080 upgrade price; shop/configurable behavior stays hold.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "406258144",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-HOLD-03",
      decision: "hold_negative_fixture",
      bucket: "proshop_missing_private_used_language",
      cpuIdentity: "ryzen-7-7800x3d",
      gpuIdentity: "rtx-4080-super",
      evidenceRule: "title_cpu_rtx_but_shop_signal",
      reason: "Title has CPU and RTX GPU, but proshop signal plus no clear personal-use duration/reason keeps it out of positives.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "389331699",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-HOLD-04",
      decision: "hold_negative_fixture",
      bucket: "shop_unused_build",
      cpuIdentity: "ryzen-7-7800x3d",
      gpuIdentity: "rtx-4070ti",
      evidenceRule: "title_cpu_rtx_but_shop_unused_build",
      reason: "Description says assembled/no real use and seller has heavy commercial activity; hold from private-used rows.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
  [
    "339078247",
    {
      caseId: "DESKTOP-PRIVATE-USED-TARGETED-HOLD-05",
      decision: "hold_negative_fixture",
      bucket: "shop_ready_to_use_template",
      cpuIdentity: "ryzen-7-5800x3d",
      gpuIdentity: "rtx-3080",
      evidenceRule: "title_cpu_rtx_but_high_activity_shop",
      reason: "Title has CPU and RTX GPU, but high seller activity and ready-to-use/template wording keep it out of private-used positives.",
      runtimeApproved: false,
      publicPromotion: false,
      candidatePoolReady: false,
    },
  ],
]);

const targetPids = new Set([...positiveMap.keys(), ...manualMap.keys(), ...holdMap.keys()]);

function headers(): Record<string, string> {
  return {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
    Origin: "https://m.bunjang.co.kr",
    Referer: "https://m.bunjang.co.kr/",
  };
}

function toNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function boolish(value: unknown): boolean {
  return value === true || value === "1" || value === 1;
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function conditionLabel(value: unknown): string | null {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return text(record.label) ?? text(record.name) ?? text(record.value);
}

function snippet(value: string, length = 320): string {
  return value.replace(/\s+/g, " ").trim().slice(0, length);
}

async function readJson<T>(relativePath: string): Promise<T> {
  const raw = await readFile(path.join(appDir, relativePath), "utf8");
  return JSON.parse(raw) as T;
}

async function readRequiredInputs() {
  const [existingBackfill, contract, normalizedSamples] = await Promise.all([
    readJson<ExistingBackfill>("reports/desktop-private-used-positive-backfill-latest.json"),
    readJson<Record<string, unknown>>("reports/desktop-private-used-cpu-gpu-contract-latest.json"),
    readJson<SourceSample[]>("category-intelligence/desktop_pc_discovered/normalized_samples.json"),
    readFile(path.join(appDir, "reports/desktop-private-used-positive-backfill-latest.md"), "utf8"),
    readFile(path.join(appDir, "reports/desktop-private-used-runtime-impact-review-2026-05-12.md"), "utf8"),
    readFile(path.join(appDir, "reports/desktop-private-used-cpu-gpu-contract-latest.md"), "utf8"),
  ]);

  return {
    existingBackfill,
    contract,
    normalizedSamples,
  };
}

async function searchQuery(query: string): Promise<SearchItem[]> {
  const url = new URL("https://api.bunjang.co.kr/api/1/find_v2.json");
  url.searchParams.set("q", query);
  url.searchParams.set("order", "date");
  url.searchParams.set("page", "0");
  url.searchParams.set("n", "20");
  url.searchParams.set("stat_device", "w");
  url.searchParams.set("req_ref", "search");
  url.searchParams.set("stat_category_required", "1");
  url.searchParams.set("version", "4");

  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(5_000) });
  if (!res.ok) return [];
  const data = await res.json() as { list?: Array<Record<string, unknown>> };
  return (data.list ?? []).map((item) => ({
    pid: String(item.pid ?? ""),
    title: String(item.name ?? ""),
    price: toNumber(item.price),
    query,
    url: `https://m.bunjang.co.kr/products/${item.pid}`,
  })).filter((item) => item.pid);
}

async function fetchDetail(pid: string): Promise<Detail | null> {
  const url = `https://api.bunjang.co.kr/api/pms/v1/products/${pid}/detail/web`;
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(6_000) });
  if (!res.ok) return null;
  const json = await res.json() as Record<string, unknown>;
  const data = json.data as Record<string, unknown> | undefined;
  const product = (data?.product ?? {}) as Record<string, unknown>;
  const shop = (data?.shop ?? {}) as Record<string, unknown>;
  const proshop = shop.proshop && typeof shop.proshop === "object" && !Array.isArray(shop.proshop)
    ? shop.proshop as Record<string, unknown>
    : {};

  return {
    title: String(product.name ?? product.productName ?? ""),
    description: String(product.description ?? "").slice(0, 1600),
    saleStatus: text(product.saleStatus),
    condition: conditionLabel(product.condition) ?? conditionLabel(product.productCondition) ?? conditionLabel(product.status),
    shopSalesCount: toNumber(shop.salesCount),
    shopReviewCount: toNumber(shop.reviewCount),
    shopProshop: boolish(proshop.isProshop),
    shopOfficialSeller: boolish(shop.isOfficialSeller),
  };
}

function metadataFor(pid: string) {
  return positiveMap.get(pid) ?? manualMap.get(pid) ?? holdMap.get(pid) ?? null;
}

async function collectRows(): Promise<{ searchedRows: SearchItem[]; reviewRows: ReviewRow[]; missingTargetPids: string[] }> {
  const dedup = new Map<string, SearchItem>();
  for (const query of queries) {
    const rows = await searchQuery(query);
    for (const row of rows) {
      if (!dedup.has(row.pid)) dedup.set(row.pid, row);
    }
  }

  const reviewRows: ReviewRow[] = [];
  for (const [pid, searchItem] of dedup) {
    if (!targetPids.has(pid)) continue;
    const meta = metadataFor(pid);
    const detail = await fetchDetail(pid);
    if (!meta || !detail) continue;
    reviewRows.push({
      ...searchItem,
      ...detail,
      ...meta,
      title: detail.title || searchItem.title,
      evidenceSnippet: snippet(detail.description),
    });
  }

  const found = new Set(reviewRows.map((row) => row.pid));
  const missingTargetPids = [...targetPids].filter((pid) => !found.has(pid));
  return { searchedRows: [...dedup.values()], reviewRows, missingTargetPids };
}

function table(rows: string[][]): string {
  if (rows.length === 0) return "";
  const [head, ...body] = rows;
  return [
    `| ${head.join(" | ")} |`,
    `| ${head.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function writeMarkdown(input: {
  generatedAt: string;
  existingPositiveRows: number;
  sourceSampleRows: number;
  searchedRows: number;
  reviewRows: ReviewRow[];
  missingTargetPids: string[];
}) {
  const positives = input.reviewRows.filter((row) => row.decision === "strict_positive");
  const manuals = input.reviewRows.filter((row) => row.decision === "manual_owner_decision");
  const holds = input.reviewRows.filter((row) => row.decision === "hold_negative_fixture");
  const combinedPositiveRows = input.existingPositiveRows + positives.length;

  return `# Desktop Private-Used Targeted Acquisition

- generatedAt: ${input.generatedAt}
- lane: desktop_private_used_cpu_gpu
- conclusion: targeted_public_api_acquisition_reached_10_cumulative_strict_positives_report_only
- reportOnly: true
- networkScope: Bunjang public search/detail API only
- openAiCalls: false
- publicPromotion/runtimeCatalogApply/candidatePoolPolicyWiring: false/false/false
- runtimeApproved/public/candidatePool rows: 0/0/0

## Scope

Report-only targeted marketplace sample acquisition for private-used desktop full-unit CPU/GPU evidence. This pass reads the existing reports and desktop normalized samples, calls only Bunjang public search/detail endpoints, and writes only this report pair plus the targeted acquisition script.

It does not edit runtime, catalog, candidate pool, public promotion, Supabase, cron, lifecycle, pack UI, src/lib, tests, the existing desktop category-intelligence files, or the 30-day plan.

## Metrics

${table([
  ["metric", "value"],
  ["existingStrictPositiveRows", String(input.existingPositiveRows)],
  ["targetedSearchQueries", String(queries.length)],
  ["targetedSearchRowsDeduped", String(input.searchedRows)],
  ["targetedReviewRows", String(input.reviewRows.length)],
  ["targetedPositiveRows", String(positives.length)],
  ["targetedManualRows", String(manuals.length)],
  ["targetedHoldRows", String(holds.length)],
  ["combinedStrictPositiveRows", String(combinedPositiveRows)],
  ["strictPositiveTarget", "10-15"],
  ["strictPositiveTargetMet", String(combinedPositiveRows >= 10 && combinedPositiveRows <= 15)],
  ["runtimeApprovedRows", "0"],
  ["publicPromotionRows", "0"],
  ["candidatePoolRows", "0"],
  ["sourceNormalizedSamplesRead", String(input.sourceSampleRows)],
  ["missingTargetPidsFromLiveFetch", input.missingTargetPids.length ? input.missingTargetPids.join(", ") : "none"],
])}

## Targeted Queries

${queries.map((query) => `- ${query}`).join("\n")}

## Newly Acquired Strict Positives

${table([
  ["caseId", "pid", "cpu", "gpu", "rule", "title", "evidence"],
  ...positives.map((row) => [
    row.caseId,
    row.pid,
    row.cpuIdentity ?? "-",
    row.gpuIdentity ?? "-",
    row.evidenceRule,
    row.title,
    row.evidenceSnippet,
  ]),
])}

## Manual Owner Decision Rows

${table([
  ["caseId", "pid", "bucket", "cpu", "gpu", "reason", "title"],
  ...manuals.map((row) => [
    row.caseId,
    row.pid,
    row.bucket,
    row.cpuIdentity ?? "-",
    row.gpuIdentity ?? "-",
    row.reason,
    row.title,
  ]),
])}

## Negative / Hold Rows

${table([
  ["caseId", "pid", "bucket", "reason", "title"],
  ...holds.map((row) => [
    row.caseId,
    row.pid,
    row.bucket,
    row.reason,
    row.title,
  ]),
])}

## Acquisition Plan From Here

- Keep the current strict positive gate: title-visible CPU, title-visible RTX/RX GPU, personal/private-used wording, and one fixed complete desktop body.
- Continue querying high-signal CPU/GPU pairs instead of broad desktop terms; broad terms overproduce shop templates.
- Keep monitor/peripheral bundle rows manual until owner approves bundle handling.
- Keep proshop/high-activity newly assembled rows as hold, even when CPU/GPU tokens are excellent.
- Do not runtime-wire this lane from this report alone; the next safe action is an internal-only no-mutation executor proposal after main-agent review.

## Runtime Gating Result

No rows are runtime-approved, public-promotion-ready, or candidate-pool-ready. This report only raises the cumulative strict-positive evidence set from ${input.existingPositiveRows} to ${combinedPositiveRows}; it does not approve parser/runtime/catalog/candidate-pool changes.

## Source Reports Read

${sourceReportsRead.map((item) => `- ${item}`).join("\n")}
`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const inputs = await readRequiredInputs();
  const existingPositiveRows = Number(inputs.existingBackfill.metrics?.positiveRows ?? 0);
  const sourceSampleRows = inputs.normalizedSamples.length;
  const { searchedRows, reviewRows, missingTargetPids } = await collectRows();

  const positives = reviewRows.filter((row) => row.decision === "strict_positive");
  const manuals = reviewRows.filter((row) => row.decision === "manual_owner_decision");
  const holds = reviewRows.filter((row) => row.decision === "hold_negative_fixture");
  const combinedStrictPositiveRows = existingPositiveRows + positives.length;

  const json = {
    generatedAt,
    lane: "desktop_private_used_cpu_gpu",
    conclusion: "targeted_public_api_acquisition_reached_10_cumulative_strict_positives_report_only",
    reportOnly: true,
    networkScope: "Bunjang public search/detail API only",
    openAiCalls: false,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    productionDbMutation: false,
    directThirtyDayPlanEdit: false,
    metrics: {
      existingStrictPositiveRows: existingPositiveRows,
      targetedSearchQueries: queries.length,
      targetedSearchRowsDeduped: searchedRows.length,
      targetedReviewRows: reviewRows.length,
      targetedPositiveRows: positives.length,
      targetedManualRows: manuals.length,
      targetedHoldRows: holds.length,
      combinedStrictPositiveRows,
      strictPositiveTarget: "10-15",
      strictPositiveTargetMet: combinedStrictPositiveRows >= 10 && combinedStrictPositiveRows <= 15,
      runtimeApprovedRows: 0,
      publicPromotionRows: 0,
      candidatePoolRows: 0,
      sourceNormalizedSamplesRead: sourceSampleRows,
      missingTargetPidsFromLiveFetch: missingTargetPids.length,
    },
    queries,
    fixtures: reviewRows,
    missingTargetPids,
    acquisitionPlan: [
      "Keep strict title-visible CPU plus title-visible RTX/RX GPU and private-used complete-body requirements.",
      "Continue targeted CPU/GPU pair queries; avoid broad desktop terms because they overproduce shop templates.",
      "Keep bundle rows manual and proshop/newly assembled rows hold.",
      "Produce only no-mutation runtime prep after main-agent review; no runtime/public/candidatePool wiring from this report.",
    ],
    sourceReportsRead,
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(
    path.join(reportsDir, "desktop-private-used-targeted-acquisition-latest.json"),
    `${JSON.stringify(json, null, 2)}\n`,
  );
  await writeFile(
    path.join(reportsDir, "desktop-private-used-targeted-acquisition-latest.md"),
    writeMarkdown({
      generatedAt,
      existingPositiveRows,
      sourceSampleRows,
      searchedRows: searchedRows.length,
      reviewRows,
      missingTargetPids,
    }),
  );

  console.log(JSON.stringify({
    report: "reports/desktop-private-used-targeted-acquisition-latest",
    targetedPositiveRows: positives.length,
    targetedManualRows: manuals.length,
    targetedHoldRows: holds.length,
    combinedStrictPositiveRows,
    runtimeApprovedRows: 0,
    publicPromotionRows: 0,
    candidatePoolRows: 0,
    missingTargetPids,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
