import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

async function main(): Promise<void> {
  const instrumentationGoals = [
    "title-side vs description-side token 위치 측정 — 결정론 ceiling vs AI L2 territory 정확히 quantify",
    "axis별 token presence/absence 분포 — 어떤 axis가 description에만 있나 정량화",
    "needs_review=true row의 실제 reject 사유 distribution — 현재는 categorical만 있어서 axis별 break-down 불가",
    "comparable_key generation latency + 분기 별 success rate",
  ];

  const loggingSchema = {
    tableName: "mvp_parser_telemetry (proposed, DDL needed)",
    columns: [
      { name: "id", type: "uuid", purpose: "PK" },
      { name: "pid", type: "bigint", purpose: "FK → mvp_raw_listings" },
      { name: "category", type: "text", purpose: "parsed category" },
      { name: "comparable_key_final", type: "text", purpose: "최종 comparable_key" },
      { name: "title_tokens", type: "jsonb", purpose: "title에서 추출된 axis token map (예: {storage:'128GB',self:'자급제'})" },
      { name: "description_tokens", type: "jsonb", purpose: "description에서 추출된 axis token map" },
      { name: "unknown_axes", type: "text[]", purpose: "unknown_* marker list" },
      { name: "needs_review_reason", type: "text[]", purpose: "needs_review=true 사유 (예: ['silent_carrier','price_band_low'])" },
      { name: "parse_duration_ms", type: "integer", purpose: "parser 소요 시간" },
      { name: "created_at", type: "timestamptz", purpose: "측정 시점" },
    ],
    retention: "30 days (rolling). 측정 목적, archival 불요.",
    ddl_needed: true,
  };

  const measurementMetrics = [
    "title_only_axis_coverage: 카테고리별 axis가 title에만 등장하는 share",
    "description_only_axis_coverage: 카테고리별 axis가 description에만 등장하는 share",
    "ambiguous_axis_coverage: title + description 모두 없는 share — true AI L2 territory",
    "axis별 reject reason histogram (silent_carrier / silent_self / price_band / etc)",
    "parse_duration p50/p95/p99 — performance regression watch",
  ];

  const integrationPoints = [
    {
      file: "src/lib/option-parser.ts",
      function: "parseListingOptions (현재 1 entrypoint)",
      change: "function 끝에 telemetry 객체 build + 옵션 instrumentation flag로 비활성화 가능",
      runtimeRisk: "low — telemetry는 추가 write only, 기존 결과 변경 0",
    },
    {
      file: "src/lib/tick-pipeline.ts",
      function: "parsed row write 시점에 telemetry insert",
      change: "supabase batch insert에 mvp_parser_telemetry 추가",
      runtimeRisk: "medium — write 증가, 별도 batch로 분리 필요",
    },
  ];

  const blockers = [
    "DDL: mvp_parser_telemetry table 생성 — owner 명시 필요",
    "option-parser.ts 변경 — owner 명시 필요 (runtime parser change)",
    "tick-pipeline.ts write 증가 — DB throughput 영향 측정 필요",
    "telemetry feature flag (env var TELEMETRY_ENABLED=1) 권장 — 기본 OFF",
  ];

  const phasedRollout = [
    {
      phase: 1,
      scope: "DDL + telemetry 함수 hook (flag OFF) — 변경 효과 0",
      ownerActionRequired: true,
    },
    {
      phase: 2,
      scope: "flag ON (development env only) + 7일 측정 → metric 산출",
      ownerActionRequired: true,
    },
    {
      phase: 3,
      scope: "metric 기반 axis 추출 regex 보강 proposal (Wave 7 input) — 별도 wave",
      ownerActionRequired: false,
    },
    {
      phase: 4,
      scope: "production rollout (flag ON 전체) — owner 명시 후",
      ownerActionRequired: true,
    },
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave6_parser_instrumentation_design",
    family: "parser_instrumentation",
    decision: "wave6_parser_instrumentation_design_report_only",
    metrics: {
      instrumentationGoals: instrumentationGoals.length,
      schemaColumns: loggingSchema.columns.length,
      measurementMetrics: measurementMetrics.length,
      integrationPoints: integrationPoints.length,
      phasedRolloutPhases: phasedRollout.length,
      blockers: blockers.length,
      runtimeApprovedRows: 0,
    },
    instrumentationGoals,
    loggingSchema,
    measurementMetrics,
    integrationPoints,
    phasedRollout,
    blockers,
    policyImplications: [
      "Instrumentation은 axis 확장 (Wave 7)의 prerequisite — measurement 없이 regex 변경 위험.",
      "feature flag로 기본 OFF — owner 명시 후만 ON.",
      "DDL + parser change 필요 — 본 packet은 design only, 적용은 별도 owner 명시.",
      "telemetry는 retention 30 days, archival 불요 — DB 부담 제한적.",
    ],
    doNotDo: [
      "Do not enable telemetry without DDL + flag setup",
      "Do not change comparable_key construction during instrumentation rollout",
      "Do not retain telemetry beyond 30 days (PII/매물 정보 노출 위험)",
      "Do not expose telemetry to public — service_role only",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave6-parser-instrumentation-design-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 6 — Parser Instrumentation Design",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only design packet. production parser 로깅 schema + measurement metric + phased rollout.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Instrumentation Goals",
    "",
    ...instrumentationGoals.map((g) => `- ${g}`),
    "",
    "## Logging Schema (`mvp_parser_telemetry`, proposed)",
    "",
    `- tableName: ${loggingSchema.tableName}`,
    `- retention: ${loggingSchema.retention}`,
    `- ddl_needed: ${loggingSchema.ddl_needed}`,
    "",
    "| column | type | purpose |",
    "|---|---|---|",
    ...loggingSchema.columns.map((c) => `| ${c.name} | ${c.type} | ${c.purpose} |`),
    "",
    "## Measurement Metrics",
    "",
    ...measurementMetrics.map((m) => `- ${m}`),
    "",
    "## Integration Points",
    "",
    ...integrationPoints.flatMap((p) => [`### ${p.file}`, "", `- function: ${p.function}`, `- change: ${p.change}`, `- runtimeRisk: ${p.runtimeRisk}`, ""]),
    "## Phased Rollout",
    "",
    "| phase | scope | ownerActionRequired |",
    "|---:|---|---|",
    ...phasedRollout.map((p) => `| ${p.phase} | ${p.scope} | ${p.ownerActionRequired ? "YES" : "no"} |`),
    "",
    "## Blockers",
    "",
    ...blockers.map((b) => `- ${b}`),
    "",
    "## Policy Implications",
    "",
    ...report.policyImplications.map((l) => `- ${l}`),
    "",
    "## Do Not Do",
    "",
    ...report.doNotDo.map((l) => `- ${l}`),
  ].join("\n");
  await writeFile(jsonPath.replace(/\.json$/, ".md"), `${md}\n`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`wave6 parser-instrumentation: schemaCols=${loggingSchema.columns.length}, phases=${phasedRollout.length}, blockers=${blockers.length}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
