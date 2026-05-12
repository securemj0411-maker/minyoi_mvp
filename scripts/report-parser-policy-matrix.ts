import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Draft = {
  category: string;
  scope: string;
  currentSnapshot?: Record<string, unknown>;
};

type MatrixRow = {
  priority: number;
  category: string;
  draft: string;
  scope: string;
  candidateInternalOnly: string[];
  manualReview: string[];
  mustHold: string[];
  requiredTests: string[];
  forbiddenWiring: string[];
  snapshot: Record<string, unknown>;
};

const reportsDir = path.join(process.cwd(), "reports");

const draftFiles = [
  "earphone-airpods-policy-draft-latest.json",
  "headphone-matched-sku-policy-draft-latest.json",
  "monitor-model-code-policy-draft-latest.json",
  "desktop-cpu-gpu-policy-draft-latest.json",
  "game-console-body-policy-draft-latest.json",
];

const policyConditions: Record<
  string,
  Omit<MatrixRow, "priority" | "category" | "draft" | "scope" | "snapshot">
> = {
  earphone_discovered: {
    candidateInternalOnly: [
      "AirPods SKU가 명시된 normal rows",
      "AirPods 2/3/4/Pro 1/Pro 2 Lightning/Pro 2 USB-C로 분리 가능한 rows",
      "case-only/side-only/accessory/counterfeit/damaged/buying gate를 통과한 rows",
    ],
    manualReview: [
      "AirPods 4 ANC 여부가 불명확한 rows",
      "AirPods Pro 세대가 문장상 모순되거나 Pro 3/4처럼 미지원 세대가 섞인 rows",
      "유닛/단품 표현만 있고 실제 본체 구성이 불명확한 rows",
    ],
    mustHold: [
      "QCY/Tone Free/Beats/Buds/generic earphone rows",
      "left/right side-only 또는 charging case-only rows",
      "counterfeit, damaged, buying/commercial rows",
    ],
    requiredTests: [
      "AirPods side-only and case-only exclusion",
      "AirPods 4 ANC/no-ANC review split",
      "AirPods Pro 2 Lightning vs USB-C connector key",
      "non-AirPods approval-only hold",
    ],
    forbiddenWiring: [
      "Do not promote whole earphone_discovered category",
      "Do not wire non-AirPods rows into candidate pool",
      "Do not treat parser_candidate as public approval",
    ],
  },
  headphone_discovered: {
    candidateInternalOnly: [
      "known matched headphone SKU rows only",
      "AirPods Max rows with non-conflicting connector/generation evidence",
      "Sony WH/Bose QC/Beats/Sennheiser known-model rows with concrete model key",
    ],
    manualReview: [
      "AirPods Max connector/generation missing",
      "AirPods Max color/connector conflict",
      "purchase year only evidence",
      "broad wireless headphone wording without model key",
    ],
    mustHold: [
      "AirPods Max merch/photo-card rows",
      "case/cushion/pad/stand/accessory-only rows",
      "counterfeit, damaged, buying/commercial rows",
    ],
    requiredTests: [
      "AirPods Max merch/photo-card exclusion",
      "AirPods Max Lightning vs USB-C key split",
      "connector/generation missing review gate",
      "known SKU only acceptance",
    ],
    forbiddenWiring: [
      "Do not promote whole headphone_discovered category",
      "Do not merge AirPods Max Lightning and USB-C keys",
      "Do not infer generation from purchase year alone",
    ],
  },
  monitor_discovered: {
    candidateInternalOnly: [
      "explicit model-code rows",
      "brand + known model-code rows",
      "high-confidence model-code hint rows only when accessory/damaged/bundle gates are clear",
    ],
    manualReview: [
      "size/resolution/Hz-only rows without model code",
      "curved/ultrawide/flat ambiguity when model code is missing",
      "panel type or refresh rate conflict",
    ],
    mustHold: [
      "generic monitor rows without model code",
      "monitor arm/stand/cable/power accessory rows",
      "damaged panel, PC bundle, multi-unit, TV/tablet touch panel rows",
    ],
    requiredTests: [
      "model-code required for candidate rows",
      "generic monitor hold",
      "arm/stand/cable exclusion",
      "damaged panel and PC bundle exclusion",
    ],
    forbiddenWiring: [
      "Do not promote generic monitor rows",
      "Do not infer model code from size/resolution/Hz alone",
      "Do not wire eligible-only metric as whole-category readiness",
    ],
  },
  desktop_pc_discovered: {
    candidateInternalOnly: [
      "complete desktop body rows with CPU/GPU key",
      "Apple desktop model rows with concrete model evidence",
      "one-off used full unit rows after commercial/multi/full-set gates pass",
    ],
    manualReview: [
      "CPU-only or GPU-only partial keys",
      "configurable shop listings",
      "RAM/SSD/warranty/newness missing when price comparison depends on them",
    ],
    mustHold: [
      "Windows/Office key rows",
      "component-only rows",
      "buying, commercial shop template, PC-room/office bulk rows",
      "monitor full-set bundle, damaged/mining-risk rows",
    ],
    requiredTests: [
      "Windows key exclusion",
      "component-only exclusion",
      "commercial and PC-room bulk exclusion",
      "CPU/GPU full-unit candidate row",
    ],
    forbiddenWiring: [
      "Do not promote whole desktop_pc_discovered category",
      "Do not compare configurable shop listings with one-off used units",
      "Do not treat CPU/GPU as final key without later spec refinement",
    ],
  },
  game_console_body_narrow: {
    candidateInternalOnly: [
      "Switch OLED/Lite/base body rows when body/full-set config is clear",
      "PS5 rows when disc/digital/slim edition is clear",
      "body_narrow rows only, never broad game_console_discovered rows",
    ],
    manualReview: [
      "Switch base v1/v2/body config ambiguity",
      "PS5 edition ambiguity",
      "Switch 2 leakage until separate policy exists",
    ],
    mustHold: [
      "game title/chip/card/CD rows",
      "controller/accessory-only rows",
      "account/code rows",
      "custom firmware/banned, damaged/parts, buying, multi-bundle rows",
    ],
    requiredTests: [
      "PS5 disc/digital/slim split",
      "Switch OLED/Lite/body config split",
      "game title and controller-only exclusion",
      "Switch 2 review-gate",
    ],
    forbiddenWiring: [
      "Do not use game_console_discovered as ready source",
      "Do not public-promote while strict parser_ready is below threshold",
      "Do not wire body_narrow without main-agent approval",
    ],
  },
};

function markdownList(values: string[]): string {
  return values.map((value) => `- ${value}`).join("<br>");
}

async function readDraft(file: string): Promise<Draft> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as Draft;
}

async function main(): Promise<void> {
  const rows: MatrixRow[] = [];

  for (const [index, file] of draftFiles.entries()) {
    const draft = await readDraft(file);
    const conditions = policyConditions[draft.category];
    if (!conditions) throw new Error(`missing policy conditions for ${draft.category}`);
    rows.push({
      priority: index + 1,
      category: draft.category,
      draft: file,
      scope: draft.scope,
      snapshot: draft.currentSnapshot ?? {},
      ...conditions,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    rows,
    globalGuardrails: [
      "parser_candidate는 public approval이 아니다",
      "runtime catalog apply 금지",
      "public promotion 금지",
      "candidate pool policy wiring 금지",
      "Supabase schema / cron / lifecycle / source health / pack UI 변경 금지",
      "main agent가 DB/worker 안정화 완료 후에만 실제 wiring 검토",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-policy-conditions-matrix-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| priority | category | scope | candidate_internal_only | manual_review | must_hold | required_tests | forbidden_wiring |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ...rows.map((row) =>
      [
        row.priority,
        row.category,
        row.scope,
        markdownList(row.candidateInternalOnly),
        markdownList(row.manualReview),
        markdownList(row.mustHold),
        markdownList(row.requiredTests),
        markdownList(row.forbiddenWiring),
      ].join(" | "),
    ).map((line) => `| ${line} |`),
  ].join("\n");

  const md = [
    "# Parser Policy Conditions Matrix",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Report-only matrix. This is not public promotion, not runtime catalog apply, and not candidate pool wiring.",
    "",
    table,
    "",
    "## Global Guardrails",
    "",
    ...report.globalGuardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-policy-conditions-matrix-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-policy-conditions-matrix-latest.json");
  console.log("wrote reports/parser-policy-conditions-matrix-latest.md");
  console.log(`matrix rows=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
