import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

type RehearsalRow = {
  pid: number;
  title: string;
  price: number | null;
  currentRaw: {
    listingType: string | null;
    skuId: string | null;
    skuName: string | null;
  };
  nextRaw: {
    listingType: string | null;
    skuId: string | null;
    skuName: string | null;
  };
  currentParsed: {
    comparable_key: string | null;
  } | null;
  nextParsed: {
    comparableKey: string | null;
    parseConfidence: number | null;
    needsReview: boolean | null;
  };
  rawChangedFields: string[];
  parsedChangedFields: string[];
  existingPoolStatus: string | null;
};

type Rehearsal = {
  generatedAt: string;
  comparableKeyChangedRows: RehearsalRow[];
};

function compact(text: unknown, limit = 72) {
  const value = String(text ?? "").replace(/\s+/g, " ").trim();
  return value.length > limit ? `${value.slice(0, limit)}...` : value;
}

function mdTable(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(appDir, file), "utf8")) as T;
}

async function main() {
  await mkdir(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const rehearsal = await readJson<Rehearsal>("reports/headphone-internal-reparse-apply-rehearsal-latest.json");
  const reviewRows = rehearsal.comparableKeyChangedRows
    .filter((row) => row.currentRaw.listingType === "accessory" && row.nextRaw.listingType === "normal")
    .map((row) => {
      const title = row.title;
      const positiveSignals = [
        /에어팟\s*맥스|에어팟맥스/i.test(title) ? "airpods_max_title" : null,
        /(8핀|라이트닝|lightning|c타입|usb\s*-?\s*c|ctype|c-type)/i.test(title) ? "explicit_connector_or_generation" : null,
        /(풀박스|풀박|s급|스타라이트|실버|스페이스\s*그레이|그레이)/i.test(title) ? "full_unit_context" : null,
      ].filter((value): value is string => Boolean(value));
      const negativeSignals = [
        /(케이스만|파우치만|커버만|거치대만|스탠드만|케이블만|충전기만|이어패드만|이어쿠션만)/i.test(title)
          ? "accessory_only_title"
          : null,
      ].filter((value): value is string => Boolean(value));
      return {
        pid: row.pid,
        title,
        price: row.price,
        currentListingType: row.currentRaw.listingType,
        nextListingType: row.nextRaw.listingType,
        nextSkuId: row.nextRaw.skuId,
        currentComparableKey: row.currentParsed?.comparable_key ?? null,
        nextComparableKey: row.nextParsed.comparableKey,
        parseConfidence: row.nextParsed.parseConfidence,
        needsReview: row.nextParsed.needsReview,
        existingPoolStatus: row.existingPoolStatus,
        positiveSignals,
        negativeSignals,
        recommendedDecision: positiveSignals.length >= 2 && negativeSignals.length === 0 ? "allow_write_cap_reparse" : "hold_for_manual_review",
      };
    });

  const report = {
    generatedAt,
    reportOnly: true,
    productionDbMutation: false,
    publicPromotion: false,
    candidatePoolPolicyWiring: false,
    sourceReport: "reports/headphone-internal-reparse-apply-rehearsal-latest.json",
    sourceGeneratedAt: rehearsal.generatedAt,
    metrics: {
      reviewRows: reviewRows.length,
      allowWriteCapReparse: reviewRows.filter((row) => row.recommendedDecision === "allow_write_cap_reparse").length,
      holdForManualReview: reviewRows.filter((row) => row.recommendedDecision === "hold_for_manual_review").length,
    },
    reviewRows,
    decision:
      reviewRows.length > 0 && reviewRows.every((row) => row.recommendedDecision === "allow_write_cap_reparse")
        ? "accessory_to_normal_rows_ready_for_tiny_write_cap_reparse_plan"
        : "accessory_to_normal_rows_require_manual_review",
    nextStep:
      reviewRows.length > 0 && reviewRows.every((row) => row.recommendedDecision === "allow_write_cap_reparse")
        ? "Draft a tiny write-cap reparse plan for these rows only; keep candidate pool/public promotion closed."
        : "Manually inspect held rows before any apply plan.",
  };

  await writeFile(path.join(reportsDir, "headphone-accessory-to-normal-review-packet-latest.json"), `${JSON.stringify(report, null, 2)}\n`);

  const md = [
    "# Headphone Accessory-to-Normal Review Packet",
    "",
    `- generatedAt: ${generatedAt}`,
    "- reportOnly: true",
    "- productionDbMutation: false",
    "- publicPromotion: false",
    "- candidatePoolPolicyWiring: false",
    `- decision: ${report.decision}`,
    "",
    "## Metrics",
    "",
    `- reviewRows: ${report.metrics.reviewRows}`,
    `- allowWriteCapReparse: ${report.metrics.allowWriteCapReparse}`,
    `- holdForManualReview: ${report.metrics.holdForManualReview}`,
    "",
    "## Rows",
    "",
    mdTable(
      ["pid", "title", "price", "current", "next", "nextKey", "positiveSignals", "negativeSignals", "decision"],
      reviewRows.map((row) => [
        row.pid,
        compact(row.title),
        row.price,
        row.currentListingType,
        row.nextListingType,
        row.nextComparableKey,
        row.positiveSignals.join(", "),
        row.negativeSignals.join(", "),
        row.recommendedDecision,
      ]),
    ),
    "",
    "## Next Step",
    "",
    `- ${report.nextStep}`,
    "",
  ].join("\n");
  await writeFile(path.join(reportsDir, "headphone-accessory-to-normal-review-packet-latest.md"), `${md}\n`);
  console.log(`headphone accessory-to-normal review: rows=${reviewRows.length}, allow=${report.metrics.allowWriteCapReparse}, hold=${report.metrics.holdForManualReview}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
