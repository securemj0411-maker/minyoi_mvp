import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type ScopeRow = {
  pid: number;
  action: string;
  reason: string;
  currentType: string;
  nextType: string;
  currentSku: string | null;
  nextSku: string | null;
  title: string | null;
  descriptionPreview: string | null;
  price: number | null;
  saleStatus: string | null;
  band: number | null;
  status: string | null;
  category: string | null;
  profitMax: number | null;
  scoreFlags: string[];
  riskHits: number;
};

type ScopeReport = {
  summary: Record<string, unknown>;
  activeInvalidationRows: ScopeRow[];
  reparseRefreshRows?: ScopeRow[];
  invalidationExamples: ScopeRow[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.join(__dirname, "..");
const reportsDir = path.join(appDir, "reports");

function compact(value: unknown, length = 110) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function table(headers: string[], rows: unknown[][]) {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? "").replace(/\|/g, "/").replace(/\n/g, "<br>")).join(" | ")} |`),
  ].join("\n");
}

function isHardAutoInvalidate(row: ScopeRow) {
  if (row.action !== "invalidate_active_pool") return false;
  if (row.nextType === "accessory" && /케이스|case|커버|보호필름|강화유리|필름/i.test(`${row.title ?? ""}\n${row.descriptionPreview ?? ""}`)) {
    return true;
  }
  if (row.nextType === "buying" && /(구매|구합니다|구해요|삽니다|매입)/.test(`${row.title ?? ""}\n${row.descriptionPreview ?? ""}`)) {
    return true;
  }
  if (row.nextType === "parts" && /(왼쪽|오른쪽|좌측|우측|유닛|본체|충전\s*케이스|없|분실|잃어)/.test(`${row.title ?? ""}\n${row.descriptionPreview ?? ""}`)) {
    return true;
  }
  if (row.nextType === "callout" && /(판매\s*완료|거래\s*완료|차이팟|가품|짝퉁|레플)/.test(`${row.title ?? ""}\n${row.descriptionPreview ?? ""}`)) {
    return true;
  }
  return false;
}

function needsAiEscalation(row: ScopeRow) {
  if (row.action !== "invalidate_active_pool") return false;
  if (isHardAutoInvalidate(row)) return false;
  return true;
}

async function main() {
  const raw = await readFile(path.join(reportsDir, "reparse-backfill-scope-latest.json"), "utf-8");
  const scope = JSON.parse(raw) as ScopeReport;
  const generatedAt = new Date().toISOString();
  const activeRows = scope.activeInvalidationRows ?? [];
  const autoInvalidateRows = activeRows.filter(isHardAutoInvalidate);
  const aiEscalationRows = activeRows.filter(needsAiEscalation);
  const blockedRows = activeRows.filter((row) => !isHardAutoInvalidate(row) && !needsAiEscalation(row));
  const reparseRefreshRows = scope.reparseRefreshRows ?? (scope.invalidationExamples ?? []).filter((row) => row.action === "reparse_refresh_outputs");

  const report = {
    generatedAt,
    mode: "read_only_no_mutation_apply_plan",
    sourceReport: "reports/reparse-backfill-scope-latest.json",
    summary: {
      sourceAuditedRows: scope.summary.auditedPoolRows,
      activeInvalidationRows: activeRows.length,
      autoInvalidateRows: autoInvalidateRows.length,
      aiEscalationRows: aiEscalationRows.length,
      blockedRows: blockedRows.length,
      reparseRefreshRows: reparseRefreshRows.length,
      plannedDbMutationsIfApplied: {
        mvpRawListingsPatchRows: autoInvalidateRows.length,
        mvpCandidatePoolPatchRows: autoInvalidateRows.length,
        mvpListingAnalysisPatchRows: 0,
        mvpListingParsedPatchRows: 0,
      },
    },
    safetyGates: [
      "Do not run as a broad backfill.",
      "Apply only autoInvalidateRows first, max 10 rows per run.",
      "AI escalation rows must not be auto-invalidated; ask AI second-opinion or owner review.",
      "After apply, run report:reparse-backfill-scope and report:pack-open-quality before any larger batch.",
      "Rollback is status restoration from the pre-apply snapshot fields captured in this report.",
    ],
    autoInvalidateRows,
    aiEscalationRows,
    blockedRows,
    reparseRefreshPreview: reparseRefreshRows.slice(0, 20),
  };
  const nextStepLines =
    autoInvalidateRows.length > 0
      ? [
          `1. autoInvalidateRows ${autoInvalidateRows.length}건만 대상으로 apply를 검토한다. 단일 실행 최대 10건 제한을 유지한다.`,
          "2. apply 전에는 이 리포트의 pre-apply snapshot을 rollback 기준으로 삼는다.",
          "3. apply 후에는 `npm run report:reparse-backfill-scope`, `npm run report:pack-open-quality`, `npm run report:db-hotpaths -- --window-hours=1 --run-limit=80 --queue-limit=300` 순서로 확인한다.",
        ]
      : [
          "1. 현재 autoInvalidateRows가 0건이므로 추가 apply를 실행하지 않는다.",
          "2. reparseRefreshRows는 출력 갱신/검토 후보일 뿐 자동 invalidation 대상이 아니다.",
          "3. 새 누수나 active invalidation이 생기면 `npm run report:reparse-backfill-scope`를 먼저 다시 돌린 뒤 이 apply plan을 재생성한다.",
        ];

  const md = [
    "# Reparse / Backfill Apply Plan",
    "",
    `- generated_at: ${generatedAt}`,
    "- mode: read_only_no_mutation_apply_plan",
    "- source: reports/reparse-backfill-scope-latest.json",
    "",
    "## Summary",
    "",
    table(["metric", "value"], Object.entries(report.summary).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : value])),
    "",
    "## Decision",
    "",
    "- 지금 단계에서는 DB를 수정하지 않는다.",
    "- 자동 적용 가능한 행은 명백한 accessory/buying/parts/callout 문맥만 허용한다.",
    "- 애매한 행은 AI second-opinion 또는 owner review로 넘긴다.",
    "- 전체 백필 대신 active invalidation 소량 적용부터 시작한다.",
    "",
    "## Safety Gates",
    "",
    ...report.safetyGates.map((row) => `- ${row}`),
    "",
    "## Auto Invalidate Rows",
    "",
    autoInvalidateRows.length > 0
      ? table(
          ["pid", "reason", "type", "sku", "status", "band", "profit_max", "title", "desc"],
          autoInvalidateRows.map((row) => [
            row.pid,
            row.reason,
            `${row.currentType} -> ${row.nextType}`,
            `${row.currentSku ?? "-"} -> ${row.nextSku ?? "-"}`,
            row.status,
            row.band,
            row.profitMax,
            compact(row.title),
            compact(row.descriptionPreview, 140),
          ]),
        )
      : "- none",
    "",
    "## AI Escalation Rows",
    "",
    aiEscalationRows.length > 0
      ? table(
          ["pid", "reason", "type", "title", "desc"],
          aiEscalationRows.map((row) => [row.pid, row.reason, `${row.currentType} -> ${row.nextType}`, compact(row.title), compact(row.descriptionPreview, 140)]),
        )
      : "- none",
    "",
    "## Reparse Refresh Preview",
    "",
    reparseRefreshRows.length > 0
      ? table(
          ["pid", "reason", "type", "sku", "status", "title"],
          reparseRefreshRows.slice(0, 20).map((row) => [
            row.pid,
            row.reason,
            `${row.currentType} -> ${row.nextType}`,
            `${row.currentSku ?? "-"} -> ${row.nextSku ?? "-"}`,
            row.status,
            compact(row.title),
          ]),
        )
      : "- none",
    "",
    "## Next Step",
    "",
    ...nextStepLines,
  ].join("\n");

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "reparse-backfill-apply-plan-latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(path.join(reportsDir, "reparse-backfill-apply-plan-latest.md"), `${md}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
