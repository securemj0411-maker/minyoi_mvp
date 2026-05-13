import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

// Axis gap diagnostic from supabase MCP measurement (mvp_listing_parsed unknown_* axes counts).
// Measurement: 2026-05-13T15:15 UTC.

type AxisGap = {
  category: string;
  axis: string;
  occurrences: number;
  shareOfParsed: number;
  rootCauseHypothesis: string;
  fixOwner: "report_only_wave" | "runtime_parser_change" | "owner_decision" | "ai_l2_routing";
  deterministicFixForbidden: boolean;
  forbidReason: string;
};

const PARSED_TOTAL: Record<string, number> = {
  laptop: 1418,
  smartphone: 1662,
  smartwatch: 2356,
  tablet: 2333,
};

const RAW: { category: string; axis: string; occurrences: number }[] = [
  { category: "laptop", axis: "unknown_generation", occurrences: 695 },
  { category: "laptop", axis: "unknown_ram", occurrences: 344 },
  { category: "laptop", axis: "unknown_ssd", occurrences: 307 },
  { category: "laptop", axis: "unknown_chip", occurrences: 152 },
  { category: "laptop", axis: "unknown_screen", occurrences: 37 },
  { category: "smartphone", axis: "unknown_storage", occurrences: 187 },
  { category: "smartwatch", axis: "unknown_connectivity", occurrences: 902 },
  { category: "smartwatch", axis: "unknown_size", occurrences: 193 },
  { category: "tablet", axis: "unknown_storage", occurrences: 354 },
  { category: "tablet", axis: "unknown_screen", occurrences: 34 },
];

function diagnose(row: { category: string; axis: string; occurrences: number }): AxisGap {
  const parsed = PARSED_TOTAL[row.category] ?? 1;
  const share = Number((row.occurrences / parsed).toFixed(3));
  let hypothesis = "";
  let fixOwner: AxisGap["fixOwner"] = "report_only_wave";
  let deterministicFixForbidden = false;
  let forbidReason = "";

  const key = `${row.category}:${row.axis}`;
  switch (key) {
    case "laptop:unknown_generation":
      hypothesis = "연식 token (2020/2021/M1/M2 등) 추출 regex 부재. 같은 chip이 여러 연식에 걸칠 수 있어 추정 fallback 금지 — AI L2 영역.";
      fixOwner = "ai_l2_routing";
      deterministicFixForbidden = true;
      forbidReason = "LAUNCH_PLAN §12b — chip → generation 추정 금지 (예: m1 → 2020년형 같은 거).";
      break;
    case "laptop:unknown_ram":
      hypothesis = "RAM token (8GB/16GB/32GB) 추출 regex 보강 가능 — 단 명시 안 된 매물은 base RAM 추정 금지. 명시 token만.";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "명시 token만 OK. 추정 금지.";
      break;
    case "laptop:unknown_ssd":
      hypothesis = "SSD/저장공간 token (256GB/512GB/1TB) 추출 regex. 명시 안 된 매물은 base 추정 금지.";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "명시 token만 OK.";
      break;
    case "laptop:unknown_chip":
      hypothesis = "Apple chip (M1/M2/M3/M4) 또는 Intel/AMD 모델명 추출. catalog가 모델 알아도 chip 확정 어려운 경우 있음.";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "공식/명시 chip만. 추정 금지.";
      break;
    case "laptop:unknown_screen":
      hypothesis = "화면 크기 (13/14/15/16inch) 추출 regex. 모델명에서 자동 추론 가능한 경우 많음 (MacBook Pro 14 등).";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "모델명 기반 OK. 명시 안 된 경우 unknown 유지.";
      break;
    case "smartphone:unknown_storage":
      hypothesis = "용량 token (128/256/512GB) 누락. 일부는 description 영역 — title-only parser limitation.";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "명시 storage token만. description-only는 AI L2 영역 (phones anchor-trio summary).";
      break;
    case "smartwatch:unknown_connectivity":
      hypothesis = "GPS/Cellular 명시 token 부재. silent listing이 다수 — 결정론 widening은 금지.";
      fixOwner = "ai_l2_routing";
      deterministicFixForbidden = true;
      forbidReason = "silent state 추정 금지 (smartwatch hold family closure 참조).";
      break;
    case "smartwatch:unknown_size":
      hypothesis = "mm 크기 (40/41/44/45/46/49mm) 추출 regex 보강 가능. 명시 안 된 경우 모델명 기반 추정 가능 (Series10 = 42/46만 등).";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "모델별 가능 사이즈 closed-set이라 모델명 → size 가능. 단 owner 결정.";
      break;
    case "tablet:unknown_storage":
      hypothesis = "용량 token 누락. smartphone과 유사 패턴. description-only 케이스 다수.";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "명시 storage token만. 추정 금지.";
      break;
    case "tablet:unknown_screen":
      hypothesis = "화면 크기 (11/12.9/13inch) — 모델명 기반 가능 (iPad Pro 11 = 11inch).";
      fixOwner = "runtime_parser_change";
      deterministicFixForbidden = false;
      forbidReason = "모델명 기반 OK.";
      break;
  }

  return { category: row.category, axis: row.axis, occurrences: row.occurrences, shareOfParsed: share, rootCauseHypothesis: hypothesis, fixOwner, deterministicFixForbidden, forbidReason };
}

async function main(): Promise<void> {
  const gaps = RAW.map(diagnose).filter((g) => ["laptop", "tablet"].includes(g.category)); // Wave 4 focus
  const broader = RAW.map(diagnose); // include smartwatch/smartphone for context

  const totals = {
    axesAnalyzed: gaps.length,
    deterministicFixable: gaps.filter((g) => !g.deterministicFixForbidden).length,
    aiL2Only: gaps.filter((g) => g.deterministicFixForbidden).length,
    laptopBlockerShareSum: Number(gaps.filter((g) => g.category === "laptop").reduce((a, g) => a + g.shareOfParsed, 0).toFixed(3)),
    tabletBlockerShareSum: Number(gaps.filter((g) => g.category === "tablet").reduce((a, g) => a + g.shareOfParsed, 0).toFixed(3)),
  };

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    category: "wave4_axis_gap_diagnostic",
    family: "tablet_laptop_axis",
    decision: "wave4_tablet_laptop_axis_gap_diagnostic_report_only",
    metrics: { ...totals, runtimeApprovedRows: 0 },
    laptopAxisGaps: gaps.filter((g) => g.category === "laptop"),
    tabletAxisGaps: gaps.filter((g) => g.category === "tablet"),
    relatedContextAxisGaps: broader.filter((g) => ["smartwatch", "smartphone"].includes(g.category)),
    keyFindings: [
      "**laptop**: 가장 큰 blocker는 unknown_generation 49% — 연식 추정 금지. AI L2 영역.",
      "**laptop**: unknown_ram 24% + unknown_ssd 22% — 명시 token regex 보강은 결정론 OK (추정 아님). owner 명시 후 runtime_parser_change.",
      "**laptop**: unknown_chip 11% — 명시 chip token OK. unknown_screen 3% — 모델명 기반 가능.",
      "**tablet**: unknown_storage 15% — 명시 token regex 보강 가능. description-only는 AI L2.",
      "**tablet**: unknown_screen 1.5% — 모델명 기반 거의 자동 가능 (iPad Pro 11 = 11inch).",
      "결합: tablet은 storage regex 보강만으로 needs_review_false 84.1% → 95%+ 가능 추정. laptop은 generation axis 때문에 영원히 결정론 33% 천장에 가까움.",
    ],
    policyImplications: [
      "laptop은 결정론 천장이 낮음 — generation 추정 금지로 인해 ready 승격 어려움. AI L2 routing이 정답.",
      "tablet은 storage axis regex 보강만으로 ready 후보 진입 가능 (단 owner 명시 후 runtime_parser_change).",
      "smartwatch unknown_connectivity 38% — hold family closure 박힘 (이미 처리됨).",
      "smartphone unknown_storage 11% + phones anchor-trio bottleneck (axis missing 5) — AI L2 routing이 정답.",
      "본 packet은 report-only. parser/catalog 변경 자동 안 함.",
    ],
    doNotDo: [
      "Do not modify option-parser regex from this packet",
      "Do not infer silent state (generation / chip / connectivity) into comparable_key",
      "Do not lower min_parse_rate to absorb unknown_* shares",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "wave4-tablet-laptop-axis-gap-diagnostic-latest.json");
  await writeFile(jsonPath, JSON.stringify(report, null, 2));
  const md = [
    "# Wave 4 — Tablet/Laptop Axis Gap Diagnostic",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only axis gap diagnostic. unknown_* marker occurrences in comparable_key per category × axis. fixOwner + 결정론 가능 여부 정량화.",
    "",
    "## Metrics",
    "",
    ...Object.entries(report.metrics).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Laptop Axis Gaps (focus)",
    "",
    "| axis | occurrences | share | fixOwner | deterministicFix | hypothesis |",
    "|---|---:|---:|---|---|---|",
    ...gaps.filter((g) => g.category === "laptop").map((g) => `| ${g.axis} | ${g.occurrences} | ${g.shareOfParsed} | ${g.fixOwner} | ${g.deterministicFixForbidden ? "FORBIDDEN" : "OK"} | ${g.rootCauseHypothesis} |`),
    "",
    "## Tablet Axis Gaps (focus)",
    "",
    "| axis | occurrences | share | fixOwner | deterministicFix | hypothesis |",
    "|---|---:|---:|---|---|---|",
    ...gaps.filter((g) => g.category === "tablet").map((g) => `| ${g.axis} | ${g.occurrences} | ${g.shareOfParsed} | ${g.fixOwner} | ${g.deterministicFixForbidden ? "FORBIDDEN" : "OK"} | ${g.rootCauseHypothesis} |`),
    "",
    "## Related Context (smartwatch / smartphone)",
    "",
    "| category | axis | occurrences | share | fixOwner | hypothesis |",
    "|---|---|---:|---:|---|---|",
    ...broader.filter((g) => ["smartwatch", "smartphone"].includes(g.category)).map((g) => `| ${g.category} | ${g.axis} | ${g.occurrences} | ${g.shareOfParsed} | ${g.fixOwner} | ${g.rootCauseHypothesis} |`),
    "",
    "## Key Findings",
    "",
    ...report.keyFindings.map((l) => `- ${l}`),
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
  console.log(`wave4 axis gap: detFixable=${totals.deterministicFixable}, aiL2Only=${totals.aiL2Only}, laptopBlockerSum=${totals.laptopBlockerShareSum}, tabletBlockerSum=${totals.tabletBlockerShareSum}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
