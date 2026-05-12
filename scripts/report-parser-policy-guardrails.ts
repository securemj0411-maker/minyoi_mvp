import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Finding = {
  file: string;
  status: "ok" | "fail";
  checks: Array<{ name: string; ok: boolean; detail: string }>;
};

const reportsDir = path.join(process.cwd(), "reports");

const requiredJsonReports = [
  "earphone-airpods-policy-draft-latest.json",
  "headphone-matched-sku-policy-draft-latest.json",
  "monitor-model-code-policy-draft-latest.json",
  "desktop-cpu-gpu-policy-draft-latest.json",
  "game-console-body-policy-draft-latest.json",
  "parser-policy-conditions-matrix-latest.json",
  "parser-wiring-blockers-latest.json",
  "parser-policy-drafts-index-latest.json",
  "parser-policy-next-actions-latest.json",
  "parser-readiness-all-run-latest.json",
  "parser-readiness-summary-latest.json",
  "parser-report-manifest-latest.json",
  "operating-map-parser-delta-latest.json",
  "parser-hold-diagnosis-latest.json",
  "parser-hold-blockers-index-latest.json",
  "parser-category-evidence-ledger-latest.json",
  "parser-suite-status-latest.json",
  "parser-suite-coverage-latest.json",
  "parser-suite-usage-latest.json",
  "parser-next-work-queue-latest.json",
  "parser-review-examples-index-latest.json",
  "parser-review-top-examples-latest.json",
  "parser-boundary-review-examples-latest.json",
  "parser-boundary-example-coverage-latest.json",
  "parser-airpods-headphone-boundary-examples-latest.json",
  "parser-airpods-headphone-coverage-latest.json",
  "parser-review-coverage-summary-latest.json",
  "earphone-airpods-blockers-latest.json",
  "earphone-airpods-evidence-matrix-latest.json",
  "earphone-parts-exclusion-evidence-latest.json",
  "headphone-matched-sku-blockers-latest.json",
  "headphone-matched-sku-evidence-matrix-latest.json",
  "headphone-airpods-max-review-evidence-latest.json",
  "monitor-model-code-blockers-latest.json",
  "monitor-model-code-deep-dive-latest.json",
  "monitor-hint-false-positive-review-latest.json",
  "monitor-test-candidate-readiness-latest.json",
  "monitor-exclusion-readiness-latest.json",
  "monitor-exclusion-evidence-matrix-latest.json",
  "monitor-pending-model-code-evidence-latest.json",
  "monitor-pending-model-spec-evidence-latest.json",
  "desktop-full-unit-blockers-latest.json",
  "desktop-partial-key-deep-dive-latest.json",
  "desktop-token-review-latest.json",
  "desktop-test-candidate-readiness-latest.json",
  "desktop-test-candidate-token-evidence-latest.json",
  "desktop-cpu-gpu-title-token-boundary-evidence-latest.json",
  "desktop-exclusion-readiness-latest.json",
  "desktop-exclusion-evidence-matrix-latest.json",
  "camera-package-blockers-latest.json",
  "camera-package-deep-dive-latest.json",
  "camera-fixed-lens-accessory-review-latest.json",
  "camera-interchangeable-package-review-latest.json",
  "camera-false-merge-risk-matrix-latest.json",
  "camera-package-evidence-matrix-latest.json",
  "camera-package-signal-boundary-evidence-latest.json",
  "camera-package-title-token-boundary-evidence-latest.json",
  "smartwatch-ambiguity-blockers-latest.json",
  "smartwatch-ambiguity-evidence-matrix-latest.json",
  "smartwatch-connectivity-size-evidence-latest.json",
  "smartwatch-connectivity-model-boundary-evidence-latest.json",
  "speaker-family-blockers-latest.json",
  "speaker-family-deep-dive-latest.json",
  "speaker-device-class-review-latest.json",
  "speaker-device-class-boundary-evidence-latest.json",
  "speaker-portable-model-subset-boundary-evidence-latest.json",
  "speaker-generic-exclusion-readiness-latest.json",
  "speaker-portable-conditions-matrix-latest.json",
  "speaker-portable-generic-overlap-evidence-latest.json",
  "home-appliance-blockers-latest.json",
  "home-appliance-deep-dive-latest.json",
  "home-appliance-logistics-generic-review-latest.json",
  "home-appliance-vacuum-test-candidate-readiness-latest.json",
  "home-appliance-vacuum-model-subtype-boundary-evidence-latest.json",
  "home-appliance-generic-vacuum-exclusion-readiness-latest.json",
  "home-appliance-vacuum-overlap-evidence-latest.json",
  "home-appliance-vacuum-subtype-boundary-evidence-latest.json",
  "game-console-body-blockers-latest.json",
  "game-console-strict-parser-deep-dive-latest.json",
  "game-console-edition-token-review-latest.json",
  "game-console-exclusion-readiness-latest.json",
  "game-console-coverage-matrix-latest.json",
  "game-console-evidence-matrix-latest.json",
  "game-console-body-edition-boundary-evidence-latest.json",
  "game-console-contamination-blockers-latest.json",
  "game-console-contamination-evidence-matrix-latest.json",
  "parser-manifest-audit-latest.json",
  "parser-report-only-audit-latest.json",
];

const forbiddenTextPatterns = [
  /\bpublic\s+ready\b/i,
  /\bpublic\s+approved\b/i,
  /\bapproved\s+for\s+public\b/i,
  /\bpublic\s+promotion\s*:\s*true\b/i,
  /\bruntime\s+catalog\s+apply\s*:\s*true\b/i,
  /\bcandidate\s+pool\s+policy\s+wiring\s*:\s*true\b/i,
];

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path.join(reportsDir, file), "utf8")) as Record<string, unknown>;
}

async function fileText(file: string): Promise<string> {
  return readFile(path.join(reportsDir, file), "utf8");
}

function checkBooleanFalse(report: Record<string, unknown>, key: string): { name: string; ok: boolean; detail: string } {
  return {
    name: `${key}=false`,
    ok: report[key] === false,
    detail: `${key}=${String(report[key])}`,
  };
}

function checkReportOnly(report: Record<string, unknown>): { name: string; ok: boolean; detail: string } {
  return {
    name: "reportOnly=true",
    ok: report.reportOnly === true,
    detail: `reportOnly=${String(report.reportOnly)}`,
  };
}

function checkForbiddenText(file: string, text: string): { name: string; ok: boolean; detail: string } {
  const matches = forbiddenTextPatterns
    .filter((pattern) => pattern.test(text))
    .map((pattern) => pattern.source);
  return {
    name: "forbidden public/wiring text absent",
    ok: matches.length === 0,
    detail: matches.length === 0 ? "no forbidden text" : `${file}: ${matches.join(", ")}`,
  };
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  for (const file of requiredJsonReports) {
    const report = await readJson(file);
    const markdownFile = file.replace(/\.json$/, ".md");
    const jsonText = await fileText(file);
    const markdownText = await fileText(markdownFile);
    const checks = [
      checkReportOnly(report),
      checkBooleanFalse(report, "publicPromotion"),
      checkForbiddenText(file, jsonText),
      checkForbiddenText(markdownFile, markdownText),
    ];

    if (file === "parser-policy-conditions-matrix-latest.json") {
      checks.push(checkBooleanFalse(report, "runtimeCatalogApply"));
      checks.push(checkBooleanFalse(report, "candidatePoolPolicyWiring"));
    }

    findings.push({
      file,
      status: checks.every((check) => check.ok) ? "ok" : "fail",
      checks,
    });
  }

  const failed = findings.filter((finding) => finding.status === "fail");
  const report = {
    generatedAt: new Date().toISOString(),
    reportOnly: true,
    publicPromotion: false,
    runtimeCatalogApply: false,
    candidatePoolPolicyWiring: false,
    filesChecked: findings.length,
    failedCount: failed.length,
    status: failed.length === 0 ? "ok" : "fail",
    findings,
    guardrails: [
      "This is a report-only guardrail check",
      "No runtime catalog apply",
      "No public promotion",
      "No candidate pool policy wiring",
      "No production DB mutation",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-policy-guardrails-latest.json"), JSON.stringify(report, null, 2));

  const table = [
    "| file | status | failed_checks |",
    "| --- | --- | --- |",
    ...findings.map((finding) => {
      const failedChecks = finding.checks
        .filter((check) => !check.ok)
        .map((check) => `${check.name}: ${check.detail}`)
        .join("<br>");
      return `| ${finding.file} | ${finding.status} | ${failedChecks || "-"} |`;
    }),
  ].join("\n");

  const md = [
    "# Parser Policy Guardrails",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    `Status: ${report.status}`,
    "",
    table,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");

  await writeFile(path.join(reportsDir, "parser-policy-guardrails-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-policy-guardrails-latest.json");
  console.log("wrote reports/parser-policy-guardrails-latest.md");
  console.log(`guardrails status=${report.status}; files=${report.filesChecked}; failed=${report.failedCount}`);
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
