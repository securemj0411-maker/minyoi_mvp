import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type DesignPlan = {
  lane: string;
  evidence: string;
  futureWriteCap: number;
  mode: string;
  acceptedScope: string;
  hardExclusions: string[];
  sameRequestGuards: string[];
};

type Design = {
  runtimeMutation: boolean;
  supabaseMutation: boolean;
  publicPromotion: boolean;
  plans?: DesignPlan[];
  executionOrder?: string[];
  globalContract?: string[];
};

type DetailRow = {
  pid: string;
  title: string;
  price: number;
  saleStatus?: string | null;
  sold?: boolean;
  listingType?: string | null;
  searchSkuId?: string | null;
  detailSkuId?: string | null;
  searchComparableKey?: string | null;
  detailComparableKey?: string | null;
  detailNeedsReview?: boolean;
  activeClean: boolean;
  reasons?: string[];
};

type DetailReport = {
  runtimeMutation?: boolean;
  supabaseMutation?: boolean;
  publicPromotion?: boolean;
  inputRows: number;
  detailFetched: number;
  activeClean: number;
  holdOrReview: number;
  rows?: DetailRow[];
};

type LanePreflight = {
  lane: string;
  status: "pass" | "hold";
  futureWriteCap: number;
  activeCleanRows: number;
  proposedPids: string[];
  issues: string[];
  evidence: string;
};

const root = process.cwd();
const reportDir = path.join(root, "reports");

function readJson<T>(relativePath: string): T | null {
  const jsonRelativePath = relativePath.endsWith(".md")
    ? relativePath.replace(/\.md$/, ".json")
    : relativePath;
  const filePath = jsonRelativePath.startsWith("reports/")
    ? path.join(root, jsonRelativePath)
    : path.join(reportDir, jsonRelativePath);
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function isActiveSaleStatus(status: string | null | undefined) {
  return ["SELLING", "AVAILABLE", "ON_SALE", "ACTIVE"].includes(String(status ?? "").trim().toUpperCase());
}

function rowIssues(row: DetailRow) {
  const issues: string[] = [];
  if (!row.activeClean) issues.push("row_not_active_clean");
  if (!isActiveSaleStatus(row.saleStatus)) issues.push(`inactive_sale_status:${row.saleStatus ?? "missing"}`);
  if (row.sold) issues.push("sold_signal_true");
  if (row.listingType !== "normal") issues.push(`listing_type_${row.listingType ?? "missing"}`);
  if (row.detailNeedsReview) issues.push("detail_needs_review");
  if (!row.detailComparableKey) issues.push("missing_detail_comparable_key");
  if (row.searchComparableKey && row.detailComparableKey && row.searchComparableKey !== row.detailComparableKey) {
    issues.push("comparable_key_changed_between_search_and_detail");
  }
  if (!row.detailSkuId) issues.push("missing_detail_sku");
  return issues;
}

function preflightLane(plan: DesignPlan): LanePreflight {
  const report = readJson<DetailReport>(plan.evidence);
  const issues: string[] = [];
  if (!report) {
    return {
      lane: plan.lane,
      status: "hold",
      futureWriteCap: plan.futureWriteCap,
      activeCleanRows: 0,
      proposedPids: [],
      issues: [`missing_evidence:${plan.evidence}`],
      evidence: plan.evidence,
    };
  }

  if (report.runtimeMutation || report.supabaseMutation || report.publicPromotion) {
    issues.push("evidence_report_is_not_no_write");
  }

  const rows = report.rows ?? [];
  const activeRows = rows.filter((row) => row.activeClean);
  if (activeRows.length !== report.activeClean) {
    issues.push(`active_clean_count_mismatch:report=${report.activeClean}:rows=${activeRows.length}`);
  }
  if (plan.futureWriteCap <= 0) issues.push("future_write_cap_must_be_positive");
  if (plan.futureWriteCap > activeRows.length) {
    issues.push(`future_write_cap_exceeds_active_clean:${plan.futureWriteCap}>${activeRows.length}`);
  }
  if (!plan.mode.includes("owner_approval_required")) issues.push("plan_mode_missing_owner_approval_required");
  for (const guard of ["fresh detail refetch", "active sale status", "normal listing type", "no public promotion", "no candidate-pool release"]) {
    if (!plan.sameRequestGuards.some((item) => item.includes(guard))) {
      issues.push(`missing_same_request_guard:${guard}`);
    }
  }

  const proposedRows = activeRows.slice(0, plan.futureWriteCap);
  for (const row of proposedRows) {
    issues.push(...rowIssues(row).map((issue) => `pid_${row.pid}:${issue}`));
  }

  return {
    lane: plan.lane,
    status: issues.length === 0 ? "pass" : "hold",
    futureWriteCap: plan.futureWriteCap,
    activeCleanRows: activeRows.length,
    proposedPids: proposedRows.map((row) => row.pid),
    issues,
    evidence: plan.evidence,
  };
}

function table(rows: LanePreflight[]) {
  return [
    "| lane | status | cap | active clean | proposed pids | issues |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...rows.map((row) =>
      `| ${row.lane} | ${row.status} | ${row.futureWriteCap} | ${row.activeCleanRows} | ${row.proposedPids.join(", ") || "-"} | ${row.issues.join("; ") || "-"} |`,
    ),
  ].join("\n");
}

async function main() {
  const design = readJson<Design>("tiny-acquisition-design-latest.json");
  if (!design) throw new Error("missing reports/tiny-acquisition-design-latest.json");

  const globalIssues: string[] = [];
  if (design.runtimeMutation || design.supabaseMutation || design.publicPromotion) {
    globalIssues.push("design_packet_must_be_no_mutation");
  }
  if (!design.globalContract?.some((item) => /Owner must approve/i.test(item))) {
    globalIssues.push("global_contract_missing_owner_approval");
  }
  if (!design.globalContract?.some((item) => /no-public|public/i.test(item))) {
    globalIssues.push("global_contract_missing_no_public_boundary");
  }

  const lanePreflights = (design.plans ?? []).map(preflightLane);
  const pass = lanePreflights.filter((lane) => lane.status === "pass");
  const hold = lanePreflights.filter((lane) => lane.status === "hold");
  const output = {
    generatedAt: new Date().toISOString(),
    scope: "internal_acquisition_executor_preflight",
    runtimeMutation: false,
    supabaseMutation: false,
    publicPromotion: false,
    source: "reports/tiny-acquisition-design-latest.json",
    globalStatus: globalIssues.length === 0 && hold.length === 0 ? "pass" : "hold",
    globalIssues,
    metrics: {
      lanes: lanePreflights.length,
      pass: pass.length,
      hold: hold.length,
      totalFutureWriteCap: pass.reduce((sum, lane) => sum + lane.futureWriteCap, 0),
    },
    lanePreflights,
    decision:
      globalIssues.length === 0 && hold.length === 0
        ? "Preflight passes for owner-approved internal-only executor implementation. Actual DB writes still require explicit owner approval."
        : "Hold executor implementation until preflight issues are resolved.",
  };

  const md = [
    "# Internal Acquisition Executor Preflight",
    "",
    `- generatedAt: ${output.generatedAt}`,
    `- scope: ${output.scope}`,
    "- runtimeMutation/supabaseMutation/publicPromotion: false/false/false",
    `- globalStatus: ${output.globalStatus}`,
    `- lanes: ${output.metrics.lanes}`,
    `- pass/hold: ${output.metrics.pass}/${output.metrics.hold}`,
    `- totalFutureWriteCap: ${output.metrics.totalFutureWriteCap}`,
    "",
    "## Global Issues",
    "",
    output.globalIssues.length ? output.globalIssues.map((item) => `- ${item}`).join("\n") : "- none",
    "",
    "## Lane Preflight",
    "",
    table(output.lanePreflights),
    "",
    "## Decision",
    "",
    `- ${output.decision}`,
    "",
  ].join("\n");

  await mkdir(reportDir, { recursive: true });
  await writeFile(path.join(reportDir, "internal-acquisition-executor-preflight-latest.json"), `${JSON.stringify(output, null, 2)}\n`);
  await writeFile(path.join(reportDir, "internal-acquisition-executor-preflight-latest.md"), md);
  console.log("wrote reports/internal-acquisition-executor-preflight-latest.json");
  console.log("wrote reports/internal-acquisition-executor-preflight-latest.md");
  console.log(JSON.stringify(output.metrics));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
