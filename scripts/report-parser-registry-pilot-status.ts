import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportsDir = path.join(process.cwd(), "reports");

const targets = [
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-smartwatch-", "report-smartwatch-galaxywatch-", "report-smartwatch-applewatch-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-earphone-airpods-", "report-earphone-galaxybuds-", "report-earphone-parts-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-headphone-matched-sku-", "report-headphone-airpods-max-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-monitor-model-code-", "report-monitor-hint-", "report-monitor-test-", "report-monitor-exclusion-", "report-monitor-pending-model-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-desktop-full-unit-", "report-desktop-partial-key-", "report-desktop-token-review", "report-desktop-test-candidate-", "report-desktop-cpu-gpu-title-token-", "report-desktop-exclusion-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-camera-package-", "report-camera-fixed-lens-", "report-camera-interchangeable-", "report-camera-false-merge-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-speaker-family-", "report-speaker-device-class-", "report-speaker-portable-model-subset-", "report-speaker-generic-exclusion-", "report-speaker-portable-conditions-", "report-speaker-portable-generic-overlap-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-home-appliance-blockers-", "report-home-appliance-deep-dive-", "report-home-appliance-logistics-generic-review-", "report-home-appliance-vacuum-test-candidate-", "report-home-appliance-vacuum-model-subtype-boundary-evidence-", "report-home-appliance-generic-vacuum-exclusion-", "report-home-appliance-vacuum-overlap-", "report-home-appliance-vacuum-subtype-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-readiness-all.ts",
    registryToken: "compileChainArtifacts(registryPacketSuites).readinessSteps",
    literalNeedles: ["report-game-console-body-", "report-game-console-strict-", "report-game-console-edition-", "report-game-console-exclusion-", "report-game-console-coverage-", "report-game-console-evidence-", "report-game-console-contamination-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "smartwatchCategoryEvidenceSpecs",
    literalNeedles: ["smartwatch-applewatch-", "smartwatch-galaxywatch-", "smartwatch-connectivity-", "smartwatch-strap-accessory-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "earphoneCategoryEvidenceSpecs",
    literalNeedles: ["earphone-airpods-", "earphone-galaxybuds-", "earphone-parts-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "headphoneCategoryEvidenceSpecs",
    literalNeedles: ["headphone-matched-sku-", "headphone-airpods-max-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "monitorCategoryEvidenceSpecs",
    literalNeedles: ["monitor-exclusion-", "monitor-pending-model-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "desktopCategoryEvidenceSpecs",
    literalNeedles: ["desktop-test-candidate-token-evidence-", "desktop-cpu-gpu-title-token-boundary-evidence-", "desktop-exclusion-evidence-matrix-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "cameraCategoryEvidenceSpecs",
    literalNeedles: ["camera-package-evidence-matrix-", "camera-package-signal-boundary-evidence-", "camera-package-title-token-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "speakerCategoryEvidenceSpecs",
    literalNeedles: ["speaker-portable-generic-overlap-evidence-", "speaker-device-class-boundary-evidence-", "speaker-portable-model-subset-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "homeApplianceCategoryEvidenceSpecs",
    literalNeedles: ["home-appliance-vacuum-overlap-evidence-", "home-appliance-vacuum-model-subtype-boundary-evidence-", "home-appliance-vacuum-subtype-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "gameConsoleBodyCategoryEvidenceSpecs",
    literalNeedles: ["game-console-evidence-", "game-console-body-edition-"],
  },
  {
    file: "scripts/report-parser-category-evidence-ledger.ts",
    registryToken: "gameConsoleBroadCategoryEvidenceSpecs",
    literalNeedles: ["game-console-contamination-evidence-"],
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-smartwatch-", "reports/smartwatch-"],
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-earphone-airpods-", "scripts/report-earphone-galaxybuds-", "scripts/report-earphone-parts-", "reports/earphone-airpods-", "reports/earphone-galaxybuds-", "reports/earphone-parts-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-headphone-matched-sku-", "scripts/report-headphone-airpods-max-", "reports/headphone-matched-sku-", "reports/headphone-airpods-max-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-monitor-", "reports/monitor-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-desktop-", "reports/desktop-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-camera-", "reports/camera-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-speaker-", "reports/speaker-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-home-appliance-", "reports/home-appliance-"]
  },
  {
    file: "scripts/report-parser-report-only-audit.ts",
    registryToken: "registryArtifacts.latestPhaseFiles",
    literalNeedles: ["scripts/report-game-console-", "reports/game-console-"]
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["smartwatch-applewatch-", "smartwatch-galaxywatch-", "smartwatch-connectivity-", "smartwatch-strap-accessory-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["earphone-airpods-", "earphone-galaxybuds-", "earphone-parts-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["headphone-matched-sku-", "headphone-airpods-max-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["monitor-model-code-", "monitor-hint-", "monitor-test-", "monitor-exclusion-", "monitor-pending-model-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["desktop-full-unit-blockers-", "desktop-partial-key-deep-dive-", "desktop-token-review-", "desktop-test-candidate-", "desktop-cpu-gpu-title-token-boundary-evidence-", "desktop-exclusion-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["camera-package-blockers-", "camera-package-deep-dive-", "camera-fixed-lens-accessory-review-", "camera-interchangeable-package-review-", "camera-false-merge-risk-matrix-", "camera-package-evidence-matrix-", "camera-package-signal-boundary-evidence-", "camera-package-title-token-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["speaker-family-blockers-", "speaker-family-deep-dive-", "speaker-device-class-review-", "speaker-device-class-boundary-evidence-", "speaker-portable-model-subset-boundary-evidence-", "speaker-generic-exclusion-readiness-", "speaker-portable-conditions-matrix-", "speaker-portable-generic-overlap-evidence-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["home-appliance-blockers-", "home-appliance-deep-dive-", "home-appliance-logistics-generic-review-", "home-appliance-vacuum-test-candidate-readiness-", "home-appliance-vacuum-model-subtype-boundary-evidence-", "home-appliance-generic-vacuum-exclusion-readiness-", "home-appliance-vacuum-overlap-evidence-", "home-appliance-vacuum-subtype-boundary-evidence-"],
  },
  {
    file: "scripts/report-parser-manifest-audit.ts",
    registryToken: "registryArtifacts.manifestFiles",
    literalNeedles: ["game-console-body-", "game-console-strict-", "game-console-edition-", "game-console-exclusion-", "game-console-coverage-", "game-console-evidence-", "game-console-contamination-"],
  },
] as const;

async function countLiteralMatches(text: string, needles: readonly string[]): Promise<number> {
  return needles.reduce((sum, needle) => sum + text.split(needle).length - 1, 0);
}

async function main(): Promise<void> {
  const rows = [];
  for (const target of targets) {
    const abs = path.join(process.cwd(), target.file);
    const text = await readFile(abs, "utf8");
    rows.push({
      file: target.file,
      registryToken: target.registryToken,
      registryEnabled: text.includes(target.registryToken),
      remainingLiteralMatches: await countLiteralMatches(text, target.literalNeedles),
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    scope: "smartwatch + earphone + headphone + monitor + desktop + game-console + camera + speaker + home-appliance registry pilot",
    rows,
    summary: {
      filesChecked: rows.length,
      fullyRegistryBackedFiles: rows.filter((row) => row.registryEnabled && row.remainingLiteralMatches === 0).length,
      remainingLiteralMatches: rows.reduce((sum, row) => sum + row.remainingLiteralMatches, 0),
    },
    guardrails: [
      "Report-only structural audit",
      "No runtime parser wiring",
      "No candidate pool policy wiring",
      "No public promotion",
    ],
  };

  await mkdir(reportsDir, { recursive: true });
  await writeFile(path.join(reportsDir, "parser-registry-pilot-status-latest.json"), JSON.stringify(report, null, 2));
  const md = [
    "# Parser Registry Pilot Status",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "| file | registry token | registry enabled | remaining smartwatch literals |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.file} | ${row.registryToken} | ${row.registryEnabled ? "yes" : "no"} | ${row.remainingLiteralMatches} |`),
    "",
    `- files checked: ${report.summary.filesChecked}`,
    `- fully registry-backed files: ${report.summary.fullyRegistryBackedFiles}`,
    `- remaining smartwatch literal matches: ${report.summary.remainingLiteralMatches}`,
    "",
    "## Guardrails",
    "",
    ...report.guardrails.map((line) => `- ${line}`),
  ].join("\n");
  await writeFile(path.join(reportsDir, "parser-registry-pilot-status-latest.md"), `${md}\n`);
  console.log("wrote reports/parser-registry-pilot-status-latest.json");
  console.log("wrote reports/parser-registry-pilot-status-latest.md");
  console.log(`registry pilot files=${report.summary.filesChecked}; fully_registry_backed=${report.summary.fullyRegistryBackedFiles}; remaining_literals=${report.summary.remainingLiteralMatches}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
