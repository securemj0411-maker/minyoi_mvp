import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const intelligenceDir = path.join(appDir, "category-intelligence");
const reportsDir = path.join(appDir, "reports");

async function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(await readFile(filePath, "utf-8"));
  } catch {
    return fallback;
  }
}

function summarizeQueue(category, queue) {
  const items = queue?.items ?? [];
  const rows = items.map((item) => {
    const candidate = item.candidate ?? {};
    const riskFlags = candidate.risk_flags ?? candidate.riskFlags ?? item.riskFlags ?? [];
    const aliases = item.aliases ?? candidate.aliases ?? [];
    return {
      category,
      key: item.key,
      kind: item.kind,
      id: item.id ?? item.keyword ?? candidate.id ?? candidate.keyword ?? "",
      modelName: item.modelName ?? item.type ?? candidate.modelName ?? candidate.model_name ?? candidate.type ?? "",
      brand: item.brand ?? candidate.brand ?? "",
      runtimeCategory: item.category ?? candidate.category ?? "",
      approved: item.approved === true,
      rejected: item.rejected === true,
      status: item.approved === true && item.rejected !== true ? "approved" : item.rejected === true ? "rejected" : "pending",
      riskFlags,
      aliasCount: aliases.length,
      sourceClusterIds: item.sourceClusterIds ?? candidate.sourceClusterIds ?? candidate.source_cluster_ids ?? [],
      note: item.note ?? "",
    };
  });
  return {
    category,
    updatedAt: queue?.updated_at ?? null,
    approved: rows.filter((row) => row.status === "approved").length,
    pending: rows.filter((row) => row.status === "pending").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    total: rows.length,
    rows,
  };
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/")).join(" | ")} |`),
  ].join("\n");
}

function renderMarkdown(report) {
  const lines = [
    "# Approval Queue Report",
    "",
    `- generated_at: ${report.generatedAt}`,
    `- queues: ${report.queues.length}`,
    `- total_items: ${report.totals.total}`,
    `- approved: ${report.totals.approved}`,
    `- pending: ${report.totals.pending}`,
    `- rejected: ${report.totals.rejected}`,
    "",
    "## Summary",
    "",
    mdTable(
      ["category", "approved", "pending", "rejected", "total", "updated_at"],
      report.queues.map((queue) => [queue.category, queue.approved, queue.pending, queue.rejected, queue.total, queue.updatedAt ?? ""]),
    ),
    "",
    "## Pending Items",
    "",
  ];

  const pending = report.queues.flatMap((queue) => queue.rows.filter((row) => row.status === "pending"));
  if (pending.length === 0) {
    lines.push("- pending item 없음");
  } else {
    lines.push(mdTable(
      ["category", "id", "brand", "runtime", "risk_flags", "clusters", "note"],
      pending.map((row) => [
        row.category,
        row.id,
        row.brand,
        row.runtimeCategory,
        row.riskFlags.join(", "),
        row.sourceClusterIds.join(", "),
        row.note,
      ]),
    ));
  }

  lines.push("", "## Rejected Items", "");
  const rejected = report.queues.flatMap((queue) => queue.rows.filter((row) => row.status === "rejected"));
  if (rejected.length === 0) {
    lines.push("- rejected item 없음");
  } else {
    lines.push(mdTable(
      ["category", "id", "brand", "runtime", "note"],
      rejected.map((row) => [row.category, row.id, row.brand, row.runtimeCategory, row.note]),
    ));
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const entries = await readdir(intelligenceDir, { withFileTypes: true });
  const queueSummaries = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const category = entry.name;
    const queue = await readJson(path.join(intelligenceDir, category, "approval_queue.json"));
    if (!queue) continue;
    queueSummaries.push(summarizeQueue(category, queue));
  }
  queueSummaries.sort((a, b) => a.category.localeCompare(b.category, "ko"));

  const report = {
    generatedAt: new Date().toISOString(),
    totals: {
      approved: queueSummaries.reduce((sum, queue) => sum + queue.approved, 0),
      pending: queueSummaries.reduce((sum, queue) => sum + queue.pending, 0),
      rejected: queueSummaries.reduce((sum, queue) => sum + queue.rejected, 0),
      total: queueSummaries.reduce((sum, queue) => sum + queue.total, 0),
    },
    queues: queueSummaries,
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "approval-queues-latest.json");
  const mdPath = path.join(reportsDir, "approval-queues-latest.md");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  await writeFile(mdPath, renderMarkdown(report));

  console.log(`wrote ${path.relative(appDir, jsonPath)}`);
  console.log(`wrote ${path.relative(appDir, mdPath)}`);
  console.log(`queues=${report.queues.length} pending=${report.totals.pending} approved=${report.totals.approved} rejected=${report.totals.rejected}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
